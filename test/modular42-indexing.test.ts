import test from 'node:test'
import assert from 'node:assert/strict'
import { BATCH42_CAP, BATCH42_CONFIRMATION, assertBatch42Admission, batch42Budget, recoverBatch42RetainedOnly } from '../scripts/run-modular42-indexing.ts'
import { FINAL42_PRODUCTION_ENDPOINTS, MODULAR_42_ADDITIONS } from '../lib/api-v1/production-release.ts'
import type { ModularBuyerContract, ModularCapsule, submitModularPurchase } from '../lib/x402/modular-buyer.ts'
test('final indexing admission is main-only, first workflow run/attempt, exact wallet and funded cap', () => {
  const env = { GITHUB_ACTIONS: 'true', GITHUB_REF: 'refs/heads/main', GITHUB_RUN_ATTEMPT: '1', GITHUB_RUN_NUMBER: '1', MODULAR42_CONFIRMATION: BATCH42_CONFIRMATION, MODULAR42_OUTPUT_PATH: 'private-evidence.json' }
  assert.equal(BATCH42_CAP, 2592940n)
  assertBatch42Admission(env, MODULAR_42_ADDITIONS.operatorWallet, BATCH42_CAP)
  for (const patch of [{ GITHUB_REF: 'refs/heads/unapproved' }, { GITHUB_RUN_ATTEMPT: '2' }, { GITHUB_RUN_NUMBER: '2' }, { MODULAR42_CONFIRMATION: 'wrong' }, { GITHUB_ACTIONS: 'false' }])
    assert.throws(() => assertBatch42Admission({ ...env, ...patch }, MODULAR_42_ADDITIONS.operatorWallet, BATCH42_CAP))
  assert.throws(() => assertBatch42Admission(env, MODULAR_42_ADDITIONS.operatorWallet, BATCH42_CAP - 1n))
  assert.throws(() => assertBatch42Admission(env, '0x' + '1'.repeat(40), BATCH42_CAP))
})
test('42-product budget reserves exact unique registry prices and cannot authorize duplicate or unapproved payments', () => {
  const budget = batch42Budget()
  for (const e of FINAL42_PRODUCTION_ENDPOINTS) budget.reserve(e.id, e.amount)
  assert.equal(budget.authorized, BATCH42_CAP)
  assert.throws(() => budget.reserve(FINAL42_PRODUCTION_ENDPOINTS[0].id, FINAL42_PRODUCTION_ENDPOINTS[0].amount))
  assert.throws(() => batch42Budget().reserve('context-compression', '1'))
  assert.throws(() => batch42Budget().reserve('not-in-approved-batch', '10000'))
})
test('transient receipt-reader errors allow bounded retained-only reads, never a new signature or settlement request', async () => {
  const contract = {} as ModularBuyerContract, capsule = {} as ModularCapsule
  let reads = 0, waits = 0
  const submit: typeof submitModularPurchase = async (c, saved, options) => {
    assert.equal(c, contract); assert.equal(saved, capsule); assert.equal(options?.recovery, 'retained-result'); reads++
    return reads < 4 ? { delivery: 'unresolved', settlement: 'unknown', errorCode: 'retained_evidence_invalid_or_unavailable_do_not_repay', status: 409, automaticRepayment: false, data: null, transaction: null }
      : { delivery: 'validated_response', settlement: 'provider_reported', transaction: '0x' + 'a'.repeat(64), data: {}, replayed: true, status: 200, automaticRepayment: false }
  }
  const result = await recoverBatch42RetainedOnly(contract, capsule, { submit, delay: async () => { waits++ } })
  assert.equal(result.delivery, 'validated_response'); assert.equal(reads, 4); assert.equal(waits, 3)
  reads = 0
  const unresolved: typeof submitModularPurchase = async (_c, _saved, options) => { assert.equal(options?.recovery, 'retained-result'); reads++; return { delivery: 'unresolved', settlement: 'unknown', errorCode: 'settlement_unknown_do_not_repay', status: 409, automaticRepayment: false, data: null, transaction: null } }
  await assert.rejects(recoverBatch42RetainedOnly(contract, capsule, { submit: unresolved, delay: async () => {} }), /stop_without_repayment/)
  assert.equal(reads, 10)
})
