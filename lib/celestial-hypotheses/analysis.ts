/**
 * Analysis — one plan, deliberately minimal.
 *
 * This version computes descriptive counts and an effect size and stops. It
 * does not produce a p-value, a Bayes factor, or a confidence interval, because
 * a significance number attached to a first pass at a small sample is the most
 * effective way to make an unvalidated rule look validated.
 *
 * `exactBinomialEligible` records whether such a test *could* be run on this
 * data, so a later version can run it without the eligibility decision having
 * been made after seeing the result.
 *
 * The interface is versioned and dispatched so continuous metrics, permutation
 * tests, hierarchical models, and holdout confirmation can be added as new
 * plan versions rather than as edits to this one.
 */

import { digestOf } from './canonical.ts'
import { horizonComplete } from './outcomes.ts'
import {
  REGISTRY_EPISTEMIC_BOUNDARY,
  type AnalysisPlan,
  type AnalysisResult,
  type ExperimentRegistration,
  type OutcomeRecord,
} from './types.ts'

export interface AnalysisInput {
  registration: ExperimentRegistration
  outcomes: OutcomeRecord[]
  now: Date
}

/** A registered analysis implementation. Add versions; never edit one. */
export interface AnalysisPlanImplementation {
  planVersion: AnalysisPlan['planVersion']
  run(input: AnalysisInput): AnalysisResult
}

function result(partial: Omit<AnalysisResult, 'analysisSha256' | 'computedAtUtc'>, now: Date): AnalysisResult {
  const computedAtUtc = now.toISOString()
  const core = { ...partial, computedAtUtc }
  return { ...core, analysisSha256: digestOf(core) }
}

/**
 * Binary outcome against a declared target rate.
 *
 * Classification is intentionally coarse. With no significance machinery there
 * is no basis for a fine-grained verdict, and `inconclusive` is the honest
 * answer far more often than a product would like.
 */
export const binaryOutcomePlan: AnalysisPlanImplementation = {
  planVersion: 'binary-outcome/1',

  run({ registration, outcomes, now }: AnalysisInput): AnalysisResult {
    const plan = registration.draft.analysisPlan
    const observations = outcomes.length

    const base = {
      planVersion: plan.planVersion,
      observations,
      successes: null as number | null,
      observedRate: null as number | null,
      targetRate: plan.targetRate,
      effectSize: null as number | null,
      exactBinomialEligible: false,
      classification: null as AnalysisResult['classification'],
    }

    if (!horizonComplete(registration, now)) {
      return result({
        ...base,
        status: 'pending',
        rationale: `The declared outcome horizon of ${registration.draft.metric.horizonHours}h after the action window has not elapsed. No analysis is run before its declared horizon.`,
      }, now)
    }

    if (observations < registration.draft.sampleSizeTarget) {
      return result({
        ...base,
        status: 'pending',
        rationale: `${observations} of the fixed sample ${registration.draft.sampleSizeTarget} observations are available. Analysing early would break the declared stopping rule.`,
      }, now)
    }

    if (observations > registration.draft.sampleSizeTarget) {
      throw new AnalysisUnavailable(`The fixed sample is ${registration.draft.sampleSizeTarget}, but ${observations} observations were supplied.`)
    }

    const successes = outcomes.reduce((total, outcome) => total + (outcome.value === 1 ? 1 : 0), 0)
    const observedRate = successes / observations
    const effectSize = observedRate - plan.targetRate

    // Eligibility is a property of the data shape, not of the result: a fixed
    // number of independent binary trials against a declared rate.
    const exactBinomialEligible = observations >= plan.minimumObservations
      && outcomes.every((outcome) => outcome.value === 0 || outcome.value === 1)

    // Without a significance test, only a large and unambiguous departure
    // deserves anything other than `inconclusive`.
    const direction = registration.draft.metric.direction
    const improved = direction === 'higher-is-better' ? effectSize > 0 : effectSize < 0
    const magnitude = Math.abs(effectSize)

    let classification: AnalysisResult['classification'] = 'inconclusive'
    let rationale = `Observed rate ${observedRate.toFixed(4)} against a declared target of ${plan.targetRate.toFixed(4)}. This version reports descriptive statistics only and runs no significance test, so the result is recorded as inconclusive.`

    if (magnitude < 0.01) {
      classification = 'null'
      rationale = `Observed rate ${observedRate.toFixed(4)} is within 0.01 of the declared target ${plan.targetRate.toFixed(4)}. Recorded as a null result; a null result is published, not discarded.`
    } else if (magnitude + Number.EPSILON * 10 >= 0.2) {
      classification = improved ? 'positive' : 'adverse'
      rationale = `Observed rate ${observedRate.toFixed(4)} departs from the declared target ${plan.targetRate.toFixed(4)} by ${effectSize.toFixed(4)} in the ${improved ? 'declared' : 'opposite'} direction. Descriptive only: no significance test was run, and this does not establish that the rule predicts anything.`
    }

    return result({
      ...base,
      successes,
      observedRate,
      effectSize,
      exactBinomialEligible,
      status: 'complete',
      classification,
      rationale,
    }, now)
  },
}

const IMPLEMENTATIONS = new Map<AnalysisPlan['planVersion'], AnalysisPlanImplementation>([
  [binaryOutcomePlan.planVersion, binaryOutcomePlan],
])

export class AnalysisUnavailable extends Error {}

export function runAnalysis(input: AnalysisInput): AnalysisResult {
  const planVersion = input.registration.draft.analysisPlan.planVersion
  const implementation = IMPLEMENTATIONS.get(planVersion)
  if (!implementation) throw new AnalysisUnavailable(`No implementation is registered for analysis plan ${planVersion}.`)
  return implementation.run(input)
}

/** Carried with every result so a rendered number never travels without it. */
export const ANALYSIS_BOUNDARY = REGISTRY_EPISTEMIC_BOUNDARY
