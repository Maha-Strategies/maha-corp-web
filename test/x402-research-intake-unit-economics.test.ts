import assert from 'node:assert/strict'
import test from 'node:test'

import { RESEARCH_INTAKE_EVIDENCE_PACK_OFFER } from '../lib/x402/offers.ts'
import {
  CONSERVATIVE_RESEARCH_INTAKE_ECONOMICS,
  EXPECTED_RESEARCH_INTAKE_ECONOMICS,
  RESEARCH_INTAKE_MINIMUM_CONSERVATIVE_MARGIN_PERCENT,
  researchIntakeEconomics,
} from '../lib/x402/research-intake-unit-economics.ts'

test('the fixed one-dollar offer clears its explicit conservative margin gate', () => {
  const economics = CONSERVATIVE_RESEARCH_INTAKE_ECONOMICS()
  assert.equal(RESEARCH_INTAKE_EVIDENCE_PACK_OFFER.amount, '1000000')
  assert.equal(RESEARCH_INTAKE_MINIMUM_CONSERVATIVE_MARGIN_PERCENT, 30)
  assert.equal(economics.priceUsd, 1)
  assert.equal(economics.sectionCount, 10)
  assert.ok(Math.abs(economics.marginPercent - 34.7715) < 0.01, `margin was ${economics.marginPercent}`)
  assert.equal(economics.promotable, true)
})

test('expected economics are healthier and fewer supplied sections do not reduce the fixed-price margin', () => {
  const expected = EXPECTED_RESEARCH_INTAKE_ECONOMICS()
  const oneSection = researchIntakeEconomics({ scenario: 'one section', sectionCount: 1, tokensPerChar: 1, failureRate: 0.35 })
  assert.ok(expected.marginPercent > CONSERVATIVE_RESEARCH_INTAKE_ECONOMICS().marginPercent)
  assert.ok(oneSection.marginPercent > expected.marginPercent)
})

test('the model-call allowance is section-local rather than a whole-pack retry multiplier', () => {
  const conservative = CONSERVATIVE_RESEARCH_INTAKE_ECONOMICS()
  assert.ok(conservative.expectedModelCalls > 10)
  assert.ok(conservative.expectedModelCalls < 20)
  assert.equal(conservative.facilitatorUsd, 0.005)
  assert.equal(conservative.infrastructureUsd, 0.02)
})

test('the gate fails closed if the same offer falls below thirty percent', () => {
  const stressed = researchIntakeEconomics({
    scenario: 'intentionally stressed test',
    tokensPerChar: 1.5,
    failureRate: 0.7,
  })
  assert.ok(stressed.marginPercent < RESEARCH_INTAKE_MINIMUM_CONSERVATIVE_MARGIN_PERCENT)
  assert.equal(stressed.promotable, false)
})
