/**
 * Staged pricing policy, deliberately NOT wired to the production catalog.
 *
 * A billing adapter must supply a verified, account-wide monthly count. The
 * local payment ledger is not that adapter: it can miss other offers/apps,
 * and its post-settlement write can fail after the facilitator charged us.
 * No browser request may supply these inputs.
 */
export const COMPILER_PRICE_POLICY = Object.freeze({
  id: 'context-compression-facilitator-step-up-v1',
  threshold: 1000,
  initialAmount: '1000',
  activatedAmount: '2000',
  currency: 'USDC',
  decimals: 6,
  resetsMonthly: false,
} as const)

export type VerifiedBillingObservation = {
  /** Opaque identifier for the shared CDP billing scope, not an API key. */
  billingScope: string
  /** Exact provider billing boundaries, end exclusive; do not infer timezone. */
  periodStart: string
  periodEnd: string
  observedAt: string
  successfulTransactions: number
  /** Digest of privately retained billing evidence, not buyer data. */
  evidenceDigest: string
  coverage: 'shared_facilitator_billing_scope'
}

export type CompilerPriceActivation = {
  policyId: typeof COMPILER_PRICE_POLICY.id
  amount: typeof COMPILER_PRICE_POLICY.activatedAmount
  observation: VerifiedBillingObservation
}

export type CompilerPriceDecision =
  | { kind: 'awaiting_verified_usage'; amount: null }
  | { kind: 'introductory'; amount: '1000'; successfulTransactions: number }
  | { kind: 'activate' | 'already_activated'; amount: '2000'; activation: CompilerPriceActivation }

function instant(value: string): number {
  // Require an explicit offset. A server's local timezone is not billing data.
  if (!/(Z|[+-]\d{2}:\d{2})$/.test(value)) throw new Error('Billing timestamps require an explicit timezone.')
  const result = Date.parse(value)
  if (!Number.isFinite(result)) throw new Error('Invalid billing timestamp.')
  return result
}

function validateObservation(value: VerifiedBillingObservation, scope: string): void {
  if (!scope.trim() || value.billingScope !== scope) throw new Error('Unverified or mismatched billing scope.')
  if (value.coverage !== 'shared_facilitator_billing_scope') throw new Error('Endpoint-only counts cannot establish billing usage.')
  if (!Number.isSafeInteger(value.successfulTransactions) || value.successfulTransactions < 0) {
    throw new Error('Billing usage must be a nonnegative safe integer.')
  }
  if (!/^sha256:[a-f0-9]{64}$/.test(value.evidenceDigest)) throw new Error('Billing evidence digest is required.')
  const start = instant(value.periodStart)
  const end = instant(value.periodEnd)
  const observed = instant(value.observedAt)
  if (end <= start || observed < start || observed > end) throw new Error('Invalid billing observation interval.')
}

/**
 * Pure decision, not persistence. Once stored, an activation wins over every
 * subsequent monthly observation, including a zero count or missing feed.
 * Missing evidence before activation is UNKNOWN, never a free-tier assertion.
 */
export function decideCompilerPrice(input: {
  billingScope: string
  activation: CompilerPriceActivation | null
  observation: VerifiedBillingObservation | null
}): CompilerPriceDecision {
  if (input.activation) {
    const activation = input.activation
    validateObservation(activation.observation, input.billingScope)
    if (activation.policyId !== COMPILER_PRICE_POLICY.id || activation.amount !== '2000'
      || activation.observation.successfulTransactions < COMPILER_PRICE_POLICY.threshold) {
      throw new Error('Invalid permanent pricing activation.')
    }
    return { kind: 'already_activated', amount: '2000', activation }
  }
  if (!input.observation) return { kind: 'awaiting_verified_usage', amount: null }
  validateObservation(input.observation, input.billingScope)
  if (input.observation.successfulTransactions < COMPILER_PRICE_POLICY.threshold) {
    return { kind: 'introductory', amount: '1000', successfulTransactions: input.observation.successfulTransactions }
  }
  return {
    kind: 'activate', amount: '2000',
    activation: {
      policyId: COMPILER_PRICE_POLICY.id, amount: '2000',
      observation: { ...input.observation },
    },
  }
}

/**
 * Diagnostic lower bound only. Successful settlements on every offer count,
 * including publisher canaries and payments whose downstream delivery failed.
 * Retries with the same network/transaction count once. These observations do
 * NOT become VerifiedBillingObservation without billing-scope reconciliation.
 */
export type FacilitatorObservation = {
  billingScope: string
  occurredAt: string
  operation: 'settle' | 'verify' | 'discovery'
  success: boolean
  network: string
  transaction?: string
  publisherFunded?: boolean
  offerId?: string
}

export function countObservedSettlements(
  observations: readonly FacilitatorObservation[],
  period: { billingScope: string; start: string; end: string },
): { successfulTransactionsLowerBound: number; coverage: 'observed_settlements_only' } {
  if (!period.billingScope.trim()) throw new Error('Billing scope is required.')
  const start = instant(period.start)
  const end = instant(period.end)
  if (end <= start) throw new Error('Invalid billing period.')
  const transactions = new Set<string>()
  for (const entry of observations) {
    if (entry.billingScope !== period.billingScope || entry.operation !== 'settle' || !entry.success) continue
    const occurred = instant(entry.occurredAt)
    if (occurred < start || occurred >= end) continue
    if (!entry.transaction?.trim() || !entry.network.trim()) throw new Error('Successful settlement is missing its identity.')
    // EVM hex is case-insensitive; non-EVM signatures may be case-sensitive.
    const transaction = entry.network.startsWith('eip155:') ? entry.transaction.toLowerCase() : entry.transaction
    transactions.add(JSON.stringify([entry.network, transaction]))
  }
  return { successfulTransactionsLowerBound: transactions.size, coverage: 'observed_settlements_only' }
}
