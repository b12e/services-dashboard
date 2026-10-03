/**
 * JSON file storage helpers
 *
 * - Writes are atomic (write to a temp file, then rename) so a reader never
 *   sees a half-written file.
 * - withFileLock() serialises read-modify-write cycles on the same file
 *   within this process.
 */

import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export const ROOT_DIR = path.join(__dirname, '..')
export const DATA_DIR = process.env.DATA_DIR || path.join(ROOT_DIR, 'data')

export const PATHS = {
  services: path.join(DATA_DIR, 'services.json'),
  config: path.join(DATA_DIR, 'config.json'),
  categories: path.join(DATA_DIR, 'categories.json'),
  auth: path.join(DATA_DIR, 'auth.json'),
  uploads: path.join(DATA_DIR, 'uploads'),
  cache: path.join(DATA_DIR, 'cache'),
}

/**
 * Read and parse a JSON file.
 * Returns `fallback` when the file does not exist. Any other error (including
 * invalid JSON) is thrown, so callers never mistake a corrupt file for an
 * empty one and overwrite it.
 */
export async function readJson(filePath, fallback = null) {
  let text
  try {
    text = await fs.readFile(filePath, 'utf-8')
  } catch (error) {
    if (error.code === 'ENOENT') return fallback
    throw error
  }
  return JSON.parse(text)
}

export async function writeJsonAtomic(filePath, data) {
  await fs.mkdir(path.dirname(filePath), { recursive: true })
  const tmpPath = `${filePath}.${process.pid}.${Date.now()}.tmp`
  await fs.writeFile(tmpPath, JSON.stringify(data, null, 2) + '\n', 'utf-8')
  await fs.rename(tmpPath, filePath)
}

export async function getMtime(filePath) {
  try {
    const stat = await fs.stat(filePath)
    return stat.mtimeMs
  } catch (error) {
    if (error.code === 'ENOENT') return 0
    throw error
  }
}

export async function backupFile(filePath, suffix = 'backup') {
  try {
    const backupPath = `${filePath}.${suffix}-${new Date().toISOString().replace(/[:.]/g, '-')}`
    await fs.copyFile(filePath, backupPath)
    return backupPath
  } catch (error) {
    if (error.code === 'ENOENT') return null
    throw error
  }
}

const locks = new Map()

/**
 * Run `fn` while holding an in-process lock for `key`.
 */
export async function withFileLock(key, fn) {
  const previous = locks.get(key) || Promise.resolve()
  let release
  const current = new Promise(resolve => { release = resolve })
  const chained = previous.then(() => current)
  locks.set(key, chained)

  await previous
  try {
    return await fn()
  } finally {
    release()
    if (locks.get(key) === chained) locks.delete(key)
  }
}
