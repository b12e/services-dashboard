/**
 * Migration Script: Convert name-based categories to ID-based categories
 *
 * This script:
 * 1. Reads existing categories from config.json
 * 2. Reads service category references from services.json
 * 3. Creates categories.json with unique IDs
 * 4. Updates services.json to use category IDs
 * 5. Backs up original files
 */

import fs from 'fs/promises'
import path from 'path'
import crypto from 'crypto'

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data')
const CONFIG_PATH = path.join(DATA_DIR, 'config.json')
const SERVICES_PATH = path.join(DATA_DIR, 'services.json')
const CATEGORIES_PATH = path.join(DATA_DIR, 'categories.json')

function generateCategoryId() {
  return `cat_${crypto.randomBytes(8).toString('hex')}`
}

function normalizeCategoryName(name) {
  return name.toLowerCase().trim()
}

async function backupFile(filePath) {
  try {
    const content = await fs.readFile(filePath, 'utf-8')
    const backupPath = `${filePath}.backup.${Date.now()}`
    await fs.writeFile(backupPath, content)
    console.log(`✓ Backed up ${path.basename(filePath)} to ${path.basename(backupPath)}`)
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error
    }
  }
}

async function migrate() {
  console.log('Starting category migration...\n')

  // Ensure data directory exists
  try {
    await fs.mkdir(DATA_DIR, { recursive: true })
  } catch (error) {
    // Directory might already exist, that's fine
  }

  // Backup existing files
  console.log('Creating backups...')
  await backupFile(CONFIG_PATH)
  await backupFile(SERVICES_PATH)
  console.log()

  // Load existing data
  let config = {}
  let servicesData = { manualServices: [], overrides: {} }

  try {
    const configContent = await fs.readFile(CONFIG_PATH, 'utf-8')
    config = JSON.parse(configContent)
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.error('Error reading config.json:', error)
    }
  }

  try {
    const servicesContent = await fs.readFile(SERVICES_PATH, 'utf-8')
    servicesData = JSON.parse(servicesContent)
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.error('Error reading services.json:', error)
    }
  }

  // Build category map
  const categoryMap = new Map() // normalized name -> category object
  const nameToIdMap = new Map() // normalized name -> id

  // Collect categories from config
  if (config.categories && Array.isArray(config.categories)) {
    console.log(`Found ${config.categories.length} configured categories`)
    config.categories.forEach(cat => {
      const normalizedName = normalizeCategoryName(cat.name)
      if (!categoryMap.has(normalizedName)) {
        const id = generateCategoryId()
        categoryMap.set(normalizedName, {
          id,
          name: cat.name,
          displayName: cat.displayName || cat.name,
          visible: cat.visible !== false,
          configured: true,
          source: 'manual',
          createdAt: new Date().toISOString()
        })
        nameToIdMap.set(normalizedName, id)
      }
    })
  }

  // Collect categories from manual services
  if (servicesData.manualServices && Array.isArray(servicesData.manualServices)) {
    servicesData.manualServices.forEach(service => {
      if (service.categories && Array.isArray(service.categories)) {
        service.categories.forEach(catName => {
          const normalizedName = normalizeCategoryName(catName)
          if (!categoryMap.has(normalizedName)) {
            const id = generateCategoryId()
            categoryMap.set(normalizedName, {
              id,
              name: catName,
              displayName: catName,
              visible: true,
              configured: false,
              source: 'auto',
              createdAt: new Date().toISOString()
            })
            nameToIdMap.set(normalizedName, id)
          }
        })
      }
    })
  }

  // Collect categories from overrides
  if (servicesData.overrides && typeof servicesData.overrides === 'object') {
    Object.values(servicesData.overrides).forEach(override => {
      if (override.categories && Array.isArray(override.categories)) {
        override.categories.forEach(catName => {
          const normalizedName = normalizeCategoryName(catName)
          if (!categoryMap.has(normalizedName)) {
            const id = generateCategoryId()
            categoryMap.set(normalizedName, {
              id,
              name: catName,
              displayName: catName,
              visible: true,
              configured: false,
              source: 'auto',
              createdAt: new Date().toISOString()
            })
            nameToIdMap.set(normalizedName, id)
          }
        })
      }
    })
  }

  console.log(`Total unique categories found: ${categoryMap.size}\n`)

  // Create categories.json
  const categories = Array.from(categoryMap.values())
  await fs.writeFile(CATEGORIES_PATH, JSON.stringify(categories, null, 2))
  console.log(`✓ Created categories.json with ${categories.length} categories`)

  // Update manual services to use IDs
  let servicesUpdated = false
  if (servicesData.manualServices && Array.isArray(servicesData.manualServices)) {
    servicesData.manualServices.forEach(service => {
      if (service.categories && Array.isArray(service.categories)) {
        const categoryIds = service.categories
          .map(name => nameToIdMap.get(normalizeCategoryName(name)))
          .filter(Boolean)

        if (categoryIds.length > 0) {
          service.categoryIds = categoryIds
          delete service.categories
          servicesUpdated = true
        }
      }
    })
  }

  // Update overrides to use IDs
  if (servicesData.overrides && typeof servicesData.overrides === 'object') {
    Object.keys(servicesData.overrides).forEach(key => {
      const override = servicesData.overrides[key]
      if (override.categories && Array.isArray(override.categories)) {
        const categoryIds = override.categories
          .map(name => nameToIdMap.get(normalizeCategoryName(name)))
          .filter(Boolean)

        if (categoryIds.length > 0) {
          override.categoryIds = categoryIds
          delete override.categories
          servicesUpdated = true
        }
      }
    })
  }

  // Save updated services.json if changes were made
  if (servicesUpdated) {
    await fs.writeFile(SERVICES_PATH, JSON.stringify(servicesData, null, 2))
    console.log('✓ Updated services.json with category IDs')
  }

  // Update config.json to remove old categories array
  if (config.categories) {
    delete config.categories
    await fs.writeFile(CONFIG_PATH, JSON.stringify(config, null, 2))
    console.log('✓ Removed categories from config.json')
  }

  console.log('\n✅ Migration completed successfully!')
  console.log('\nSummary:')
  console.log(`  - ${categories.length} categories migrated`)
  console.log(`  - ${categories.filter(c => c.configured).length} configured categories`)
  console.log(`  - ${categories.filter(c => !c.configured).length} auto-detected categories`)
  console.log('\nBackup files created with .backup.[timestamp] extension')
  console.log('You can delete these backups once you verify everything works correctly.')
}

// Run migration
migrate().catch(error => {
  console.error('\n❌ Migration failed:', error)
  process.exit(1)
})
