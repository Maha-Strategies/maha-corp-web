export const EPISTEMIC_RELEASE_CONFLICT_CODES = [
  'latest-target-mismatch',
  'released-content-mismatch',
  'released-identity-mismatch',
  'frozen-target-blocker',
  'canonical-controls-invalid',
  'required-approval-missing',
  'approval-manifest-mismatch',
  'embedded-approval-mismatch',
  'approval-count-mismatch',
  'active-lineage-conflict',
  'initial-lineage-conflict',
  'unique-release-conflict',
  'unclassified-release-conflict',
] as const

export type EpistemicReleaseConflictCode = typeof EPISTEMIC_RELEASE_CONFLICT_CODES[number]

/**
 * Converts persistence detail into a bounded operational code. The database
 * message itself is never returned because it may contain record-specific
 * values. This function is used only after release-authority authentication.
 */
export function classifyEpistemicReleaseConflict(error: unknown): EpistemicReleaseConflictCode {
  const message = error instanceof Error ? error.message : ''
  if (message.includes('must bind the latest frozen target')) return 'latest-target-mismatch'
  if (message.includes('Released content differs')) return 'released-content-mismatch'
  if (message.includes('Released identity differs')) return 'released-identity-mismatch'
  if (message.includes('retains a non-release blocker')) return 'frozen-target-blocker'
  if (message.includes('publication controls or path are invalid')) return 'canonical-controls-invalid'
  if (message.includes('lacks an exact unqualified approval')) return 'required-approval-missing'
  if (message.includes('approval manifest does not match')) return 'approval-manifest-mismatch'
  if (message.includes('does not embed the exact')) return 'embedded-approval-mismatch'
  if (message.includes('approval manifest must contain')) return 'approval-count-mismatch'
  if (message.includes('must explicitly supersede the active release')) return 'active-lineage-conflict'
  if (message.includes('initial release cannot declare')) return 'initial-lineage-conflict'
  if (message.includes('duplicate key')) return 'unique-release-conflict'
  return 'unclassified-release-conflict'
}
