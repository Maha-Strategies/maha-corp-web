import assert from 'node:assert/strict'
import test from 'node:test'

import { evaluateSom, parseSomEvaluation, somEvaluationId, somHash } from '../lib/som-evaluator.ts'

const input = { priceCents: 1_000, variableCostCents: 100, monthlyOperatingCostCents: 2_500, oneTimeBuildCostCents: 50_000, expectedMonthlyQualifiedDemand: 100, expectedConversionRateBps: 1_000, competitorPressure: 3, willingnessToPayEvidence: 7, policyRisk: 2, assumptionNote: 'Conservative estimate based on the validated demand cluster and current operating costs.' }

test('calculates a transparent build candidate from stated assumptions', () => {
  const result = evaluateSom(input, 85)
  assert.equal(result.decision, 'build_candidate')
  assert.equal(result.expectedMonthlyOrders, 10)
  assert.equal(result.expectedMonthlyRevenueCents, 10_000)
  assert.equal(result.expectedMonthlyContributionCents, 6_500)
})

test('rejects negative unit economics and parses bounded inputs', () => {
  assert.equal(evaluateSom({ ...input, monthlyOperatingCostCents: 50_000 }, 85).decision, 'reject')
  const parsed = parseSomEvaluation({ ...input, demandClusterId: 'demand_1234567890abcdef1234567890abcdef', idempotencyKey: 'som-evaluation-001' })
  assert.equal(parsed.priceCents, 1_000)
  assert.match(somEvaluationId(), /^som_[a-f0-9]{32}$/)
  assert.match(somHash('som-evaluation-001'), /^sha256:[a-f0-9]{64}$/)
})
