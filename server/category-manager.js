/**
 * Category Management Module
 * Manages categories in a separate file with ID-based references
 */

import fs from 'fs/promises'
import path from 'path'
import crypto from 'crypto'

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data')
const CATEGORIES_PATH = path.join(DATA_DIR, 'categories.json')

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
 * Load categories from file
 */
export async function loadCategories() {
  try {
    const data = await fs.readFile(CATEGORIES_PATH, 'utf-8')
    const categories = JSON.parse(data)

    // Ensure it's an array
    if (!Array.isArray(categories)) {
      console.warn('Categories file is not an array, returning empty array')
      return []
    }

    return categories
  } catch (error) {
    if (error.code === 'ENOENT') {
      // File doesn't exist, return empty array
      return []
    }
    console.error('Error loading categories:', error)
    return []
  }
}

/**
 * Save categories to file
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
    return true
  } catch (error) {
    console.error('Error saving categories:', error)
    throw error
  }
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
 */
export async function getOrCreateCategory(name, options = {}) {
  const {
    displayName = name,
    visible = true,
    configured = false,
    source = 'auto'
  } = options

  // Check if category already exists
  const existing = await getCategoryByName(name)
  if (existing) {
    return existing.id
  }

  // Create new category
  const categories = await loadCategories()
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
  await saveCategories(categories)

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

  await saveCategories(categories)
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

  await saveCategories(filtered)
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
 */
export async function convertNamesToIds(names) {
  if (!Array.isArray(names)) return []

  const ids = []
  for (const name of names) {
    const id = await getOrCreateCategory(name)
    ids.push(id)
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
