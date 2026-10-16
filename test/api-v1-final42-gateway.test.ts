import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { privateKeyToAccount } from 'viem/accounts'
import { FINAL42_PRODUCTION_ENDPOINTS, PRODUCTION_ENDPOINTS, releaseExample } from '../lib/api-v1/production-release.ts'
import { with402Payment } from '../lib/api-v1/with402Payment.ts'
import { memoryPaymentStore } from '../lib/api-v1/payment-store.ts'
import { final42OfflineHandler } from '../scripts/lib/api-v1-final42-fixtures.ts'
import { isPaidReadingProduct, validateFinal42Delivery } from '../lib/api-v1/final42-validation.ts'
import { recoverySeconds } from '../lib/api-v1/types.ts'
import { validate } from './helpers/json-schema.ts'
import { prepareModularPurchase, submitModularPurchase } from '../lib/x402/modular-buyer.ts'
import { decodeChallenge } from '../lib/x402/client.ts'
import { paymentRequiredHeaderBytes, PAYMENT_REQUIRED_HEADER_LIMIT } from '../lib/x402/response-header-budget.ts'
import { CONTEXT_COMPRESSION_OFFER, X402_OFFERS } from '../lib/x402/offers.ts'
import { assertBatch42Quote } from '../scripts/run-modular42-indexing.ts'

const CLOCK = Date.parse('2026-10-15T00:00:00Z'), TX = '0x' + 'ab'.repeat(32), ORIGIN = 'https://www.mahastrategies.com'
const account = privateKeyToAccount(('0x' + '57'.repeat(32)) as `0x${string}`)
const PAYEE = '0xec84c1cd6602bbe387bc8e6f0d3c062f2762de28'
test('complete registry has exactly 1000 reviewed payable products; compiler is independently repriced', () => {
  assert.equal(PRODUCTION_ENDPOINTS.length, 1000); assert.equal(FINAL42_PRODUCTION_ENDPOINTS.length, 42)
  assert.equal(FINAL42_PRODUCTION_ENDPOINTS.reduce((n, e) => n + BigInt(e.amount), 0n), 2592940n)
  assert.ok(PRODUCTION_ENDPOINTS.every(e => e.sourceReview !== 'pending' && e.execution_cost?.mode !== 'external-model'))
  assert.equal(CONTEXT_COMPRESSION_OFFER.amount, '5001'); assert.ok(CONTEXT_COMPRESSION_OFFER.supersededAmounts?.includes('1000'))
  assert.equal(X402_OFFERS.filter(e => e.amount === '5001').length, 1)
})
for (const e of FINAL42_PRODUCTION_ENDPOINTS) {
  const h = final42OfflineHandler(e), sample = releaseExample(e.id)!, retain = recoverySeconds(e)
  test('final42 unsigned quote fits ordinary response-header clients: ' + e.id, async () => {
    const route = with402Payment(e, h, { environment: { NODE_ENV: 'production', VERCEL: '1', BASE_PAYEE_ADDRESS: PAYEE },
      store: memoryPaymentStore(() => CLOCK), now: () => CLOCK,
      facilitator: { verify: async () => { throw Error('no payment') }, settle: async () => { throw Error('no settlement') } } })
    const quote = await route(new Request(ORIGIN + e.path, { method: 'POST' }))
    assert.equal(quote.status, 402); const raw = quote.headers.get('PAYMENT-REQUIRED')!
    assert.ok(paymentRequiredHeaderBytes(raw) <= PAYMENT_REQUIRED_HEADER_LIMIT, String(paymentRequiredHeaderBytes(raw)))
    const challenge = decodeChallenge(raw)
    assertBatch42Quote(challenge, e.id)
    assert.equal(challenge.accepts[0].amount, e.amount)
    const recovery = challenge.extensions?.['maha-input-bound-recovery'] as { info: { retentionSeconds: number; complimentaryCorrection: boolean } }
    assert.equal(recovery.info.retentionSeconds, retain); assert.equal(recovery.info.complimentaryCorrection, false)
    if (isPaidReadingProduct(e.id)) {
      assert.equal(sample.output, null)
      assert.ok(!JSON.stringify(challenge.extensions?.bazaar).includes('contentSha256":"sha256:'))
    }
  })
  // CI/public Git never receives paid text. This integration runs locally with
  // the nine private assets, and is repeated against paid production delivery.
  const missingPrivateAssets = isPaidReadingProduct(e.id) && !existsSync('content/api-v1-books/the-maha-principle.json')
  test('final42 independent buyer, lost-response recovery and exact retention: ' + e.id, { skip: missingPrivateAssets }, async () => {
    let now = CLOCK, signatures = 0, settlements = 0
    const input = h.input.parse(sample.input), expected = h.output.parse(await h.execute(input))
    validateFinal42Delivery(e, input, expected, sample.output)
    assert.deepEqual(validate({ success: true, data: expected, proof: { settlement_id: TX } }, e.schema.output), [])
    const route = with402Payment(e, h, { environment: { NODE_ENV: 'production', VERCEL: '1', BASE_PAYEE_ADDRESS: PAYEE }, now: () => now,
      store: memoryPaymentStore(() => now), confirm: async () => true, recordDelivery: async () => {},
      facilitator: { verify: async () => ({ ok: true, payer: account.address }), settle: async () => { settlements++; return { ok: true, payer: account.address, transaction: TX } } } })
    const transport: typeof fetch = async (url, init) => route(new Request(String(url), init))
    const contract = { id: e.id, path: e.path, amount: e.amount, recoverySeconds: retain, validateInput: (v: unknown) => h.input.parse(v),
      validateOutput: (v: unknown) => validateFinal42Delivery(e, input, v, sample.output) }
    let persisted = false
    const capsule = await prepareModularPurchase(contract, { input, payer: account.address, now, maximumAmount: BigInt(e.amount), fetchImpl: transport,
      signTypedData: async typed => { signatures++; return account.signTypedData(typed as Parameters<typeof account.signTypedData>[0]) }, persist: async () => { persisted = true } })
    const lost: typeof fetch = async (url, init) => { assert.ok(persisted); const response = await transport(url, init); assert.equal(response.status, 200); await response.body?.cancel(); throw Error('lost_response') }
    assert.equal((await submitModularPurchase(contract, capsule, { fetchImpl: lost, now })).delivery, 'unresolved')
    now += 120000
    assert.equal((await submitModularPurchase(contract, capsule, { fetchImpl: transport, now, recovery: 'retained-result' })).delivery, 'validated_response')
    assert.equal(settlements, 1); assert.equal(signatures, 1)
    now = CLOCK + retain * 1000
    const expired = await transport(ORIGIN + e.path, { method: 'POST', headers: { ...capsule.headers, 'X-Maha-Recovery-Mode': 'retained-result' }, body: JSON.stringify(capsule.input) })
    assert.equal(expired.status, 410); assert.equal(settlements, 1)
  })
}
