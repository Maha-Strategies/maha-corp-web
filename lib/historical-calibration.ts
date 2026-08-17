/**
 * Exploratory historical calibration for natal timing states.
 *
 * A selected milestone series is not a random sample of all moments. This
 * module therefore reports correspondences and prospective test candidates,
 * never retrospective predictive accuracy or causal effects.
 */

import { digestOf, isExplicitUtcInstant } from './celestial-hypotheses/canonical.ts'
import type { NatalChart } from './natal-chart.ts'
import { NATAL_TIMING_VERSION, computeNatalTiming, type NatalTiming, type VimshottariLord } from './natal-timing.ts'

export const HISTORICAL_CALIBRATION_VERSION = 'historical-calibration/0.1' as const

export const MILESTONE_TYPES = [
  'client-work',
  'revenue',
  'company-formation',
  'creative-work',
  'product-release',
  'audience-growth',
  'other',
] as const
export type MilestoneType = typeof MILESTONE_TYPES[number]

export const MILESTONE_SOURCE_KINDS = [
  'platform-record',
  'bank-record',
  'government-record',
  'file-metadata',
  'analytics-record',
  'contemporaneous-note',
  'recollection',
] as const
export type MilestoneSourceKind = typeof MILESTONE_SOURCE_KINDS[number]

export interface HistoricalMetric {
  metricId: string
  name: string
  value: number
  target: number
  unit: string
  direction: 'higher-is-better' | 'lower-is-better'
  dataSourceId: string
}

export interface HistoricalMilestoneInput {
  eventId: string
  title: string
  occurredAtUtc: string
  /** Symmetric uncertainty around occurredAtUtc. Zero means minute-level. */
  uncertaintyMinutes: number
  type: MilestoneType
  sourceKind: MilestoneSourceKind
  /** A bounded locator or record label, never raw document contents. */
  sourceReference: string
  metric?: HistoricalMetric
}

export type CalibrationFeatureFamily = 'dasha' | 'transit-house' | 'transit-contact'

export interface CalibrationFeature {
  key: string
  family: CalibrationFeatureFamily
  label: string
}

export interface CompiledHistoricalMilestone {
  eventId: string
  title: string
  occurredAtUtc: string
  uncertaintyMinutes: number
  sampledFromUtc: string
  sampledThroughUtc: string
  type: MilestoneType
  sourceKind: MilestoneSourceKind
  sourceReference: string
  metric?: HistoricalMetric & { metTarget: boolean }
  activeMahadasha: VimshottariLord
  activeAntardasha: VimshottariLord
  slowTransitHouses: { point: string; sign: string; house: number }[]
  stableFeatures: CalibrationFeature[]
  unstableFeatures: CalibrationFeature[]
  stateVectorSha256: string
}

export interface HistoricalCorrespondence {
  feature: CalibrationFeature
  eventIds: string[]
  eventTitles: string[]
  occurrences: number
  selectedEventShare: number
  milestoneTypes: MilestoneType[]
  metricSummary: {
    metricId: string
    observations: number
    targetsMet: number
    observedTargetRate: number
  } | null
}

export interface ProspectiveTestCandidate {
  candidateId: string
  feature: CalibrationFeature
  statementTemplate: string
  historicalOccurrences: number
  suggestedActivityTypes: MilestoneType[]
  registryStudyRole: 'confirmatory'
  minimumProspectiveObservations: 20
  requiredBeforeRegistration: string[]
  status: 'exploratory-candidate-not-registered'
}

export interface HistoricalCalibration {
  version: typeof HISTORICAL_CALIBRATION_VERSION
  status: 'exploratory-case-series'
  claimEligibility: 'hypothesis-generation-only'
  compiledAtUtc: string
  natalChartVersion: string
  timingVersion: string
  milestones: CompiledHistoricalMilestone[]
  correspondences: HistoricalCorrespondence[]
  prospectiveCandidates: ProspectiveTestCandidate[]
  inputSha256: string
  bundleSha256: string
  boundary: string
  methodology: string[]
}

export class HistoricalCalibrationError extends Error {}

const EVENT_ID = /^evt_[a-z0-9]{8,64}$/
const METRIC_ID = /^[a-z][a-z0-9_-]{2,63}$/
const SLOW_POINTS = new Set(['Jupiter', 'Saturn', 'Rahu', 'Ketu'])
const MAX_EVENTS = 12
const MAX_UNCERTAINTY_MINUTES = 7 * 24 * 60

function validateMetric(metric: HistoricalMetric, eventId: string): void {
  if (typeof metric !== 'object' || metric === null) throw new HistoricalCalibrationError(`${eventId}: metric must be an object.`)
  if (typeof metric.metricId !== 'string' || typeof metric.name !== 'string' || typeof metric.unit !== 'string' || typeof metric.dataSourceId !== 'string') {
    throw new HistoricalCalibrationError(`${eventId}: metric identifiers, name, unit, and data source must be text.`)
  }
  if (!METRIC_ID.test(metric.metricId)) throw new HistoricalCalibrationError(`${eventId}: metricId must be a stable lowercase identifier.`)
  if (metric.name.trim().length < 2 || metric.name.trim().length > 100) throw new HistoricalCalibrationError(`${eventId}: metric name must be 2–100 characters.`)
  if (!Number.isFinite(metric.value) || !Number.isFinite(metric.target)) throw new HistoricalCalibrationError(`${eventId}: metric value and target must be finite numbers.`)
  if (!metric.unit.trim() || metric.unit.trim().length > 32) throw new HistoricalCalibrationError(`${eventId}: metric unit is required and limited to 32 characters.`)
  if (!['higher-is-better', 'lower-is-better'].includes(metric.direction)) throw new HistoricalCalibrationError(`${eventId}: metric direction is invalid.`)
  if (metric.dataSourceId.trim().length < 2 || metric.dataSourceId.trim().length > 100) throw new HistoricalCalibrationError(`${eventId}: metric data source is required.`)
}

function validateMilestones(events: HistoricalMilestoneInput[], birthMs: number, compiledMs: number): void {
  if (events.length < 1 || events.length > MAX_EVENTS) throw new HistoricalCalibrationError(`Historical calibration requires 1–${MAX_EVENTS} milestones.`)
  const ids = new Set<string>()
  for (const event of events) {
    if (typeof event !== 'object' || event === null) throw new HistoricalCalibrationError('Every milestone must be an object.')
    if (typeof event.eventId !== 'string' || typeof event.title !== 'string' || typeof event.occurredAtUtc !== 'string' || typeof event.sourceReference !== 'string') {
      throw new HistoricalCalibrationError('Every milestone needs text identifiers, title, UTC instant, and source reference.')
    }
    if (!EVENT_ID.test(event.eventId) || ids.has(event.eventId)) throw new HistoricalCalibrationError('Every milestone needs a unique evt_ identifier.')
    ids.add(event.eventId)
    if (event.title.trim().length < 3 || event.title.trim().length > 120) throw new HistoricalCalibrationError(`${event.eventId}: title must be 3–120 characters.`)
    if (!isExplicitUtcInstant(event.occurredAtUtc)) throw new HistoricalCalibrationError(`${event.eventId}: occurredAtUtc must be an explicit UTC instant.`)
    const occurredMs = Date.parse(event.occurredAtUtc)
    if (occurredMs < birthMs) throw new HistoricalCalibrationError(`${event.eventId}: milestone cannot precede birth.`)
    if (occurredMs > compiledMs) throw new HistoricalCalibrationError(`${event.eventId}: milestone cannot occur after the report timing moment.`)
    if (!Number.isInteger(event.uncertaintyMinutes) || event.uncertaintyMinutes < 0 || event.uncertaintyMinutes > MAX_UNCERTAINTY_MINUTES) {
      throw new HistoricalCalibrationError(`${event.eventId}: uncertainty must be an integer from 0 to ${MAX_UNCERTAINTY_MINUTES} minutes.`)
    }
    if (!MILESTONE_TYPES.includes(event.type)) throw new HistoricalCalibrationError(`${event.eventId}: milestone type is not supported.`)
    if (!MILESTONE_SOURCE_KINDS.includes(event.sourceKind)) throw new HistoricalCalibrationError(`${event.eventId}: source kind is not supported.`)
    if (event.sourceReference.trim().length < 2 || event.sourceReference.trim().length > 160) throw new HistoricalCalibrationError(`${event.eventId}: source reference must be 2–160 characters.`)
    if (event.metric) validateMetric(event.metric, event.eventId)
  }
}

function timingFeatures(timing: NatalTiming): CalibrationFeature[] {
  const features: CalibrationFeature[] = [
    {
      key: `dasha:maha:${timing.vimshottari.activeMahadasha.lord}`,
      family: 'dasha',
      label: `${timing.vimshottari.activeMahadasha.lord} mahādaśā`,
    },
    {
      key: `dasha:pair:${timing.vimshottari.activeMahadasha.lord}/${timing.vimshottari.activeAntardasha.lord}`,
      family: 'dasha',
      label: `${timing.vimshottari.activeMahadasha.lord}/${timing.vimshottari.activeAntardasha.lord} period`,
    },
  ]
  for (const transit of timing.transits.placements) {
    if (!SLOW_POINTS.has(transit.point)) continue
    features.push({
      key: `transit-house:${transit.point}:${transit.natalWholeSignHouse}`,
      family: 'transit-house',
      label: `${transit.point} in natal house ${transit.natalWholeSignHouse}`,
    })
  }
  for (const contact of timing.transits.contacts) {
    if (!SLOW_POINTS.has(contact.transitPoint)) continue
    features.push({
      key: `transit-contact:${contact.transitPoint}:${contact.aspect}:${contact.natalPoint}`,
      family: 'transit-contact',
      label: `Transit ${contact.transitPoint} ${contact.aspect} natal ${contact.natalPoint}`,
    })
  }
  return features.sort((left, right) => left.key.localeCompare(right.key))
}

function metricWithResult(metric: HistoricalMetric | undefined): CompiledHistoricalMilestone['metric'] {
  if (!metric) return undefined
  const metTarget = metric.direction === 'higher-is-better' ? metric.value >= metric.target : metric.value <= metric.target
  return { ...metric, metTarget }
}

function compileMilestone(
  event: HistoricalMilestoneInput,
  natalChart: NatalChart,
  birthInstant: Date,
  latitudeDegrees: number,
  longitudeDegrees: number,
): CompiledHistoricalMilestone {
  const centerMs = Date.parse(event.occurredAtUtc)
  const halfWidthMs = event.uncertaintyMinutes * 60_000 / 2
  const sampleMs = [...new Set([centerMs - halfWidthMs, centerMs, centerMs + halfWidthMs])]
  const timings = sampleMs.map((instantMs) => computeNatalTiming({
    natalChart,
    birthInstant,
    referenceInstant: new Date(instantMs),
    latitudeDegrees,
    longitudeDegrees,
  }))
  const featureMaps = timings.map((timing) => new Map(timingFeatures(timing).map((feature) => [feature.key, feature])))
  const featureKeys = new Set(featureMaps.flatMap((map) => [...map.keys()]))
  const stableFeatures: CalibrationFeature[] = []
  const unstableFeatures: CalibrationFeature[] = []
  for (const key of featureKeys) {
    const feature = featureMaps.find((map) => map.has(key))!.get(key)!
    if (featureMaps.every((map) => map.has(key))) stableFeatures.push(feature)
    else unstableFeatures.push(feature)
  }
  stableFeatures.sort((left, right) => left.key.localeCompare(right.key))
  unstableFeatures.sort((left, right) => left.key.localeCompare(right.key))
  const center = timings[Math.floor(timings.length / 2)]
  const slowTransitHouses = center.transits.placements
    .filter((transit) => SLOW_POINTS.has(transit.point))
    .map((transit) => ({ point: transit.point, sign: transit.siderealSign, house: transit.natalWholeSignHouse }))
  const core = {
    eventId: event.eventId,
    occurredAtUtc: new Date(centerMs).toISOString(),
    uncertaintyMinutes: event.uncertaintyMinutes,
    sampleInstantsUtc: sampleMs.map((instantMs) => new Date(instantMs).toISOString()),
    stableFeatureKeys: stableFeatures.map((feature) => feature.key),
    unstableFeatureKeys: unstableFeatures.map((feature) => feature.key),
  }
  const metric = metricWithResult(event.metric)
  return {
    eventId: event.eventId,
    title: event.title.trim(),
    occurredAtUtc: new Date(centerMs).toISOString(),
    uncertaintyMinutes: event.uncertaintyMinutes,
    sampledFromUtc: new Date(sampleMs[0]).toISOString(),
    sampledThroughUtc: new Date(sampleMs[sampleMs.length - 1]).toISOString(),
    type: event.type,
    sourceKind: event.sourceKind,
    sourceReference: event.sourceReference.trim(),
    ...(metric ? { metric } : {}),
    activeMahadasha: center.vimshottari.activeMahadasha.lord,
    activeAntardasha: center.vimshottari.activeAntardasha.lord,
    slowTransitHouses,
    stableFeatures,
    unstableFeatures,
    stateVectorSha256: digestOf(core),
  }
}

function correspondenceMetric(events: CompiledHistoricalMilestone[]): HistoricalCorrespondence['metricSummary'] {
  const metrics = events.flatMap((event) => event.metric ? [event.metric] : [])
  if (metrics.length < 2) return null
  const metricId = metrics[0].metricId
  if (metrics.some((metric) => metric.metricId !== metricId)) return null
  const targetsMet = metrics.filter((metric) => metric.metTarget).length
  return { metricId, observations: metrics.length, targetsMet, observedTargetRate: targetsMet / metrics.length }
}

function buildCorrespondences(milestones: CompiledHistoricalMilestone[]): HistoricalCorrespondence[] {
  const byFeature = new Map<string, { feature: CalibrationFeature; events: CompiledHistoricalMilestone[] }>()
  for (const milestone of milestones) {
    for (const feature of milestone.stableFeatures) {
      const entry = byFeature.get(feature.key) ?? { feature, events: [] }
      entry.events.push(milestone)
      byFeature.set(feature.key, entry)
    }
  }
  return [...byFeature.values()]
    .filter((entry) => entry.events.length >= 2)
    .map((entry) => ({
      feature: entry.feature,
      eventIds: entry.events.map((event) => event.eventId),
      eventTitles: entry.events.map((event) => event.title),
      occurrences: entry.events.length,
      selectedEventShare: entry.events.length / milestones.length,
      milestoneTypes: [...new Set(entry.events.map((event) => event.type))].sort(),
      metricSummary: correspondenceMetric(entry.events),
    }))
    .sort((left, right) => right.occurrences - left.occurrences || left.feature.key.localeCompare(right.feature.key))
}

function buildCandidates(correspondences: HistoricalCorrespondence[]): ProspectiveTestCandidate[] {
  return correspondences.slice(0, 5).map((correspondence) => {
    const metric = correspondence.metricSummary
    const metricClause = metric
      ? `the pre-declared ${metric.metricId} target`
      : 'a pre-declared objective metric target'
    const core = { featureKey: correspondence.feature.key, milestoneTypes: correspondence.milestoneTypes, metricId: metric?.metricId ?? null }
    return {
      candidateId: `candidate_${digestOf(core).slice(7, 23)}`,
      feature: correspondence.feature,
      statementTemplate: `For future ${correspondence.milestoneTypes.join(' or ')} actions, test whether ${correspondence.feature.label} predicts meeting ${metricClause} more often than a pre-declared random-clock baseline.`,
      historicalOccurrences: correspondence.occurrences,
      suggestedActivityTypes: correspondence.milestoneTypes,
      registryStudyRole: 'confirmatory',
      minimumProspectiveObservations: 20,
      requiredBeforeRegistration: [
        'Choose one allowlisted registry activity type.',
        'Declare one instrumented metric, target, horizon, and system of record.',
        'Freeze the comparator policy and random seed commitment.',
        'Lock the direction and stopping rule before the next action window.',
      ],
      status: 'exploratory-candidate-not-registered',
    }
  })
}

export interface HistoricalCalibrationInput {
  natalChart: NatalChart
  birthInstant: Date
  compiledAt: Date
  latitudeDegrees: number
  longitudeDegrees: number
  milestones: HistoricalMilestoneInput[]
}

export function compileHistoricalCalibration(input: HistoricalCalibrationInput): HistoricalCalibration {
  const birthMs = input.birthInstant.getTime()
  const compiledMs = input.compiledAt.getTime()
  if (!Number.isFinite(birthMs) || !Number.isFinite(compiledMs)) throw new HistoricalCalibrationError('Historical calibration requires valid birth and compilation instants.')
  validateMilestones(input.milestones, birthMs, compiledMs)
  const normalizedInputs = input.milestones.map((event) => ({
    ...event,
    title: event.title.trim(),
    sourceReference: event.sourceReference.trim(),
  })).sort((left, right) => left.occurredAtUtc.localeCompare(right.occurredAtUtc) || left.eventId.localeCompare(right.eventId))
  const milestones = normalizedInputs.map((event) => compileMilestone(
    event, input.natalChart, input.birthInstant, input.latitudeDegrees, input.longitudeDegrees,
  ))
  const correspondences = buildCorrespondences(milestones)
  const prospectiveCandidates = buildCandidates(correspondences)
  const inputSha256 = digestOf({
    version: HISTORICAL_CALIBRATION_VERSION,
    birthInstantUtc: input.birthInstant.toISOString(),
    compiledAtUtc: input.compiledAt.toISOString(),
    latitudeDegrees: input.latitudeDegrees,
    longitudeDegrees: input.longitudeDegrees,
    milestones: normalizedInputs,
  })
  const bundleCore = { version: HISTORICAL_CALIBRATION_VERSION, inputSha256, milestones, correspondences, prospectiveCandidates }
  return {
    version: HISTORICAL_CALIBRATION_VERSION,
    status: 'exploratory-case-series',
    claimEligibility: 'hypothesis-generation-only',
    compiledAtUtc: input.compiledAt.toISOString(),
    natalChartVersion: input.natalChart.version,
    timingVersion: NATAL_TIMING_VERSION,
    milestones,
    correspondences,
    prospectiveCandidates,
    inputSha256,
    bundleSha256: digestOf(bundleCore),
    boundary: 'These correspondences describe a selected historical case series. There is no non-event exposure denominator, no random assignment, and no protection from hindsight selection or multiple testing. They may generate prospective hypotheses; they do not measure predictive accuracy or establish causation.',
    methodology: [
      'Each milestone is compiled independently from its explicit UTC timestamp, declared uncertainty, evidence class, and bounded source reference.',
      'The state vector includes the active Vimśottarī major/sub-period, slow-point natal-house transits, and slow-point contacts from the declared timing profile.',
      'For uncertain timestamps, the engine samples the beginning, center, and end of the uncertainty interval. Only features present at every sample are treated as stable.',
      'A correspondence is reported only when the same stable feature occurs in at least two selected milestones.',
      'Selected-event share is not a probability: the corpus contains milestones but does not contain all ordinary non-event moments.',
      'Candidate statements are templates for future pre-registration. They are not forecasts and remain incomplete until metric, direction, comparator, and stopping rule are locked.',
    ],
  }
}
