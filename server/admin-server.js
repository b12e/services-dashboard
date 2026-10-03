/**
 * Admin server (default port 3001)
 *
 * Management UI and API. Authentication is optional: set ADMIN_USERNAME and
 * ADMIN_PASSWORD to require a login (password, HTTP basic auth or passkey).
 */

import express from 'express'
import session from 'express-session'
import cookieParser from 'cookie-parser'
import { doubleCsrf } from 'csrf-csrf'
import rateLimit from 'express-rate-limit'
import crypto from 'crypto'
import fs from 'fs/promises'
import path from 'path'
import multer from 'multer'
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server'
import { isoBase64URL } from '@simplewebauthn/server/helpers'
import { ROOT_DIR, PATHS, readJson, writeJsonAtomic, withFileLock } from './storage.js'
import { loadConfig, saveConfig, brandingFrom, DEFAULT_NAME } from './config.js'
import { validateConnection, getConnectionStatus, clearNpmCache, getNpmServices } from './npm.js'
import {
  buildServices,
  buildCategories,
  loadServicesData,
  saveServicesData,
  sanitizeServiceInput,
  newServiceId,
  npmOverrideKey,
  findOverride,
} from './services.js'
import {
  loadRegistry,
  saveRegistry,
  normalizeName,
  createCategoryEntry,
  autoKeyForNewName,
  restoreBuiltins,
  builtinLabel,
} from './categories.js'
import {
  getIconIndex,
  listIcons,
  resolveIconValue,
  SIMPLE_ICON_ROUTE,
  simpleIconHandler,
} from './icons.js'
import { serveUploads } from './main-server.js'

const ADMIN_DIST = path.join(ROOT_DIR, 'admin-dist')
const PUBLIC_ICON = path.join(ROOT_DIR, 'public', 'icon.svg')

const ADMIN_USERNAME = process.env.ADMIN_USERNAME || ''
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || ''
const AUTH_REQUIRED = !!(ADMIN_USERNAME && ADMIN_PASSWORD)
const RP_NAME = 'Services Dashboard'

// Sessions live in memory, so a per-boot random secret costs nothing and
// avoids a well-known default secret
const SESSION_SECRET = process.env.SESSION_SECRET && process.env.SESSION_SECRET.length >= 32
  ? process.env.SESSION_SECRET
  : crypto.createHash('sha256').update(process.env.SESSION_SECRET || crypto.randomBytes(32)).digest('hex')

function safeEqual(a, b) {
  const hash = value => crypto.createHash('sha256').update(String(value)).digest()
  return crypto.timingSafeEqual(hash(a), hash(b))
}

function checkCredentials(username, password) {
  // Evaluate both so timing does not reveal which one was wrong
  const userOk = safeEqual(username, ADMIN_USERNAME)
  const passOk = safeEqual(password, ADMIN_PASSWORD)
  return userOk && passOk
}

/**
 * WebAuthn relying party for this request. RP_ID and ORIGIN override the
 * detection, which is needed for multi-part TLDs such as example.co.uk.
 */
function getWebAuthnConfig(req) {
  const host = String(req.get('x-forwarded-host') || req.get('host') || 'localhost').split(',')[0].trim()
  const proto = String(req.get('x-forwarded-proto') || req.protocol).split(',')[0].trim()
  const hostname = host.replace(/:\d+$/, '').replace(/^\[|\]$/g, '')

  let rpID = process.env.RP_ID
  if (!rpID) {
    const isIp = /^[\d.]+$/.test(hostname) || hostname.includes(':')
    if (hostname === 'localhost' || hostname.endsWith('.localhost') || isIp) {
      rpID = hostname
    } else {
      // Registrable domain, so a passkey works on every subdomain
      const parts = hostname.split('.')
      rpID = parts.length >= 2 ? parts.slice(-2).join('.') : hostname
    }
  }

  return { rpID, origin: process.env.ORIGIN || `${proto}://${host}` }
}

async function loadAuthData() {
  try {
    const data = await readJson(PATHS.auth, { passkeys: [] })
    return { ...data, passkeys: Array.isArray(data?.passkeys) ? data.passkeys : [] }
  } catch (error) {
    console.error('Could not read auth.json:', error.message)
    return { passkeys: [] }
  }
}

async function saveAuthData(data) {
  await writeJsonAtomic(PATHS.auth, data)
}

function regenerateSession(req) {
  return new Promise((resolve, reject) => {
    req.session.regenerate(error => (error ? reject(error) : resolve()))
  })
}

const UPLOAD_TYPES = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/gif': '.gif',
  'image/webp': '.webp',
  'image/avif': '.avif',
  'image/svg+xml': '.svg',
  'image/x-icon': '.ico',
  'image/vnd.microsoft.icon': '.ico',
}

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      fs.mkdir(PATHS.uploads, { recursive: true }).then(() => cb(null, PATHS.uploads), error => cb(error))
    },
    // The extension comes from the validated type, never from the client's filename
    filename: (req, file, cb) => cb(null, `custom-icon-${Date.now()}${UPLOAD_TYPES[file.mimetype]}`),
  }),
  limits: { fileSize: 2 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => {
    if (UPLOAD_TYPES[file.mimetype]) cb(null, true)
    else cb(new Error('Only PNG, JPEG, GIF, WebP, AVIF, SVG and ICO images are allowed'))
  },
})

/**
 * Remove uploaded icons that are no longer referenced by the config
 */
async function cleanupUploads(keepPath) {
  try {
    const files = await fs.readdir(PATHS.uploads)
    await Promise.all(files
      .filter(file => file.startsWith('custom-icon') && `/uploads/${file}` !== keepPath)
      .map(file => fs.unlink(path.join(PATHS.uploads, file)).catch(() => {})))
  } catch {
    // No uploads directory yet
  }
}

function maskConfig(config) {
  return {
    ...config,
    npmConnections: (config.npmConnections || []).map(connection => {
      const { password, token, ...rest } = connection
      return {
        ...rest,
        password: '',
        hasPassword: !!(password || token),
        status: getConnectionStatus(connection),
      }
    }),
  }
}

/**
 * Keep stored passwords for connections the UI sent back without one
 */
function mergeConnections(incoming, stored) {
  return (Array.isArray(incoming) ? incoming : [])
    .filter(c => c && typeof c === 'object')
    .map((connection, index) => {
      const clean = {
        name: String(connection.name || '').trim(),
        url: String(connection.url || '').trim(),
        username: String(connection.username || '').trim(),
        password: typeof connection.password === 'string' ? connection.password : '',
      }
      if (!clean.password && connection.hasPassword) {
        const previous = stored.find(s => s.url === clean.url && s.username === clean.username) || stored[index]
        if (previous?.password) clean.password = previous.password
        else if (previous?.token) clean.token = previous.token
      }
      return clean
    })
}

function asyncRoute(handler, message) {
  return async (req, res, next) => {
    try {
      await handler(req, res, next)
    } catch (error) {
      console.error(`${message}:`, error)
      if (!res.headersSent) res.status(500).json({ error: message })
    }
  }
}

export function createAdminApp() {
  const app = express()
  app.disable('x-powered-by')
  app.set('trust proxy', process.env.TRUST_PROXY ?? 'loopback, linklocal, uniquelocal')

  const sessionStore = new session.MemoryStore()
  // MemoryStore only drops expired sessions when they are read
  setInterval(() => sessionStore.all(() => {}), 60 * 60 * 1000).unref()

  app.use(express.json({ limit: '1mb' }))
  app.use(cookieParser())
  app.use(session({
    store: sessionStore,
    secret: SESSION_SECRET,
    name: 'dashboard.sid',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: 'auto',
      maxAge: 24 * 60 * 60 * 1000,
    },
  }))

  const { generateCsrfToken, doubleCsrfProtection } = doubleCsrf({
    getSecret: () => SESSION_SECRET,
    getSessionIdentifier: (req) => {
      // Touch the session so it is saved and keeps a stable id
      if (req.session && !req.session.csrfInit) req.session.csrfInit = true
      return req.sessionID || ''
    },
    cookieName: 'x-csrf-token',
    cookieOptions: { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/' },
    size: 64,
    ignoredMethods: ['GET', 'HEAD', 'OPTIONS'],
    getCsrfTokenFromRequest: (req) => req.headers['x-csrf-token'],
  })

  // req.ip honours "trust proxy", so clients can not dodge limits by sending
  // their own X-Forwarded-For header
  const limiter = (max, message) => rateLimit({
    windowMs: 60 * 1000,
    limit: max,
    message: { error: message },
    standardHeaders: true,
    legacyHeaders: false,
  })
  const authRateLimiter = limiter(10, 'Too many authentication attempts, please try again later.')
  const apiRateLimiter = limiter(300, 'Too many requests, please try again later.')
  const writeRateLimiter = limiter(60, 'Too many write operations, please try again later.')

  function requireAuth(req, res, next) {
    if (!AUTH_REQUIRED || req.session?.authenticated) return next()

    const header = req.headers.authorization
    if (header?.startsWith('Basic ')) {
      const credentials = Buffer.from(header.slice(6), 'base64').toString('utf-8')
      const separator = credentials.indexOf(':')
      if (separator !== -1 && checkCredentials(credentials.slice(0, separator), credentials.slice(separator + 1))) {
        return next()
      }
    }

    res.status(401).json({ error: 'Authentication required' })
  }

  app.use('/assets', express.static(path.join(ADMIN_DIST, 'assets'), { immutable: true, maxAge: '1y' }))
  app.get('/icon.svg', (req, res) => res.sendFile(PUBLIC_ICON))
  app.use('/uploads', serveUploads())
  app.get(`${SIMPLE_ICON_ROUTE}/:file`, simpleIconHandler)

  // ---------------------------------------------------------------------
  // Authentication
  // ---------------------------------------------------------------------

  app.get('/api/admin/csrf-token', apiRateLimiter, (req, res) => {
    res.json({ csrfToken: generateCsrfToken(req, res) })
  })

  app.get('/api/admin/auth/status', apiRateLimiter, (req, res) => {
    res.json({
      authRequired: AUTH_REQUIRED,
      authenticated: AUTH_REQUIRED ? !!req.session?.authenticated : true,
    })
  })

  app.post('/api/admin/auth/login', authRateLimiter, doubleCsrfProtection, asyncRoute(async (req, res) => {
    if (!AUTH_REQUIRED) return res.json({ success: true })

    const { username, password } = req.body || {}
    if (typeof username !== 'string' || typeof password !== 'string' || !checkCredentials(username, password)) {
      return res.status(401).json({ error: 'Invalid credentials' })
    }

    // New session id on login prevents session fixation
    await regenerateSession(req)
    req.session.authenticated = true
    res.json({ success: true })
  }, 'Login failed'))

  app.post('/api/admin/auth/logout', apiRateLimiter, doubleCsrfProtection, (req, res) => {
    req.session.destroy((error) => {
      if (error) return res.status(500).json({ error: 'Failed to logout' })
      res.json({ success: true })
    })
  })

  app.get('/api/admin/auth/passkeys/available', authRateLimiter, asyncRoute(async (req, res) => {
    const authData = await loadAuthData()
    res.json({ available: AUTH_REQUIRED && authData.passkeys.length > 0 })
  }, 'Failed to check passkeys'))

  app.get('/api/admin/auth/passkeys/status', apiRateLimiter, requireAuth, asyncRoute(async (req, res) => {
    const authData = await loadAuthData()
    res.json({ hasPasskeys: authData.passkeys.length > 0, count: authData.passkeys.length })
  }, 'Failed to check passkeys'))

  app.post('/api/admin/auth/passkeys/register/options', authRateLimiter, doubleCsrfProtection, requireAuth, asyncRoute(async (req, res) => {
    const { rpID } = getWebAuthnConfig(req)
    const authData = await loadAuthData()

    const options = await generateRegistrationOptions({
      rpName: RP_NAME,
      rpID,
      userID: new TextEncoder().encode('admin'),
      userName: ADMIN_USERNAME || 'admin',
      attestationType: 'none',
      authenticatorSelection: { residentKey: 'preferred', userVerification: 'preferred' },
      excludeCredentials: authData.passkeys.map(passkey => ({
        id: passkey.credentialID,
        transports: passkey.transports,
      })),
    })

    req.session.webauthnChallenge = options.challenge
    res.json(options)
  }, 'Failed to generate registration options'))

  app.post('/api/admin/auth/passkeys/register/verify', authRateLimiter, doubleCsrfProtection, requireAuth, asyncRoute(async (req, res) => {
    const { rpID, origin } = getWebAuthnConfig(req)
    const { credential, name } = req.body || {}
    const expectedChallenge = req.session.webauthnChallenge
    delete req.session.webauthnChallenge

    if (!expectedChallenge) return res.status(400).json({ error: 'No registration in progress, please try again' })

    let verification
    try {
      verification = await verifyRegistrationResponse({
        response: credential,
        expectedChallenge,
        expectedOrigin: origin,
        expectedRPID: rpID,
      })
    } catch (error) {
      return res.status(400).json({ error: `Verification failed: ${error.message}` })
    }

    if (!verification.verified || !verification.registrationInfo) {
      return res.status(400).json({ error: 'Verification failed' })
    }

    const { credential: info } = verification.registrationInfo
    const passkeyName = await withFileLock('auth', async () => {
      const authData = await loadAuthData()
      const passkey = {
        credentialID: info.id,
        credentialPublicKey: isoBase64URL.fromBuffer(info.publicKey),
        counter: info.counter,
        transports: info.transports || [],
        name: typeof name === 'string' && name.trim() ? name.trim().slice(0, 100) : `Passkey ${authData.passkeys.length + 1}`,
        createdAt: new Date().toISOString(),
      }
      authData.passkeys.push(passkey)
      await saveAuthData(authData)
      return passkey.name
    })

    res.json({ verified: true, name: passkeyName })
  }, 'Failed to verify registration'))

  // WebAuthn has its own challenge/response, so no CSRF token is needed here
  app.post('/api/admin/auth/passkeys/login/options', authRateLimiter, asyncRoute(async (req, res) => {
    if (!AUTH_REQUIRED) return res.status(400).json({ error: 'Authentication is disabled' })
    const { rpID } = getWebAuthnConfig(req)
    const authData = await loadAuthData()
    if (authData.passkeys.length === 0) return res.status(400).json({ error: 'No passkeys registered' })

    const options = await generateAuthenticationOptions({
      rpID,
      allowCredentials: authData.passkeys.map(passkey => ({
        id: passkey.credentialID,
        transports: passkey.transports,
      })),
      userVerification: 'preferred',
    })

    req.session.webauthnChallenge = options.challenge
    res.json(options)
  }, 'Failed to generate authentication options'))

  app.post('/api/admin/auth/passkeys/login/verify', authRateLimiter, asyncRoute(async (req, res) => {
    if (!AUTH_REQUIRED) return res.status(400).json({ error: 'Authentication is disabled' })
    const { rpID, origin } = getWebAuthnConfig(req)
    const { credential } = req.body || {}
    const expectedChallenge = req.session.webauthnChallenge
    delete req.session.webauthnChallenge

    if (!expectedChallenge) return res.status(400).json({ error: 'No login in progress, please try again' })
    if (!credential?.id) return res.status(400).json({ error: 'Missing credential' })

    const verified = await withFileLock('auth', async () => {
      const authData = await loadAuthData()
      const passkey = authData.passkeys.find(p => p.credentialID === credential.id)
      if (!passkey) return { error: 'Passkey not found' }

      let verification
      try {
        verification = await verifyAuthenticationResponse({
          response: credential,
          expectedChallenge,
          expectedOrigin: origin,
          expectedRPID: rpID,
          credential: {
            id: passkey.credentialID,
            publicKey: isoBase64URL.toBuffer(passkey.credentialPublicKey),
            counter: passkey.counter,
            transports: passkey.transports,
          },
        })
      } catch (error) {
        return { error: `Verification failed: ${error.message}` }
      }
      if (!verification.verified) return { error: 'Verification failed' }

      passkey.counter = verification.authenticationInfo.newCounter
      passkey.lastUsedAt = new Date().toISOString()
      await saveAuthData(authData)
      return { ok: true }
    })

    if (!verified.ok) return res.status(400).json({ error: verified.error })

    await regenerateSession(req)
    req.session.authenticated = true
    res.json({ verified: true })
  }, 'Failed to verify authentication'))

  app.get('/api/admin/auth/passkeys', apiRateLimiter, requireAuth, asyncRoute(async (req, res) => {
    const authData = await loadAuthData()
    res.json(authData.passkeys.map(p => ({
      id: p.credentialID,
      name: p.name,
      createdAt: p.createdAt,
      lastUsedAt: p.lastUsedAt || null,
    })))
  }, 'Failed to list passkeys'))

  app.delete('/api/admin/auth/passkeys/:id', writeRateLimiter, doubleCsrfProtection, requireAuth, asyncRoute(async (req, res) => {
    const removed = await withFileLock('auth', async () => {
      const authData = await loadAuthData()
      // Accept the credential id, or the list index used by older UIs
      let index = authData.passkeys.findIndex(p => p.credentialID === req.params.id)
      if (index === -1 && /^\d+$/.test(req.params.id)) index = Number(req.params.id)
      if (index < 0 || index >= authData.passkeys.length) return false
      authData.passkeys.splice(index, 1)
      await saveAuthData(authData)
      return true
    })
    if (!removed) return res.status(404).json({ error: 'Passkey not found' })
    res.json({ success: true })
  }, 'Failed to delete passkey'))

  // ---------------------------------------------------------------------
  // Services
  // ---------------------------------------------------------------------

  app.get('/api/admin/services', apiRateLimiter, requireAuth, asyncRoute(async (req, res) => {
    res.json(await buildServices({ admin: true }))
  }, 'Failed to load services'))

  async function validCategoryIds(ids) {
    if (!Array.isArray(ids)) return ids
    const registry = await loadRegistry()
    const known = new Set(registry.categories.map(c => c.id))
    return ids.filter(id => known.has(id))
  }

  app.post('/api/admin/services', writeRateLimiter, doubleCsrfProtection, requireAuth, asyncRoute(async (req, res) => {
    const { value, error } = sanitizeServiceInput(req.body)
    if (error) return res.status(400).json({ error })

    const service = { id: newServiceId(), ...value }
    if (service.categoryIds === null) delete service.categoryIds
    else if (service.categoryIds) service.categoryIds = await validCategoryIds(service.categoryIds)

    await withFileLock('data', async () => {
      const data = await loadServicesData()
      data.manualServices.push(service)
      await saveServicesData(data)
    })
    res.status(201).json(service)
  }, 'Failed to add service'))

  app.put('/api/admin/services/:id', writeRateLimiter, doubleCsrfProtection, requireAuth, asyncRoute(async (req, res) => {
    const serviceId = req.params.id
    const isNpm = serviceId.startsWith('npm:') || serviceId.startsWith('npm_')
    const { value, error } = sanitizeServiceInput(req.body, { npm: isNpm })
    if (error) return res.status(400).json({ error })
    if (Array.isArray(value.categoryIds)) value.categoryIds = await validCategoryIds(value.categoryIds)

    if (!isNpm) {
      const result = await withFileLock('data', async () => {
        const data = await loadServicesData()
        const index = data.manualServices.findIndex((s, i) => s.id === serviceId || `manual_${i}` === serviceId)
        if (index === -1) return null
        const service = { id: data.manualServices[index].id || newServiceId(), ...value }
        if (service.categoryIds === null) delete service.categoryIds
        data.manualServices[index] = service
        await saveServicesData(data)
        return service
      })
      if (!result) return res.status(404).json({ error: 'Service not found' })
      return res.json(result)
    }

    // NPM service: store only what differs from the discovered defaults
    const config = await loadConfig()
    const domain = serviceId.startsWith('npm:') ? serviceId.slice(4) : null
    const npmService = (await getNpmServices(config))
      .find(s => (domain ? s.domain === domain : `npm_${s.npmId}` === serviceId))
    if (!npmService) return res.status(404).json({ error: 'Service not found in Nginx Proxy Manager' })

    const override = {}
    if (value.name && value.name !== npmService.name) override.name = value.name
    if (value.description) override.description = value.description
    if (value.icon) override.icon = value.icon
    if (Array.isArray(value.categoryIds)) override.categoryIds = value.categoryIds
    if (value.hidden === true) override.hidden = true

    await withFileLock('data', async () => {
      const data = await loadServicesData()
      const { key: existingKey } = findOverride(data.overrides, npmService)
      if (existingKey) delete data.overrides[existingKey]
      if (Object.keys(override).length > 0) data.overrides[npmOverrideKey(npmService.domain)] = override
      await saveServicesData(data)
    })
    res.json({ id: npmOverrideKey(npmService.domain), ...override })
  }, 'Failed to update service'))

  app.delete('/api/admin/services/:id', writeRateLimiter, doubleCsrfProtection, requireAuth, asyncRoute(async (req, res) => {
    const serviceId = req.params.id
    const found = await withFileLock('data', async () => {
      const data = await loadServicesData()
      if (serviceId.startsWith('npm:') || serviceId.startsWith('npm_')) {
        // Remove the customizations, the service itself lives in NPM
        const keys = [serviceId]
        if (serviceId.startsWith('npm:')) {
          const npmService = (await getNpmServices(await loadConfig())).find(s => s.domain === serviceId.slice(4))
          if (npmService) keys.push(`npm_${npmService.npmId}`)
        }
        const existing = keys.filter(key => data.overrides[key])
        existing.forEach(key => delete data.overrides[key])
        if (existing.length > 0) await saveServicesData(data)
        return true
      }
      const index = data.manualServices.findIndex((s, i) => s.id === serviceId || `manual_${i}` === serviceId)
      if (index === -1) return false
      data.manualServices.splice(index, 1)
      await saveServicesData(data)
      return true
    })
    if (!found) return res.status(404).json({ error: 'Service not found' })
    res.json({ success: true })
  }, 'Failed to delete service'))

  // ---------------------------------------------------------------------
  // Categories
  // ---------------------------------------------------------------------

  app.get('/api/admin/categories', apiRateLimiter, requireAuth, asyncRoute(async (req, res) => {
    const services = await buildServices({ admin: true })
    const categories = await buildCategories(services, { admin: true })
    res.json(categories.map(c => ({ ...c, autoLabel: c.autoKey ? builtinLabel(c.autoKey) : null })))
  }, 'Failed to load categories'))

  function cleanCategoryName(name) {
    return typeof name === 'string' ? name.trim().replace(/\s+/g, ' ').slice(0, 60) : ''
  }

  app.post('/api/admin/categories', writeRateLimiter, doubleCsrfProtection, requireAuth, asyncRoute(async (req, res) => {
    const name = cleanCategoryName(req.body?.name)
    if (!name) return res.status(400).json({ error: 'Category name is required' })

    const result = await withFileLock('data', async () => {
      const registry = structuredClone(await loadRegistry())
      if (registry.categories.some(c => normalizeName(c.name) === normalizeName(name))) {
        return { status: 409, body: { error: `A category named "${name}" already exists` } }
      }
      const category = createCategoryEntry(registry, name)
      registry.categories.push(category)
      await saveRegistry(registry)
      return { status: 201, body: category }
    })
    res.status(result.status).json(result.body)
  }, 'Failed to create category'))

  app.patch('/api/admin/categories/:id', writeRateLimiter, doubleCsrfProtection, requireAuth, asyncRoute(async (req, res) => {
    const result = await withFileLock('data', async () => {
      const registry = structuredClone(await loadRegistry())
      const category = registry.categories.find(c => c.id === req.params.id)
      if (!category) return { status: 404, body: { error: 'Category not found' } }

      if (req.body?.name !== undefined) {
        const name = cleanCategoryName(req.body.name)
        if (!name) return { status: 400, body: { error: 'Category name is required' } }
        if (registry.categories.some(c => c.id !== category.id && normalizeName(c.name) === normalizeName(name))) {
          return { status: 409, body: { error: `A category named "${name}" already exists` } }
        }
        category.name = name
        if (!category.autoKey) {
          const autoKey = autoKeyForNewName(registry, name, category.id)
          if (autoKey) category.autoKey = autoKey
        }
      }
      if (typeof req.body?.visible === 'boolean') category.visible = req.body.visible
      category.updatedAt = new Date().toISOString()

      await saveRegistry(registry)
      return { status: 200, body: category }
    })
    res.status(result.status).json(result.body)
  }, 'Failed to update category'))

  app.delete('/api/admin/categories/:id', writeRateLimiter, doubleCsrfProtection, requireAuth, asyncRoute(async (req, res) => {
    const id = req.params.id
    const found = await withFileLock('data', async () => {
      const registry = structuredClone(await loadRegistry())
      const before = registry.categories.length
      registry.categories = registry.categories.filter(c => c.id !== id)
      if (registry.categories.length === before) return false

      // Services that only had this category go back to auto-detection
      const data = await loadServicesData()
      let changed = false
      for (const owner of [...data.manualServices, ...Object.values(data.overrides)]) {
        if (!Array.isArray(owner?.categoryIds) || !owner.categoryIds.includes(id)) continue
        owner.categoryIds = owner.categoryIds.filter(c => c !== id)
        if (owner.categoryIds.length === 0) delete owner.categoryIds
        changed = true
      }
      if (changed) await saveServicesData(data)
      await saveRegistry(registry)
      return true
    })
    if (!found) return res.status(404).json({ error: 'Category not found' })
    res.json({ success: true })
  }, 'Failed to delete category'))

  app.post('/api/admin/categories/restore-defaults', writeRateLimiter, doubleCsrfProtection, requireAuth, asyncRoute(async (req, res) => {
    const restored = await withFileLock('data', async () => {
      const registry = structuredClone(await loadRegistry())
      const count = restoreBuiltins(registry)
      if (count > 0) await saveRegistry(registry)
      return count
    })
    res.json({ success: true, restored })
  }, 'Failed to restore categories'))

  // ---------------------------------------------------------------------
  // Icons
  // ---------------------------------------------------------------------

  app.get('/api/icons', apiRateLimiter, (req, res) => {
    res.set('Cache-Control', 'private, max-age=3600')
    res.json(listIcons())
  })

  app.get('/api/icons/preview/:iconName', apiRateLimiter, (req, res) => {
    const result = resolveIconValue(getIconIndex(), req.params.iconName)
    if (!result) return res.status(404).json({ error: 'Icon not found' })
    res.json({ url: result.url, source: result.source, name: result.name })
  })

  // ---------------------------------------------------------------------
  // Configuration and branding
  // ---------------------------------------------------------------------

  app.get('/api/branding', apiRateLimiter, asyncRoute(async (req, res) => {
    res.json(brandingFrom(await loadConfig()))
  }, 'Failed to load branding'))

  app.get('/api/admin/config', apiRateLimiter, requireAuth, asyncRoute(async (req, res) => {
    res.json(maskConfig(await loadConfig()))
  }, 'Failed to read configuration'))

  app.put('/api/admin/config', writeRateLimiter, doubleCsrfProtection, requireAuth, asyncRoute(async (req, res) => {
    const body = req.body || {}
    const config = await withFileLock('config', async () => {
      const stored = await loadConfig()
      const next = {
        ...stored,
        baseUrl: typeof body.baseUrl === 'string' ? body.baseUrl.trim() : stored.baseUrl,
        npmEnabled: typeof body.npmEnabled === 'boolean' ? body.npmEnabled : stored.npmEnabled,
        npmConnections: body.npmConnections !== undefined
          ? mergeConnections(body.npmConnections, stored.npmConnections)
          : stored.npmConnections,
        customName: typeof body.customName === 'string' ? (body.customName.trim() || DEFAULT_NAME) : stored.customName,
        customIcon: typeof body.customIcon === 'string' && body.customIcon.startsWith('/uploads/') ? body.customIcon : null,
      }
      delete next.categories
      await saveConfig(next)
      return next
    })

    clearNpmCache()
    await cleanupUploads(config.customIcon)

    let validationResults = []
    if (config.npmEnabled) {
      validationResults = await Promise.all(config.npmConnections.map(async (connection, index) => {
        if (!connection.url) return { index, name: connection.name || `Connection ${index + 1}`, valid: false, error: 'URL is required' }
        const result = await validateConnection(connection)
        return { index, name: connection.name || connection.url, ...result }
      }))
    }

    res.json({ config: maskConfig(config), validationResults, success: true })
  }, 'Failed to update configuration'))

  app.post('/api/admin/upload/icon', writeRateLimiter, doubleCsrfProtection, requireAuth, (req, res) => {
    upload.single('icon')(req, res, (error) => {
      if (error) {
        const message = error.code === 'LIMIT_FILE_SIZE' ? 'File is larger than 2MB' : error.message
        return res.status(400).json({ error: message })
      }
      if (!req.file) return res.status(400).json({ error: 'No file uploaded' })
      res.json({ success: true, iconPath: `/uploads/${req.file.filename}` })
    })
  })

  app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }))

  // Admin UI
  app.get('*', apiRateLimiter, (req, res) => {
    res.sendFile(path.join(ADMIN_DIST, 'index.html'), error => {
      if (error) res.status(404).send('Admin UI not built. Run "npm run admin:build".')
    })
  })

  // CSRF failures and other middleware errors as JSON
  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error)
    const status = error.status || error.statusCode || 500
    if (status >= 500) console.error('Admin server error:', error)
    res.status(status).json({ error: status === 403 ? 'Invalid or missing CSRF token' : 'Request failed' })
  })

  return app
}

export function startAdminServer({ port = process.env.ADMIN_PORT || 3001 } = {}) {
  const app = createAdminApp()
  return new Promise(resolve => {
    const server = app.listen(port, () => {
      console.log(`✓ Admin panel listening on port ${port} (authentication ${AUTH_REQUIRED ? 'enabled' : 'disabled'})`)
      resolve(server)
    })
  })
}
