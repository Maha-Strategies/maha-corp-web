import assert from 'node:assert/strict'
import test from 'node:test'
import { isValidServiceName, sanitizeResourceServiceMetadata } from '@x402/extensions/bazaar'
import { BAZAAR_SERVICE_NAMES, bazaarServiceNameForOffer, bazaarTagsForOffer } from '../lib/x402/bazaar-service-name.ts'
import { resourceInfoFor } from '../lib/x402/discovery.ts'
import { X402_OFFERS } from '../lib/x402/offers.ts'

test('every catalogue resource keeps a service name through the official Bazaar sanitizer', () => {
  for (const offer of X402_OFFERS) {
    const resource = resourceInfoFor({ offerId: offer.id, method: offer.method, path: offer.path,
      amount: offer.amount, description: offer.description, concurrencyCap: offer.concurrencyCap }, `https://www.mahastrategies.com${offer.path}`)
    const sanitized = sanitizeResourceServiceMetadata(resource)
    assert.ok(isValidServiceName(resource.serviceName), offer.id)
    assert.equal(sanitized.serviceName, resource.serviceName, offer.id)
    assert.deepEqual(sanitized.tags, resource.tags, offer.id)
    assert.equal(sanitized.iconUrl, resource.iconUrl, offer.id)
  }
})
test('all aliases point to real offers and distinguish sections from complete bundles', () => {
  for (const [id, name] of Object.entries(BAZAAR_SERVICE_NAMES)) {
    assert.ok(X402_OFFERS.some(offer => offer.id === id), id)
    assert.ok(isValidServiceName(name), name)
  }
  assert.equal(new Set(Object.values(BAZAAR_SERVICE_NAMES)).size, Object.keys(BAZAAR_SERVICE_NAMES).length)
  assert.notEqual(BAZAAR_SERVICE_NAMES['book-section-the-maha-principle'], BAZAAR_SERVICE_NAMES['book-epub-the-maha-principle'])
  assert.notEqual(BAZAAR_SERVICE_NAMES['book-section-the-maha-principle'], BAZAAR_SERVICE_NAMES['book-reading-pack-the-maha-principle'])
})
test('valid names remain unchanged and invalid future names fail the release gate', () => {
  assert.equal(bazaarServiceNameForOffer({ id: 'future', serviceName: 'Valid Name' }), 'Valid Name')
  assert.throws(() => bazaarServiceNameForOffer({ id: 'future', serviceName: 'A'.repeat(33) }))
  assert.throws(() => bazaarServiceNameForOffer({ id: 'future', serviceName: 'Maha — Name' }))
})
test('specific domain tags survive the five-tag cap without adding unsupported claims', () => {
  const original = ['bounded-computation', 'evidence', 'deterministic', 'microproduct', 'physical-ai', 'inspection']
  const tags = bazaarTagsForOffer({ tags: original })
  assert.equal(tags.length, 5)
  assert.ok(tags.includes('physical-ai')); assert.ok(tags.includes('inspection'))
  assert.ok(tags.every(tag => original.includes(tag)))
  const short = ['ai', 'context', 'budget']
  assert.deepEqual(bazaarTagsForOffer({ tags: short }), short)
})
