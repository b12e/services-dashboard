/**
 * NPM Service Integration - Client Side
 * Calls internal API endpoint instead of NPM API directly for security
 */

import { generateNameFromUrl } from '../utils/nameFromUrl.js'
import { findIconForService } from './iconService.js'

/**
 * Fetch all services from NPM via internal API endpoint
 * @returns {Promise<Array>} - Array of dashboard services
 */
export async function fetchNPMServices() {
  try {
    const response = await fetch('/api/npm/services')

    if (!response.ok) {
      throw new Error(`Failed to fetch NPM services: ${response.status}`)
    }

    const services = await response.json()
    return services
  } catch (error) {
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
 * @returns {Promise<Array>} - Merged and deduplicated services array
 */
export async function mergeServices(manualServices = [], npmServices = [], baseUrl = '') {
  const urlMap = new Map()
  const manualUrlMap = new Map()
  let duplicatesMerged = 0
  let manualOnlyCount = 0
  let npmOnlyCount = 0

  // First pass: Index all manual services by normalized URL
  manualServices.forEach(service => {
    if (!service || !service.url) {
      return
    }

    // Construct full URL for manual service
    const fullUrl = constructFullUrl(service, baseUrl)
    const normalizedUrl = normalizeUrl(fullUrl)

    if (!normalizedUrl) {
      return
    }

    // Store manual service in a separate map for override lookup
    manualUrlMap.set(normalizedUrl, {
      name: service.name,
      icon: service.icon,
      category: service.category,
      hidden: service.hidden === true, // Track if this URL should be hidden
      fullService: service
    })
  })

  // Second pass: Process NPM services
  npmServices.forEach(service => {
    if (!service || !service.url) {
      return
    }

    const normalizedUrl = normalizeUrl(service.url)
    if (!normalizedUrl) {
      return
    }

    // Check if this URL exists in manual services
    if (manualUrlMap.has(normalizedUrl)) {
      const manualOverride = manualUrlMap.get(normalizedUrl)

      // If manual service marks this URL as hidden, skip it completely
      if (manualOverride.hidden) {
        return // Don't add this NPM service to the final list
      }

      // Merge: Use manual name/icon/category, but keep NPM's URL and metadata
      const mergedService = {
        ...service, // Start with NPM service (has URL, appendBaseDomain, _npmMetadata, etc.)
      }

      let nameChanged = false

      // Only override name if manual service has one
      if (manualOverride.name) {
        nameChanged = mergedService.name !== manualOverride.name
        mergedService.name = manualOverride.name
      }

      // Only override icon if manual service has one
      if (manualOverride.icon) {
        mergedService.icon = manualOverride.icon
      } else if (nameChanged) {
        // Name changed but no custom icon specified - re-discover icon based on new name
        // We'll do this in a post-processing step to avoid blocking the merge
        mergedService._needsIconRediscovery = true
      }

      // Only override category if manual service has one
      if (manualOverride.category) {
        mergedService.category = manualOverride.category
      }

      urlMap.set(normalizedUrl, mergedService)
      duplicatesMerged++
    } else {
      // No manual override, add NPM service as-is
      urlMap.set(normalizedUrl, service)
      npmOnlyCount++
    }
  })

  // Third pass: Add manual services that DON'T have NPM equivalents
  manualUrlMap.forEach((manualOverride, normalizedUrl) => {
    if (!urlMap.has(normalizedUrl)) {
      // Skip if this manual service is marked as hidden
      if (manualOverride.hidden) {
        return
      }

      // This manual service doesn't have an NPM equivalent, add it
      const service = manualOverride.fullService

      // Ensure service has a name - generate from URL if missing
      if (!service.name) {
        const fullUrl = constructFullUrl(service, baseUrl)
        service.name = generateNameFromUrl(fullUrl)
      }

      urlMap.set(normalizedUrl, service)
      manualOnlyCount++
    }
  })

  // Final pass: Ensure all services have names and re-discover icons if needed
  const merged = await Promise.all(
    Array.from(urlMap.values()).map(async (service) => {
      // Generate name from URL if missing
      if (!service.name) {
        service = {
          ...service,
          name: generateNameFromUrl(service.url)
        }
      }

      // Re-discover icon if name was changed from services.json
      if (service._needsIconRediscovery) {
        const iconMatch = await findIconForService(service.name)
        if (iconMatch) {
          service.icon = iconMatch.name
          // Also update suggested categories from the new icon match
          if (iconMatch.categories && iconMatch.categories.length > 0) {
            service._suggestedCategories = iconMatch.categories
          }
        }
        delete service._needsIconRediscovery
      }

      return service
    })
  )

  return merged
}
