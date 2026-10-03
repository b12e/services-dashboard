/**
 * Service worker: makes the installed dashboard open offline with the last
 * known services, and caches icons.
 *
 * - Pages and the dashboard data: network first, cache as fallback
 * - Hashed build assets and icons: cache first
 *
 * Bump VERSION to drop the cached app shell.
 */

const VERSION = 'v1'
const SHELL_CACHE = `shell-${VERSION}`
const DATA_CACHE = 'dashboard-data'
const ICON_CACHE = 'icons'
const ICON_LIMIT = 500
const NETWORK_TIMEOUT_MS = 5000

self.addEventListener('install', (event) => {
  self.skipWaiting()
  event.waitUntil(caches.open(SHELL_CACHE).then(cache => cache.addAll(['/', '/icon.svg', '/manifest.webmanifest'])))
})

self.addEventListener('activate', (event) => {
  // Also removes the caches of the Workbox service worker used before
  const keep = [SHELL_CACHE, DATA_CACHE, ICON_CACHE]
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => !keep.includes(key)).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  )
})

async function networkFirst(request, cacheName, fallbackUrl) {
  const cache = await caches.open(cacheName)
  try {
    const response = await fetch(request, { signal: AbortSignal.timeout(NETWORK_TIMEOUT_MS) })
    if (response.ok) cache.put(fallbackUrl || request, response.clone())
    return response
  } catch (error) {
    const cached = await cache.match(fallbackUrl || request)
    if (cached) return cached
    throw error
  }
}

async function cacheFirst(request, cacheName, limit) {
  const cache = await caches.open(cacheName)
  const cached = await cache.match(request)
  if (cached) return cached

  const response = await fetch(request)
  // Opaque responses come from cross-origin <img> requests (the icon CDN)
  if (response.ok || response.type === 'opaque') {
    await cache.put(request, response.clone())
    if (limit) {
      const keys = await cache.keys()
      await Promise.all(keys.slice(0, Math.max(0, keys.length - limit)).map(key => cache.delete(key)))
    }
  }
  return response
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return
  const url = new URL(request.url)

  if (url.origin === self.location.origin) {
    if (request.mode === 'navigate') {
      event.respondWith(networkFirst(request, SHELL_CACHE, '/'))
    } else if (url.pathname === '/api/public/dashboard') {
      event.respondWith(networkFirst(request, DATA_CACHE))
    } else if (url.pathname.startsWith('/assets/')) {
      event.respondWith(cacheFirst(request, SHELL_CACHE))
    } else if (url.pathname.startsWith('/api/icons/si/')) {
      event.respondWith(cacheFirst(request, ICON_CACHE, ICON_LIMIT))
    }
  } else if (url.hostname === 'cdn.jsdelivr.net' && url.pathname.startsWith('/gh/homarr-labs/dashboard-icons/')) {
    event.respondWith(cacheFirst(request, ICON_CACHE, ICON_LIMIT))
  }
})
