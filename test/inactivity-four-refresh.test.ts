import test from 'node:test'
import assert from 'node:assert/strict'
import { CONFIRMATION, TARGETS, assertAuthorization, assertTerms, requestFor, verifyDelivery } from '../scripts/run-inactivity-four-refresh.ts'
import { BASE_NETWORK, BASE_USDC, MAHA_PAYEE } from '../lib/x402/discovery-payment-recipe.ts'
import { buildGovernedContextVerificationPack } from '../lib/x402/context-product-family.ts'
import { buildCelestialProduct } from '../lib/x402/celestial-products.ts'
import { auditInputHash } from '../lib/mps-audit-engine.ts'

test('only the approved four targets and 0.93 USDC are authorized', () => {
  assert.equal(TARGETS.length, 4)
  assert.equal(TARGETS.reduce((n, t) => n + BigInt(t.amount), 0n), 930000n)
  assertAuthorization(CONFIRMATION, '1')
  assert.throws(() => assertAuthorization(CONFIRMATION, '2'))
  assert.throws(() => assertAuthorization(undefined, '1'))
})
test('every term is pinned, including network, destination, price and token domain', () => {
  for (const target of TARGETS) {
    const term = { scheme: 'exact', network: BASE_NETWORK, amount: target.amount, asset: BASE_USDC,
      payTo: MAHA_PAYEE, maxTimeoutSeconds: 60, extra: { name: 'USD Coin', version: '2' } }
    const c = { x402Version: 2, resource: { url: 'https://www.mahastrategies.com' + target.path }, accepts: [term] }
    assertTerms(c, target)
    for (const patch of [{ amount: '930001' }, { payTo: BASE_USDC }, { asset: MAHA_PAYEE }, { network: 'eip155:1' }, { maxTimeoutSeconds: 600 }, { extra: { name: 'USD Coin', version: '1' } }])
      assert.throws(() => assertTerms({ ...c, accepts: [{ ...term, ...patch }] }, target))
    assert.throws(() => assertTerms({ ...c, accepts: [term, term] }, target))
    assert.throws(() => assertTerms({ ...c, resource: { url: 'https://example.com' } }, target))
  }
})
test('MPS has a fresh run-scoped identity and the normalized input hash', () => {
  const req = requestFor(TARGETS[0], '12345')
  assert.equal(req.headers['x-maha-idempotency-key'], req.input.clientRequestId)
  assert.equal(req.headers['x-maha-input-hash'], auditInputHash(String(req.input.text)))
  assert.notEqual(requestFor(TARGETS[0], '12346').input.clientRequestId, req.input.clientRequestId)
  assert.throws(() => requestFor(TARGETS[0], '../bad'))
})
test('deterministic deliveries are recomputed and tampering is rejected', () => {
  for (const target of TARGETS.slice(1)) {
    const input = requestFor(target, '12345').input
    const expected = target.id === 'governed-context-verification-pack'
      ? buildGovernedContextVerificationPack(input) : buildCelestialProduct(target.id as 'celestial-chart-evidence' | 'celestial-vimshottari-timing', input)
    assert.equal(verifyDelivery(target, input, expected), true)
    assert.equal(verifyDelivery(target, input, { ...expected, receiptDigest: 'changed' }), false)
  }
})
test('MPS requires completed, request-bound, valid claim delivery, not merely a payment', () => {
  const input = requestFor(TARGETS[0], '12345').input
  const hash = auditInputHash(String(input.text))
  const value = { offerId: TARGETS[0].id, status: 'completed', clientRequestId: input.clientRequestId, inputHash: hash,
    audit: { mps_version: '0.1', input_hash: hash, claims: [{ excerpt: 'Soil microbial diversity has declined sharply across intensively farmed land.', tag: 'UNVERIFIED', rationale: 'No primary source is supplied.', action: 'verify' }] } }
  assert.equal(verifyDelivery(TARGETS[0], input, value), true)
  assert.equal(verifyDelivery(TARGETS[0], input, { ...value, status: 'processing' }), false)
  assert.equal(verifyDelivery(TARGETS[0], input, { ...value, inputHash: 'wrong' }), false)
})
