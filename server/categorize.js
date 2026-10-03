/**
 * Auto-categorization of services
 *
 * Signals, strongest first:
 *   1. A known app name in the service name, hostname or matched icon
 *      ("Sonarr 4K", "qbit.example.com", icon "home-assistant")
 *   2. Generic keywords in the name, description or hostname ("TV Shows")
 *   3. Categories from the matched icon's metadata
 *
 * Matching works on whole names and words, never on arbitrary substrings.
 * The result is a single built-in category key, or null when nothing fits.
 */

import { BUILTIN_CATEGORIES, APP_ABBREVIATIONS, EXTERNAL_CATEGORY_MAP, AMBIGUOUS_NAMES } from './taxonomy.js'
import { normalize, splitWords, candidatesFor, hostLabel } from './text.js'

const APP_INDEX = new Map()
const KEYWORD_INDEX = new Map()

for (const category of BUILTIN_CATEGORIES) {
  for (const app of category.apps) {
    const key = normalize(app)
    if (!APP_INDEX.has(key)) APP_INDEX.set(key, { category: category.key, app })
  }
  for (const keyword of category.keywords) {
    const key = normalize(keyword)
    if (!KEYWORD_INDEX.has(key)) KEYWORD_INDEX.set(key, category.key)
  }
}

for (const [abbreviation, app] of Object.entries(APP_ABBREVIATIONS)) {
  const key = normalize(abbreviation)
  const target = APP_INDEX.get(normalize(app))
  if (target && !APP_INDEX.has(key)) APP_INDEX.set(key, target)
}

const VARIANT_SUFFIX = /-(light|dark|alt|white|black|color|colour|mono|wordmark)$/i

function findApp(text) {
  for (const candidate of candidatesFor(text)) {
    const hit = APP_INDEX.get(candidate.key)
    if (!hit) continue
    if (AMBIGUOUS_NAMES.has(candidate.key) && candidate.kind !== 'full') continue
    return { ...hit, match: candidate.key }
  }
  return null
}

/**
 * @param {object} input
 * @param {string}   [input.name]
 * @param {string}   [input.description]
 * @param {string[]} [input.hostnames]      hostnames or URLs (domain, forward host)
 * @param {string}   [input.iconName]       resolved icon name, e.g. "sonarr"
 * @param {string[]} [input.iconCategories] categories from icon metadata
 * @returns {{ key: string, source: string, match: string } | null}
 */
export function autoCategorize({ name, description, hostnames = [], iconName, iconCategories = [] } = {}) {
  const labels = hostnames.map(hostLabel).filter(Boolean)
  const cleanIcon = typeof iconName === 'string' && !/^(https?:)?\//i.test(iconName)
    ? iconName.replace(/^si:/, '').replace(VARIANT_SUFFIX, '')
    : null

  // 1. Known apps
  for (const text of [name, ...labels, cleanIcon]) {
    if (!text) continue
    const hit = findApp(text)
    if (hit) return { key: hit.category, source: 'app', match: hit.app }
  }

  // 2. Generic keywords, by vote (name counts double)
  const votes = new Map()
  const vote = (text, weight) => {
    for (const word of splitWords(text)) {
      const key = KEYWORD_INDEX.get(word)
      if (key) votes.set(key, { score: (votes.get(key)?.score || 0) + weight, match: votes.get(key)?.match || word })
    }
  }
  vote(name, 2)
  vote(description, 1)
  labels.forEach(label => vote(label, 1))
  const keywordWinner = pickWinner(votes)
  if (keywordWinner) return { key: keywordWinner.key, source: 'keyword', match: keywordWinner.match }

  // 3. Icon metadata categories
  const metaVotes = new Map()
  iconCategories.forEach((category, index) => {
    const key = EXTERNAL_CATEGORY_MAP[String(category).toLowerCase()]
    if (!key) return
    // Earlier categories are usually the most specific ones
    const weight = 1 + 1 / (index + 1)
    metaVotes.set(key, { score: (metaVotes.get(key)?.score || 0) + weight, match: category })
  })
  const metaWinner = pickWinner(metaVotes)
  if (metaWinner) return { key: metaWinner.key, source: 'icon-metadata', match: metaWinner.match }

  return null
}

function pickWinner(votes) {
  let winner = null
  for (const [key, { score, match }] of votes) {
    if (!winner || score > winner.score) winner = { key, score, match }
  }
  return winner
}
