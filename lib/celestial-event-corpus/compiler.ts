import { digestOf } from '../celestial-hypotheses/canonical.ts'
import type { NatalChart } from '../natal-chart.ts'
import { NATAL_TIMING_VERSION, computeNatalTiming, type NatalTiming } from '../natal-timing.ts'
import type {
  CorpusCelestialState,
  CorpusDefinition,
  CorpusObservationRecord,
  CorpusObservationSubmission,
  CorpusStateFeature,
} from './types.ts'
import { CorpusValidationError, validateObservationSubmission } from './types.ts'

const SLOW_POINTS = new Set(['Jupiter', 'Saturn', 'Rahu', 'Ketu'])

function features(timing: NatalTiming): CorpusStateFeature[] {
  const result: CorpusStateFeature[] = [
    { key: `dasha:maha:${timing.vimshottari.activeMahadasha.lord}`, family: 'dasha', label: `${timing.vimshottari.activeMahadasha.lord} mahādaśā` },
    { key: `dasha:pair:${timing.vimshottari.activeMahadasha.lord}/${timing.vimshottari.activeAntardasha.lord}`, family: 'dasha', label: `${timing.vimshottari.activeMahadasha.lord}/${timing.vimshottari.activeAntardasha.lord} period` },
  ]
  for (const transit of timing.transits.placements) {
    if (SLOW_POINTS.has(transit.point)) result.push({ key: `transit-house:${transit.point}:${transit.natalWholeSignHouse}`, family: 'transit-house', label: `${transit.point} in natal house ${transit.natalWholeSignHouse}` })
  }
  for (const contact of timing.transits.contacts) {
    if (SLOW_POINTS.has(contact.transitPoint)) result.push({ key: `transit-contact:${contact.transitPoint}:${contact.aspect}:${contact.natalPoint}`, family: 'transit-contact', label: `Transit ${contact.transitPoint} ${contact.aspect} natal ${contact.natalPoint}` })
  }
  return result.sort((left, right) => left.key.localeCompare(right.key))
}

export function compileCelestialState(input: {
  natalChart: NatalChart
  birthInstant: Date
  latitudeDegrees: number
  longitudeDegrees: number
  intervalStartUtc: string
  intervalEndUtc: string
}): CorpusCelestialState {
  const startMs = Date.parse(input.intervalStartUtc)
  const endMs = Date.parse(input.intervalEndUtc)
  const sampleMs = [...new Set([startMs, startMs + (endMs - startMs) / 2, endMs])]
  const timings = sampleMs.map((instantMs) => computeNatalTiming({
    natalChart: input.natalChart,
    birthInstant: input.birthInstant,
    referenceInstant: new Date(instantMs),
    latitudeDegrees: input.latitudeDegrees,
    longitudeDegrees: input.longitudeDegrees,
  }))
  const maps = timings.map((timing) => new Map(features(timing).map((feature) => [feature.key, feature])))
  const keys = new Set(maps.flatMap((map) => [...map.keys()]))
  const stableFeatures: CorpusStateFeature[] = []
  const unstableFeatures: CorpusStateFeature[] = []
  for (const key of keys) {
    const feature = maps.find((map) => map.has(key))!.get(key)!
    ;(maps.every((map) => map.has(key)) ? stableFeatures : unstableFeatures).push(feature)
  }
  stableFeatures.sort((left, right) => left.key.localeCompare(right.key))
  unstableFeatures.sort((left, right) => left.key.localeCompare(right.key))
  const center = timings[Math.floor(timings.length / 2)]
  const sampledAtUtc = sampleMs.map((instantMs) => new Date(instantMs).toISOString())
  const core = { timingVersion: NATAL_TIMING_VERSION, sampledAtUtc, stableFeatureKeys: stableFeatures.map((feature) => feature.key), unstableFeatureKeys: unstableFeatures.map((feature) => feature.key) }
  return {
    timingVersion: NATAL_TIMING_VERSION,
    sampledAtUtc,
    activeMahadasha: center.vimshottari.activeMahadasha.lord,
    activeAntardasha: center.vimshottari.activeAntardasha.lord,
    slowTransitHouses: center.transits.placements.filter((transit) => SLOW_POINTS.has(transit.point)).map((transit) => ({ point: transit.point, sign: transit.siderealSign, house: transit.natalWholeSignHouse })),
    stableFeatures,
    unstableFeatures,
    stateVectorSha256: digestOf(core),
  }
}

export function compileCorpusObservation(input: {
  definition: CorpusDefinition
  definitionSha256: string
  submission: CorpusObservationSubmission
  natalChart: NatalChart
  birthInstant: Date
  latitudeDegrees: number
  longitudeDegrees: number
}): CorpusObservationRecord {
  const issues = validateObservationSubmission(input.submission, input.definition.samplingPlan)
  if (issues.length) throw new CorpusValidationError(issues)
  const celestialState = compileCelestialState({
    natalChart: input.natalChart,
    birthInstant: input.birthInstant,
    latitudeDegrees: input.latitudeDegrees,
    longitudeDegrees: input.longitudeDegrees,
    intervalStartUtc: input.submission.intervalStartUtc,
    intervalEndUtc: input.submission.intervalEndUtc,
  })
  const metric = input.submission.metric ? {
    ...input.submission.metric,
    metTarget: input.submission.metric.direction === 'higher-is-better'
      ? input.submission.metric.value >= input.submission.metric.target
      : input.submission.metric.value <= input.submission.metric.target,
  } : null
  const core = {
    corpusId: input.definition.corpusId,
    definitionSha256: input.definitionSha256,
    observationId: input.submission.observationId,
    kind: input.submission.kind,
    intervalStartUtc: new Date(input.submission.intervalStartUtc).toISOString(),
    intervalEndUtc: new Date(input.submission.intervalEndUtc).toISOString(),
    selectionMethod: input.submission.selectionMethod,
    sourceKind: input.submission.sourceKind,
    dataSourceId: input.submission.dataSourceId,
    evidenceSha256: digestOf(input.submission.evidencePayload),
    metric,
    celestialState,
  }
  return { ...core, observationSha256: digestOf(core) }
}

