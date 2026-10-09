import assert from 'node:assert/strict'
import test from 'node:test'
import { calculateGovernanceCost, CIVIC_MODEL_CARDS, costEvidenceInputSchema, evaluateCostEvidence } from '../lib/civic/model-evidence.ts'
import { civicDigest } from '../lib/civic/receipt.ts'
const scenario = { systems: 10, testsPerSystem: 2, hoursPerTest: 3, hourlyCostUsd: 100, reportsPerYear: 10, hoursPerReport: 1 }
test('AI governance arithmetic carries versions, provenance, uncertainty limits and deterministic receipts', () => {
  assert.deepEqual(calculateGovernanceCost(scenario), { testingHours: 60, reportingHours: 10, annualCostUsd: 7000 })
  const result = evaluateCostEvidence({ scenario, origin: 'synthetic-worked-example' })
  assert.equal(result.calibration.status, 'no-observations'); assert.equal(result.calibration.meanAbsoluteErrorUsd, null)
  assert.equal(result.digest, evaluateCostEvidence({ scenario: { ...scenario }, origin: 'synthetic-worked-example' }).digest)
  assert.match(result.limitation, /not empirical policy impact/)
  assert.ok(CIVIC_MODEL_CARDS.every(card => card.calibrationStatus.startsWith('uncalibrated')))
  assert.equal(CIVIC_MODEL_CARDS[0].sources[0].retrievedOn, '2026-10-04')
  const { digest, ...payload } = result; assert.equal(civicDigest(payload), digest)
})
test('one-at-a-time sensitivity uses bounded ranges rather than invented confidence intervals', () => {
  const result = evaluateCostEvidence({ scenario, origin: 'user-assumptions', ranges: { hourlyCostUsd: [50, 150] } })
  const row = result.sensitivity.find(item => item.driver === 'hourlyCostUsd')!
  assert.equal(row.lowCostUsd, 3500); assert.equal(row.highCostUsd, 10500)
  assert.equal(row.rangeBasis, 'user-supplied-range')
  for (const ranges of [{ unknown: [0, 1] }, { systems: [20, 30] }, { systems: [.5, 10] }]) assert.equal(costEvidenceInputSchema.safeParse({ scenario, origin: 'user-assumptions', ranges }).success, false)
})
test('calibration diagnostics bind source-dated user observations without promoting them to empirical validation', () => {
  const observation = { id: 'synthetic-observation', observedOn: '2026-10-07', scenario, observedAnnualCostUsd: 8000,
    source: { citation: 'Synthetic calibration fixture', url: 'https://example.test/fixture', publishedOn: '2026-10-07', checkedOn: null, contentDigest: null, verification: 'unreviewed-pointer' } }
  const result = evaluateCostEvidence({ scenario, origin: 'user-assumptions', observations: [observation] })
  assert.equal(result.calibration.meanAbsoluteErrorUsd, 1000); assert.equal(result.calibration.rootMeanSquaredErrorUsd, 1000)
  assert.equal(result.calibration.status, 'user-supplied-unverified-diagnostic')
  assert.notEqual(result.digest, evaluateCostEvidence({ scenario, origin: 'user-assumptions', observations: [{ ...observation, observedAnnualCostUsd: 9000 }] }).digest)
  assert.equal(costEvidenceInputSchema.safeParse({ scenario, origin: 'user-assumptions', observations: [observation, observation] }).success, false)
})
