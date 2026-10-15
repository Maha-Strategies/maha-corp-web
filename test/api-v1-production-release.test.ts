import test from 'node:test'
import assert from 'node:assert/strict'
import { privateKeyToAccount } from 'viem/accounts'
import { PRODUCTION_ENDPOINTS, ORIGINAL_PRODUCTION_ENDPOINTS, PRODUCTION_ADDITION_ENDPOINTS, NEXT_PRODUCTION_ENDPOINTS, BATCH201_PRODUCTION_ENDPOINTS, MODULAR_RELEASE, MODULAR_ADDITIONS, MODULAR_NEXT_ADDITIONS, MODULAR_201_ADDITIONS, releaseExample, modularLedgerPrices } from '../lib/api-v1/production-release.ts'
import { ENDPOINTS } from '../lib/api-v1/endpoints.registry.ts'
import { handlerFor } from '../lib/api-v1/handlers.ts'
import { createEndpointRouter } from '../lib/api-v1/router.ts'
import { memoryPaymentStore } from '../lib/api-v1/payment-store.ts'
import { prepareModularPurchase, submitModularPurchase } from '../lib/x402/modular-buyer.ts'
import { decodeChallenge } from '../lib/x402/client.ts'
import { parsePaymentHeader } from '../lib/x402/protocol.ts'
import { assertModularQuote, CAP } from '../scripts/run-modular-indexing.ts'
import { assertAdditionQuote } from '../scripts/run-modular204-indexing.ts'
import { assertNextQuote } from '../scripts/run-modular125-indexing.ts'
import { assertBatch201Quote } from '../scripts/run-modular201-indexing.ts'
import { searchEndpoints, describeById } from '../lib/api-v1/discovery.ts'
import { validate } from './helpers/json-schema.ts'
import { assertFrozenDelivery } from '../lib/api-v1/frozen-delivery.ts'
const account = privateKeyToAccount(('0x' + '42'.repeat(32)) as `0x${string}`)
const ORIGIN = 'https://www.mahastrategies.com', TX = '0x' + 'ab'.repeat(32), CLOCK = Date.parse('2026-10-14T06:00:00Z')
const env = { NODE_ENV: 'production', VERCEL: '1', BASE_PAYEE_ADDRESS: MODULAR_RELEASE.payee }
test('826-product release preserves the original 625 and adds only the approved 201', () => {
  assert.equal(ORIGINAL_PRODUCTION_ENDPOINTS.length, 296); assert.equal(ORIGINAL_PRODUCTION_ENDPOINTS.reduce((n, e) => n + BigInt(e.amount), 0n), CAP)
  assert.equal(PRODUCTION_ENDPOINTS.length, 826); assert.equal(PRODUCTION_ADDITION_ENDPOINTS.length, 204)
  assert.equal(BATCH201_PRODUCTION_ENDPOINTS.length, 201)
  assert.equal(BATCH201_PRODUCTION_ENDPOINTS.reduce((n, e) => n + BigInt(e.amount), 0n), 7231980n)
  assert.equal(MODULAR_201_ADDITIONS.maximumBaseUnits, '7231980'); assert.equal(MODULAR_201_ADDITIONS.automaticRepayment, false)
  assert.equal(NEXT_PRODUCTION_ENDPOINTS.length, 125)
  assert.equal(NEXT_PRODUCTION_ENDPOINTS.reduce((n, e) => n + BigInt(e.amount), 0n), 3574095n)
  assert.equal(MODULAR_NEXT_ADDITIONS.maximumBaseUnits, '3574095'); assert.equal(MODULAR_NEXT_ADDITIONS.automaticRepayment, false)
  assert.equal(PRODUCTION_ADDITION_ENDPOINTS.reduce((n, e) => n + BigInt(e.amount), 0n), 2534496n)
  assert.equal(MODULAR_ADDITIONS.maximumBaseUnits, '2534496'); assert.equal(MODULAR_ADDITIONS.automaticRepayment, false)
  assert.equal(ENDPOINTS.filter(e => e.status === 'local-implemented').length, 1000)
  assert.ok(ENDPOINTS.every(e => !e.productionApproved)); assert.equal(searchEndpoints({}).totalMatches, 826)
  assert.ok(PRODUCTION_ENDPOINTS.every(e => e.execution_cost?.mode === 'local-cpu-wasm' && !e.execution_cost.liveModelSpendApproved && e.sourceReview !== 'pending'))
  assert.equal(new Set(modularLedgerPrices().map(e => e.id)).size, 826)
  assert.equal(describeById('book-section-the-maha-principle'), undefined)
})
for (const e of PRODUCTION_ENDPOINTS) test('production quote, delivery, response loss and no-repayment recovery: ' + e.id, async () => {
  let now = CLOCK, settlements = 0, recorded = 0
  const h = handlerFor(e.id, e.amount)!, example = releaseExample(e.id)!, input = h.input.parse(example.input)
  assertFrozenDelivery(e.id, await h.execute(input), example.output)
  const router = createEndpointRouter({ environment: env, now: () => now, store: memoryPaymentStore(() => now, 1000),
    facilitator: { verify: async payment => {
      const auth = payment.payload.authorization as { validAfter: string; validBefore: string }
      // A realistic lagging chain clock would reject the old one-second backdate.
      assert.ok(BigInt(auth.validAfter) < BigInt(Math.floor(now / 1000) - 4))
      return { ok: true, payer: account.address }
    }, settle: async () => { settlements++; return { ok: true, payer: account.address, transaction: TX } } },
    confirm: async () => true, recordDelivery: async () => { recorded++ } })
  const transport: typeof fetch = async (url, options) => router(new Request(String(url), options))
  const quote = await router(new Request(ORIGIN + e.path, { method: 'POST' }))
  assert.equal(quote.status, 402)
  if (ORIGINAL_PRODUCTION_ENDPOINTS.some(p => p.id === e.id)) assertModularQuote(decodeChallenge(quote.headers.get('PAYMENT-REQUIRED')!), e.id)
  else if (PRODUCTION_ADDITION_ENDPOINTS.some(p => p.id === e.id)) assertAdditionQuote(decodeChallenge(quote.headers.get('PAYMENT-REQUIRED')!), e.id)
  else if (NEXT_PRODUCTION_ENDPOINTS.some(p => p.id === e.id)) assertNextQuote(decodeChallenge(quote.headers.get('PAYMENT-REQUIRED')!), e.id)
  else assertBatch201Quote(decodeChallenge(quote.headers.get('PAYMENT-REQUIRED')!), e.id)
  let saved = false
  const contract = { id: e.id, path: e.path, amount: e.amount, recoverySeconds: 86400, validateInput: (x: unknown) => h.input.parse(x), validateOutput: (x: unknown) => {
    const value = h.output.parse(x); assertFrozenDelivery(e.id, value, example.output);
    assert.deepEqual(validate({ success: true, data: value, proof: { settlement_id: TX } }, e.schema.output), []); return value
  } }
  const capsule = await prepareModularPurchase(contract, { input, payer: account.address, maximumAmount: BigInt(e.amount), now,
    fetchImpl: transport, signTypedData: typed => account.signTypedData(typed as Parameters<typeof account.signTypedData>[0]), persist: async () => { saved = true } })
  assert.ok(saved); assert.ok(capsule.headers['PAYMENT-SIGNATURE'].length < 12000)
  const payment = parsePaymentHeader(capsule.headers['PAYMENT-SIGNATURE']); assert.ok(payment.ok)
  const auth = payment.payment.payload.authorization as { validAfter: string; validBefore: string }
  assert.equal(auth.validAfter, String(Math.floor(CLOCK / 1000) - 600))
  assert.equal(auth.validBefore, String(Math.floor(CLOCK / 1000) + 59))
  const lost: typeof fetch = async (url, options) => { const response = await transport(url, options); assert.equal(response.status, 200); await response.body?.cancel(); throw Error('lost_response') }
  assert.equal((await submitModularPurchase(contract, capsule, { fetchImpl: lost, now })).delivery, 'unresolved')
  now += 120000
  const recovered = await submitModularPurchase(contract, capsule, { fetchImpl: transport, now, recovery: 'retained-result' })
  assert.equal(recovered.delivery, 'validated_response'); assert.equal(recovered.replayed, true); assert.equal(settlements, 1); assert.equal(recorded, 2)
  now = CLOCK + 86400000
  await assert.rejects(submitModularPurchase(contract, capsule, { fetchImpl: transport, now, recovery: 'retained-result' }), /expired/)
  assert.equal(settlements, 1)
})
test('unselected and unbuilt products cannot receive a production quote', async () => {
  const router = createEndpointRouter({ environment: env })
  for (const e of ENDPOINTS.filter(e => !PRODUCTION_ENDPOINTS.some(p => p.id === e.id))) {
    assert.equal((await router(new Request(ORIGIN + e.path, { method: e.method }))).status, 404)
  }
})
