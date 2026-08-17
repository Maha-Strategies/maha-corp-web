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

export interface BenchmarkParticipant {
  protocolId: string
  participantPseudonym: string
  participantKind: BenchmarkParticipantKind
  recruitedAtUtc: string
  eligibilityAttestation: string
  conflictDisclosure: string
  participantSha256: string
}

export interface BlindedBenchmarkTask {
  protocolId: string
  blindedTaskId: string
  activityType: ActivityType
  prompt: string
  scheduledMomentUtc: string
  submissionDeadlineUtc: string
  outcomeAvailableAtUtc: string
  taskSha256: string
}

export interface BenchmarkAssignment {
  protocolId: string
  blindedTaskId: string
  participantPseudonym: string
  assignedAtUtc: string
  assignmentSha256: string
}

export interface PairedBenchmarkComparison {
  firstParticipantPseudonym: string
  secondParticipantPseudonym: string
  matchedTasks: number
  firstAccuracy: number
  secondAccuracy: number
  accuracyDifference: number
  firstOnlyCorrect: number
  secondOnlyCorrect: number
  bothCorrect: number
  bothIncorrect: number
  mcnemarExactPValue: number
  multiplicityAdjustedPValue: number | null
  inference: 'insufficient-tasks' | 'no-difference-detected' | 'difference-detected'
  boundary: string
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

export function recruitBenchmarkParticipant(input: Omit<BenchmarkParticipant, 'participantSha256'>): BenchmarkParticipant {
  if (!/^bench_[a-z0-9]{16,48}$/.test(input.protocolId) || !/^pseudo_[a-z0-9]{8,64}$/.test(input.participantPseudonym)) throw new Error('Participant recruitment requires stable protocol and pseudonymous participant identifiers.')
  if (!BENCHMARK_PARTICIPANT_KINDS.includes(input.participantKind) || !isExplicitUtcInstant(input.recruitedAtUtc)) throw new Error('Participant kind or recruitment instant is invalid.')
  if (input.eligibilityAttestation.trim().length < 30 || input.conflictDisclosure.trim().length < 10) throw new Error('Recruitment requires a substantive eligibility attestation and conflict disclosure.')
  return { ...input, participantSha256: digestOf(input) }
}

export function buildBlindedBenchmarkTask(input: Omit<BlindedBenchmarkTask, 'taskSha256'>): BlindedBenchmarkTask {
  if (!/^task_[a-z0-9]{16,48}$/.test(input.blindedTaskId) || !/^bench_[a-z0-9]{16,48}$/.test(input.protocolId)) throw new Error('Task identifiers are invalid.')
  if (!ACTIVITY_TYPES.includes(input.activityType) || input.prompt.trim().length < 20) throw new Error('Task activity or prompt is invalid.')
  for (const instant of [input.scheduledMomentUtc, input.submissionDeadlineUtc, input.outcomeAvailableAtUtc]) if (!isExplicitUtcInstant(instant)) throw new Error('Every task time must be explicit UTC.')
  if (new Date(input.submissionDeadlineUtc) >= new Date(input.scheduledMomentUtc)) throw new Error('The submission deadline must precede the scheduled activity moment.')
  if (new Date(input.submissionDeadlineUtc) >= new Date(input.outcomeAvailableAtUtc)) throw new Error('The submission deadline must precede outcome availability.')
  return { ...input, taskSha256: digestOf(input) }
}

/** Assigns the same frozen task set to every participant, preserving paired comparisons. */
export function distributeBenchmarkTasks(protocol: BenchmarkProtocol, participants: BenchmarkParticipant[], tasks: BlindedBenchmarkTask[], assignedAtUtc: string): BenchmarkAssignment[] {
  if (validateBenchmarkProtocol(protocol).length) throw new Error('Cannot distribute an invalid benchmark protocol.')
  if (!isExplicitUtcInstant(assignedAtUtc) || tasks.length < protocol.minimumTasks) throw new Error('Distribution requires a valid instant and the protocol minimum task count.')
  if (participants.length < 2) throw new Error('Paired benchmarking requires at least two recruited participants.')
  const participantIds = new Set(participants.map((participant) => participant.participantPseudonym))
  const taskIds = new Set(tasks.map((task) => task.blindedTaskId))
  if (participantIds.size !== participants.length || taskIds.size !== tasks.length) throw new Error('Participants and tasks must be unique.')
  if (participants.some((participant) => participant.protocolId !== protocol.protocolId) || tasks.some((task) => task.protocolId !== protocol.protocolId || task.activityType !== protocol.activityType)) throw new Error('Every participant and task must bind the distributed protocol.')
  return participants.flatMap((participant) => tasks.map((task) => {
    const core = { protocolId: protocol.protocolId, blindedTaskId: task.blindedTaskId, participantPseudonym: participant.participantPseudonym, assignedAtUtc }
    return { ...core, assignmentSha256: digestOf(core) }
  }))
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

function exactBinomialTwoSided(successes: number, trials: number): number {
  if (trials === 0) return 1
  const choose = (n: number, k: number) => {
    let value = 1
    for (let index = 1; index <= k; index += 1) value *= (n - k + index) / index
    return value
  }
  const lower = Math.min(successes, trials - successes)
  let tail = 0
  for (let value = 0; value <= lower; value += 1) tail += choose(trials, value) * 0.5 ** trials
  return Math.min(1, 2 * tail)
}

function correctness(submission: BenchmarkSubmission, outcome: BenchmarkTaskOutcome): boolean {
  if (submission.prediction === 'abstain') return false
  const observed: BenchmarkPrediction = outcome.observedRate >= outcome.targetRate ? 'meets-or-exceeds-target' : 'misses-target'
  return submission.prediction === observed
}

export function compareBenchmarkParticipants(first: BenchmarkSubmission[], second: BenchmarkSubmission[], outcomes: BenchmarkTaskOutcome[], protocol: BenchmarkProtocol): PairedBenchmarkComparison {
  if (validateBenchmarkProtocol(protocol).length) throw new Error('Cannot compare under an invalid benchmark protocol.')
  if (!first.length || !second.length) throw new Error('Both participants require submissions.')
  const firstId = first[0]!.participantPseudonym; const secondId = second[0]!.participantPseudonym
  if (firstId === secondId) throw new Error('Paired comparison requires two different participants.')
  if (first.some((item) => item.participantPseudonym !== firstId || item.protocolId !== protocol.protocolId) || second.some((item) => item.participantPseudonym !== secondId || item.protocolId !== protocol.protocolId)) throw new Error('Submission sets must each contain one participant under the declared protocol.')
  const firstMap = new Map(first.map((item) => [item.blindedTaskId, item]))
  const secondMap = new Map(second.map((item) => [item.blindedTaskId, item]))
  const outcomeMap = new Map(outcomes.map((item) => [item.blindedTaskId, item]))
  const taskIds = [...firstMap.keys()].filter((id) => secondMap.has(id) && outcomeMap.has(id)).sort()
  if (taskIds.length < protocol.minimumTasks) throw new Error('Paired analysis cannot run before the pre-registered minimum matched task count.')
  let firstOnlyCorrect = 0; let secondOnlyCorrect = 0; let bothCorrect = 0; let bothIncorrect = 0
  for (const taskId of taskIds) {
    const firstSubmission = firstMap.get(taskId)!; const secondSubmission = secondMap.get(taskId)!; const outcome = outcomeMap.get(taskId)!
    const issues = [...validateBenchmarkSubmission(firstSubmission, outcome), ...validateBenchmarkSubmission(secondSubmission, outcome)]
    if (issues.length) throw new Error(`Invalid paired submission for ${taskId}: ${issues.join(' ')}`)
    const firstResult = correctness(firstSubmission, outcome); const secondResult = correctness(secondSubmission, outcome)
    if (firstResult && secondResult) bothCorrect += 1
    else if (firstResult) firstOnlyCorrect += 1
    else if (secondResult) secondOnlyCorrect += 1
    else bothIncorrect += 1
  }
  const firstAccuracy = (bothCorrect + firstOnlyCorrect) / taskIds.length
  const secondAccuracy = (bothCorrect + secondOnlyCorrect) / taskIds.length
  const pValue = exactBinomialTwoSided(firstOnlyCorrect, firstOnlyCorrect + secondOnlyCorrect)
  return {
    firstParticipantPseudonym: firstId, secondParticipantPseudonym: secondId, matchedTasks: taskIds.length,
    firstAccuracy, secondAccuracy, accuracyDifference: firstAccuracy - secondAccuracy,
    firstOnlyCorrect, secondOnlyCorrect, bothCorrect, bothIncorrect, mcnemarExactPValue: pValue,
    multiplicityAdjustedPValue: null,
    inference: taskIds.length < protocol.minimumTasks ? 'insufficient-tasks' : pValue < 0.05 ? 'difference-detected' : 'no-difference-detected',
    boundary: 'McNemar’s exact test compares paired categorical correctness on the same frozen tasks. Statistical difference is not practical superiority, causal evidence, or proof of astrology; the protocol’s multiplicity policy and stopping rule still govern publication.',
  }
}

/** Holm adjustment across the exact set of comparisons declared before scoring. */
export function applyHolmAdjustment(comparisons: PairedBenchmarkComparison[]): PairedBenchmarkComparison[] {
  const ordered = comparisons.map((comparison, index) => ({ comparison, index })).sort((a, b) => a.comparison.mcnemarExactPValue - b.comparison.mcnemarExactPValue)
  const adjusted = Array(comparisons.length).fill(1) as number[]
  let previous = 0
  for (let rank = 0; rank < ordered.length; rank += 1) {
    const value = Math.min(1, ordered[rank]!.comparison.mcnemarExactPValue * (ordered.length - rank))
    previous = Math.max(previous, value)
    adjusted[ordered[rank]!.index] = previous
  }
  return comparisons.map((comparison, index) => ({ ...comparison, multiplicityAdjustedPValue: adjusted[index]!, inference: adjusted[index]! < 0.05 ? 'difference-detected' : 'no-difference-detected' }))
}
