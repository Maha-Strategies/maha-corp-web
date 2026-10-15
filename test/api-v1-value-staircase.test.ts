import assert from 'node:assert/strict'
import test from 'node:test'
import { ENDPOINTS, endpointById, REGISTRY_SUMMARY } from '../lib/api-v1/endpoints.registry.ts'
import { VALUE_BANDS, amountWithinBand, valueTierFor } from '../lib/api-v1/value-staircase.ts'
import { assertRegistry } from '../lib/api-v1/types.ts'
import { assertExecutionCost, minimumModelPriceUnits, createModelCostBudget, type ExecutionCost } from '../lib/api-v1/cost-policy.ts'
import { with402Payment } from '../lib/api-v1/with402Payment.ts'
import { handlerFor } from '../lib/api-v1/handlers.ts'
import { X402_OFFERS } from '../lib/x402/offers.ts'
import { prepareModularPurchase } from '../lib/x402/modular-buyer.ts'
import { prepareWorkflowPurchase } from '../lib/x402/workflow/buyer.ts'
import { GROWTH_INPUTS, CLOCK } from './api-v1-fixtures.ts'
import { MAHA_PAYEE } from '../lib/x402/merchant-identity.ts'
const model: ExecutionCost = { mode: 'external-model', expected_usdc: .015, expectedBasis: 'unmeasured-planning-assumption',
  maximum_external_cost_usdc: .02, costEnvelopeReviewed: false, liveModelSpendApproved: false }
test('all 1,000 local prices fit exact staircase bands with no sub-cent/gap prices or live offer mutations', () => {
  assert.equal(ENDPOINTS.length, 1000); assert.equal(new Set(ENDPOINTS.map(e => e.amount)).size, 1000)
  for (const e of ENDPOINTS) {
    assert.ok(amountWithinBand(e.amount, e.pricing!.tier)); assert.equal(e.productionApproved, false)
    assert.ok(Number(e.amount) >= 10000 && Number(e.amount) <= 250000)
    if (e.legacy) assert.equal(e.legacy.amount, X402_OFFERS.find(o => o.id === e.id)!.amount)
    assert.equal(e.execution_cost!.liveModelSpendApproved, false)
    if (e.status === 'proposal') assert.equal(e.pricing!.assignmentBasis, 'draft-recipe-provisional')
  }
  assert.equal(REGISTRY_SUMMARY.costsMeasured, false); assert.equal(REGISTRY_SUMMARY.marginsEstablished, false)
  assert.equal(REGISTRY_SUMMARY.revenueUpliftEstablished, false); assert.equal(REGISTRY_SUMMARY.zeroCallerFrictionEstablished, false)
})
test('inclusive tier edges are enforced and gap values cannot enter the registry', () => {
  for (const [tier, band] of Object.entries(VALUE_BANDS)) {
    const t = Number(tier) as 1 | 2 | 3
    assert.equal(amountWithinBand(String(band.minimumUnits), t), true); assert.equal(amountWithinBand(String(band.maximumUnits), t), true)
    assert.equal(amountWithinBand(String(band.minimumUnits - 1), t), false); assert.equal(amountWithinBand(String(band.maximumUnits + 1), t), false)
  }
  const e = endpointById('dataset-null-pattern-audit')!
  for (const amount of ['9999', '25001', '34999', '75001', '99999', '250001']) assert.throws(() => assertRegistry([{ ...e, amount, price_usdc: Number(amount) / 1e6 }]))
})
test('task-based tiers distinguish a micro-audit, graph diff and analytical simulation', () => {
  assert.equal(endpointById('dataset-null-pattern-audit')!.pricing!.tier, 1)
  assert.equal(endpointById('citation-locator-conversion')!.pricing!.tier, 1)
  assert.equal(endpointById('provenance-graph-integrity')!.pricing!.tier, 2)
  assert.equal(endpointById('digital-twin-config-diff')!.pricing!.tier, 2)
  assert.equal(endpointById('manufacturing-yield-sensitivity')!.pricing!.tier, 3)
  assert.equal(valueTierFor({ id: 'ephemeris-snapshots-required-field-coverage', category: 'ephemeris-snapshots', domain: 'celestial', status: 'proposal' }).tier, 1)
})
test('a $0.015 model cost requires at least $0.045, with an additional bound on total provider exposure', () => {
  assert.equal(minimumModelPriceUnits(.015), 45000)
  assert.throws(() => assertExecutionCost('10000', { ...model, maximum_external_cost_usdc: null }), /three_times/)
  assertExecutionCost('45000', { ...model, maximum_external_cost_usdc: null })
  assert.throws(() => assertExecutionCost('45000', model), /envelope/)
  assertExecutionCost('60000', model)
  for (const cost of [NaN, Infinity, -1, 0]) assert.throws(() => minimumModelPriceUnits(cost))
  for (const amount of ['NaN', '-1', '0', '9007199254740992']) assert.throws(() => assertExecutionCost(amount, model))
  assert.throws(() => assertExecutionCost('250000', { ...model, expected_usdc: .09, maximum_external_cost_usdc: null }))
  const e = endpointById('dataset-null-pattern-audit')!
  assert.throws(() => assertRegistry([{ ...e, estimated_compute_cost: .015 }]), /estimate_mismatch/)
})
test('model reservations stop before invocation at the cap, including after a timeout', () => {
  assert.throws(() => createModelCostBudget('60000', model), /not_approved/)
  const budget = createModelCostBudget('60000', { ...model, costEnvelopeReviewed: true, liveModelSpendApproved: true })
  budget.reserve(.01); assert.equal(budget.reservedUsd, .01)
  // A timeout must not release a reservation; the provider may still bill it.
  budget.reserve(.01); let invoked = false
  assert.throws(() => { budget.reserve(.000001); invoked = true }, /before_invocation/)
  assert.equal(invoked, false); assert.equal(budget.reservedUsd, .02)
  for (const cost of [0, -1, NaN, Infinity]) assert.throws(() => budget.reserve(cost))
})
test('unapproved model spending is blocked before quote, handler or facilitator activity', async () => {
  const base = endpointById('dataset-null-pattern-audit')!, amount = '60000'
  const e = { ...base, amount, price_usdc: .06, estimated_compute_cost: .015, pricing: { ...base.pricing!, tier: 2 as const }, execution_cost: model }
  let calls = 0
  const route = with402Payment(e, { ...handlerFor(e.id)!, execute: async () => { calls++; throw Error('not allowed') } }, {
    environment: { NODE_ENV: 'test', BASE_PAYEE_ADDRESS: MAHA_PAYEE }, facilitator: {
      verify: async () => { calls++; throw Error('not allowed') }, settle: async () => { calls++; throw Error('not allowed') } } })
  const response = await route(new Request('https://www.mahastrategies.com' + e.path, { method: 'POST' }))
  assert.equal(response.status, 503); assert.equal(response.headers.has('PAYMENT-REQUIRED'), false)
  assert.equal((await response.json()).error.code, 'model_spend_or_cost_envelope_unapproved_no_payment'); assert.equal(calls, 0)
})
test('explicit new price caps refuse before transport/signing; stale static workflow prices do not silently rise', async () => {
  const e = endpointById('dataset-null-pattern-audit')!, h = handlerFor(e.id)!, input = GROWTH_INPUTS['dataset-null-pattern-audit']
  let calls = 0, signatures = 0
  const sign = async () => { signatures++; throw Error('must not sign') }
  const route = with402Payment(e, h, { environment: { NODE_ENV: 'test', BASE_PAYEE_ADDRESS: MAHA_PAYEE },
    facilitator: { verify: async () => { throw Error('no verification') }, settle: async () => { throw Error('no settlement') } } })
  const fetchImpl = (async (url: string | URL | Request, init?: RequestInit) => { calls++; return route(new Request(url, init)) }) as typeof fetch
  const c = { id: e.id, path: e.path, amount: e.amount, recoverySeconds: 86400, validateInput: (v: unknown) => h.input.parse(v), validateOutput: (v: unknown) => h.output.parse(v) }
  await assert.rejects(prepareModularPurchase(c, { input, payer: '0x' + '11'.repeat(20), maximumAmount: BigInt(e.amount) - BigInt(1), signTypedData: sign, fetchImpl, persist: async () => {}, now: CLOCK }), /cap/)
  assert.equal(calls, 0)
  await assert.rejects(prepareWorkflowPurchase({ productId: 'dataset-null-pattern-audit', input, network: 'eip155:8453', payer: '0x' + '11'.repeat(20), maximumAmount: BigInt(e.amount), signTypedData: sign, fetchImpl, persist: async () => {}, now: CLOCK }), /quote_terms_mismatch/)
  assert.equal(calls, 1); assert.equal(signatures, 0)
})
