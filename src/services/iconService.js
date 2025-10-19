/**
 * Icon Discovery Service
 * Uses dashboard-icons metadata to find the best matching icon for a service
 */

let iconsMetadata = null

/**
 * Load icons metadata from local file
 * @returns {Promise<Array>} - Array of icon metadata objects
 */
async function loadIconsMetadata() {
  if (iconsMetadata) {
    return iconsMetadata
  }

  try {
    const response = await fetch('/dashboard-icons-metadata.json')
    if (!response.ok) {
      console.warn(`Failed to load icons metadata: ${response.status}`)
      iconsMetadata = []
      return []
    }

    const text = await response.text()

    // Check if response is valid JSON
    if (!text || !text.trim().startsWith('[') && !text.trim().startsWith('{')) {
      console.warn('Icons metadata is not valid JSON, using fallback')
      iconsMetadata = []
      return []
    }

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
 * Normalize a string for comparison
 * @param {string} str - String to normalize
 * @returns {string} - Normalized string
 */
function normalizeString(str) {
  if (!str) return ''

  return str
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '') // Remove all non-alphanumeric characters
    .trim()
}

/**
 * Calculate similarity score between two strings
 * @param {string} str1 - First string
 * @param {string} str2 - Second string
 * @returns {number} - Similarity score (0-1)
 */
function calculateSimilarity(str1, str2) {
  const s1 = normalizeString(str1)
  const s2 = normalizeString(str2)

  if (s1 === s2) return 1.0
  if (s1.includes(s2) || s2.includes(s1)) return 0.8

  // Check for partial matches
  const shorter = s1.length < s2.length ? s1 : s2
  const longer = s1.length < s2.length ? s2 : s1

  if (longer.includes(shorter)) return 0.6

  return 0
}

/**
 * Find the best matching icon for a service name
 * @param {string} serviceName - Name of the service
 * @returns {Promise<Object|null>} - Icon metadata object {name, category} or null if no good match found
 */
export async function findIconForService(serviceName) {
  if (!serviceName) return null

  const metadata = await loadIconsMetadata()
  if (metadata.length === 0) {
    console.log('No icons metadata available, using fallback')
    return null
  }

  const normalizedServiceName = normalizeString(serviceName)
  let bestMatch = null
  let bestScore = 0

  for (const icon of metadata) {
    // Check icon name
    const iconNameScore = calculateSimilarity(serviceName, icon.name)

    // Check aliases if available
    let aliasScore = 0
    if (icon.aliases && Array.isArray(icon.aliases)) {
      for (const alias of icon.aliases) {
        const score = calculateSimilarity(serviceName, alias)
        aliasScore = Math.max(aliasScore, score)
      }
    }

    const score = Math.max(iconNameScore, aliasScore)

    if (score > bestScore) {
      bestScore = score
      bestMatch = icon
    }

    // If we found a perfect match, stop searching
    if (bestScore === 1.0) break
  }

  // Only return matches with a reasonable confidence
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

    console.log(`Found icon for "${serviceName}": "${iconName}" (score: ${bestScore})${category ? ` [${category}]` : ''}`)
    return {
      name: iconName,
      category
    }
  }

  console.log(`No good icon match found for "${serviceName}" (best score: ${bestScore})`)
  return null
}

/**
 * Get icon suggestions for a service name
 * @param {string} serviceName - Name of the service
 * @param {number} limit - Maximum number of suggestions
 * @returns {Promise<Array>} - Array of icon suggestions with scores
 */
export async function getIconSuggestions(serviceName, limit = 5) {
  if (!serviceName) return []

  const metadata = await loadIconsMetadata()
  if (metadata.length === 0) return []

  const suggestions = []

  for (const icon of metadata) {
    const iconNameScore = calculateSimilarity(serviceName, icon.name)

    let aliasScore = 0
    if (icon.aliases && Array.isArray(icon.aliases)) {
      for (const alias of icon.aliases) {
        const score = calculateSimilarity(serviceName, alias)
        aliasScore = Math.max(aliasScore, score)
      }
    }

    const score = Math.max(iconNameScore, aliasScore)

    if (score > 0) {
      suggestions.push({
        name: icon.name,
        score: score,
        url: icon.url || `https://cdn.jsdelivr.net/gh/homarr-labs/dashboard-icons/svg/${icon.name}.svg`
      })
    }
  }

  // Sort by score descending and return top matches
  return suggestions
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
}

/**
 * Check if metadata is loaded
 * @returns {boolean} - True if metadata is loaded
 */
export function isMetadataLoaded() {
  return iconsMetadata !== null && iconsMetadata.length > 0
}

/**
 * Pre-load metadata (call this on app initialization)
 * @returns {Promise<void>}
 */
export async function preloadIconsMetadata() {
  await loadIconsMetadata()
}
