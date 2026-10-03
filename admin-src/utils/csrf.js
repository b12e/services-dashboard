/**
 * API helpers for the admin interface
 *
 * - Mutating requests carry a CSRF token. It is cached, and fetched again
 *   once when the server rejects it (the session id changes on login).
 * - A 401 response fires an "admin:unauthorized" event so the app can show
 *   the login page when the session expired.
 */

let cachedToken = null

export async function fetchCsrfToken() {
  const response = await fetch('/api/admin/csrf-token')
  if (!response.ok) throw new Error('Failed to fetch CSRF token')
  const data = await response.json()
  cachedToken = data.csrfToken
  return cachedToken
}

export async function getCsrfToken() {
  return cachedToken || fetchCsrfToken()
}

export function clearCsrfToken() {
  cachedToken = null
}

function notifyUnauthorized(url, response) {
  if (response.status === 401 && !url.startsWith('/api/admin/auth/')) {
    window.dispatchEvent(new Event('admin:unauthorized'))
  }
}

/**
 * fetch() with a CSRF token for mutating requests
 */
export async function fetchWithCsrf(url, options = {}) {
  const send = async (token) => fetch(url, {
    ...options,
    headers: { ...options.headers, 'x-csrf-token': token },
  })

  let response = await send(await getCsrfToken())
  if (response.status === 403) {
    clearCsrfToken()
    response = await send(await fetchCsrfToken())
  }
  notifyUnauthorized(url, response)
  return response
}

/**
 * JSON API call. Throws an Error with the server's message on failure.
 */
export async function api(url, { method = 'GET', body } = {}) {
  let response
  if (method === 'GET') {
    response = await fetch(url)
    notifyUnauthorized(url, response)
  } else {
    response = await fetchWithCsrf(url, {
      method,
      headers: body !== undefined ? { 'Content-Type': 'application/json' } : {},
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
  }

  let data = null
  try {
    data = await response.json()
  } catch {
    // Empty or non-JSON body
  }
  if (!response.ok) {
    throw new Error(data?.error || `Request failed (${response.status})`)
  }
  return data
}
