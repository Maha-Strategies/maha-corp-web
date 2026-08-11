import assert from 'node:assert/strict'
import test from 'node:test'

import {
  CONSERVATIVE_CASE,
  CONSERVATIVE_FAILURE_RATE,
  CONSERVATIVE_TOKENS_PER_CHAR,
  EXPECTED_CASE,
  EXPECTED_TOKENS_PER_CHAR,
  HYPOTHETICAL_32KB,
  MAX_OUTPUT_TOKENS,
  MINIMUM_PROMOTABLE_MARGIN_PERCENT,
  MODEL_PRICING,
  expectedRetryMultiplier,
  unitEconomics,
} from '../lib/x402/mps-unit-economics.ts'
import { MPS_AUTONOMOUS_AUDIT_OFFER } from '../lib/x402/offers.ts'
import { MAX_AUDIT_ATTEMPTS, MAX_AUDIT_PASSAGE_CHARS } from '../lib/x402/mps-audit-job.ts'

// The gate the brief asked for: $0.10 must cover worst-case model cost,
// facilitator cost, an infrastructure allowance, and a reasonable failure
// allowance -- or the offer stays disabled with a documented minimum safe
// price. This is a test rather than a doc because a loss-making offer does not
// announce itself; it looks like traffic.

test('the offer is priced at ten cents', () => {
  assert.equal(MPS_AUTONOMOUS_AUDIT_OFFER.amount, '100000')
  assert.equal(CONSERVATIVE_CASE().priceUsd, 0.1)
})

test('0.5 tokens per character is the expected case, not a worst case', () => {
  // It was previously labelled worst case and it is not. English prose runs
  // ~0.25; dense CJK, minified code and base64 reach roughly one token per
  // character, and the cap is in characters, so nothing prevents it. Pricing
  // off the midpoint while calling it a ceiling understated the true ceiling
  // by half on exactly the inputs that cost most.
  assert.equal(EXPECTED_TOKENS_PER_CHAR, 0.5)
  assert.equal(CONSERVATIVE_TOKENS_PER_CHAR, 1.0)
  assert.ok(CONSERVATIVE_CASE().modelCostUsd > EXPECTED_CASE().modelCostUsd)
})

test('the conservative case also assumes a worse hour, not just worse input', () => {
  // Retries cluster exactly when the provider is unwell, and every retry is a
  // model call absorbed against a payment already taken.
  assert.ok(CONSERVATIVE_FAILURE_RATE > 0.15)
  assert.ok(expectedRetryMultiplier(CONSERVATIVE_FAILURE_RATE) > expectedRetryMultiplier(0.15))
})

test('the model cost is computed from the caps that actually bind', () => {
  // The output cap is the route's max_tokens; the input cap is the engine's
  // passage limit, not the 32 KB body limit. Both are read from the modules
  // that define them, so raising either fails this file rather than silently
  // eroding the margin.
  assert.equal(MAX_OUTPUT_TOKENS, 1_500)
  assert.equal(MAX_AUDIT_PASSAGE_CHARS, 6_000)
  assert.equal(MODEL_PRICING.inputPerMillionUsd, 3)
  assert.equal(MODEL_PRICING.outputPerMillionUsd, 15)

  // 6,000 characters at one token per character, plus a ~700-token prompt, is
  // 6,700 input tokens: $0.0201. Output is capped at 1,500: $0.0225.
  const worst = CONSERVATIVE_CASE()
  assert.ok(Math.abs(worst.modelCostUsd - 0.0426) < 0.0005, `model cost was ${worst.modelCostUsd}`)
})

test('the failure allowance prices the no-second-charge promise, not the happy path', () => {
  // A paid job may be resumed after a model failure without a second payment,
  // so every retry is a model call we absorb. Assuming one call per payment
  // would understate cost by exactly the promise the product makes.
  const multiplier = expectedRetryMultiplier()
  assert.ok(multiplier > 1, 'the expected number of model calls per payment must exceed one')
  assert.ok(Math.abs(multiplier - 1.1725) < 0.001, `multiplier was ${multiplier}`)

  // Bounded by the attempt ceiling rather than an unbounded geometric series.
  assert.ok(expectedRetryMultiplier(0.99) < MAX_AUDIT_ATTEMPTS + 1)
  assert.equal(expectedRetryMultiplier(0), 1)
})

test('ten cents covers the conservative case that can actually reach the model', () => {
  const worst = CONSERVATIVE_CASE()
  assert.equal(worst.covered, true)
  assert.ok(worst.marginUsd > 0, `margin was ${worst.marginUsd}`)

  // Every component the brief named is in the total.
  assert.ok(worst.expectedModelCostUsd > 0)
  assert.ok(worst.facilitatorUsd > 0, 'a zero facilitator allowance assumes a third party stays free forever')
  assert.ok(worst.infrastructureUsd > 0)
  assert.equal(
    Math.round((worst.expectedModelCostUsd + worst.facilitatorUsd + worst.infrastructureUsd) * 1e6),
    Math.round(worst.totalCostUsd * 1e6),
  )

  // Judged against the conservative case, not the expected one. An offer
  // priced off the expected case is priced for the days nothing goes wrong.
  assert.ok(
    worst.marginPercent > MINIMUM_PROMOTABLE_MARGIN_PERCENT,
    `conservative margin was ${worst.marginPercent.toFixed(1)}%, floor is ${MINIMUM_PROMOTABLE_MARGIN_PERCENT}%`,
  )
  // And the expected case is naturally healthier, which is what makes the
  // conservative figure the honest one to quote.
  assert.ok(EXPECTED_CASE().marginPercent > worst.marginPercent)
})

test('pricing is sound, which is not the same as the offer being ready', () => {
  // The offer stays withheld on infrastructure, not on economics. Conflating
  // the two would let a green margin be read as permission to ship.
  assert.equal(CONSERVATIVE_CASE().covered, true)
  assert.equal(MPS_AUTONOMOUS_AUDIT_OFFER.status, 'withheld')
  assert.equal(MPS_AUTONOMOUS_AUDIT_OFFER.availability.payableInProduction, false)
  assert.ok(MPS_AUTONOMOUS_AUDIT_OFFER.availability.blockedBy.length > 0)
})

test('the minimum safe price is reported, so a loss-making offer is never shipped silently', () => {
  const worst = CONSERVATIVE_CASE()
  assert.ok(Number(worst.minimumSafeAmountBaseUnits) > 0)
  // At the published price the floor is below what we charge -- that is what
  // "covered" means, expressed as a number rather than a boolean.
  assert.ok(Number(worst.minimumSafeAmountBaseUnits) < Number(MPS_AUTONOMOUS_AUDIT_OFFER.amount))

  // And the mechanism reports honestly when a price does not cover cost.
  const underpriced = unitEconomics(MAX_AUDIT_PASSAGE_CHARS, 'hypothetical one-cent offer', '10000')
  assert.equal(underpriced.covered, false)
  assert.ok(underpriced.marginUsd < 0)
  assert.ok(Number(underpriced.minimumSafeAmountBaseUnits) > 10_000)
})

test('the 32 KB figure is the body limit, not the model input, and is priced anyway', () => {
  // The brief asked for worst case "at the current 32 KB input". The passage
  // validator rejects anything over 6,000 characters with a 413 before a model
  // client is constructed, so 32 KB cannot reach the model. The hypothetical is
  // computed so that raising the cap is a decision with a number attached.
  const hypothetical = HYPOTHETICAL_32KB()
  assert.ok(hypothetical.totalCostUsd > CONSERVATIVE_CASE().totalCostUsd)

  // Under honest assumptions this is not merely thin, it is loss-making: a
  // 32 KB high-entropy passage costs about $0.19 to serve for $0.10. The
  // earlier calculation showed it as narrowly profitable, and it showed that
  // only because it priced tokens at half their worst rate. The 6,000-char cap
  // is doing real commercial work, not just protecting latency.
  assert.equal(hypothetical.covered, false)
  assert.ok(hypothetical.marginUsd < 0, `margin was ${hypothetical.marginUsd}`)
  assert.ok(
    Number(hypothetical.minimumSafeAmountBaseUnits) > Number(MPS_AUTONOMOUS_AUDIT_OFFER.amount),
    'raising the passage cap to the body limit would require repricing the offer',
  )
})
