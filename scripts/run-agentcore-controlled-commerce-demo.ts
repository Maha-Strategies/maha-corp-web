import {
  ControlledCommerceError,
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

const policy: BuyerPolicy = {
  schemaVersion: '1.0.0',
  policyId: 'maha-agentcore-demo',
  policyVersion: '2026-08-17',
  approvedSchemes: ['exact'],
  approvedResources: [RESOURCE],
  approvedPayees: [PAYEE],
  assetRules: [{ network: 'eip155:8453', asset: ASSET, maxAmountPerCall: '5000', maxAmountPerTask: '6000', humanApprovalAbove: '2000' }],
  requireValidatedSchema: true,
  settlement: { requirePaymentResponse: true, requireOnchainConfirmation: true },
}

const baseControl = {
  requestId: 'request-demo-0001',
  taskId: 'task-demo-0001',
  authorizationId: 'authorization-demo-0001',
  idempotencyKey: 'purchase-demo-0001',
}

type Counts = { sessions: number; proofs: number; paidRequests: number; cleanups: number }

function simulatedTool(input: {
  ledger?: BuyerPolicyLedger
  requirement?: Partial<MerchantChallenge['requirement']>
  receiptTransaction?: string
  chainStatus?: 'confirmed' | 'indeterminate'
}) {
  const counts: Counts = { sessions: 0, proofs: 0, paidRequests: 0, cleanups: 0 }
  const requirement = {
    scheme: 'exact', network: 'eip155:8453', amount: '1000', asset: ASSET, payTo: PAYEE, maxTimeoutSeconds: 120,
    ...input.requirement,
  }
  const payments: AgentCorePaymentsAdapter = {
    async createSession() { counts.sessions += 1; return { handle: { synthetic: true } } },
    async createPaymentProof() { counts.proofs += 1; return { paymentHeader: 'synthetic-proof-no-value-transferred' } },
    async deleteSession() { counts.cleanups += 1 },
  }
  const tool = createAgentCoreControlledCommerceTool({
    policy,
    ledger: input.ledger ?? createInMemoryBuyerPolicyLedger(),
    approvedPurposes: ['context_optimization'],
    payer: PAYER,
    payments,
    now: () => new Date('2026-08-17T10:00:00.000Z'),
    merchant: {
      async inspect() {
        return { declaredResource: RESOURCE, requirement, schema: { status: 'valid', digest: `sha256:${'c'.repeat(64)}` } }
      },
      async redeem() {
        counts.paidRequests += 1
        const report = { context: '[runbook:1] Release requires reviewed evidence.', includedPassages: 1 }
        return {
          status: 200,
          report,
          responseBytes: new TextEncoder().encode(JSON.stringify(report)),
          receipt: { success: true, transaction: input.receiptTransaction ?? TRANSACTION, network: 'eip155:8453', payer: PAYER },
        }
      },
    },
    async confirmSettlement() {
      if (input.chainStatus === 'indeterminate') return { status: 'indeterminate', reason: 'simulated_rpc_timeout' }
      return { status: 'confirmed', transaction: TRANSACTION, network: 'eip155:8453', asset: ASSET, payer: PAYER, payTo: PAYEE, amount: requirement.amount, blockNumber: 123 }
    },
  })
  return { tool, counts }
}

async function runCase(name: string, execute: () => Promise<unknown>, counts: Counts) {
  try {
    const result = await execute()
    return { name, outcome: 'completed', counts, result }
  } catch (error) {
    if (!(error instanceof ControlledCommerceError)) throw error
    return { name, outcome: 'denied', code: error.code, counts, auditEvents: error.auditEvents }
  }
}

const approved = simulatedTool({})
const wrongPayee = simulatedTool({ requirement: { payTo: '0x1111111111111111111111111111111111111111' } })
const oneDollar = simulatedTool({ requirement: { amount: '1000000' } })
const missingApproval = simulatedTool({ requirement: { amount: '3000' } })
const fabricatedReceipt = simulatedTool({ receiptTransaction: `0x${'b'.repeat(64)}` })
const indeterminateSettlement = simulatedTool({ chainStatus: 'indeterminate' })

const results = await Promise.all([
  runCase('approved_exact_purchase', () => approved.tool.purchase(parseAgentPurchaseArguments(JSON.stringify({ resource_url: RESOURCE, purpose: 'context_optimization' })), baseControl), approved.counts),
  runCase('wrong_payee', () => wrongPayee.tool.purchase({ resourceUrl: RESOURCE, purpose: 'context_optimization' }, { ...baseControl, authorizationId: 'authorization-demo-0002' }), wrongPayee.counts),
  runCase('one_dollar_challenge', () => oneDollar.tool.purchase({ resourceUrl: RESOURCE, purpose: 'context_optimization' }, { ...baseControl, authorizationId: 'authorization-demo-0003' }), oneDollar.counts),
  runCase('missing_human_approval', () => missingApproval.tool.purchase({ resourceUrl: RESOURCE, purpose: 'context_optimization' }, { ...baseControl, authorizationId: 'authorization-demo-0004' }), missingApproval.counts),
  runCase('fabricated_receipt', () => fabricatedReceipt.tool.purchase({ resourceUrl: RESOURCE, purpose: 'context_optimization' }, { ...baseControl, authorizationId: 'authorization-demo-0005' }), fabricatedReceipt.counts),
  runCase('indeterminate_settlement', () => indeterminateSettlement.tool.purchase({ resourceUrl: RESOURCE, purpose: 'context_optimization' }, { ...baseControl, authorizationId: 'authorization-demo-0006' }), indeterminateSettlement.counts),
])

console.log(JSON.stringify({
  title: 'Maha controlled agentic commerce — zero-value simulation',
  interpretation: 'No model, AWS, wallet, merchant, RPC, or blockchain call was made.',
  valueTransferred: false,
  liveProviderCalls: 0,
  cases: results,
}, null, 2))
