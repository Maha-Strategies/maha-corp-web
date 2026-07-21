import assert from 'node:assert/strict'
import test from 'node:test'

import { experimentHash, experimentId, parseExperiment, parseExperimentAction } from '../lib/experiment-control.ts'

const draft = {
  sourceKind: 'search_performance', sourceReference: 'gscinsight_123456789012345678901234', hypothesis: 'Improving the opening answer will increase impressions and clicks for this query.',
  targetUrl: 'https://www.mahastrategies.com/mps/what-is-mps', intendedChange: 'Replace the opening paragraph with a direct definition and add one internal link.',
  callToAction: 'Read the MPS standard', primaryKpi: 'impressions', baselineValue: 20, baselineObservedOn: '2026-07-21', measureAfterOn: '2026-08-04', idempotencyKey: 'experiment-create-001',
}

test('parses a bounded experiment draft and creates safe identifiers', () => {
  const parsed = parseExperiment(draft)
  assert.equal(parsed.sourceKind, 'search_performance')
  assert.equal(parsed.primaryKpi, 'impressions')
  assert.match(experimentId(), /^experiment_[a-f0-9]{32}$/)
  assert.match(experimentHash('experiment-create-001'), /^sha256:[a-f0-9]{64}$/)
})

test('refuses external target URLs and invalid measurement windows', () => {
  assert.throws(() => parseExperiment({ ...draft, targetUrl: 'https://example.com/' }), /mahastrategies\.com/)
  assert.throws(() => parseExperiment({ ...draft, measureAfterOn: '2026-07-20' }), /must not be before/)
})

test('requires a measured value before an outcome can be recorded', () => {
  const id = 'experiment_1234567890abcdef1234567890abcdef'
  assert.throws(() => parseExperimentAction({ experimentId: id, action: 'retain', idempotencyKey: 'outcome-key-001' }), /outcomeValue/)
  assert.equal(parseExperimentAction({ experimentId: id, action: 'confirm_published', idempotencyKey: 'publish-key-001' }).action, 'confirm_published')
  assert.throws(() => parseExperimentAction({ experimentId: 'not-an-experiment', action: 'approve', idempotencyKey: 'approve-key-001' }), /experimentId/)
})
