// Charging for the Context Compiler in proportion to what it actually saved.
//
// The flat credit charged at the proxy prices a *request*. What the caller
// buys is avoided input tokens, and those vary by three orders of magnitude
// between a 2 KB retrieval payload and a 300 KB agent trace. A flat price is
// therefore simultaneously too expensive for the small call and almost free
// for the large one, which is the wrong way round: the large call is where the
// value is.
//
// So a second, metered component is charged after the work, from the same
// `tokensSaved` figure the response already returns. That number is the whole
// basis of the product's claim, it is reproducible from the pack, and the
// caller can check it -- which is what makes charging on it defensible rather
// than a number we assert.
//
// Four rules keep it honest:
//
//   * Nothing is charged when nothing was saved. Measured workloads exist
//     where this tool makes the payload larger -- scraped pages at -19.3%,
//     tabular data at -58.0% -- and billing for those would be charging for
//     harm. `tokensSaved` floors at zero, and so does the charge.
//   * Only whole units count. `floor`, not `ceil`: a caller who saved 4,999
//     tokens pays nothing beyond the flat credit rather than being rounded up
//     into a full one. The cliff at the bottom of a `ceil` is where usage
//     pricing earns its bad reputation.
//   * There is a ceiling, so a single call can never produce a surprise.
//   * A caller may set its own, lower ceiling per request, because an
//     autonomous buyer needs a bound it chose rather than one it discovered.

/** Tokens of saving that buy one credit beyond the flat per-request credit. */
export const TOKENS_SAVED_PER_CREDIT = 5_000

/**
 * Most metered credits one call can add.
 *
 * 60 covers the enterprise payload ceiling (~303k estimated tokens) even if
 * every token were saved, so the cap is a guardrail against a defect rather
 * than a silent discount on legitimate large work.
 */
export const MAX_METERED_CREDITS_PER_CALL = 60

/** Header a caller sets to cap what this single request may add. */
export const MAX_BILLABLE_CREDITS_HEADER = 'x-maha-max-billable-credits'
/** Header echoing what was actually added, so a client can reconcile. */
export const CREDITS_CHARGED_HEADER = 'x-maha-metered-credits-charged'

/**
 * Off unless explicitly enabled.
 *
 * Existing keys were sold under "one credit per request". Switching them to a
 * usage model because a deploy went out would change what people are charged
 * without anyone deciding to, so this reads as disabled anywhere the variable
 * is absent or is not exactly 'true'.
 */
export function meteredBillingEnabled(environment: NodeJS.ProcessEnv = process.env): boolean {
  return environment.CONTEXT_COMPILER_METERED_BILLING?.trim() === 'true'
}

export type MeteredQuote = {
  /** Credits to charge in addition to the flat per-request credit. */
  meteredCredits: number
  tokensSaved: number
  tokensSavedPerCredit: number
  /** The ceiling that actually applied, whether ours or the caller's. */
  appliedCeiling: number
  /** Set when a caller-supplied ceiling, not the service ceiling, bound it. */
  cappedByCaller: boolean
}

/**
 * Parse the caller's per-request ceiling.
 *
 * A malformed value is treated as absent rather than as zero. Reading a
 * typo as "charge me nothing" would make the meter trivially avoidable, and
 * reading it as "no limit" would ignore an instruction the caller meant.
 * Absent means the service ceiling applies, which is the documented default.
 */
export function parseCallerCeiling(headerValue: string | null): number | null {
  if (headerValue === null) return null
  const trimmed = headerValue.trim()
  if (!/^\d{1,6}$/.test(trimmed)) return null
  const parsed = Number(trimmed)
  return Number.isSafeInteger(parsed) ? parsed : null
}

/**
 * What this call adds, given what it saved.
 *
 * Deliberately pure and synchronous: pricing is the part that has to be
 * inspectable and reproducible from the response, so it takes numbers and
 * returns numbers, and the ledger call lives at the call site.
 */
export function quoteMeteredCredits(input: {
  tokensSaved: number
  callerCeiling?: number | null
}): MeteredQuote {
  const tokensSaved = Number.isFinite(input.tokensSaved) ? Math.max(0, Math.floor(input.tokensSaved)) : 0
  const callerCeiling = typeof input.callerCeiling === 'number' && input.callerCeiling >= 0
    ? Math.floor(input.callerCeiling)
    : null

  const appliedCeiling = callerCeiling === null
    ? MAX_METERED_CREDITS_PER_CALL
    : Math.min(callerCeiling, MAX_METERED_CREDITS_PER_CALL)

  const earned = Math.floor(tokensSaved / TOKENS_SAVED_PER_CREDIT)
  const meteredCredits = Math.min(earned, appliedCeiling)

  return {
    meteredCredits,
    tokensSaved,
    tokensSavedPerCredit: TOKENS_SAVED_PER_CREDIT,
    appliedCeiling,
    cappedByCaller: callerCeiling !== null && earned > appliedCeiling && appliedCeiling === callerCeiling,
  }
}

/** What the response tells the caller about what it was charged. */
export type BillingDisclosure = {
  model: 'flat' | 'flat_plus_metered'
  /** Charged before the work, at the proxy, for every authorized request. */
  flatCredits: number
  meteredCredits: number
  tokensSaved: number
  tokensSavedPerCredit: number
  /** Absent when the ledger could not be read; never guessed. */
  remainingCredits?: number
  /** Present when a charge was owed but not applied, and why. */
  unbilledReason?: 'billing_disabled' | 'ledger_unavailable' | 'credit_balance_depleted' | 'capped_by_caller'
}

/** What the credit ledger reported, in the shape `consumeAdditionalApiCredits` returns. */
export type ChargeOutcome =
  | { kind: 'charged'; remainingCredits: number | null }
  | { kind: 'depleted' }
  | { kind: 'unavailable' }

/**
 * Turn a quote and a ledger result into what the caller is told.
 *
 * Separated from the route because this is the part with a decision table, and
 * a decision table that cannot be tested is a decision table that will be
 * wrong. The route keeps only the ledger call and the response assembly.
 *
 * `meteredCredits` reports what was *actually taken*, never what was owed. A
 * disclosure that reports an intended charge as a real one would reconcile
 * against a ledger that disagrees, and the whole point of returning this block
 * is that a caller can check it.
 */
export function buildBillingDisclosure(input: {
  quote: MeteredQuote
  enabled: boolean
  charge?: ChargeOutcome
}): BillingDisclosure {
  const { quote, enabled, charge } = input
  const disclosure: BillingDisclosure = {
    model: enabled ? 'flat_plus_metered' : 'flat',
    flatCredits: 1,
    meteredCredits: 0,
    tokensSaved: quote.tokensSaved,
    tokensSavedPerCredit: quote.tokensSavedPerCredit,
  }

  // Disclosed even while disabled, so an operator can read what the model
  // would have charged before switching it on for anyone.
  if (!enabled) {
    if (quote.meteredCredits > 0) disclosure.unbilledReason = 'billing_disabled'
    return disclosure
  }

  if (quote.cappedByCaller) disclosure.unbilledReason = 'capped_by_caller'
  if (quote.meteredCredits === 0) return disclosure

  if (!charge || charge.kind !== 'charged') {
    disclosure.unbilledReason = charge?.kind === 'depleted' ? 'credit_balance_depleted' : 'ledger_unavailable'
    return disclosure
  }

  disclosure.meteredCredits = quote.meteredCredits
  if (typeof charge.remainingCredits === 'number') disclosure.remainingCredits = charge.remainingCredits
  return disclosure
}
