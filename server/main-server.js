/**
 * Public dashboard server (default port 3000)
 *
 * Serves the dashboard UI and a read-only API. NPM credentials and internal
 * details (forward hosts and ports) never leave the server.
 */

import express from 'express'
import path from 'path'
import { ROOT_DIR, PATHS } from './storage.js'
import { loadConfig, brandingFrom } from './config.js'
import { buildServices, buildCategories } from './services.js'
import { SIMPLE_ICON_ROUTE, simpleIconHandler } from './icons.js'

const DIST_DIR = path.join(ROOT_DIR, 'dist')

/**
 * Uploaded files are user content: never let the browser run them as a page
 */
export function serveUploads() {
  return express.static(PATHS.uploads, {
    index: false,
    dotfiles: 'deny',
    setHeaders(res) {
      res.set('X-Content-Type-Options', 'nosniff')
      res.set('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; sandbox")
    },
  })
}

function sendError(res, message, error) {
  console.error(`${message}:`, error)
  res.status(500).json({ error: message })
}

export function createMainApp() {
  const app = express()
  app.disable('x-powered-by')
  app.set('trust proxy', process.env.TRUST_PROXY ?? 'loopback, linklocal, uniquelocal')

  // Everything the dashboard needs in one request
  app.get('/api/public/dashboard', async (req, res) => {
    try {
      const [config, services] = await Promise.all([loadConfig(), buildServices()])
      const categories = await buildCategories(services)
      res.set('Cache-Control', 'no-store')
      res.json({ branding: brandingFrom(config), categories, services })
    } catch (error) {
      sendError(res, 'Failed to load dashboard', error)
    }
  })

  app.get('/api/public/services', async (req, res) => {
    try {
      res.json(await buildServices())
    } catch (error) {
      sendError(res, 'Failed to get services', error)
    }
  })

  app.get('/api/public/categories', async (req, res) => {
    try {
      res.json(await buildCategories(await buildServices()))
    } catch (error) {
      sendError(res, 'Failed to get categories', error)
    }
  })

  app.get('/api/config', async (req, res) => {
    try {
      const config = await loadConfig()
      res.json({ baseUrl: config.baseUrl || '', npmEnabled: !!config.npmEnabled })
    } catch (error) {
      sendError(res, 'Failed to get config', error)
    }
  })

  app.get('/api/branding', async (req, res) => {
    res.json(brandingFrom(await loadConfig()))
  })

  app.get(`${SIMPLE_ICON_ROUTE}/:file`, simpleIconHandler)

  // Legacy endpoint, registered before the static files so a stale
  // dist/services.json can not shadow it
  app.get('/services.json', async (req, res) => {
    try {
      res.json({ services: await buildServices() })
    } catch (error) {
      console.error('Error building services list:', error)
      res.json({ services: [] })
    }
  })

  app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }))

  app.use('/uploads', serveUploads())
  app.use(express.static(DIST_DIR, { index: false }))

  // SPA fallback
  app.get('*', (req, res) => {
    res.sendFile(path.join(DIST_DIR, 'index.html'), error => {
      if (error) res.status(404).send('Dashboard UI not built. Run "npm run build".')
    })
  })

  return app
}

export function startMainServer({ port = process.env.PORT || 3000 } = {}) {
  const app = createMainApp()
  return new Promise(resolve => {
    const server = app.listen(port, () => {
      console.log(`✓ Dashboard listening on port ${port}`)
      resolve(server)
    })
  })
}
