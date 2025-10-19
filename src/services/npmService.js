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
 * Deduplicates based on URL (manual services take priority)
 * @param {Array} manualServices - Manually configured services
 * @param {Array} npmServices - Auto-detected NPM services
 * @returns {Array} - Merged services array
 */
export function mergeServices(manualServices = [], npmServices = []) {
  const urlMap = new Map()
  const nameMap = new Map()
  let duplicatesSkipped = 0

  // Add manual services first (they take priority)
  manualServices.forEach(service => {
    if (!service || !service.url) {
      console.warn('Skipping manual service with no URL:', service?.name || 'unnamed')
      return
    }

    const normalizedUrl = normalizeUrl(service.url)
    if (normalizedUrl) {
      urlMap.set(normalizedUrl, service)
      if (service.name) {
        nameMap.set(service.name.toLowerCase(), normalizedUrl)
      }
    }
  })

  // Add NPM services only if they don't conflict
  npmServices.forEach(service => {
    if (!service || !service.url) {
      console.warn('Skipping NPM service with no URL:', service?.name || 'unnamed')
      return
    }

    const normalizedUrl = normalizeUrl(service.url)
    const normalizedName = service.name?.toLowerCase()

    // Check for URL conflict
    if (urlMap.has(normalizedUrl)) {
      duplicatesSkipped++
      console.log(`Skipping NPM service "${service.name}" - URL already exists in manual services`)
      return
    }

    // Check for name conflict (optional, just warn)
    if (normalizedName && nameMap.has(normalizedName)) {
      console.warn(`NPM service "${service.name}" has same name as manual service but different URL`)
    }

    // Add the NPM service
    urlMap.set(normalizedUrl, service)
    if (normalizedName) {
      nameMap.set(normalizedName, normalizedUrl)
    }
  })

  if (duplicatesSkipped > 0) {
    console.log(`Skipped ${duplicatesSkipped} duplicate NPM services (already in manual services)`)
  }

  const merged = Array.from(urlMap.values())
  console.log(`Merged ${manualServices.length} manual + ${npmServices.length} NPM services = ${merged.length} total (${duplicatesSkipped} duplicates removed)`)

  return merged
}
