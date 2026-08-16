import { digestOf, isExplicitUtcInstant } from './celestial-hypotheses/canonical.ts'

export const FORECAST_PROTOCOL_VERSION = 'celestial-forecast/0.1' as const
export const SIDEREAL_AYANAMSHAS = ['lahiri', 'fagan-bradley', 'raman', 'krishnamurti', 'true-chitra'] as const
export type SiderealAyanamsha = typeof SIDEREAL_AYANAMSHAS[number]

export type ReferenceFrame =
  | { zodiac: 'tropical'; origin: 'true-equinox-of-date' }
  | { zodiac: 'sidereal'; ayanamsha: SiderealAyanamsha; origin: 'swiss-ephemeris-standard' }

export interface FeatureBundleRef {
  bundleId: string
  bundleSha256: string
  ephemerisVersion: string
  calculationMethod: string
  frame: ReferenceFrame
}

export interface ModelPrediction {
  modelId: string
  modelVersion: string
  probability: number
  trainedThroughUtc: string
  trainingDatasetIds: string[]
  featureBundle: FeatureBundleRef
}

export interface BinaryForecast {
  forecastId: string
  subjectPseudonym: string
  issuedAtUtc: string
  outcomeWindowStartUtc: string
  outcomeWindowEndUtc: string
  target: {
    metricId: string
    statement: string
    resolutionProcedure: string
    dataSourceId: string
  }
  baselineProbability: number
  predictions: ModelPrediction[]
  ensemble: {
    policyVersion: 'fixed-linear-pool/1'
    weights: { modelId: string; weight: number }[]
  }
  historicalEventIdsUsed: string[]
}

export interface HistoricalEvent {
  eventId: string
  datasetId: string
  occurredAtUtc: string
  /** First instant at which both features and outcome were knowable. */
  availableAtUtc: string
  outcome: 0 | 1
  sourceRecordSha256: string
}

export type DatasetSplit = 'train' | 'validation' | 'test'

export interface ScoredForecast {
  forecastId: string
  outcome: 0 | 1
  baseline: ProbabilityScore
  models: (ProbabilityScore & { modelId: string; frame: ReferenceFrame })[]
  ensemble: ProbabilityScore & { probability: number }
}

export interface ProbabilityScore {
  probability: number
  brier: number
  logLoss: number
  brierSkillVersusBaseline: number | null
}

const ID = /^[a-z][a-z0-9_-]{7,95}$/
const SHA = /^sha256:[a-f0-9]{64}$/

function probability(value: number): boolean {
  return Number.isFinite(value) && value >= 0 && value <= 1
}

export function validateForecast(forecast: BinaryForecast): string[] {
  const issues: string[] = []
  if (!ID.test(forecast.forecastId)) issues.push('forecastId must be a stable opaque identifier.')
  if (!/^pseudo_[a-z0-9]{8,64}$/.test(forecast.subjectPseudonym)) issues.push('subjectPseudonym must be pseudonymous.')
  for (const [name, value] of [['issuedAtUtc', forecast.issuedAtUtc], ['outcomeWindowStartUtc', forecast.outcomeWindowStartUtc], ['outcomeWindowEndUtc', forecast.outcomeWindowEndUtc]] as const) {
    if (!isExplicitUtcInstant(value)) issues.push(`${name} must be an explicit UTC instant.`)
  }
  if (isExplicitUtcInstant(forecast.issuedAtUtc) && isExplicitUtcInstant(forecast.outcomeWindowStartUtc)
    && new Date(forecast.issuedAtUtc) >= new Date(forecast.outcomeWindowStartUtc)) issues.push('The forecast must be issued before the outcome window starts.')
  if (isExplicitUtcInstant(forecast.outcomeWindowStartUtc) && isExplicitUtcInstant(forecast.outcomeWindowEndUtc)
    && new Date(forecast.outcomeWindowStartUtc) >= new Date(forecast.outcomeWindowEndUtc)) issues.push('The outcome window must have positive duration.')
  if (!probability(forecast.baselineProbability)) issues.push('baselineProbability must be in [0, 1].')
  if (!forecast.target.metricId.trim() || forecast.target.statement.trim().length < 20 || forecast.target.resolutionProcedure.trim().length < 30 || !forecast.target.dataSourceId.trim()) {
    issues.push('The target must name a metric, falsifiable statement, reproducible resolution procedure, and data source.')
  }
  if (forecast.predictions.length < 2) issues.push('At least two declared models are required for a comparative forecast.')
  const ids = new Set<string>()
  let tropical = false; let sidereal = false
  for (const model of forecast.predictions) {
    if (!ID.test(model.modelId) || ids.has(model.modelId)) issues.push('Every modelId must be unique and stable.')
    ids.add(model.modelId)
    if (!probability(model.probability)) issues.push(`${model.modelId}.probability must be in [0, 1].`)
    if (!isExplicitUtcInstant(model.trainedThroughUtc) || (isExplicitUtcInstant(forecast.issuedAtUtc) && new Date(model.trainedThroughUtc) > new Date(forecast.issuedAtUtc))) issues.push(`${model.modelId} cannot be trained past forecast issuance.`)
    if (!model.trainingDatasetIds.length) issues.push(`${model.modelId} must declare its training datasets.`)
    if (!SHA.test(model.featureBundle.bundleSha256) || !model.featureBundle.ephemerisVersion.trim() || !model.featureBundle.calculationMethod.trim()) issues.push(`${model.modelId} must bind a reproducible feature bundle.`)
    tropical ||= model.featureBundle.frame.zodiac === 'tropical'
    sidereal ||= model.featureBundle.frame.zodiac === 'sidereal'
  }
  if (!tropical || !sidereal) issues.push('Parallel-frame forecasts must include at least one tropical and one sidereal model.')
  const weights = new Map(forecast.ensemble.weights.map((item) => [item.modelId, item.weight]))
  if (weights.size !== ids.size || [...ids].some((id) => !weights.has(id)) || [...weights.keys()].some((id) => !ids.has(id))) issues.push('Ensemble weights must cover every declared model exactly once.')
  const total = [...weights.values()].reduce((sum, weight) => sum + weight, 0)
  if ([...weights.values()].some((weight) => !Number.isFinite(weight) || weight < 0) || Math.abs(total - 1) > 1e-9) issues.push('Ensemble weights must be non-negative and sum to 1.')
  return issues
}

export function forecastDigest(forecast: BinaryForecast): string {
  return digestOf({ protocolVersion: FORECAST_PROTOCOL_VERSION, ...forecast })
}

export function ensembleProbability(forecast: BinaryForecast): number {
  const issues = validateForecast(forecast)
  if (issues.length) throw new Error(`Invalid forecast: ${issues.join(' ')}`)
  const probabilities = new Map(forecast.predictions.map((model) => [model.modelId, model.probability]))
  return forecast.ensemble.weights.reduce((sum, item) => sum + item.weight * probabilities.get(item.modelId)!, 0)
}

function score(probabilityValue: number, outcome: 0 | 1, baselineBrier: number): ProbabilityScore {
  const clipped = Math.min(1 - 1e-15, Math.max(1e-15, probabilityValue))
  const brier = (probabilityValue - outcome) ** 2
  return {
    probability: probabilityValue,
    brier,
    logLoss: -(outcome * Math.log(clipped) + (1 - outcome) * Math.log(1 - clipped)),
    brierSkillVersusBaseline: baselineBrier === 0 ? null : 1 - brier / baselineBrier,
  }
}

export function scoreForecast(forecast: BinaryForecast, outcome: 0 | 1): ScoredForecast {
  const issues = validateForecast(forecast)
  if (issues.length) throw new Error(`Invalid forecast: ${issues.join(' ')}`)
  const baselineBrier = (forecast.baselineProbability - outcome) ** 2
  return {
    forecastId: forecast.forecastId,
    outcome,
    baseline: score(forecast.baselineProbability, outcome, baselineBrier),
    models: forecast.predictions.map((model) => ({ ...score(model.probability, outcome, baselineBrier), modelId: model.modelId, frame: model.featureBundle.frame })),
    ensemble: score(ensembleProbability(forecast), outcome, baselineBrier),
  }
}

/** Temporal split by data availability, never random event assignment. */
export function splitHistoricalEvents(events: HistoricalEvent[], validationStartsUtc: string, testStartsUtc: string): Map<string, DatasetSplit> {
  if (!isExplicitUtcInstant(validationStartsUtc) || !isExplicitUtcInstant(testStartsUtc) || new Date(validationStartsUtc) >= new Date(testStartsUtc)) throw new Error('Split cutoffs must be ordered explicit UTC instants.')
  const result = new Map<string, DatasetSplit>()
  for (const event of events) {
    if (!ID.test(event.eventId) || !ID.test(event.datasetId) || !SHA.test(event.sourceRecordSha256) || !isExplicitUtcInstant(event.occurredAtUtc) || !isExplicitUtcInstant(event.availableAtUtc) || new Date(event.availableAtUtc) < new Date(event.occurredAtUtc)) throw new Error(`Invalid historical event ${event.eventId}.`)
    const available = new Date(event.availableAtUtc)
    result.set(event.eventId, available < new Date(validationStartsUtc) ? 'train' : available < new Date(testStartsUtc) ? 'validation' : 'test')
  }
  return result
}
