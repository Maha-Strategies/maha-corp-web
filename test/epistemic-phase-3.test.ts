import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

import { ADAPTED_EPISTEMIC_CANDIDATES } from '../lib/epistemic-adapters.ts'
import {
  EXPERT_REVIEW_CRITERIA,
  buildEpistemicExpertReview,
  parseEpistemicExpertReview,
  type EpistemicExpertReview,
} from '../lib/epistemic-review.ts'
import {
  activeEpistemicReleases,
  authorizeEpistemicReleaseAuthority,
  buildEpistemicCanonicalRelease,
  buildEpistemicReleaseWithdrawal,
  epistemicReleaseStatus,
  parseEpistemicReleaseRequest,
  publicEpistemicReleaseProvenance,
  releaseReadiness,
  sanitizedEpistemicRelease,
  type CanonicalReleaseInput,
  type EpistemicCanonicalRelease,
  type ReleaseAuthoritySnapshot,
} from '../lib/epistemic-release.ts'
import { EXPERT_REVIEW_SCOPES, type EpistemicRecord, type ExpertReviewScope } from '../lib/epistemic-schema.ts'
import { epistemicReviewTargetHash, evaluatePublicationGate } from '../lib/epistemic-publication.ts'

const root = new URL('../', import.meta.url)

function cleanCandidate(summarySuffix = ''): EpistemicRecord {
  const imported = ADAPTED_EPISTEMIC_CANDIDATES.find((candidate) => candidate.adapterId === 'mathematics')!.record
  return {
    ...structuredClone(imported),
    summary: `${imported.summary}${summarySuffix}`,
    claims: imported.claims.map((claim) => ({ ...claim, evidenceMaturity: 'single-study' })),
    sources: imported.sources.map((source) => ({
      ...source,
      publishedAt: '2026-01-01',
      exactLocator: 'Reviewed source section and stable URL anchor.',
    })),
    publication: {
      ...imported.publication,
      requestedPublicPromotion: false,
      reviewState: 'draft',
      publishedAt: undefined,
      reviewEvents: [],
    },
  }
}

function reviewsFor(record: EpistemicRecord, minuteOffset = 0): EpistemicExpertReview[] {
  const targetSha256 = epistemicReviewTargetHash(record)
  return EXPERT_REVIEW_SCOPES.map((scope, index) => buildEpistemicExpertReview(parseEpistemicExpertReview({
    recordId: record.id,
    domainSlug: record.domainSlug,
    targetSha256,
    scope,
    reviewer: {
      reviewerId: 'expert_mathematics-reviewer',
      profileVersion: 1,
      displayName: 'Mathematics Reviewer',
      qualifications: ['Graduate training and publication experience in the reviewed mathematical method.'],
      affiliation: null,
      identityUrl: 'https://example.org/reviewers/mathematics-reviewer',
      domains: [record.domainSlug],
      conflicts: [],
    },
    criteria: EXPERT_REVIEW_CRITERIA[scope].map((criterion) => ({
      criterionId: criterion.id,
      verdict: 'satisfied',
      rationale: 'The exact frozen target satisfies this limited review criterion.',
    })),
    disagreements: [],
    rationale: 'This unqualified decision is limited to one scope and the exact frozen target digest.',
    supersedesReviewId: null,
    idempotencyKey: `phase3-review-${scope}-${minuteOffset}`,
  }), new Date(`2026-08-24T19:${String(minuteOffset + index).padStart(2, '0')}:00.000Z`)))
}

const authority: ReleaseAuthoritySnapshot = {
  authorityId: 'authority_maha-release',
  displayName: 'Maha Release Authority',
  role: 'Canonical knowledge release authority',
  authorizationBasis: 'Explicit human authority to decide the public state of reviewed Maha Knowledge records.',
  publicAttribution: false,
}

function input(record: EpistemicRecord, version = '1.0', supersedesReleaseId: string | null = null): CanonicalReleaseInput {
  return parseEpistemicReleaseRequest({
    operation: 'publish',
    recordId: record.id,
    targetSha256: epistemicReviewTargetHash(record),
    canonicalVersion: version,
    supersedesReleaseId,
    authority,
    publicChangeSummary: 'Initial canonical publication after exact-hash scoped review.',
    rationale: 'Every required scope approved this exact hash, and the human authority authorizes canonical publication within the declared boundaries.',
    idempotencyKey: `phase3-release-${version}`,
  }) as CanonicalReleaseInput
}

function initialRelease(): { record: EpistemicRecord; reviews: EpistemicExpertReview[]; release: EpistemicCanonicalRelease } {
  const record = cleanCandidate()
  const reviews = reviewsFor(record)
  const release = buildEpistemicCanonicalRelease(input(record), {
    recordId: record.id,
    targetSha256: epistemicReviewTargetHash(record),
    candidateSnapshot: record,
  }, reviews, null, new Date('2026-08-24T20:00:00.000Z'))
  return { record, reviews, release }
}

test('Phase 3 compiles one exact reviewed hash into an eligible canonical release', () => {
  const { record, reviews, release } = initialRelease()
  assert.equal(release.releaseKind, 'initial')
  assert.equal(release.approvals.length, EXPERT_REVIEW_SCOPES.length)
  assert.equal(new Set(release.approvals.map((approval) => approval.reviewId)).size, EXPERT_REVIEW_SCOPES.length)
  assert.equal(release.recordSnapshot.publication.reviewState, 'published-canonical')
  assert.equal(release.recordSnapshot.publication.requestedPublicPromotion, true)
  assert.equal(release.recordSnapshot.publication.canonicalVersion, '1.0')
  assert.equal(epistemicReviewTargetHash(release.recordSnapshot), epistemicReviewTargetHash(record))
  assert.equal(evaluatePublicationGate(release.recordSnapshot).publicEligible, true)
  assert.equal(releaseReadiness({ recordId: record.id, targetSha256: epistemicReviewTargetHash(record), candidateSnapshot: record }, reviews).ready, true)
  assert.match(release.releaseSha256, /^sha256:[a-f0-9]{64}$/)
})

test('missing, reserved, stale, or mismatched scope decisions fail closed', () => {
  const record = cleanCandidate()
  const reviews = reviewsFor(record)
  const target = { recordId: record.id, targetSha256: epistemicReviewTargetHash(record), candidateSnapshot: record }
  assert.throws(() => buildEpistemicCanonicalRelease(input(record), target, reviews.slice(1), null), /approval is missing/)

  const scope: ExpertReviewScope = 'source-fidelity'
  const reservedInput = parseEpistemicExpertReview({
    recordId: record.id,
    domainSlug: record.domainSlug,
    targetSha256: target.targetSha256,
    scope,
    reviewer: reviews[0].reviewer,
    criteria: EXPERT_REVIEW_CRITERIA[scope].map((criterion, index) => ({ criterionId: criterion.id, verdict: index === 0 ? 'reservation' : 'satisfied', rationale: 'The reviewer records the exact criterion result and its bounded rationale.' })),
    disagreements: ['One criterion remains reserved and therefore cannot silently become approval.'],
    rationale: 'This decision records a material reservation and cannot authorize canonical publication.',
    supersedesReviewId: reviews[0].reviewId,
    idempotencyKey: 'phase3-reserved-review',
  })
  const reserved = buildEpistemicExpertReview(reservedInput, new Date('2026-08-24T20:30:00.000Z'))
  assert.throws(() => buildEpistemicCanonicalRelease(input(record), target, [...reviews, reserved], null), /not an unqualified approval/)

  const changed = cleanCandidate(' Material revision.')
  assert.throws(() => buildEpistemicCanonicalRelease(input(changed), { recordId: changed.id, targetSha256: epistemicReviewTargetHash(changed), candidateSnapshot: changed }, reviews, null), /approval is missing/)
})

test('supersession requires the active release and a materially new target', () => {
  const { release: first } = initialRelease()
  const changed = cleanCandidate(' Material revision with new evidence.')
  const changedReviews = reviewsFor(changed, 10)
  const target = { recordId: changed.id, targetSha256: epistemicReviewTargetHash(changed), candidateSnapshot: changed }
  const second = buildEpistemicCanonicalRelease(input(changed, '2.0', first.releaseId), target, changedReviews, first, new Date('2026-08-24T21:00:00.000Z'))
  assert.equal(second.releaseKind, 'superseding')
  assert.equal(second.supersedesReleaseId, first.releaseId)
  assert.equal(epistemicReleaseStatus(first, [first, second], []), 'superseded')
  assert.equal(epistemicReleaseStatus(second, [first, second], []), 'active')
  assert.throws(() => buildEpistemicCanonicalRelease(input(changed, '2.1', null), target, changedReviews, first), /explicitly supersede/)
  assert.throws(() => buildEpistemicCanonicalRelease(input(first.recordSnapshot, '1.1', first.releaseId), { recordId: first.recordId, targetSha256: first.targetSha256, candidateSnapshot: first.recordSnapshot }, reviewsFor(first.recordSnapshot), first), /new frozen target digest/)
})

test('withdrawal removes the active projection without erasing public history', () => {
  const { release } = initialRelease()
  const parsed = parseEpistemicReleaseRequest({
    operation: 'withdraw',
    releaseId: release.releaseId,
    authority,
    publicChangeSummary: 'Withdrawn while a material provenance concern returns through review.',
    rationale: 'A material provenance concern requires immediate withdrawal while the corrected target returns through review.',
    idempotencyKey: 'phase3-withdrawal-001',
  })
  assert.equal(parsed.operation, 'withdraw')
  if (parsed.operation !== 'withdraw') throw new Error('Expected withdrawal input.')
  const withdrawal = buildEpistemicReleaseWithdrawal(parsed, release, new Date('2026-08-24T22:00:00.000Z'))
  assert.equal(activeEpistemicReleases([release], [withdrawal]).length, 0)
  assert.equal(epistemicReleaseStatus(release, [release], [withdrawal]), 'withdrawn')
  const publicRelease = sanitizedEpistemicRelease(release, [release], [withdrawal])
  assert.equal(publicRelease.status, 'withdrawn')
  assert.deepEqual(publicRelease.releaseAuthority, { authoritySha256: release.authoritySha256, attribution: 'withheld-by-consent' })
  assert.equal('displayName' in publicRelease.releaseAuthority, false)
  const provenance = publicEpistemicReleaseProvenance(release, [release], [withdrawal])
  assert.match(provenance.privacyBoundary, /private reviewer profiles/)
  assert.equal(JSON.stringify(provenance).includes('Mathematics Reviewer'), false)
  assert.equal(JSON.stringify(provenance).includes(release.rationale), false)
})

test('release authority rejects the operations credential and shared secrets', () => {
  const previousRelease = process.env.EPISTEMIC_RELEASE_AUTHORITY_TOKEN
  const previousOperations = process.env.EPISTEMIC_OPERATIONS_TOKEN
  try {
    process.env.EPISTEMIC_RELEASE_AUTHORITY_TOKEN = 'r'.repeat(64)
    process.env.EPISTEMIC_OPERATIONS_TOKEN = 'o'.repeat(64)
    assert.equal(authorizeEpistemicReleaseAuthority(new Request('https://example.test', { headers: { authorization: `Bearer ${'r'.repeat(64)}` } })).authorized, true)
    assert.equal(authorizeEpistemicReleaseAuthority(new Request('https://example.test', { headers: { authorization: `Bearer ${'o'.repeat(64)}` } })).authorized, false)
    process.env.EPISTEMIC_OPERATIONS_TOKEN = 'r'.repeat(64)
    assert.equal(authorizeEpistemicReleaseAuthority(new Request('https://example.test', { headers: { authorization: `Bearer ${'r'.repeat(64)}` } })).authorized, false)
  } finally {
    if (previousRelease === undefined) delete process.env.EPISTEMIC_RELEASE_AUTHORITY_TOKEN
    else process.env.EPISTEMIC_RELEASE_AUTHORITY_TOKEN = previousRelease
    if (previousOperations === undefined) delete process.env.EPISTEMIC_OPERATIONS_TOKEN
    else process.env.EPISTEMIC_OPERATIONS_TOKEN = previousOperations
  }
})

test('Phase 3 persistence and public projection preserve the human boundary', async () => {
  const [sql, route, page, publicLedger, publicRegistry, publicProvenance, docs, method, sitemap, store, openApi] = await Promise.all([
    'supabase/migrations/20260824190000_epistemic_canonical_release_control.sql',
    'app/api/admin/epistemic-releases/route.ts',
    'app/admin/epistemic-releases/page.tsx',
    'app/knowledge/epistemic-system/releases/page.tsx',
    'app/knowledge/epistemic-system/releases/registry.json/route.ts',
    'app/knowledge/epistemic-system/releases/[releaseId]/provenance.json/route.ts',
    'docs/epistemic-ingestion-and-review.md',
    'app/knowledge/epistemic-system/page.tsx',
    'app/sitemap.ts',
    'lib/epistemic-store.ts',
    'test/openapi-docs.test.ts',
  ].map((path) => readFile(new URL(path, root), 'utf8')))
  assert.match(sql, /epistemic_canonical_releases/)
  assert.match(sql, /epistemic_release_withdrawals/)
  assert.match(sql, /record_epistemic_canonical_release/)
  assert.match(sql, /record_epistemic_release_withdrawal/)
  assert.match(sql, /reject_epistemic_ledger_mutation/)
  assert.match(sql, /revoke insert, update, delete, truncate/)
  assert.match(sql, /latest frozen target/)
  assert.match(route, /authorizeEpistemicReleaseAuthority/)
  assert.match(route, /autonomousPublicationSupported: false/)
  assert.doesNotMatch(route, /authorizeEpistemicOperations/)
  assert.match(page, /authorized human release authority/)
  assert.match(page, /never written to browser storage/)
  assert.match(publicLedger, /Publication creates history/)
  assert.match(publicRegistry, /getPublicEpistemicReleaseRegistry/)
  assert.match(publicProvenance, /getPublicEpistemicReleaseProvenance/)
  assert.match(docs, /Phase 3 canonical release control/)
  assert.match(method, /Approval and release authority are different decisions/)
  assert.match(sitemap, /getActiveEpistemicCanonicalReleases/)
  assert.match(store, /record_epistemic_canonical_release/)
  assert.match(openApi, /\/api\/admin\/epistemic-releases/)
})
