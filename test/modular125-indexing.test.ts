import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { privateKeyToAccount } from 'viem/accounts'
import { NEXT_CAP, NEXT_CONFIRMATION, assertNextAdmission, assertNextQuote, nextBudget, recoverNextRetainedOnly } from '../scripts/run-modular125-indexing.ts'
import { NEXT_PRODUCTION_ENDPOINTS, MODULAR_NEXT_ADDITIONS, releaseExample, PRODUCTION_ENDPOINTS } from '../lib/api-v1/production-release.ts'
import { handlerFor } from '../lib/api-v1/handlers.ts'
import { createEndpointRouter } from '../lib/api-v1/router.ts'
import { memoryPaymentStore } from '../lib/api-v1/payment-store.ts'
import { prepareModularPurchase, submitModularPurchase } from '../lib/x402/modular-buyer.ts'
import { decodeChallenge } from '../lib/x402/client.ts'
import { validate } from './helpers/json-schema.ts'
import { paymentRequiredHeaderBytes, PAYMENT_REQUIRED_HEADER_LIMIT } from '../lib/x402/response-header-budget.ts'
const env = { GITHUB_ACTIONS: 'true', GITHUB_REF: 'refs/heads/main', GITHUB_RUN_ATTEMPT: '1', MODULAR125_CONFIRMATION: NEXT_CONFIRMATION, MODULAR125_OUTPUT_PATH: '/tmp/test-only-evidence.json' }
const unpaidOnlyFacilitator = { verify: async () => { throw Error('no_paid_request_allowed') }, settle: async () => { throw Error('no_settlement_allowed') } }
test('125 exact reviewed CPU/WASM contracts fit the observed wallet without model spending or unreviewed sources', () => {
  assert.equal(PRODUCTION_ENDPOINTS.length, 958); assert.equal(NEXT_PRODUCTION_ENDPOINTS.length, 125)
  assert.equal(NEXT_PRODUCTION_ENDPOINTS.reduce((n, e) => n + BigInt(e.amount), 0n), NEXT_CAP)
  assert.equal(3588786n - NEXT_CAP, 14691n)
  assert.equal(MODULAR_NEXT_ADDITIONS.customerRevenue, false); assert.equal(MODULAR_NEXT_ADDITIONS.organicDemand, false)
  assert.equal(MODULAR_NEXT_ADDITIONS.automaticRepayment, false)
  for (const e of NEXT_PRODUCTION_ENDPOINTS) {
    assert.equal(e.execution_cost?.mode, 'local-cpu-wasm'); assert.equal(e.execution_cost?.liveModelSpendApproved, false)
    assert.notEqual(e.sourceReview, 'pending'); assert.notEqual(e.id, 'context-compression'); assert.notEqual(e.id, 'x402-quote-change-report')
  }
})
test('indexing admission is restricted to the exact first main run, wallet, cap and sufficient funds', () => {
  assert.doesNotThrow(() => assertNextAdmission(env, MODULAR_NEXT_ADDITIONS.operatorWallet, NEXT_CAP))
  for (const name of Object.keys(env)) assert.throws(() => assertNextAdmission({ ...env, [name]: '' }, MODULAR_NEXT_ADDITIONS.operatorWallet, NEXT_CAP))
  for (const patch of [{ GITHUB_RUN_ATTEMPT: '2' }, { GITHUB_REF: 'refs/heads/unreviewed' }, { MODULAR125_CONFIRMATION: 'any_amount' }])
    assert.throws(() => assertNextAdmission({ ...env, ...patch }, MODULAR_NEXT_ADDITIONS.operatorWallet, NEXT_CAP))
  assert.throws(() => assertNextAdmission(env, MODULAR_NEXT_ADDITIONS.payee, NEXT_CAP))
  assert.throws(() => assertNextAdmission(env, MODULAR_NEXT_ADDITIONS.operatorWallet, NEXT_CAP - 1n))
})
test('budget reserves each approved contract once and rejects old products and changed prices', () => {
  const budget = nextBudget(), first = NEXT_PRODUCTION_ENDPOINTS[0]
  assert.throws(() => budget.reserve('context-compression', '35001'))
  assert.throws(() => budget.reserve(first.id, String(BigInt(first.amount) + 1n)))
  for (const e of NEXT_PRODUCTION_ENDPOINTS) budget.reserve(e.id, e.amount)
  assert.equal(budget.authorized, NEXT_CAP); assert.throws(() => budget.reserve(first.id, first.amount))
})
test('all 125 Bazaar challenges fit default-client header limits with callable examples and unchanged hosted schemas', async () => {
  const route = createEndpointRouter({ environment: { NODE_ENV: 'production', VERCEL: '1', BASE_PAYEE_ADDRESS: MODULAR_NEXT_ADDITIONS.payee }, facilitator: unpaidOnlyFacilitator, store: memoryPaymentStore() })
  for (const e of NEXT_PRODUCTION_ENDPOINTS) {
    const response = await route(new Request('https://www.mahastrategies.com' + e.path, { method: 'POST' }))
    assert.equal(response.status, 402, e.id)
    const header = response.headers.get('PAYMENT-REQUIRED')!
    assert.ok(paymentRequiredHeaderBytes(header) <= PAYMENT_REQUIRED_HEADER_LIMIT, e.id)
    const quote = decodeChallenge(header); assertNextQuote(quote, e.id)
    const declaration = quote.extensions?.bazaar as { info: { input: { body: unknown } } }
    const h = handlerFor(e.id, e.amount)!, input = h.input.parse(declaration.info.input.body)
    const schema = { ...e.schema.input }; delete schema['x-max-request-bytes']; delete schema['x-semantic-rules']
    assert.deepEqual(validate(input, schema), [], e.id); h.output.parse(await h.execute(input))
    for (const field of ['amount', 'payTo', 'asset', 'network'] as const) {
      const changed = structuredClone(quote); changed.accepts[0][field] = 'tampered'
      assert.throws(() => assertNextQuote(changed, e.id))
    }
    const changed = structuredClone(quote)
    ;(changed.extensions!['maha-modular-contract'] as { info: { contractHash: string } }).info.contractHash = 'sha256:' + '0'.repeat(64)
    assert.throws(() => assertNextQuote(changed, e.id), /contract_changed/)
  }
})
test('pending first purchase is recovered after auth expiry with one signature and one settlement', async () => {
  const e = NEXT_PRODUCTION_ENDPOINTS[0], h = handlerFor(e.id, e.amount)!, sample = releaseExample(e.id)!
  const account = privateKeyToAccount(('0x' + '42'.repeat(32)) as `0x${string}`), start = Date.parse('2026-10-15T08:00:00Z')
  let now = start, confirmed = false, signatures = 0, settlements = 0
  const contract = { id: e.id, path: e.path, amount: e.amount, recoverySeconds: 86400, validateInput: (x: unknown) => h.input.parse(x), validateOutput: (x: unknown) => h.output.parse(x) }
  const router = createEndpointRouter({ environment: { NODE_ENV: 'production', VERCEL: '1', BASE_PAYEE_ADDRESS: MODULAR_NEXT_ADDITIONS.payee }, now: () => now,
    store: memoryPaymentStore(() => now), facilitator: { verify: async () => ({ ok: true, payer: account.address }),
      settle: async () => { settlements++; return { ok: true, payer: account.address, transaction: '0x' + 'ab'.repeat(32) } } }, confirm: async () => confirmed, recordDelivery: async () => {} })
  const transport: typeof fetch = (url, init) => router(new Request(String(url), init))
  const capsule = await prepareModularPurchase(contract, { input: sample.input, payer: account.address, maximumAmount: BigInt(e.amount), now,
    fetchImpl: transport, signTypedData: typed => { signatures++; return account.signTypedData(typed as Parameters<typeof account.signTypedData>[0]) }, persist: async () => {} })
  const pending = await submitModularPurchase(contract, capsule, { fetchImpl: transport, now }); assert.equal(pending.delivery, 'unresolved')
  now += 120000; confirmed = true
  const result = await recoverNextRetainedOnly(contract, capsule, { submit: (c, saved, options) => submitModularPurchase(c, saved, { ...options, now }), fetchImpl: transport })
  assert.equal(result.delivery, 'validated_response'); assert.equal(signatures, 1); assert.equal(settlements, 1)
})
test('retained-only reads are bounded and never request a replacement signature or original submission', async () => {
  let calls = 0
  const e = NEXT_PRODUCTION_ENDPOINTS[0], h = handlerFor(e.id, e.amount)!
  const contract = { id: e.id, path: e.path, amount: e.amount, recoverySeconds: 86400, validateInput: (x: unknown) => h.input.parse(x), validateOutput: (x: unknown) => h.output.parse(x) }
  const account = privateKeyToAccount(('0x' + '42'.repeat(32)) as `0x${string}`)
  const route = createEndpointRouter({ environment: { NODE_ENV: 'production', VERCEL: '1', BASE_PAYEE_ADDRESS: MODULAR_NEXT_ADDITIONS.payee }, facilitator: unpaidOnlyFacilitator, store: memoryPaymentStore() })
  const transport: typeof fetch = (url, init) => route(new Request(String(url), init))
  const capsule = await prepareModularPurchase(contract, { input: releaseExample(e.id)!.input, payer: account.address, maximumAmount: BigInt(e.amount), fetchImpl: transport,
    signTypedData: typed => account.signTypedData(typed as Parameters<typeof account.signTypedData>[0]), persist: async () => {} })
  await assert.rejects(recoverNextRetainedOnly(contract, capsule, { submit: async (_c, _saved, options) => {
    calls++; assert.equal(options?.recovery, 'retained-result')
    return { settlement: 'unknown', delivery: 'unresolved', automaticRepayment: false, status: 409, errorCode: 'settlement_confirmation_pending_do_not_repay', data: null, transaction: null }
  }, delay: async () => {} }), /unresolved_stop_without_repayment/)
  assert.equal(calls, 3)
})
test('manual protected workflow has a single original submission site, no schedule and encrypted outbox before submitting', () => {
  const workflow = readFileSync('.github/workflows/modular125-indexing.yml', 'utf8'), source = readFileSync('scripts/run-modular125-indexing.ts', 'utf8')
  assert.match(workflow, /environment: production-x402-canary/); assert.match(workflow, /github.run_attempt == 1/)
  assert.doesNotMatch(workflow, /schedule:|pull_request:|push:|rerun/)
  assert.match(source, /retryCount: 0/); assert.match(source, /createCipheriv\('aes-256-gcm'/)
  assert.match(source, /state = 'authorized_outcome_unknown'; await save/)
  assert.equal((source.match(/submitModularPurchase\(contract, capsule/g) ?? []).length, 1)
  assert.doesNotMatch(source, /zizka|supabase/i)
})
