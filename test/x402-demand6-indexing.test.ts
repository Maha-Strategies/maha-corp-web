import assert from 'node:assert/strict'
import test from 'node:test'
import { assertDemandPlan, assertDemandChallenge, TARGETS, CAP, sealRecovery, openRecovery, verifyDemandDelivery } from '../scripts/run-demand6-indexing.ts'
import { buildDemandProduct } from '../lib/x402/demand6/products.ts'
import { fixtureDependencies, fixtureQuote } from '../lib/x402/demand6/fixtures.ts'
import { DEMAND6_PRODUCTS } from '../lib/x402/demand6/contracts.ts'
import { decodeChallenge } from '../lib/x402/client.ts'
test('approved six-product plan is exactly 0.4629 USDC', () => { assertDemandPlan(); assert.equal(CAP, BigInt(462900)) })
test('private original authorization is encrypted, authenticated and domain bound', () => {
  const key = 'disposable-test-key', original = { recoverySecret: 'private-secret', paymentSignature: 'private-signature' }
  const sealed = sealRecovery(key, original)
  assert.deepEqual(openRecovery(key, sealed), original)
  assert.ok(!JSON.stringify(sealed).includes('private-secret'))
  assert.throws(() => openRecovery('wrong-key', sealed))
  assert.throws(() => openRecovery(key, { ...sealed, tag: '00'.repeat(16) }))
  assert.throws(() => openRecovery(key, { ...sealed, version: 'other-scope' }))
})
for (const target of TARGETS) {
  test(`${target.id} indexing checks both native-USDC terms and delivered integrity`, async () => {
    const challenge = decodeChallenge(fixtureQuote(DEMAND6_PRODUCTS[target.id].amount).headers['payment-required'])
    challenge.resource.url = 'https://www.mahastrategies.com' + target.path
    challenge.accepts.forEach(term => { term.maxTimeoutSeconds = 60 })
    assertDemandChallenge(challenge, target)
    challenge.accepts[1].amount = '1'; assert.throws(() => assertDemandChallenge(challenge, target)); challenge.accepts[1].amount = target.amount
    const result = await buildDemandProduct(target.id, target.input, fixtureDependencies)
    await verifyDemandDelivery(target.id, target.input, result)
    await assert.rejects(verifyDemandDelivery(target.id, target.input, { ...result, resultHash: 'sha256:' + '00'.repeat(32) }))
  })
}
