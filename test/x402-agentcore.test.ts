import assert from 'node:assert/strict'
import test from 'node:test'

import {
  ControlledCommerceError,
  CONTROLLED_X402_FETCH_TOOL,
  createAgentCoreControlledCommerceTool,
  parseAgentPurchaseArguments,
  type AgentCorePaymentsAdapter,
  type MerchantChallenge,
} from '../lib/x402/agentcore.ts'
import { createInMemoryBuyerPolicyLedger, type BuyerPolicy, type BuyerPolicyLedger } from '../lib/x402/buyer-policy.ts'

const RESOURCE = 'https://www.mahastrategies.com/api/v1/compress'
const PAYEE = '0xec84c1cd6602bbe387bc8e6f0d3c062f2762de28'
const PAYER = '0x7b7ff44288fADe4A1829abA2584DFCeB952146f2'
const ASSET = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'
const TRANSACTION = `0x${'a'.repeat(64)}`
const OTHER_TRANSACTION = `0x${'b'.repeat(64)}`
const FIXED_NOW = new Date('2026-08-17T10:00:00.000Z')

const policy: BuyerPolicy = {
  schemaVersion: '1.0.0',
  policyId: 'agentcore-commerce-policy',
  policyVersion: '2026-08-17',
  approvedSchemes: ['exact'],
  approvedResources: [RESOURCE],
  approvedPayees: [PAYEE],
  assetRules: [{
    network: 'eip155:8453',
    asset: ASSET,
    maxAmountPerCall: '5000',
    maxAmountPerTask: '6000',
    humanApprovalAbove: '2000',
  }],
  requireValidatedSchema: true,
  settlement: { requirePaymentResponse: true, requireOnchainConfirmation: true },
}

const control = {
  requestId: 'request-commerce-0001',
  taskId: 'task-commerce-0001',
  authorizationId: 'authorization-commerce-0001',
  idempotencyKey: 'purchase-commerce-0001',
}

type Counters = { inspect: number; sessions: number; proofs: number; redeems: number; confirmations: number; cleanups: number }

function harness(options: {
  ledger?: BuyerPolicyLedger
  challenge?: Partial<MerchantChallenge['requirement']>
  receiptTransaction?: string
  onchainStatus?: 'confirmed' | 'indeterminate'
  cleanupFails?: boolean
} = {}) {
  const counters: Counters = { inspect: 0, sessions: 0, proofs: 0, redeems: 0, confirmations: 0, cleanups: 0 }
  const ledger = options.ledger ?? createInMemoryBuyerPolicyLedger()
  const requirement = {
    scheme: 'exact',
    network: 'eip155:8453',
    amount: '1000',
    asset: ASSET,
    payTo: PAYEE,
    maxTimeoutSeconds: 120,
    ...options.challenge,
  }
  const payments: AgentCorePaymentsAdapter = {
    async createSession(input) {
      counters.sessions += 1
      assert.equal(input.maximumAmount, requirement.amount)
      assert.equal(input.purpose, 'context_optimization')
      return { handle: { provider: 'synthetic-agentcore-session' } }
    },
    async createPaymentProof() {
      counters.proofs += 1
      return { paymentHeader: 'synthetic-payment-proof-never-log' }
    },
    async deleteSession() {
      counters.cleanups += 1
      if (options.cleanupFails) throw new Error('synthetic cleanup failure')
    },
  }
  const tool = createAgentCoreControlledCommerceTool({
    policy,
    ledger,
    approvedPurposes: ['context_optimization'],
    payer: PAYER,
    now: () => FIXED_NOW,
    merchant: {
      async inspect() {
        counters.inspect += 1
        return {
          declaredResource: RESOURCE,
          requirement,
          schema: { status: 'valid', digest: `sha256:${'c'.repeat(64)}` },
        }
      },
      async redeem() {
        counters.redeems += 1
        return {
          status: 200,
          report: { context: '[source:1] governed evidence' },
          responseBytes: new TextEncoder().encode('{"context":"[source:1] governed evidence"}'),
          receipt: { success: true, transaction: options.receiptTransaction ?? TRANSACTION, network: 'eip155:8453', payer: PAYER },
        }
      },
    },
    payments,
    async confirmSettlement() {
      counters.confirmations += 1
      if (options.onchainStatus === 'indeterminate') return { status: 'indeterminate', reason: 'synthetic_rpc_timeout' }
      return { status: 'confirmed', transaction: TRANSACTION, network: 'eip155:8453', asset: ASSET, payer: PAYER, payTo: PAYEE, amount: requirement.amount, blockNumber: 123 }
    },
  })
  return { tool, counters, ledger }
}

async function expectCode(run: Promise<unknown>, code: ControlledCommerceError['code']): Promise<ControlledCommerceError> {
  try {
    await run
  } catch (error) {
    assert.ok(error instanceof ControlledCommerceError)
    assert.equal(error.code, code)
    return error
  }
  assert.fail(`Expected ${code}`)
}

test('one approved purchase creates one proof, one redemption, verified evidence, and deletes the session', async () => {
  const { tool, counters } = harness()
  const result = await tool.purchase({ resourceUrl: RESOURCE, purpose: 'context_optimization' }, control)

  assert.deepEqual(counters, { inspect: 1, sessions: 1, proofs: 1, redeems: 1, confirmations: 1, cleanups: 1 })
  assert.equal(result.status, 'completed')
  assert.equal(result.amount, '1000')
  assert.equal(result.network, 'eip155:8453')
  assert.equal(result.settlementVerified, true)
  assert.match(result.receiptReference, /^sha256:[a-f0-9]{64}$/)
  assert.match(result.responseHash, /^sha256:[a-f0-9]{64}$/)
  assert.deepEqual(result.auditEvents.map((event) => event.eventType), [
    'request_received',
    'challenge_inspected',
    'policy_allowed',
    'session_created',
    'proof_created',
    'merchant_accepted',
    'settlement_verified',
    'session_deleted',
  ])
  const serialized = JSON.stringify(result)
  assert.doesNotMatch(serialized, /synthetic-payment-proof|synthetic-agentcore-session/)
})

test('the OpenAI function surface exposes only resource and purpose', () => {
  assert.equal(CONTROLLED_X402_FETCH_TOOL.strict, true)
  assert.equal(CONTROLLED_X402_FETCH_TOOL.parameters.additionalProperties, false)
  assert.deepEqual(parseAgentPurchaseArguments(JSON.stringify({ resource_url: RESOURCE, purpose: 'context_optimization' })), {
    resourceUrl: RESOURCE,
    purpose: 'context_optimization',
  })
  assert.throws(
    () => parseAgentPurchaseArguments({ resource_url: RESOURCE, purpose: 'context_optimization', payee: PAYEE }),
    /only resource_url and purpose/,
  )
  assert.throws(
    () => parseAgentPurchaseArguments({ resource_url: 'http://localhost:3000/private', purpose: 'context_optimization' }),
    /public HTTPS/,
  )
})

test('unapproved purpose is denied before the merchant or payment provider is contacted', async () => {
  const { tool, counters } = harness()
  await expectCode(tool.purchase({ resourceUrl: RESOURCE, purpose: 'unapproved_purchase' }, control), 'purpose_not_approved')
  assert.deepEqual(counters, { inspect: 0, sessions: 0, proofs: 0, redeems: 0, confirmations: 0, cleanups: 0 })
})

test('wrong payee and one-dollar challenges are rejected before a session or proof exists', async () => {
  const wrongPayee = harness({ challenge: { payTo: '0x1111111111111111111111111111111111111111' } })
  await expectCode(wrongPayee.tool.purchase({ resourceUrl: RESOURCE, purpose: 'context_optimization' }, control), 'payee_not_approved')
  assert.equal(wrongPayee.counters.sessions, 0)
  assert.equal(wrongPayee.counters.proofs, 0)

  const oneDollar = harness({ challenge: { amount: '1000000' } })
  await expectCode(oneDollar.tool.purchase({ resourceUrl: RESOURCE, purpose: 'context_optimization' }, control), 'call_limit_exceeded')
  assert.equal(oneDollar.counters.sessions, 0)
  assert.equal(oneDollar.counters.proofs, 0)
})

test('a thresholded purchase without authenticated human approval is rejected before signing', async () => {
  const { tool, counters } = harness({ challenge: { amount: '3000' } })
  await expectCode(tool.purchase({ resourceUrl: RESOURCE, purpose: 'context_optimization' }, control), 'human_approval_required')
  assert.equal(counters.sessions, 0)
  assert.equal(counters.proofs, 0)
})

test('fabricated receipt and indeterminate chain evidence fail closed after one proof and still clean up', async () => {
  const fabricated = harness({ receiptTransaction: OTHER_TRANSACTION })
  await expectCode(fabricated.tool.purchase({ resourceUrl: RESOURCE, purpose: 'context_optimization' }, control), 'settlement_mismatch')
  assert.equal(fabricated.counters.proofs, 1)
  assert.equal(fabricated.counters.redeems, 1)
  assert.equal(fabricated.counters.cleanups, 1)

  const indeterminate = harness({ onchainStatus: 'indeterminate' })
  await expectCode(indeterminate.tool.purchase({ resourceUrl: RESOURCE, purpose: 'context_optimization' }, control), 'settlement_indeterminate')
  assert.equal(indeterminate.counters.proofs, 1)
  assert.equal(indeterminate.counters.redeems, 1)
  assert.equal(indeterminate.counters.cleanups, 1)
})

test('replayed authorization and repeated tool invocation cannot create another proof', async () => {
  const ledger = createInMemoryBuyerPolicyLedger()
  const first = harness({ ledger })
  await first.tool.purchase({ resourceUrl: RESOURCE, purpose: 'context_optimization' }, control)

  const replay = harness({ ledger })
  await expectCode(replay.tool.purchase({ resourceUrl: RESOURCE, purpose: 'context_optimization' }, control), 'authorization_replayed')
  assert.equal(replay.counters.sessions, 0)
  assert.equal(replay.counters.proofs, 0)

  await expectCode(first.tool.purchase({ resourceUrl: RESOURCE, purpose: 'context_optimization' }, { ...control, authorizationId: 'authorization-commerce-0002' }), 'access_count_invalid')
  assert.equal(first.counters.proofs, 1)
})

test('session cleanup failure is surfaced as an operator-recovery condition', async () => {
  const { tool } = harness({ cleanupFails: true })
  const error = await expectCode(tool.purchase({ resourceUrl: RESOURCE, purpose: 'context_optimization' }, control), 'session_cleanup_failed')
  assert.equal(error.auditEvents.at(-1)?.eventType, 'session_cleanup_failed')
})
