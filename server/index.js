/**
 * Server-side API for Services Dashboard
 * Handles NPM integration securely without exposing credentials to the client
 */

import express from 'express'
import { readFile } from 'fs/promises'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const app = express()
const PORT = process.env.PORT || 3000

// Serve static files from the dist directory
const distPath = join(__dirname, '../dist')
app.use(express.static(distPath))

// Parse JSON bodies
app.use(express.json())

// NPM configuration from environment variables
const NPM_CONFIG = {
  apiUrl: process.env.NPM_API_URL || '',
  username: process.env.NPM_USERNAME || '',
  password: process.env.NPM_PASSWORD || '',
}

/**
 * Authenticate with NPM API and get token
 */
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
    console.error('NPM authentication error:', error)
    throw error
  }
}

/**
 * Fetch proxy hosts from NPM API
 */
async function fetchProxyHosts(apiUrl, token) {
  try {
    const response = await fetch(`${apiUrl}/nginx/proxy-hosts`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch proxy hosts: ${response.status}`)
    }

    const data = await response.json()
    return data
  } catch (error) {
    console.error('NPM proxy hosts fetch error:', error)
    throw error
  }
}

/**
 * Load icon metadata for icon discovery
 */
let iconsMetadata = null
async function loadIconsMetadata() {
  if (iconsMetadata) return iconsMetadata

  try {
    const metadataPath = join(distPath, 'dashboard-icons-metadata.json')
    const text = await readFile(metadataPath, 'utf-8')
    const data = JSON.parse(text)

    // Convert object to array if needed (metadata is an object with icon names as keys)
    if (data && typeof data === 'object' && !Array.isArray(data)) {
      iconsMetadata = Object.entries(data).map(([name, metadata]) => ({
        name,
        ...metadata
      }))
    } else {
      iconsMetadata = Array.isArray(data) ? data : []
    }

    console.log(`Loaded metadata for ${iconsMetadata.length} icons`)
    return iconsMetadata
  } catch (error) {
    console.error('Error loading icons metadata:', error.message)
    iconsMetadata = []
    return []
  }
}

/**
 * Normalize string for comparison
 */
function normalizeString(str) {
  return str.toLowerCase().trim().replace(/[^a-z0-9]/g, '')
}

/**
 * Calculate similarity between two strings
 */
function calculateSimilarity(str1, str2) {
  const s1 = normalizeString(str1)
  const s2 = normalizeString(str2)

  if (s1 === s2) return 1.0
  if (s1.includes(s2) || s2.includes(s1)) return 0.8

  const shorter = s1.length < s2.length ? s1 : s2
  const longer = s1.length < s2.length ? s2 : s1

  if (longer.includes(shorter)) return 0.6

  return 0
}

/**
 * Find best matching icon for a service name
 */
async function findIconForService(serviceName) {
  const metadata = await loadIconsMetadata()
  let bestMatch = null
  let bestScore = 0

  for (const icon of metadata) {
    const iconNameScore = calculateSimilarity(serviceName, icon.name)
    let aliasScore = 0

    if (icon.aliases && Array.isArray(icon.aliases)) {
      for (const alias of icon.aliases) {
        aliasScore = Math.max(aliasScore, calculateSimilarity(serviceName, alias))
      }
    }

    const score = Math.max(iconNameScore, aliasScore)
    if (score > bestScore) {
      bestScore = score
      bestMatch = icon
    }

    if (bestScore === 1.0) break
  }

  if (bestScore >= 0.6 && bestMatch) {
    // Prefer light variant for dark mode compatibility
    let iconName = bestMatch.name
    if (bestMatch.colors && bestMatch.colors.light) {
      iconName = bestMatch.colors.light
    }

    // Get category from metadata (categories is an array, take first one)
    let category = null
    if (bestMatch.categories && Array.isArray(bestMatch.categories) && bestMatch.categories.length > 0) {
      category = bestMatch.categories[0]
    }

    return { name: iconName, category }
  }

  return null
}

/**
 * Convert NPM proxy host to dashboard service format
 */
async function convertProxyHostToService(proxyHost) {
  const primaryDomain = proxyHost.domain_names?.[0] || 'Unknown'

  // Generate a clean name from the domain
  const name = primaryDomain
    .split('.')[0]
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')

  // Determine if SSL is enabled
  const protocol = proxyHost.certificate_id ? 'https' : 'http'
  const url = `${protocol}://${primaryDomain}`

  // Try to find a matching icon
  const iconMatch = await findIconForService(name)

  return {
    name: name,
    url: url,
    appendBaseDomain: false,
    icon: iconMatch?.name || null,
    _suggestedCategory: iconMatch?.category || null,
    _npmMetadata: {
      id: proxyHost.id,
      enabled: proxyHost.enabled,
      domains: proxyHost.domain_names,
      forwardHost: proxyHost.forward_host,
      forwardPort: proxyHost.forward_port,
    }
  }
}

// API endpoint to get NPM services
app.get('/api/npm/services', async (req, res) => {
  try {
    // Check if NPM is configured
    if (!NPM_CONFIG.apiUrl || !NPM_CONFIG.username || !NPM_CONFIG.password) {
      console.log('NPM integration not configured')
      return res.json([])
    }

    console.log('Fetching services from NPM...')

    // Authenticate with NPM
    const token = await authenticateNPM(NPM_CONFIG.apiUrl, NPM_CONFIG.username, NPM_CONFIG.password)

    // Fetch proxy hosts
    const proxyHosts = await fetchProxyHosts(NPM_CONFIG.apiUrl, token)
    console.log(`Found ${proxyHosts.length} proxy hosts in NPM`)

    // Filter only enabled hosts
    const enabledHosts = proxyHosts.filter(host => host.enabled === 1 || host.enabled === true)

    // Convert to service format with icon discovery
    const services = await Promise.all(
      enabledHosts.map(host => convertProxyHostToService(host))
    )

    console.log(`Converted ${services.length} enabled proxy hosts to services`)
    res.json(services)
  } catch (error) {
    console.error('Failed to fetch NPM services:', error)
    res.status(500).json({ error: 'Failed to fetch NPM services', message: error.message })
  }
})

// API endpoint to get configuration (without sensitive data)
app.get('/api/config', async (req, res) => {
  try {
    const config = {
      baseUrl: process.env.BASE_URL || '',
      npmEnabled: !!(NPM_CONFIG.apiUrl && NPM_CONFIG.username && NPM_CONFIG.password)
    }
    res.json(config)
  } catch (error) {
    console.error('Failed to get config:', error)
    res.status(500).json({ error: 'Failed to get config' })
  }
})

// Serve services.json if it exists
app.get('/services.json', async (req, res) => {
  try {
    const servicesPath = join(distPath, 'services.json')
    const data = await readFile(servicesPath, 'utf-8')
    res.json(JSON.parse(data))
  } catch (error) {
    // File doesn't exist, return empty services array
    res.json({ services: [] })
  }
})

// Serve index.html for all other routes (SPA)
app.get('*', (req, res) => {
  res.sendFile(join(distPath, 'index.html'))
})

// Preload icon metadata on startup
loadIconsMetadata().catch(err => console.error('Failed to preload icons metadata:', err))

// Start server
app.listen(PORT, () => {
  console.log('===================================')
  console.log('Services Dashboard - Server Started')
  console.log('===================================')
  console.log(`Listening on port ${PORT}`)

  if (NPM_CONFIG.apiUrl) {
    console.log('✓ NPM integration enabled')
    console.log(`  API URL: ${NPM_CONFIG.apiUrl}`)
  } else {
    console.log('✓ NPM integration disabled (NPM_API_URL not set)')
  }

  console.log(`✓ Base URL: ${process.env.BASE_URL || '(not set)'}`)
  console.log('===================================')
})
