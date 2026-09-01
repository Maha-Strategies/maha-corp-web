import { createHash } from 'node:crypto'

import { canonicalJson } from './evidence-dossier/digest.ts'

/**
 * Whether an exact revision has been reviewed, observed rather than inferred.
 *
 * The scaling inventory could not tell a record that had been reviewed and not
 * released from one that had never been reviewed at all, because the only
 * readable evidence of review was an active canonical release. That made one
 * capacity bucket permanently empty and hid the actual question: of the records
 * waiting, which are waiting on a decision and which on a decision that already
 * exists and says no.
 *
 * So review state is projected from committed decision corpora directly, keyed
 * by the exact revision digest. A decision that names a different revision is
 * evidence about that revision and not this one, which is the distinction that
 * lets a stale approval stop being mistaken for a current one.
 *
 * Nothing here reads reviewer identity, rationale prose or authority material.
 * The projection carries digests and enumerated states, so it can be published
 * to an operator report without carrying anything private with it.
 */

export const REVIEW_PROJECTION_VERSION = 'maha-exact-revision-review/1.0' as const

/**
 * The five axes an internal-tier review must decide separately.
 *
 * A single "approve record" verdict cannot express that a source was correctly
 * identified but the passage does not support the claim, which is the failure
 * this tier exists to catch. Each axis is decided on its own evidence.
 */
export const REVIEW_AXES = [
  'source-identity-and-fidelity',
  'claim-to-passage-support',
  'scope-and-unsupported-inference',
  'rights-and-locator-adequacy',
  'release-boundary-and-nonclaims',
] as const
export type ReviewAxis = (typeof REVIEW_AXES)[number]

export type ReviewerKind = 'internal-editorial' | 'external-expert'
export type AxisDecision = 'approve' | 'revise' | 'reject'

/** One decision, about one axis, about one exact revision. */
export interface AxisRecord {
  axis: ReviewAxis
  decision: AxisDecision
  reviewerKind: ReviewerKind
  /** Digest of the decision content. Never the rationale itself. */
  decisionSha256: string
  /** Short, bounded, non-identifying. Safe for an operator report. */
  note: string
}

export interface RevisionUnderReview {
  recordId: string
  /** The digest the decisions must name to count for this revision. */
  revisionSha256: string
  /** The alignment audit that cleared this revision. */
  auditSha256: string
  axes: readonly AxisRecord[]
  supersededBy: string | null
  withdrawn: boolean
}

export type ReviewState =
  | 'approved-for-exact-revision'
  | 'approved-only-for-stale-revision'
  | 'incomplete-decision-bundle'
  | 'revise-requested'
  | 'rejected'
  | 'no-observable-decision'
  | 'conflicting-active-decisions'
  | 'malformed-or-unverifiable'

export interface ReviewProjection {
  recordId: string
  revisionSha256: string
  auditSha256: string
  state: ReviewState
  /** Axes that carry a decision naming this exact revision. */
  decidedAxes: readonly ReviewAxis[]
  missingAxes: readonly ReviewAxis[]
  reviewerKinds: readonly ReviewerKind[]
  projectionDigest: string
}

const DIGEST = /^sha256:[0-9a-f]{64}$/

function digest(value: unknown): string {
  return `sha256:${createHash('sha256').update(canonicalJson(value), 'utf8').digest('hex')}`
}

/**
 * Reduces every decision about one record to a single observable state.
 *
 * Order is the point. A rejection outranks an approval because a later approval
 * does not erase a standing objection; a conflict outranks both because two
 * live opposite decisions mean nobody knows. Absence is reported as absence and
 * never as a soft pass.
 */
export function projectReviewState(input: {
  recordId: string
  revisionSha256: string
  auditSha256: string
  /** Every decision the corpora hold about this record, any revision. */
  decisions: readonly (AxisRecord & { revisionSha256: string; auditSha256?: string })[]
  withdrawn?: boolean
  supersededBy?: string | null
}): ReviewProjection {
  const base = {
    recordId: input.recordId,
    revisionSha256: input.revisionSha256,
    auditSha256: input.auditSha256,
  }
  const seal = (state: ReviewState, decided: ReviewAxis[], kinds: ReviewerKind[]): ReviewProjection => {
    const body = {
      ...base,
      state,
      decidedAxes: [...decided].sort(),
      missingAxes: REVIEW_AXES.filter((axis) => !decided.includes(axis)),
      reviewerKinds: [...new Set(kinds)].sort(),
    }
    return { ...body, projectionDigest: digest(body) }
  }

  if (!DIGEST.test(input.revisionSha256) || !DIGEST.test(input.auditSha256)) {
    return seal('malformed-or-unverifiable', [], [])
  }
  for (const decision of input.decisions) {
    if (!DIGEST.test(decision.revisionSha256) || !DIGEST.test(decision.decisionSha256)
      || !REVIEW_AXES.includes(decision.axis)) {
      return seal('malformed-or-unverifiable', [], [])
    }
  }

  // Only decisions naming this exact revision are evidence about it.
  const exact = input.decisions.filter((entry) => entry.revisionSha256 === input.revisionSha256)
  const stale = input.decisions.filter((entry) => entry.revisionSha256 !== input.revisionSha256)
  const kinds = exact.map((entry) => entry.reviewerKind)
  const decided = [...new Set(exact.map((entry) => entry.axis))]

  if (exact.length === 0) {
    // A decision exists, but about a revision that is no longer current. That
    // is materially different from never having been looked at.
    return stale.some((entry) => entry.decision === 'approve')
      ? seal('approved-only-for-stale-revision', [], [])
      : seal('no-observable-decision', [], [])
  }

  const perAxis = new Map<ReviewAxis, Set<AxisDecision>>()
  for (const entry of exact) {
    const set = perAxis.get(entry.axis) ?? new Set<AxisDecision>()
    set.add(entry.decision)
    perAxis.set(entry.axis, set)
  }
  if ([...perAxis.values()].some((set) => set.size > 1)) return seal('conflicting-active-decisions', decided, kinds)
  if (exact.some((entry) => entry.decision === 'reject')) return seal('rejected', decided, kinds)
  if (exact.some((entry) => entry.decision === 'revise')) return seal('revise-requested', decided, kinds)
  if (REVIEW_AXES.some((axis) => !perAxis.has(axis))) return seal('incomplete-decision-bundle', decided, kinds)
  return seal('approved-for-exact-revision', decided, kinds)
}

export type CohortClassification =
  | 'release-ready'
  | 'exact-revision-review-missing'
  | 'stale-review-decision'
  | 'revise-and-rereview'
  | 'rejected'
  | 'conflicting-or-malformed'
  | 'release-already-exists-observation-stale'

/**
 * The classification a record gets for the release queue.
 *
 * Release state is passed in rather than inferred: whether a record is already
 * released is a fact about the registry, and reading it back out of review
 * state or page eligibility is how the previous observation went wrong.
 */
export function classifyForRelease(
  projection: ReviewProjection,
  hasActiveRelease: boolean,
): CohortClassification {
  if (hasActiveRelease) return 'release-already-exists-observation-stale'
  switch (projection.state) {
    case 'approved-for-exact-revision': return 'release-ready'
    case 'approved-only-for-stale-revision': return 'stale-review-decision'
    case 'revise-requested': return 'revise-and-rereview'
    case 'rejected': return 'rejected'
    case 'conflicting-active-decisions':
    case 'malformed-or-unverifiable': return 'conflicting-or-malformed'
    case 'incomplete-decision-bundle':
    case 'no-observable-decision': return 'exact-revision-review-missing'
  }
}

/** Only a complete, unanimous approval of the exact revision may release. */
export function releaseAuthorized(projection: ReviewProjection): boolean {
  return projection.state === 'approved-for-exact-revision'
    && projection.missingAxes.length === 0
}
