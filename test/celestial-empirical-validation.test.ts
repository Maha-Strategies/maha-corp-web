import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

import {
  assessPredictiveSkill,
  buildPredictiveSkillPolicy,
  calculatePlanetaryFeatures,
  ingestExternalOutcomeDataset,
  issueProspectiveForecast,
  trainParallelCelestialModels,
  verifyModelArtifact,
} from '../lib/celestial-validation/engine.ts'

const sha = (character: string) => `sha256:${character.repeat(64)}`

function syntheticDataset() {
  const rows = Array.from({ length: 120 }, (_, index) => {
    const occurred = new Date(Date.UTC(2010, index, 1))
    return {
      eventId: `event_synthetic_${String(index).padStart(4, '0')}`,
      datasetId: 'dataset_synthetic_validation',
      occurredAtUtc: occurred.toISOString(),
      availableAtUtc: new Date(occurred.getTime() + 86_400_000).toISOString(),
      outcome: index % 3 === 0 ? 1 as const : 0 as const,
      sourceRecordId: `source-row-${index}`,
      sourceRecordSha256: sha((index % 10).toString()),
    }
  })
  return ingestExternalOutcomeDataset({
    datasetId: 'dataset_synthetic_validation',
    title: 'Synthetic validation fixture',
    outcomeDefinition: 'Binary fixture outcome generated before model fitting solely to test pipeline mechanics.',
    dataSourceId: 'source_synthetic_fixture',
    retrievedAtUtc: '2021-01-01T00:00:00.000Z',
    sourceManifestSha256: sha('a'),
    rows,
  })
}

test('external outcome ingestion validates chronology, provenance, classes, and a stable digest', () => {
  const first = syntheticDataset(); const second = syntheticDataset()
  assert.equal(first.rows.length, 120)
  assert.equal(first.datasetSha256, second.datasetSha256)
  assert.match(first.datasetSha256, /^sha256:[a-f0-9]{64}$/)
  assert.throws(() => ingestExternalOutcomeDataset({ ...first, rows: first.rows.slice(0, 99) }), /At least 100 rows/)
})

test('planetary features are reproducible and frame-explicit', () => {
  const tropical = calculatePlanetaryFeatures('event_feature_0001', '2026-08-17T00:00:00.000Z', { zodiac: 'tropical', origin: 'true-equinox-of-date' })
  const sidereal = calculatePlanetaryFeatures('event_feature_0001', '2026-08-17T00:00:00.000Z', { zodiac: 'sidereal', ayanamsha: 'lahiri', origin: 'lahiri-iau-ayanamsa' })
  assert.equal(tropical.featureNames.length, tropical.values.length)
  assert.equal(sidereal.featureNames.length, tropical.featureNames.length)
  assert.notEqual(tropical.vectorSha256, sidereal.vectorSha256)
  assert.deepEqual(tropical, calculatePlanetaryFeatures('event_feature_0001', '2026-08-17T00:00:00.000Z', { zodiac: 'tropical', origin: 'true-equinox-of-date' }))
})

test('temporal training fits digest-bound parallel models and never tunes on held-out rows', () => {
  const dataset = syntheticDataset()
  const fit = trainParallelCelestialModels(dataset, {
    validationStartsUtc: dataset.rows[60]!.availableAtUtc,
    testStartsUtc: dataset.rows[90]!.availableAtUtc,
    ridgeCandidates: [0.1, 1], iterations: 120, learningRate: 0.1,
  })
  assert.equal(fit.heldOutTest.eventIds.length, 30)
  assert.equal(fit.tropical.trainingEventIds.length, 60)
  assert.equal(fit.tropical.validationEventIds.length, 30)
  assert.ok(verifyModelArtifact(fit.tropical))
  assert.ok(verifyModelArtifact(fit.sidereal))
  for (const score of [fit.heldOutTest.baselineBrier, fit.heldOutTest.tropicalBrier, fit.heldOutTest.siderealBrier, fit.heldOutTest.equalWeightEnsembleBrier]) assert.ok(Number.isFinite(score))
  assert.match(fit.boundary, /not demonstrated prospective predictive skill/i)
})

test('prospective issuance calculates features and locks both fitted model predictions before the window', () => {
  const dataset = syntheticDataset()
  const fit = trainParallelCelestialModels(dataset, {
    validationStartsUtc: dataset.rows[60]!.availableAtUtc,
    testStartsUtc: dataset.rows[90]!.availableAtUtc,
    ridgeCandidates: [1], iterations: 100, learningRate: 0.1,
  })
  const prospectiveInput = {
    forecastId: 'forecast_prospective_0001', subjectPseudonym: 'pseudo_validation01', issuedAtUtc: '2026-08-17T00:00:00.000Z',
    outcomeWindowStartUtc: '2026-09-01T00:00:00.000Z', outcomeWindowEndUtc: '2026-10-01T00:00:00.000Z', fit,
    target: { metricId: 'objective_binary_metric', statement: 'The declared objective metric meets its frozen target.', resolutionProcedure: 'Read the immutable source record after the outcome window closes and compare it with the frozen target.', dataSourceId: 'source_objective_ledger' },
  }
  const forecast = issueProspectiveForecast(prospectiveInput)
  assert.equal(forecast.predictions.length, 2)
  assert.deepEqual(new Set(forecast.predictions.map((item) => item.featureBundle.frame.zodiac)), new Set(['tropical', 'sidereal']))
  assert.ok(forecast.predictions.every((item) => item.probability >= 0 && item.probability <= 1))
  assert.throws(() => issueProspectiveForecast({ ...prospectiveInput, issuedAtUtc: '2009-01-01T00:00:00.000Z' }), /trained after issuance/)
  const assessment = assessPredictiveSkill({
    prospective: [{ forecast, outcome: 1 }],
    policy: buildPredictiveSkillPolicy({
      policyId: 'policy_prospective_0001', lockedAtUtc: '2026-08-16T00:00:00.000Z',
      metricId: 'objective_binary_metric', dataSourceId: 'source_objective_ledger', minimumForecasts: 20, alpha: 0.05,
      requiredComparatorKinds: ['ordinary-operational-baseline', 'random-clock-baseline', 'human-astrologer'],
    }),
    benchmarkComparisons: [],
  })
  assert.equal(assessment.status, 'not-demonstrated')
  assert.ok(assessment.unmetCriteria.some((criterion) => criterion.includes('1 of 20')))
})

test('the database migration makes datasets, models, forecasts, and AstroBench records append-only', async () => {
  const sql = await readFile(new URL('../supabase/migrations/20260817000300_celestial_empirical_validation.sql', import.meta.url), 'utf8')
  for (const table of ['celestial_external_datasets', 'celestial_fitted_models', 'celestial_prospective_forecasts', 'celestial_forecast_outcomes', 'astrobench_assignments', 'astrobench_submissions', 'astrobench_analyses']) assert.match(sql, new RegExp(table))
  assert.match(sql, /revoke update, delete, truncate/i)
  assert.match(sql, /enforce_celestial_forecast_outcome_chronology/)
  assert.match(sql, /enforce_astrobench_chronology/)
  assert.doesNotMatch(sql, /grant[^;]*update/i)
})
