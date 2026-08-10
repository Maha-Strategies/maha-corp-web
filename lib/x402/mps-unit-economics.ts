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
 * Tokens per character, worst case.
 *
 * English prose runs about 0.25. This uses 0.5 because the passage is
 * caller-supplied and the cap is in *characters*: dense CJK, heavy markup, or
 * base64-ish content tokenizes far worse than prose, and the cap does not stop
 * them. Estimating with the prose ratio would understate the ceiling by about
 * half on exactly the inputs that cost the most.
 */
export const WORST_CASE_TOKENS_PER_CHAR = 0.5

/** The audit prompt template, measured once at MAX. Rounded up. */
export const PROMPT_TEMPLATE_TOKENS = 700

export type CostBreakdown = {
  label: string
  inputTokens: number
  outputTokens: number
  modelCostUsd: number
}

export function modelCost(passageChars: number, label: string): CostBreakdown {
  const inputTokens = Math.ceil(passageChars * WORST_CASE_TOKENS_PER_CHAR) + PROMPT_TEMPLATE_TOKENS
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
export const ASSUMED_FAILURE_RATE = 0.15

export function expectedRetryMultiplier(failureRate = ASSUMED_FAILURE_RATE, maxAttempts = MAX_AUDIT_ATTEMPTS): number {
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

export function unitEconomics(passageChars: number, scenario: string, priceBaseUnits = MPS_AUTONOMOUS_AUDIT_OFFER.amount): UnitEconomics {
  const priceUsd = Number(priceBaseUnits) / 10 ** USDC_DECIMALS
  const cost = modelCost(passageChars, scenario)
  const expectedModelCostUsd = cost.modelCostUsd * expectedRetryMultiplier()
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

/** The binding case: the largest passage the engine will actually accept. */
export const BINDING_WORST_CASE = () => unitEconomics(MAX_AUDIT_PASSAGE_CHARS, `${MAX_AUDIT_PASSAGE_CHARS}-character passage (engine cap)`)

/**
 * The hypothetical the brief asked about: a full 32 KB body reaching the model.
 *
 * Unreachable today, and computed anyway. If the passage cap is ever raised to
 * the body limit, this is the number that decides whether $0.10 survives it.
 */
export const HYPOTHETICAL_32KB = () => unitEconomics(32_768, '32,768-character passage (body limit, not currently reachable)')
