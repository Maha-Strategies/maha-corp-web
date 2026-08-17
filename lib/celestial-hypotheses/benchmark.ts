/** Common, blinded scoring contract for prospective celestial-timing tests. */

import { digestOf, isExplicitUtcInstant } from './canonical.ts'
import { ACTIVITY_TYPES, SHA256_PATTERN, type ActivityType } from './types.ts'

export const BENCHMARK_PROTOCOL_VERSION = 'astrobench/0.1' as const
export const BENCHMARK_PARTICIPANT_KINDS = [
  'maha-rule-engine',
  'human-astrologer',
  'ordinary-operational-baseline',
  'random-clock-baseline',
] as const
export type BenchmarkParticipantKind = typeof BENCHMARK_PARTICIPANT_KINDS[number]

export type BenchmarkPrediction = 'meets-or-exceeds-target' | 'misses-target' | 'abstain'

export interface BenchmarkProtocol {
  protocolVersion: typeof BENCHMARK_PROTOCOL_VERSION
  protocolId: string
  activityType: ActivityType
  metricId: string
  targetRate: number
  minimumTasks: number
  /** Fixed: an abstention cannot improve the primary head-to-head score. */
  primaryMetric: 'accuracy-with-abstention-as-error'
  secondaryMetrics: readonly ['coverage', 'accuracy-when-answered']
  stoppingRule: string
  multiplicityPolicy: string
  protocolSha256: string
}

export interface BenchmarkSubmission {
  protocolId: string
  blindedTaskId: string
  participantPseudonym: string
  participantKind: BenchmarkParticipantKind
  submittedAtUtc: string
  prediction: BenchmarkPrediction
  /** Required for Maha engine entries; absent for blinded human/baseline entries. */
  structuredVerdictSha256: string | null
  submissionSha256: string
}

export interface BenchmarkTaskOutcome {
  blindedTaskId: string
  observedRate: number
  targetRate: number
  outcomeAvailableAtUtc: string
}

export interface BenchmarkScore {
  participantPseudonym: string
  participantKind: BenchmarkParticipantKind
  tasks: number
  answered: number
  correct: number
  abstentions: number
  /** Primary metric. Abstentions remain in the denominator. */
  accuracyWithAbstentionAsError: number
  coverage: number
  accuracyWhenAnswered: number | null
}

export function buildBenchmarkProtocol(input: Omit<BenchmarkProtocol, 'protocolVersion' | 'primaryMetric' | 'secondaryMetrics' | 'protocolSha256'>): BenchmarkProtocol {
  const core = {
    protocolVersion: BENCHMARK_PROTOCOL_VERSION,
    ...input,
    primaryMetric: 'accuracy-with-abstention-as-error' as const,
    secondaryMetrics: ['coverage', 'accuracy-when-answered'] as const,
  }
  return { ...core, protocolSha256: digestOf(core) }
}

export function buildBenchmarkSubmission(input: Omit<BenchmarkSubmission, 'submissionSha256'>): BenchmarkSubmission {
  return { ...input, submissionSha256: digestOf(input) }
}

export function validateBenchmarkProtocol(protocol: BenchmarkProtocol): string[] {
  const issues: string[] = []
  if (protocol.protocolVersion !== BENCHMARK_PROTOCOL_VERSION) issues.push(`protocolVersion must be ${BENCHMARK_PROTOCOL_VERSION}.`)
  if (!/^bench_[a-z0-9]{16,48}$/.test(protocol.protocolId)) issues.push('protocolId must match bench_[a-z0-9]{16,48}.')
  if (!ACTIVITY_TYPES.includes(protocol.activityType)) issues.push('activityType must be an allowlisted activity.')
  if (!Number.isFinite(protocol.targetRate) || protocol.targetRate < 0 || protocol.targetRate > 1) issues.push('targetRate must be in [0, 1].')
  if (!Number.isInteger(protocol.minimumTasks) || protocol.minimumTasks < 20) issues.push('minimumTasks must be an integer of at least 20.')
  if (protocol.stoppingRule.trim().length < 20) issues.push('A fixed stopping rule is required.')
  if (protocol.multiplicityPolicy.trim().length < 20) issues.push('A multiplicity policy is required.')
  const rebuilt = buildBenchmarkProtocol({
    protocolId: protocol.protocolId,
    activityType: protocol.activityType,
    metricId: protocol.metricId,
    targetRate: protocol.targetRate,
    minimumTasks: protocol.minimumTasks,
    stoppingRule: protocol.stoppingRule,
    multiplicityPolicy: protocol.multiplicityPolicy,
  })
  if (rebuilt.protocolSha256 !== protocol.protocolSha256) issues.push('protocolSha256 does not match the declared protocol.')
  return issues
}

export function validateBenchmarkSubmission(submission: BenchmarkSubmission, outcome?: BenchmarkTaskOutcome): string[] {
  const issues: string[] = []
  if (!/^task_[a-z0-9]{16,48}$/.test(submission.blindedTaskId)) issues.push('blindedTaskId must be pseudonymous.')
  if (!/^pseudo_[a-z0-9]{8,64}$/.test(submission.participantPseudonym)) issues.push('participantPseudonym must be pseudonymous.')
  if (!isExplicitUtcInstant(submission.submittedAtUtc)) issues.push('submittedAtUtc must be an explicit UTC instant.')
  if (!BENCHMARK_PARTICIPANT_KINDS.includes(submission.participantKind)) issues.push('participantKind is not supported.')
  if (!['meets-or-exceeds-target', 'misses-target', 'abstain'].includes(submission.prediction)) issues.push('prediction is not supported.')
  if (submission.participantKind === 'maha-rule-engine' && !submission.structuredVerdictSha256) {
    issues.push('Maha engine submissions must bind a structured verdict digest.')
  }
  if (submission.structuredVerdictSha256 !== null && !SHA256_PATTERN.test(submission.structuredVerdictSha256)) {
    issues.push('structuredVerdictSha256 must be a SHA-256 digest.')
  }
  if (submission.participantKind !== 'maha-rule-engine' && submission.structuredVerdictSha256 !== null) {
    issues.push('Human and baseline submissions must not receive or copy the engine verdict digest.')
  }
  if (outcome && isExplicitUtcInstant(submission.submittedAtUtc) && isExplicitUtcInstant(outcome.outcomeAvailableAtUtc)
    && new Date(submission.submittedAtUtc) >= new Date(outcome.outcomeAvailableAtUtc)) {
    issues.push('A benchmark submission must be locked before the outcome is available.')
  }
  const expectedDigest = buildBenchmarkSubmission({
    protocolId: submission.protocolId,
    blindedTaskId: submission.blindedTaskId,
    participantPseudonym: submission.participantPseudonym,
    participantKind: submission.participantKind,
    submittedAtUtc: submission.submittedAtUtc,
    prediction: submission.prediction,
    structuredVerdictSha256: submission.structuredVerdictSha256,
  }).submissionSha256
  if (expectedDigest !== submission.submissionSha256) issues.push('submissionSha256 does not match the submission.')
  return issues
}

export function scoreBenchmarkParticipant(submissions: BenchmarkSubmission[], outcomes: BenchmarkTaskOutcome[]): BenchmarkScore {
  if (submissions.length === 0) throw new Error('At least one benchmark submission is required.')
  const participantPseudonym = submissions[0].participantPseudonym
  const participantKind = submissions[0].participantKind
  if (submissions.some((item) => item.participantPseudonym !== participantPseudonym || item.participantKind !== participantKind)) {
    throw new Error('A score may contain submissions from only one participant and participant kind.')
  }
  const outcomeMap = new Map(outcomes.map((outcome) => [outcome.blindedTaskId, outcome]))
  const scored = submissions.map((submission) => {
    const outcome = outcomeMap.get(submission.blindedTaskId)
    if (!outcome) throw new Error(`Missing outcome for ${submission.blindedTaskId}.`)
    const observed = outcome.observedRate >= outcome.targetRate ? 'meets-or-exceeds-target' : 'misses-target'
    return { prediction: submission.prediction, correct: submission.prediction === observed }
  })
  const answered = scored.filter((item) => item.prediction !== 'abstain').length
  const correct = scored.filter((item) => item.correct).length
  const tasks = scored.length
  return {
    participantPseudonym,
    participantKind,
    tasks,
    answered,
    correct,
    abstentions: tasks - answered,
    accuracyWithAbstentionAsError: correct / tasks,
    coverage: answered / tasks,
    accuracyWhenAnswered: answered === 0 ? null : correct / answered,
  }
}
