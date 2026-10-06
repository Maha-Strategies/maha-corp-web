import test from 'node:test'
import assert from 'node:assert/strict'
import { assertMatrixAuthorization, assertMatrixDelivery, assertMatrixTerms, AMOUNT, CONFIRMATION, RESOURCE } from '../scripts/run-evidence-matrix-refresh.ts'
import { BASE_NETWORK, BASE_USDC, MAHA_PAYEE } from '../lib/x402/discovery-payment-recipe.ts'
import { buildEvidenceRetentionMatrix } from '../lib/x402/context-product-family.ts'
import { EVIDENCE_RETENTION_MATRIX_EXAMPLE_INPUT } from '../lib/x402/context-product-offer-schemas.ts'
import type { PaymentChallenge } from '../lib/x402/client.ts'

const valid = (): PaymentChallenge => ({ x402Version: 2, resource: { url: RESOURCE }, accepts: [{
  scheme: 'exact', network: BASE_NETWORK, amount: AMOUNT, asset: BASE_USDC, payTo: MAHA_PAYEE,
  maxTimeoutSeconds: 300, extra: { name: 'USD Coin', version: '2' },
}] })

test('fixed matrix terms pass', () => assert.doesNotThrow(() => assertMatrixTerms(valid())))
for (const [field, value] of Object.entries({ amount: '50001', network: 'eip155:1', asset: '0xwrong', payTo: '0xwrong', scheme: 'upto' })) {
  test(`rejects changed ${field}`, () => {
    const challenge = valid()
    Object.assign(challenge.accepts[0]!, { [field]: value })
    assert.throws(() => assertMatrixTerms(challenge))
  })
}
test('rejects a different endpoint, ambiguous offers and token domain', () => {
  const challenge = valid()
  challenge.resource.url = 'https://www.mahastrategies.com/api/v1/compress'
  assert.throws(() => assertMatrixTerms(challenge))
  const ambiguous = valid()
  ambiguous.accepts.push({ ...ambiguous.accepts[0]! })
  assert.throws(() => assertMatrixTerms(ambiguous))
  const domain = valid()
  domain.accepts[0]!.extra = { name: 'wrong', version: '2' }
  assert.throws(() => assertMatrixTerms(domain))
})
test('requires exact confirmation and refuses workflow reruns', () => {
  assert.doesNotThrow(() => assertMatrixAuthorization(CONFIRMATION, '1'))
  for (const [confirmation, attempt] of [[undefined, '1'], [CONFIRMATION, '2'], [CONFIRMATION, undefined], ['wrong', '1']]) {
    assert.throws(() => assertMatrixAuthorization(confirmation, attempt))
  }
})
test('accepts deterministic synthetic result and refuses incorrect delivery', () => {
  const payload = buildEvidenceRetentionMatrix(EVIDENCE_RETENTION_MATRIX_EXAMPLE_INPUT)
  assert.doesNotThrow(() => assertMatrixDelivery(payload))
  assert.throws(() => assertMatrixDelivery({ ...payload, receiptDigest: 'wrong' }))
  assert.throws(() => assertMatrixDelivery({ ...payload, offerId: 'different' }))
})
