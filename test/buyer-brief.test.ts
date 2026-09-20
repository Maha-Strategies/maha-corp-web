import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { localWorkflow, PAYEE, ASSET } from '../examples/context-growth/workflow.ts'
import { hash, requestBody, checkQuote, purchaseEvaluation, RESOURCE } from '../examples/buyer-brief/purchase.ts'
import { buildDeepContextEvaluation, parseDeepContextRequest } from '../lib/deep-context-evaluation.ts'
const terms = { scheme: 'exact', network: 'eip155:8453', amount: '10000', payTo: PAYEE, asset: ASSET, extra: { name: 'USD Coin', version: '2' }, maxTimeoutSeconds: 60 }
const challenge = { x402Version: 2, resource: { url: RESOURCE }, accepts: [terms] }
const response402 = () => new Response(null, { status: 402, headers: { 'PAYMENT-REQUIRED': Buffer.from(JSON.stringify(challenge)).toString('base64') } })
const approval = ():Parameters<typeof purchaseEvaluation>[0]['approval'] => ({ approved: true, reference: 'synthetic-test-only', requestHash: hash(JSON.stringify(requestBody())), expiresAt: new Date(Date.now() + 60000).toISOString(), amountBaseUnits: '10000', resource: RESOURCE })
test('normal and insufficient-budget outcomes remain distinct', () => {
  assert.equal(localWorkflow().summary.retained, 4)
  assert.equal(localWorkflow(64).summary.gate, 'STOP_REQUIRED_EVIDENCE_OMITTED')
})
for (const change of [{ amount: '20000000' }, { amount: '9999' }, { payTo: ASSET }, { asset: PAYEE }, { network: 'eip155:84532' }, { maxTimeoutSeconds: 301 }, { extra: { name: 'Other', version: '2' } }]) {
  test(`reject changed terms ${JSON.stringify(change)}`, () => assert.throws(() => checkQuote({ ...terms, ...change }, challenge)))
}
test('reject substituted resource', () => assert.throws(() => checkQuote(terms, { ...challenge, resource: { url: RESOURCE + '/other' } })))
test('one evaluation call; receipt not mistaken for chain confirmation; duplicate attempt blocked', async () => {
  const lockPath = join(await mkdtemp(join(tmpdir(), 'buyer-brief-test-')), 'attempt.json')
  let signatures = 0, paidCalls = 0
  const fetchImpl: typeof fetch = async (_url, init) => {
    if (!new Headers(init?.headers).has('PAYMENT-SIGNATURE')) return response402()
    paidCalls++
    return Response.json(buildDeepContextEvaluation(parseDeepContextRequest(JSON.parse(String(init?.body)))), { headers: {
      'PAYMENT-RESPONSE': Buffer.from(JSON.stringify({ success: true, network: 'eip155:8453', transaction: '0x' + '1'.repeat(64) })).toString('base64'),
    } })
  }
  const options = { address: PAYEE, signTypedData: async () => { signatures++; return '0x00' }, lockPath, approval: approval(), fetchImpl }
  const result = await purchaseEvaluation(options)
  assert.equal(result.summary.retained, 4)
  assert.equal(result.settlement, 'seller_reported_not_independently_confirmed')
  await assert.rejects(purchaseEvaluation(options))
  assert.equal(signatures, 1); assert.equal(paidCalls, 1)
})
test('timeout keeps reservation and refuses a new signature', async () => {
  const lockPath = join(await mkdtemp(join(tmpdir(), 'buyer-brief-timeout-')), 'attempt.json')
  let signatures = 0
  const options = { address: PAYEE, signTypedData: async () => { signatures++; return '0x00' }, lockPath, approval: approval(), fetchImpl: async (_url: unknown, init?: RequestInit) => {
    if (new Headers(init?.headers).has('PAYMENT-SIGNATURE')) throw new Error('timeout')
    return response402()
  } }
  await assert.rejects(purchaseEvaluation(options), /timeout/)
  await assert.rejects(purchaseEvaluation(options))
  assert.equal(signatures, 1)
})
test('expired or wrong-body approval stops before network', async () => {
  for (const change of [{ expiresAt: '2000-01-01T00:00:00Z' }, { requestHash: 'sha256:' + '0'.repeat(64) }]) {
    await assert.rejects(purchaseEvaluation({ address: PAYEE, signTypedData: async () => { throw new Error('must not sign') }, lockPath: '/unused', approval: { ...approval(), ...change }, fetchImpl: async () => { assert.fail('must not fetch') } }))
  }
})
