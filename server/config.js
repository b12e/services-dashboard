/**
 * Dashboard configuration (data/config.json)
 */

import { PATHS, readJson, writeJsonAtomic } from './storage.js'

export const DEFAULT_NAME = 'Services Dashboard'

export const DEFAULT_CONFIG = {
  baseUrl: '',
  npmEnabled: false,
  npmConnections: [],
  customName: DEFAULT_NAME,
  customIcon: null,
}

export async function loadConfig() {
  let stored
  try {
    stored = await readJson(PATHS.config, {})
  } catch (error) {
    console.error('Could not read config.json:', error.message)
    stored = {}
  }
  return {
    ...DEFAULT_CONFIG,
    ...stored,
    npmConnections: Array.isArray(stored?.npmConnections) ? stored.npmConnections : [],
  }
}

export async function saveConfig(config) {
  await writeJsonAtomic(PATHS.config, config)
}

export function brandingFrom(config) {
  return {
    customName: config.customName || DEFAULT_NAME,
    customIcon: config.customIcon || null,
  }
}

/**
 * "https://example.com/" -> "example.com"
 */
export function normalizeBaseDomain(baseUrl) {
  return String(baseUrl || '')
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/\/+$/, '')
}
