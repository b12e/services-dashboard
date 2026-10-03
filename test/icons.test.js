import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createIconIndex, matchIcon, resolveIconValue, resolveServiceIcon, generateInitials } from '../server/icons.js'

const dashboardIcons = {
  'sonarr': { base: 'svg', aliases: [], categories: [], colors: { dark: 'sonarr-dark', light: 'sonarr' } },
  'sonarr-4k': { base: 'svg', aliases: ['sonarr-4k'], categories: [] },
  'plex': { base: 'svg', aliases: [], categories: [], colors: { dark: 'plex', light: 'plex-light' } },
  'home-assistant': { base: 'svg', aliases: [], categories: ['Home-Automation'] },
  'nginx-proxy-manager': { base: 'png', aliases: [], categories: [] },
  'npm': { base: 'svg', aliases: [], categories: ['Developer-Tools'] },
  'paperless-ngx': { base: 'svg', aliases: [], categories: [] },
  'jellyfin': { base: 'svg', aliases: [], categories: [] },
  'homarr': { base: 'svg', aliases: ['dashboard', 'homer'], categories: [] },
  'homer': { base: 'png', aliases: [], categories: [] },
  'zashboard': { base: 'svg', aliases: [], categories: [] },
  'apache-guacamole': { base: 'svg', aliases: ['Guacamole'], categories: [] },
  'uptime-kuma': { base: 'svg', aliases: ['status-page'], categories: ['Monitoring-Tools'] },
}
const simpleIcons = [
  { title: 'GitHub', slug: 'github', hex: '181717' },
  { title: 'Plex', slug: 'plex', hex: 'EBAF00' },
]
const index = createIconIndex({ dashboardIcons, simpleIcons })
const best = text => matchIcon(index, [{ text }])?.entry.name

test('exact names win', () => {
  assert.equal(best('Sonarr'), 'sonarr')
  assert.equal(best('Sonarr 4K'), 'sonarr-4k')
  assert.equal(best('Home Assistant'), 'home-assistant')
  assert.equal(best('Plex'), 'plex', 'dashboard-icons beats simple-icons')
})

test('curated abbreviations beat unrelated exact names', () => {
  assert.equal(best('npm'), 'nginx-proxy-manager')
  assert.equal(best('ha'), 'home-assistant')
  assert.equal(best('kuma'), 'uptime-kuma')
})

test('prefix and typo matches', () => {
  assert.equal(best('Paperless'), 'paperless-ngx')
  assert.equal(best('Jelyfin'), 'jellyfin')
})

test('generic words and descriptive aliases do not match', () => {
  assert.equal(best('Dashboard'), undefined)
  assert.equal(best('Status Page'), undefined)
  assert.equal(best('Homer'), 'homer', 'alias of another icon never beats a real name')
  assert.equal(best('Guacamole'), 'apache-guacamole', 'product-name aliases do match')
})

test('light variants are used on the dark dashboard', () => {
  assert.match(resolveIconValue(index, 'plex').url, /\/svg\/plex-light\.svg$/)
  assert.match(resolveIconValue(index, 'sonarr').url, /\/svg\/sonarr\.svg$/)
  assert.match(resolveIconValue(index, 'sonarr-dark').url, /sonarr-dark\.svg$/, 'explicit variants are respected')
  assert.match(resolveIconValue(index, 'nginx-proxy-manager').url, /\/png\/nginx-proxy-manager\.png$/)
})

test('explicit icon values', () => {
  assert.equal(resolveIconValue(index, 'si:github').url, '/api/icons/si/github.svg')
  assert.equal(resolveIconValue(index, 'https://example.com/x.png').source, 'custom')
  assert.equal(resolveIconValue(index, '/uploads/custom-icon-1.png').source, 'custom')
  assert.equal(resolveIconValue(index, 'Home Assistant').name, 'home-assistant')
  assert.equal(resolveIconValue(index, 'definitely-not-an-icon'), null)
})

test('services are matched on hostname when the name is generic', () => {
  const icon = resolveServiceIcon(index, { name: 'TV' }, ['sonarr.example.com'])
  assert.equal(icon.iconName, 'sonarr')
  assert.equal(icon.iconAuto, true)
  assert.equal(icon.fallbackInitials, 'T')
})

test('generateInitials', () => {
  assert.equal(generateInitials('Uptime  Kuma'), 'UK')
  assert.equal(generateInitials(''), '??')
})

test('empty index guesses dashboard-icons urls for explicit names', () => {
  const empty = createIconIndex()
  assert.match(resolveIconValue(empty, 'sonarr').url, /\/svg\/sonarr\.svg$/)
  assert.equal(resolveIconValue(empty, '../etc/passwd'), null)
})
