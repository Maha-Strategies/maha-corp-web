import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

import {
  EPISTEMIC_PHASE4_PILOT_ENTRIES,
  EPISTEMIC_PHASE4_PILOT_MANIFEST,
  EPISTEMIC_PHASE4_PILOT_RECORD_IDS,
} from '../lib/epistemic-pilot-corpus.ts'
import {
  authorizeEpistemicReviewInvitation,
  buildEpistemicReviewInvitation,
  buildEpistemicReviewInvitationEvent,
  epistemicReviewInvitationStatus,
  epistemicReviewInvitationTokenHash,
  parseEpistemicReviewInvitationRequest,
  parseInvitedEpistemicExpertReview,
  privateEpistemicReviewInvitationDto,
} from '../lib/epistemic-review-invitation.ts'
import { EXPERT_REVIEW_CRITERIA } from '../lib/epistemic-review.ts'

const ROOT = join(import.meta.dirname, '..')
const TARGET = EPISTEMIC_PHASE4_PILOT_ENTRIES[0]
const NOW = new Date('2026-08-24T10:00:00.000Z')
const REVIEWER = {
  reviewerId: 'expert_phase4-reviewer',
  profileVersion: 1,
  displayName: 'Phase Four Reviewer',
  qualifications: ['Independent domain specialist with published work in thermal systems.'],
  affiliation: 'Independent',
  identityUrl: 'https://example.com/reviewer',
  domains: [TARGET.domainSlug],
  conflicts: ['No financial relationship with Maha Strategies.'],
}

function invitationRequest() {
  return {
    recordId: TARGET.recordId,
    domainSlug: TARGET.domainSlug,
    targetSha256: TARGET.initialReviewTargetSha256,
    scope: 'source-fidelity' as const,
    reviewer: REVIEWER,
    note: 'Review the exact frozen representation and record every material source disagreement.',
    expiresAt: '2026-08-31T10:00:00.000Z',
    idempotencyKey: 'phase4-invitation-test-0001',
  }
}

test('Phase 4 pilot freezes 20 unique migrated records with four per domain', () => {
  assert.equal(EPISTEMIC_PHASE4_PILOT_ENTRIES.length, 20)
  assert.equal(EPISTEMIC_PHASE4_PILOT_RECORD_IDS.size, 20)
  const counts = Map.groupBy(EPISTEMIC_PHASE4_PILOT_ENTRIES, (entry) => entry.domainSlug)
  assert.deepEqual([...counts.values()].map((entries) => entries.length).sort(), [4, 4, 4, 4, 4])
  assert.equal(EPISTEMIC_PHASE4_PILOT_MANIFEST.counts.domains, 5)
  assert.equal(EPISTEMIC_PHASE4_PILOT_MANIFEST.counts.sourceBlockers, 87)
  assert.equal(EPISTEMIC_PHASE4_PILOT_MANIFEST.manifestSha256, 'sha256:7bc156e1b72d8d9bda1ddde746624e39ceff8d65b21a4e6e34c9549e9670cd41')
  for (const entry of EPISTEMIC_PHASE4_PILOT_ENTRIES) {
    assert.match(entry.initialReviewTargetSha256, /^sha256:[a-f0-9]{64}$/)
    assert.ok(entry.sourcePublicPath.startsWith('/knowledge/'))
    assert.ok(entry.selectionRationale.length >= 20)
  }
})

test('review invitations are pilot-bound, expiring, hashed credentials', () => {
  const parsed = parseEpistemicReviewInvitationRequest(invitationRequest(), NOW)
  const credential = buildEpistemicReviewInvitation(parsed, `sha256:${'a'.repeat(64)}`, NOW)
  assert.match(credential.token, /^[A-Za-z0-9_-]{43}$/)
  assert.equal(credential.invitation.tokenSha256, epistemicReviewInvitationTokenHash(credential.token))
  assert.equal(JSON.stringify(credential.invitation).includes(credential.token), false)
  assert.equal(credential.invitation.recordId, TARGET.recordId)
  assert.equal(credential.invitation.reviewerProfileSha256.startsWith('sha256:'), true)
  const dto = privateEpistemicReviewInvitationDto(credential.invitation, null)
  assert.equal('tokenSha256' in dto, false)
  assert.equal('invitedByFingerprint' in dto, false)
  assert.equal(epistemicReviewInvitationStatus(credential.invitation, null, NOW), 'active')

  assert.throws(() => parseEpistemicReviewInvitationRequest({ ...invitationRequest(), recordId: 'urn:maha:record:not-in-pilot' }, NOW), /outside the bounded Phase 4 pilot/)
  assert.throws(() => parseEpistemicReviewInvitationRequest({ ...invitationRequest(), expiresAt: '2026-10-24T10:00:00.000Z' }, NOW), /between one hour and 30 days/)
  assert.throws(() => parseEpistemicReviewInvitationRequest({ ...invitationRequest(), reviewer: { ...REVIEWER, domains: ['astronomy'] } }, NOW), /must include the invitation domain/)
})

test('reviewer bearer authorization accepts only the one-time token shape', () => {
  const parsed = parseEpistemicReviewInvitationRequest(invitationRequest(), NOW)
  const credential = buildEpistemicReviewInvitation(parsed, `sha256:${'b'.repeat(64)}`, NOW)
  const authorized = authorizeEpistemicReviewInvitation(new Request('https://example.com/review', { headers: { Authorization: `Bearer ${credential.token}` } }))
  assert.equal(authorized?.tokenSha256, credential.invitation.tokenSha256)
  assert.equal(authorizeEpistemicReviewInvitation(new Request('https://example.com/review', { headers: { Authorization: 'Bearer too-short' } })), null)
  assert.equal(authorizeEpistemicReviewInvitation(new Request('https://example.com/review')), null)
})

test('invited review derives immutable assignment fields instead of trusting browser overrides', () => {
  const parsed = parseEpistemicReviewInvitationRequest(invitationRequest(), NOW)
  const { invitation } = buildEpistemicReviewInvitation(parsed, `sha256:${'c'.repeat(64)}`, NOW)
  const criteria = EXPERT_REVIEW_CRITERIA[invitation.scope].map((criterion) => ({
    criterionId: criterion.id,
    verdict: 'reservation' as const,
    rationale: 'The source is relevant, but the stated condition needs a narrower qualification.',
  }))
  const review = parseInvitedEpistemicExpertReview({
    recordId: 'urn:maha:record:malicious-override',
    domainSlug: 'astronomy',
    targetSha256: `sha256:${'0'.repeat(64)}`,
    scope: 'boundary-adequacy',
    reviewer: { ...REVIEWER, displayName: 'Override' },
    criteria,
    disagreements: ['One condition should remain explicit in the compiled representation.'],
    rationale: 'The representation is broadly faithful but should retain the named reservation.',
    idempotencyKey: 'phase4-review-test-0001',
  }, invitation)
  assert.equal(review.recordId, invitation.recordId)
  assert.equal(review.domainSlug, invitation.domainSlug)
  assert.equal(review.targetSha256, invitation.targetSha256)
  assert.equal(review.scope, invitation.scope)
  assert.deepEqual(review.reviewer, invitation.reviewer)
})

test('invitation status and terminal events are explicit and immutable in meaning', () => {
  const parsed = parseEpistemicReviewInvitationRequest(invitationRequest(), NOW)
  const { invitation } = buildEpistemicReviewInvitation(parsed, `sha256:${'d'.repeat(64)}`, NOW)
  assert.equal(epistemicReviewInvitationStatus(invitation, null, new Date('2026-08-25T00:00:00.000Z')), 'active')
  assert.equal(epistemicReviewInvitationStatus(invitation, null, new Date('2026-09-01T00:00:00.000Z')), 'expired')
  assert.equal(epistemicReviewInvitationStatus(invitation, null, NOW, `sha256:${'0'.repeat(64)}`), 'superseded-target')
  const revoked = buildEpistemicReviewInvitationEvent({ invitationId: invitation.invitationId, action: 'revoke', reason: 'The reviewer assignment changed before any scoped decision was submitted.', actorFingerprint: `sha256:${'d'.repeat(64)}` }, NOW)
  assert.equal(epistemicReviewInvitationStatus(invitation, revoked, NOW), 'revoked')
  const consumed = buildEpistemicReviewInvitationEvent({ invitationId: invitation.invitationId, action: 'consume', reviewId: `epireview_${'e'.repeat(32)}`, reason: 'The assigned reviewer submitted the exact-hash decision through the reviewer workspace.', actorFingerprint: invitation.tokenSha256 }, NOW)
  assert.equal(epistemicReviewInvitationStatus(invitation, consumed, NOW), 'consumed')
})

test('Phase 4 migration and routes enforce least-authority reviewer operations', () => {
  const migration = readFileSync(join(ROOT, 'supabase/migrations/20260824220000_epistemic_reviewer_invitations.sql'), 'utf8')
  for (const contract of [
    'epistemic_phase4_pilot_entries',
    'epistemic_reviewer_invitations',
    'epistemic_reviewer_invitation_events',
    'record_epistemic_reviewer_invitation',
    'consume_epistemic_reviewer_invitation',
    'revoke_epistemic_reviewer_invitation',
    'reject_epistemic_ledger_mutation',
    'grant execute on function',
    'revoke all on function',
    'latest frozen target',
  ]) assert.ok(migration.includes(contract), contract)
  assert.equal((migration.match(/'maha-phase4-pilot\/1\.0', \d+, 'urn:maha:record:/g) ?? []).length, 20)
  assert.match(migration, /token_sha256 text not null unique/)
  assert.match(migration, /where token_sha256 = p_token_sha256 for update/)
  assert.match(migration, /invitation_id text not null unique/)
  assert.match(migration, /expires_at <= now\(\)/)

  const adminRoute = readFileSync(join(ROOT, 'app/api/admin/epistemic-review-invitations/route.ts'), 'utf8')
  const reviewerRoute = readFileSync(join(ROOT, 'app/api/reviewer/epistemic-review/route.ts'), 'utf8')
  const legacyReviewRoute = readFileSync(join(ROOT, 'app/api/admin/epistemic-reviews/route.ts'), 'utf8')
  assert.match(adminRoute, /authorizeEpistemicOperations/)
  assert.match(reviewerRoute, /authorizeEpistemicReviewInvitation/)
  assert.doesNotMatch(reviewerRoute, /authorizeEpistemicOperations|authorizeEpistemicRelease/)
  assert.match(legacyReviewRoute, /invitation_required/)
  assert.match(reviewerRoute, /publicationAuthorityGranted: false/)
})

test('Phase 4 has a crawlable sanitized manifest and private routes stay out of public OpenAPI', () => {
  const page = readFileSync(join(ROOT, 'app/knowledge/epistemic-system/pilot-corpus/page.tsx'), 'utf8')
  const registry = readFileSync(join(ROOT, 'app/knowledge/epistemic-system/pilot-corpus/registry.json/route.ts'), 'utf8')
  const sitemap = readFileSync(join(ROOT, 'app/sitemap.ts'), 'utf8')
  const llms = readFileSync(join(ROOT, 'lib/llms-manifest.ts'), 'utf8')
  const openapiTest = readFileSync(join(ROOT, 'test/openapi-docs.test.ts'), 'utf8')
  const reviewerUi = readFileSync(join(ROOT, 'app/review/epistemic/page.tsx'), 'utf8')
  assert.match(page, /A backlog is now a frozen research object/)
  assert.match(registry, /reviewerCredentialsIncluded: false/)
  assert.match(sitemap, /pilot-corpus/)
  assert.match(llms, /Epistemic Phase 4 pilot corpus/)
  assert.match(openapiTest, /\/api\/admin\/epistemic-review-invitations/)
  assert.match(openapiTest, /\/api\/reviewer\/epistemic-review/)
  assert.match(reviewerUi, /never written to browser storage/)
  assert.doesNotMatch(reviewerUi, /localStorage|sessionStorage/)
})
