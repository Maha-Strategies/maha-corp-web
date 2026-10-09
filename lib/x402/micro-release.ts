/**
 * Owner-authorized publication. Never infer a release from configuration.
 *
 * Extended from five to fifteen on 2026-09-10. The ten added here are exactly
 * the withheld offers that the candidate review selected and that
 * micro-next12-cost-observation profiled: each is implemented, has a bounded
 * input schema, and sits in the top cost band. The seven withheld offers the
 * review did not select stay withheld -- publishing those would override a
 * review decision rather than act on one.
 */
import { PLANNING_IDS } from './micro-planning-contracts.ts'
import { EVIDENCE_CHECK_IDS } from './evidence-check-contracts.ts'

// Keep the prior production opt-in fixed; new products require a separate flag.
export const EXISTING_RELEASED_MICRO_IDS = [
  'citation-binding-check',
  'revision-lineage-check',
  'audit-export-normalizer',
  'unit-uncertainty-conversion',
  'divine-name-disambiguation',
  'publication-bundle-consistency',
  'covariance-uncertainty',
  'bracketed-polynomial-root',
  'exact-linear-system',
  'edition-verse-resolution',
  'reception-lineage-retrieval',
  'mcp-contract-compatibility',
  'tool-permission-diff',
  'policy-version-comparison',
  'control-evidence-gaps',
  // Separately approved on 2026-09-13; prior launch/payment cohorts stay fixed.
  'celestial-result-compatibility',
  'evidence-frame-compatibility',
] as const

export const RELEASED_MICRO_IDS = [...EXISTING_RELEASED_MICRO_IDS, ...PLANNING_IDS, ...EVIDENCE_CHECK_IDS] as const

export function isReleasedMicro(id: string): boolean {
  return (RELEASED_MICRO_IDS as readonly string[]).includes(id)
}

export function microExecutionAllowed(id: string, environment: string | undefined): boolean {
  if (environment === 'test' || environment === 'development') return true
  return (environment === 'preview' || environment === 'production') && isReleasedMicro(id)
}
