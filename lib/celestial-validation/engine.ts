/** Executable empirical-validation pipeline for binary celestial-timing hypotheses. */

import { classicalEclipticLongitude, CLASSICAL_BODIES } from '../local-fact-bundle.ts'
import { meanNodeLongitude, ZODIAC_SIGNS } from '../natal-chart.ts'
import { lahiriAyanamsa } from '../panchanga.ts'
import { digestOf, isExplicitUtcInstant } from '../celestial-hypotheses/canonical.ts'
import {
  FORECAST_PROTOCOL_VERSION,
  forecastDigest,
  scoreForecast,
  type BinaryForecast,
  type HistoricalEvent,
  type ModelPrediction,
  type ReferenceFrame,
} from '../celestial-forecasting.ts'
import type { BenchmarkParticipantKind, PairedBenchmarkComparison } from '../celestial-hypotheses/benchmark.ts'

export const EXTERNAL_DATASET_VERSION = 'celestial-outcome-dataset/0.1' as const
export const PLANETARY_FEATURE_VERSION = 'planetary-features/0.1' as const
export const FITTED_MODEL_VERSION = 'regularized-logistic/0.1' as const
export const VALIDATION_PIPELINE_VERSION = 'celestial-validation-pipeline/0.1' as const
export const SKILL_ASSESSMENT_POLICY_VERSION = 'predictive-skill-policy/0.1' as const

const SHA = /^sha256:[a-f0-9]{64}$/
const ID = /^[a-z][a-z0-9_-]{7,95}$/
const DAY_MS = 86_400_000

export interface ExternalOutcomeRow extends HistoricalEvent {
  sourceRecordId: string
}

export interface ExternalOutcomeDataset {
  version: typeof EXTERNAL_DATASET_VERSION
  datasetId: string
  title: string
  outcomeDefinition: string
  dataSourceId: string
  retrievedAtUtc: string
  sourceManifestSha256: string
  rows: ExternalOutcomeRow[]
  datasetSha256: string
}

export interface PlanetaryFeatureVector {
  version: typeof PLANETARY_FEATURE_VERSION
  eventId: string
  instantUtc: string
  frame: ReferenceFrame
  featureNames: string[]
  values: number[]
  vectorSha256: string
}

export interface FittedCelestialModel {
  artifactVersion: typeof FITTED_MODEL_VERSION
  modelId: string
  frame: ReferenceFrame
  datasetId: string
  datasetSha256: string
  featureVersion: typeof PLANETARY_FEATURE_VERSION
  featureNames: string[]
  intercept: number
  weights: number[]
  ridgePenalty: number
  trainedThroughUtc: string
  trainingEventIds: string[]
  validationEventIds: string[]
  baselineProbability: number
  validationBrier: number
  artifactSha256: string
}

export interface TemporalTrainingPlan {
  validationStartsUtc: string
  testStartsUtc: string
  ridgeCandidates: number[]
  iterations: number
  learningRate: number
}

export interface ParallelModelFit {
  pipelineVersion: typeof VALIDATION_PIPELINE_VERSION
  datasetId: string
  tropical: FittedCelestialModel
  sidereal: FittedCelestialModel
  heldOutTest: {
    eventIds: string[]
    baselineBrier: number
    tropicalBrier: number
    siderealBrier: number
    equalWeightEnsembleBrier: number
  }
  boundary: string
}

export interface PredictiveSkillAssessment {
  policySha256: string
  status: 'not-demonstrated' | 'demonstrated-under-declared-protocol'
  prospectiveForecasts: number
  meanEnsembleBrier: number | null
  meanBaselineBrier: number | null
  meanBrierImprovement: number | null
  baselineWinRate: number | null
  oneSidedExactPValue: number | null
  benchmarkComparatorsPassed: BenchmarkParticipantKind[]
  unmetCriteria: string[]
  boundary: string
}

export interface PredictiveSkillPolicy {
  version: typeof SKILL_ASSESSMENT_POLICY_VERSION
  policyId: string
  lockedAtUtc: string
  metricId: string
  dataSourceId: string
  minimumForecasts: number
  alpha: number
  requiredComparatorKinds: BenchmarkParticipantKind[]
  policySha256: string
}

function normalize(value: number): number { return ((value % 360) + 360) % 360 }
function sigmoid(value: number): number {
  if (value >= 0) return 1 / (1 + Math.exp(-value))
  const exp = Math.exp(value)
  return exp / (1 + exp)
}
function brier(probabilities: number[], outcomes: number[]): number {
  if (!probabilities.length || probabilities.length !== outcomes.length) throw new Error('Brier score requires paired non-empty values.')
  return probabilities.reduce((sum, probability, index) => sum + (probability - outcomes[index]!) ** 2, 0) / probabilities.length
}

export function ingestExternalOutcomeDataset(input: Omit<ExternalOutcomeDataset, 'version' | 'datasetSha256'>): ExternalOutcomeDataset {
  const issues: string[] = []
  if (!ID.test(input.datasetId)) issues.push('datasetId must be a stable identifier.')
  if (input.title.trim().length < 5 || input.title.length > 200) issues.push('title must contain 5–200 characters.')
  if (input.outcomeDefinition.trim().length < 30 || input.outcomeDefinition.length > 1_000) issues.push('outcomeDefinition must contain 30–1,000 characters.')
  if (!ID.test(input.dataSourceId)) issues.push('dataSourceId must be a stable identifier.')
  if (!isExplicitUtcInstant(input.retrievedAtUtc)) issues.push('retrievedAtUtc must be an explicit UTC instant.')
  if (!SHA.test(input.sourceManifestSha256)) issues.push('sourceManifestSha256 must be a SHA-256 digest.')
  if (input.rows.length < 100) issues.push('At least 100 rows are required to fit and hold out a binary model.')
  const ids = new Set<string>()
  for (const row of input.rows) {
    if (!ID.test(row.eventId) || ids.has(row.eventId)) issues.push(`Invalid or duplicate eventId ${row.eventId}.`)
    ids.add(row.eventId)
    if (row.datasetId !== input.datasetId) issues.push(`${row.eventId} does not bind the declared datasetId.`)
    if (!isExplicitUtcInstant(row.occurredAtUtc) || !isExplicitUtcInstant(row.availableAtUtc)) issues.push(`${row.eventId} has an invalid UTC timestamp.`)
    else if (new Date(row.availableAtUtc) < new Date(row.occurredAtUtc)) issues.push(`${row.eventId} became available before it occurred.`)
    else if (isExplicitUtcInstant(input.retrievedAtUtc) && new Date(row.availableAtUtc) > new Date(input.retrievedAtUtc)) issues.push(`${row.eventId} was not available when the dataset was retrieved.`)
    if (row.outcome !== 0 && row.outcome !== 1) issues.push(`${row.eventId} outcome must be binary.`)
    if (!SHA.test(row.sourceRecordSha256) || !row.sourceRecordId.trim()) issues.push(`${row.eventId} must bind a source record and digest.`)
  }
  if (new Set(input.rows.map((row) => row.outcome)).size < 2) issues.push('The dataset must contain both outcome classes.')
  if (issues.length) throw new Error(`Invalid external outcome dataset: ${issues.join(' ')}`)
  const core = { version: EXTERNAL_DATASET_VERSION, ...input, rows: [...input.rows].sort((a, b) => a.eventId.localeCompare(b.eventId)) }
  return { ...core, datasetSha256: digestOf(core) }
}

function featureCore(eventId: string, instant: Date, frame: ReferenceFrame): Omit<PlanetaryFeatureVector, 'vectorSha256'> {
  const ayanamsa = frame.zodiac === 'sidereal' ? lahiriAyanamsa(instant) : 0
  const longitudes = [...CLASSICAL_BODIES.map((body) => [body, classicalEclipticLongitude(body, instant)] as const), ['Rahu', meanNodeLongitude(instant)] as const]
  const featureNames: string[] = []
  const values: number[] = []
  for (const [body, tropicalLongitude] of longitudes) {
    const longitude = normalize(tropicalLongitude - ayanamsa)
    const signIndex = Math.floor(longitude / 30)
    for (let index = 0; index < 12; index += 1) {
      featureNames.push(`${body}.sign.${ZODIAC_SIGNS[index]}`)
      values.push(index === signIndex ? 1 : 0)
    }
    const next = body === 'Rahu'
      ? meanNodeLongitude(new Date(instant.getTime() + DAY_MS))
      : classicalEclipticLongitude(body, new Date(instant.getTime() + DAY_MS))
    const signedMotion = ((next - tropicalLongitude + 540) % 360) - 180
    featureNames.push(`${body}.retrograde`)
    values.push(signedMotion < 0 ? 1 : 0)
  }
  const sun = normalize(classicalEclipticLongitude('Sun', instant))
  const moon = normalize(classicalEclipticLongitude('Moon', instant))
  const phase = normalize(moon - sun) * Math.PI / 180
  featureNames.push('geometry.lunarPhase.sin', 'geometry.lunarPhase.cos')
  values.push(Math.sin(phase), Math.cos(phase))
  return { version: PLANETARY_FEATURE_VERSION, eventId, instantUtc: instant.toISOString(), frame, featureNames, values }
}

export function calculatePlanetaryFeatures(eventId: string, instantUtc: string, frame: ReferenceFrame): PlanetaryFeatureVector {
  if (!ID.test(eventId) || !isExplicitUtcInstant(instantUtc)) throw new Error('Planetary features require a stable eventId and explicit UTC instant.')
  if (frame.zodiac === 'sidereal' && frame.ayanamsha !== 'lahiri') throw new Error('This feature version implements only the declared Lahiri sidereal frame.')
  const core = featureCore(eventId, new Date(instantUtc), frame)
  return { ...core, vectorSha256: digestOf(core) }
}

function fitWeights(vectors: number[][], outcomes: number[], ridge: number, iterations: number, learningRate: number): { intercept: number; weights: number[] } {
  const weights = Array(vectors[0]!.length).fill(0) as number[]
  let intercept = Math.log((outcomes.reduce((sum, value) => sum + value, 0) + 0.5) / (outcomes.length - outcomes.reduce((sum, value) => sum + value, 0) + 0.5))
  for (let iteration = 0; iteration < iterations; iteration += 1) {
    let interceptGradient = 0
    const gradients = Array(weights.length).fill(0) as number[]
    for (let row = 0; row < vectors.length; row += 1) {
      const vector = vectors[row]!
      const prediction = sigmoid(intercept + vector.reduce((sum, value, index) => sum + value * weights[index]!, 0))
      const error = prediction - outcomes[row]!
      interceptGradient += error
      for (let index = 0; index < weights.length; index += 1) gradients[index]! += error * vector[index]!
    }
    intercept -= learningRate * interceptGradient / vectors.length
    for (let index = 0; index < weights.length; index += 1) weights[index]! -= learningRate * (gradients[index]! / vectors.length + ridge * weights[index]!)
  }
  return { intercept, weights }
}

export function modelProbability(model: FittedCelestialModel, features: PlanetaryFeatureVector): number {
  if (!verifyModelArtifact(model)) throw new Error('Fitted model artifact digest does not verify.')
  if (features.featureNames.length !== model.featureNames.length || features.featureNames.some((name, index) => name !== model.featureNames[index])) throw new Error('Feature schema does not match the fitted model.')
  return sigmoid(model.intercept + features.values.reduce((sum, value, index) => sum + value * model.weights[index]!, 0))
}

function predictRaw(model: Pick<FittedCelestialModel, 'intercept' | 'weights' | 'featureNames'>, features: PlanetaryFeatureVector): number {
  if (features.featureNames.some((name, index) => name !== model.featureNames[index])) throw new Error('Feature schema mismatch.')
  return sigmoid(model.intercept + features.values.reduce((sum, value, index) => sum + value * model.weights[index]!, 0))
}

function artifactDigest(model: Omit<FittedCelestialModel, 'artifactSha256'>): string { return digestOf(model) }

function trainFrame(dataset: ExternalOutcomeDataset, frame: ReferenceFrame, plan: TemporalTrainingPlan): FittedCelestialModel {
  const rows = [...dataset.rows].sort((a, b) => a.availableAtUtc.localeCompare(b.availableAtUtc) || a.eventId.localeCompare(b.eventId))
  const train = rows.filter((row) => row.availableAtUtc < plan.validationStartsUtc)
  const validation = rows.filter((row) => row.availableAtUtc >= plan.validationStartsUtc && row.availableAtUtc < plan.testStartsUtc)
  if (train.length < 50 || validation.length < 20) throw new Error('Temporal training requires at least 50 training and 20 validation records before the held-out test period.')
  if (new Set(train.map((row) => row.outcome)).size < 2) throw new Error('Training rows must contain both outcome classes.')
  const trainFeatures = train.map((row) => calculatePlanetaryFeatures(row.eventId, row.occurredAtUtc, frame))
  const validationFeatures = validation.map((row) => calculatePlanetaryFeatures(row.eventId, row.occurredAtUtc, frame))
  let selected: { ridge: number; brier: number; intercept: number; weights: number[] } | null = null
  for (const ridge of plan.ridgeCandidates) {
    if (!Number.isFinite(ridge) || ridge <= 0) throw new Error('Every ridge candidate must be positive.')
    const fitted = fitWeights(trainFeatures.map((item) => item.values), train.map((row) => row.outcome), ridge, plan.iterations, plan.learningRate)
    const score = brier(validationFeatures.map((item) => predictRaw({ ...fitted, featureNames: trainFeatures[0]!.featureNames }, item)), validation.map((row) => row.outcome))
    if (!selected || score < selected.brier || (score === selected.brier && ridge > selected.ridge)) selected = { ridge, brier: score, ...fitted }
  }
  const core: Omit<FittedCelestialModel, 'artifactSha256'> = {
    artifactVersion: FITTED_MODEL_VERSION,
    modelId: `${frame.zodiac === 'tropical' ? 'tropical' : 'lahiri'}_${dataset.datasetId}_${dataset.datasetSha256.slice(7, 15)}`,
    frame,
    datasetId: dataset.datasetId,
    datasetSha256: dataset.datasetSha256,
    featureVersion: PLANETARY_FEATURE_VERSION,
    featureNames: trainFeatures[0]!.featureNames,
    intercept: selected!.intercept,
    weights: selected!.weights,
    ridgePenalty: selected!.ridge,
    // Hyperparameter selection reads validation outcomes, so the artifact is
    // trained-through the latest validation availability even though the
    // coefficient fit itself uses only training rows.
    trainedThroughUtc: [...train, ...validation].reduce((latest, row) => new Date(row.availableAtUtc) > new Date(latest) ? row.availableAtUtc : latest, train[0]!.availableAtUtc),
    trainingEventIds: train.map((row) => row.eventId),
    validationEventIds: validation.map((row) => row.eventId),
    baselineProbability: train.reduce((sum, row) => sum + row.outcome, 0) / train.length,
    validationBrier: selected!.brier,
  }
  return { ...core, artifactSha256: artifactDigest(core) }
}

export function trainParallelCelestialModels(dataset: ExternalOutcomeDataset, plan: TemporalTrainingPlan): ParallelModelFit {
  if (!isExplicitUtcInstant(plan.validationStartsUtc) || !isExplicitUtcInstant(plan.testStartsUtc) || plan.validationStartsUtc >= plan.testStartsUtc) throw new Error('Temporal split boundaries must be ordered explicit UTC instants.')
  if (!Number.isInteger(plan.iterations) || plan.iterations < 100 || plan.iterations > 20_000 || !Number.isFinite(plan.learningRate) || plan.learningRate <= 0 || plan.learningRate > 1) throw new Error('Training optimizer settings are outside the bounded protocol.')
  const tropicalFrame: ReferenceFrame = { zodiac: 'tropical', origin: 'true-equinox-of-date' }
  const siderealFrame: ReferenceFrame = { zodiac: 'sidereal', ayanamsha: 'lahiri', origin: 'lahiri-iau-ayanamsa' }
  const tropical = trainFrame(dataset, tropicalFrame, plan)
  const sidereal = trainFrame(dataset, siderealFrame, plan)
  const test = dataset.rows.filter((row) => row.availableAtUtc >= plan.testStartsUtc)
  if (test.length < 20) throw new Error('At least 20 records must remain in the untouched test period.')
  const outcomes = test.map((row) => row.outcome)
  const tropicalProbabilities = test.map((row) => predictRaw(tropical, calculatePlanetaryFeatures(row.eventId, row.occurredAtUtc, tropical.frame)))
  const siderealProbabilities = test.map((row) => predictRaw(sidereal, calculatePlanetaryFeatures(row.eventId, row.occurredAtUtc, sidereal.frame)))
  const baseline = test.map(() => tropical.baselineProbability)
  return {
    pipelineVersion: VALIDATION_PIPELINE_VERSION,
    datasetId: dataset.datasetId,
    tropical,
    sidereal,
    heldOutTest: {
      eventIds: test.map((row) => row.eventId), baselineBrier: brier(baseline, outcomes),
      tropicalBrier: brier(tropicalProbabilities, outcomes), siderealBrier: brier(siderealProbabilities, outcomes),
      equalWeightEnsembleBrier: brier(tropicalProbabilities.map((value, index) => (value + siderealProbabilities[index]!) / 2), outcomes),
    },
    boundary: 'Held-out performance is retrospective evidence on one declared dataset, not demonstrated prospective predictive skill. Promotion requires locked forecasts issued before outcomes and a pre-registered stopping rule.',
  }
}

export function issueProspectiveForecast(input: {
  forecastId: string; subjectPseudonym: string; issuedAtUtc: string; outcomeWindowStartUtc: string; outcomeWindowEndUtc: string
  target: BinaryForecast['target']; fit: ParallelModelFit
}): BinaryForecast {
  if (input.fit.tropical.trainedThroughUtc > input.issuedAtUtc || input.fit.sidereal.trainedThroughUtc > input.issuedAtUtc) throw new Error('A prospective forecast cannot use a model trained after issuance.')
  const predictions: ModelPrediction[] = [input.fit.tropical, input.fit.sidereal].map((model) => {
    const features = calculatePlanetaryFeatures(`${input.forecastId}_${model.frame.zodiac}`, input.outcomeWindowStartUtc, model.frame)
    return {
      modelId: model.modelId, modelVersion: model.artifactSha256, probability: predictRaw(model, features), trainedThroughUtc: model.trainedThroughUtc,
      trainingDatasetIds: [model.datasetId],
      featureBundle: { bundleId: features.eventId, bundleSha256: features.vectorSha256, ephemerisVersion: 'astronomy-engine 2.1.19', calculationMethod: PLANETARY_FEATURE_VERSION, frame: model.frame },
    }
  })
  const forecast: BinaryForecast = {
    forecastId: input.forecastId, subjectPseudonym: input.subjectPseudonym, issuedAtUtc: input.issuedAtUtc,
    outcomeWindowStartUtc: input.outcomeWindowStartUtc, outcomeWindowEndUtc: input.outcomeWindowEndUtc, target: input.target,
    baselineProbability: input.fit.tropical.baselineProbability, predictions,
    ensemble: { policyVersion: 'fixed-linear-pool/1', weights: predictions.map((prediction) => ({ modelId: prediction.modelId, weight: 0.5 })) },
    historicalEventIdsUsed: [...new Set([...input.fit.tropical.trainingEventIds, ...input.fit.tropical.validationEventIds])],
  }
  forecastDigest(forecast)
  return forecast
}

export function verifyModelArtifact(model: FittedCelestialModel): boolean {
  const { artifactSha256, ...core } = model
  return artifactDigest(core) === artifactSha256 && model.weights.length === model.featureNames.length && model.artifactVersion === FITTED_MODEL_VERSION
}

export function buildPredictiveSkillPolicy(input: Omit<PredictiveSkillPolicy, 'version' | 'policySha256'>): PredictiveSkillPolicy {
  if (!ID.test(input.policyId) || !isExplicitUtcInstant(input.lockedAtUtc) || !ID.test(input.metricId) || !ID.test(input.dataSourceId)) throw new Error('Skill policy identifiers and lock instant are invalid.')
  if (!Number.isInteger(input.minimumForecasts) || input.minimumForecasts < 20 || !Number.isFinite(input.alpha) || input.alpha <= 0 || input.alpha >= 0.5) throw new Error('Skill policy requires a fixed minimum and alpha.')
  if (!input.requiredComparatorKinds.length || new Set(input.requiredComparatorKinds).size !== input.requiredComparatorKinds.length) throw new Error('Skill policy requires unique benchmark comparator kinds.')
  const core = { version: SKILL_ASSESSMENT_POLICY_VERSION, ...input }
  return { ...core, policySha256: digestOf(core) }
}

function oneSidedBinomialUpper(successes: number, trials: number): number {
  if (!trials) return 1
  const choose = (n: number, k: number) => {
    let value = 1
    for (let index = 1; index <= k; index += 1) value *= (n - k + index) / index
    return value
  }
  let probability = 0
  for (let value = successes; value <= trials; value += 1) probability += choose(trials, value) * 0.5 ** trials
  return Math.min(1, probability)
}

/**
 * Final claim gate. Retrospective test scores never enter this function.
 * Every forecast must have been valid and locked before its outcome window.
 */
export function assessPredictiveSkill(input: {
  prospective: { forecast: BinaryForecast; outcome: 0 | 1 }[]
  policy: PredictiveSkillPolicy
  benchmarkComparisons: { comparatorKind: BenchmarkParticipantKind; comparison: PairedBenchmarkComparison }[]
}): PredictiveSkillAssessment {
  const { policySha256, ...policyCore } = input.policy
  if (digestOf(policyCore) !== policySha256) throw new Error('Skill policy digest does not verify.')
  const forecastIds = new Set(input.prospective.map(({ forecast }) => forecast.forecastId))
  if (forecastIds.size !== input.prospective.length) throw new Error('A prospective forecast can enter the skill denominator only once.')
  if (input.prospective.some(({ forecast }) => new Date(forecast.issuedAtUtc) <= new Date(input.policy.lockedAtUtc) || forecast.target.metricId !== input.policy.metricId || forecast.target.dataSourceId !== input.policy.dataSourceId)) throw new Error('Every assessed forecast must postdate and match the frozen skill policy.')
  const scores = input.prospective.map(({ forecast, outcome }) => scoreForecast(forecast, outcome))
  const baselineLosses = scores.map((score) => score.baseline.brier)
  const ensembleLosses = scores.map((score) => score.ensemble.brier)
  const nonTies = ensembleLosses.map((loss, index) => baselineLosses[index]! - loss).filter((difference) => difference !== 0)
  const wins = nonTies.filter((difference) => difference > 0).length
  const pValue = nonTies.length ? oneSidedBinomialUpper(wins, nonTies.length) : null
  const mean = (values: number[]) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null
  const meanBaselineBrier = mean(baselineLosses)
  const meanEnsembleBrier = mean(ensembleLosses)
  const passedKinds = input.benchmarkComparisons.filter(({ comparison }) =>
    comparison.accuracyDifference > 0
    && comparison.multiplicityAdjustedPValue !== null
    && comparison.multiplicityAdjustedPValue < input.policy.alpha,
  ).map(({ comparatorKind }) => comparatorKind)
  const unmetCriteria: string[] = []
  if (scores.length < input.policy.minimumForecasts) unmetCriteria.push(`Only ${scores.length} of ${input.policy.minimumForecasts} pre-registered prospective forecasts are resolved.`)
  if (meanEnsembleBrier === null || meanBaselineBrier === null || meanEnsembleBrier >= meanBaselineBrier) unmetCriteria.push('The ensemble has not beaten the declared ordinary baseline on mean Brier loss.')
  if (pValue === null || pValue >= input.policy.alpha) unmetCriteria.push('The pre-registered one-sided paired loss-win test has not crossed alpha.')
  for (const kind of input.policy.requiredComparatorKinds) if (!passedKinds.includes(kind)) unmetCriteria.push(`No positive multiplicity-adjusted paired AstroBench result against ${kind}.`)
  return {
    policySha256: input.policy.policySha256,
    status: unmetCriteria.length ? 'not-demonstrated' : 'demonstrated-under-declared-protocol',
    prospectiveForecasts: scores.length,
    meanEnsembleBrier,
    meanBaselineBrier,
    meanBrierImprovement: meanEnsembleBrier === null || meanBaselineBrier === null ? null : meanBaselineBrier - meanEnsembleBrier,
    baselineWinRate: nonTies.length ? wins / nonTies.length : null,
    oneSidedExactPValue: pValue,
    benchmarkComparatorsPassed: [...new Set(passedKinds)],
    unmetCriteria,
    boundary: '“Demonstrated” means only that the frozen system passed this declared prospective protocol on these tasks. It is not scientific consensus, causal evidence for astrology, or permission to generalize beyond the registered population, metric, and horizon.',
  }
}

export const EMPIRICAL_VALIDATION_BOUNDARY = `${FORECAST_PROTOCOL_VERSION}: fitting, persistence, and prospective scoring make a hypothesis testable. They do not make astrology valid and do not demonstrate predictive skill until a locked prospective study beats declared ordinary and random baselines.`
