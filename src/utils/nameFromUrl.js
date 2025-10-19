/**
 * Generate a display name from a URL or domain
 * Examples:
 *   unknown.local.b12e.es -> Unknown
 *   plex.example.com -> Plex
 *   auth -> Auth
 *   https://my-service.com -> My Service
 */
export function generateNameFromUrl(url) {
  if (!url) return 'Unknown Service'

  // Remove protocol if present
  let domain = url.replace(/^https?:\/\//, '')

  // Remove port if present
  domain = domain.replace(/:\d+.*$/, '')

  // Remove path and query string
  domain = domain.split('/')[0]
  domain = domain.split('?')[0]

  // Get the first part of the domain (subdomain or domain name)
  const parts = domain.split('.')
  const firstPart = parts[0] || 'Unknown'

  // Convert to title case and handle hyphens/underscores
  return firstPart
    .split(/[-_]/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}
