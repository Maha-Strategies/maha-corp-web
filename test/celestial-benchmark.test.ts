import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildBenchmarkProtocol,
  buildBenchmarkSubmission,
  scoreBenchmarkParticipant,
  validateBenchmarkProtocol,
  validateBenchmarkSubmission,
} from '../lib/celestial-hypotheses/benchmark.ts'

test('a benchmark protocol cryptographically fixes its primary score and stopping rule', () => {
  const protocol = buildBenchmarkProtocol({
    protocolId: 'bench_a1b2c3d4e5f60718', activityType: 'software-release', metricId: 'rollback_free_release',
    targetRate: 0.8, minimumTasks: 40,
    stoppingRule: 'Score once after exactly forty eligible blinded tasks.',
    multiplicityPolicy: 'One primary comparison per participant against each declared baseline.',
  })
  assert.deepEqual(validateBenchmarkProtocol(protocol), [])
  assert.equal(protocol.primaryMetric, 'accuracy-with-abstention-as-error')
  assert.match(protocol.protocolSha256, /^sha256:[a-f0-9]{64}$/)
})

test('the benchmark rejects submissions made after the outcome is available', () => {
  const submission = buildBenchmarkSubmission({
    protocolId: 'bench_a1b2c3d4e5f60718', blindedTaskId: 'task_a1b2c3d4e5f60718',
    participantPseudonym: 'pseudo_engine01', participantKind: 'maha-rule-engine',
    submittedAtUtc: '2026-09-03T00:00:00Z', prediction: 'meets-or-exceeds-target',
    structuredVerdictSha256: `sha256:${'a'.repeat(64)}`,
  })
  const issues = validateBenchmarkSubmission(submission, {
    blindedTaskId: submission.blindedTaskId, observedRate: 0.9, targetRate: 0.8,
    outcomeAvailableAtUtc: '2026-09-02T00:00:00Z',
  })
  assert.ok(issues.some((issue) => issue.includes('before the outcome')))
})

test('humans and baselines use the same prediction shape without seeing the engine digest', () => {
  const human = buildBenchmarkSubmission({
    protocolId: 'bench_a1b2c3d4e5f60718', blindedTaskId: 'task_a1b2c3d4e5f60718',
    participantPseudonym: 'pseudo_human001', participantKind: 'human-astrologer',
    submittedAtUtc: '2026-09-01T00:00:00Z', prediction: 'misses-target', structuredVerdictSha256: null,
  })
  assert.deepEqual(validateBenchmarkSubmission(human), [])
})

test('abstention remains in the primary denominator and coverage is reported separately', () => {
  const inputs = [
    ['task_a1b2c3d4e5f60718', 'meets-or-exceeds-target'],
    ['task_b1b2c3d4e5f60718', 'abstain'],
  ] as const
  const submissions = inputs.map(([blindedTaskId, prediction]) => buildBenchmarkSubmission({
    protocolId: 'bench_a1b2c3d4e5f60718', blindedTaskId,
    participantPseudonym: 'pseudo_engine01', participantKind: 'maha-rule-engine',
    submittedAtUtc: '2026-09-01T00:00:00Z', prediction,
    structuredVerdictSha256: `sha256:${'a'.repeat(64)}`,
  }))
  const outcomes = inputs.map(([blindedTaskId]) => ({
    blindedTaskId, observedRate: 0.9, targetRate: 0.8, outcomeAvailableAtUtc: '2026-09-03T00:00:00Z',
  }))
  const score = scoreBenchmarkParticipant(submissions, outcomes)
  assert.equal(score.accuracyWithAbstentionAsError, 0.5)
  assert.equal(score.coverage, 0.5)
  assert.equal(score.accuracyWhenAnswered, 1)
})
