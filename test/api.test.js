import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'fs/promises'
import os from 'os'
import path from 'path'
import express from 'express'

const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'dashboard-test-'))
process.env.DATA_DIR = dataDir
process.env.ICON_METADATA_REFRESH = 'false'
process.env.ADMIN_USERNAME = 'admin'
process.env.ADMIN_PASSWORD = 'pa:ss'

const servers = []
let main
let admin

function listen(app) {
  return new Promise(resolve => {
    const server = app.listen(0, '127.0.0.1', () => {
      servers.push(server)
      resolve(`http://127.0.0.1:${server.address().port}`)
    })
  })
}

// Minimal Nginx Proxy Manager API
function fakeNpm() {
  const app = express()
  app.use(express.json())
  app.post('/api/tokens', (req, res) => {
    if (req.body.identity === 'npm@example.com' && req.body.secret === 'npm-secret') return res.json({ token: 'tok' })
    res.status(401).json({ error: 'bad credentials' })
  })
  app.get('/api/nginx/proxy-hosts', (req, res) => {
    if (req.headers.authorization !== 'Bearer tok') return res.status(401).end()
    res.json([
      { id: 1, enabled: 1, domain_names: ['sonarr.example.com'], certificate_id: 1, forward_host: 'sonarr', forward_port: 8989 },
      { id: 2, enabled: 1, domain_names: ['ha.example.com'], certificate_id: 1, forward_host: '10.0.0.5', forward_port: 8123 },
      { id: 3, enabled: 0, domain_names: ['disabled.example.com'], certificate_id: 0 },
      { id: 4, enabled: 1, domain_names: ['*.example.com'], certificate_id: 1 },
      { id: 5, enabled: 1, domain_names: ['plex.example.com'], certificate_id: 1, forward_host: 'plex' },
    ])
  })
  return app
}

class Client {
  constructor(base) {
    this.base = base
    this.cookies = new Map()
    this.csrf = null
  }

  async request(method, url, { body, headers = {}, raw } = {}) {
    const response = await fetch(this.base + url, {
      method,
      headers: {
        ...(body && !raw ? { 'Content-Type': 'application/json' } : {}),
        ...(this.csrf && method !== 'GET' ? { 'x-csrf-token': this.csrf } : {}),
        Cookie: [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; '),
        ...headers,
      },
      body: raw || (body ? JSON.stringify(body) : undefined),
    })
    for (const cookie of response.headers.getSetCookie()) {
      const [pair] = cookie.split(';')
      const [name, ...value] = pair.split('=')
      this.cookies.set(name, value.join('='))
    }
    const text = await response.text()
    let json = null
    try { json = JSON.parse(text) } catch { /* not JSON */ }
    return { status: response.status, json, headers: response.headers }
  }

  async refreshCsrf() {
    this.csrf = (await this.request('GET', '/api/admin/csrf-token')).json.csrfToken
  }
}

before(async () => {
  const npmUrl = await listen(fakeNpm())

  // Data as written by the previous version
  await fs.writeFile(path.join(dataDir, 'config.json'), JSON.stringify({
    baseUrl: 'example.com',
    npmEnabled: true,
    npmConnections: [{ name: 'Main', url: `${npmUrl}/`, username: 'npm@example.com', password: 'npm-secret' }],
    categories: [],
    customName: 'Homelab',
  }))
  await fs.writeFile(path.join(dataDir, 'categories.json'), JSON.stringify([
    { id: 'cat_a', name: 'Media', displayName: 'Media', visible: true, configured: false, source: 'auto' },
    { id: 'cat_b', name: 'Developer-Tools', displayName: 'Developer-Tools', visible: true, configured: false, source: 'auto' },
    { id: 'cat_c', name: 'Other', displayName: 'Other', visible: true, configured: false, source: 'auto' },
  ]))
  await fs.writeFile(path.join(dataDir, 'services.json'), JSON.stringify({
    manualServices: [
      { name: 'Router', url: 'http://192.168.1.1', appendBaseDomain: false, icon: '' },
      { name: 'Wiki', url: 'wiki', appendBaseDomain: true, categoryIds: ['cat_c'] },
      { name: 'Secret', url: 'secret', hidden: true },
    ],
    overrides: { npm_1: { name: 'TV Shows', icon: 'sonarr' } },
  }))

  const { migrateData } = await import('../server/services.js')
  const { initIcons } = await import('../server/icons.js')
  const { createMainApp } = await import('../server/main-server.js')
  const { createAdminApp } = await import('../server/admin-server.js')

  await migrateData()
  await initIcons()
  main = new Client(await listen(createMainApp()))
  admin = new Client(await listen(createAdminApp()))
})

after(async () => {
  servers.forEach(server => server.close())
  await fs.rm(dataDir, { recursive: true, force: true })
})

test('legacy data is migrated on startup', async () => {
  const registry = JSON.parse(await fs.readFile(path.join(dataDir, 'categories.json'), 'utf-8'))
  assert.equal(registry.version, 2)
  assert.ok(!registry.categories.some(c => c.name === 'Other' || c.name === 'Developer-Tools'))

  const services = JSON.parse(await fs.readFile(path.join(dataDir, 'services.json'), 'utf-8'))
  assert.ok(services.manualServices.every(s => /^svc_/.test(s.id)), 'manual services get stable ids')
  assert.equal(services.manualServices[1].categoryIds, undefined, 'a service that only had "Other" is automatic again')

  const config = JSON.parse(await fs.readFile(path.join(dataDir, 'config.json'), 'utf-8'))
  assert.equal(config.categories, undefined)

  const backups = (await fs.readdir(dataDir)).filter(f => f.includes('pre-v2'))
  assert.equal(backups.length, 2)
})

test('public dashboard', async () => {
  const { status, json } = await main.request('GET', '/api/public/dashboard')
  assert.equal(status, 200)
  assert.equal(json.branding.customName, 'Homelab')

  const byName = Object.fromEntries(json.services.map(s => [s.name, s]))
  assert.deepEqual(Object.keys(byName).sort(), ['HA', 'Plex', 'Router', 'TV Shows', 'Wiki'])
  assert.ok(!byName.Secret, 'hidden services are not public')

  assert.equal(byName['TV Shows'].href, 'https://sonarr.example.com', 'legacy npm_<id> override still applies')
  assert.equal(byName.Wiki.href, 'https://wiki.example.com')
  assert.equal(byName.Router.href, 'http://192.168.1.1')

  const media = json.categories.find(c => c.name === 'Media')
  assert.ok(byName.Plex.categoryIds.includes(media.id))
  assert.ok(byName['TV Shows'].categoryIds.includes(media.id))
  assert.equal(media.serviceCount, 2)
  assert.equal(json.categories.find(c => c.name === 'Home Automation').serviceCount, 1)
  const productivity = json.categories.find(c => c.name === 'Productivity')
  assert.deepEqual(byName.Wiki.categoryIds, [productivity.id], '"wiki" is now auto-detected')

  const text = JSON.stringify(json)
  assert.ok(!text.includes('npm-secret'))
  assert.ok(!text.includes('10.0.0.5'), 'forward hosts are not exposed')
})

test('admin API requires login and a CSRF token', async () => {
  assert.equal((await admin.request('GET', '/api/admin/services')).status, 401)

  assert.equal((await admin.request('POST', '/api/admin/auth/login', { body: { username: 'admin', password: 'pa:ss' } })).status, 403)

  await admin.refreshCsrf()
  assert.equal((await admin.request('POST', '/api/admin/auth/login', { body: { username: 'admin', password: 'wrong' } })).status, 401)
  assert.equal((await admin.request('POST', '/api/admin/auth/login', { body: { username: 'admin', password: 'pa:ss' } })).status, 200)

  // The session id changes on login, so the client needs a fresh token
  await admin.refreshCsrf()
  assert.equal((await admin.request('GET', '/api/admin/services')).status, 200)
})

test('basic auth works with a colon in the password', async () => {
  const basic = `Basic ${Buffer.from('admin:pa:ss').toString('base64')}`
  assert.equal((await main.request('GET', '/api/public/services')).status, 200)
  const response = await new Client(admin.base).request('GET', '/api/admin/categories', { headers: { Authorization: basic } })
  assert.equal(response.status, 200)
})

test('config hides NPM passwords and keeps them on save', async () => {
  const { json: config } = await admin.request('GET', '/api/admin/config')
  assert.equal(config.npmConnections[0].password, '')
  assert.equal(config.npmConnections[0].hasPassword, true)

  const saved = await admin.request('PUT', '/api/admin/config', { body: { ...config, customName: 'Lab' } })
  assert.equal(saved.status, 200)
  assert.equal(saved.json.validationResults[0].valid, true)

  const stored = JSON.parse(await fs.readFile(path.join(dataDir, 'config.json'), 'utf-8'))
  assert.equal(stored.npmConnections[0].password, 'npm-secret')
  assert.equal(stored.customName, 'Lab')
})

test('customizing an NPM service stores only the differences', async () => {
  const services = (await admin.request('GET', '/api/admin/services')).json
  const ha = services.find(s => s.id === 'npm:ha.example.com')
  assert.equal(ha.categoriesAuto, true)
  assert.equal(ha.autoCategory.key, 'home')
  assert.equal(ha.npm.forwardHost, '10.0.0.5')

  const sonarr = services.find(s => s.id === 'npm:sonarr.example.com')
  const response = await admin.request('PUT', `/api/admin/services/${encodeURIComponent(sonarr.id)}`, {
    body: { name: 'TV Shows', icon: 'sonarr', categoryIds: null, hidden: false, description: '' },
  })
  assert.equal(response.status, 200)

  const stored = JSON.parse(await fs.readFile(path.join(dataDir, 'services.json'), 'utf-8'))
  assert.equal(stored.overrides.npm_1, undefined, 'legacy key is replaced')
  assert.deepEqual(stored.overrides['npm:sonarr.example.com'], { name: 'TV Shows', icon: 'sonarr' })

  const reset = await admin.request('DELETE', `/api/admin/services/${encodeURIComponent(sonarr.id)}`)
  assert.equal(reset.status, 200)
  const after = JSON.parse(await fs.readFile(path.join(dataDir, 'services.json'), 'utf-8'))
  assert.equal(after.overrides['npm:sonarr.example.com'], undefined)
})

test('manual services CRUD', async () => {
  const created = await admin.request('POST', '/api/admin/services', {
    body: { name: 'Grafana', url: 'grafana', appendBaseDomain: true, _id: 'evil' },
  })
  assert.equal(created.status, 201)
  assert.match(created.json.id, /^svc_/)
  assert.equal(created.json._id, undefined)

  const list = (await admin.request('GET', '/api/admin/services')).json
  const grafana = list.find(s => s.id === created.json.id)
  assert.equal(grafana.href, 'https://grafana.example.com')
  assert.equal(grafana.autoCategory.key, 'monitoring')

  const updated = await admin.request('PUT', `/api/admin/services/${created.json.id}`, {
    body: { name: 'Grafana', url: 'grafana', categoryIds: [] },
  })
  assert.deepEqual(updated.json.categoryIds, [])

  assert.equal((await admin.request('DELETE', `/api/admin/services/${created.json.id}`)).status, 200)
  assert.equal((await admin.request('DELETE', `/api/admin/services/${created.json.id}`)).status, 404)
})

test('category management', async () => {
  const created = await admin.request('POST', '/api/admin/categories', { body: { name: 'Kids' } })
  assert.equal(created.status, 201)
  assert.equal((await admin.request('POST', '/api/admin/categories', { body: { name: 'kids' } })).status, 409)

  const categories = (await admin.request('GET', '/api/admin/categories')).json
  const media = categories.find(c => c.autoKey === 'media')

  // Renaming keeps the auto rules
  await admin.request('PATCH', `/api/admin/categories/${media.id}`, { body: { name: 'Movies & TV' } })
  let dashboard = (await main.request('GET', '/api/public/dashboard')).json
  assert.ok(dashboard.categories.some(c => c.name === 'Movies & TV' && c.serviceCount === 2))

  // Hidden categories disappear from the dashboard
  await admin.request('PATCH', `/api/admin/categories/${media.id}`, { body: { visible: false } })
  dashboard = (await main.request('GET', '/api/public/dashboard')).json
  assert.ok(!dashboard.categories.some(c => c.id === media.id))
  assert.ok(!dashboard.services.some(s => s.categoryIds.includes(media.id)))

  // Deleted categories are not recreated by auto-detection
  assert.equal((await admin.request('DELETE', `/api/admin/categories/${media.id}`)).status, 200)
  dashboard = (await main.request('GET', '/api/public/dashboard')).json
  const registry = JSON.parse(await fs.readFile(path.join(dataDir, 'categories.json'), 'utf-8'))
  assert.ok(!registry.categories.some(c => c.autoKey === 'media'))
  assert.deepEqual(dashboard.services.find(s => s.name === 'Plex').categoryIds, [])

  const restored = await admin.request('POST', '/api/admin/categories/restore-defaults')
  assert.equal(restored.json.restored, 1)
})

test('uploads are stored with a safe extension and served inert', async () => {
  const form = new FormData()
  form.append('icon', new Blob(['<script>alert(1)</script>'], { type: 'image/png' }), 'evil.html')
  const response = await admin.request('POST', '/api/admin/upload/icon', { raw: form })
  assert.equal(response.status, 200)
  assert.match(response.json.iconPath, /^\/uploads\/custom-icon-\d+\.png$/)

  const served = await fetch(main.base + response.json.iconPath)
  assert.match(served.headers.get('content-security-policy'), /sandbox/)
  assert.equal(served.headers.get('x-content-type-options'), 'nosniff')

  const rejected = new FormData()
  rejected.append('icon', new Blob(['<html>'], { type: 'text/html' }), 'evil.html')
  assert.equal((await admin.request('POST', '/api/admin/upload/icon', { raw: rejected })).status, 400)
})

test('simple icons are served locally and readable on the dark theme', async () => {
  const response = await fetch(`${main.base}/api/icons/si/github.svg`)
  assert.equal(response.status, 200)
  assert.match(await response.text(), /fill="#f2f2f2"/)
  assert.equal((await fetch(`${main.base}/api/icons/si/..%2Fpackage.json`)).status, 404)
})
