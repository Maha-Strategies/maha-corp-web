import assert from 'node:assert/strict'
import test from 'node:test'

import { ensembleProbability, forecastDigest, scoreForecast, splitHistoricalEvents, validateForecast, type BinaryForecast } from '../lib/celestial-forecasting.ts'

const sha = `sha256:${'a'.repeat(64)}`
const forecast: BinaryForecast = {
  forecastId: 'forecast_maha_revenue_0001', subjectPseudonym: 'pseudo_maha0001',
  issuedAtUtc: '2026-08-16T00:00:00.000Z', outcomeWindowStartUtc: '2026-11-01T00:00:00.000Z', outcomeWindowEndUtc: '2027-01-25T00:00:00.000Z',
  target: { metricId: 'non-uzabase-revenue', statement: 'Maha records at least one non-Uzabase payment.', resolutionProcedure: 'Read settled receipts from the declared revenue ledger after the window closes.', dataSourceId: 'maha-revenue-ledger' },
  baselineProbability: 0.3,
  predictions: [
    { modelId: 'jupiter-tropical-v1', modelVersion: '1', probability: 0.55, trainedThroughUtc: '2026-08-01T00:00:00.000Z', trainingDatasetIds: ['maha-events-v1'], featureBundle: { bundleId: 'bundle_tropical', bundleSha256: sha, ephemerisVersion: 'Swiss Ephemeris 2.10', calculationMethod: 'geocentric apparent longitude', frame: { zodiac: 'tropical', origin: 'true-equinox-of-date' } } },
    { modelId: 'jupiter-lahiri-v1', modelVersion: '1', probability: 0.45, trainedThroughUtc: '2026-08-01T00:00:00.000Z', trainingDatasetIds: ['maha-events-v1'], featureBundle: { bundleId: 'bundle_lahiri', bundleSha256: sha, ephemerisVersion: 'Swiss Ephemeris 2.10', calculationMethod: 'geocentric apparent longitude', frame: { zodiac: 'sidereal', ayanamsha: 'lahiri', origin: 'swiss-ephemeris-standard' } } },
  ],
  ensemble: { policyVersion: 'fixed-linear-pool/1', weights: [{ modelId: 'jupiter-tropical-v1', weight: 0.5 }, { modelId: 'jupiter-lahiri-v1', weight: 0.5 }] },
  historicalEventIdsUsed: ['event_uzabase_registration'],
}

test('parallel forecasts require valid tropical and sidereal models', () => {
  assert.deepEqual(validateForecast(forecast), [])
  assert.match(forecastDigest(forecast), /^sha256:[a-f0-9]{64}$/)
  assert.equal(ensembleProbability(forecast), 0.5)
  assert.ok(validateForecast({ ...forecast, predictions: forecast.predictions.slice(0, 1), ensemble: { ...forecast.ensemble, weights: forecast.ensemble.weights.slice(0, 1) } }).some((issue) => issue.includes('sidereal')))
})

test('training leakage and post-hoc ensemble gaps are rejected', () => {
  const leaked = structuredClone(forecast); leaked.predictions[0]!.trainedThroughUtc = '2027-01-01T00:00:00.000Z'
  assert.ok(validateForecast(leaked).some((issue) => issue.includes('trained past')))
  const missing = structuredClone(forecast); missing.ensemble.weights.pop()
  assert.ok(validateForecast(missing).some((issue) => issue.includes('exactly once')))
})

test('scores models and ensemble against the ordinary baseline', () => {
  const scored = scoreForecast(forecast, 1)
  assert.equal(scored.ensemble.probability, 0.5)
  assert.equal(scored.ensemble.brier, 0.25)
  assert.ok(scored.ensemble.brierSkillVersusBaseline! > 0)
  assert.equal(scored.models.length, 2)
})

test('historical splits follow when outcomes became available', () => {
  const events = [
    { eventId: 'event_training_0001', datasetId: 'dataset_maha_0001', occurredAtUtc: '2025-01-01T00:00:00.000Z', availableAtUtc: '2025-02-01T00:00:00.000Z', outcome: 1 as const, sourceRecordSha256: sha },
    { eventId: 'event_validation_0001', datasetId: 'dataset_maha_0001', occurredAtUtc: '2025-08-01T00:00:00.000Z', availableAtUtc: '2025-09-01T00:00:00.000Z', outcome: 1 as const, sourceRecordSha256: sha },
    { eventId: 'event_testing_0001', datasetId: 'dataset_maha_0001', occurredAtUtc: '2026-01-01T00:00:00.000Z', availableAtUtc: '2026-02-01T00:00:00.000Z', outcome: 0 as const, sourceRecordSha256: sha },
  ]
  assert.deepEqual([...splitHistoricalEvents(events, '2025-06-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z').values()], ['train', 'validation', 'test'])
  assert.throws(() => splitHistoricalEvents([{ ...events[0]!, availableAtUtc: '2024-01-01T00:00:00.000Z' }], '2025-06-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'), /Invalid historical event/)
})
