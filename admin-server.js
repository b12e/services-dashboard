import express from 'express'
import session from 'express-session'
import cookieParser from 'cookie-parser'
import { doubleCsrf } from 'csrf-csrf'
import rateLimit from 'express-rate-limit'
import crypto from 'crypto'
import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'
import multer from 'multer'
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server'
import { isoBase64URL } from '@simplewebauthn/server/helpers'
import { resolveServiceIcon } from './server/icon-resolver.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
const PORT = 3001

// Authentication configuration from environment variables
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || ''
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || ''
const AUTH_REQUIRED = !!(ADMIN_USERNAME && ADMIN_PASSWORD)
const SESSION_SECRET = process.env.SESSION_SECRET || 'change-this-secret-in-production'

// WebAuthn configuration
const RP_NAME = 'Services Dashboard'

// Helper function to extract RP_ID and Origin from request
// This works correctly behind reverse proxies
function getWebAuthnConfig(req) {
  // Get the host from headers (works with reverse proxy)
  const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost'
  const proto = req.headers['x-forwarded-proto'] || (req.secure ? 'https' : 'http')

  // Extract the registrable domain for RP_ID
  // For example: dashboard-admin.local.b12e.es -> b12e.es
  // Or: localhost:3001 -> localhost
  let rpID
  if (host.includes('localhost')) {
    rpID = 'localhost'
  } else {
    // Remove port if present
    const hostWithoutPort = host.split(':')[0]
    const parts = hostWithoutPort.split('.')
    // Get the last two parts (domain.tld)
    if (parts.length >= 2) {
      rpID = parts.slice(-2).join('.')
    } else {
      rpID = hostWithoutPort
    }
  }

  const origin = `${proto}://${host}`

  return { rpID, origin }
}

// Path to files - all stored in /app/data directory
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data')
const SERVICES_PATH = path.join(DATA_DIR, 'services.json')
const CONFIG_PATH = path.join(DATA_DIR, 'config.json')
const AUTH_PATH = path.join(DATA_DIR, 'auth.json')
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads')

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    try {
      await fs.mkdir(UPLOADS_DIR, { recursive: true })
      cb(null, UPLOADS_DIR)
    } catch (error) {
      cb(error, null)
    }
  },
  filename: (req, file, cb) => {
    // Keep the original extension but use a fixed name for the custom icon
    const ext = path.extname(file.originalname)
    cb(null, `custom-icon${ext}`)
  }
})

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 2 * 1024 * 1024 // 2MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept only images
    if (file.mimetype.startsWith('image/')) {
      cb(null, true)
    } else {
      cb(new Error('Only image files are allowed'))
    }
  }
})

// In-memory storage for challenges (in production, use Redis or similar)
const challenges = new Map()

app.use(express.json())
app.use(cookieParser())
app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}))

// Configure CSRF protection
// The csrf-csrf library requires the secret to be at least 32 characters
// Auto-generate a secure random secret if SESSION_SECRET is not set or too short
let CSRF_SECRET

if (!SESSION_SECRET) {
  // Generate a cryptographically secure random secret
  CSRF_SECRET = crypto.randomBytes(32).toString('base64')
  // CSRF secret auto-generated as SESSION_SECRET was not set
} else if (SESSION_SECRET.length < 32) {
  // Pad the secret if it's too short
  CSRF_SECRET = SESSION_SECRET.padEnd(32, SESSION_SECRET)
  // WARNING: SESSION_SECRET is less than 32 characters. It was padded. Consider using a longer secret in production.
} else {
  // Use the provided secret
  CSRF_SECRET = SESSION_SECRET
}

console.log('🔐 Initializing CSRF protection with length valid?', !!(CSRF_SECRET.length >= 32))

const csrfProtection = doubleCsrf({
  getSecret: () => CSRF_SECRET, // Use padded secret (min 32 chars required)
  getSessionIdentifier: (req) => {
    // Ensure session is initialized before returning session ID
    // This forces session creation even with saveUninitialized: false
    if (req.session && !req.session.csrfInit) {
      req.session.csrfInit = true
    }
    // Return session ID - express-session generates a sessionID even with saveUninitialized: false
    const sessionId = req.sessionID || 'anonymous'
    console.log('🔐 getSessionIdentifier called, has sessionID:', !!req.sessionID)
    return sessionId
  },
  cookieName: 'x-csrf-token', // Simplified cookie name
  cookieOptions: {
    httpOnly: true,
    sameSite: 'lax', // Changed from 'strict' to 'lax' for better compatibility
    secure: process.env.NODE_ENV === 'production',
    path: '/',
  },
  size: 64,
  ignoredMethods: ['GET', 'HEAD', 'OPTIONS'],
  getTokenFromRequest: (req) => req.headers['x-csrf-token'], // Read token from header
})

const generateToken = csrfProtection.generateCsrfToken
const doubleCsrfProtection = csrfProtection.doubleCsrfProtection

// Configure rate limiting for authentication endpoints
const authRateLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute window
  max: 10, // Limit each IP to 10 requests per windowMs
  message: 'Too many authentication attempts, please try again later.',
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  // Use a custom key generator to handle proxies correctly
  keyGenerator: (req) => {
    // Get the real IP address from headers (for reverse proxy support)
    return req.headers['x-forwarded-for']?.split(',')[0].trim() ||
           req.headers['x-real-ip'] ||
           req.ip
  },
})

// Configure rate limiting for general API endpoints
// More permissive than auth endpoints but still protected
const apiRateLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute window
  max: 60, // Limit each IP to 60 requests per minute
  message: 'Too many requests, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return req.headers['x-forwarded-for']?.split(',')[0].trim() ||
           req.headers['x-real-ip'] ||
           req.ip
  },
})

// Configure rate limiting for write operations (POST, PUT, DELETE)
// More restrictive to prevent abuse
const writeRateLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute window
  max: 30, // Limit each IP to 30 write operations per minute
  message: 'Too many write operations, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return req.headers['x-forwarded-for']?.split(',')[0].trim() ||
           req.headers['x-real-ip'] ||
           req.ip
  },
})

// NPM authentication utility
async function authenticateNPM(apiUrl, username, password) {
  try {
    const response = await fetch(`${apiUrl}/tokens`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        identity: username,
        secret: password,
      }),
    })

    if (!response.ok) {
      throw new Error(`NPM authentication failed: ${response.status}`)
    }

    const data = await response.json()
    return data.token
  } catch (error) {
    throw new Error(`NPM authentication error: ${error.message}`)
  }
}

// Validate NPM connection
async function validateNPMConnection(connection) {
  try {
    const apiUrl = connection.url.replace(/\/api$/, '') + '/api'

    if (!connection.username || !connection.password) {
      return { valid: false, error: 'Username and password are required' }
    }

    // Try to authenticate
    await authenticateNPM(apiUrl, connection.username, connection.password)
    return { valid: true }
  } catch (error) {
    return { valid: false, error: error.message }
  }
}

// Serve static files for assets (no auth required for CSS/JS/images)
app.use('/assets', express.static(path.join(__dirname, 'admin-dist', 'assets')))
app.use('/icon.svg', express.static(path.join(__dirname, 'public', 'icon.svg')))

// Middleware to ensure data directory and files exist
async function ensureFiles() {
  // Ensure data directory exists
  try {
    await fs.access(DATA_DIR)
  } catch {
    await fs.mkdir(DATA_DIR, { recursive: true })
  }

  try {
    await fs.access(SERVICES_PATH)
  } catch {
    // Create default services.json with Google.com as example
    await fs.writeFile(SERVICES_PATH, JSON.stringify({
      manualServices: [
        {
          name: 'Google',
          url: 'https://google.com',
          appendBaseDomain: false,
          icon: 'google'
        }
      ],
      overrides: {}
    }, null, 2))
  }

  try {
    await fs.access(CONFIG_PATH)
  } catch {
    await fs.writeFile(CONFIG_PATH, JSON.stringify({
      baseUrl: '',
      npmEnabled: false,
      npmConnections: [],
      categories: [],
      customName: 'Services Dashboard',
      customIcon: null
    }, null, 2))
  }

  try {
    await fs.access(AUTH_PATH)
  } catch {
    await fs.writeFile(AUTH_PATH, JSON.stringify({
      passkeys: []
    }, null, 2))
  }
}

// Load/save auth data
async function loadAuthData() {
  try {
    const data = await fs.readFile(AUTH_PATH, 'utf-8')
    return JSON.parse(data)
  } catch {
    return { passkeys: [] }
  }
}

async function saveAuthData(data) {
  // Custom replacer to catch any Uint8Arrays that shouldn't be here
  const jsonString = JSON.stringify(data, (key, value) => {
    if (value instanceof Uint8Array) {
      console.error(`WARNING: Uint8Array found at key "${key}" - converting to Base64URL`)
      return isoBase64URL.fromBuffer(value)
    }
    return value
  }, 2)
  console.log('Saving auth data, JSON length:', jsonString.length)
  await fs.writeFile(AUTH_PATH, jsonString, 'utf-8')
}

// Authentication middleware
function requireAuth(req, res, next) {
  // Skip if auth is not required
  if (!AUTH_REQUIRED) {
    return next()
  }

  // Check session authentication
  if (req.session?.authenticated) {
    return next()
  }

  // Check basic auth
  const authHeader = req.headers.authorization
  if (authHeader?.startsWith('Basic ')) {
    const base64Credentials = authHeader.split(' ')[1]
    const credentials = Buffer.from(base64Credentials, 'base64').toString('utf-8')
    const [username, password] = credentials.split(':')

    if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
      req.session.authenticated = true
      return next()
    }
  }

  res.status(401).json({ error: 'Authentication required' })
}

// Public endpoint to get CSRF token
app.get('/api/admin/csrf-token', apiRateLimiter, (req, res) => {
  console.log('🔐 CSRF token requested, has session:', !!req.session)
  const csrfToken = generateToken(req, res)
  console.log('🔐 CSRF token generated:', csrfToken ? 'success' : 'failed')
  res.json({ csrfToken })
})

// Public endpoint to check auth status
app.get('/api/admin/auth/status', apiRateLimiter, (req, res) => {
  res.json({
    authRequired: AUTH_REQUIRED,
    authenticated: AUTH_REQUIRED ? !!req.session?.authenticated : true,
    hasPasskeys: false // Will be updated by client
  })
})

// Login with password
app.post('/api/admin/auth/login', authRateLimiter, (req, res, next) => {
  console.log('🔐 Login attempt, has session:', !!req.session, 'has sessionID:', !!req.sessionID)
  console.log('🔐 Has CSRF token in header:', !!req.headers['x-csrf-token'])
  console.log('🔐 Has CSRF cookie:', !!req.cookies['x-csrf-token'])
  next()
}, doubleCsrfProtection, async (req, res) => {
  if (!AUTH_REQUIRED) {
    return res.json({ success: true })
  }

  const { username, password } = req.body

  if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
    req.session.authenticated = true
    res.json({ success: true })
  } else {
    res.status(401).json({ error: 'Invalid credentials' })
  }
})

// Logout
app.post('/api/admin/auth/logout', apiRateLimiter, doubleCsrfProtection, (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to logout' })
    }
    res.json({ success: true })
  })
})

// Check if user has passkeys (public endpoint for login page)
app.get('/api/admin/auth/passkeys/available', authRateLimiter, async (req, res) => {
  const authData = await loadAuthData()
  res.json({
    available: authData.passkeys && authData.passkeys.length > 0
  })
})

// Check if user has passkeys (authenticated endpoint for settings page)
app.get('/api/admin/auth/passkeys/status', apiRateLimiter, requireAuth, async (req, res) => {
  const authData = await loadAuthData()
  res.json({
    hasPasskeys: authData.passkeys && authData.passkeys.length > 0,
    count: authData.passkeys?.length || 0
  })
})

// Generate registration options for new passkey
app.post('/api/admin/auth/passkeys/register/options', authRateLimiter, doubleCsrfProtection, requireAuth, async (req, res) => {
  try {
    const { rpID, origin } = getWebAuthnConfig(req)

    console.log('Generating passkey registration options...')
    console.log('  Request host:', req.headers.host)
    console.log('  X-Forwarded-Host:', req.headers['x-forwarded-host'])
    console.log('  X-Forwarded-Proto:', req.headers['x-forwarded-proto'])
    console.log('  Detected RP_ID:', rpID)
    console.log('  Detected ORIGIN:', origin)

    const authData = await loadAuthData()

    // Convert user ID to Uint8Array (required by @simplewebauthn/server v10+)
    const userID = new TextEncoder().encode('admin')

    const options = await generateRegistrationOptions({
      rpName: RP_NAME,
      rpID: rpID,
      userID: userID,
      userName: ADMIN_USERNAME || 'admin',
      attestationType: 'none',
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: 'preferred',
      },
      excludeCredentials: authData.passkeys?.map(passkey => ({
        id: passkey.credentialID,
        type: 'public-key',
        transports: passkey.transports,
      })) || [],
    })

    console.log('Registration options generated successfully')
    challenges.set('admin', options.challenge)
    res.json(options)
  } catch (error) {
    console.error('Error generating registration options:', error)
    console.error('Error stack:', error.stack)
    res.status(500).json({
      error: 'Failed to generate registration options',
      message: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    })
  }
})

// Verify passkey registration
app.post('/api/admin/auth/passkeys/register/verify', authRateLimiter, doubleCsrfProtection, requireAuth, async (req, res) => {
  try {
    const { rpID, origin } = getWebAuthnConfig(req)
    const { credential, name } = req.body
    const expectedChallenge = challenges.get('admin')

    if (!expectedChallenge) {
      return res.status(400).json({ error: 'No challenge found' })
    }

    const verification = await verifyRegistrationResponse({
      response: credential,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
    })

    if (verification.verified && verification.registrationInfo) {
      const authData = await loadAuthData()

      // The credential data is nested under verification.registrationInfo.credential
      const credInfo = verification.registrationInfo.credential
      const credentialID = credInfo.id // This is a Base64URL string
      const credentialPublicKey = credInfo.publicKey // This is a Uint8Array
      const counter = credInfo.counter
      const transports = credInfo.transports || []

      console.log('Passkey registration successful - storing credential')

      // Convert to Base64URL strings
      const credentialIDBase64 = credentialID // Already a Base64URL string
      const publicKeyBase64 = credentialPublicKey instanceof Uint8Array
        ? isoBase64URL.fromBuffer(credentialPublicKey)
        : credentialPublicKey

      const newPasskey = {
        credentialID: credentialIDBase64,
        credentialPublicKey: publicKeyBase64,
        counter: counter,
        transports: transports,
        name: name || `Passkey ${(authData.passkeys?.length || 0) + 1}`,
        createdAt: new Date().toISOString()
      }

      if (!authData.passkeys) {
        authData.passkeys = []
      }
      authData.passkeys.push(newPasskey)

      await saveAuthData(authData)
      challenges.delete('admin')

      res.json({ verified: true, name: newPasskey.name })
    } else {
      res.status(400).json({ error: 'Verification failed' })
    }
  } catch (error) {
    console.error('Error verifying registration:', error)
    res.status(500).json({ error: 'Failed to verify registration' })
  }
})

// Generate authentication options for passkey login
// Note: CSRF protection not needed here - WebAuthn has built-in challenge/response security
app.post('/api/admin/auth/passkeys/login/options', authRateLimiter, async (req, res) => {
  try {
    const { rpID } = getWebAuthnConfig(req)
    const authData = await loadAuthData()

    if (!authData.passkeys || authData.passkeys.length === 0) {
      return res.status(400).json({ error: 'No passkeys registered' })
    }

    const options = await generateAuthenticationOptions({
      rpID: rpID,
      allowCredentials: authData.passkeys.map(passkey => ({
        id: passkey.credentialID, // Already a Base64URL string
        type: 'public-key',
        transports: passkey.transports,
      })),
      userVerification: 'preferred',
    })

    challenges.set('admin', options.challenge)
    res.json(options)
  } catch (error) {
    console.error('Error generating authentication options:', error)
    res.status(500).json({ error: 'Failed to generate authentication options' })
  }
})

// Verify passkey authentication
// Note: CSRF protection not needed here - WebAuthn has built-in challenge/response security
app.post('/api/admin/auth/passkeys/login/verify', authRateLimiter, async (req, res) => {
  try {
    const { rpID, origin } = getWebAuthnConfig(req)
    const { credential } = req.body
    const expectedChallenge = challenges.get('admin')

    if (!expectedChallenge) {
      return res.status(400).json({ error: 'No challenge found' })
    }

    const authData = await loadAuthData()

    console.log('Passkey authentication attempt')

    // credential.id is already a Base64URL string, use it directly
    const credentialIDString = credential.id
    const passkey = authData.passkeys?.find(p => p.credentialID === credentialIDString)

    console.log('Passkey found:', !!passkey)

    if (!passkey) {
      return res.status(400).json({ error: 'Passkey not found' })
    }

    // In @simplewebauthn/server v13+, the API changed:
    // - Parameter name: authenticator → credential
    // - Property names: credentialID → id, credentialPublicKey → publicKey
    console.log('Preparing credential for verification (v13+ API)')

    const credentialForVerification = {
      id: passkey.credentialID,  // Keep as Base64URL string
      publicKey: isoBase64URL.toBuffer(passkey.credentialPublicKey), // Convert to Uint8Array
      counter: passkey.counter,
      transports: passkey.transports
    }

    console.log('Verifying passkey authentication...')

    const verification = await verifyAuthenticationResponse({
      response: credential,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      credential: credentialForVerification, // Changed from 'authenticator' to 'credential'
    })

    console.log('Verification result:', verification.verified)

    if (verification.verified) {
      // Update counter
      passkey.counter = verification.authenticationInfo.newCounter
      await saveAuthData(authData)

      // Set session
      req.session.authenticated = true
      challenges.delete('admin')

      res.json({ verified: true })
    } else {
      res.status(400).json({ error: 'Verification failed' })
    }
  } catch (error) {
    console.error('Error verifying authentication:', error)
    res.status(500).json({ error: 'Failed to verify authentication' })
  }
})

// List passkeys
app.get('/api/admin/auth/passkeys', apiRateLimiter, requireAuth, async (req, res) => {
  try {
    const authData = await loadAuthData()
    const passkeys = (authData.passkeys || []).map(p => ({
      name: p.name,
      createdAt: p.createdAt
    }))
    res.json(passkeys)
  } catch (error) {
    console.error('Error listing passkeys:', error)
    res.status(500).json({ error: 'Failed to list passkeys' })
  }
})

// Delete passkey
app.delete('/api/admin/auth/passkeys/:index', writeRateLimiter, doubleCsrfProtection, requireAuth, async (req, res) => {
  try {
    const index = parseInt(req.params.index)
    const authData = await loadAuthData()

    if (!authData.passkeys || index < 0 || index >= authData.passkeys.length) {
      return res.status(404).json({ error: 'Passkey not found' })
    }

    authData.passkeys.splice(index, 1)
    await saveAuthData(authData)

    res.json({ success: true })
  } catch (error) {
    console.error('Error deleting passkey:', error)
    res.status(500).json({ error: 'Failed to delete passkey' })
  }
})

// Helper to load services data
async function loadServicesData() {
  try {
    const data = await fs.readFile(SERVICES_PATH, 'utf-8')
    const json = JSON.parse(data)
    return {
      manualServices: json.manualServices || [],
      overrides: json.overrides || {}
    }
  } catch (error) {
    return { manualServices: [], overrides: {} }
  }
}

// Helper to save services data
async function saveServicesData(manualServices, overrides) {
  const json = {
    manualServices,
    overrides
  }
  await fs.writeFile(SERVICES_PATH, JSON.stringify(json, null, 2))
}

// Helper to fetch NPM services
async function fetchNPMServicesForAdmin() {
  try {
    const mainServerUrl = process.env.MAIN_SERVER_URL || 'http://localhost:3000'
    const response = await fetch(`${mainServerUrl}/api/npm/services`)
    if (!response.ok) return []
    return await response.json()
  } catch (error) {
    console.error('Failed to fetch NPM services:', error)
    return []
  }
}

// GET /api/admin/services - Get all services (NPM + manual + overrides)
app.get('/api/admin/services', apiRateLimiter, requireAuth, async (req, res) => {
  try {
    const config = await fs.readFile(CONFIG_PATH, 'utf-8').then(d => JSON.parse(d)).catch(() => ({}))
    const { manualServices, overrides } = await loadServicesData()

    let allServices = []

    // Add manual services
    manualServices.forEach((service, index) => {
      allServices.push({
        ...service,
        _id: `manual_${index}`,
        _source: 'manual',
        _index: index
      })
    })

    // If NPM is enabled, fetch NPM services
    if (config.npmEnabled) {
      const npmServices = await fetchNPMServicesForAdmin()
      npmServices.forEach(service => {
        const npmId = service._npmMetadata?.id
        if (!npmId) return

        const serviceId = `npm_${npmId}`
        const override = overrides[serviceId] || {}

        allServices.push({
          ...service,
          ...override,
          _id: serviceId,
          _source: 'npm',
          _npmData: service,
          _hasOverrides: Object.keys(override).length > 0
        })
      })
    }

    // Resolve icons for all services
    const servicesWithIcons = await Promise.all(
      allServices.map(async (service) => {
        const iconInfo = await resolveServiceIcon(service)
        return {
          ...service,
          ...iconInfo
        }
      })
    )

    res.json(servicesWithIcons)
  } catch (error) {
    console.error('Error reading services:', error)
    res.status(500).json({ error: 'Failed to read services' })
  }
})

// POST /api/admin/services - Add a new manual service
app.post('/api/admin/services', writeRateLimiter, doubleCsrfProtection, requireAuth, async (req, res) => {
  try {
    const newService = req.body
    const { manualServices, overrides } = await loadServicesData()

    manualServices.push(newService)
    await saveServicesData(manualServices, overrides)

    res.json({
      ...newService,
      _id: `manual_${manualServices.length - 1}`,
      _source: 'manual'
    })
  } catch (error) {
    console.error('Error adding service:', error)
    res.status(500).json({ error: 'Failed to add service' })
  }
})

// PUT /api/admin/services/:id - Update a service or create/update override
app.put('/api/admin/services/:id', writeRateLimiter, doubleCsrfProtection, requireAuth, async (req, res) => {
  try {
    const serviceId = req.params.id
    const updatedData = req.body
    const { manualServices, overrides } = await loadServicesData()

    if (serviceId.startsWith('manual_')) {
      // Update manual service
      const index = parseInt(serviceId.replace('manual_', ''))
      if (index < 0 || index >= manualServices.length) {
        return res.status(404).json({ error: 'Service not found' })
      }
      manualServices[index] = updatedData
    } else if (serviceId.startsWith('npm_')) {
      // Create or update override for NPM service
      // Only store the fields that are being overridden
      const override = {}
      if (updatedData.name !== undefined) override.name = updatedData.name
      if (updatedData.description !== undefined) override.description = updatedData.description
      if (updatedData.icon !== undefined) override.icon = updatedData.icon
      if (updatedData.categories !== undefined) override.categories = updatedData.categories
      if (updatedData.hidden !== undefined) override.hidden = updatedData.hidden

      overrides[serviceId] = override
    } else {
      return res.status(400).json({ error: 'Invalid service ID' })
    }

    await saveServicesData(manualServices, overrides)
    res.json(updatedData)
  } catch (error) {
    console.error('Error updating service:', error)
    res.status(500).json({ error: 'Failed to update service' })
  }
})

// DELETE /api/admin/services/:id - Delete a service or remove override
app.delete('/api/admin/services/:id', writeRateLimiter, doubleCsrfProtection, requireAuth, async (req, res) => {
  try {
    const serviceId = req.params.id
    const { manualServices, overrides } = await loadServicesData()

    if (serviceId.startsWith('manual_')) {
      // Delete manual service
      const index = parseInt(serviceId.replace('manual_', ''))
      if (index < 0 || index >= manualServices.length) {
        return res.status(404).json({ error: 'Service not found' })
      }
      manualServices.splice(index, 1)
    } else if (serviceId.startsWith('npm_')) {
      // Remove override (or set hidden to true)
      if (overrides[serviceId]) {
        delete overrides[serviceId]
      }
    } else {
      return res.status(400).json({ error: 'Invalid service ID' })
    }

    await saveServicesData(manualServices, overrides)
    res.json({ success: true })
  } catch (error) {
    console.error('Error deleting service:', error)
    res.status(500).json({ error: 'Failed to delete service' })
  }
})

// GET /api/admin/categories - Get all categories (configured + auto-detected)
app.get('/api/admin/categories', apiRateLimiter, requireAuth, async (req, res) => {
  try {
    // Load config for configured categories
    const configData = await fs.readFile(CONFIG_PATH, 'utf-8')
    const config = JSON.parse(configData)
    const configuredCategories = config.categories || []

    // Load services to find auto-detected categories
    const { manualServices, overrides } = await loadServicesData()
    const allCategoryNames = new Set()

    // Extract categories from manual services
    manualServices.forEach(service => {
      if (Array.isArray(service.categories)) {
        service.categories.forEach(cat => allCategoryNames.add(cat))
      } else if (service.category) {
        allCategoryNames.add(service.category)
      }
    })

    // Extract categories from overrides
    Object.values(overrides).forEach(override => {
      if (Array.isArray(override.categories)) {
        override.categories.forEach(cat => allCategoryNames.add(cat))
      } else if (override.category) {
        allCategoryNames.add(override.category)
      }
    })

    // Merge configured and auto-detected categories
    const categoryMap = new Map()

    // Add configured categories first
    configuredCategories.forEach(cat => {
      categoryMap.set(cat.name, {
        name: cat.name,
        displayName: cat.displayName || cat.name,
        visible: cat.visible !== undefined ? cat.visible : true,
        configured: true
      })
    })

    // Add auto-detected categories that aren't already configured
    allCategoryNames.forEach(name => {
      if (!categoryMap.has(name)) {
        categoryMap.set(name, {
          name: name,
          displayName: name,
          visible: true,
          configured: false
        })
      }
    })

    const mergedCategories = Array.from(categoryMap.values())
    res.json(mergedCategories)
  } catch (error) {
    console.error('Error loading categories:', error)
    res.status(500).json({ error: 'Failed to load categories' })
  }
})

// GET /api/branding - Get custom name and icon (public endpoint)
app.get('/api/branding', apiRateLimiter, async (req, res) => {
  try {
    const data = await fs.readFile(CONFIG_PATH, 'utf-8')
    const config = JSON.parse(data)
    res.json({
      customName: config.customName || 'Services Dashboard',
      customIcon: config.customIcon || null
    })
  } catch (error) {
    res.json({
      customName: 'Services Dashboard',
      customIcon: null
    })
  }
})

// GET /api/admin/config - Get configuration
app.get('/api/admin/config', apiRateLimiter, requireAuth, async (req, res) => {
  try {
    const data = await fs.readFile(CONFIG_PATH, 'utf-8')
    const config = JSON.parse(data)
    res.json(config)
  } catch (error) {
    console.error('Error reading config:', error)
    res.status(500).json({ error: 'Failed to read configuration' })
  }
})

// PUT /api/admin/config - Update configuration
app.put('/api/admin/config', writeRateLimiter, doubleCsrfProtection, requireAuth, async (req, res) => {
  try {
    const config = req.body

    // Validate NPM connections if enabled
    const validationResults = []
    if (config.npmEnabled && config.npmConnections && config.npmConnections.length > 0) {
      for (let i = 0; i < config.npmConnections.length; i++) {
        const conn = config.npmConnections[i]
        if (conn.url && conn.username && conn.password) {
          console.log(`Validating NPM connection: ${conn.name || conn.url}`)
          const result = await validateNPMConnection(conn)
          validationResults.push({
            index: i,
            name: conn.name || conn.url,
            valid: result.valid,
            error: result.error
          })
        }
      }
    }

    // Save config
    await fs.writeFile(CONFIG_PATH, JSON.stringify(config, null, 2))

    // Trigger NPM fetch on the main server if NPM is enabled
    if (config.npmEnabled) {
      try {
        const mainServerUrl = process.env.MAIN_SERVER_URL || 'http://localhost:3000'
        await fetch(`${mainServerUrl}/api/npm/refresh`, { method: 'POST' })
        console.log('Triggered NPM refresh on main server')
      } catch (error) {
        console.error('Failed to trigger NPM refresh:', error.message)
      }
    }

    res.json({
      config,
      validationResults,
      success: true
    })
  } catch (error) {
    console.error('Error updating config:', error)
    res.status(500).json({ error: 'Failed to update configuration' })
  }
})

// Upload custom icon
app.post('/api/admin/upload/icon', writeRateLimiter, doubleCsrfProtection, requireAuth, upload.single('icon'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' })
    }

    const iconPath = `/uploads/${req.file.filename}`
    res.json({
      success: true,
      iconPath,
      message: 'Icon uploaded successfully'
    })
  } catch (error) {
    console.error('Error uploading icon:', error)
    res.status(500).json({ error: 'Failed to upload icon' })
  }
})

// Serve uploaded files
app.use('/uploads', express.static(UPLOADS_DIR))

// Serve admin UI for all other routes
// Apply rate limiting to prevent abuse of file system access
app.get('*', apiRateLimiter, (req, res) => {
  res.sendFile(path.join(__dirname, 'admin-dist', 'index.html'))
})

// Start server
async function start() {
  await ensureFiles()
  app.listen(PORT, () => {
    console.log(`
===========================================
Management Tool Server Started
===========================================
Port: ${PORT}
Authentication: ${AUTH_REQUIRED ? 'ENABLED' : 'DISABLED'}
WebAuthn: Dynamic host detection enabled
  (RP_ID and Origin detected from request headers)
===========================================
    `)
  })
}

start().catch(console.error)
