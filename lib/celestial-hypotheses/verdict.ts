/**
 * Activity-specific, pre-action celestial verdicts.
 *
 * A classical rule does not mention a software release or a batch job. The
 * mapping from a source-described undertaking to a modern activity is therefore
 * kept in this separate corpus and labelled as Maha synthesis. This prevents a
 * modern analogy from being mistaken for something the historical source said.
 *
 * Verdicts are categorical by design. There is no auspiciousness score and no
 * confidence percentage: neither has empirical calibration yet.
 */

import { getRulesForTradition } from '../astrology-traditions.ts'
import { digestOf } from './canonical.ts'
import { ACTIVITY_TYPES, type ActivityType, type MetricDirection } from './types.ts'

export const ACTIVITY_RULE_CORPUS_VERSION = 'celestial-activity-rules/0.1' as const
export const STRUCTURED_VERDICT_VERSION = 'celestial-verdict/0.1' as const
export const VERDICT_RESOLUTION_POLICY = 'preserve-conflict-and-abstain/1' as const

export const VERDICT_CLASSIFICATIONS = [
  'favorable',
  'unfavorable',
  'conflicting',
  'abstain-no-coverage',
  'abstain-unresolved-variant',
] as const
export type VerdictClassification = typeof VERDICT_CLASSIFICATIONS[number]

export type ActivityRuleDirection = 'favorable' | 'unfavorable'
export type ActivityMappingProvenance = 'direct-source' | 'historical-analogy' | 'maha-synthesis'

export interface ActivityRuleApplication {
  id: string
  activityType: ActivityType
  traditionId: string
  ruleId: string
  direction: ActivityRuleDirection
  mappingProvenance: ActivityMappingProvenance
  /** Why this modern activity is treated as an instance of the source-described act. */
  rationale: string
  /** Stable group for competing readings of the same source condition. */
  variantGroupId: string | null
  /** Machine-readable links to applications that assert the opposite direction. */
  conflictsWithApplicationIds: string[]
  /** A known disagreement that has not yet been represented by a sourced variant. */
  unresolvedVariant: boolean
}

function application(
  activityType: ActivityType,
  ruleId: 'bs-muhurta-bava-favourable' | 'bs-muhurta-vishti-prohibition',
  direction: ActivityRuleDirection,
  rationale: string,
  unresolvedVariant = false,
): ActivityRuleApplication {
  const suffix = ruleId === 'bs-muhurta-bava-favourable' ? 'bava' : 'vishti'
  return {
    id: `maha-${activityType}-${suffix}`,
    activityType,
    traditionId: 'vedic-jyotisha',
    ruleId,
    direction,
    mappingProvenance: 'maha-synthesis',
    rationale,
    variantGroupId: ruleId === 'bs-muhurta-vishti-prohibition' ? 'vishti-scope' : null,
    conflictsWithApplicationIds: [],
    unresolvedVariant,
  }
}

const MODERN_ACTIVITY_RATIONALES: Record<ActivityType, string> = {
  'software-release': 'Maha treats beginning a production software release as a modern undertaking whose operational effect is intended to persist. The source does not mention software.',
  'content-publication': 'Maha treats making a publication publicly available as the beginning of an undertaking intended to persist. The source does not mention digital publishing.',
  'outbound-campaign-send': 'Maha treats dispatching a bounded outbound campaign as the beginning of a moveable undertaking. The source does not mention marketing campaigns.',
  'meeting-scheduling': 'Maha treats opening a consequential scheduled meeting as the beginning of a bounded undertaking. The source does not mention modern business meetings.',
  'travel-departure': 'Maha treats physical departure as the beginning of a moveable undertaking. This is an analogy; these two source rules do not specifically discuss journeys.',
  'equipment-maintenance-window': 'Maha treats the start of planned maintenance as the beginning of a fixed operational undertaking. The source does not mention modern equipment maintenance.',
  'batch-job-scheduling': 'Maha treats starting a production batch job as the beginning of a bounded operational undertaking. The source does not mention automated jobs.',
}

/**
 * Initial bounded activity corpus. Every allowlisted activity has both a
 * favorable and an unfavorable mapping. Viṣṭi mappings retain the source
 * record's unresolved disagreement about how broadly the prohibition applies,
 * causing the strict compiler to abstain when that rule is selected.
 */
export const ACTIVITY_RULE_APPLICATIONS: ActivityRuleApplication[] = ACTIVITY_TYPES.flatMap((activityType) => [
  application(activityType, 'bs-muhurta-bava-favourable', 'favorable', MODERN_ACTIVITY_RATIONALES[activityType]),
  application(activityType, 'bs-muhurta-vishti-prohibition', 'unfavorable', MODERN_ACTIVITY_RATIONALES[activityType], true),
])

export interface VerdictPrediction {
  metricId: string
  metricDirection: MetricDirection
  targetRate: number
  relationToTarget: 'meets-or-exceeds-target' | 'misses-target' | 'no-prediction'
}

export interface StructuredVerdict {
  verdictVersion: typeof STRUCTURED_VERDICT_VERSION
  activityCorpusVersion: typeof ACTIVITY_RULE_CORPUS_VERSION
  resolutionPolicyVersion: typeof VERDICT_RESOLUTION_POLICY
  activityType: ActivityType
  traditionId: string
  factBundleId: string
  factBundleSha256: string
  ruleRegistryVersion: string
  applicableRuleIds: string[]
  applicationIds: string[]
  favorableApplicationIds: string[]
  unfavorableApplicationIds: string[]
  unresolvedVariantGroupIds: string[]
  conflictApplicationIds: string[]
  classification: VerdictClassification
  prediction: VerdictPrediction
  empiricalCalibrationStatus: 'unvalidated'
  epistemicBoundary: string
}

export interface ActivityVerdictResolution {
  activityType: ActivityType
  traditionId: string
  applicableRuleIds: string[]
  applicationIds: string[]
  favorableApplicationIds: string[]
  unfavorableApplicationIds: string[]
  unresolvedVariantGroupIds: string[]
  conflictApplicationIds: string[]
  classification: VerdictClassification
}

export interface BuildStructuredVerdictInput {
  activityType: ActivityType
  traditionId: string
  applicableRuleIds: string[]
  factBundleId: string
  factBundleSha256: string
  ruleRegistryVersion: string
  metricId: string
  metricDirection: MetricDirection
  targetRate: number
}

export const VERDICT_EPISTEMIC_BOUNDARY =
  'This categorical verdict is a pre-registered output of an unvalidated interpretive tradition. It is not a probability, scientific confidence estimate, or guarantee of an outcome.'

export function resolveActivityVerdict(input: Pick<BuildStructuredVerdictInput, 'activityType' | 'traditionId' | 'applicableRuleIds'>): ActivityVerdictResolution {
  const selected = ACTIVITY_RULE_APPLICATIONS.filter((item) =>
    item.activityType === input.activityType
    && item.traditionId === input.traditionId
    && input.applicableRuleIds.includes(item.ruleId))
  const favorable = selected.filter((item) => item.direction === 'favorable')
  const unfavorable = selected.filter((item) => item.direction === 'unfavorable')
  const unresolvedVariantGroupIds = [...new Set(selected.flatMap((item) =>
    item.unresolvedVariant && item.variantGroupId ? [item.variantGroupId] : []))].sort()
  const conflictApplicationIds = [...new Set(selected.flatMap((item) => item.conflictsWithApplicationIds))].sort()

  let classification: VerdictClassification
  if (selected.length === 0) classification = 'abstain-no-coverage'
  else if (unresolvedVariantGroupIds.length > 0) classification = 'abstain-unresolved-variant'
  else if (favorable.length > 0 && unfavorable.length > 0) classification = 'conflicting'
  else if (favorable.length > 0) classification = 'favorable'
  else classification = 'unfavorable'

  return {
    activityType: input.activityType,
    traditionId: input.traditionId,
    applicableRuleIds: [...input.applicableRuleIds].sort(),
    applicationIds: selected.map((item) => item.id).sort(),
    favorableApplicationIds: favorable.map((item) => item.id).sort(),
    unfavorableApplicationIds: unfavorable.map((item) => item.id).sort(),
    unresolvedVariantGroupIds,
    conflictApplicationIds,
    classification,
  }
}

export function buildStructuredVerdict(input: BuildStructuredVerdictInput): StructuredVerdict {
  const resolution = resolveActivityVerdict(input)

  const relationToTarget = resolution.classification === 'favorable'
    ? 'meets-or-exceeds-target'
    : resolution.classification === 'unfavorable'
      ? 'misses-target'
      : 'no-prediction'

  return {
    verdictVersion: STRUCTURED_VERDICT_VERSION,
    activityCorpusVersion: ACTIVITY_RULE_CORPUS_VERSION,
    resolutionPolicyVersion: VERDICT_RESOLUTION_POLICY,
    activityType: input.activityType,
    traditionId: input.traditionId,
    factBundleId: input.factBundleId,
    factBundleSha256: input.factBundleSha256,
    ruleRegistryVersion: input.ruleRegistryVersion,
    applicableRuleIds: resolution.applicableRuleIds,
    applicationIds: resolution.applicationIds,
    favorableApplicationIds: resolution.favorableApplicationIds,
    unfavorableApplicationIds: resolution.unfavorableApplicationIds,
    unresolvedVariantGroupIds: resolution.unresolvedVariantGroupIds,
    conflictApplicationIds: resolution.conflictApplicationIds,
    classification: resolution.classification,
    prediction: {
      metricId: input.metricId,
      metricDirection: input.metricDirection,
      targetRate: input.targetRate,
      relationToTarget,
    },
    empiricalCalibrationStatus: 'unvalidated',
    epistemicBoundary: VERDICT_EPISTEMIC_BOUNDARY,
  }
}

export function structuredVerdictDigest(verdict: StructuredVerdict): string {
  return digestOf(verdict)
}

export function assertActivityRuleCorpusIntegrity(): void {
  const ids = new Set<string>()
  for (const item of ACTIVITY_RULE_APPLICATIONS) {
    if (ids.has(item.id)) throw new Error(`Duplicate activity application ${item.id}.`)
    ids.add(item.id)
    const rule = getRulesForTradition(item.traditionId).find((candidate) => candidate.id === item.ruleId)
    if (!rule) throw new Error(`${item.id} references missing rule ${item.ruleId} in ${item.traditionId}.`)
    if (!rule.chartTypes.includes('electional')) throw new Error(`${item.id} references a non-electional rule.`)
    if (item.mappingProvenance !== 'maha-synthesis') {
      throw new Error(`${item.id} must not imply that a classical source directly names a modern activity.`)
    }
    if (item.rationale.length < 80) throw new Error(`${item.id} needs an explicit modern-activity rationale.`)
    if (item.unresolvedVariant && !item.variantGroupId) throw new Error(`${item.id} has an unresolved variant without a group.`)
  }
  for (const item of ACTIVITY_RULE_APPLICATIONS) {
    for (const conflictId of item.conflictsWithApplicationIds) {
      if (!ids.has(conflictId)) throw new Error(`${item.id} references missing conflict ${conflictId}.`)
    }
  }
}

assertActivityRuleCorpusIntegrity()
