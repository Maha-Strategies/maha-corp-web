import test from 'node:test'
import assert from 'node:assert/strict'
import { createCipheriv, createHmac } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { privateKeyToAccount } from 'viem/accounts'
import { RECOVERY_BRANCH, RECOVERY_CONFIRMATION, ORIGINAL_RUN, ORIGINAL_ID, ORIGINAL_AMOUNT, REMAINING_CAP,
  assertContinuationAdmission, assertOriginalEvidence, decryptOriginalPacket, continuationBudget, recoverRetainedOnly } from '../scripts/run-modular204-continuation.ts'
import { ADDITION_CAP } from '../scripts/run-modular204-indexing.ts'
import { MODULAR_ADDITIONS, PRODUCTION_ADDITION_ENDPOINTS, releaseExample } from '../lib/api-v1/production-release.ts'
import { handlerFor } from '../lib/api-v1/handlers.ts'
import { with402Payment } from '../lib/api-v1/with402Payment.ts'
import { memoryPaymentStore } from '../lib/api-v1/payment-store.ts'
import { prepareModularPurchase, submitModularPurchase } from '../lib/x402/modular-buyer.ts'
const admitted = { GITHUB_ACTIONS: 'true', GITHUB_REF: 'refs/heads/' + RECOVERY_BRANCH, GITHUB_RUN_ATTEMPT: '1',
  MODULAR204_RECOVERY_CONFIRMATION: RECOVERY_CONFIRMATION, MODULAR204_ORIGINAL_RUN: ORIGINAL_RUN, MODULAR204_OUTPUT_PATH: '/tmp/fake.json', MODULAR204_ORIGINAL_DIRECTORY: '/tmp/original' }
const originalEvidence = () => ({ version: MODULAR_ADDITIONS.version, classification: 'publisher-funded-operator-activity', customerRevenue: false, organicDemand: false,
  automaticRepayment: false, network: MODULAR_ADDITIONS.network, wallet: MODULAR_ADDITIONS.operatorWallet, payee: MODULAR_ADDITIONS.payee,
  maximumBaseUnits: String(ADDITION_CAP), authorizedBaseUnits: String(ORIGINAL_AMOUNT), confirmedBaseUnits: '0', state: 'stopped_review_required_no_repayment',
  steps: [{ id: ORIGINAL_ID, amountBaseUnits: String(ORIGINAL_AMOUNT), state: 'authorized_outcome_unknown', status: 409, settlement: 'unknown', delivery: 'unresolved' }] })
test('continuation permits only the exact approved branch, original run, first attempt and remaining cap', () => {
  assert.equal(REMAINING_CAP, 2524388n)
  assert.doesNotThrow(() => assertContinuationAdmission(admitted, MODULAR_ADDITIONS.operatorWallet, REMAINING_CAP))
  for (const field of Object.keys(admitted)) assert.throws(() => assertContinuationAdmission({ ...admitted, [field]: '' }, MODULAR_ADDITIONS.operatorWallet, REMAINING_CAP))
  for (const patch of [{ GITHUB_REF: 'refs/heads/main' }, { GITHUB_RUN_ATTEMPT: '2' }, { MODULAR204_ORIGINAL_RUN: 'different' }])
    assert.throws(() => assertContinuationAdmission({ ...admitted, ...patch }, MODULAR_ADDITIONS.operatorWallet, REMAINING_CAP))
  assert.throws(() => assertContinuationAdmission(admitted, MODULAR_ADDITIONS.payee, REMAINING_CAP))
  assert.throws(() => assertContinuationAdmission(admitted, MODULAR_ADDITIONS.operatorWallet, REMAINING_CAP - 1n))
})
test('original evidence cannot hide another signed authorization or alter scope and classifications', () => {
  assert.doesNotThrow(() => assertOriginalEvidence(originalEvidence()))
  for (const patch of [{ authorizedBaseUnits: '0' }, { maximumBaseUnits: '999999999' }, { automaticRepayment: true }, { customerRevenue: true },
    { organicDemand: true }, { wallet: MODULAR_ADDITIONS.payee }, { network: 'eip155:137' }, { steps: [] }, { steps: [...originalEvidence().steps, ...originalEvidence().steps] }])
    assert.throws(() => assertOriginalEvidence({ ...originalEvidence(), ...patch }))
})
test('aggregate budget includes the original debit, permits only the other 203 once, and never resets its cap', () => {
  const budget = continuationBudget()
  assert.equal(budget.authorized, 10108n)
  assert.throws(() => budget.reserve(ORIGINAL_ID, String(ORIGINAL_AMOUNT)))
  assert.throws(() => budget.reserve('unapproved-product', '10000'))
  const others = PRODUCTION_ADDITION_ENDPOINTS.filter(e => e.id !== ORIGINAL_ID)
  assert.equal(others.length, 203)
  for (const e of others) { assert.throws(() => budget.reserve(e.id, String(BigInt(e.amount) + 1n))); budget.reserve(e.id, e.amount); assert.throws(() => budget.reserve(e.id, e.amount)) }
  assert.equal(budget.authorized, ADDITION_CAP)
})
test('encrypted recovery requires the exact scope, identity, key and intact GCM authentication', () => {
  const key = '0x' + '11'.repeat(32), iv = Buffer.alloc(12, 4), scope = MODULAR_ADDITIONS.version
  const cipher = createCipheriv('aes-256-gcm', createHmac('sha256', key).update(scope + ':private-outbox').digest(), iv); cipher.setAAD(Buffer.from(scope))
  const capsule = { id: ORIGINAL_ID, amount: '10108', fixtureOnly: true }, ciphertext = Buffer.concat([cipher.update(JSON.stringify(capsule)), cipher.final()])
  const data = { scope, packets: [{ id: ORIGINAL_ID, iv: iv.toString('hex'), tag: cipher.getAuthTag().toString('hex'), ciphertext: ciphertext.toString('base64') }] }
  assert.deepEqual(decryptOriginalPacket(data, key), capsule)
  assert.throws(() => decryptOriginalPacket(data, '0x' + '22'.repeat(32)))
  assert.throws(() => decryptOriginalPacket({ ...data, scope: 'other' }, key))
  assert.throws(() => decryptOriginalPacket({ ...data, packets: [{ ...data.packets[0], id: 'other' }] }, key))
  assert.throws(() => decryptOriginalPacket({ ...data, packets: [{ ...data.packets[0], tag: '00'.repeat(16) }] }, key))
})
async function rig(confirmAfter: number) {
  const account = privateKeyToAccount(('0x' + '22'.repeat(32)) as `0x${string}`), transaction = '0x' + 'cd'.repeat(32)
  let time = Date.now(), confirmations = 0, settlements = 0, signs = 0
  const e = PRODUCTION_ADDITION_ENDPOINTS.find(e => e.id === ORIGINAL_ID)!, h = handlerFor(e.id, e.amount)!, sample = releaseExample(e.id)!
  const route = with402Payment(e, h, { environment: { NODE_ENV: 'test', BASE_PAYEE_ADDRESS: MODULAR_ADDITIONS.payee }, now: () => time,
    store: memoryPaymentStore(() => time), facilitator: { verify: async () => ({ ok: true, payer: account.address }),
      settle: async () => { settlements++; return { ok: true, payer: account.address, transaction } } }, confirm: async () => ++confirmations >= confirmAfter })
  const fetchImpl: typeof fetch = async (url, init) => route(new Request(String(url), init))
  const contract = { id: e.id, path: e.path, amount: e.amount, recoverySeconds: 86400, validateInput: (x: unknown) => h.input.parse(x), validateOutput: (x: unknown) => h.output.parse(x) }
  const capsule = await prepareModularPurchase(contract, { input: sample.input, payer: account.address, maximumAmount: BigInt(e.amount), now: time, fetchImpl,
    signTypedData: async typed => { signs++; return account.signTypedData(typed as Parameters<typeof account.signTypedData>[0]) }, persist: async () => {} })
  const submit: typeof submitModularPurchase = (c, s, opts) => submitModularPurchase(c, s, { ...opts, now: time })
  return { contract, capsule, fetchImpl, submit, delay: async (ms: number) => { time += ms }, counts: () => ({ signs, settlements, confirmations }) }
}
test('pending receipt recovers the original response after authorization expiry with one settlement and no new signature', async () => {
  const r = await rig(3)
  const first = await r.submit(r.contract, r.capsule, { fetchImpl: r.fetchImpl })
  assert.equal(first.delivery, 'unresolved'); assert.equal('errorCode' in first && first.errorCode, 'settlement_confirmation_pending_do_not_repay')
  await r.delay(120000)
  const result = await recoverRetainedOnly(r.contract, r.capsule, { submit: r.submit, delay: r.delay, fetchImpl: r.fetchImpl })
  assert.equal(result.delivery, 'validated_response'); assert.equal('replayed' in result && result.replayed, true)
  assert.deepEqual(r.counts(), { signs: 1, settlements: 1, confirmations: 3 })
})
test('a signed but unsubmitted purchase cannot be charged by retained recovery', async () => {
  const r = await rig(1)
  await assert.rejects(recoverRetainedOnly(r.contract, r.capsule, { submit: r.submit, delay: r.delay, fetchImpl: r.fetchImpl }), /unresolved_stop/)
  assert.deepEqual(r.counts(), { signs: 1, settlements: 0, confirmations: 0 })
})
test('unconfirmed recovery has a hard three-read bound, never another settlement', async () => {
  const r = await rig(99)
  await r.submit(r.contract, r.capsule, { fetchImpl: r.fetchImpl })
  await assert.rejects(recoverRetainedOnly(r.contract, r.capsule, { submit: r.submit, delay: r.delay, fetchImpl: r.fetchImpl }), /unresolved_stop/)
  assert.deepEqual(r.counts(), { signs: 1, settlements: 1, confirmations: 4 })
})
test('workflow pins the original artifact and temporary branch; original request has one submission site', () => {
  const workflow = readFileSync('.github/workflows/modular204-indexing.yml', 'utf8'), source = readFileSync('scripts/run-modular204-continuation.ts', 'utf8')
  assert.match(workflow, /refs\/heads\/codex\/modular204-recovery-20261015/)
  assert.match(workflow, /artifact-ids: '11954678693'/); assert.match(workflow, /run-id: '38697859110'/)
  assert.match(workflow, /github.run_attempt == 1/); assert.match(workflow, /environment: production-x402-canary/)
  assert.doesNotMatch(workflow, /schedule:|pull_request:|push:|vercel deploy|modular296/)
  assert.equal((source.match(/submitModularPurchase\(contract, fresh/g) ?? []).length, 1)
  assert.match(source, /retryCount: 0/)
  const recoverySource = source.slice(source.indexOf('export async function recoverRetainedOnly'), source.indexOf('const transport:'))
  assert.doesNotMatch(recoverySource, /prepareModularPurchase|signTypedData|privateKeyToAccount/)
  assert.match(recoverySource, /recovery: 'retained-result'/)
})
