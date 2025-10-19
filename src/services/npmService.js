/**
 * NPM Service Integration - Client Side
 * Calls internal API endpoint instead of NPM API directly for security
 */

/**
 * Fetch all services from NPM via internal API endpoint
 * @returns {Promise<Array>} - Array of dashboard services
 */
export async function fetchNPMServices() {
  try {
    console.log('Fetching services from NPM via internal API...')
    const response = await fetch('/api/npm/services')

    if (!response.ok) {
      throw new Error(`Failed to fetch NPM services: ${response.status}`)
    }

    const services = await response.json()
    console.log(`Loaded ${services.length} services from NPM`)

    return services
  } catch (error) {
    console.error('Failed to fetch NPM services:', error)
    // Return empty array on error - don't break the app
    return []
  }
}

/**
 * Normalize a URL for comparison (removes protocol, trailing slash, default ports)
 * This ensures deduplication works correctly regardless of http/https or ports
 *
 * Examples:
 *   https://plex.example.com       -> plex.example.com
 *   http://plex.example.com        -> plex.example.com
 *   plex.example.com               -> plex.example.com
 *   https://plex.example.com:443   -> plex.example.com
 *   http://plex.example.com:80     -> plex.example.com
 *   https://plex.example.com:8096/ -> plex.example.com:8096
 *
 * @param {string} url - URL to normalize
 * @returns {string} - Normalized URL for comparison
 */
function normalizeUrl(url) {
  if (!url) return ''

  let normalized = url
    .toLowerCase()
    .trim()
    .replace(/^https?:\/\//, '') // Remove http:// or https:// protocol
    .replace(/\/$/, '')           // Remove trailing slash
    .replace(/:443$/, '')         // Remove default HTTPS port
    .replace(/:80$/, '')          // Remove default HTTP port

  return normalized
}

/**
 * Construct full URL for a manual service (handles appendBaseDomain)
 * @param {Object} service - Service object
 * @param {string} baseUrl - Base domain
 * @returns {string} - Full URL
 */
function constructFullUrl(service, baseUrl) {
  const url = service.url || ''
  const appendBaseDomain = service.appendBaseDomain !== false // default true

  // If URL already has protocol, use as-is
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url
  }

  // If appendBaseDomain is false, add https:// prefix
  if (!appendBaseDomain) {
    return `https://${url}`
  }

  // If appendBaseDomain is true and we have a baseUrl
  if (baseUrl) {
    // If url is empty, just use baseUrl
    if (!url) {
      return `https://${baseUrl}`
    }
    // Otherwise append to baseUrl
    return `https://${url}.${baseUrl}`
  }

  // Fallback: add https:// prefix
  return url ? `https://${url}` : ''
}

/**
 * Merge NPM services with manually configured services
 * Deduplicates by URL. If same URL exists in both:
 * - Use name/icon/category from manual services.json
 * - Keep URL and metadata from NPM
 * @param {Array} manualServices - Manually configured services
 * @param {Array} npmServices - Auto-detected NPM services
 * @param {string} baseUrl - Base domain for manual services
 * @returns {Array} - Merged and deduplicated services array
 */
export function mergeServices(manualServices = [], npmServices = [], baseUrl = '') {
  const urlMap = new Map()
  const manualUrlMap = new Map()
  let duplicatesMerged = 0
  let manualOnlyCount = 0
  let npmOnlyCount = 0

  // First pass: Index all manual services by normalized URL
  console.log('=== Processing Manual Services ===')
  console.log(`Base URL: "${baseUrl}"`)
  manualServices.forEach(service => {
    if (!service || !service.url) {
      console.warn('Skipping manual service with no URL:', service?.name || 'unnamed')
      return
    }

    // Construct full URL for manual service
    const fullUrl = constructFullUrl(service, baseUrl)
    const normalizedUrl = normalizeUrl(fullUrl)

    if (!normalizedUrl) {
      console.warn('Invalid URL for manual service:', service?.name || 'unnamed')
      return
    }

    console.log(`Manual: "${service.name}" -> ${service.url} -> ${fullUrl} -> [${normalizedUrl}]`)

    // Store manual service in a separate map for override lookup
    manualUrlMap.set(normalizedUrl, {
      name: service.name,
      icon: service.icon,
      category: service.category,
      fullService: service
    })
  })
  console.log(`Indexed ${manualUrlMap.size} manual services`)

  // Second pass: Process NPM services
  console.log('=== Processing NPM Services ===')
  npmServices.forEach(service => {
    if (!service || !service.url) {
      console.warn('Skipping NPM service with no URL:', service?.name || 'unnamed')
      return
    }

    const normalizedUrl = normalizeUrl(service.url)
    if (!normalizedUrl) {
      console.warn('Invalid URL for NPM service:', service?.name || 'unnamed')
      return
    }

    console.log(`NPM: "${service.name}" -> ${service.url} -> [${normalizedUrl}]`)

    // Check if this URL exists in manual services
    if (manualUrlMap.has(normalizedUrl)) {
      const manualOverride = manualUrlMap.get(normalizedUrl)

      // Merge: Use manual name/icon/category, but keep NPM's URL and metadata
      const mergedService = {
        ...service, // Start with NPM service (has URL, appendBaseDomain, _npmMetadata, etc.)
        name: manualOverride.name, // Always override with manual name
      }

      // Only override icon if manual service has one
      if (manualOverride.icon) {
        mergedService.icon = manualOverride.icon
      }

      // Only override category if manual service has one
      if (manualOverride.category) {
        mergedService.category = manualOverride.category
      }

      urlMap.set(normalizedUrl, mergedService)
      duplicatesMerged++
      console.log(`  ✓ MERGED with manual service "${manualOverride.name}"`)
    } else {
      // No manual override, add NPM service as-is
      urlMap.set(normalizedUrl, service)
      npmOnlyCount++
      console.log(`  → Added as NPM-only service`)
    }
  })

  // Third pass: Add manual services that DON'T have NPM equivalents
  console.log('=== Adding Manual-Only Services ===')
  manualUrlMap.forEach((manualOverride, normalizedUrl) => {
    if (!urlMap.has(normalizedUrl)) {
      // This manual service doesn't have an NPM equivalent, add it
      console.log(`Manual-only: "${manualOverride.name}" [${normalizedUrl}]`)
      urlMap.set(normalizedUrl, manualOverride.fullService)
      manualOnlyCount++
    }
  })

  const merged = Array.from(urlMap.values())

  // Detailed logging
  console.log('=== Service Merge Summary ===')
  console.log(`  - Manual only: ${manualOnlyCount}`)
  console.log(`  - NPM only: ${npmOnlyCount}`)
  console.log(`  - Merged (manual override): ${duplicatesMerged}`)
  console.log(`  - Total unique services: ${merged.length}`)
  console.log(`  - Expected: ${manualServices.length} manual + ${npmServices.length} NPM = ${manualServices.length + npmServices.length}`)

  return merged
}
