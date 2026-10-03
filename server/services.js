/**
 * Services: manual services and NPM overrides (data/services.json), merged
 * with NPM discovery, auto-categorization and icon resolution.
 *
 * services.json:
 *   {
 *     "manualServices": [{ "id", "name", "url", "appendBaseDomain", "icon",
 *                          "description", "categoryIds", "hidden" }],
 *     "overrides": { "npm:<domain>": { "name", "description", "icon",
 *                                      "categoryIds", "hidden" } }
 *   }
 * Older override keys ("npm_<proxy host id>") are still read.
 */

import crypto from 'crypto'
import { PATHS, readJson, writeJsonAtomic, withFileLock, backupFile } from './storage.js'
import { loadConfig, normalizeBaseDomain } from './config.js'
import { getNpmServices } from './npm.js'
import { getIconIndex, resolveServiceIcon } from './icons.js'
import { autoCategorize } from './categorize.js'
import { loadRegistry, saveRegistry, migrateRegistry, indexRegistry } from './categories.js'

export const OVERRIDE_FIELDS = ['name', 'description', 'icon', 'categoryIds', 'hidden']

export function newServiceId() {
  return `svc_${crypto.randomBytes(6).toString('hex')}`
}

export async function loadServicesData() {
  const data = await readJson(PATHS.services, null)
  // The original format kept a flat "services" list
  const manual = data?.manualServices ?? data?.services
  return {
    manualServices: Array.isArray(manual) ? manual : [],
    overrides: data?.overrides && typeof data.overrides === 'object' ? data.overrides : {},
  }
}

export async function saveServicesData({ manualServices, overrides }) {
  await writeJsonAtomic(PATHS.services, {
    manualServices: Array.isArray(manualServices) ? manualServices : [],
    overrides: overrides && typeof overrides === 'object' ? overrides : {},
  })
}

export function npmOverrideKey(domain) {
  return `npm:${domain}`
}

/**
 * Find the override for an NPM service, falling back to the legacy key
 */
export function findOverride(overrides, npmService) {
  const key = npmOverrideKey(npmService.domain)
  if (overrides[key]) return { key, override: overrides[key] }
  const legacyKey = `npm_${npmService.npmId}`
  if (overrides[legacyKey]) return { key: legacyKey, override: overrides[legacyKey] }
  return { key: null, override: null }
}

/**
 * Build the final link for a service.
 * - appendBaseDomain (default true for manual services): "plex" -> "https://plex.example.com"
 * - otherwise the URL is used as-is, "https://" is added when missing
 * Only http(s) links are allowed. Returns null when no valid link results.
 */
export function buildHref(service, baseUrl) {
  const base = normalizeBaseDomain(baseUrl)
  let raw = String(service.url || '').trim()
  const hasScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw)

  if (service.appendBaseDomain !== false && base && !hasScheme) {
    if (raw) {
      const slash = raw.indexOf('/')
      const host = slash === -1 ? raw : raw.slice(0, slash)
      const rest = slash === -1 ? '' : raw.slice(slash)
      raw = `${host.replace(/\.+$/, '')}.${base}${rest}`
    } else {
      raw = base
    }
  } else if (!raw) {
    raw = base
  }

  if (!raw) return null
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(raw)) raw = `https://${raw}`

  try {
    const url = new URL(raw)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
    return raw
  } catch {
    return null
  }
}

function hostnameOf(href) {
  try {
    return new URL(href).hostname.toLowerCase()
  } catch {
    return null
  }
}

/**
 * Merge manual services and NPM services with their overrides.
 */
async function collectServices(config) {
  const { manualServices, overrides } = await loadServicesData()
  const items = []

  manualServices.forEach((service, index) => {
    if (!service || typeof service !== 'object') return
    items.push({
      ...service,
      id: service.id || `manual_${index}`,
      source: 'manual',
      hidden: service.hidden === true,
      categoryIds: Array.isArray(service.categoryIds) ? service.categoryIds : undefined,
      hostnames: [],
    })
  })

  const manualHosts = new Set(items.map(item => hostnameOf(buildHref(item, config.baseUrl))).filter(Boolean))
  const npmServices = await getNpmServices(config)

  for (const npm of npmServices) {
    // A manual service for the same host wins over the discovered one
    if (manualHosts.has(npm.domain)) continue
    const { key: overrideKey, override } = findOverride(overrides, npm)
    const o = override || {}
    items.push({
      id: npmOverrideKey(npm.domain),
      source: 'npm',
      name: o.name || npm.name,
      description: o.description,
      url: npm.url,
      appendBaseDomain: false,
      icon: o.icon || null,
      hidden: o.hidden === true,
      categoryIds: Array.isArray(o.categoryIds) ? o.categoryIds : undefined,
      hostnames: [...npm.domains.slice(1), npm.forwardHost].filter(Boolean),
      npm: {
        name: npm.name,
        url: npm.url,
        domains: npm.domains,
        forwardHost: npm.forwardHost,
        forwardPort: npm.forwardPort,
        connection: npm.connection,
        overrideKey,
        hasOverrides: !!override && OVERRIDE_FIELDS.some(f => override[f] !== undefined),
      },
    })
  }

  return items
}

/**
 * Build the full list of services with links, icons and categories.
 * @param {object}  [options]
 * @param {boolean} [options.admin=false] include hidden services and admin-only details
 */
export async function buildServices({ admin = false } = {}) {
  const config = await loadConfig()
  const [items, registry] = await Promise.all([collectServices(config), loadRegistry()])
  const { byId, byAutoKey } = indexRegistry(registry)
  const iconIndex = getIconIndex()

  const results = []
  for (const item of items) {
    if (item.hidden && !admin) continue

    const href = buildHref(item, config.baseUrl)
    const hostnames = [hostnameOf(href), ...item.hostnames].filter(Boolean)
    const icon = resolveServiceIcon(iconIndex, item, hostnames)
    const auto = autoCategorize({
      name: item.name,
      description: item.description,
      hostnames,
      iconName: icon.iconName,
      iconCategories: icon.iconCategories,
    })
    const autoCategory = auto ? byAutoKey.get(auto.key) : null
    const explicitIds = Array.isArray(item.categoryIds) ? item.categoryIds.filter(id => byId.has(id)) : null
    const categoryIds = explicitIds ?? (autoCategory ? [autoCategory.id] : [])

    const visibleIds = categoryIds.filter(id => byId.get(id)?.visible !== false)
    const service = {
      id: item.id,
      source: item.source,
      name: item.name || hostnames[0] || 'Unnamed service',
      description: item.description || undefined,
      href,
      url: item.url,
      appendBaseDomain: item.appendBaseDomain,
      icon: item.icon || undefined,
      iconUrl: icon.iconUrl,
      fallbackInitials: icon.fallbackInitials,
      categoryIds: admin ? categoryIds : visibleIds,
      categories: (admin ? categoryIds : visibleIds).map(id => byId.get(id).name),
    }

    if (admin) {
      Object.assign(service, {
        hidden: item.hidden,
        categoriesAuto: explicitIds === null,
        autoCategory: auto ? {
          id: autoCategory?.id || null,
          key: auto.key,
          source: auto.source,
          match: auto.match,
        } : null,
        iconName: icon.iconName,
        iconAuto: icon.iconAuto,
        iconSource: icon.iconSource,
        npm: item.npm,
      })
    }

    results.push(service)
  }

  return results
}

/**
 * Category list with service counts.
 * Public: visible categories that contain at least one visible service.
 */
export async function buildCategories(services, { admin = false } = {}) {
  const registry = await loadRegistry()
  const counts = new Map()
  for (const service of services) {
    if (service.hidden) continue
    for (const id of service.categoryIds) counts.set(id, (counts.get(id) || 0) + 1)
  }

  return registry.categories
    .filter(category => admin || (category.visible !== false && counts.get(category.id) > 0))
    .map(category => ({
      id: category.id,
      name: category.name,
      displayName: category.name,
      visible: category.visible !== false,
      autoKey: category.autoKey || null,
      serviceCount: counts.get(category.id) || 0,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
}

/**
 * Validate and clean a service payload from the admin UI.
 * @returns {{ value?: object, error?: string }}
 */
export function sanitizeServiceInput(body, { npm = false } = {}) {
  if (!body || typeof body !== 'object') return { error: 'Invalid payload' }
  const value = {}
  const str = (v, max = 500) => (typeof v === 'string' ? v.trim().slice(0, max) : undefined)

  const name = str(body.name, 200)
  if (!npm && !name) return { error: 'Name is required' }
  if (name !== undefined) value.name = name

  const description = str(body.description, 1000)
  if (description) value.description = description

  const icon = str(body.icon, 2000)
  if (icon) value.icon = icon

  if (body.categoryIds === null) {
    value.categoryIds = null // back to auto-detection
  } else if (Array.isArray(body.categoryIds)) {
    value.categoryIds = [...new Set(body.categoryIds.filter(id => typeof id === 'string'))]
  }

  if (typeof body.hidden === 'boolean') value.hidden = body.hidden

  if (!npm) {
    const url = str(body.url, 2000)
    if (!url) return { error: 'URL is required' }
    value.url = url
    value.appendBaseDomain = body.appendBaseDomain !== false
  }

  return { value }
}

/**
 * One-time data upgrades, run at startup:
 *   - migrate categories.json to version 2 (see categories.js)
 *   - give manual services a stable id (they used to be addressed by index)
 * Backups of the original files are written next to them.
 */
export async function migrateData() {
  return withFileLock('data', async () => {
    const [stored, servicesData, config] = await Promise.all([
      readJson(PATHS.categories, null),
      loadServicesData(),
      readJson(PATHS.config, {}),
    ])

    const configCategories = Array.isArray(config?.categories) ? config.categories : []
    const { registry, servicesData: migrated, changed, servicesChanged } =
      migrateRegistry(stored, servicesData, configCategories)

    let idsAdded = false
    for (const service of migrated.manualServices) {
      if (service && typeof service === 'object' && !service.id) {
        service.id = newServiceId()
        idsAdded = true
      }
    }

    const legacy = stored !== null && !Array.isArray(stored?.categories)
    if (servicesChanged || idsAdded) {
      if (legacy || configCategories.length > 0) await backupFile(PATHS.services, 'pre-v2')
      await saveServicesData(migrated)
    }
    if (changed) {
      if (legacy) await backupFile(PATHS.categories, 'pre-v2')
      await saveRegistry(registry)
      if (legacy) console.log(`✓ Migrated categories.json to version 2 (${registry.categories.length} categories)`)
    }
    if (config && Object.hasOwn(config, 'categories')) {
      const { categories, ...rest } = config
      await writeJsonAtomic(PATHS.config, rest)
    }
  })
}
