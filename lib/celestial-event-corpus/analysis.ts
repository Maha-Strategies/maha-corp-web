import { digestOf } from '../celestial-hypotheses/canonical.ts'
import type { CorpusObservationRecord, CorpusStateFeature } from './types.ts'

export interface CorpusFeatureExposure {
  feature: CorpusStateFeature
  milestoneObservations: number
  nonEventObservations: number
  totalObservations: number
  observedMilestoneRate: number
  corpusBaselineMilestoneRate: number
  descriptiveRateRatio: number | null
}

export interface CorpusExposureSummary {
  status: 'descriptive-exploratory'
  observations: number
  milestones: number
  nonEvents: number
  corpusBaselineMilestoneRate: number | null
  featureExposures: CorpusFeatureExposure[]
  summarySha256: string
  boundary: string
}

export function summarizeCorpusExposure(observations: CorpusObservationRecord[]): CorpusExposureSummary {
  const milestones = observations.filter((entry) => entry.kind === 'milestone').length
  const nonEvents = observations.filter((entry) => entry.kind === 'non-event').length
  const baseline = observations.length ? milestones / observations.length : null
  const byFeature = new Map<string, { feature: CorpusStateFeature; observations: CorpusObservationRecord[] }>()
  for (const observation of observations) {
    for (const feature of observation.celestialState.stableFeatures) {
      const entry = byFeature.get(feature.key) ?? { feature, observations: [] }
      entry.observations.push(observation)
      byFeature.set(feature.key, entry)
    }
  }
  const featureExposures = [...byFeature.values()].map(({ feature, observations: exposed }) => {
    const featureMilestones = exposed.filter((entry) => entry.kind === 'milestone').length
    const observedMilestoneRate = featureMilestones / exposed.length
    return {
      feature,
      milestoneObservations: featureMilestones,
      nonEventObservations: exposed.length - featureMilestones,
      totalObservations: exposed.length,
      observedMilestoneRate,
      corpusBaselineMilestoneRate: baseline ?? 0,
      descriptiveRateRatio: baseline && baseline > 0 ? observedMilestoneRate / baseline : null,
    }
  }).sort((left, right) => right.totalObservations - left.totalObservations || left.feature.key.localeCompare(right.feature.key))
  const core = { observations: observations.length, milestones, nonEvents, corpusBaselineMilestoneRate: baseline, featureExposures }
  return {
    status: 'descriptive-exploratory',
    ...core,
    summarySha256: digestOf(core),
    boundary: 'Rates compare observations admitted under this locked historical sampling plan. They are descriptive, not causal or confirmatory; repeated intervals, dependent outcomes, selection errors, and multiple comparisons can all create apparent signal. Only a prospectively registered untouched evaluation may support a predictive-performance claim.',
  }
}
