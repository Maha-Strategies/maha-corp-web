import { createHash, randomUUID, timingSafeEqual } from 'node:crypto'

import {
  applyExpertReviews,
  expertReviewEvent,
  type EpistemicExpertReview,
} from './epistemic-review.ts'
import {
  EXPERT_REVIEW_SCOPES,
  type EpistemicRecord,
  type ExpertReviewScope,
  type PublicationDecision,
} from './epistemic-schema.ts'
import {
  buildProvenanceBundle,
  epistemicRecordPath,
  epistemicReviewTargetHash,
  evaluatePublicationGate,
  sha256Canonical,
} from './epistemic-publication.ts'

export const EPISTEMIC_RELEASE_VERSION = 'maha-epistemic-release/1.0' as const
export const EPISTEMIC_WITHDRAWAL_VERSION = 'maha-epistemic-withdrawal/1.0' as const

export const REVIEW_ASSURANCE_TIERS = [
  'internally-reviewed-canonical',
  'expert-reviewed-canonical',
  'mixed-review-canonical',
  // Every approval came from a machine. Named separately so it cannot be read
  // as the internally-reviewed tier, which implies a person.
  'automated-internal-review-canonical',
  'legacy-review-unclassified',
] as const
export type ReviewAssuranceTier = (typeof REVIEW_ASSURANCE_TIERS)[number]

export interface ReleaseAuthoritySnapshot {
  authorityId: string
  displayName: string
  role: string
  authorizationBasis: string
  publicAttribution: boolean
}

export interface CanonicalReleaseInput {
  operation: 'preview' | 'publish'
  recordId: string
  targetSha256: string
  canonicalVersion: string
  supersedesReleaseId: string | null
  authority: ReleaseAuthoritySnapshot
  publicChangeSummary: string
  rationale: string
  idempotencyKey: string
}

export interface ReleaseWithdrawalInput {
  operation: 'withdraw'
  releaseId: string
  authority: ReleaseAuthoritySnapshot
  publicChangeSummary: string
  rationale: string
  idempotencyKey: string
}

export type EpistemicReleaseRequest = CanonicalReleaseInput | ReleaseWithdrawalInput

export interface ScopedReleaseApproval {
  scope: ExpertReviewScope
  reviewId: string
  reviewSha256: string
  reviewedAt: string
  reviewerKind?: 'external-expert' | 'internal-editorial' | 'automated-internal-editorial' | 'automated-verifier'
  reviewMethod?: string
}

export interface EpistemicCanonicalRelease {
  schemaVersion: typeof EPISTEMIC_RELEASE_VERSION
  releaseId: string
  releaseKind: 'initial' | 'superseding'
  recordId: string
  domainSlug: string
  targetSha256: string
  canonicalPath: string
  canonicalVersion: string
  supersedesReleaseId: string | null
  approvals: ScopedReleaseApproval[]
  /** Review provenance, not a claim that the record is true or independently reproduced. */
  assuranceTier?: ReviewAssuranceTier
  authority: ReleaseAuthoritySnapshot
  authoritySha256: string
  publicChangeSummary: string
  rationale: string
  recordSha256: string
  recordSnapshot: EpistemicRecord
  gateDecision: PublicationDecision
  releasedAt: string
  releaseSha256: string
}

export function reviewAssuranceTier(approvals: readonly ScopedReleaseApproval[]): ReviewAssuranceTier {
  const kinds = new Set(approvals.map((approval) => approval.reviewerKind))
  if (kinds.has(undefined)) return 'legacy-review-unclassified'
  if (kinds.size === 1 && kinds.has('external-expert')) return 'expert-reviewed-canonical'
  if (kinds.size === 1 && kinds.has('internal-editorial')) return 'internally-reviewed-canonical'
  // Its own tier, not the internal-editorial one: a reader who sees
  // "internally reviewed" is entitled to assume a person was involved.
  if (kinds.size === 1 && kinds.has('automated-internal-editorial')) return 'automated-internal-review-canonical'
  return 'mixed-review-canonical'
}

export interface EpistemicReleaseWithdrawal {
  schemaVersion: typeof EPISTEMIC_WITHDRAWAL_VERSION
  withdrawalId: string
  releaseId: string
  recordId: string
  canonicalPath: string
  authority: ReleaseAuthoritySnapshot
  authoritySha256: string
  publicChangeSummary: string
  rationale: string
  withdrawnAt: string
  withdrawalSha256: string
}

export interface FrozenReleaseTarget {
  recordId: string
  targetSha256: string
  candidateSnapshot: EpistemicRecord
}

export type EpistemicReleaseStatus = 'active' | 'superseded' | 'withdrawn'

const SHA256 = /^sha256:[a-f0-9]{64}$/
const RECORD_ID = /^urn:maha:record:[a-z0-9]+(?:-[a-z0-9]+)*$/
const RELEASE_ID = /^epirelease_[a-f0-9]{32}$/
const AUTHORITY_ID = /^authority_[a-z0-9][a-z0-9_-]{6,63}$/
const CANONICAL_VERSION = /^[a-z0-9][a-z0-9._-]{0,63}$/

function object(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} must be an object.`)
  return value as Record<string, unknown>
}

function line(value: unknown, label: string, minimum: number, maximum: number): string {
  if (typeof value !== 'string') throw new Error(`${label} must be a string.`)
  const normalized = value.trim()
  if (normalized.length < minimum || normalized.length > maximum) throw new Error(`${label} must contain ${minimum}-${maximum} characters.`)
  return normalized
}

function parseAuthority(value: unknown): ReleaseAuthoritySnapshot {
  const authority = object(value, 'authority')
  const authorityId = line(authority.authorityId, 'authority.authorityId', 17, 74)
  if (!AUTHORITY_ID.test(authorityId)) throw new Error('authority.authorityId is invalid.')
  if (typeof authority.publicAttribution !== 'boolean') throw new Error('authority.publicAttribution must be boolean.')
  return {
    authorityId,
    displayName: line(authority.displayName, 'authority.displayName', 2, 120),
    role: line(authority.role, 'authority.role', 3, 160),
    authorizationBasis: line(authority.authorizationBasis, 'authority.authorizationBasis', 20, 1000),
    publicAttribution: authority.publicAttribution,
  }
}

export function parseEpistemicReleaseRequest(value: unknown): EpistemicReleaseRequest {
  const candidate = object(value, 'epistemic release request')
  const operation = line(candidate.operation, 'operation', 7, 8)
  const authority = parseAuthority(candidate.authority)
  const publicChangeSummary = line(candidate.publicChangeSummary, 'publicChangeSummary', 20, 500)
  const rationale = line(candidate.rationale, 'rationale', 40, 4000)
  const idempotencyKey = line(candidate.idempotencyKey, 'idempotencyKey', 8, 160)
  if (operation === 'withdraw') {
    const releaseId = line(candidate.releaseId, 'releaseId', 43, 43)
    if (!RELEASE_ID.test(releaseId)) throw new Error('releaseId is invalid.')
    return { operation, releaseId, authority, publicChangeSummary, rationale, idempotencyKey }
  }
  if (operation !== 'preview' && operation !== 'publish') throw new Error('operation must be preview, publish, or withdraw.')
  const recordId = line(candidate.recordId, 'recordId', 10, 180)
  const targetSha256 = line(candidate.targetSha256, 'targetSha256', 71, 71)
  const canonicalVersion = line(candidate.canonicalVersion, 'canonicalVersion', 1, 64)
  if (!RECORD_ID.test(recordId)) throw new Error('recordId must be a Maha record URN.')
  if (!SHA256.test(targetSha256)) throw new Error('targetSha256 must be a SHA-256 digest.')
  if (!CANONICAL_VERSION.test(canonicalVersion)) throw new Error('canonicalVersion is invalid.')
  const supersedesReleaseId = candidate.supersedesReleaseId === null || candidate.supersedesReleaseId === undefined
    ? null
    : line(candidate.supersedesReleaseId, 'supersedesReleaseId', 43, 43)
  if (supersedesReleaseId && !RELEASE_ID.test(supersedesReleaseId)) throw new Error('supersedesReleaseId is invalid.')
  return { operation, recordId, targetSha256, canonicalVersion, supersedesReleaseId, authority, publicChangeSummary, rationale, idempotencyKey }
}

function latestScopedReviews(
  record: EpistemicRecord,
  targetSha256: string,
  reviews: readonly EpistemicExpertReview[],
): Map<ExpertReviewScope, EpistemicExpertReview> {
  const latest = new Map<ExpertReviewScope, EpistemicExpertReview>()
  for (const review of reviews
    .filter((entry) => entry.recordId === record.id && entry.targetSha256 === targetSha256)
    .sort((left, right) => left.reviewedAt.localeCompare(right.reviewedAt))) {
    latest.set(review.scope, review)
  }
  return latest
}

export function releaseReadiness(
  target: FrozenReleaseTarget,
  reviews: readonly EpistemicExpertReview[],
  at = new Date(),
): { ready: boolean; approvals: ScopedReleaseApproval[]; decision: PublicationDecision } {
  if (!Number.isFinite(at.getTime())) throw new Error('at must be valid.')
  if (target.recordId !== target.candidateSnapshot.id || epistemicReviewTargetHash(target.candidateSnapshot) !== target.targetSha256) {
    throw new Error('The frozen release target does not match its record or digest.')
  }
  const latest = latestScopedReviews(target.candidateSnapshot, target.targetSha256, reviews)
  const approvals = (target.candidateSnapshot.publication.requiredReviewScopes ?? EXPERT_REVIEW_SCOPES).flatMap((scope) => {
    const review = latest.get(scope)
    return review?.decision === 'approve'
      ? [{ scope, reviewId: review.reviewId, reviewSha256: review.reviewSha256, reviewedAt: review.reviewedAt, reviewerKind: review.reviewer.reviewerKind, reviewMethod: review.reviewer.reviewMethod }]
      : []
  })
  const reviewed = applyExpertReviews(target.candidateSnapshot, [...latest.values()])
  const releaseCandidate: EpistemicRecord = {
    ...reviewed,
    publication: {
      ...reviewed.publication,
      requestedPublicPromotion: true,
      reviewState: 'published-canonical',
      canonicalVersion: 'readiness-preview',
      publishedAt: at.toISOString().slice(0, 10),
      lastReviewedAt: at.toISOString(),
    },
  }
  const decision = evaluatePublicationGate(releaseCandidate)
  return { ready: decision.publicEligible, approvals, decision }
}

export function buildEpistemicCanonicalRelease(
  input: CanonicalReleaseInput,
  target: FrozenReleaseTarget,
  reviews: readonly EpistemicExpertReview[],
  previousActiveRelease: Pick<EpistemicCanonicalRelease, 'recordId' | 'releaseId' | 'targetSha256'> | null,
  releasedAt = new Date(),
): EpistemicCanonicalRelease {
  if (!Number.isFinite(releasedAt.getTime())) throw new Error('releasedAt must be valid.')
  if (target.recordId !== input.recordId || target.targetSha256 !== input.targetSha256) {
    throw new Error('The release request does not match the selected frozen target.')
  }
  if (target.candidateSnapshot.id !== input.recordId || epistemicReviewTargetHash(target.candidateSnapshot) !== input.targetSha256) {
    throw new Error('The frozen candidate does not match the release target digest.')
  }
  if (previousActiveRelease) {
    if (previousActiveRelease.recordId !== input.recordId || input.supersedesReleaseId !== previousActiveRelease.releaseId) {
      throw new Error('A new canonical version must explicitly supersede the active release for this record.')
    }
    if (previousActiveRelease.targetSha256 === input.targetSha256) throw new Error('A superseding release must bind a new frozen target digest.')
  } else if (input.supersedesReleaseId) {
    throw new Error('An initial release cannot supersede an unknown canonical release.')
  }

  const latest = latestScopedReviews(target.candidateSnapshot, input.targetSha256, reviews)
  const requiredScopes = target.candidateSnapshot.publication.requiredReviewScopes ?? EXPERT_REVIEW_SCOPES
  const selectedReviews = requiredScopes.map((scope) => {
    const review = latest.get(scope)
    if (!review) throw new Error(`The ${scope} approval is missing for this exact target.`)
    if (review.decision !== 'approve') throw new Error(`The latest ${scope} decision is not an unqualified approval.`)
    return review
  })
  if (new Set(selectedReviews.map((review) => review.reviewId)).size !== requiredScopes.length) {
    throw new Error('Every required review scope must bind a distinct review decision.')
  }

  const reviewed = applyExpertReviews(target.candidateSnapshot, selectedReviews)
  const releasedAtIso = releasedAt.toISOString()
  const recordSnapshot: EpistemicRecord = {
    ...reviewed,
    publication: {
      ...reviewed.publication,
      requestedPublicPromotion: true,
      reviewState: 'published-canonical',
      canonicalVersion: input.canonicalVersion,
      publishedAt: releasedAtIso.slice(0, 10),
      lastReviewedAt: releasedAtIso,
      reviewEvents: selectedReviews.map(expertReviewEvent),
    },
  }
  if (epistemicReviewTargetHash(recordSnapshot) !== input.targetSha256) {
    throw new Error('Release assembly changed the frozen review target.')
  }
  const gateDecision = evaluatePublicationGate(recordSnapshot)
  if (!gateDecision.publicEligible) throw new Error(`The target cannot be released: ${gateDecision.reasons.join(', ')}.`)
  const authoritySha256 = sha256Canonical(input.authority)
  const approvals = selectedReviews.map((review) => ({
    scope: review.scope,
    reviewId: review.reviewId,
    reviewSha256: review.reviewSha256,
    reviewedAt: review.reviewedAt,
    reviewerKind: review.reviewer.reviewerKind,
    reviewMethod: review.reviewer.reviewMethod,
  })).sort((left, right) => left.scope.localeCompare(right.scope))
  const unsigned = {
    schemaVersion: EPISTEMIC_RELEASE_VERSION,
    releaseId: `epirelease_${randomUUID().replaceAll('-', '')}`,
    releaseKind: previousActiveRelease ? 'superseding' as const : 'initial' as const,
    recordId: input.recordId,
    domainSlug: recordSnapshot.domainSlug,
    targetSha256: input.targetSha256,
    canonicalPath: epistemicRecordPath(recordSnapshot),
    canonicalVersion: input.canonicalVersion,
    supersedesReleaseId: previousActiveRelease?.releaseId ?? null,
    approvals,
    assuranceTier: reviewAssuranceTier(approvals),
    authority: input.authority,
    authoritySha256,
    publicChangeSummary: input.publicChangeSummary,
    rationale: input.rationale,
    recordSha256: sha256Canonical(recordSnapshot),
    recordSnapshot,
    gateDecision,
    releasedAt: releasedAtIso,
  }
  return { ...unsigned, releaseSha256: sha256Canonical(unsigned) }
}

export function buildEpistemicReleaseWithdrawal(
  input: ReleaseWithdrawalInput,
  activeRelease: EpistemicCanonicalRelease,
  withdrawnAt = new Date(),
): EpistemicReleaseWithdrawal {
  if (!Number.isFinite(withdrawnAt.getTime())) throw new Error('withdrawnAt must be valid.')
  if (input.releaseId !== activeRelease.releaseId) throw new Error('Withdrawal must identify the active canonical release.')
  const unsigned = {
    schemaVersion: EPISTEMIC_WITHDRAWAL_VERSION,
    withdrawalId: `epiwithdraw_${randomUUID().replaceAll('-', '')}`,
    releaseId: activeRelease.releaseId,
    recordId: activeRelease.recordId,
    canonicalPath: activeRelease.canonicalPath,
    authority: input.authority,
    authoritySha256: sha256Canonical(input.authority),
    publicChangeSummary: input.publicChangeSummary,
    rationale: input.rationale,
    withdrawnAt: withdrawnAt.toISOString(),
  }
  return { ...unsigned, withdrawalSha256: sha256Canonical(unsigned) }
}

export function epistemicReleaseStatus(
  release: EpistemicCanonicalRelease,
  releases: readonly EpistemicCanonicalRelease[],
  withdrawals: readonly EpistemicReleaseWithdrawal[],
): EpistemicReleaseStatus {
  if (withdrawals.some((withdrawal) => withdrawal.releaseId === release.releaseId)) return 'withdrawn'
  if (releases.some((candidate) => candidate.supersedesReleaseId === release.releaseId)) return 'superseded'
  return 'active'
}

export function activeEpistemicReleases(
  releases: readonly EpistemicCanonicalRelease[],
  withdrawals: readonly EpistemicReleaseWithdrawal[],
): EpistemicCanonicalRelease[] {
  return releases.filter((release) => epistemicReleaseStatus(release, releases, withdrawals) === 'active')
}

export function sanitizedEpistemicRelease(
  release: EpistemicCanonicalRelease,
  releases: readonly EpistemicCanonicalRelease[],
  withdrawals: readonly EpistemicReleaseWithdrawal[],
) {
  const status = epistemicReleaseStatus(release, releases, withdrawals)
  const withdrawal = withdrawals.find((entry) => entry.releaseId === release.releaseId)
  return {
    schemaVersion: release.schemaVersion,
    releaseId: release.releaseId,
    releaseKind: release.releaseKind,
    status,
    recordId: release.recordId,
    domainSlug: release.domainSlug,
    targetSha256: release.targetSha256,
    canonicalPath: release.canonicalPath,
    canonicalVersion: release.canonicalVersion,
    supersedesReleaseId: release.supersedesReleaseId,
    approvals: release.approvals.map(({ scope, reviewId, reviewSha256, reviewedAt, reviewerKind, reviewMethod }) => ({ scope, reviewId, reviewSha256, reviewedAt, reviewerKind, reviewMethod })),
    assuranceTier: release.assuranceTier ?? reviewAssuranceTier(release.approvals),
    releaseAuthority: release.authority.publicAttribution
      ? { authorityId: release.authority.authorityId, displayName: release.authority.displayName, role: release.authority.role }
      : { authoritySha256: release.authoritySha256, attribution: 'withheld-by-consent' as const },
    publicChangeSummary: release.publicChangeSummary,
    recordSha256: release.recordSha256,
    gateDecision: release.gateDecision,
    releasedAt: release.releasedAt,
    releaseSha256: release.releaseSha256,
    withdrawal: withdrawal ? { withdrawalId: withdrawal.withdrawalId, publicChangeSummary: withdrawal.publicChangeSummary, withdrawnAt: withdrawal.withdrawnAt, withdrawalSha256: withdrawal.withdrawalSha256 } : null,
  }
}

export function publicEpistemicReleaseProvenance(
  release: EpistemicCanonicalRelease,
  releases: readonly EpistemicCanonicalRelease[],
  withdrawals: readonly EpistemicReleaseWithdrawal[],
) {
  const provenance = buildProvenanceBundle(release.recordSnapshot)
  return {
    release: sanitizedEpistemicRelease(release, releases, withdrawals),
    provenance: {
      ...provenance,
      reviewEvents: provenance.reviewEvents.map((event) => ({
        reviewId: event.reviewId,
        scope: event.scope,
        targetSha256: event.targetSha256,
        reviewedAt: event.reviewedAt,
        verdict: event.verdict,
        supersedesReviewId: event.supersedesReviewId ?? null,
      })),
    },
    privacyBoundary: 'Operational actor fingerprints, bearer credentials, private reviewer profiles, affiliations, conflicts, and non-consented authority identity fields are excluded.',
  }
}

function releaseTokenHash(value: string): string {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`
}

export function authorizeEpistemicReleaseAuthority(request: Request): { authorized: boolean; actorFingerprint?: string } {
  const configured = process.env.EPISTEMIC_RELEASE_AUTHORITY_TOKEN
  const operations = process.env.EPISTEMIC_OPERATIONS_TOKEN
  const presented = request.headers.get('authorization')?.replace(/^Bearer\s+/, '')
  if (!configured || Buffer.byteLength(configured) < 32 || configured === operations || !presented) return { authorized: false }
  const expected = Buffer.from(configured)
  const actual = Buffer.from(presented)
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return { authorized: false }
  return { authorized: true, actorFingerprint: releaseTokenHash(configured) }
}

export const EPISTEMIC_RELEASE_BOUNDARY = 'A canonical release requires unqualified, method-declared decisions for every required scope on one exact target hash plus a separately authenticated human release authority. Internal editorial review is a valid, explicitly labelled publication tier; external expert review remains an optional higher assurance tier. Neither review tier nor release authority establishes empirical truth or independent reproduction.'
