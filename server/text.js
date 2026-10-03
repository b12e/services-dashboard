/**
 * Text helpers shared by icon matching and categorization
 */

const IPV4 = /^\d{1,3}(\.\d{1,3}){3}$/

// Words that describe a deployment rather than the app itself
// ("Sonarr 4K", "plex-server", "grafana-dev", "my-jellyfin")
const NOISE_WORDS = new Set([
  '4k', 'hd', 'uhd', 'fhd', '1080p', '2160p', 'sd',
  'web', 'webui', 'ui', 'gui', 'app', 'apps', 'server', 'srv', 'svc', 'service',
  'admin', 'panel', 'portal', 'console', 'frontend', 'backend',
  'dev', 'test', 'testing', 'staging', 'stage', 'prod', 'production', 'beta', 'alpha',
  'old', 'new', 'legacy', 'main', 'primary', 'secondary', 'backup', 'internal', 'external',
  'local', 'lan', 'home', 'my', 'the', 'docker', 'lxc', 'vm',
])

/**
 * Lowercase, strip accents and drop everything that is not a letter or digit.
 * "Home-Assistant" -> "homeassistant"
 */
export function normalize(str) {
  if (typeof str !== 'string') return ''
  return str
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

/**
 * Split into lowercase words on separators and camelCase boundaries.
 * "qBittorrent Web-UI" -> ["q", "bittorrent", "web", "ui"]
 */
export function splitWords(str) {
  if (typeof str !== 'string') return []
  return str
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
}

// A loop instead of /\d+$/, which backtracks badly on long digit runs
function stripTrailingDigits(word) {
  let end = word.length
  while (end > 0 && word.charCodeAt(end - 1) >= 48 && word.charCodeAt(end - 1) <= 57) end--
  return end >= 3 ? word.slice(0, end) : word
}

// Names and hostnames are short, longer input is not worth matching
const MAX_INPUT = 200

/**
 * Generate lookup candidates for a free-form string, most specific first.
 * Each candidate has a normalized `key` and a `weight` (0..1) describing how
 * much of the original string it represents.
 */
export function candidatesFor(input) {
  const str = typeof input === 'string' ? input.slice(0, MAX_INPUT) : input
  const result = []
  const seen = new Set()
  const add = (key, weight, kind) => {
    if (!key || seen.has(key)) return
    seen.add(key)
    result.push({ key, weight, kind })
  }

  const full = normalize(str)
  add(full, 1, 'full')

  // Raw words (no camelCase split) keep names like "qBittorrent" intact
  const rawWords = (typeof str === 'string' ? str.toLowerCase().split(/[^a-z0-9]+/) : []).filter(Boolean)
  const words = [...new Set([...rawWords, ...splitWords(str)])]
  const meaningful = rawWords.filter(w => !NOISE_WORDS.has(w) && !/^\d+$/.test(w))

  add(meaningful.join(''), 0.95, 'full')
  add(stripTrailingDigits(meaningful.join('')), 0.9, 'full')

  // Adjacent word groups: "uptime kuma status" -> "uptimekuma", "kumastatus"
  for (let size = Math.min(3, meaningful.length - 1); size >= 2; size--) {
    for (let i = 0; i + size <= meaningful.length; i++) {
      add(meaningful.slice(i, i + size).join(''), 0.85, 'group')
    }
  }

  const singles = words
    .filter(w => !NOISE_WORDS.has(w) && !/^\d+$/.test(w))
    .sort((a, b) => b.length - a.length)
  for (const word of singles) {
    add(word, 0.8, 'word')
    add(stripTrailingDigits(word), 0.75, 'word')
  }

  return result
}

/**
 * Extract the most descriptive label from a hostname or URL.
 * "https://sonarr.local.example.com:8443/x" -> "sonarr"
 * Returns null for IP addresses and empty input.
 */
export function hostLabel(value) {
  if (typeof value !== 'string' || !value.trim()) return null
  let host = value.trim()
  try {
    if (/^[a-z][a-z0-9+.-]*:\/\//i.test(host)) host = new URL(host).hostname
  } catch {
    return null
  }
  host = host.split('/')[0].split(':')[0].toLowerCase()
  if (!host || IPV4.test(host) || host.includes('[')) return null
  const labels = host.split('.').filter(Boolean)
  const label = labels.find(l => l !== '*' && l !== 'www') || null
  return label
}

const SHORT_WORDS = new Set(['my', 'of', 'to', 'in', 'on', 'at', 'is', 'it', 'go', 'me', 'we', 'up', 'by', 'or', 'an', 'the', 'and', 'app'])

/**
 * Turn a hostname label into a display name:
 * "sonarr-4k" -> "Sonarr 4K", "ha" -> "HA", "npm" -> "NPM", "my-app" -> "My App"
 */
export function titleFromLabel(label) {
  if (!label) return ''
  return label
    .split(/[-_]+/)
    .filter(Boolean)
    .map(word => {
      const lower = word.toLowerCase()
      const abbreviation = !SHORT_WORDS.has(lower) &&
        (lower.length <= 2 || (lower.length === 3 && !/[aeiouy]/.test(lower)) || /^\d+k$/.test(lower))
      return abbreviation ? word.toUpperCase() : word.charAt(0).toUpperCase() + word.slice(1)
    })
    .join(' ')
}

/**
 * Levenshtein distance with an early exit once `max` is exceeded.
 */
export function editDistance(a, b, max = 2) {
  if (Math.abs(a.length - b.length) > max) return max + 1
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    const current = [i]
    let rowMin = i
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + cost)
      rowMin = Math.min(rowMin, current[j])
    }
    if (rowMin > max) return max + 1
    previous = current
  }
  return previous[b.length]
}
