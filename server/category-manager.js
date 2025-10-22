/**
 * Category Management Module
 * Manages categories in a separate file with ID-based references
 *
 * Race Condition Prevention:
 * - Uses in-memory cache to reduce file reads
 * - Batches writes with 100ms debounce window
 * - convertNamesToIds() processes all names in a single read-modify-write cycle
 * - Cache updated immediately to prevent duplicate category creation during parallel operations
 */

import fs from 'fs/promises'
import path from 'path'
import crypto from 'crypto'

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data')
const CATEGORIES_PATH = path.join(DATA_DIR, 'categories.json')

// In-memory cache and pending operations queue
let categoriesCache = null
let cacheTimestamp = null
let pendingWrites = []
let writeTimer = null
const WRITE_DELAY_MS = 100 // Batch writes within 100ms window

/**
 * Generate a unique category ID
 */
function generateCategoryId() {
  return `cat_${crypto.randomBytes(8).toString('hex')}`
}

/**
 * Normalize category name for comparison
 */
function normalizeCategoryName(name) {
  return name.toLowerCase().trim()
}

/**
 * Load categories from file with caching
 */
export async function loadCategories(forceReload = false) {
  // Return cached version if available and fresh
  if (categoriesCache && !forceReload && cacheTimestamp && (Date.now() - cacheTimestamp < 5000)) {
    return [...categoriesCache] // Return copy to prevent mutations
  }

  try {
    const data = await fs.readFile(CATEGORIES_PATH, 'utf-8')
    const categories = JSON.parse(data)

    // Ensure it's an array
    if (!Array.isArray(categories)) {
      console.warn('Categories file is not an array, returning empty array')
      categoriesCache = []
      cacheTimestamp = Date.now()
      return []
    }

    categoriesCache = categories
    cacheTimestamp = Date.now()
    return [...categories] // Return copy
  } catch (error) {
    if (error.code === 'ENOENT') {
      // File doesn't exist, return empty array
      categoriesCache = []
      cacheTimestamp = Date.now()
      return []
    }
    console.error('Error loading categories:', error)
    return categoriesCache ? [...categoriesCache] : []
  }
}

/**
 * Save categories to file with batching
 * Debounces writes to prevent concurrent file corruption
 */
export async function saveCategories(categories) {
  try {
    // Ensure data directory exists
    await fs.mkdir(DATA_DIR, { recursive: true })

    // Validate categories is an array
    if (!Array.isArray(categories)) {
      throw new Error('Categories must be an array')
    }

    await fs.writeFile(CATEGORIES_PATH, JSON.stringify(categories, null, 2))

    // Update cache
    categoriesCache = [...categories]
    cacheTimestamp = Date.now()

    return true
  } catch (error) {
    console.error('Error saving categories:', error)
    throw error
  }
}

/**
 * Schedule a batched write operation
 * This prevents concurrent writes by batching operations within a time window
 */
function scheduleBatchedWrite(categories) {
  return new Promise((resolve, reject) => {
    // Clear existing timer
    if (writeTimer) {
      clearTimeout(writeTimer)
    }

    // Update the pending categories
    categoriesCache = [...categories]

    // Schedule write after delay
    writeTimer = setTimeout(async () => {
      try {
        await saveCategories(categoriesCache)
        writeTimer = null
        resolve()
      } catch (error) {
        reject(error)
      }
    }, WRITE_DELAY_MS)

    // Also resolve immediately since write is scheduled
    resolve()
  })
}

/**
 * Get category by ID
 */
export async function getCategoryById(id) {
  const categories = await loadCategories()
  return categories.find(cat => cat.id === id)
}

/**
 * Get category by name (case-insensitive)
 */
export async function getCategoryByName(name) {
  const categories = await loadCategories()
  const normalizedName = normalizeCategoryName(name)
  return categories.find(cat => normalizeCategoryName(cat.name) === normalizedName)
}

/**
 * Get or create category by name
 * Returns the category ID
 * Uses cache to prevent duplicate creation during parallel operations
 */
export async function getOrCreateCategory(name, options = {}) {
  const {
    displayName = name,
    visible = true,
    configured = false,
    source = 'auto'
  } = options

  // Load from cache first to reduce file reads
  const categories = await loadCategories()
  const normalizedName = normalizeCategoryName(name)

  // Check if category already exists (in cache or file)
  const existing = categories.find(cat => normalizeCategoryName(cat.name) === normalizedName)
  if (existing) {
    return existing.id
  }

  // Create new category
  const newCategory = {
    id: generateCategoryId(),
    name: name.trim(),
    displayName: displayName.trim(),
    visible,
    configured,
    source, // 'auto' | 'manual' | 'icon-metadata'
    createdAt: new Date().toISOString()
  }

  categories.push(newCategory)

  // Update cache immediately to prevent duplicate creation
  categoriesCache = [...categories]

  // Schedule batched write
  await scheduleBatchedWrite(categories)

  return newCategory.id
}

/**
 * Update category
 */
export async function updateCategory(id, updates) {
  const categories = await loadCategories()
  const index = categories.findIndex(cat => cat.id === id)

  if (index === -1) {
    throw new Error(`Category with id ${id} not found`)
  }

  // Merge updates
  categories[index] = {
    ...categories[index],
    ...updates,
    id, // Ensure ID doesn't change
    updatedAt: new Date().toISOString()
  }

  categoriesCache = [...categories]
  await scheduleBatchedWrite(categories)
  return categories[index]
}

/**
 * Delete category
 * Note: This only deletes from categories.json
 * Services must be updated separately
 */
export async function deleteCategory(id) {
  const categories = await loadCategories()
  const filtered = categories.filter(cat => cat.id !== id)

  if (filtered.length === categories.length) {
    return false // Category not found
  }

  categoriesCache = [...filtered]
  await scheduleBatchedWrite(filtered)
  return true
}

/**
 * Get all category names mapped to IDs
 */
export async function getCategoryNameToIdMap() {
  const categories = await loadCategories()
  const map = {}
  categories.forEach(cat => {
    map[normalizeCategoryName(cat.name)] = cat.id
  })
  return map
}

/**
 * Get all category IDs mapped to names
 */
export async function getCategoryIdToNameMap() {
  const categories = await loadCategories()
  const map = {}
  categories.forEach(cat => {
    map[cat.id] = cat.name
  })
  return map
}

/**
 * Convert category names to IDs
 * Batched version that minimizes file I/O
 */
export async function convertNamesToIds(names) {
  if (!Array.isArray(names) || names.length === 0) return []

  // Load categories once
  const categories = await loadCategories()
  const normalizedMap = new Map()

  // Build normalized name lookup
  categories.forEach(cat => {
    normalizedMap.set(normalizeCategoryName(cat.name), cat.id)
  })

  const ids = []
  const newCategories = []

  // Process all names
  for (const name of names) {
    const normalized = normalizeCategoryName(name)

    // Check if exists
    if (normalizedMap.has(normalized)) {
      ids.push(normalizedMap.get(normalized))
    } else {
      // Create new category
      const newCategory = {
        id: generateCategoryId(),
        name: name.trim(),
        displayName: name.trim(),
        visible: true,
        configured: false,
        source: 'auto',
        createdAt: new Date().toISOString()
      }

      newCategories.push(newCategory)
      categories.push(newCategory)
      normalizedMap.set(normalized, newCategory.id)
      ids.push(newCategory.id)
    }
  }

  // If we created new categories, write once
  if (newCategories.length > 0) {
    categoriesCache = [...categories]
    await scheduleBatchedWrite(categories)
  }

  return ids
}

/**
 * Convert category IDs to names
 */
export async function convertIdsToNames(ids) {
  if (!Array.isArray(ids)) return []

  const categories = await loadCategories()
  const idMap = {}
  categories.forEach(cat => {
    idMap[cat.id] = cat.name
  })

  return ids.map(id => idMap[id]).filter(Boolean)
}
