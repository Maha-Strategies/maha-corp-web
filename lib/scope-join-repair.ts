/**
 * The malformed scope join, and why repairing it is not a formatting change.
 *
 * frontier-domain-graphs builds a claim scope as
 *
 *   `Limited to ${exactLocator} in “${sourceTitle}”; this candidate ...`
 *
 * and most locators already end in a full stop, so the result reads
 * "... correction coil sections. in “Magnets”". The sentence is broken; nothing
 * about the evidence is.
 *
 * The repair is therefore purely textual - one stray terminator removed at the
 * join, with the locator and the source title untouched - and it still cannot
 * simply be applied. A record's digest covers its claims, so correcting 240
 * scope strings moves 240 revision digests, and a digest is what an exact-
 * revision review and an active canonical release are both bound to. Applying
 * it would silently invalidate every review of those revisions and desync 67
 * live releases from the records they name.
 *
 * So the correction is computed, proven and reported here, and deliberately not
 * activated. Activating it is a governed migration that has to re-review what it
 * touches, which is a decision for whoever owns the release, not a side effect
 * of fixing a full stop.
 */

export const SCOPE_JOIN_REPAIR_VERSION = 'maha-scope-join-repair/1.0' as const

/** The join defect: a terminated locator followed by the source clause. */
export const MALFORMED_JOIN = /([.!?])(\s+in\s+[“"])/g

/** True when a scope string carries the defect. */
export function hasMalformedJoin(scope: string): boolean {
  MALFORMED_JOIN.lastIndex = 0
  return MALFORMED_JOIN.test(scope)
}

/**
 * Removes the stray terminator at the join, and nothing else.
 *
 * Only the punctuation immediately before ` in “` is dropped. Sentence-ending
 * punctuation elsewhere in the locator survives, because a locator that
 * genuinely contains a sentence is not this defect.
 */
export function repairScopeJoin(scope: string): string {
  return scope.replace(MALFORMED_JOIN, '$2')
}

export interface ScopeRepairImpact {
  recordId: string
  claimsRepaired: number
  /** The digest the record carries now. */
  currentRevisionSha256: string
  /** The digest it would carry after the correction. */
  repairedRevisionSha256: string
  digestChanges: boolean
  /** What the change would invalidate if applied. */
  invalidates: readonly ('exact-revision-review' | 'active-canonical-release')[]
}

/**
 * Whether a repaired record still says the same thing.
 *
 * The guard against a formatting fix quietly becoming an evidentiary one: the
 * repaired scope must differ from the original only by removed terminators at
 * the join, and must be identical once both are stripped of them.
 */
export function repairIsFormattingOnly(before: string, after: string): boolean {
  if (before === after) return true
  const strip = (value: string) => value.replace(MALFORMED_JOIN, '$2')
  // The repair is idempotent, and applying it to the original must reproduce
  // exactly the candidate: no other character may move.
  return strip(before) === after && strip(after) === after
}
