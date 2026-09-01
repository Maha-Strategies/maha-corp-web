/**
 * Adopting a proposed revision, without letting adoption become activation.
 *
 * A source-override canary needs five records whose source is replaced, and
 * Batch 12A produced one. Relabelling the cohort as a source-override canary
 * would have made the evidence look stronger than it is, so this is a
 * differently named thing: a mixed cohort where one record changes its source
 * and the rest change only what their claim says it is bound to.
 *
 * The property under test is that a proposed revision is inert. It has a
 * digest, an audit and a review bundle of its own, and none of that makes it
 * active. Activation is a separate authority, and a predecessor's review does
 * not travel to a successor: a decision is about a revision, not about a record.
 */

export const MIXED_ADOPTION_VERSION = 'maha-mixed-revision-adoption/1.0' as const

export type ProposalKind = 'source-replacement' | 'locator-correction' | 'claim-scope-narrowing'
export type ReleaseClassification = 'initial' | 'superseding'

export interface AdoptionCandidate {
  recordId: string
  kind: ProposalKind
  activeRevisionSha256: string
  proposedRevisionSha256: string
  /** The alignment audit bound to the proposed revision, not the predecessor. */
  proposedAuditSha256: string
  /** Five axes, each naming the proposed revision. */
  reviewBundleRevisionSha256: string
  decidedAxes: readonly string[]
  hasActivePredecessorRelease: boolean
}

export type AdoptionRefusal =
  | 'review-bundle-names-a-different-revision'
  | 'incomplete-review-bundle'
  | 'audit-not-bound-to-proposed-revision'
  | 'proposed-equals-active'
  | 'record-identity-substituted'

export interface AdoptionVerdict {
  recordId: string
  admissible: boolean
  refusals: readonly AdoptionRefusal[]
  releaseClassification: ReleaseClassification
  /** Always false here. Admissible means reviewable, never live. */
  active: false
}

const REQUIRED_AXES = 5

/**
 * Whether a proposal may be presented for governed adoption.
 *
 * Deliberately refuses a bundle that names the predecessor's digest. That is
 * the exact shape of inheriting a review, and it is easy to do by accident
 * because the predecessor's decisions are the ones that already exist.
 */
export function evaluateAdoption(
  candidate: AdoptionCandidate,
  expectedRecordIds: ReadonlySet<string>,
): AdoptionVerdict {
  const refusals: AdoptionRefusal[] = []
  if (!expectedRecordIds.has(candidate.recordId)) refusals.push('record-identity-substituted')
  if (candidate.proposedRevisionSha256 === candidate.activeRevisionSha256) refusals.push('proposed-equals-active')
  if (candidate.reviewBundleRevisionSha256 !== candidate.proposedRevisionSha256) {
    refusals.push('review-bundle-names-a-different-revision')
  }
  if (candidate.decidedAxes.length !== REQUIRED_AXES) refusals.push('incomplete-review-bundle')
  if (!candidate.proposedAuditSha256 || candidate.proposedAuditSha256 === candidate.activeRevisionSha256) {
    refusals.push('audit-not-bound-to-proposed-revision')
  }
  return {
    recordId: candidate.recordId,
    admissible: refusals.length === 0,
    refusals,
    // A record with a live release is superseded by definition; one without is
    // initial. Read from release state, never from the proposal.
    releaseClassification: candidate.hasActivePredecessorRelease ? 'superseding' : 'initial',
    active: false,
  }
}

/**
 * Deterministic ordering, so a canary run is reproducible.
 *
 * Initial releases first, then superseding, then record id. Both keys are
 * stable facts about the record rather than anything the proposal asserts, so
 * two runs over the same cohort order it identically.
 */
export function adoptionOrder(candidates: readonly AdoptionCandidate[]): readonly string[] {
  return [...candidates]
    .map((candidate) => ({
      recordId: candidate.recordId,
      key: `${candidate.hasActivePredecessorRelease ? "1-superseding" : "0-initial"}:${candidate.recordId}`,
    }))
    .sort((a, b) => a.key.localeCompare(b.key))
    .map((entry) => entry.recordId)
}
