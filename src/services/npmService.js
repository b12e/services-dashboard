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
 * Merge NPM services with manually configured services
 * Deduplicates by URL. If same URL exists in both:
 * - Use name/icon/category from manual services.json
 * - Keep URL and metadata from NPM
 * @param {Array} manualServices - Manually configured services
 * @param {Array} npmServices - Auto-detected NPM services
 * @returns {Array} - Merged and deduplicated services array
 */
export function mergeServices(manualServices = [], npmServices = []) {
  const urlMap = new Map()
  const manualUrlMap = new Map()
  let duplicatesMerged = 0
  let manualOnlyCount = 0
  let npmOnlyCount = 0

  // First pass: Index all manual services by normalized URL
  manualServices.forEach(service => {
    if (!service || !service.url) {
      console.warn('Skipping manual service with no URL:', service?.name || 'unnamed')
      return
    }

    const normalizedUrl = normalizeUrl(service.url)
    if (!normalizedUrl) {
      console.warn('Invalid URL for manual service:', service?.name || 'unnamed')
      return
    }

    // Store manual service in a separate map for override lookup
    manualUrlMap.set(normalizedUrl, {
      name: service.name,
      icon: service.icon,
      category: service.category,
      fullService: service
    })
  })

  // Second pass: Process NPM services
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
      console.log(`Merged: "${manualOverride.name}" (${normalizedUrl}) - using manual name/icon with NPM URL`)
    } else {
      // No manual override, add NPM service as-is
      urlMap.set(normalizedUrl, service)
      npmOnlyCount++
    }
  })

  // Third pass: Add manual services that DON'T have NPM equivalents
  manualUrlMap.forEach((manualOverride, normalizedUrl) => {
    if (!urlMap.has(normalizedUrl)) {
      // This manual service doesn't have an NPM equivalent, add it
      urlMap.set(normalizedUrl, manualOverride.fullService)
      manualOnlyCount++
    }
  })

  const merged = Array.from(urlMap.values())

  // Detailed logging
  console.log(`Service merge complete:`)
  console.log(`  - Manual only: ${manualOnlyCount}`)
  console.log(`  - NPM only: ${npmOnlyCount}`)
  console.log(`  - Merged (manual override): ${duplicatesMerged}`)
  console.log(`  - Total unique services: ${merged.length}`)

  return merged
}
