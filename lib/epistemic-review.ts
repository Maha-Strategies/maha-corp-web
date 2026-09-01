import { createHash, randomUUID, timingSafeEqual } from 'node:crypto'

import {
  EXPERT_REVIEW_SCOPES,
  type EpistemicRecord,
  type ExpertReviewScope,
  type ReviewEvent,
} from './epistemic-schema.ts'
import { epistemicReviewTargetHash, evaluatePublicationGate, sha256Canonical } from './epistemic-publication.ts'

export const EPISTEMIC_REVIEW_VERSION = 'maha-epistemic-review/1.0' as const

export const REVIEWER_KINDS = [
  'external-expert',
  'internal-editorial',
  // Machine-generated editorial review. Kept distinct from internal-editorial
  // so a decision no person made is never counted as one they did. Its
  // assurances are declared in lib/review-tier.ts.
  'automated-internal-editorial',
  'automated-verifier',
] as const

export type ReviewerKind = (typeof REVIEWER_KINDS)[number]

export const EXPERT_CRITERION_VERDICTS = [
  'satisfied',
  'reservation',
  'unsatisfied',
  'not-qualified',
] as const

export const EXPERT_REVIEW_DECISIONS = [
  'approve',
  'approve-with-reservations',
  'request-changes',
  'abstain',
] as const

export type ExpertCriterionVerdict = (typeof EXPERT_CRITERION_VERDICTS)[number]
export type ExpertReviewDecision = (typeof EXPERT_REVIEW_DECISIONS)[number]

export interface ExpertReviewCriterionDefinition {
  id: string
  label: string
  question: string
}

export interface ExpertReviewerSnapshot {
  reviewerId: string
  profileVersion: number
  displayName: string
  qualifications: string[]
  affiliation: string | null
  identityUrl: string | null
  domains: string[]
  conflicts: string[]
  /** Explicit for new decisions; absent legacy profiles predate this distinction. */
  reviewerKind?: ReviewerKind
  /** A bounded protocol description, never a claim of expertise. */
  reviewMethod?: string
}

export interface ExpertCriterionDecision {
  criterionId: string
  verdict: ExpertCriterionVerdict
  rationale: string
}

export interface ExpertReviewInput {
  recordId: string
  domainSlug: string
  targetSha256: string
  scope: ExpertReviewScope
  reviewer: ExpertReviewerSnapshot
  criteria: ExpertCriterionDecision[]
  disagreements: string[]
  rationale: string
  supersedesReviewId: string | null
  idempotencyKey: string
}

export interface EpistemicExpertReview extends Omit<ExpertReviewInput, 'idempotencyKey'> {
  schemaVersion: typeof EPISTEMIC_REVIEW_VERSION
  reviewId: string
  decision: ExpertReviewDecision
  reviewedAt: string
  reviewSha256: string
}

export const EXPERT_REVIEW_CRITERIA: Record<ExpertReviewScope, readonly ExpertReviewCriterionDefinition[]> = {
  'source-fidelity': [
    { id: 'claim-source-alignment', label: 'Claim/source alignment', question: 'Does every claim stay within what its cited source establishes?' },
    { id: 'source-context', label: 'Source context', question: 'Are edition, date, interested-party status, and relevant context represented accurately?' },
    { id: 'transcription-and-paraphrase', label: 'Transcription and paraphrase', question: 'Are quoted or paraphrased statements faithful to the frozen source location?' },
  ],
  'domain-fidelity': [
    { id: 'terminology', label: 'Terminology', question: 'Are technical terms used consistently with the named domain and source corpus?' },
    { id: 'mechanism-and-method', label: 'Mechanism and method', question: 'Does the formalized mechanism or method preserve material conditions and exceptions?' },
    { id: 'scope-transfer', label: 'Scope transfer', question: 'Does the record avoid transferring a result across incompatible systems, scales, or traditions?' },
  ],
  'boundary-adequacy': [
    { id: 'uncertainty-and-replication', label: 'Uncertainty and replication', question: 'Are uncertainty, evidence maturity, and replication limits stated without inflation?' },
    { id: 'non-claims', label: 'Non-claims', question: 'Do the boundaries name the most likely unsupported conclusions a reader could draw?' },
    { id: 'high-stakes-use', label: 'High-stakes use', question: 'Are prohibited inferences adequate for medical, legal, financial, safety, or deterministic claims?' },
  ],
  'rights-and-locator': [
    { id: 'locator', label: 'Exact locator', question: 'Can another reviewer locate the supporting passage, table, figure, dataset, or standard clause?' },
    { id: 'rights-basis', label: 'Rights basis', question: 'Is the rights basis compatible with the text, data, and quotation actually retained?' },
    { id: 'identifier-and-version', label: 'Identifier and version', question: 'Do identifiers and versions resolve to the reviewed source rather than a mutable substitute?' },
  ],
}

const SHA256 = /^sha256:[a-f0-9]{64}$/
const RECORD_ID = /^urn:maha:record:[a-z0-9]+(?:-[a-z0-9]+)*$/
const REVIEW_ID = /^epireview_[a-f0-9]{32}$/
const REVIEWER_ID = /^expert_[a-z0-9][a-z0-9_-]{6,63}$/

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

function stringArray(value: unknown, label: string, maximumItems: number, maximumLength: number, minimumItems = 0): string[] {
  if (!Array.isArray(value) || value.length < minimumItems || value.length > maximumItems) {
    throw new Error(`${label} must contain ${minimumItems}-${maximumItems} entries.`)
  }
  const entries = value.map((entry, index) => line(entry, `${label}[${index}]`, 1, maximumLength))
  if (new Set(entries).size !== entries.length) throw new Error(`${label} cannot contain duplicates.`)
  return entries
}

function nullableLine(value: unknown, label: string, maximum: number): string | null {
  if (value === null || value === undefined || value === '') return null
  return line(value, label, 1, maximum)
}

export function parseExpertReviewerSnapshot(value: unknown): ExpertReviewerSnapshot {
  const candidate = object(value, 'reviewer')
  const reviewerId = line(candidate.reviewerId, 'reviewer.reviewerId', 8, 71)
  if (!REVIEWER_ID.test(reviewerId)) throw new Error('reviewer.reviewerId must use the expert_<stable-id> format.')
  if (!Number.isInteger(candidate.profileVersion) || Number(candidate.profileVersion) < 1) throw new Error('reviewer.profileVersion must be a positive integer.')
  const identityUrl = nullableLine(candidate.identityUrl, 'reviewer.identityUrl', 500)
  if (identityUrl && !identityUrl.startsWith('https://')) throw new Error('reviewer.identityUrl must use HTTPS.')
  const reviewerKind = candidate.reviewerKind === undefined
    ? undefined
    : line(candidate.reviewerKind, 'reviewer.reviewerKind', 8, 40) as ReviewerKind
  if (reviewerKind && !REVIEWER_KINDS.includes(reviewerKind)) throw new Error('reviewer.reviewerKind is unsupported.')
  const reviewMethod = nullableLine(candidate.reviewMethod, 'reviewer.reviewMethod', 1000)
  if ((reviewerKind === undefined) !== (reviewMethod === null)) {
    throw new Error('reviewer.reviewerKind and reviewer.reviewMethod must be supplied together.')
  }
  return {
    reviewerId,
    profileVersion: Number(candidate.profileVersion),
    displayName: line(candidate.displayName, 'reviewer.displayName', 2, 120),
    qualifications: stringArray(candidate.qualifications, 'reviewer.qualifications', 20, 500, 1),
    affiliation: nullableLine(candidate.affiliation, 'reviewer.affiliation', 200),
    identityUrl,
    domains: stringArray(candidate.domains, 'reviewer.domains', 20, 80, 1),
    conflicts: stringArray(candidate.conflicts ?? [], 'reviewer.conflicts', 20, 500),
    ...(reviewerKind ? { reviewerKind, reviewMethod: reviewMethod! } : {}),
  }
}

function parseCriteria(scope: ExpertReviewScope, value: unknown): ExpertCriterionDecision[] {
  if (!Array.isArray(value)) throw new Error('criteria must be an array.')
  const expected = EXPERT_REVIEW_CRITERIA[scope]
  if (value.length !== expected.length) throw new Error(`criteria must contain exactly ${expected.length} decisions for ${scope}.`)
  const parsed = value.map((entry, index) => {
    const candidate = object(entry, `criteria[${index}]`)
    const criterionId = line(candidate.criterionId, `criteria[${index}].criterionId`, 3, 80)
    const verdict = line(candidate.verdict, `criteria[${index}].verdict`, 3, 40) as ExpertCriterionVerdict
    if (!EXPERT_CRITERION_VERDICTS.includes(verdict)) throw new Error(`criteria[${index}].verdict is unsupported.`)
    return {
      criterionId,
      verdict,
      rationale: line(candidate.rationale, `criteria[${index}].rationale`, 10, 2000),
    }
  })
  const expectedIds = expected.map((criterion) => criterion.id).sort().join('|')
  const receivedIds = parsed.map((criterion) => criterion.criterionId).sort().join('|')
  if (expectedIds !== receivedIds) throw new Error(`criteria must use the published ${scope} criterion ids.`)
  return parsed
}

export function deriveExpertReviewDecision(criteria: readonly ExpertCriterionDecision[]): ExpertReviewDecision {
  if (criteria.some((criterion) => criterion.verdict === 'not-qualified')) return 'abstain'
  if (criteria.some((criterion) => criterion.verdict === 'unsatisfied')) return 'request-changes'
  if (criteria.some((criterion) => criterion.verdict === 'reservation')) return 'approve-with-reservations'
  return 'approve'
}

export function parseEpistemicExpertReview(value: unknown): ExpertReviewInput {
  const candidate = object(value, 'review')
  const recordId = line(candidate.recordId, 'recordId', 10, 180)
  const domainSlug = line(candidate.domainSlug, 'domainSlug', 2, 80)
  const targetSha256 = line(candidate.targetSha256, 'targetSha256', 71, 71)
  const scope = line(candidate.scope, 'scope', 3, 40) as ExpertReviewScope
  if (!RECORD_ID.test(recordId)) throw new Error('recordId must be a Maha record URN.')
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(domainSlug)) throw new Error('domainSlug is invalid.')
  if (!SHA256.test(targetSha256)) throw new Error('targetSha256 must be a SHA-256 digest.')
  if (!EXPERT_REVIEW_SCOPES.includes(scope)) throw new Error('scope is unsupported.')
  const reviewer = parseExpertReviewerSnapshot(candidate.reviewer)
  if (!reviewer.domains.includes(domainSlug)) {
    throw new Error('reviewer.domains must include the target record domain.')
  }
  if (reviewer.reviewerKind === 'automated-verifier' && !['source-fidelity', 'rights-and-locator'].includes(scope)) {
    throw new Error('An automated verifier may decide only source-fidelity or rights-and-locator.')
  }
  const supersedesReviewId = nullableLine(candidate.supersedesReviewId, 'supersedesReviewId', 42)
  if (supersedesReviewId && !REVIEW_ID.test(supersedesReviewId)) throw new Error('supersedesReviewId is invalid.')
  return {
    recordId,
    domainSlug,
    targetSha256,
    scope,
    reviewer,
    criteria: parseCriteria(scope, candidate.criteria),
    disagreements: stringArray(candidate.disagreements ?? [], 'disagreements', 20, 1000),
    rationale: line(candidate.rationale, 'rationale', 20, 4000),
    supersedesReviewId,
    idempotencyKey: line(candidate.idempotencyKey, 'idempotencyKey', 8, 160),
  }
}

export function buildEpistemicExpertReview(input: ExpertReviewInput, reviewedAt = new Date()): EpistemicExpertReview {
  if (!Number.isFinite(reviewedAt.getTime())) throw new Error('reviewedAt must be valid.')
  const unsigned = {
    schemaVersion: EPISTEMIC_REVIEW_VERSION,
    reviewId: `epireview_${randomUUID().replaceAll('-', '')}`,
    recordId: input.recordId,
    domainSlug: input.domainSlug,
    targetSha256: input.targetSha256,
    scope: input.scope,
    reviewer: input.reviewer,
    criteria: input.criteria,
    disagreements: input.disagreements,
    rationale: input.rationale,
    supersedesReviewId: input.supersedesReviewId,
    decision: deriveExpertReviewDecision(input.criteria),
    reviewedAt: reviewedAt.toISOString(),
  }
  return { ...unsigned, reviewSha256: sha256Canonical(unsigned) }
}

export function expertReviewEvent(review: EpistemicExpertReview): ReviewEvent {
  return {
    reviewId: review.reviewId,
    reviewerId: review.reviewer.reviewerId,
    reviewerProfileVersion: review.reviewer.profileVersion,
    reviewerRole: review.reviewer.qualifications.join('; '),
    reviewerKind: review.reviewer.reviewerKind,
    reviewMethod: review.reviewer.reviewMethod,
    scope: review.scope,
    targetSha256: review.targetSha256,
    reviewedAt: review.reviewedAt,
    verdict: review.decision === 'approve' ? 'approve' : review.decision === 'abstain' ? 'abstain' : 'request-changes',
    rationale: review.rationale,
    supersedesReviewId: review.supersedesReviewId,
  }
}

export function applyExpertReviews(record: EpistemicRecord, reviews: readonly EpistemicExpertReview[]): EpistemicRecord {
  const relevant = reviews
    .filter((review) => review.recordId === record.id)
    .sort((left, right) => left.reviewedAt.localeCompare(right.reviewedAt))
  return {
    ...record,
    publication: {
      ...record.publication,
      reviewEvents: [
        ...record.publication.reviewEvents.filter((event) => !event.scope),
        ...relevant.map(expertReviewEvent),
      ],
      lastReviewedAt: relevant.at(-1)?.reviewedAt ?? record.publication.lastReviewedAt,
    },
  }
}

export function buildExpertReviewProgress(record: EpistemicRecord, reviews: readonly EpistemicExpertReview[]) {
  const reviewed = applyExpertReviews(record, reviews)
  const targetSha256 = epistemicReviewTargetHash(record)
  const scopes = Object.fromEntries((record.publication.requiredReviewScopes ?? []).map((scope) => {
    const latest = reviewed.publication.reviewEvents
      .filter((event) => event.scope === scope)
      .sort((left, right) => left.reviewedAt.localeCompare(right.reviewedAt))
      .at(-1)
    const status = !latest
      ? 'missing'
      : latest.targetSha256 !== targetSha256
        ? 'stale'
        : latest.verdict === 'approve'
          ? 'approved'
          : latest.verdict === 'abstain'
            ? 'abstained'
            : 'changes-requested'
    return [scope, { status, latestReviewId: latest?.reviewId ?? null, reviewedAt: latest?.reviewedAt ?? null }]
  }))
  return { targetSha256, scopes, publicationDecision: evaluatePublicationGate(reviewed) }
}

export function expertReviewProfileHash(reviewer: ExpertReviewerSnapshot): string {
  return sha256Canonical(reviewer)
}

export function epistemicOperationsHash(value: string): string {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`
}

export function authorizeEpistemicOperations(request: Request): { authorized: boolean; actorFingerprint?: string } {
  const configured = process.env.EPISTEMIC_OPERATIONS_TOKEN
  const presented = request.headers.get('authorization')?.replace(/^Bearer\s+/, '')
  if (!configured || Buffer.byteLength(configured) < 32 || !presented) return { authorized: false }
  const expected = Buffer.from(configured)
  const actual = Buffer.from(presented)
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return { authorized: false }
  return { authorized: true, actorFingerprint: epistemicOperationsHash(configured) }
}

export const EPISTEMIC_EXPERT_REVIEW_BOUNDARY = 'A scoped review binds one versioned identity, one declared method, one scope, and one frozen content hash. Automated verification, internal editorial review, and external expert review remain distinct; none establishes empirical truth or transfers authority beyond the declared method.'
