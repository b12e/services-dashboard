/**
 * Nginx Proxy Manager integration
 *
 * Proxy hosts are cached per connection (NPM_CACHE_TTL seconds, default 60)
 * so a dashboard page load does not log in to every NPM instance. When an
 * instance is unreachable, the last successful result is served instead of
 * silently dropping its services.
 */

import { hostLabel, titleFromLabel } from './text.js'

const REQUEST_TIMEOUT_MS = 10000
const CACHE_TTL_MS = (Number(process.env.NPM_CACHE_TTL) || 60) * 1000

const cache = new Map() // connection key -> { at, services, error }
const inflight = new Map()

export function apiUrlFor(connection) {
  const base = String(connection.url || '').trim().replace(/\/+$/, '').replace(/\/api$/, '')
  return `${base}/api`
}

function connectionKey(connection) {
  return `${apiUrlFor(connection)}|${connection.username || ''}|${connection.token ? 'token' : ''}`
}

export function connectionLabel(connection) {
  return connection.name || connection.url
}

async function authenticate(apiUrl, username, password) {
  const response = await fetch(`${apiUrl}/tokens`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identity: username, secret: password }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })
  if (!response.ok) throw new Error(`NPM authentication failed (HTTP ${response.status})`)
  const data = await response.json()
  if (!data?.token) throw new Error('NPM authentication returned no token')
  return data.token
}

async function getToken(connection) {
  const apiUrl = apiUrlFor(connection)
  if (connection.username && connection.password) {
    return authenticate(apiUrl, connection.username, connection.password)
  }
  if (connection.token) return connection.token
  throw new Error('No credentials configured (username and password required)')
}

async function fetchProxyHosts(connection) {
  const token = await getToken(connection)
  const response = await fetch(`${apiUrlFor(connection)}/nginx/proxy-hosts`, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })
  if (!response.ok) throw new Error(`Failed to fetch proxy hosts (HTTP ${response.status})`)
  const hosts = await response.json()
  if (!Array.isArray(hosts)) throw new Error('Unexpected proxy hosts response')
  return hosts
}

/**
 * Convert an NPM proxy host into a service, or null when it has no usable
 * (non-wildcard) domain.
 */
export function convertProxyHost(host, connection = {}) {
  const domains = (host.domain_names || []).filter(d => typeof d === 'string' && d && !d.includes('*'))
  if (domains.length === 0) return null

  const primary = domains[0].toLowerCase()
  const label = hostLabel(primary)
  const protocol = host.certificate_id ? 'https' : 'http'

  return {
    npmId: host.id,
    name: titleFromLabel(label) || primary,
    url: `${protocol}://${primary}`,
    domain: primary,
    domains,
    forwardHost: host.forward_host || null,
    forwardPort: host.forward_port || null,
    connection: connectionLabel(connection),
  }
}

async function loadConnection(connection) {
  const hosts = await fetchProxyHosts(connection)
  return hosts
    .filter(host => host.enabled === 1 || host.enabled === true)
    .map(host => convertProxyHost(host, connection))
    .filter(Boolean)
}

async function getConnectionServices(connection, force) {
  const key = connectionKey(connection)
  const cached = cache.get(key)
  if (!force && cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.services
  if (inflight.has(key)) return inflight.get(key)

  const request = loadConnection(connection)
    .then(services => {
      cache.set(key, { at: Date.now(), services, error: null })
      return services
    })
    .catch(error => {
      console.error(`NPM ${connectionLabel(connection)}: ${error.message}`)
      // Keep serving the last good result, retry after the TTL
      const services = cached?.services || []
      cache.set(key, { at: Date.now(), services, error: error.message })
      return services
    })
    .finally(() => inflight.delete(key))

  inflight.set(key, request)
  return request
}

/**
 * All services discovered through the configured NPM connections.
 * Hosts with the same domain on several instances are listed once.
 */
export async function getNpmServices(config, { force = false } = {}) {
  if (!config.npmEnabled) return []
  const connections = (config.npmConnections || []).filter(c => c && c.url)
  const results = await Promise.all(connections.map(c => getConnectionServices(c, force)))

  const seen = new Set()
  const services = []
  for (const service of results.flat()) {
    if (seen.has(service.domain)) continue
    seen.add(service.domain)
    services.push(service)
  }
  return services
}

export function getConnectionStatus(connection) {
  const cached = cache.get(connectionKey(connection))
  if (!cached) return null
  return { checkedAt: new Date(cached.at).toISOString(), error: cached.error, count: cached.services.length }
}

export function clearNpmCache() {
  cache.clear()
}

/**
 * Check that a connection's credentials work.
 */
export async function validateConnection(connection) {
  try {
    if (!connection.username || !connection.password) {
      return { valid: false, error: 'Username and password are required' }
    }
    await authenticate(apiUrlFor(connection), connection.username, connection.password)
    return { valid: true }
  } catch (error) {
    const message = error.name === 'TimeoutError' ? 'Connection timed out' : error.message
    return { valid: false, error: message }
  }
}
