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
 * Normalize a URL for comparison (removes protocol, trailing slash, port if :80 or :443)
 * @param {string} url - URL to normalize
 * @returns {string} - Normalized URL
 */
function normalizeUrl(url) {
  if (!url) return ''

  let normalized = url
    .toLowerCase()
    .trim()
    .replace(/^https?:\/\//, '') // Remove protocol
    .replace(/\/$/, '') // Remove trailing slash
    .replace(/:80$/, '') // Remove default HTTP port
    .replace(/:443$/, '') // Remove default HTTPS port

  return normalized
}

/**
 * Merge NPM services with manually configured services
 * If same URL exists in both, use name/icon from manual services.json but keep NPM's URL/metadata
 * @param {Array} manualServices - Manually configured services
 * @param {Array} npmServices - Auto-detected NPM services
 * @returns {Array} - Merged services array
 */
export function mergeServices(manualServices = [], npmServices = []) {
  const urlMap = new Map()
  const manualOverrides = new Map()
  let duplicatesMerged = 0

  // First pass: Index manual services by normalized URL
  manualServices.forEach(service => {
    if (!service || !service.url) {
      console.warn('Skipping manual service with no URL:', service?.name || 'unnamed')
      return
    }

    const normalizedUrl = normalizeUrl(service.url)
    if (normalizedUrl) {
      // Store both the full service and an override object
      urlMap.set(normalizedUrl, service)
      manualOverrides.set(normalizedUrl, {
        name: service.name,
        icon: service.icon,
        category: service.category,
        // Store any other manual overrides you want to preserve
      })
    }
  })

  // Second pass: Add NPM services, merging with manual overrides if URL matches
  npmServices.forEach(service => {
    if (!service || !service.url) {
      console.warn('Skipping NPM service with no URL:', service?.name || 'unnamed')
      return
    }

    const normalizedUrl = normalizeUrl(service.url)

    // Check if this URL exists in manual services
    if (urlMap.has(normalizedUrl)) {
      const manualOverride = manualOverrides.get(normalizedUrl)

      // Merge: Use manual name/icon/category, but keep NPM's URL and metadata
      const mergedService = {
        ...service, // Start with NPM service (has URL, appendBaseDomain, _npmMetadata, etc.)
        name: manualOverride.name, // Override with manual name
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
      console.log(`Merged NPM service with manual override for "${manualOverride.name}" (${normalizedUrl})`)
    } else {
      // No conflict, just add the NPM service
      urlMap.set(normalizedUrl, service)
    }
  })

  const merged = Array.from(urlMap.values())

  if (duplicatesMerged > 0) {
    console.log(`Merged ${duplicatesMerged} services (using manual name/icon with NPM URL)`)
  }

  console.log(`Final result: ${merged.length} total services (${manualServices.length} manual, ${npmServices.length} NPM, ${duplicatesMerged} merged)`)

  return merged
}
