// Waiting for a settlement to appear, without guessing when it does not.
//
// The failure this exists to prevent already happened. On 2026-09-02 the canary
// received HTTP 200 with a parseable body, read the buyer's USDC balance about
// a second later, saw no change, and threw `Expected a 15000 base-unit debit;
// observed 0.` Base blocks are roughly two seconds apart and the facilitator
// settles asynchronously, so that read was simply too early. A successful
// asynchronous settlement was rejected as a failure.
//
// The old check was not wrong about what it wanted. It was wrong about when it
// looked, and about what a balance can prove. Two corrections here:
//
// A balance delta is not evidence of *this* settlement. It says the wallet has
// less money, not that this payment is why. Transaction-bound confirmation is
// the primary signal: the receipt names a transaction, and the chain is asked
// whether that transaction moved exactly this amount of this asset from this
// payer to this payee. Reused wholesale from `confirmSettlement`, which already
// makes that judgement for the seller side; a second implementation of it would
// be a second thing to get wrong.
//
// And "I could not tell" is not "it did not happen". A node having a bad minute
// and a payment that never settled need opposite responses, so they get
// different states. Nothing here ever reports `false` for a settlement it
// merely failed to observe -- after money may have moved, a confident denial is
// how a second charge gets authorized.
//
// This module talks to nothing. Every reader, the clock and the sleep are
// injected, so it cannot reach the paid endpoint, cannot sign, and every timing
// path is exercised in tests without real time passing.

import type { ChainConfirmation } from './chain.ts'

/** What the canary is allowed to claim when the window closes. */
export type SettlementState =
  /** The chain agrees, bound to the declared transaction. */
  | 'confirmed'
  /** Nothing contradicted it; it was not observed in the window. */
  | 'unconfirmed'
  /** Nothing could be established -- node unreachable or inconsistent. */
  | 'unknown'
  /** The chain, the receipt or the amount actively disagrees. */
  | 'contradicted'

export type SettlementReason =
  | 'settlement_confirmed'
  | 'receipt_absent'
  | 'receipt_unsuccessful'
  | 'transaction_missing_or_malformed'
  | 'amount_not_exact'
  | 'chain_contradicted'
  | 'not_observed_before_timeout'
  | 'rpc_unavailable'
  | 'balance_delta_not_exact'
  | 'balance_only_attribution_unsafe'
  | 'balance_not_reconciled_before_timeout'

/** A fixed vocabulary. A node's own words are never carried into evidence. */
export type ObservationDetail =
  | 'not_yet_mined'
  | 'transaction_reverted'
  | 'no_matching_transfer'
  | 'underpaid'
  | 'rpc_wrong_chain'
  | 'rpc_unavailable'
  | 'transaction_not_a_hash'
  | 'confirmed'
  | 'no_debit_yet'
  | 'debit_exact'
  | 'debit_unexpected'
  | 'unclassified'

export type ConfirmationObservation = {
  /** Milliseconds since the window opened. */
  atMs: number
  phase: 'transaction' | 'balance'
  detail: ObservationDetail
}

export type SettlementConfirmation = {
  state: SettlementState
  reason: SettlementReason
  /** What the state rests on. */
  evidence: 'transaction' | 'balance_only' | 'none'
  /** True only when the canary may report a pass. */
  passed: boolean
  /** The transaction the receipt declared, when it was usable. */
  transaction?: string
  /** The exact amount the chain says moved, in base units. */
  amountBaseUnits?: string
  blockNumber?: number
  /** The reconciled balance delta, when one was established. */
  debitedBaseUnits?: string
  observations: ConfirmationObservation[]
  elapsedMs: number
  window: { pollIntervalMs: number; timeoutMs: number }
  retrySafety: 'settled' | 'do_not_retry_blindly'
  /** Carried with the state so it is never read bare. */
  interpretation: string
}

export type ConfirmCanarySettlementInput = {
  /** The decoded PAYMENT-RESPONSE receipt, or null when none arrived. */
  receipt: { success?: boolean; transaction?: string; network?: string; payer?: string } | null
  expected: { amountBaseUnits: string }
  /** The buyer's balance before the paid call. */
  balanceBefore: bigint
  /** Injected: one shared-chain confirmation attempt for this transaction. */
  confirmTransaction: (transaction: string) => Promise<ChainConfirmation>
  /** Injected: the buyer's current token balance. */
  readBalance: () => Promise<bigint>
  /** Injected clock, in milliseconds. */
  now: () => number
  /** Injected sleep. */
  delay: (ms: number) => Promise<void>
  pollIntervalMs?: number
  timeoutMs?: number
}

/** Roughly one Base block. Polling faster only adds load, not information. */
export const DEFAULT_POLL_INTERVAL_MS = 2_500
/** The whole procedure, both phases. Bounded, and far under the job timeout. */
export const DEFAULT_TIMEOUT_MS = 90_000

const TRANSACTION_HASH = /^0x[0-9a-fA-F]{64}$/

const DO_NOT_RETRY =
  'Money may already have moved. Do not re-run the paid canary to "try again": reconcile this '
  + 'transaction on chain first, because a blind retry settles a second 0.015 USDC.'

/** Map a node's reason onto the fixed vocabulary. Its words are never kept. */
function classify(reason: string): ObservationDetail {
  if (reason === 'not_yet_mined' || reason === 'receipt_not_found') return 'not_yet_mined'
  if (reason === 'transaction_reverted') return 'transaction_reverted'
  if (reason === 'no_matching_transfer') return 'no_matching_transfer'
  if (reason === 'transaction_not_a_hash') return 'transaction_not_a_hash'
  if (reason.startsWith('underpaid')) return 'underpaid'
  if (reason.startsWith('rpc_wrong_chain')) return 'rpc_wrong_chain'
  if (reason.startsWith('rpc')) return 'rpc_unavailable'
  return 'unclassified'
}

/**
 * Confirm the settlement the receipt declared, or say honestly what happened.
 *
 * Fail-closed, unlike the seller-side `confirmSettlement` it builds on. That one
 * must not withhold a resource the payer already paid for, so it serves on an
 * indeterminate result. This is the buyer proving its own spend, where the
 * opposite is true: an unproven settlement must never be reported as a pass.
 */
export async function confirmCanarySettlement(
  input: ConfirmCanarySettlementInput,
): Promise<SettlementConfirmation> {
  const pollIntervalMs = input.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS
  const timeoutMs = input.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const window = { pollIntervalMs, timeoutMs }
  const started = input.now()
  const observations: ConfirmationObservation[] = []
  const elapsed = () => input.now() - started
  const observe = (phase: 'transaction' | 'balance', detail: ObservationDetail) => {
    observations.push({ atMs: elapsed(), phase, detail })
  }

  const settle = (
    state: SettlementState,
    reason: SettlementReason,
    evidence: SettlementConfirmation['evidence'],
    interpretation: string,
    extra: Partial<SettlementConfirmation> = {},
  ): SettlementConfirmation => ({
    state,
    reason,
    evidence,
    passed: state === 'confirmed',
    observations,
    elapsedMs: elapsed(),
    window,
    retrySafety: state === 'confirmed' ? 'settled' : 'do_not_retry_blindly',
    interpretation: state === 'confirmed' ? interpretation : `${interpretation} ${DO_NOT_RETRY}`,
    ...extra,
  })

  // The receipt is a distinct signal from the chain, and a missing or
  // unsuccessful one is refused here rather than papered over by a balance that
  // happens to look right.
  if (!input.receipt) {
    return settle('contradicted', 'receipt_absent', 'none',
      'The endpoint returned no x402 settlement receipt, so there is no transaction to confirm.')
  }
  if (input.receipt.success !== true) {
    return settle('contradicted', 'receipt_unsuccessful', 'none',
      'The x402 settlement receipt did not report success.')
  }

  const transaction = input.receipt.transaction
  const hasUsableHash = typeof transaction === 'string' && TRANSACTION_HASH.test(transaction)

  /** True while there is room for another observation plus its wait. */
  const roomForAnotherPoll = () => elapsed() + pollIntervalMs <= timeoutMs

  if (hasUsableHash) {
    let sawNode = false
    for (;;) {
      const confirmation = await input.confirmTransaction(transaction)

      if (confirmation.status === 'confirmed') {
        observe('transaction', 'confirmed')
        // `confirmSettlement` accepts at least the minimum. The canary's spend
        // is fixed, so anything but the exact price is a contradiction.
        if (confirmation.amount !== input.expected.amountBaseUnits) {
          return settle('contradicted', 'amount_not_exact', 'transaction',
            `The confirmed transfer moved ${confirmation.amount} base units, not the authorized `
            + `${input.expected.amountBaseUnits}.`,
            { transaction, amountBaseUnits: confirmation.amount, blockNumber: confirmation.blockNumber })
        }
        return reconcileBalance(input, {
          settle, observe, roomForAnotherPoll,
          transaction, confirmation,
        })
      }

      if (confirmation.status === 'contradicted') {
        const detail = classify(confirmation.reason)
        observe('transaction', detail)
        return settle('contradicted', 'chain_contradicted', 'transaction',
          `The chain contradicted the declared settlement (${detail}).`, { transaction })
      }

      const detail = classify(confirmation.reason)
      observe('transaction', detail)
      if (detail === 'not_yet_mined') sawNode = true
      if (!roomForAnotherPoll()) break
      await input.delay(pollIntervalMs)
    }

    // The window closed. Whether the node was answering decides which of the
    // two honest non-answers this is.
    return sawNode
      ? settle('unconfirmed', 'not_observed_before_timeout', 'none',
        `The declared transaction was not mined within ${timeoutMs}ms. This is not evidence that it `
        + 'never settled; it may confirm after this run ended.', { transaction })
      : settle('unknown', 'rpc_unavailable', 'none',
        `No usable answer was obtained from the RPC endpoint within ${timeoutMs}ms, so nothing was `
        + 'established about this settlement either way.', { transaction })
  }

  // No usable transaction hash. Balance polling is all that is left, and it can
  // never bind a debit to this settlement, so it cannot produce a pass.
  return balanceOnlyFallback(input, { settle, observe, roomForAnotherPoll })
}

type Helpers = {
  settle: (
    state: SettlementState, reason: SettlementReason, evidence: SettlementConfirmation['evidence'],
    interpretation: string, extra?: Partial<SettlementConfirmation>,
  ) => SettlementConfirmation
  observe: (phase: 'transaction' | 'balance', detail: ObservationDetail) => void
  roomForAnotherPoll: () => boolean
}

/**
 * Reconcile the confirmed transfer against the wallet, with room for a lagging
 * node.
 *
 * The transaction is already proof. This is the second, independent signal the
 * evidence has always carried, kept because the canary wallet is dedicated and
 * idle, which is the only condition under which an exact delta means anything.
 */
async function reconcileBalance(
  input: ConfirmCanarySettlementInput,
  helpers: Helpers & { transaction: string; confirmation: Extract<ChainConfirmation, { status: 'confirmed' }> },
): Promise<SettlementConfirmation> {
  const { settle, observe, roomForAnotherPoll, transaction, confirmation } = helpers
  const expected = BigInt(input.expected.amountBaseUnits)
  const bound = {
    transaction,
    amountBaseUnits: confirmation.amount,
    blockNumber: confirmation.blockNumber,
  }

  for (;;) {
    let debited: bigint
    try {
      debited = input.balanceBefore - await input.readBalance()
    } catch {
      observe('balance', 'rpc_unavailable')
      if (!roomForAnotherPoll()) {
        return settle('unknown', 'rpc_unavailable', 'transaction',
          'The transfer is confirmed on chain, but the wallet balance could not be read to reconcile it.',
          bound)
      }
      await input.delay(input.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS)
      continue
    }

    if (debited === expected) {
      observe('balance', 'debit_exact')
      return settle('confirmed', 'settlement_confirmed', 'transaction',
        `Exactly ${confirmation.amount} base units moved to the authorized payee in transaction `
        + `${transaction}, and the dedicated buyer wallet is debited by the same amount.`,
        { ...bound, debitedBaseUnits: debited.toString() })
    }

    // Zero is the ordinary answer from a node a block behind, so it waits.
    // Anything else is the wallet disagreeing with a confirmed transfer, which
    // is a contradiction rather than something to keep polling through.
    if (debited !== BigInt(0)) {
      observe('balance', 'debit_unexpected')
      return settle('contradicted', 'balance_delta_not_exact', 'transaction',
        `The transfer is confirmed on chain, but the wallet moved by ${debited} base units rather than `
        + `the authorized ${input.expected.amountBaseUnits}. Concurrent wallet activity would also `
        + 'produce this, and it cannot be told apart from a wrong debit here.', bound)
    }

    observe('balance', 'no_debit_yet')
    if (!roomForAnotherPoll()) {
      return settle('unknown', 'balance_not_reconciled_before_timeout', 'transaction',
        'The transfer is confirmed on chain, but the wallet balance had not caught up before the '
        + 'window closed, so the exact-debit invariant is unverified.', bound)
    }
    await input.delay(input.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS)
  }
}

/**
 * The explicitly limited fallback, for a receipt with no usable transaction.
 *
 * Its best outcome is still not a pass. A balance says the wallet has less
 * money; it cannot say this payment is why, and any concurrent activity on the
 * wallet -- funding, a second canary, a manual transfer -- produces the same
 * delta. That is recorded as evidence and refused as proof.
 */
async function balanceOnlyFallback(
  input: ConfirmCanarySettlementInput,
  helpers: Helpers,
): Promise<SettlementConfirmation> {
  const { settle, observe, roomForAnotherPoll } = helpers
  const expected = BigInt(input.expected.amountBaseUnits)
  let sawWallet = false

  for (;;) {
    let debited: bigint
    try {
      debited = input.balanceBefore - await input.readBalance()
      sawWallet = true
    } catch {
      observe('balance', 'rpc_unavailable')
      if (!roomForAnotherPoll()) break
      await input.delay(input.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS)
      continue
    }

    if (debited === expected) {
      observe('balance', 'debit_exact')
      return settle('unconfirmed', 'balance_only_attribution_unsafe', 'balance_only',
        `The wallet is debited by exactly ${input.expected.amountBaseUnits} base units, but the receipt `
        + 'carried no usable transaction hash, so that debit cannot be bound to this settlement. '
        + 'Concurrent wallet activity produces an identical delta.',
        { debitedBaseUnits: debited.toString() })
    }

    if (debited !== BigInt(0)) {
      observe('balance', 'debit_unexpected')
      return settle('contradicted', 'balance_delta_not_exact', 'balance_only',
        `The wallet moved by ${debited} base units, which is neither the authorized `
        + `${input.expected.amountBaseUnits} nor no movement at all.`,
        { debitedBaseUnits: debited.toString() })
    }

    observe('balance', 'no_debit_yet')
    if (!roomForAnotherPoll()) break
    await input.delay(input.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS)
  }

  return sawWallet
    ? settle('unconfirmed', 'transaction_missing_or_malformed', 'none',
      'The settlement receipt carried no usable transaction hash, and no debit appeared on the wallet '
      + 'within the window. Nothing here establishes that the settlement did or did not happen.')
    : settle('unknown', 'rpc_unavailable', 'none',
      'The settlement receipt carried no usable transaction hash and the wallet could not be read, so '
      + 'nothing was established about this settlement either way.')
}

/** The sanitized subset that may be written to an uploaded artifact. */
export function settlementEvidence(confirmation: SettlementConfirmation) {
  return {
    state: confirmation.state,
    reason: confirmation.reason,
    evidence: confirmation.evidence,
    confirmedOnChain: confirmation.state === 'confirmed' && confirmation.evidence === 'transaction',
    ...(confirmation.transaction ? { transaction: confirmation.transaction } : {}),
    ...(confirmation.amountBaseUnits ? { amountBaseUnits: confirmation.amountBaseUnits } : {}),
    ...(confirmation.blockNumber !== undefined ? { blockNumber: confirmation.blockNumber } : {}),
    ...(confirmation.debitedBaseUnits ? { debitedBaseUnits: confirmation.debitedBaseUnits } : {}),
    observations: confirmation.observations,
    elapsedMs: confirmation.elapsedMs,
    window: confirmation.window,
    retrySafety: confirmation.retrySafety,
    interpretation: confirmation.interpretation,
  }
}
