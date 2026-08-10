import assert from 'node:assert/strict'
import test from 'node:test'

import {
  BINDING_WORST_CASE,
  HYPOTHETICAL_32KB,
  MAX_OUTPUT_TOKENS,
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
  assert.equal(BINDING_WORST_CASE().priceUsd, 0.1)
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

  const worst = BINDING_WORST_CASE()
  // 6000 chars at the pessimistic 0.5 tokens/char, plus a ~700-token prompt,
  // is 3,700 input tokens: $0.0111. Output is capped at 1,500: $0.0225.
  assert.ok(Math.abs(worst.modelCostUsd - 0.0336) < 0.0005, `model cost was ${worst.modelCostUsd}`)
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

test('ten cents covers the worst case that can actually reach the model', () => {
  const worst = BINDING_WORST_CASE()
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

  // Comfortably, not marginally. A margin under ~25% at list price leaves no
  // room for a model price change and would not be safe to promote.
  assert.ok(worst.marginPercent > 25, `margin was ${worst.marginPercent.toFixed(1)}%`)
})

test('the minimum safe price is reported, so a loss-making offer is never shipped silently', () => {
  const worst = BINDING_WORST_CASE()
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
  assert.ok(hypothetical.totalCostUsd > BINDING_WORST_CASE().totalCostUsd)

  // The finding, stated as it actually falls out: at a 32 KB passage ten cents
  // still covers cost, but only just -- the margin collapses from comfortable
  // to single digits, which is below the threshold at which this offer is
  // safe to promote. So raising the passage cap is not free; it is a repricing
  // decision, and this is the number attached to it.
  assert.equal(hypothetical.covered, true)
  assert.ok(hypothetical.marginPercent < 10, `margin was ${hypothetical.marginPercent.toFixed(1)}%`)
  assert.ok(
    hypothetical.marginPercent < BINDING_WORST_CASE().marginPercent / 3,
    'the 32 KB case must be visibly worse than the binding case, or the cap is doing nothing',
  )
})
