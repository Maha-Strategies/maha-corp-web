import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

import {
  authorizePayment,
  createInMemoryBuyerPolicyLedger,
  evaluatePaymentIntent,
  verifyAndRecordSettlement,
  verifySettlement,
  type BuyerPolicy,
  type PaymentAuthorization,
  type PaymentIntent,
} from '../lib/x402/buyer-policy.ts'
import { createPaidFetch, PAYMENT_REQUIRED_HEADER, type PaymentChallenge, type PaymentRequirement } from '../lib/x402/client.ts'

const RESOURCE = 'https://api.example.com/v1/research'
const PAYEE = '0x1111111111111111111111111111111111111111'
const PAYER = '0x2222222222222222222222222222222222222222'
const ASSET = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'
const TRANSACTION = `0x${'a'.repeat(64)}`

const policy: BuyerPolicy = {
  schemaVersion: '1.0.0',
  policyId: 'agent-policy-prod',
  policyVersion: '2026-08-09',
  approvedSchemes: ['exact'],
  approvedResources: [RESOURCE],
  approvedPayees: [PAYEE],
  assetRules: [{ network: 'eip155:8453', asset: ASSET, maxAmountPerCall: '5000', maxAmountPerTask: '6000', humanApprovalAbove: '2000' }],
  requireValidatedSchema: true,
  settlement: { requirePaymentResponse: true, requireOnchainConfirmation: true },
}

function intent(overrides: Partial<PaymentIntent> = {}): PaymentIntent {
  return {
    taskId: 'task-research-0001',
    authorizationId: `0x${'b'.repeat(64)}`,
    requestedResource: RESOURCE,
    declaredResource: RESOURCE,
    requirement: { scheme: 'exact', network: 'eip155:8453', amount: '1000', asset: ASSET, payTo: PAYEE, maxTimeoutSeconds: 60 },
    schema: { status: 'valid', digest: `sha256:${'c'.repeat(64)}` },
    ...overrides,
  }
}

test('the pre-signing policy binds the exact resource, network, asset, payee, and schema', () => {
  assert.equal(evaluatePaymentIntent(policy, intent()).allowed, true)
  assert.equal(evaluatePaymentIntent(policy, intent({ declaredResource: `${RESOURCE}?other=1` })).code, 'resource_mismatch')
  assert.equal(evaluatePaymentIntent(policy, intent({ requirement: { ...intent().requirement, network: 'eip155:84532' } })).code, 'network_not_approved')
  assert.equal(evaluatePaymentIntent(policy, intent({ requirement: { ...intent().requirement, asset: '0x3333333333333333333333333333333333333333' } })).code, 'asset_not_approved')
  assert.equal(evaluatePaymentIntent(policy, intent({ requirement: { ...intent().requirement, payTo: '0x3333333333333333333333333333333333333333' } })).code, 'payee_not_approved')
  assert.equal(evaluatePaymentIntent(policy, intent({ schema: { status: 'not_checked' } })).code, 'schema_not_validated')
})

test('per-call and atomic per-task limits are separate controls', async () => {
  assert.equal(evaluatePaymentIntent(policy, intent({ requirement: { ...intent().requirement, amount: '5001' } })).code, 'call_limit_exceeded')
  const budgetPolicy: BuyerPolicy = { ...policy, assetRules: [{ ...policy.assetRules[0], humanApprovalAbove: undefined }] }
  const ledger = createInMemoryBuyerPolicyLedger()
  const first = await authorizePayment({ policy: budgetPolicy, ledger, intent: intent() })
  const second = await authorizePayment({ policy: budgetPolicy, ledger, intent: intent({ authorizationId: `0x${'d'.repeat(64)}`, requirement: { ...intent().requirement, amount: '1000' } }) })
  const tooMuch = await authorizePayment({ policy: budgetPolicy, ledger, intent: intent({ authorizationId: `0x${'e'.repeat(64)}`, requirement: { ...intent().requirement, amount: '5000' } }) })
  assert.equal(first.allowed, true)
  assert.equal(second.allowed, true)
  assert.equal(tooMuch.code, 'task_limit_exceeded')
})

function approval(maxAmount = '3000') {
  return {
    approvalId: 'approval-research-0001',
    policyId: policy.policyId,
    taskId: 'task-research-0001',
    resource: RESOURCE,
    network: 'eip155:8453',
    asset: ASSET,
    payee: PAYEE,
    maxAmount,
    expiresAt: '2026-08-10T00:00:00.000Z',
  }
}

test('human approval is thresholded, expiring, and bound to every payment term', () => {
  const expensive = intent({ requirement: { ...intent().requirement, amount: '3000' } })
  assert.equal(evaluatePaymentIntent(policy, expensive, new Date('2026-08-09T00:00:00Z')).code, 'human_approval_required')
  assert.equal(evaluatePaymentIntent(policy, { ...expensive, approval: approval() }, new Date('2026-08-09T00:00:00Z')).code, 'human_approval_required')
  assert.equal(evaluatePaymentIntent(policy, { ...expensive, approval: approval() }, new Date('2026-08-09T00:00:00Z'), true).allowed, true)
  assert.equal(evaluatePaymentIntent(policy, { ...expensive, approval: { ...approval(), payee: PAYER } }, new Date('2026-08-09T00:00:00Z')).code, 'human_approval_invalid')
  assert.equal(evaluatePaymentIntent(policy, { ...expensive, approval: approval() }, new Date('2026-08-11T00:00:00Z')).code, 'human_approval_invalid')
})

test('an approval-shaped object cannot bypass the trusted approval verifier', async () => {
  const expensive = intent({ requirement: { ...intent().requirement, amount: '3000' }, approval: approval() })
  const rejected = await authorizePayment({ policy, ledger: createInMemoryBuyerPolicyLedger(), intent: expensive, now: new Date('2026-08-09T00:00:00Z'), verifyHumanApproval: async () => false })
  const accepted = await authorizePayment({ policy, ledger: createInMemoryBuyerPolicyLedger(), intent: expensive, now: new Date('2026-08-09T00:00:00Z'), verifyHumanApproval: async (candidate) => candidate.approvalId === 'approval-research-0001' })
  assert.equal(rejected.code, 'human_approval_invalid')
  assert.equal(accepted.allowed, true)
})

test('authorization identities are claimed before a second signing attempt', async () => {
  const ledger = createInMemoryBuyerPolicyLedger()
  assert.equal((await authorizePayment({ policy, ledger, intent: intent() })).allowed, true)
  assert.equal((await authorizePayment({ policy, ledger, intent: intent() })).code, 'authorization_replayed')
})

function authorization(): PaymentAuthorization {
  const decision = evaluatePaymentIntent(policy, intent())
  assert.equal(decision.allowed, true)
  return decision as PaymentAuthorization
}

test('receipt and independent on-chain evidence bind the complete settlement', async () => {
  const ledger = createInMemoryBuyerPolicyLedger()
  const receipt = { success: true, transaction: TRANSACTION, network: 'eip155:8453', payer: PAYER }
  const onchain = { status: 'confirmed' as const, transaction: TRANSACTION, network: 'eip155:8453', asset: ASSET, payer: PAYER, payTo: PAYEE, amount: '1000', blockNumber: 123 }
  assert.equal(verifySettlement({ policy, authorization: authorization(), payer: PAYER, receipt, onchain }).verified, true)
  assert.equal(verifySettlement({ policy, authorization: authorization(), payer: PAYER, receipt, onchain: { ...onchain, payTo: PAYER } }).code, 'settlement_mismatch')
  assert.equal(verifySettlement({ policy, authorization: authorization(), payer: PAYER, receipt, onchain: { status: 'indeterminate', reason: 'rpc_timeout' } }).code, 'settlement_indeterminate')
  assert.equal((await verifyAndRecordSettlement({ policy, authorization: authorization(), payer: PAYER, receipt, onchain, ledger })).verified, true)
  assert.equal((await verifyAndRecordSettlement({ policy, authorization: authorization(), payer: PAYER, receipt, onchain, ledger })).code, 'settlement_replayed')
})

test('the async policy hook completes before a wallet signature is requested', async () => {
  const order: string[] = []
  const challenge: PaymentChallenge = {
    x402Version: 2,
    resource: { url: RESOURCE },
    accepts: [intent().requirement as PaymentRequirement],
  }
  const encoded = btoa(JSON.stringify(challenge))
  let requests = 0
  const paidFetch = createPaidFetch({
    address: PAYER,
    chainId: 8453,
    async onPaymentRequired(_requirement, context) {
      await Promise.resolve()
      assert.match(context.authorization.nonce, /^0x[a-f0-9]{64}$/)
      order.push('policy')
    },
    async signTypedData() { order.push('sign'); return `0x${'f'.repeat(130)}` },
    async fetchImpl() {
      requests += 1
      return requests === 1
        ? new Response(null, { status: 402, headers: { [PAYMENT_REQUIRED_HEADER]: encoded } })
        : new Response('{}', { status: 200 })
    },
  })
  await paidFetch(RESOURCE)
  assert.deepEqual(order, ['policy', 'sign'])
})

test('the package and public policy schemas remain byte-for-byte aligned', async () => {
  const packageSchema = await readFile(new URL('../packages/x402-buyer-policy/policy.schema.json', import.meta.url), 'utf8')
  const publicSchema = await readFile(new URL('../public/schemas/x402-buyer-policy-1.0.0.json', import.meta.url), 'utf8')
  assert.equal(publicSchema, packageSchema)
})
