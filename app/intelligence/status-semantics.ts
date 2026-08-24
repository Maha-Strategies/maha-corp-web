/**
 * Semantic classification for intelligence brief statuses.
 *
 * The editorial statuses in the brief corpus are free text. This maps each one
 * onto the site's five semantic evidence states so the cyber-light surface can
 * colour them consistently instead of inventing a palette per card:
 *
 *   verified     green   confirmed / actively tracked
 *   sourced      blue    informational / regulatory
 *   boundary     amber   provisional, in flux, treat with caution
 *   illustrative purple  modelled or forward-looking
 *   unverified   red     highest alert
 */
export const INTELLIGENCE_SEMANTICS = [
  'verified',
  'sourced',
  'boundary',
  'illustrative',
  'unverified',
] as const

export type IntelligenceSemantic = (typeof INTELLIGENCE_SEMANTICS)[number]

const STATUS_SEMANTICS: Record<string, IntelligenceSemantic> = {
  ACTIVE: 'verified',
  COMPLIANCE: 'sourced',
  PRELIMINARY: 'boundary',
  VOLATILE: 'boundary',
  TRANSITIONING: 'boundary',
  EMERGING: 'illustrative',
  'STRUCTURAL SHIFT': 'illustrative',
  'BEHAVIORAL CAPTURE': 'illustrative',
  CRITICAL: 'unverified',
  'CRITICAL PRIORITY': 'unverified',
}

/** Unknown statuses fall back to `boundary`: unclassified is a caution, not a claim. */
export function semanticForStatus(status: string): IntelligenceSemantic {
  return STATUS_SEMANTICS[status.trim().toUpperCase()] ?? 'boundary'
}

export function knownStatuses(): string[] {
  return Object.keys(STATUS_SEMANTICS)
}
