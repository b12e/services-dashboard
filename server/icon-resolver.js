/**
 * Icon resolution utility
 * Validates and resolves icon URLs from multiple sources:
 * 1. Custom URLs (http:// or https://)
 * 2. Dashboard Icons (homarr-labs/dashboard-icons)
 * 3. Simple Icons (simple-icons)
 * 4. Fallback to initials
 */

// Icon format cache - stores which icons exist and where
const iconCache = new Map()
const CACHE_TTL = 24 * 60 * 60 * 1000 // 24 hours

/**
 * Sanitize icon name to prevent path traversal and SSRF attacks
 */
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

/**
 * Check if a URL returns a successful response
 */
async function checkUrlExists(url, timeout = 3000) {
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeout)

    const response = await fetch(url, {
      method: 'HEAD',
      signal: controller.signal
    })

    clearTimeout(timeoutId)
    return response.ok
  } catch (error) {
    return false
  }
}

/**
 * Resolve icon URL from multiple sources
 * Returns the first valid icon URL or null
 */
export async function resolveIconUrl(iconName, serviceName = null) {
  // If iconName is a custom URL, validate and return it
  if (iconName && (iconName.startsWith('http://') || iconName.startsWith('https://'))) {
    // Return custom URL directly - we trust user-provided URLs
    return {
      url: iconName,
      source: 'custom',
      format: iconName.toLowerCase().endsWith('.svg') ? 'svg' : 'png'
    }
  }

  // Sanitize icon name
  const sanitized = sanitizeIconName(iconName || serviceName)
  if (!sanitized) {
    return null
  }

  // Check cache first
  const cacheKey = sanitized.toLowerCase()
  const cached = iconCache.get(cacheKey)
  if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
    return cached.result
  }

  // Try dashboard-icons first (SVG)
  const dashboardSvgUrl = `https://cdn.jsdelivr.net/gh/homarr-labs/dashboard-icons/svg/${sanitized}.svg`
  if (await checkUrlExists(dashboardSvgUrl)) {
    const result = {
      url: dashboardSvgUrl,
      source: 'dashboard-icons',
      format: 'svg'
    }
    iconCache.set(cacheKey, { result, timestamp: Date.now() })
    return result
  }

  // Try dashboard-icons PNG
  const dashboardPngUrl = `https://cdn.jsdelivr.net/gh/homarr-labs/dashboard-icons/png/${sanitized}.png`
  if (await checkUrlExists(dashboardPngUrl)) {
    const result = {
      url: dashboardPngUrl,
      source: 'dashboard-icons',
      format: 'png'
    }
    iconCache.set(cacheKey, { result, timestamp: Date.now() })
    return result
  }

  // Try simple-icons (remove hyphens, lowercase)
  const simpleIconName = sanitized.replace(/-/g, '').toLowerCase()
  const simpleIconUrl = `https://cdn.jsdelivr.net/npm/simple-icons@latest/icons/${simpleIconName}.svg`
  if (await checkUrlExists(simpleIconUrl)) {
    const result = {
      url: simpleIconUrl,
      source: 'simple-icons',
      format: 'svg'
    }
    iconCache.set(cacheKey, { result, timestamp: Date.now() })
    return result
  }

  // No icon found
  iconCache.set(cacheKey, { result: null, timestamp: Date.now() })
  return null
}

/**
 * Generate fallback initials from service name
 */
export function generateInitials(serviceName) {
  if (!serviceName) return '??'

  return serviceName
    .split(' ')
    .map(word => word[0])
    .join('')
    .substring(0, 2)
    .toUpperCase()
}

/**
 * Resolve icon for a service
 * Returns an object with icon URL and fallback initials
 */
export async function resolveServiceIcon(service) {
  const iconResult = await resolveIconUrl(service.icon, service.name)

  return {
    iconUrl: iconResult?.url || null,
    iconSource: iconResult?.source || null,
    iconFormat: iconResult?.format || null,
    fallbackInitials: generateInitials(service.name)
  }
}

/**
 * Clear icon cache (useful for testing or forced refresh)
 */
export function clearIconCache() {
  iconCache.clear()
}

/**
 * Get cache statistics
 */
export function getIconCacheStats() {
  return {
    size: iconCache.size,
    entries: Array.from(iconCache.entries()).map(([key, value]) => ({
      key,
      result: value.result,
      age: Date.now() - value.timestamp
    }))
  }
}
