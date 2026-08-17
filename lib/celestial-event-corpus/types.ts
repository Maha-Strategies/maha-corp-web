import { digestOf, isExplicitUtcInstant } from '../celestial-hypotheses/canonical.ts'

export const CELESTIAL_EVENT_CORPUS_VERSION = 'celestial-event-corpus/0.1' as const
export const CORPUS_SAMPLING_PLAN_VERSION = 'systematic-clock/1' as const
export const CORPUS_EPISTEMIC_BOUNDARY = 'This is a private exploratory corpus of milestones and evidence-backed non-event periods selected under a locked sampling plan. Its exposure rates are descriptive and do not establish causation or predictive performance.' as const

export type CorpusLifecycle = 'draft' | 'locked'
export type CorpusObservationKind = 'milestone' | 'non-event'
export type CorpusSelectionMethod = 'observed-event' | 'systematic-clock'

export interface NatalProfileInput {
  date: string
  time: string
  timeZone: string
  latitudeDegrees: number
  longitudeDegrees: number
}

export interface CorpusSamplingPlan {
  planVersion: typeof CORPUS_SAMPLING_PLAN_VERSION
  windowStartUtc: string
  windowEndUtc: string
  anchorUtc: string
  cadenceMinutes: number
  intervalMinutes: number
  activityType: string
  qualifyingEventDefinition: string
  negativeEvidenceProcedure: string
}

export interface CorpusDefinition {
  corpusId: string
  participantPseudonym: string
  studyRole: 'exploratory'
  corpusVersion: typeof CELESTIAL_EVENT_CORPUS_VERSION
  natalProfileSha256: string
  samplingPlan: CorpusSamplingPlan
}

export interface StoredCorpus {
  corpusId: string
  status: CorpusLifecycle
  definition: CorpusDefinition
  definitionSha256: string
  lockedAtUtc: string | null
  createdAtUtc: string
}

export interface CorpusMetricObservation {
  metricId: string
  value: number
  target: number
  unit: string
  direction: 'higher-is-better' | 'lower-is-better'
  dataSourceId: string
}

export interface CorpusObservationSubmission {
  observationId: string
  kind: CorpusObservationKind
  intervalStartUtc: string
  intervalEndUtc: string
  selectionMethod: CorpusSelectionMethod
  sourceKind: string
  dataSourceId: string
  /** Hashed in memory and discarded by the route. */
  evidencePayload: unknown
  metric?: CorpusMetricObservation
}

export interface NonEventEvidenceEnvelope {
  queryWindowStartUtc: string
  queryWindowEndUtc: string
  qualifyingEventCount: 0
  retrievedAtUtc: string
  sourceQueryId: string
  rawResult: unknown
}

export interface CorpusStateFeature {
  key: string
  family: 'dasha' | 'transit-house' | 'transit-contact'
  label: string
}

export interface CorpusCelestialState {
  timingVersion: string
  sampledAtUtc: string[]
  activeMahadasha: string
  activeAntardasha: string
  slowTransitHouses: { point: string; sign: string; house: number }[]
  stableFeatures: CorpusStateFeature[]
  unstableFeatures: CorpusStateFeature[]
  stateVectorSha256: string
}

export interface CorpusObservationRecord {
  corpusId: string
  definitionSha256: string
  observationId: string
  kind: CorpusObservationKind
  intervalStartUtc: string
  intervalEndUtc: string
  selectionMethod: CorpusSelectionMethod
  sourceKind: string
  dataSourceId: string
  evidenceSha256: string
  metric: (CorpusMetricObservation & { metTarget: boolean }) | null
  celestialState: CorpusCelestialState
  observationSha256: string
}

export interface CorpusScheduleCandidate {
  candidateId: string
  intervalStartUtc: string
  intervalEndUtc: string
  selectionMethod: 'systematic-clock'
  status: 'candidate-needs-absence-evidence'
}

export class CorpusValidationError extends Error {
  readonly issues: string[]

  constructor(issues: string[]) {
    super(issues.join(' '))
    this.issues = issues
  }
}

const CORPUS_ID = /^corp_[a-z0-9]{12,48}$/
const PSEUDONYM = /^pseudo_[a-z0-9]{8,64}$/
const OBSERVATION_ID = /^obs_[a-z0-9]{12,64}$/
const IDENTIFIER = /^[a-z][a-z0-9_-]{2,79}$/
const SHA256 = /^sha256:[a-f0-9]{64}$/

function boundedText(value: unknown, minimum: number, maximum: number): value is string {
  return typeof value === 'string' && value.trim().length >= minimum && value.trim().length <= maximum
}

export function natalProfileDigest(profile: NatalProfileInput): string {
  return digestOf({
    date: profile.date,
    time: profile.time,
    timeZone: profile.timeZone,
    latitudeDegrees: Number(profile.latitudeDegrees),
    longitudeDegrees: Number(profile.longitudeDegrees),
  })
}

export function validateSamplingPlan(plan: CorpusSamplingPlan): string[] {
  const issues: string[] = []
  if (plan?.planVersion !== CORPUS_SAMPLING_PLAN_VERSION) issues.push(`samplingPlan.planVersion must be ${CORPUS_SAMPLING_PLAN_VERSION}.`)
  for (const field of ['windowStartUtc', 'windowEndUtc', 'anchorUtc'] as const) {
    if (!isExplicitUtcInstant(plan?.[field])) issues.push(`samplingPlan.${field} must be an explicit UTC instant.`)
  }
  if (issues.length === 0) {
    const start = Date.parse(plan.windowStartUtc)
    const end = Date.parse(plan.windowEndUtc)
    const anchor = Date.parse(plan.anchorUtc)
    if (end <= start) issues.push('The sampling window must end after it starts.')
    if (anchor < start || anchor >= end) issues.push('The systematic anchor must fall inside the sampling window.')
  }
  if (!Number.isInteger(plan?.cadenceMinutes) || plan.cadenceMinutes < 60 || plan.cadenceMinutes > 43_200) issues.push('cadenceMinutes must be an integer from 60 to 43200.')
  if (!Number.isInteger(plan?.intervalMinutes) || plan.intervalMinutes < 1 || plan.intervalMinutes > 1_440) issues.push('intervalMinutes must be an integer from 1 to 1440.')
  if (Number.isInteger(plan?.cadenceMinutes) && Number.isInteger(plan?.intervalMinutes) && plan.intervalMinutes > plan.cadenceMinutes) issues.push('intervalMinutes cannot exceed cadenceMinutes.')
  if (!boundedText(plan?.activityType, 3, 80) || !IDENTIFIER.test(plan.activityType)) issues.push('activityType must be a stable lowercase identifier.')
  if (!boundedText(plan?.qualifyingEventDefinition, 40, 800)) issues.push('qualifyingEventDefinition must be 40–800 characters.')
  if (!boundedText(plan?.negativeEvidenceProcedure, 40, 800)) issues.push('negativeEvidenceProcedure must be 40–800 characters.')
  return issues
}

export function parseCorpusDefinition(value: unknown): CorpusDefinition {
  const candidate = value as Partial<CorpusDefinition> | null
  const issues: string[] = []
  if (!candidate || typeof candidate !== 'object') throw new CorpusValidationError(['Corpus definition must be an object.'])
  if (typeof candidate.corpusId !== 'string' || !CORPUS_ID.test(candidate.corpusId)) issues.push('corpusId must use corp_ followed by 12–48 lowercase letters or numbers.')
  if (typeof candidate.participantPseudonym !== 'string' || !PSEUDONYM.test(candidate.participantPseudonym)) issues.push('participantPseudonym must use the non-identifying pseudo_ format.')
  if (candidate.studyRole !== 'exploratory') issues.push('Historical corpora must declare studyRole exploratory.')
  if (candidate.corpusVersion !== CELESTIAL_EVENT_CORPUS_VERSION) issues.push(`corpusVersion must be ${CELESTIAL_EVENT_CORPUS_VERSION}.`)
  if (typeof candidate.natalProfileSha256 !== 'string' || !SHA256.test(candidate.natalProfileSha256)) issues.push('natalProfileSha256 must be a SHA-256 digest.')
  issues.push(...validateSamplingPlan(candidate.samplingPlan as CorpusSamplingPlan))
  if (issues.length) throw new CorpusValidationError(issues)
  return candidate as CorpusDefinition
}

export function corpusDefinitionDigest(definition: CorpusDefinition): string {
  return digestOf(definition)
}

export function validateObservationSubmission(submission: CorpusObservationSubmission, plan: CorpusSamplingPlan): string[] {
  const issues: string[] = []
  if (!submission || typeof submission !== 'object') return ['Observation must be an object.']
  if (typeof submission.observationId !== 'string' || !OBSERVATION_ID.test(submission.observationId)) issues.push('observationId must use obs_ followed by 12–64 lowercase letters or numbers.')
  if (!['milestone', 'non-event'].includes(submission.kind)) issues.push('kind must be milestone or non-event.')
  if (!isExplicitUtcInstant(submission.intervalStartUtc) || !isExplicitUtcInstant(submission.intervalEndUtc)) issues.push('Observation interval bounds must be explicit UTC instants.')
  if (issues.every((issue) => !issue.includes('interval'))) {
    const start = Date.parse(submission.intervalStartUtc)
    const end = Date.parse(submission.intervalEndUtc)
    if (end <= start) issues.push('Observation interval must have positive duration.')
    if (start < Date.parse(plan.windowStartUtc) || end > Date.parse(plan.windowEndUtc)) issues.push('Observation falls outside the locked sampling window.')
    if (submission.kind === 'non-event') {
      const expectedDuration = plan.intervalMinutes * 60_000
      const cadence = plan.cadenceMinutes * 60_000
      if (end - start !== expectedDuration) issues.push('Non-event interval duration must match the locked plan.')
      if ((start - Date.parse(plan.anchorUtc)) % cadence !== 0) issues.push('Non-event interval must align to the locked systematic clock.')
    }
  }
  if (submission.kind === 'milestone' && submission.selectionMethod !== 'observed-event') issues.push('Milestones must use observed-event selection.')
  if (submission.kind === 'non-event' && submission.selectionMethod !== 'systematic-clock') issues.push('Non-events must use systematic-clock selection.')
  if (!boundedText(submission.sourceKind, 3, 80) || !IDENTIFIER.test(submission.sourceKind)) issues.push('sourceKind must be a stable lowercase identifier.')
  if (!boundedText(submission.dataSourceId, 3, 120)) issues.push('dataSourceId must identify the system of record.')
  if (submission.evidencePayload === undefined) issues.push('evidencePayload is required and will be hashed, then discarded.')
  if (submission.kind === 'non-event' && submission.evidencePayload !== undefined) {
    const evidence = submission.evidencePayload as Partial<NonEventEvidenceEnvelope> | null
    if (!evidence || typeof evidence !== 'object') issues.push('Non-event evidence must be a zero-count query envelope.')
    else {
      if (evidence.queryWindowStartUtc !== submission.intervalStartUtc || evidence.queryWindowEndUtc !== submission.intervalEndUtc) issues.push('Non-event evidence query bounds must exactly match the observation interval.')
      if (evidence.qualifyingEventCount !== 0) issues.push('A non-event requires qualifyingEventCount equal to zero.')
      if (!isExplicitUtcInstant(evidence.retrievedAtUtc ?? '')) issues.push('Non-event evidence retrievedAtUtc must be explicit UTC.')
      else if (Date.parse(evidence.retrievedAtUtc!) < Date.parse(submission.intervalEndUtc)) issues.push('Non-event evidence cannot be retrieved before the interval ends.')
      if (!boundedText(evidence.sourceQueryId, 3, 160)) issues.push('Non-event evidence requires a bounded sourceQueryId.')
      if (evidence.rawResult === undefined) issues.push('Non-event evidence requires the raw query result; it will be hashed and discarded.')
    }
  }
  if (submission.metric) {
    const metric = submission.metric
    if (!boundedText(metric.metricId, 3, 80) || !IDENTIFIER.test(metric.metricId)) issues.push('metricId must be a stable lowercase identifier.')
    if (!Number.isFinite(metric.value) || !Number.isFinite(metric.target)) issues.push('Metric value and target must be finite.')
    if (!boundedText(metric.unit, 1, 32) || !boundedText(metric.dataSourceId, 3, 120)) issues.push('Metric unit and data source are required.')
    if (!['higher-is-better', 'lower-is-better'].includes(metric.direction)) issues.push('Metric direction is invalid.')
  }
  return issues
}
