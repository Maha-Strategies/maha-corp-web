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
export const RELEASED_MICRO_IDS = [
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
] as const

export function isReleasedMicro(id: string): boolean {
  return (RELEASED_MICRO_IDS as readonly string[]).includes(id)
}

export function microExecutionAllowed(id: string, environment: string | undefined): boolean {
  if (environment === 'test' || environment === 'development') return true
  return (environment === 'preview' || environment === 'production') && isReleasedMicro(id)
}
