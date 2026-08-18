import assert from 'node:assert/strict'
import test from 'node:test'

import {
  applyHolmAdjustment,
  buildBlindedBenchmarkTask,
  buildBenchmarkProtocol,
  buildBenchmarkSubmission,
  compareBenchmarkParticipants,
  distributeBenchmarkTasks,
  recruitBenchmarkParticipant,
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

test('recruitment and distribution give every participant the same frozen blinded tasks', () => {
  const protocol = buildBenchmarkProtocol({
    protocolId: 'bench_a1b2c3d4e5f60718', activityType: 'software-release', metricId: 'rollback_free_release', targetRate: 0.8, minimumTasks: 20,
    stoppingRule: 'Score once after exactly twenty eligible blinded tasks.', multiplicityPolicy: 'Apply Holm adjustment to every declared paired comparison.',
  })
  const participants = ['pseudo_engine01', 'pseudo_human001'].map((participantPseudonym, index) => recruitBenchmarkParticipant({
    protocolId: protocol.protocolId, participantPseudonym, participantKind: index === 0 ? 'maha-rule-engine' : 'human-astrologer', recruitedAtUtc: '2026-08-01T00:00:00.000Z',
    eligibilityAttestation: 'Participant meets the frozen role-specific eligibility criteria for this protocol.', conflictDisclosure: 'No material conflict declared.',
  }))
  const tasks = Array.from({ length: 20 }, (_, index) => buildBlindedBenchmarkTask({
    protocolId: protocol.protocolId, blindedTaskId: `task_${String(index).padStart(16, 'a')}`, activityType: protocol.activityType,
    prompt: 'Predict whether the scheduled release will meet the declared objective target.', scheduledMomentUtc: '2026-09-02T00:00:00.000Z',
    submissionDeadlineUtc: '2026-09-01T00:00:00.000Z', outcomeAvailableAtUtc: '2026-09-03T00:00:00.000Z',
  }))
  const assignments = distributeBenchmarkTasks(protocol, participants, tasks, '2026-08-15T00:00:00.000Z')
  assert.equal(assignments.length, 40)
  assert.equal(new Set(assignments.filter((item) => item.participantPseudonym === 'pseudo_engine01').map((item) => item.blindedTaskId)).size, 20)
})

test('paired inference uses matched tasks, exact McNemar comparison, and Holm adjustment', () => {
  const protocol = buildBenchmarkProtocol({
    protocolId: 'bench_a1b2c3d4e5f60718', activityType: 'software-release', metricId: 'rollback_free_release', targetRate: 0.8, minimumTasks: 20,
    stoppingRule: 'Score once after exactly twenty eligible blinded tasks.', multiplicityPolicy: 'Apply Holm adjustment to every declared paired comparison.',
  })
  const ids = Array.from({ length: 20 }, (_, index) => `task_${String(index).padStart(16, 'b')}`)
  const submissions = (participantPseudonym: string, participantKind: 'maha-rule-engine' | 'human-astrologer', correctCount: number) => ids.map((blindedTaskId, index) => buildBenchmarkSubmission({
    protocolId: protocol.protocolId, blindedTaskId, participantPseudonym, participantKind, submittedAtUtc: '2026-09-01T00:00:00.000Z',
    prediction: index < correctCount ? 'meets-or-exceeds-target' : 'misses-target', structuredVerdictSha256: participantKind === 'maha-rule-engine' ? `sha256:${'a'.repeat(64)}` : null,
  }))
  const outcomes = ids.map((blindedTaskId) => ({ blindedTaskId, observedRate: 0.9, targetRate: 0.8, outcomeAvailableAtUtc: '2026-09-03T00:00:00.000Z' }))
  const comparison = compareBenchmarkParticipants(submissions('pseudo_engine01', 'maha-rule-engine', 18), submissions('pseudo_human001', 'human-astrologer', 10), outcomes, protocol)
  assert.equal(comparison.matchedTasks, 20)
  assert.equal(comparison.firstOnlyCorrect, 8)
  assert.equal(comparison.secondOnlyCorrect, 0)
  assert.ok(comparison.mcnemarExactPValue < 0.05)
  const adjusted = applyHolmAdjustment([comparison, { ...comparison, mcnemarExactPValue: 0.04 }])
  assert.ok(adjusted.every((item) => item.multiplicityAdjustedPValue !== null))
})
