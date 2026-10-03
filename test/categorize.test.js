import { test } from 'node:test'
import assert from 'node:assert/strict'
import { autoCategorize } from '../server/categorize.js'

const cases = [
  [{ name: 'Sonarr 4K' }, 'media'],
  [{ name: 'Plex' }, 'media'],
  [{ name: 'qBittorrent' }, 'downloads'],
  [{ name: 'Prowlarr' }, 'downloads'],
  [{ name: 'Immich' }, 'photos'],
  [{ name: 'Home Assistant' }, 'home'],
  [{ name: 'Ha', hostnames: ['ha.example.com'] }, 'home'],
  [{ name: 'Zigbee2MQTT' }, 'home'],
  [{ name: 'Vaultwarden' }, 'security'],
  [{ name: 'Authentik' }, 'security'],
  [{ name: 'Grafana' }, 'monitoring'],
  [{ name: 'Uptime Kuma' }, 'monitoring'],
  [{ name: 'Nginx Proxy Manager' }, 'network'],
  [{ name: 'Pi-hole' }, 'network'],
  [{ name: 'Gitea' }, 'development'],
  [{ name: 'Portainer' }, 'infrastructure'],
  [{ name: 'Proxmox', hostnames: ['pve.example.com'] }, 'infrastructure'],
  [{ name: 'Paperless' }, 'productivity'],
  [{ name: 'Nextcloud' }, 'files'],
  [{ name: 'Mealie' }, 'food'],
  [{ name: 'Actual' }, 'finance'],
  [{ name: 'Ollama' }, 'ai'],
  [{ name: 'Open WebUI' }, 'ai'],
  [{ name: 'n8n' }, 'automation'],
  [{ name: 'Minecraft' }, 'gaming'],
  [{ name: 'Stirling PDF' }, 'utilities'],
  [{ name: 'Mattermost' }, 'communication'],
  // Generic words
  [{ name: 'TV Shows' }, 'media'],
  [{ name: 'Family Recipes' }, 'food'],
  [{ name: 'Status' }, 'monitoring'],
  // The hostname or icon identifies the app when the name does not
  [{ name: 'Requests', hostnames: ['https://overseerr.example.com'] }, 'media'],
  [{ name: 'Passwords', iconName: 'vaultwarden-light' }, 'security'],
  // Icon metadata as a last resort
  [{ name: 'Some Router', iconCategories: [] }, 'network'],
  [{ name: 'Unknown Thing', iconCategories: ['Networking-Tools'] }, 'network'],
]

for (const [input, expected] of cases) {
  test(`${JSON.stringify(input)} -> ${expected}`, () => {
    assert.equal(autoCategorize(input)?.key, expected)
  })
}

test('no substring false positives', () => {
  // "chat" contains "ha", "blogs" contains "logs", "rapid" contains "api"
  assert.notEqual(autoCategorize({ name: 'Chat' })?.key, 'home')
  assert.equal(autoCategorize({ name: 'Blogs' }), null)
  assert.equal(autoCategorize({ name: 'Rapid' }), null)
  assert.equal(autoCategorize({ name: 'Author' }), null)
})

test('ambiguous app names only match as the whole name', () => {
  assert.equal(autoCategorize({ name: 'Garage' })?.key, 'files')
  assert.equal(autoCategorize({ name: 'Garage Door' }), null)
})

test('returns null when nothing matches', () => {
  assert.equal(autoCategorize({ name: 'Bluemap' }), null)
  assert.equal(autoCategorize({}), null)
})
