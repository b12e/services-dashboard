/**
 * Server-side API for Services Dashboard
 * Handles NPM integration securely without exposing credentials to the client
 */

import express from 'express'
import { readFile } from 'fs/promises'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { categorizeService } from './categorize.js'
import { resolveServiceIcon, resolveIconUrl } from './icon-resolver.js'
import {
  loadCategories,
  getCategoryById,
  getOrCreateCategory,
  convertIdsToNames,
  convertNamesToIds,
  getCategoryIdToNameMap
} from './category-manager.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const app = express()
const PORT = process.env.PORT || 3000

// Serve static files from the dist directory
const distPath = join(__dirname, '../dist')
app.use(express.static(distPath))

// Parse JSON bodies
app.use(express.json())

// Data directory for configuration
const DATA_DIR = process.env.DATA_DIR || join(__dirname, '../data')
const CONFIG_PATH = join(DATA_DIR, 'config.json')
const UPLOADS_DIR = join(DATA_DIR, 'uploads')

// Serve uploaded files (custom icons)
app.use('/uploads', express.static(UPLOADS_DIR))

// Load NPM configuration from config.json
let NPM_CONFIG = {
  connections: []
}

async function loadConfig() {
  try {
    const data = await readFile(CONFIG_PATH, 'utf-8')
    const config = JSON.parse(data)
    NPM_CONFIG.connections = config.npmConnections || []
    NPM_CONFIG.enabled = config.npmEnabled || false
    return config
  } catch {
    return { baseUrl: '', npmEnabled: false, npmConnections: [] }
  }
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

  const allIcons = []

  // Load dashboard-icons metadata
  try {
    const metadataPath = join(distPath, 'dashboard-icons-metadata.json')
    const text = await readFile(metadataPath, 'utf-8')
    const data = JSON.parse(text)

    // Convert object to array if needed (metadata is an object with icon names as keys)
    if (data && typeof data === 'object' && !Array.isArray(data)) {
      const dashboardIcons = Object.entries(data).map(([name, metadata]) => ({
        name,
        source: 'dashboard-icons',
        ...metadata
      }))
      allIcons.push(...dashboardIcons)
    } else if (Array.isArray(data)) {
      allIcons.push(...data.map(icon => ({ ...icon, source: 'dashboard-icons' })))
    }

    console.log(`✓ Loaded ${allIcons.length} dashboard icons`)
  } catch (error) {
    console.warn('WARNING: Could not load dashboard-icons metadata:', error.message)
  }

  // Load simple-icons metadata
  try {
    const simpleIconsPath = join(__dirname, '../node_modules/simple-icons/data/simple-icons.json')
    const simpleText = await readFile(simpleIconsPath, 'utf-8')
    const simpleData = JSON.parse(simpleText)

    if (Array.isArray(simpleData)) {
      const simpleIcons = simpleData.map(icon => ({
        name: icon.slug,
        title: icon.title,
        source: 'simple-icons',
        categories: [], // Simple-icons doesn't have categories in metadata
        aliases: icon.aliases?.aka || []
      }))
      allIcons.push(...simpleIcons)
      console.log(`✓ Loaded ${simpleIcons.length} simple-icons`)
    }
  } catch (error) {
    console.warn('WARNING: Could not load simple-icons metadata:', error.message)
  }

  iconsMetadata = allIcons

  if (iconsMetadata.length === 0) {
    console.warn('WARNING: No icons metadata loaded!')
  } else {
    console.log(`✓ Total icons available: ${iconsMetadata.length}`)
  }

  return iconsMetadata
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

  const normalizedServiceName = normalizeString(serviceName)
  console.log(`Icon search for "${serviceName}" (normalized: "${normalizedServiceName}")`)

  for (const icon of metadata) {
    const iconNameScore = calculateSimilarity(serviceName, icon.name)
    let aliasScore = 0
    let matchedAlias = null

    if (icon.aliases && Array.isArray(icon.aliases)) {
      for (const alias of icon.aliases) {
        const score = calculateSimilarity(serviceName, alias)
        if (score > aliasScore) {
          aliasScore = score
          matchedAlias = alias
        }
      }
    }

    const score = Math.max(iconNameScore, aliasScore)
    if (score > bestScore) {
      bestScore = score
      bestMatch = icon

      // Debug log for high scores
      if (score >= 0.8) {
        console.log(`  High match: "${icon.name}" (score: ${score}, iconName: ${iconNameScore}, alias: ${aliasScore}${matchedAlias ? ` via "${matchedAlias}"` : ''})`)
      }
    }

    if (bestScore === 1.0) break
  }

  if (bestScore >= 0.6 && bestMatch) {
    console.log(`  bestMatch object:`, JSON.stringify(bestMatch, null, 2))

    // IMPORTANT: Always use the actual icon name from the metadata, not the alias!
    let iconName = bestMatch.name
    console.log(`  Original icon name: "${iconName}"`)

    // Prefer light variant for dark mode compatibility
    if (bestMatch.colors && bestMatch.colors.light) {
      iconName = bestMatch.colors.light
      console.log(`  Using light variant: "${iconName}"`)
    }

    // Get all categories from metadata and convert to IDs
    let categoryIds = []
    if (bestMatch.categories && Array.isArray(bestMatch.categories)) {
      categoryIds = await convertNamesToIds(bestMatch.categories)
    }

    console.log(`  ✓ Returning icon: "${iconName}" (score: ${bestScore})`)
    return { name: iconName, categoryIds }
  }

  console.log(`  ✗ No match found (best score: ${bestScore})`)
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
    _suggestedCategoryIds: iconMatch?.categoryIds || [],
    _npmMetadata: {
      id: proxyHost.id,
      enabled: proxyHost.enabled,
      domains: proxyHost.domain_names,
      forwardHost: proxyHost.forward_host,
      forwardPort: proxyHost.forward_port,
    }
  }
}

// Shared function to fetch NPM services
async function fetchNPMServices() {
  // Reload config to get latest NPM connections
  await loadConfig()

  // Check if NPM is configured
  if (!NPM_CONFIG.enabled || !NPM_CONFIG.connections || NPM_CONFIG.connections.length === 0) {
    console.log('NPM integration not configured')
    return []
  }

  console.log(`Fetching services from ${NPM_CONFIG.connections.length} NPM instance(s)...`)

  const allServices = []

  // Fetch from all NPM connections
  for (const connection of NPM_CONFIG.connections) {
    try {
      console.log(`Fetching from NPM: ${connection.name || connection.url}`)

      // Authenticate with NPM - get token from username/password
      let token
      const apiUrl = connection.url.replace(/\/api$/, '') + '/api'

      if (connection.username && connection.password) {
        // Get token via authentication
        token = await authenticateNPM(apiUrl, connection.username, connection.password)
      } else if (connection.token) {
        // Use token directly (backward compatibility)
        token = connection.token
      } else {
        throw new Error('No credentials provided (need username/password or token)')
      }

      // Fetch proxy hosts
      const proxyHosts = await fetchProxyHosts(apiUrl, token)
      console.log(`Found ${proxyHosts.length} proxy hosts from ${connection.name || connection.url}`)

      // Filter only enabled hosts
      const enabledHosts = proxyHosts.filter(host => host.enabled === 1 || host.enabled === true)

      // Convert to service format with icon discovery
      const services = await Promise.all(
        enabledHosts.map(host => convertProxyHostToService(host))
      )

      allServices.push(...services)
    } catch (error) {
      console.error(`Failed to fetch from NPM ${connection.name || connection.url}:`, error.message)
      // Continue with other connections
    }
  }

  console.log(`Total converted services: ${allServices.length}`)
  return allServices
}

// API endpoint to get NPM services
app.get('/api/npm/services', async (req, res) => {
  try {
    const allServices = await fetchNPMServices()
    res.json(allServices)
  } catch (error) {
    console.error('Failed to fetch NPM services:', error)
    res.status(500).json({ error: 'Failed to fetch NPM services', message: error.message })
  }
})

// API endpoint to trigger NPM refresh
app.post('/api/npm/refresh', async (req, res) => {
  try {
    console.log('NPM refresh triggered by admin server')
    const allServices = await fetchNPMServices()
    res.json({ success: true, servicesCount: allServices.length })
  } catch (error) {
    console.error('Failed to refresh NPM services:', error)
    res.status(500).json({ error: 'Failed to refresh NPM services', message: error.message })
  }
})

// API endpoint to get configuration (without sensitive data)
app.get('/api/config', async (req, res) => {
  try {
    const config = await loadConfig()
    res.json({
      baseUrl: config.baseUrl || '',
      npmEnabled: config.npmEnabled || false
    })
  } catch (error) {
    console.error('Failed to get config:', error)
    res.status(500).json({ error: 'Failed to get config' })
  }
})

// API endpoint to get custom branding
app.get('/api/branding', async (req, res) => {
  try {
    const config = await loadConfig()
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

// API endpoint to get available icons for autocomplete
app.get('/api/icons', async (req, res) => {
  try {
    const metadata = await loadIconsMetadata()
    // Return simplified list with name and categories
    const iconList = metadata.map(icon => ({
      name: icon.name,
      categories: icon.categories || [],
      aliases: icon.aliases || []
    }))
    res.json(iconList)
  } catch (error) {
    console.error('Failed to get icons:', error)
    res.status(500).json({ error: 'Failed to get icons' })
  }
})

// API endpoint to get icon preview URL
app.get('/api/icons/preview/:iconName', async (req, res) => {
  try {
    const { iconName } = req.params
    const iconResult = await resolveIconUrl(iconName)

    if (iconResult) {
      res.json(iconResult)
    } else {
      res.status(404).json({ error: 'Icon not found' })
    }
  } catch (error) {
    console.error('Failed to get icon preview:', error)
    res.status(500).json({ error: 'Failed to get icon preview' })
  }
})

// Helper function to validate and sanitize icon names
// Only allows alphanumeric characters, hyphens, underscores, and dots
// Prevents SSRF attacks by ensuring icon names can't be used to construct arbitrary URLs
function sanitizeIconName(iconName) {
  if (!iconName || typeof iconName !== 'string') {
    return null
  }

  // Remove any characters that are not alphanumeric, dash, underscore, or dot
  const sanitized = iconName.replace(/[^a-zA-Z0-9\-_.]/g, '')

  // Prevent path traversal attacks
  if (sanitized.includes('..') || sanitized.includes('./') || sanitized.includes('/.')) {
    return null
  }

  // Ensure the sanitized name is not empty and has reasonable length
  if (sanitized.length === 0 || sanitized.length > 100) {
    return null
  }

  return sanitized
}

// Icon format cache - stores which icons exist in SVG vs PNG
const iconFormatCache = new Map()

// API endpoint to check icon format availability and cache it
app.post('/api/icons/check-format', async (req, res) => {
  try {
    const { iconName } = req.body

    if (!iconName) {
      return res.status(400).json({ error: 'Icon name required' })
    }

    // Sanitize the icon name to prevent SSRF attacks
    const sanitizedIconName = sanitizeIconName(iconName)
    if (!sanitizedIconName) {
      return res.status(400).json({ error: 'Invalid icon name' })
    }

    // Check cache first using sanitized name
    if (iconFormatCache.has(sanitizedIconName)) {
      return res.json(iconFormatCache.get(sanitizedIconName))
    }

    // Check if SVG exists - use sanitized name to construct URL
    const svgUrl = `https://cdn.jsdelivr.net/gh/homarr-labs/dashboard-icons/svg/${sanitizedIconName}.svg`
    try {
      const svgResponse = await fetch(svgUrl, { method: 'HEAD' })
      const result = {
        iconName: sanitizedIconName,
        format: svgResponse.ok ? 'svg' : 'png',
        svgUrl: svgResponse.ok ? svgUrl : null,
        pngUrl: `https://cdn.jsdelivr.net/gh/homarr-labs/dashboard-icons/png/${sanitizedIconName}.png`
      }

      iconFormatCache.set(sanitizedIconName, result)
      return res.json(result)
    } catch (error) {
      // If fetch fails, assume PNG
      const result = {
        iconName: sanitizedIconName,
        format: 'png',
        svgUrl: null,
        pngUrl: `https://cdn.jsdelivr.net/gh/homarr-labs/dashboard-icons/png/${sanitizedIconName}.png`
      }
      iconFormatCache.set(sanitizedIconName, result)
      return res.json(result)
    }
  } catch (error) {
    console.error('Failed to check icon format:', error)
    res.status(500).json({ error: 'Failed to check icon format' })
  }
})

// API endpoint to get icon format cache (for bulk loading)
app.get('/api/icons/format-cache', (req, res) => {
  const cache = Object.fromEntries(iconFormatCache)
  res.json(cache)
})

// Helper function to load service overrides
async function loadServiceOverrides() {
  try {
    const servicesPath = join(DATA_DIR, 'services.json')
    const data = await readFile(servicesPath, 'utf-8')
    const json = JSON.parse(data)
    return {
      manualServices: json.manualServices || [],
      overrides: json.overrides || {}
    }
  } catch (error) {
    return { manualServices: [], overrides: {} }
  }
}

// Helper function to merge NPM service with overrides
function mergeServiceWithOverride(service, override) {
  if (!override) return service

  return {
    ...service,
    ...(override.name !== undefined && { name: override.name }),
    ...(override.description !== undefined && { description: override.description }),
    ...(override.icon !== undefined && { icon: override.icon }),
    ...(override.categoryIds !== undefined && { categoryIds: override.categoryIds }),
    ...(override.hidden !== undefined && { hidden: override.hidden }),
    _isNpmDiscovered: true,
    _hasOverrides: true
  }
}

// Helper function to get all visible services (used by both endpoints)
async function getAllVisibleServices() {
  const config = await loadConfig()
  const { manualServices, overrides } = await loadServiceOverrides()

  let allServices = [...manualServices.filter(s => !s.hidden)]

  // If NPM is enabled, fetch and merge NPM services
  if (config.npmEnabled && config.npmConnections?.length > 0) {
    const npmServices = await fetchNPMServices()

    // Apply overrides to NPM services
    const mergedNpmServices = npmServices.map(service => {
      const serviceId = service._npmMetadata?.id
      const override = serviceId ? overrides[`npm_${serviceId}`] : null
      return mergeServiceWithOverride(service, override)
    })

    // Filter out hidden NPM services
    const visibleNpmServices = mergedNpmServices.filter(s => !s.hidden)
    allServices = [...allServices, ...visibleNpmServices]
  }

  // Auto-categorize services that don't have categories yet
  // This ensures categories are applied but allows manual customization
  const categorizedServices = await Promise.all(allServices.map(async (service) => {
    if (service.categoryIds && service.categoryIds.length > 0) {
      // Service already has category IDs (manual or from override)
      return service
    }
    // Auto-categorize services without categories
    const categoryNames = categorizeService(service)
    const categoryIds = await convertNamesToIds(categoryNames)
    return {
      ...service,
      categoryIds
    }
  }))

  // Resolve icons for all services
  const servicesWithIcons = await Promise.all(
    categorizedServices.map(async (service) => {
      const iconInfo = await resolveServiceIcon(service)
      return {
        ...service,
        ...iconInfo
      }
    })
  )

  // Convert category IDs to names for frontend compatibility
  const servicesWithCategoryNames = await Promise.all(
    servicesWithIcons.map(async (service) => {
      if (service.categoryIds && service.categoryIds.length > 0) {
        const categoryNames = await convertIdsToNames(service.categoryIds)
        return {
          ...service,
          categories: categoryNames
        }
      }
      return {
        ...service,
        categories: []
      }
    })
  )

  return servicesWithCategoryNames
}

// Helper function to extract categories from services
async function getAllCategories() {
  const categories = await loadCategories()

  // Return only visible categories with their display names
  return categories
    .filter(cat => cat.visible !== false)
    .map(cat => ({
      name: cat.name,
      displayName: cat.displayName || cat.name,
      visible: cat.visible
    }))
}

// PUBLIC API: Get all visible services
app.get('/api/public/services', async (req, res) => {
  try {
    const services = await getAllVisibleServices()
    res.json(services)
  } catch (error) {
    console.error('Error getting services:', error)
    res.status(500).json({ error: 'Failed to get services' })
  }
})

// PUBLIC API: Get all visible categories
app.get('/api/public/categories', async (req, res) => {
  try {
    const categories = await getAllCategories()
    res.json(categories)
  } catch (error) {
    console.error('Error getting categories:', error)
    res.status(500).json({ error: 'Failed to get categories' })
  }
})

// Legacy endpoint - Serve services.json for backward compatibility
app.get('/services.json', async (req, res) => {
  try {
    const services = await getAllVisibleServices()
    res.json({ services })
  } catch (error) {
    console.error('Error building services list:', error)
    res.json({ services: [] })
  }
})

// Serve index.html for all other routes (SPA)
app.get('*', (req, res) => {
  res.sendFile(join(distPath, 'index.html'))
})

// Preload icon metadata on startup
loadIconsMetadata().catch(err => console.error('Failed to preload icons metadata:', err))

// Load config on startup
loadConfig().then(config => {
  console.log('✓ Configuration loaded')
  if (config.npmEnabled && config.npmConnections?.length > 0) {
    console.log(`✓ NPM integration: ${config.npmConnections.length} connection(s) configured`)
  }
}).catch(err => console.error('Failed to load config:', err))

// Start server
app.listen(PORT, () => {
  console.log('===================================')
  console.log('Services Dashboard - Server Started')
  console.log('===================================')
  console.log(`Listening on port ${PORT}`)
  console.log(`Data directory: ${DATA_DIR}`)
  console.log('===================================')
})
