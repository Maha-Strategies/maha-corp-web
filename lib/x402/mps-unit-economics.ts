import { MAX_AUDIT_ATTEMPTS, MAX_AUDIT_PASSAGE_CHARS, MPS_AUDIT_MODEL } from './mps-audit-job.ts'
import { MPS_AUTONOMOUS_AUDIT_OFFER, USDC_DECIMALS } from './offers.ts'

// Worst-case variable cost of one paid MPS audit, computed rather than asserted.
//
// The reason this is code and not a paragraph in a doc: the inputs move. The
// passage cap, the output cap, the model, and the price are all defined
// elsewhere in this repo, and a doc that quotes them is correct until the day
// one of them changes and nobody re-reads it. A loss-making offer does not
// announce itself -- it looks like traffic.
//
// A correction worth stating plainly, because the brief asked for the number at
// "the current 32 KB input": 32 KB is the HTTP body limit, not the model input.
// `validateAuditPassage` rejects any passage over MAX_AUDIT_PASSAGE_CHARS
// (6,000) with a 413 before a client is ever constructed, so the model cannot
// be handed 32 KB. Both figures are computed below -- the binding one, and the
// hypothetical 32 KB one -- because the difference is the whole margin.

/** Anthropic list price for the audit model, USD per million tokens. */
export const MODEL_PRICING = {
  model: MPS_AUDIT_MODEL,
  inputPerMillionUsd: 3,
  outputPerMillionUsd: 15,
} as const

/** The route's `max_tokens`. An audit cannot bill more output than this. */
export const MAX_OUTPUT_TOKENS = 1_500

/**
 * Tokens per character.
 *
 * 0.5 was previously labelled "worst case" and it is not. English prose runs
 * about 0.25; dense CJK, minified code, base64 and other high-entropy input
 * tokenize at roughly one token per character on this tokenizer, and the cap is
 * expressed in *characters*, so nothing stops a payer sending exactly that.
 * Calling the midpoint a ceiling understated the true ceiling by half on
 * precisely the inputs that cost the most -- and the offer's margin was then
 * argued from that understatement.
 *
 * Both are kept. The expected case is what the business will usually see; the
 * conservative case is what it must survive, and it is the one the promotion
 * gate is judged against.
 */
export const EXPECTED_TOKENS_PER_CHAR = 0.5
export const CONSERVATIVE_TOKENS_PER_CHAR = 1.0

/** The audit prompt template, measured once at MAX. Rounded up. */
export const PROMPT_TEMPLATE_TOKENS = 700

export type CostBreakdown = {
  label: string
  inputTokens: number
  outputTokens: number
  modelCostUsd: number
}

export function modelCost(passageChars: number, label: string, tokensPerChar = CONSERVATIVE_TOKENS_PER_CHAR): CostBreakdown {
  const inputTokens = Math.ceil(passageChars * tokensPerChar) + PROMPT_TEMPLATE_TOKENS
  const outputTokens = MAX_OUTPUT_TOKENS
  return {
    label,
    inputTokens,
    outputTokens,
    modelCostUsd:
      (inputTokens / 1_000_000) * MODEL_PRICING.inputPerMillionUsd
      + (outputTokens / 1_000_000) * MODEL_PRICING.outputPerMillionUsd,
  }
}

/**
 * Non-model variable cost per paid audit.
 *
 * Facilitator: the CDP mainnet facilitator does not charge a per-settlement fee
 * at this volume and sponsors Base gas. A non-zero allowance is carried anyway,
 * because pricing an offer on the assumption that a third party stays free is
 * how a margin disappears without any code changing.
 *
 * Infrastructure: one serverless invocation with a 60s ceiling, a handful of
 * Postgres writes, and one Upstash slot round-trip.
 */
export const FACILITATOR_ALLOWANCE_USD = 0.005
export const INFRASTRUCTURE_ALLOWANCE_USD = 0.002

/**
 * Failure allowance.
 *
 * A paid job may be resumed after a model failure without a second payment, up
 * to MAX_AUDIT_ATTEMPTS. Every retry costs us a full model call and earns
 * nothing. This prices the expected cost of that promise rather than assuming
 * the happy path: a 15% first-attempt failure rate, with the geometric tail
 * bounded by the attempt ceiling.
 */
export const EXPECTED_FAILURE_RATE = 0.15
/**
 * The rate the offer must survive, not the one it expects.
 *
 * A model provider having a bad hour is exactly when retries cluster, and every
 * retry is a model call absorbed against a payment already taken.
 */
export const CONSERVATIVE_FAILURE_RATE = 0.35

export function expectedRetryMultiplier(failureRate = EXPECTED_FAILURE_RATE, maxAttempts = MAX_AUDIT_ATTEMPTS): number {
  // Expected number of model calls per paid job: 1, plus one more for each
  // additional attempt reached, capped at maxAttempts.
  let expected = 0
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) expected += failureRate ** attempt
  return expected
}

export type UnitEconomics = {
  scenario: string
  priceUsd: number
  modelCostUsd: number
  expectedModelCostUsd: number
  facilitatorUsd: number
  infrastructureUsd: number
  totalCostUsd: number
  marginUsd: number
  marginPercent: number
  covered: boolean
  /** Lowest price in USDC base units that covers this scenario. */
  minimumSafeAmountBaseUnits: string
}

export function unitEconomics(
  passageChars: number,
  scenario: string,
  priceBaseUnits = MPS_AUTONOMOUS_AUDIT_OFFER.amount,
  assumptions: { tokensPerChar?: number; failureRate?: number } = {},
): UnitEconomics {
  const priceUsd = Number(priceBaseUnits) / 10 ** USDC_DECIMALS
  const cost = modelCost(passageChars, scenario, assumptions.tokensPerChar ?? CONSERVATIVE_TOKENS_PER_CHAR)
  const expectedModelCostUsd = cost.modelCostUsd * expectedRetryMultiplier(assumptions.failureRate ?? CONSERVATIVE_FAILURE_RATE)
  const totalCostUsd = expectedModelCostUsd + FACILITATOR_ALLOWANCE_USD + INFRASTRUCTURE_ALLOWANCE_USD
  const marginUsd = priceUsd - totalCostUsd

  // Round the floor up to the next whole base unit so the answer is a price
  // that can actually be charged.
  const minimum = Math.ceil(totalCostUsd * 10 ** USDC_DECIMALS)

  return {
    scenario,
    priceUsd,
    modelCostUsd: cost.modelCostUsd,
    expectedModelCostUsd,
    facilitatorUsd: FACILITATOR_ALLOWANCE_USD,
    infrastructureUsd: INFRASTRUCTURE_ALLOWANCE_USD,
    totalCostUsd,
    marginUsd,
    marginPercent: (marginUsd / priceUsd) * 100,
    covered: marginUsd > 0,
    minimumSafeAmountBaseUnits: String(minimum),
  }
}

/**
 * What the business will usually see: prose-like input, ordinary failure rate.
 */
export const EXPECTED_CASE = () => unitEconomics(
  MAX_AUDIT_PASSAGE_CHARS,
  `${MAX_AUDIT_PASSAGE_CHARS}-character passage, expected case`,
  MPS_AUTONOMOUS_AUDIT_OFFER.amount,
  { tokensPerChar: EXPECTED_TOKENS_PER_CHAR, failureRate: EXPECTED_FAILURE_RATE },
)

/**
 * What it must survive: high-entropy input at the cap, and a bad hour.
 *
 * This is the number the promotion gate is judged against. An offer priced off
 * the expected case is priced for the days nothing goes wrong.
 */
export const CONSERVATIVE_CASE = () => unitEconomics(
  MAX_AUDIT_PASSAGE_CHARS,
  `${MAX_AUDIT_PASSAGE_CHARS}-character passage, conservative case`,
)

/** Retained name, now pointing at the conservative figure it always implied. */
export const BINDING_WORST_CASE = CONSERVATIVE_CASE

/**
 * The hypothetical the brief asked about: a full 32 KB body reaching the model.
 *
 * Unreachable today, and computed anyway. If the passage cap is ever raised to
 * the body limit, this is the number that decides whether $0.10 survives it.
 */
export const HYPOTHETICAL_32KB = () => unitEconomics(32_768, '32,768-character passage (body limit, not currently reachable)')

/** The floor a withheld offer must clear before it may be promoted. */
export const MINIMUM_PROMOTABLE_MARGIN_PERCENT = 25
