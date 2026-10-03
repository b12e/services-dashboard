/**
 * Category registry (data/categories.json)
 *
 * File format (version 2):
 *   {
 *     "version": 2,
 *     "seeded": ["media", ...],          built-in keys that were ever created
 *     "categories": [
 *       { "id", "name", "visible", "autoKey"?, "createdAt", "updatedAt"? }
 *     ]
 *   }
 *
 * - `name` is what the dashboard shows, users can rename freely.
 * - `autoKey` links a category to a built-in auto-categorization rule.
 * - Auto-categorization is computed on every request and never written to
 *   disk. Deleting a category is permanent: it is not recreated behind the
 *   user's back (older versions recreated it on the next page load).
 * - Services reference categories by id. A service without `categoryIds`
 *   is auto-categorized, `categoryIds: []` means "no category".
 */

import crypto from 'crypto'
import { BUILTIN_CATEGORIES, BUILTIN_BY_KEY, builtinKeyForName } from './taxonomy.js'
import { PATHS, readJson, writeJsonAtomic, getMtime } from './storage.js'

export const REGISTRY_VERSION = 2

function newId() {
  return `cat_${crypto.randomBytes(8).toString('hex')}`
}

export function normalizeName(name) {
  return String(name ?? '').trim().toLowerCase()
}

function now() {
  return new Date().toISOString()
}

function isRegistry(data) {
  return data && typeof data === 'object' && !Array.isArray(data) && Array.isArray(data.categories)
}

function builtinCategory(key, existingIds) {
  const builtin = BUILTIN_BY_KEY.get(key)
  let id = `cat_${key}`
  while (existingIds.has(id)) id = newId()
  existingIds.add(id)
  return { id, name: builtin.label, visible: true, autoKey: key, createdAt: now() }
}

/**
 * Add built-in categories that were never seeded (new installs, or built-ins
 * added in a later version). Mutates and returns whether anything changed.
 */
function seedBuiltins(registry) {
  const seeded = new Set(registry.seeded || [])
  const linked = new Set(registry.categories.map(c => c.autoKey).filter(Boolean))
  const ids = new Set(registry.categories.map(c => c.id))
  let changed = false

  for (const { key } of BUILTIN_CATEGORIES) {
    if (seeded.has(key)) continue
    seeded.add(key)
    changed = true
    if (linked.has(key)) continue
    // Link an existing category with the same name instead of duplicating it
    const sameName = registry.categories.find(c => !c.autoKey && builtinKeyForName(c.name) === key)
    if (sameName) {
      sameName.autoKey = key
    } else {
      registry.categories.push(builtinCategory(key, ids))
    }
  }

  registry.seeded = [...seeded]
  return changed
}

/**
 * Migrate categories and category references from older versions.
 *
 * Older versions created a category for every name they ever auto-detected,
 * including the inconsistent icon-metadata ones ("tools", "Developer-Tools",
 * "media", "Media-Servers", "Other", ...), and froze those into services
 * whenever a service was edited. This folds them into the built-ins:
 *   - "Other" is dropped. Older versions saved whatever was auto-detected
 *     when a service was edited, so a service that only had "Other" goes
 *     back to automatic categorization
 *   - unconfigured categories that map to a built-in are merged into it
 *   - unconfigured, unreferenced categories are dropped
 *   - categories the user created, renamed or toggled are kept
 *
 * Pure function: returns new data, does not touch the disk.
 *
 * @param {Array|object|null} stored         categories.json contents
 * @param {object} servicesData             { manualServices, overrides }
 * @param {Array} [configCategories]        config.json `categories` (oldest format)
 * @returns {{ registry: object, servicesData: object, changed: boolean, servicesChanged: boolean }}
 */
export function migrateRegistry(stored, servicesData, configCategories = []) {
  const services = structuredClone(servicesData || { manualServices: [], overrides: {} })
  services.manualServices = Array.isArray(services.manualServices) ? services.manualServices : []
  services.overrides = services.overrides && typeof services.overrides === 'object' ? services.overrides : {}

  if (isRegistry(stored)) {
    const registry = structuredClone(stored)
    registry.version = REGISTRY_VERSION
    const changed = seedBuiltins(registry)
    return { registry, servicesData: services, changed, servicesChanged: false }
  }

  // --- Collect legacy entries -------------------------------------------
  const entries = []
  const byName = new Map()
  const aliasOf = new Map() // duplicate id -> id of the entry with the same name
  const addEntry = (raw, defaults = {}) => {
    if (!raw?.name || typeof raw.name !== 'string') return null
    const key = normalizeName(raw.name)
    if (byName.has(key)) {
      const existing = byName.get(key)
      if (typeof raw.id === 'string' && raw.id !== existing.id) aliasOf.set(raw.id, existing.id)
      if (raw.configured === true || defaults.configured === true) existing.configured = true
      return existing
    }
    const entry = {
      id: typeof raw.id === 'string' && raw.id ? raw.id : newId(),
      name: raw.name.trim(),
      displayName: (raw.displayName || raw.name).trim(),
      visible: raw.visible !== false,
      configured: raw.configured === true || raw.source === 'manual' || defaults.configured === true,
      createdAt: raw.createdAt || now(),
      refs: 0,
    }
    entries.push(entry)
    byName.set(key, entry)
    return entry
  }

  for (const raw of Array.isArray(stored) ? stored : []) addEntry(raw)
  for (const raw of Array.isArray(configCategories) ? configCategories : []) addEntry(raw, { configured: true })

  // Owners of category references: manual services and NPM overrides
  const owners = [...services.manualServices, ...Object.values(services.overrides)].filter(o => o && typeof o === 'object')

  for (const owner of owners) {
    // Oldest formats referenced categories by name
    const names = []
    if (typeof owner.category === 'string' && owner.category.trim()) names.push(owner.category)
    if (Array.isArray(owner.categories)) names.push(...owner.categories.filter(n => typeof n === 'string'))
    if (names.length > 0) {
      const ids = names.map(name => addEntry({ name }, { configured: true })).filter(Boolean).map(e => e.id)
      owner.categoryIds = [...new Set([...(Array.isArray(owner.categoryIds) ? owner.categoryIds : []), ...ids])]
    }
    delete owner.category
    delete owner.categories

    if (Array.isArray(owner.categoryIds)) {
      // An empty list used to mean "auto-detect"
      if (owner.categoryIds.length === 0) delete owner.categoryIds
      else owner.categoryIds = [...new Set(owner.categoryIds.map(id => aliasOf.get(id) || id))]
    }
  }

  const byId = new Map(entries.map(e => [e.id, e]))
  for (const owner of owners) {
    for (const id of Array.isArray(owner.categoryIds) ? owner.categoryIds : []) {
      if (byId.has(id)) byId.get(id).refs++
    }
  }

  // --- Decide what survives ---------------------------------------------
  const remap = new Map() // old id -> new id, or null to drop the reference
  const kept = []

  const groups = new Map()
  for (const entry of entries) {
    if (normalizeName(entry.name) === 'other' || normalizeName(entry.displayName) === 'other') {
      remap.set(entry.id, null)
      continue
    }
    const key = builtinKeyForName(entry.name) || builtinKeyForName(entry.displayName)
    if (key) {
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key).push(entry)
    } else if (entry.configured || entry.refs > 0) {
      kept.push({ ...entry, autoKey: null, name: entry.displayName })
    } else {
      remap.set(entry.id, null)
    }
  }

  for (const [key, group] of groups) {
    const label = BUILTIN_BY_KEY.get(key).label
    const rank = e => (e.configured ? 4 : 0)
      + (normalizeName(e.displayName) === normalizeName(label) ? 2 : 0)
      + (e.refs > 0 ? 1 : 0)
    const [winner, ...rest] = [...group].sort((a, b) => rank(b) - rank(a) || b.refs - a.refs)

    // Uncustomized categories get the new, readable built-in name
    const customized = winner.configured && winner.displayName !== winner.name
    kept.push({ ...winner, autoKey: key, name: customized || winner.configured ? winner.displayName : label })

    for (const entry of rest) {
      if (entry.configured) {
        kept.push({ ...entry, autoKey: null, name: entry.displayName })
      } else {
        remap.set(entry.id, winner.id)
      }
    }
  }

  // Unique names, preferring the first kept entry
  const usedNames = new Set()
  const categories = []
  for (const entry of kept) {
    let name = entry.name
    let n = 2
    while (usedNames.has(normalizeName(name))) name = `${entry.name} (${n++})`
    usedNames.add(normalizeName(name))
    const category = { id: entry.id, name, visible: entry.visible, createdAt: entry.createdAt }
    if (entry.autoKey) category.autoKey = entry.autoKey
    categories.push(category)
  }

  const registry = { version: REGISTRY_VERSION, seeded: [], categories }
  seedBuiltins(registry)

  // --- Rewrite references -----------------------------------------------
  const validIds = new Set(categories.map(c => c.id))
  for (const owner of owners) {
    if (!Array.isArray(owner.categoryIds)) continue
    const mapped = owner.categoryIds
      .map(id => (remap.has(id) ? remap.get(id) : id))
      .filter(id => id && validIds.has(id))
    if (mapped.length > 0) owner.categoryIds = [...new Set(mapped)]
    else delete owner.categoryIds
  }

  return { registry, servicesData: services, changed: true, servicesChanged: true }
}

// ---------------------------------------------------------------------------
// Runtime access
// ---------------------------------------------------------------------------

let cache = { mtime: -1, registry: null }

/**
 * Load the registry. Reloads when the file changed on disk, so edits made by
 * another process are picked up immediately. A legacy file is migrated in
 * memory only, ensureRegistry() persists the migration.
 */
export async function loadRegistry() {
  const mtime = await getMtime(PATHS.categories)
  if (cache.registry && cache.mtime === mtime) return cache.registry

  const stored = await readJson(PATHS.categories, null)
  let registry
  if (isRegistry(stored)) {
    registry = stored
  } else {
    const servicesData = await readJson(PATHS.services, { manualServices: [], overrides: {} })
    registry = migrateRegistry(stored, servicesData).registry
  }
  cache = { mtime, registry }
  return registry
}

export async function saveRegistry(registry) {
  await writeJsonAtomic(PATHS.categories, registry)
  cache = { mtime: await getMtime(PATHS.categories), registry }
}

export function indexRegistry(registry) {
  const byId = new Map()
  const byAutoKey = new Map()
  const byName = new Map()
  for (const category of registry.categories) {
    byId.set(category.id, category)
    if (category.autoKey && !byAutoKey.has(category.autoKey)) byAutoKey.set(category.autoKey, category)
    byName.set(normalizeName(category.name), category)
  }
  return { byId, byAutoKey, byName }
}

/**
 * Pick the auto key for a new or renamed category: reuse the built-in rule
 * when the name matches a built-in that no other category is linked to.
 */
export function autoKeyForNewName(registry, name, excludeId = null) {
  const key = builtinKeyForName(name)
  if (!key) return null
  const taken = registry.categories.some(c => c.autoKey === key && c.id !== excludeId)
  return taken ? null : key
}

export function createCategoryEntry(registry, name) {
  const category = {
    id: newId(),
    name: name.trim(),
    visible: true,
    createdAt: now(),
  }
  const autoKey = autoKeyForNewName(registry, name)
  if (autoKey) category.autoKey = autoKey
  return category
}

/**
 * Recreate deleted built-in categories. Returns the number restored.
 */
export function restoreBuiltins(registry) {
  const linked = new Set(registry.categories.map(c => c.autoKey).filter(Boolean))
  const ids = new Set(registry.categories.map(c => c.id))
  const names = new Set(registry.categories.map(c => normalizeName(c.name)))
  let restored = 0
  for (const { key, label } of BUILTIN_CATEGORIES) {
    if (linked.has(key)) continue
    const sameName = registry.categories.find(c => !c.autoKey && normalizeName(c.name) === normalizeName(label))
    if (sameName) {
      sameName.autoKey = key
    } else {
      const category = builtinCategory(key, ids)
      if (names.has(normalizeName(category.name))) continue
      registry.categories.push(category)
    }
    restored++
  }
  return restored
}

export function builtinLabel(key) {
  return BUILTIN_BY_KEY.get(key)?.label || null
}
