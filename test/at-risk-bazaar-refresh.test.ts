import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { PaymentChallenge } from '../lib/x402/client.ts'
import { BASE_NETWORK, BASE_USDC, MAHA_PAYEE } from '../lib/x402/discovery-payment-recipe.ts'
import { assertBaseTerms, assertPlan, assertStaleListing, MAX_AMOUNT, TARGETS } from '../scripts/run-at-risk-bazaar-refresh.ts'

const resource = 'https://www.mahastrategies.com/api/v1/micro/citation-binding-check'
const amount = '16000'
const terms: PaymentChallenge = {
  x402Version: 2, resource: { url: resource }, accepts: [
    { scheme: 'exact', network: BASE_NETWORK, amount, asset: BASE_USDC, payTo: MAHA_PAYEE,
      maxTimeoutSeconds: 60, extra: { name: 'USD Coin', version: '2' } },
    { scheme: 'exact', network: 'eip155:42161', amount, asset: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
      payTo: MAHA_PAYEE, maxTimeoutSeconds: 60 },
  ],
}

test('the frozen 35-product CPU-only cohort and total price remain exact', () => {
  const plan = assertPlan()
  assert.equal(plan.length, 35)
  assert.equal(TARGETS.reduce((sum, [, price]) => sum + BigInt(price), 0n), MAX_AMOUNT)
  assert.equal(MAX_AMOUNT, 2_115_500n)
  assert.equal(plan.some(row => ['evidence-retention-matrix', 'mps-autonomous-audit'].includes(row.id)), false)
  assert.equal(plan.every(row => row.offer.status === 'available' && row.resource.startsWith('https://www.mahastrategies.com/')), true)
})

test('multi-network challenge accepts exactly one pinned Base term', () => {
  assert.doesNotThrow(() => assertBaseTerms(terms, resource, amount))
  assert.throws(() => assertBaseTerms({ ...terms, accepts: [...terms.accepts, terms.accepts[0]] }, resource, amount))
  assert.throws(() => assertBaseTerms({ ...terms, accepts: [{ ...terms.accepts[0], amount: '17000' }] }, resource, amount))
  assert.throws(() => assertBaseTerms({ ...terms, accepts: [{ ...terms.accepts[0], payTo: '0x0000000000000000000000000000000000000001' }] }, resource, amount))
  assert.throws(() => assertBaseTerms({ ...terms, resource: { url: 'https://example.com/wrong' } }, resource, amount))
})

test('a listing must be present, payable on Base and actually stale', () => {
  const now = Date.parse('2026-11-02T08:00:00Z')
  const listing = { resource, accepts: [terms.accepts[0]], quality: { lastCalledAt: '2026-10-08T00:00:00Z' },
    lastUpdated: '2026-10-08T00:00:01Z' }
  assert.doesNotThrow(() => assertStaleListing(listing, resource, amount, now))
  assert.throws(() => assertStaleListing(undefined, resource, amount, now), /listing_or_base_terms_missing/)
  assert.throws(() => assertStaleListing({ ...listing, quality: { lastCalledAt: '2026-11-01T00:00:00Z' } }, resource, amount, now), /listing_not_confirmed_at_risk/)
  assert.throws(() => assertStaleListing({ ...listing, quality: { lastCalledAt: '2026-11-03T00:00:00Z' } }, resource, amount, now), /listing_not_confirmed_at_risk/)
  assert.throws(() => assertStaleListing({ ...listing, lastUpdated: '2026-11-02T08:00:00Z' }, resource, amount, now), /listing_not_confirmed_at_risk/)
  assert.throws(() => assertStaleListing({ ...listing, accepts: [{ ...terms.accepts[0], amount: '17000' }] }, resource, amount, now), /listing_or_base_terms_missing/)
})
