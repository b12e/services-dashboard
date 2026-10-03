import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildHref, sanitizeServiceInput } from '../server/services.js'
import { convertProxyHost, apiUrlFor } from '../server/npm.js'

test('buildHref', () => {
  assert.equal(buildHref({ url: 'plex' }, 'example.com'), 'https://plex.example.com')
  assert.equal(buildHref({ url: 'plex/web' }, 'https://example.com/'), 'https://plex.example.com/web')
  assert.equal(buildHref({ url: '' }, 'example.com'), 'https://example.com')
  assert.equal(buildHref({ url: 'plex.tv', appendBaseDomain: false }, 'example.com'), 'https://plex.tv')
  assert.equal(buildHref({ url: 'http://10.0.0.2:8080' }, 'example.com'), 'http://10.0.0.2:8080', 'full URLs never get the base domain')
  assert.equal(buildHref({ url: 'javascript:alert(1)', appendBaseDomain: false }, ''), null)
  assert.equal(buildHref({ url: '' }, ''), null)
})

test('sanitizeServiceInput', () => {
  assert.equal(sanitizeServiceInput({ url: 'x' }).error, 'Name is required')
  assert.equal(sanitizeServiceInput({ name: 'x' }).error, 'URL is required')

  const { value } = sanitizeServiceInput({
    name: ' Plex ', url: 'plex', icon: '', categoryIds: ['a', 'a', 3], hidden: false, _id: 'evil', iconUrl: 'x',
  })
  assert.deepEqual(value, { name: 'Plex', url: 'plex', appendBaseDomain: true, categoryIds: ['a'], hidden: false })

  assert.equal(sanitizeServiceInput({ categoryIds: null }, { npm: true }).value.categoryIds, null)
  assert.equal(sanitizeServiceInput({}, { npm: true }).value.url, undefined)
})

test('convertProxyHost', () => {
  const service = convertProxyHost({
    id: 7, domain_names: ['*.example.com', 'sonarr-4k.example.com'], certificate_id: 3,
    forward_host: 'sonarr', forward_port: 8989,
  }, { name: 'Main' })
  assert.equal(service.name, 'Sonarr 4K')
  assert.equal(service.url, 'https://sonarr-4k.example.com')
  assert.equal(convertProxyHost({ id: 1, domain_names: ['*.example.com'] }), null)
  assert.equal(convertProxyHost({ id: 1, domain_names: ['a.example.com'], certificate_id: 0 }).url, 'http://a.example.com')
})

test('apiUrlFor', () => {
  assert.equal(apiUrlFor({ url: 'http://npm:81/' }), 'http://npm:81/api')
  assert.equal(apiUrlFor({ url: 'http://npm:81/api' }), 'http://npm:81/api')
})
