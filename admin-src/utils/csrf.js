/**
 * CSRF Token Management Utility
 *
 * This utility handles fetching and caching CSRF tokens for the admin interface.
 * The token is fetched once and reused for all requests.
 */

let cachedToken = null

/**
 * Fetches a fresh CSRF token from the server
 * @returns {Promise<string>} The CSRF token
 */
export async function fetchCsrfToken() {
  try {
    const response = await fetch('/api/admin/csrf-token')
    if (!response.ok) {
      throw new Error('Failed to fetch CSRF token')
    }
    const data = await response.json()
    cachedToken = data.csrfToken
    return cachedToken
  } catch (error) {
    console.error('Error fetching CSRF token:', error)
    throw error
  }
}

/**
 * Gets the cached CSRF token, or fetches a new one if not cached
 * @returns {Promise<string>} The CSRF token
 */
export async function getCsrfToken() {
  if (cachedToken) {
    return cachedToken
  }
  return await fetchCsrfToken()
}

/**
 * Clears the cached CSRF token
 * Useful when logging out or when a token becomes invalid
 */
export function clearCsrfToken() {
  cachedToken = null
}

/**
 * Makes a fetch request with CSRF token included
 * @param {string} url - The URL to fetch
 * @param {object} options - Fetch options (method, headers, body, etc.)
 * @returns {Promise<Response>} The fetch response
 */
export async function fetchWithCsrf(url, options = {}) {
  const token = await getCsrfToken()

  const headers = {
    ...options.headers,
    'x-csrf-token': token
  }

  return fetch(url, {
    ...options,
    headers
  })
}
