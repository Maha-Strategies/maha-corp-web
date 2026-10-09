/**
 * A narrow, server-side AgentKit wallet boundary for x402 purchases.
 * Do not expose the wallet provider or this executor as a general LLM tool.
 * Discovery, schema validation, approval authentication, the durable ledger,
 * and independent chain verification must be supplied by trusted code.
 */
import type { EvmWalletProvider } from '@coinbase/agentkit'

import {
  authorizePayment,
  verifyAndRecordSettlement,
  type BuyerPolicy,
  type BuyerPolicyLedger,
  type HumanApproval,
  type HumanApprovalVerifier,
  type OnchainSettlementEvidence,
  type PaymentAuthorization,
  type SchemaEvidence,
  type SettlementDecision,
  type VerifiedSettlement,
} from './buyer-policy.ts'
import { createPaidFetch } from './client.ts'

/** Only the signing subset of AgentKit's wallet; no transfer/send actions. */
export type AgentKitEvmSigner = Pick<EvmWalletProvider, 'getAddress' | 'getNetwork' | 'signTypedData'>

export type GovernedPurchaseInput = {
  taskId: string
  resource: string
  request: RequestInit
  /** Result of a trusted validator, not a value supplied by the agent. */
  schema: SchemaEvidence
  /** Issued out-of-band and checked by verifyHumanApproval. */
  approval: HumanApproval
}

export type GovernedPurchaseResult = {
  response: Response
  authorization: PaymentAuthorization
} & (
  | { status: 'verified'; settlement: VerifiedSettlement }
  | { status: 'reconciliation_required'; settlement: Exclude<SettlementDecision, VerifiedSettlement> }
)

export class GovernedPurchaseError extends Error {
  readonly stage: 'configuration' | 'policy' | 'payment' | 'settlement'
  readonly authorization?: PaymentAuthorization

  constructor(stage: 'configuration' | 'policy' | 'payment' | 'settlement', message: string, options?: ErrorOptions & { authorization?: PaymentAuthorization }) {
    super(message, options)
    this.name = 'GovernedPurchaseError'
    this.stage = stage
    this.authorization = options?.authorization
  }
}

export function createGovernedAgentKitBuyer(options: {
  wallet: AgentKitEvmSigner
  policy: BuyerPolicy
  /** Must be durable and atomic; the in-memory ledger is only for tests. */
  ledger: BuyerPolicyLedger
  verifyHumanApproval: HumanApprovalVerifier
  /** Independent read of the settlement transaction, e.g. a Base RPC receipt. */
  confirmOnchain: (input: { transaction: string; authorization: PaymentAuthorization; payer: string }) => Promise<OnchainSettlementEvidence>
  fetchImpl?: typeof fetch
}) {
  const { wallet, policy, ledger } = options
  if (!policy.assetRules.length || policy.assetRules.some((rule) => rule.humanApprovalAbove !== '0')) {
    throw new GovernedPurchaseError('configuration', 'Every payable asset must require authenticated human approval from the first base unit.')
  }

  return async function purchase(input: GovernedPurchaseInput): Promise<GovernedPurchaseResult> {
    // Reject unwanted URLs before any network request. The policy rechecks the
    // live challenge later, immediately before the signature.
    if (!policy.approvedResources.includes(input.resource) || !input.resource.startsWith('https://')) {
      throw new GovernedPurchaseError('policy', 'The requested resource is not an exact approved HTTPS URL.')
    }
    if (!input.approval) throw new GovernedPurchaseError('policy', 'A scoped human approval is required.')
    const address = wallet.getAddress()
    const network = wallet.getNetwork()
    const chainId = Number(network.chainId)
    if (!/^0x[a-fA-F0-9]{40}$/.test(address) || network.protocolFamily !== 'evm' || !Number.isSafeInteger(chainId)) {
      throw new GovernedPurchaseError('configuration', 'The AgentKit wallet must report an EVM address and chain.')
    }
    let authorization: PaymentAuthorization | undefined
    let challengeSeen = false
    const paidFetch = createPaidFetch({
      address,
      chainId,
      fetchImpl: options.fetchImpl,
      async onPaymentRequired(requirement, context) {
        challengeSeen = true
        const decision = await authorizePayment({
          policy,
          ledger,
          verifyHumanApproval: options.verifyHumanApproval,
          intent: {
            taskId: input.taskId,
            authorizationId: context.authorization.nonce,
            requestedResource: input.resource,
            declaredResource: context.challenge.resource.url,
            requirement,
            schema: input.schema,
            approval: input.approval,
          },
        })
        if (!decision.allowed) throw new GovernedPurchaseError('policy', `${decision.code}: ${decision.message}`)
        authorization = decision
      },
      async signTypedData(data) {
        if (!authorization || authorization.authorizationId !== data.message.nonce
          || authorization.amount !== String(data.message.value)
          || authorization.payee.toLowerCase() !== data.message.to.toLowerCase()
          || address.toLowerCase() !== data.message.from.toLowerCase()
          || Number(wallet.getNetwork().chainId) !== chainId) {
          throw new GovernedPurchaseError('policy', 'The wallet signing payload does not match the approved live challenge.')
        }
        return wallet.signTypedData(data)
      },
    })

    let response: Awaited<ReturnType<typeof paidFetch>>
    try {
      response = await paidFetch(input.resource, { ...input.request, redirect: 'error' })
    } catch (cause) {
      // A network error after signing can be indeterminate. Never auto-retry:
      // the same request might already have settled despite lost delivery.
      if (cause instanceof GovernedPurchaseError) throw cause
      throw new GovernedPurchaseError('payment', 'The x402 attempt failed or is indeterminate. Inspect settlement before any retry.', { cause, authorization })
    }
    if (!challengeSeen || !authorization || !response.x402) {
      throw new GovernedPurchaseError('payment', 'The endpoint did not complete a challenged x402 purchase.')
    }
    const receipt = response.x402.receipt
    let onchain: OnchainSettlementEvidence | undefined
    if (receipt?.transaction) {
      try {
        onchain = await options.confirmOnchain({ transaction: receipt.transaction, authorization, payer: address })
      } catch {
        onchain = { status: 'indeterminate', reason: 'independent_confirmation_failed' }
      }
    }
    const settlement = await verifyAndRecordSettlement({
      policy, authorization, payer: address, receipt, onchain, ledger,
    })
    // Never hide a delivered response after the payment may have settled.
    // The caller must reconcile a non-verified result, not buy it again.
    return settlement.verified
      ? { status: 'verified', response, authorization, settlement }
      : { status: 'reconciliation_required', response, authorization, settlement }
  }
}
