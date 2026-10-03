/**
 * Icon index, matching and resolution
 *
 * Sources:
 *   - homarr-labs/dashboard-icons (metadata.json, served from jsDelivr)
 *   - simple-icons (bundled npm package, served locally in brand colours)
 *
 * Icons are resolved from local metadata, so rendering the dashboard never
 * needs a HEAD request per icon. Matching ranks exact names over aliases over
 * prefix and typo matches, instead of accepting any substring.
 */

import fs from 'fs/promises'
import path from 'path'
import { createRequire } from 'module'
import { normalize, candidatesFor, hostLabel, editDistance } from './text.js'
import { APP_ABBREVIATIONS, AMBIGUOUS_NAMES, GENERIC_WORDS } from './taxonomy.js'
import { PATHS, ROOT_DIR, writeJsonAtomic } from './storage.js'

const require = createRequire(import.meta.url)

const DI_CDN = 'https://cdn.jsdelivr.net/gh/homarr-labs/dashboard-icons'
const DI_METADATA_URL = 'https://raw.githubusercontent.com/homarr-labs/dashboard-icons/main/metadata.json'
const METADATA_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000
const MATCH_THRESHOLD = 60

export const SIMPLE_ICON_ROUTE = '/api/icons/si'
const SI_PREFIX = 'si:'

// Aliases in dashboard-icons metadata are often descriptions ("Password
// Manager", "status-page"). These generic ones never identify a product.
const GENERIC_ALIASES = new Set([
  'dashboard', 'homepage', 'router', 'firewall', 'music', 'wiki', 'linux', 'azure', 'kubernetes',
  'policy', 'lakehouse', 'kawaii', 'browser', 'server', 'cloud', 'docker', 'proxy', 'video', 'media',
  'monitor', 'storage', 'backup', 'notes', 'chat', 'email', 'mail', 'search', 'files', 'photos', 'books',
  'games', 'tools', 'admin', 'status', 'finance', 'budget', 'recipes', 'social', 'forum', 'office',
].map(normalize))

export function dashboardIconUrl(name, format = 'svg') {
  return `${DI_CDN}/${format}/${name}.${format}`
}

export function simpleIconUrl(slug) {
  return `${SIMPLE_ICON_ROUTE}/${slug}.svg`
}

function sharesPrefix(a, b, length) {
  return a.length >= length && b.length >= length && a.slice(0, length) === b.slice(0, length)
}

/**
 * Build a searchable icon index.
 * @param {object} sources
 * @param {object} [sources.dashboardIcons] dashboard-icons metadata.json contents
 * @param {Array}  [sources.simpleIcons]    simple-icons data/simple-icons.json contents
 */
export function createIconIndex({ dashboardIcons = {}, simpleIcons = [] } = {}) {
  const icons = []
  const byName = new Map()
  const bySlug = new Map()
  const keys = new Map()

  const addKey = (key, entry, score) => {
    if (!key) return
    const list = keys.get(key) || []
    if (list.some(hit => hit.entry === entry)) return
    list.push({ entry, score })
    list.sort((a, b) => b.score - a.score)
    keys.set(key, list)
  }

  const diEntries = dashboardIcons && typeof dashboardIcons === 'object' && !Array.isArray(dashboardIcons)
    ? Object.entries(dashboardIcons)
    : []

  // Count how many icons share each alias, ambiguous ones are skipped
  const aliasUse = new Map()
  for (const [, meta] of diEntries) {
    for (const alias of meta?.aliases || []) {
      const key = normalize(alias)
      aliasUse.set(key, (aliasUse.get(key) || 0) + 1)
    }
  }

  for (const [name, meta = {}] of diEntries) {
    const format = ['svg', 'png', 'webp'].includes(meta.base) ? meta.base : 'png'
    const light = meta.colors?.light
    // "-light" variants are the light-coloured versions, made for dark backgrounds
    const display = light || name
    const entry = {
      name,
      source: 'dashboard-icons',
      title: null,
      aliases: Array.isArray(meta.aliases) ? meta.aliases : [],
      categories: Array.isArray(meta.categories) ? meta.categories : [],
      format,
      url: dashboardIconUrl(display, format),
    }
    icons.push(entry)
    byName.set(name, entry)

    const variants = [meta.colors?.light, meta.colors?.dark, meta.wordmark?.light, meta.wordmark?.dark]
    for (const variant of variants) {
      if (variant && variant !== name && !byName.has(variant)) {
        byName.set(variant, { ...entry, name: variant, url: dashboardIconUrl(variant, format), variantOf: name })
      }
    }

    const nameKey = normalize(name)
    addKey(nameKey, entry, 100)

    for (const alias of entry.aliases) {
      const key = normalize(alias)
      if (key.length < 4 || GENERIC_ALIASES.has(key)) continue
      const productLike = !/[\s_-]/.test(alias.trim()) && aliasUse.get(key) === 1
      if (productLike || sharesPrefix(key, nameKey, 4)) addKey(key, entry, 88)
    }
  }

  for (const icon of Array.isArray(simpleIcons) ? simpleIcons : []) {
    if (!icon?.slug) continue
    const entry = {
      name: `${SI_PREFIX}${icon.slug}`,
      slug: icon.slug,
      source: 'simple-icons',
      title: icon.title || icon.slug,
      hex: icon.hex || null,
      aliases: icon.aliases?.aka || [],
      categories: [],
      format: 'svg',
      url: simpleIconUrl(icon.slug),
    }
    icons.push(entry)
    bySlug.set(icon.slug, entry)
    addKey(normalize(icon.slug), entry, 96)
    addKey(normalize(icon.title), entry, 95)
    for (const alias of entry.aliases) {
      const key = normalize(alias)
      if (key.length >= 4 && !GENERIC_ALIASES.has(key)) addKey(key, entry, 86)
    }
  }

  // Curated abbreviations win over everything ("npm" means Nginx Proxy
  // Manager on a homelab dashboard, not the package manager)
  for (const [abbreviation, app] of Object.entries(APP_ABBREVIATIONS)) {
    const target = byName.get(app)
    if (target) addKey(normalize(abbreviation), target, 101)
  }

  // Strong keys (names, slugs, titles) used for prefix and typo matching
  const fuzzyKeys = []
  for (const [key, hits] of keys) {
    if (key.length >= 4 && hits[0].score >= 95 && hits[0].score <= 100) fuzzyKeys.push([key, hits[0].entry])
  }

  return {
    icons,
    byName,
    bySlug,
    keys,
    fuzzyKeys,
    size: icons.length,
    matchCache: new Map(),
  }
}

/**
 * Find the best icon for a set of texts (service name, hostnames, ...).
 * @param {object} index
 * @param {Array<{text: string, weight?: number}>} sources
 * @returns {{ entry: object, score: number, match: string } | null}
 */
export function matchIcon(index, sources) {
  const cacheKey = JSON.stringify(sources)
  if (index.matchCache.has(cacheKey)) return index.matchCache.get(cacheKey)

  let best = null
  const consider = (entry, score, match) => {
    if (!best || score > best.score) best = { entry, score, match }
  }

  const fullCandidates = []
  for (const { text, weight = 1 } of sources) {
    if (!text) continue
    for (const candidate of candidatesFor(text)) {
      const generic = GENERIC_WORDS.has(candidate.key)
      if (candidate.kind !== 'full' && (candidate.key.length < 4 || generic || AMBIGUOUS_NAMES.has(candidate.key))) continue
      const hits = index.keys.get(candidate.key)
      // Generic words ("photos", "torrent") only match an icon of that exact name
      const hit = hits && (generic ? hits.find(h => h.score >= 95) : hits[0])
      if (hit) consider(hit.entry, hit.score * candidate.weight * weight, candidate.key)
      if (candidate.kind === 'full' && candidate.key.length >= 5 && !generic) {
        fullCandidates.push({ ...candidate, weight: candidate.weight * weight })
      }
    }
  }

  // Prefix and typo matches only when nothing matched exactly
  if (!best || best.score < 75) {
    for (const candidate of fullCandidates) {
      for (const [key, entry] of index.fuzzyKeys) {
        if (key.startsWith(candidate.key) && candidate.key.length / key.length >= 0.6) {
          // "paperless" -> "paperless-ngx"
          consider(entry, 72 * (candidate.key.length / key.length) * candidate.weight + 10, key)
        } else if (candidate.key.startsWith(key) && key.length >= 5 && key.length / candidate.key.length >= 0.6) {
          // "jellyfinmedia" -> "jellyfin"
          consider(entry, 70 * (key.length / candidate.key.length) * candidate.weight + 8, key)
        } else if (candidate.key.length >= 7) {
          const maxDistance = candidate.key.length >= 10 ? 2 : 1
          if (editDistance(candidate.key, key, maxDistance) <= maxDistance) {
            // "jelyfin" -> "jellyfin"
            consider(entry, 65 * candidate.weight, key)
          }
        }
      }
    }
  }

  const result = best && best.score >= MATCH_THRESHOLD ? best : null
  if (index.matchCache.size > 2000) index.matchCache.clear()
  index.matchCache.set(cacheKey, result)
  return result
}

function isCustomUrl(value) {
  return /^https?:\/\//i.test(value) || value.startsWith('/uploads/')
}

/**
 * Resolve an icon value the user picked (name, "si:slug", or URL).
 */
export function resolveIconValue(index, value) {
  if (typeof value !== 'string' || !value.trim()) return null
  const icon = value.trim()

  if (isCustomUrl(icon)) {
    return { url: icon, source: 'custom', name: icon, categories: [] }
  }

  if (icon.toLowerCase().startsWith(SI_PREFIX)) {
    const entry = index.bySlug.get(icon.slice(SI_PREFIX.length).toLowerCase())
    return entry ? toResult(entry) : null
  }

  const exact = index.byName.get(icon) || index.byName.get(icon.toLowerCase())
  if (exact) return toResult(exact)

  const slug = index.bySlug.get(icon.toLowerCase())
  if (slug) return toResult(slug)

  const matched = matchIcon(index, [{ text: icon }])
  if (matched) return toResult(matched.entry)

  // Metadata unavailable (offline build): fall back to a best guess, the
  // dashboard shows initials if the image fails to load
  if (index.size === 0 && /^[a-z0-9][a-z0-9._-]{0,99}$/i.test(icon) && !icon.includes('..')) {
    return { url: dashboardIconUrl(icon.toLowerCase(), 'svg'), source: 'dashboard-icons', name: icon, categories: [] }
  }

  return null
}

function toResult(entry) {
  return {
    url: entry.url,
    source: entry.source,
    name: entry.name,
    categories: entry.categories || [],
  }
}

export function generateInitials(name) {
  if (!name) return '??'
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map(word => word[0])
    .join('')
    .substring(0, 2)
    .toUpperCase()
}

/**
 * Resolve the icon for a service: the configured icon, or an automatic match
 * on its name and hostnames.
 * @param {object} index
 * @param {object} service   { name, icon }
 * @param {string[]} hostnames domain(s) and forward host, used for auto-matching
 */
export function resolveServiceIcon(index, service, hostnames = []) {
  let result = resolveIconValue(index, service.icon)
  let auto = false

  if (!result) {
    const sources = [{ text: service.name, weight: 1 }]
    hostnames.forEach((host, i) => {
      const label = hostLabel(host)
      if (label) sources.push({ text: label, weight: i === 0 ? 0.97 : 0.92 })
    })
    const matched = matchIcon(index, sources)
    if (matched) {
      result = toResult(matched.entry)
      auto = true
    }
  }

  return {
    iconUrl: result?.url || null,
    iconSource: result?.source || null,
    iconName: result?.name || null,
    iconAuto: auto,
    iconCategories: result?.categories || [],
    fallbackInitials: generateInitials(service.name),
  }
}

// ---------------------------------------------------------------------------
// Runtime state: metadata loading and refreshing
// ---------------------------------------------------------------------------

let currentIndex = createIconIndex()
let simpleIconsDir = null
let simpleIconsData = []
let refreshing = null
const svgCache = new Map()

export function getIconIndex() {
  return currentIndex
}

async function loadSimpleIcons() {
  try {
    simpleIconsDir = path.dirname(require.resolve('simple-icons'))
    const text = await fs.readFile(path.join(simpleIconsDir, 'data', 'simple-icons.json'), 'utf-8')
    const data = JSON.parse(text)
    return Array.isArray(data) ? data : data.icons || []
  } catch (error) {
    console.warn('Could not load simple-icons metadata:', error.message)
    return []
  }
}

const METADATA_CACHE_PATH = path.join(PATHS.cache, 'dashboard-icons-metadata.json')
const METADATA_LOCATIONS = [
  METADATA_CACHE_PATH,
  path.join(ROOT_DIR, 'server', 'vendor', 'dashboard-icons-metadata.json'),
  path.join(ROOT_DIR, 'dist', 'dashboard-icons-metadata.json'),
]

function isValidMetadata(data) {
  return data && typeof data === 'object' && !Array.isArray(data) && Object.keys(data).length > 100
}

async function loadLocalMetadata() {
  let newest = null
  for (const location of METADATA_LOCATIONS) {
    try {
      const [stat, text] = await Promise.all([fs.stat(location), fs.readFile(location, 'utf-8')])
      const data = JSON.parse(text)
      if (isValidMetadata(data) && (!newest || stat.mtimeMs > newest.mtimeMs)) {
        newest = { data, mtimeMs: stat.mtimeMs, location }
      }
    } catch {
      // Missing or unreadable, try the next location
    }
  }
  return newest
}

async function downloadMetadata() {
  const response = await fetch(DI_METADATA_URL, { signal: AbortSignal.timeout(30000) })
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  const data = await response.json()
  if (!isValidMetadata(data)) throw new Error('Unexpected metadata format')
  await writeJsonAtomic(METADATA_CACHE_PATH, data)
  return data
}

function rebuild(dashboardIcons) {
  currentIndex = createIconIndex({ dashboardIcons, simpleIcons: simpleIconsData })
  const di = currentIndex.icons.filter(i => i.source === 'dashboard-icons').length
  console.log(`✓ Icon index: ${di} dashboard-icons, ${currentIndex.bySlug.size} simple-icons`)
}

/**
 * Load icon metadata. Downloads fresh dashboard-icons metadata in the
 * background when the local copy is missing or older than a week (disable
 * with ICON_METADATA_REFRESH=false).
 */
export async function initIcons() {
  simpleIconsData = await loadSimpleIcons()
  const local = await loadLocalMetadata()
  rebuild(local?.data || {})

  const refreshEnabled = process.env.ICON_METADATA_REFRESH !== 'false'
  const stale = !local || Date.now() - local.mtimeMs > METADATA_MAX_AGE_MS
  if (refreshEnabled && stale) {
    refreshMetadata().catch(() => {})
  }
  if (refreshEnabled) {
    setInterval(async () => {
      const latest = await loadLocalMetadata()
      if (!latest || Date.now() - latest.mtimeMs > METADATA_MAX_AGE_MS) refreshMetadata().catch(() => {})
    }, 24 * 60 * 60 * 1000).unref()
  }
}

export function refreshMetadata() {
  if (!refreshing) {
    refreshing = downloadMetadata()
      .then(data => {
        rebuild(data)
        return true
      })
      .catch(error => {
        console.warn('Could not download dashboard-icons metadata:', error.message)
        throw error
      })
      .finally(() => { refreshing = null })
  }
  return refreshing
}

function relativeLuminance(hex) {
  const channels = [0, 2, 4].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map(c => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2]
}

/**
 * Simple Icons ship as black glyphs. Render them in their brand colour, or in
 * near-white when the brand colour would vanish on the dark dashboard.
 */
export async function renderSimpleIcon(slug) {
  if (svgCache.has(slug)) return svgCache.get(slug)
  const entry = currentIndex.bySlug.get(slug)
  if (!entry || !simpleIconsDir) return null

  const svg = await fs.readFile(path.join(simpleIconsDir, 'icons', `${entry.slug}.svg`), 'utf-8')
  const hex = /^[0-9a-f]{6}$/i.test(entry.hex || '') ? entry.hex : 'f2f2f2'
  const fill = relativeLuminance(hex) < 0.06 ? 'f2f2f2' : hex
  const colored = svg.replace('<svg ', `<svg fill="#${fill}" `)
  svgCache.set(slug, colored)
  return colored
}

/**
 * Express handler for SIMPLE_ICON_ROUTE/:file
 */
export async function simpleIconHandler(req, res) {
  const slug = String(req.params.file || '').replace(/\.svg$/i, '').toLowerCase()
  try {
    const svg = await renderSimpleIcon(slug)
    if (!svg) return res.status(404).end()
    res.set('Content-Type', 'image/svg+xml')
    res.set('Cache-Control', 'public, max-age=604800')
    res.send(svg)
  } catch (error) {
    console.error('Failed to render simple icon:', error.message)
    res.status(500).end()
  }
}

/**
 * Icon list for the admin icon browser
 */
export function listIcons() {
  return currentIndex.icons.map(icon => ({
    name: icon.name,
    source: icon.source,
    title: icon.title,
    categories: icon.categories,
    aliases: icon.aliases,
    url: icon.url,
  }))
}
