import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { ADDITION_CAP, ADDITION_CONFIRMATION, assertAdditionAdmission, assertAdditionQuote } from '../scripts/run-modular204-indexing.ts'
import { MODULAR_ADDITIONS, PRODUCTION_ADDITION_ENDPOINTS, PRODUCTION_ENDPOINTS, releaseExample } from '../lib/api-v1/production-release.ts'
import { handlerFor } from '../lib/api-v1/handlers.ts'
import { modularBazaar } from '../lib/api-v1/bazaar.ts'
import { createEndpointRouter } from '../lib/api-v1/router.ts'
import { decodeChallenge } from '../lib/x402/client.ts'
import { paymentRequiredHeaderBytes, PAYMENT_REQUIRED_HEADER_LIMIT } from '../lib/x402/response-header-budget.ts'
import { validate } from './helpers/json-schema.ts'

const admitted = { GITHUB_ACTIONS: 'true', GITHUB_REF: 'refs/heads/main', GITHUB_RUN_ATTEMPT: '1', MODULAR204_CONFIRMATION: ADDITION_CONFIRMATION, MODULAR204_OUTPUT_PATH: '/tmp/test-only-evidence.json' }
test('independent schema reader enforces unique items, property counts and property-name schemas', () => {
  assert.notDeepEqual(validate([{ a: 1, b: 2 }, { b: 2, a: 1 }], { type: 'array', uniqueItems: true }), [])
  assert.deepEqual(validate([{ a: 1 }, { a: 2 }], { type: 'array', uniqueItems: true }), [])
  const schema = { type: 'object', minProperties: 1, maxProperties: 1, propertyNames: { type: 'string', pattern: '^[a-z]+$' } }
  assert.deepEqual(validate({ valid: 1 }, schema), [])
  for (const value of [{}, { valid: 1, extra: 2 }, { 'not-valid': 1 }]) assert.notDeepEqual(validate(value, schema), [])
})
test('204 indexing admission requires the exact first main run, operator wallet, explicit cap and sufficient balance', () => {
  assert.equal(ADDITION_CAP, 2534496n)
  assert.doesNotThrow(() => assertAdditionAdmission(admitted, MODULAR_ADDITIONS.operatorWallet, ADDITION_CAP))
  for (const field of Object.keys(admitted)) assert.throws(() => assertAdditionAdmission({ ...admitted, [field]: '' }, MODULAR_ADDITIONS.operatorWallet, ADDITION_CAP))
  for (const patch of [{ GITHUB_RUN_ATTEMPT: '2' }, { GITHUB_REF: 'refs/heads/unreviewed' }, { MODULAR204_CONFIRMATION: 'approve_any_amount' }]) assert.throws(() => assertAdditionAdmission({ ...admitted, ...patch }, MODULAR_ADDITIONS.operatorWallet, ADDITION_CAP))
  assert.throws(() => assertAdditionAdmission(admitted, MODULAR_ADDITIONS.payee, ADDITION_CAP))
  assert.throws(() => assertAdditionAdmission(admitted, MODULAR_ADDITIONS.operatorWallet, ADDITION_CAP - 1n))
})
test('new indexing manifest has exact approved count, price sum and operator exclusions', () => {
  assert.equal(PRODUCTION_ADDITION_ENDPOINTS.length, 204)
  assert.equal(PRODUCTION_ADDITION_ENDPOINTS.reduce((n, e) => n + BigInt(e.amount), 0n), ADDITION_CAP)
  assert.equal(MODULAR_ADDITIONS.customerRevenue, false); assert.equal(MODULAR_ADDITIONS.organicDemand, false); assert.equal(MODULAR_ADDITIONS.automaticRepayment, false)
  assert.ok(PRODUCTION_ADDITION_ENDPOINTS.every(e => e.execution_cost?.mode === 'local-cpu-wasm' && e.sourceReview !== 'pending'))
})
test('all 500 seller quotes fit the response-header limit and inline inputs remain callable', async () => {
  const route = createEndpointRouter({ environment: { NODE_ENV: 'production', VERCEL: '1', BASE_PAYEE_ADDRESS: MODULAR_ADDITIONS.payee }, facilitator: {
    verify: async () => { throw Error('must_not_verify') }, settle: async () => { throw Error('must_not_settle') } } })
  for (const e of PRODUCTION_ENDPOINTS) {
    const response = await route(new Request('https://www.mahastrategies.com' + e.path, { method: 'POST' }))
    assert.equal(response.status, 402, e.id)
    const encoded = response.headers.get('PAYMENT-REQUIRED')!
    assert.ok(paymentRequiredHeaderBytes(encoded) <= PAYMENT_REQUIRED_HEADER_LIMIT, e.id)
    const quote = decodeChallenge(encoded), bazaar = quote.extensions?.bazaar as { info: { input: { body: unknown } } }
    const handler = handlerFor(e.id, e.amount)!, example = handler.input.parse(bazaar.info.input.body)
    // These existing vendor annotations describe byte/semantic checks enforced
    // by the parser, not additional standard JSON Schema keywords.
    const schema = { ...e.schema.input }; delete schema['x-max-request-bytes']; delete schema['x-semantic-rules']
    assert.deepEqual(validate(example, schema), [], e.id)
    handler.output.parse(await handler.execute(example))
    if (PRODUCTION_ADDITION_ENDPOINTS.some(p => p.id === e.id)) {
      assertAdditionQuote(quote, e.id)
      const changed = structuredClone(quote); changed.accepts[0].amount = String(BigInt(e.amount) + 1n)
      assert.throws(() => assertAdditionQuote(changed, e.id), /terms_changed/)
    }
  }
})
test('compact epoch examples do not alter the full indexing request or hosted schema', () => {
  for (const id of ['orbital-records-timestamp-order-audit', 'ephemeris-snapshots-timestamp-order-audit', 'planetary-measurements-timestamp-order-audit']) {
    const e = PRODUCTION_ADDITION_ENDPOINTS.find(e => e.id === id)!, original = releaseExample(id)!.input as { rows: unknown[] }
    const declaration = modularBazaar(e).bazaar as { info: { input: { body: { rows: unknown[] } } } }
    assert.equal(original.rows.length, 2); assert.equal(declaration.info.input.body.rows.length, 1)
  }
})
test('workflow has no schedule, automatic rerun, old-296 recovery or automatic repayment route', () => {
  const workflow = readFileSync('.github/workflows/modular204-indexing.yml', 'utf8'), source = readFileSync('scripts/run-modular204-indexing.ts', 'utf8')
  assert.match(workflow, /environment: production-x402-canary/); assert.match(workflow, /github.run_attempt == 1/)
  assert.doesNotMatch(workflow, /schedule:|pull_request:|push:|modular296|rerun/)
  assert.match(source, /retryCount: 0/); assert.match(source, /uncertain_outcome_stop_without_repayment/)
  assert.equal((source.match(/submitModularPurchase\(contract, capsule/g) ?? []).length, 1)
})
