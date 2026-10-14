import test from 'node:test'
import assert from 'node:assert/strict'
import { createCipheriv, createHmac } from 'node:crypto'
import { privateKeyToAccount } from 'viem/accounts'
import { PRODUCTION_ENDPOINTS, MODULAR_RELEASE, releaseExample } from '../lib/api-v1/production-release.ts'
import { handlerFor } from '../lib/api-v1/handlers.ts'
import { createEndpointRouter } from '../lib/api-v1/router.ts'
import { memoryPaymentStore } from '../lib/api-v1/payment-store.ts'
import { prepareModularPurchase, submitModularPurchase, type ModularCapsule } from '../lib/x402/modular-buyer.ts'
import { checkRefusedOriginal } from '../lib/x402/modular-retry.ts'
import { CAP } from '../scripts/run-modular-indexing.ts'

const key = ('0x' + '42'.repeat(32)) as `0x${string}`, account = privateKeyToAccount(key)
const CLOCK = Date.parse('2026-10-14T06:30:00Z'), SCOPE = MODULAR_RELEASE.version
const first = PRODUCTION_ENDPOINTS[0], h = handlerFor(first.id, first.amount)!
const contract = { id: first.id, path: first.path, amount: first.amount, recoverySeconds: 86400,
  validateInput: (x: unknown) => h.input.parse(x), validateOutput: (x: unknown) => h.output.parse(x) }
const router = createEndpointRouter({ environment: { NODE_ENV: 'production', VERCEL: '1', BASE_PAYEE_ADDRESS: MODULAR_RELEASE.payee }, now: () => CLOCK, store: memoryPaymentStore(() => CLOCK),
  facilitator: { verify: async () => { throw Error('no_paid_request_in_gate_test') }, settle: async () => { throw Error('no_settlement_in_gate_test') } } })
const quote: typeof fetch = (url, options) => router(new Request(String(url), options))
const original = await prepareModularPurchase(contract, { input: releaseExample(first.id)!.input, payer: account.address,
  maximumAmount: BigInt(first.amount), now: CLOCK - 120000, secret: createHmac('sha256', key).update(SCOPE + ':' + first.id).digest('hex'),
  fetchImpl: quote, signTypedData: typed => account.signTypedData(typed as Parameters<typeof account.signTypedData>[0]), persist: async () => {} })
function encrypt(capsule: ModularCapsule) {
  const iv = Buffer.alloc(12, 1), cipher = createCipheriv('aes-256-gcm', createHmac('sha256', key).update(SCOPE + ':private-outbox').digest(), iv)
  cipher.setAAD(Buffer.from(SCOPE))
  return { scope: SCOPE, packets: [{ id: first.id, iv: iv.toString('hex'), ciphertext: Buffer.concat([cipher.update(JSON.stringify(capsule)), cipher.final()]).toString('base64'), tag: cipher.getAuthTag().toString('hex') }] }
}
const report = { version: SCOPE, classification: 'publisher-funded-operator-activity', customerRevenue: false, organicDemand: false, automaticRepayment: false,
  network: MODULAR_RELEASE.network, buyer: account.address, payee: MODULAR_RELEASE.payee, maximumBaseUnits: String(CAP), authorizedBaseUnits: first.amount,
  confirmedBaseUnits: '0', state: 'stopped_review_required_no_repayment', steps: [{ id: first.id, path: first.path, amountBaseUnits: first.amount, state: 'authorized_outcome_unknown' }] }
const options = () => ({ key, payer: account.address, scope: SCOPE, payee: MODULAR_RELEASE.payee, maximumBaseUnits: String(CAP), contract,
  report: structuredClone(report), outbox: encrypt(original), now: CLOCK, chainTimestamp: BigInt(Math.floor(CLOCK / 1000) - 4), authorizationUsed: async () => false })
test('explicit controlled retry gate requires expired authentic unused original, without signing', async () => {
  let reads = 0
  const result = await checkRefusedOriginal({ ...options(), authorizationUsed: async () => { reads++; return false } })
  assert.equal(reads, 1); assert.equal(result.previousNonceUnused, true); assert.equal(result.previousAuthorizationExpired, true)
  assert.equal(JSON.stringify(result).includes(original.headers['X-Maha-Recovery-Secret']), false)
  assert.equal(JSON.stringify(result).includes(original.headers['PAYMENT-SIGNATURE']), false)
})
test('used original authorization fails closed', async () => {
  await assert.rejects(checkRefusedOriginal({ ...options(), authorizationUsed: async () => true }), /used_do_not_repay/)
})
test('both wall and chain clocks must show original expiry', async () => {
  for (const change of [{ now: CLOCK - 90000 }, { chainTimestamp: BigInt(Math.floor(CLOCK / 1000) - 90) }])
    await assert.rejects(checkRefusedOriginal({ ...options(), ...change }), /not_expired/)
})
test('modified encrypted private outbox fails authentication', async () => {
  const o = options(); o.outbox.packets[0].tag = '00'.repeat(16)
  await assert.rejects(checkRefusedOriginal(o), /authentication_failed/)
})
test('changed caps, settled report, extra authorization or wrong scope prevent retry', async () => {
  for (const change of [{ maximumBaseUnits: '6098841' }, { confirmedBaseUnits: '1' }, { version: 'other' }, { steps: [...report.steps, ...report.steps] }])
    await assert.rejects(checkRefusedOriginal({ ...options(), report: { ...report, ...change } }), /scope_mismatch/)
})
test('authenticated outbox with modified input or signature cannot authorize a replacement', async () => {
  const altered = structuredClone(original); altered.headers['X-Maha-Input-Hash'] = '0'.repeat(64)
  await assert.rejects(checkRefusedOriginal({ ...options(), outbox: encrypt(altered) }), /invalid_or_expired/)
})
test('refused payment records sanitized status and does not retry or claim no settlement', async () => {
  let requests = 0
  const result = await submitModularPurchase(contract, original, { now: CLOCK, fetchImpl: async () => {
    requests++; return Response.json({ error: { code: 'authorization_refused_no_payment' }, privateDiagnostic: 'not-for-logs' }, { status: 400 })
  } })
  assert.equal(requests, 1); assert.equal(result.settlement, 'unknown'); assert.equal(result.automaticRepayment, false)
  assert.ok('errorCode' in result); assert.equal(result.errorCode, 'authorization_refused_no_payment')
  assert.ok('status' in result); assert.equal(result.status, 400); assert.equal(JSON.stringify(result).includes('not-for-logs'), false)
})
test('untrusted provider error text is never copied into evidence', async () => {
  const result = await submitModularPurchase(contract, original, { now: CLOCK, fetchImpl: async () => Response.json({ error: { code: 'private-provider-key' } }, { status: 500 }) })
  assert.ok('errorCode' in result); assert.equal(result.errorCode, 'unclassified_http_failure')
})
