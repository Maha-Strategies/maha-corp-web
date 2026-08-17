/**
 * The provenance bundle: the whole chain, in one object.
 *
 * A reader should be able to go from a published result back to the exact
 * transcribed sentence in a 6th-century text without trusting anything in
 * between. That means the bundle carries hashes at every hop — registration,
 * fact bundle, analysis plan, each outcome, the analysis result — plus the
 * passage and source ids the rules resolve to.
 *
 * It deliberately carries no participant identifier. See `publicView`.
 */

import { getAstrologyPassage, getRulesForTradition } from '../astrology-traditions.ts'
import { analysisPlanDigest } from './registration.ts'
import { comparatorSeedCommitment } from './comparator.ts'
import { structuredVerdictDigest } from './verdict.ts'
import {
  HYPOTHESIS_REGISTRY_VERSION,
  REGISTRY_EPISTEMIC_BOUNDARY,
  type AnalysisResult,
  type ExperimentProvenanceBundle,
  type ExperimentRegistration,
  type OutcomeRecord,
} from './types.ts'

export interface BuildProvenanceInput {
  registration: ExperimentRegistration
  outcomes: OutcomeRecord[]
  analysis?: AnalysisResult | null
}

/** Passage and source ids the registered rules resolve to. */
function sourceChain(traditionId: string, ruleIds: string[]): { passageIds: string[]; sourceIds: string[] } {
  const rules = new Map(getRulesForTradition(traditionId).map((rule) => [rule.id, rule]))
  const passageIds: string[] = []
  const sourceIds: string[] = []
  for (const ruleId of ruleIds) {
    const rule = rules.get(ruleId)
    if (!rule) continue
    for (const passageId of rule.passageIds) {
      passageIds.push(passageId)
      const passage = getAstrologyPassage(passageId)
      if (passage) sourceIds.push(passage.sourceId)
    }
  }
  return { passageIds: [...new Set(passageIds)], sourceIds: [...new Set(sourceIds)] }
}

export function buildProvenanceBundle({ registration, outcomes, analysis }: BuildProvenanceInput): ExperimentProvenanceBundle {
  const draft = registration.draft
  const { passageIds, sourceIds } = sourceChain(draft.hypothesis.traditionId, draft.hypothesis.ruleIds)

  return {
    experimentId: registration.experimentId,
    registryVersion: HYPOTHESIS_REGISTRY_VERSION,
    status: analysis && analysis.status === 'complete' ? 'analyzed' : outcomes.length > 0 ? 'outcome-recorded' : 'registered',
    registrationSha256: registration.registrationSha256,
    registeredAtUtc: registration.registeredAtUtc,
    factBundleId: draft.factBundleId,
    factBundleSha256: draft.factBundleSha256,
    compilerVersion: draft.compilerVersion,
    ruleRegistryVersion: draft.ruleRegistryVersion,
    verdictSha256: structuredVerdictDigest(draft.verdict),
    verdictClassification: draft.verdict.classification,
    traditionId: draft.hypothesis.traditionId,
    ruleIds: [...draft.hypothesis.ruleIds],
    passageIds,
    sourceIds,
    comparator: {
      policyVersion: draft.comparator.policyVersion,
      draws: draft.comparator.draws,
      // The commitment, never the seed: publishing an unopened seed would let a
      // reader reconstruct a draw the registration meant to keep sealed.
      seedCommitmentSha256: comparatorSeedCommitment(draft.comparator),
    },
    analysisPlanVersion: draft.analysisPlan.planVersion,
    analysisPlanSha256: analysisPlanDigest(draft),
    outcomeSha256: outcomes.map((outcome) => outcome.outcomeSha256),
    analysisSha256: analysis?.analysisSha256 ?? null,
    epistemicBoundary: REGISTRY_EPISTEMIC_BOUNDARY,
  }
}

/**
 * The shape safe to expose without authentication.
 *
 * Public listing is not enabled in this version — see the migration notes — but
 * the projection exists and is tested now, so that when it is enabled the
 * privacy decision has already been made and asserted rather than improvised.
 *
 * Removed: the participant pseudonym, the free-form notes, the raw-value
 * digests' source ids, and anything else that could correlate an experiment
 * back to a person. Retained: the scientific content.
 */
export function publicView(bundle: ExperimentProvenanceBundle, registration: ExperimentRegistration) {
  return {
    experimentId: bundle.experimentId,
    registryVersion: bundle.registryVersion,
    status: bundle.status,
    registrationSha256: bundle.registrationSha256,
    registeredAtUtc: bundle.registeredAtUtc,
    traditionId: bundle.traditionId,
    ruleIds: bundle.ruleIds,
    passageIds: bundle.passageIds,
    sourceIds: bundle.sourceIds,
    activityType: registration.draft.activityType,
    hypothesisStatement: registration.draft.hypothesis.statement,
    ruleEmpiricalStatus: registration.draft.hypothesis.ruleEmpiricalStatus,
    verdict: {
      classification: registration.draft.verdict.classification,
      prediction: registration.draft.verdict.prediction,
      verdictSha256: bundle.verdictSha256,
      empiricalCalibrationStatus: registration.draft.verdict.empiricalCalibrationStatus,
    },
    metric: {
      name: registration.draft.metric.name,
      kind: registration.draft.metric.kind,
      unit: registration.draft.metric.unit,
      direction: registration.draft.metric.direction,
      horizonHours: registration.draft.metric.horizonHours,
    },
    comparator: bundle.comparator,
    analysisPlanVersion: bundle.analysisPlanVersion,
    analysisPlanSha256: bundle.analysisPlanSha256,
    outcomeCount: bundle.outcomeSha256.length,
    analysisSha256: bundle.analysisSha256,
    epistemicBoundary: bundle.epistemicBoundary,
  }
}
