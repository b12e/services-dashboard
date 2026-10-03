import { test } from 'node:test'
import assert from 'node:assert/strict'
import { migrateRegistry, restoreBuiltins, createCategoryEntry } from '../server/categories.js'
import { BUILTIN_CATEGORIES } from '../server/taxonomy.js'

const legacy = [
  { id: 'cat_media', name: 'Media', displayName: 'Media', visible: true, configured: false, source: 'auto' },
  { id: 'cat_media2', name: 'media', displayName: 'media', visible: true, configured: false, source: 'icon-metadata' },
  { id: 'cat_mediaservers', name: 'Media-Servers', displayName: 'Media-Servers', visible: true, configured: false, source: 'auto' },
  { id: 'cat_dl', name: 'Download-Managers', displayName: 'Download-Managers', visible: false, configured: true, source: 'auto' },
  { id: 'cat_tools', name: 'tools', displayName: 'tools', visible: true, configured: false, source: 'auto' },
  { id: 'cat_other', name: 'Other', displayName: 'Other', visible: true, configured: false, source: 'auto' },
  { id: 'cat_mine', name: 'Family', displayName: 'Family Stuff', visible: true, configured: true, source: 'manual' },
  { id: 'cat_ecom', name: 'E-commerce-Platforms', displayName: 'E-commerce-Platforms', visible: true, configured: false, source: 'auto' },
  { id: 'cat_unused', name: 'Random-Unused', displayName: 'Random-Unused', visible: true, configured: false, source: 'auto' },
]

const services = {
  manualServices: [
    { name: 'Plex', url: 'plex', categoryIds: ['cat_mediaservers', 'cat_mine'] },
    { name: 'Shop', url: 'shop', categoryIds: ['cat_ecom'] },
    { name: 'Misc', url: 'misc', categoryIds: ['cat_other'] },
    { name: 'Auto', url: 'auto', categoryIds: [] },
    { name: 'Legacy', url: 'legacy', category: 'Media' },
  ],
  overrides: {
    npm_3: { name: 'Sonarr', categoryIds: ['cat_media2'] },
  },
}

test('legacy registry is folded into the built-ins', () => {
  const { registry, servicesData, changed } = migrateRegistry(legacy, services)
  assert.equal(changed, true)
  assert.equal(registry.version, 2)

  const byId = new Map(registry.categories.map(c => [c.id, c]))
  const names = registry.categories.map(c => c.name)

  // Media variants merge into one built-in category, keeping the original id
  assert.equal(byId.get('cat_media').autoKey, 'media')
  assert.equal(byId.get('cat_media').name, 'Media')
  assert.ok(!byId.has('cat_media2'))
  assert.ok(!byId.has('cat_mediaservers'))

  // Configured categories keep their name and settings
  assert.equal(byId.get('cat_dl').autoKey, 'downloads')
  assert.equal(byId.get('cat_dl').name, 'Download-Managers')
  assert.equal(byId.get('cat_dl').visible, false)
  assert.equal(byId.get('cat_mine').name, 'Family Stuff')
  assert.equal(byId.get('cat_mine').autoKey, undefined)

  // "Other" and unreferenced noise are dropped, referenced noise is kept
  assert.ok(!names.includes('Other'))
  assert.ok(!byId.has('cat_unused'))
  assert.ok(byId.has('cat_ecom'))

  // "tools" was unconfigured and unreferenced, so it becomes the Utilities built-in
  assert.equal(byId.get('cat_tools').name, 'Utilities')

  // Every built-in exists exactly once
  for (const { key } of BUILTIN_CATEGORIES) {
    assert.equal(registry.categories.filter(c => c.autoKey === key).length, 1, key)
  }
  assert.equal(new Set(names.map(n => n.toLowerCase())).size, names.length, 'names are unique')

  // References are rewritten
  const [plex, shop, misc, auto, legacyService] = servicesData.manualServices
  assert.deepEqual(plex.categoryIds, ['cat_media', 'cat_mine'])
  assert.deepEqual(shop.categoryIds, ['cat_ecom'])
  assert.deepEqual(misc.categoryIds, [], '"Other" becomes an explicit empty list')
  assert.equal(auto.categoryIds, undefined, 'an empty list used to mean auto')
  assert.deepEqual(legacyService.categoryIds, ['cat_media'])
  assert.equal(legacyService.category, undefined)
  assert.deepEqual(servicesData.overrides.npm_3.categoryIds, ['cat_media'])

  // Input is not mutated
  assert.deepEqual(services.manualServices[0].categoryIds, ['cat_mediaservers', 'cat_mine'])
})

test('fresh install seeds every built-in', () => {
  const { registry } = migrateRegistry(null, { manualServices: [], overrides: {} })
  assert.equal(registry.categories.length, BUILTIN_CATEGORIES.length)
  assert.deepEqual(registry.seeded.sort(), BUILTIN_CATEGORIES.map(c => c.key).sort())
})

test('version 2 is left alone, deleted built-ins stay deleted', () => {
  const { registry } = migrateRegistry(null, { manualServices: [], overrides: {} })
  registry.categories = registry.categories.filter(c => c.autoKey !== 'gaming')
  const again = migrateRegistry(registry, { manualServices: [], overrides: {} })
  assert.equal(again.changed, false)
  assert.ok(!again.registry.categories.some(c => c.autoKey === 'gaming'))
})

test('built-ins added in a later version are seeded once', () => {
  const { registry } = migrateRegistry(null, { manualServices: [], overrides: {} })
  registry.seeded = registry.seeded.filter(key => key !== 'ai')
  registry.categories = registry.categories.filter(c => c.autoKey !== 'ai')
  const again = migrateRegistry(registry, { manualServices: [], overrides: {} })
  assert.equal(again.changed, true)
  assert.equal(again.registry.categories.filter(c => c.autoKey === 'ai').length, 1)
})

test('restoreBuiltins and new categories reuse built-in rules', () => {
  const { registry } = migrateRegistry(null, { manualServices: [], overrides: {} })
  registry.categories = registry.categories.filter(c => c.autoKey !== 'media' && c.autoKey !== 'food')

  const media = createCategoryEntry(registry, 'Media')
  assert.equal(media.autoKey, 'media')
  registry.categories.push(media)
  assert.equal(createCategoryEntry(registry, 'Kids').autoKey, undefined)

  assert.equal(restoreBuiltins(registry), 1)
  assert.equal(registry.categories.filter(c => c.autoKey === 'food').length, 1)
})
