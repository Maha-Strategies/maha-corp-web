import assert from 'node:assert/strict'
import test from 'node:test'

import { ViemWalletProvider } from '@coinbase/agentkit'
import { createWalletClient, http } from 'viem'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import { base } from 'viem/chains'

import {
  createInMemoryBuyerPolicyLedger,
  type BuyerPolicy,
  type HumanApproval,
} from '../lib/x402/buyer-policy.ts'
import { PAYMENT_REQUIRED_HEADER, PAYMENT_RESPONSE_HEADER, type PaymentChallenge } from '../lib/x402/client.ts'
import { createGovernedAgentKitBuyer, GovernedPurchaseError } from '../lib/x402/governed-agentkit-buyer.ts'

// AgentKit sends wallet-initialization analytics asynchronously. Keep this
// offline test offline, including that background request.
globalThis.fetch = async () => new Response(null, { status: 204 })

const RESOURCE = 'https://example.com/api/paid'
const PAYEE = '0x1111111111111111111111111111111111111111'
const ASSET = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'
const TX = `0x${'a'.repeat(64)}`
const TASK = 'agentkit-task-0001'
const policy: BuyerPolicy = {
  schemaVersion: '1.0.0',
  policyId: 'agentkit-policy-0001',
  policyVersion: '2026-09-28',
  approvedSchemes: ['exact'],
  approvedResources: [RESOURCE],
  approvedPayees: [PAYEE],
  assetRules: [{ network: 'eip155:8453', asset: ASSET, maxAmountPerCall: '2000', maxAmountPerTask: '2000', humanApprovalAbove: '0' }],
  requireValidatedSchema: true,
  settlement: { requirePaymentResponse: true, requireOnchainConfirmation: true },
}

function approval(): HumanApproval {
  return {
    approvalId: 'approval-agentkit-0001', policyId: policy.policyId,
    taskId: TASK, resource: RESOURCE, network: 'eip155:8453', asset: ASSET,
    payee: PAYEE, maxAmount: '2000', expiresAt: '2099-01-01T00:00:00Z',
  }
}

function challenge(overrides: Partial<PaymentChallenge> = {}): PaymentChallenge {
  return {
    x402Version: 2,
    resource: { url: RESOURCE },
    accepts: [{ scheme: 'exact', network: 'eip155:8453', amount: '1000', payTo: PAYEE, maxTimeoutSeconds: 60, asset: ASSET }],
    ...overrides,
  }
}

function fixture(options: { liveChallenge?: PaymentChallenge; receipt?: boolean; approvalAccepted?: boolean; chainIndeterminate?: boolean; deliveryFailure?: boolean } = {}) {
  // AgentKit's actual ViemWalletProvider signs with an ephemeral, unfunded key.
  // No request leaves this process: the x402 HTTP handshake is mocked.
  const account = privateKeyToAccount(generatePrivateKey())
  // AgentKit currently nests a different viem minor than the application.
  // The runtime wallet API is compatible; the cast bridges those duplicate
  // dependency types only in this isolated offline fixture.
  const walletClient = createWalletClient({ account, chain: base, transport: http() })
  const wallet = new ViemWalletProvider(walletClient as unknown as ConstructorParameters<typeof ViemWalletProvider>[0])
  const calls: string[] = []
  const signingWallet = {
    getAddress: () => wallet.getAddress(),
    getNetwork: () => wallet.getNetwork(),
    signTypedData: async (data: Parameters<typeof wallet.signTypedData>[0]) => {
      calls.push('sign')
      return wallet.signTypedData(data)
    },
  }
  let requests = 0
  const fetchImpl: typeof fetch = async (_input, init) => {
    requests += 1
    calls.push(init?.headers && new Headers(init.headers).has('PAYMENT-SIGNATURE') ? 'paid-request' : 'challenge-request')
    if (requests === 1) {
      return new Response(null, { status: 402, headers: { [PAYMENT_REQUIRED_HEADER]: btoa(JSON.stringify(options.liveChallenge ?? challenge())) } })
    }
    if (options.deliveryFailure) throw new Error('lost_http_response')
    const receipt = { success: true, transaction: TX, network: 'eip155:8453', payer: account.address }
    return new Response('{}', { status: 200, headers: options.receipt === false ? {} : { [PAYMENT_RESPONSE_HEADER]: btoa(JSON.stringify(receipt)) } })
  }
  const buyer = createGovernedAgentKitBuyer({
    wallet: signingWallet, policy, ledger: createInMemoryBuyerPolicyLedger(), fetchImpl,
    async verifyHumanApproval(candidate) {
      calls.push('verify-approval')
      return options.approvalAccepted !== false && candidate.approvalId === 'approval-agentkit-0001'
    },
    async confirmOnchain({ transaction, authorization, payer }) {
      calls.push('confirm-onchain')
      if (options.chainIndeterminate) return { status: 'indeterminate', reason: 'rpc_timeout' }
      return { status: 'confirmed', transaction, network: authorization.network, asset: authorization.asset,
        payer, payTo: authorization.payee, amount: authorization.amount }
    },
  })
  return { buyer, wallet, calls, requests: () => requests }
}

const input = () => ({ taskId: TASK, resource: RESOURCE, request: { method: 'POST', body: '{}' }, schema: { status: 'valid' as const }, approval: approval() })

test('an actual AgentKit wallet signs only after authenticated approval and live policy', async () => {
  const { buyer, calls } = fixture()
  const result = await buyer(input())
  assert.equal(result.status, 'verified')
  assert.equal(result.authorization.amount, '1000')
  assert.equal(result.settlement.verified, true)
  assert.deepEqual(calls, ['challenge-request', 'verify-approval', 'sign', 'paid-request', 'confirm-onchain'])
})

test('an approval-shaped object rejected by the trusted verifier never reaches signing', async () => {
  const { buyer, calls, requests } = fixture({ approvalAccepted: false })
  await assert.rejects(buyer(input()), /human_approval_invalid/)
  assert.equal(requests(), 1)
  assert.deepEqual(calls, ['challenge-request', 'verify-approval'])
})

test('missing approval is refused before fetching; unvalidated schema is refused before signing', async () => {
  const missing = fixture()
  await assert.rejects(missing.buyer({ ...input(), approval: undefined as unknown as HumanApproval }), /scoped human approval/)
  assert.equal(missing.requests(), 0)
  const invalid = fixture()
  await assert.rejects(invalid.buyer({ ...input(), schema: { status: 'not_checked' } }), /schema_not_validated/)
  assert.equal(invalid.requests(), 1)
  assert.equal(invalid.calls.includes('sign'), false)
})

test('changed live payee or resource is denied before the AgentKit wallet signs', async () => {
  for (const liveChallenge of [
    challenge({ accepts: [{ ...challenge().accepts[0], payTo: '0x3333333333333333333333333333333333333333' }] }),
    challenge({ resource: { url: 'https://example.com/api/other' } }),
  ]) {
    const { buyer, requests } = fixture({ liveChallenge })
    await assert.rejects(buyer(input()), /payee_not_approved|resource_mismatch/)
    assert.equal(requests(), 1)
  }
})

test('a paid response without a receipt is returned for recovery, never reported as verified', async () => {
  const { buyer, calls } = fixture({ receipt: false })
  const result = await buyer(input())
  assert.equal(result.status, 'reconciliation_required')
  assert.equal(result.settlement.code, 'receipt_missing')
  assert.deepEqual(calls, ['challenge-request', 'verify-approval', 'sign', 'paid-request'])
})

test('an indeterminate chain read preserves the paid response and requires reconciliation', async () => {
  const { buyer } = fixture({ chainIndeterminate: true })
  const result = await buyer(input())
  assert.equal(result.status, 'reconciliation_required')
  assert.equal(result.settlement.code, 'settlement_indeterminate')
  assert.equal(result.response.status, 200)
})

test('delivery failure after signing preserves authorization for recovery and never retries', async () => {
  const { buyer, calls, requests } = fixture({ deliveryFailure: true })
  await assert.rejects(buyer(input()), (error: unknown) => {
    assert.ok(error instanceof GovernedPurchaseError)
    assert.equal(error.stage, 'payment')
    assert.match(error.authorization?.authorizationId ?? '', /^0x[a-f0-9]{64}$/)
    return true
  })
  assert.equal(requests(), 2)
  assert.equal(calls.filter((call) => call === 'sign').length, 1)
})

test('general-purpose AgentKit wallet actions are not exposed to the workflow advisor', async () => {
  const source = await import('node:fs/promises').then((fs) => fs.readFile(new URL('../lib/workflow-advisor-agent.ts', import.meta.url), 'utf8'))
  assert.doesNotMatch(source, /walletActionProvider|createGovernedAgentKitBuyer|signTypedData/)
})
