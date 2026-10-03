import { test } from 'node:test'
import assert from 'node:assert/strict'
import { normalize, candidatesFor, hostLabel, titleFromLabel, editDistance } from '../server/text.js'

test('normalize strips case, accents and separators', () => {
  assert.equal(normalize('Home-Assistant'), 'homeassistant')
  assert.equal(normalize('Café Ünïcode'), 'cafeunicode')
  assert.equal(normalize(undefined), '')
})

test('candidatesFor drops deployment noise', () => {
  const keys = candidatesFor('Sonarr 4K').map(c => c.key)
  assert.equal(keys[0], 'sonarr4k')
  assert.ok(keys.includes('sonarr'))
  assert.ok(candidatesFor('my-plex-server').some(c => c.key === 'plex' && c.kind === 'full'))
})

test('hostLabel picks the first meaningful label', () => {
  assert.equal(hostLabel('sonarr.local.example.com'), 'sonarr')
  assert.equal(hostLabel('https://www.grafana.example.com:3000/x'), 'grafana')
  assert.equal(hostLabel('*.example.com'), 'example')
  assert.equal(hostLabel('192.168.1.10'), null)
  assert.equal(hostLabel(''), null)
})

test('titleFromLabel', () => {
  assert.equal(titleFromLabel('sonarr-4k'), 'Sonarr 4K')
  assert.equal(titleFromLabel('uptime_kuma'), 'Uptime Kuma')
  assert.equal(titleFromLabel('ha'), 'HA')
  assert.equal(titleFromLabel('npm'), 'NPM')
  assert.equal(titleFromLabel('tv-4k'), 'TV 4K')
  assert.equal(titleFromLabel('my-random-app'), 'My Random App')
  assert.equal(titleFromLabel('pve'), 'Pve')
})

test('editDistance', () => {
  assert.equal(editDistance('jelyfin', 'jellyfin'), 1)
  assert.ok(editDistance('dashboard', 'grafana') > 2)
})

test('candidate generation stays fast on hostile input', () => {
  const start = performance.now()
  candidatesFor(`a${'9'.repeat(100000)}x`)
  candidatesFor('a'.repeat(100000))
  assert.ok(performance.now() - start < 200)
})
