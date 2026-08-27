import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import { buildEpistemicExpertReview } from '../lib/epistemic-review.ts'
import { SUBSTANTIAL_BATCH_2_INTERNAL_REVIEW_ADAPTER } from '../lib/epistemic-adapters.ts'
import { releaseReadiness, reviewAssuranceTier } from '../lib/epistemic-release.ts'
import { epistemicReviewTargetHash } from '../lib/epistemic-publication.ts'
import { EPISTEMIC_RECORDS } from '../lib/epistemic-pilots.ts'
import {
  BATCH_2_DRIFTED_RECORD_IDS,
  BATCH_2_INTERNAL_REVIEW_CANARY_IDS,
  BATCH_2_INTERNAL_REVIEW_MANIFEST,
  BATCH_2_INTERNAL_REVIEW_PACKETS,
} from '../lib/substantial-internal-review-batch-2.ts'
import { canaryInternalReviewInputs, INTERNAL_REVIEW_CANARY_SUMMARY } from '../lib/substantial-internal-review-canary.ts'

test('the honest internal-review tier is distinct from expert and legacy review', () => {
  const base = { scope: 'source-fidelity' as const, reviewId: 'r', reviewSha256: 'sha256:x', reviewedAt: '2026-08-27T00:00:00.000Z', reviewMethod: 'method' }
  assert.equal(reviewAssuranceTier([{ ...base, reviewerKind: 'internal-editorial' }]), 'internally-reviewed-canonical')
  assert.equal(reviewAssuranceTier([{ ...base, reviewerKind: 'external-expert' }]), 'expert-reviewed-canonical')
  assert.equal(reviewAssuranceTier([{ ...base, reviewerKind: 'internal-editorial' }, { ...base, reviewerKind: 'external-expert' }]), 'mixed-review-canonical')
  assert.equal(reviewAssuranceTier([{ ...base }]), 'legacy-review-unclassified')
})

test('all 27 packets remain pending and bind exact current revisions', () => {
  assert.equal(BATCH_2_INTERNAL_REVIEW_PACKETS.length, 27)
  assert.equal(BATCH_2_INTERNAL_REVIEW_MANIFEST.counts.criteriaPending, 324)
  assert.equal(new Set(BATCH_2_INTERNAL_REVIEW_PACKETS.map((packet) => packet.recordId)).size, 27)
  for (const packet of BATCH_2_INTERNAL_REVIEW_PACKETS) {
    const record = EPISTEMIC_RECORDS.find((entry) => entry.id === packet.recordId)!
    assert.equal(packet.targetSha256, epistemicReviewTargetHash(record))
    assert.equal(packet.decisionStatus, 'pending')
    assert.equal(Object.values(packet.checklist).flat().every((criterion) => criterion.status === 'pending-record-specific-review'), true)
    assert.ok(packet.sources.every((source) => source.exactLocator && source.rightsBasis))
    assert.ok(packet.claims.every((claim) => claim.sourceIds.every((sourceId) => packet.sources.some((source) => source.sourceId === sourceId))))
  }
})

test('the ingestion adapter freezes all 27 current targets without creating decisions', () => {
  const candidates = SUBSTANTIAL_BATCH_2_INTERNAL_REVIEW_ADAPTER.adapt()
  assert.equal(candidates.length, 27)
  assert.deepEqual(candidates.map((candidate) => candidate.record.id).sort(), BATCH_2_INTERNAL_REVIEW_PACKETS.map((packet) => packet.recordId).sort())
  for (const candidate of candidates) {
    const packet = BATCH_2_INTERNAL_REVIEW_PACKETS.find((entry) => entry.recordId === candidate.record.id)!
    assert.equal(candidate.reviewTargetSha256, packet.targetSha256)
    assert.equal(candidate.record.publication.reviewEvents.length, 0)
  }
})

test('the two repaired source bindings are explicitly re-audited, not silently overwritten', () => {
  assert.deepEqual(BATCH_2_INTERNAL_REVIEW_PACKETS.filter((packet) => packet.driftReAudit).map((packet) => packet.recordId).sort(), [...BATCH_2_DRIFTED_RECORD_IDS].sort())
  for (const recordId of BATCH_2_DRIFTED_RECORD_IDS) {
    const packet = BATCH_2_INTERNAL_REVIEW_PACKETS.find((entry) => entry.recordId === recordId)!
    assert.equal(packet.driftReAudit?.classification, 'source-binding-change')
    assert.match(packet.driftReAudit!.priorBinding, /previously bound/)
    assert.match(packet.driftReAudit!.currentBinding, /audited revision binds/)
  }
})

test('only five individually authored canary findings become decisions', () => {
  const decisions = canaryInternalReviewInputs()
  assert.equal(INTERNAL_REVIEW_CANARY_SUMMARY.counts.records, 5)
  assert.equal(decisions.length, 20)
  assert.deepEqual([...new Set(decisions.map((decision) => decision.recordId))].sort(), [...BATCH_2_INTERNAL_REVIEW_CANARY_IDS].sort())
  assert.equal(new Set(decisions.map((decision) => `${decision.recordId}:${decision.scope}`)).size, 20)
  assert.equal(decisions.every((decision) => decision.reviewer.reviewerKind === 'internal-editorial'), true)
  assert.equal(decisions.every((decision) => decision.disagreements.some((entry) => /not independent/.test(entry))), true)
  assert.equal(decisions.every((decision) => decision.criteria.length === 3 && decision.criteria.every((criterion) => criterion.rationale.includes(decision.targetSha256) || criterion.rationale.length > 150)), true)
  assert.equal(decisions.some((decision) => !BATCH_2_INTERNAL_REVIEW_CANARY_IDS.includes(decision.recordId as typeof BATCH_2_INTERNAL_REVIEW_CANARY_IDS[number])), false)
})

test('the five exact records become release-ready only after their twenty scoped decisions', () => {
  const reviewedAt = new Date('2026-08-27T00:00:00.000Z')
  const reviews = canaryInternalReviewInputs().map((input) => buildEpistemicExpertReview(input, reviewedAt))
  for (const recordId of BATCH_2_INTERNAL_REVIEW_CANARY_IDS) {
    const record = EPISTEMIC_RECORDS.find((entry) => entry.id === recordId)!
    const targetSha256 = epistemicReviewTargetHash(record)
    const before = releaseReadiness({ recordId, targetSha256, candidateSnapshot: record }, [], reviewedAt)
    const after = releaseReadiness({ recordId, targetSha256, candidateSnapshot: record }, reviews, reviewedAt)
    assert.equal(before.ready, false)
    assert.equal(after.ready, true, `${recordId} must pass only with all four exact-revision decisions`)
    assert.equal(reviewAssuranceTier(after.approvals), 'internally-reviewed-canonical')
  }
})

test('a stale decision, absent scope, or unreviewed sixth record cannot enter the canary', () => {
  const inputs = canaryInternalReviewInputs()
  const recordId = BATCH_2_INTERNAL_REVIEW_CANARY_IDS[0]
  const record = EPISTEMIC_RECORDS.find((entry) => entry.id === recordId)!
  const targetSha256 = epistemicReviewTargetHash(record)
  const threeScopes = inputs.filter((input) => input.recordId === recordId).slice(0, 3).map((input) => buildEpistemicExpertReview(input, new Date('2026-08-27T00:00:00.000Z')))
  assert.equal(releaseReadiness({ recordId, targetSha256, candidateSnapshot: record }, threeScopes).ready, false)
  const sixth = BATCH_2_INTERNAL_REVIEW_PACKETS.find((packet) => !BATCH_2_INTERNAL_REVIEW_CANARY_IDS.includes(packet.recordId as typeof BATCH_2_INTERNAL_REVIEW_CANARY_IDS[number]))!
  assert.equal(canaryInternalReviewInputs().some((input) => input.recordId === sixth.recordId), false)
  assert.throws(() => releaseReadiness({ recordId, targetSha256: `sha256:${'f'.repeat(64)}`, candidateSnapshot: record }, threeScopes), /does not match/)
})

test('the production workflow separates review from release and requires explicit confirmation', () => {
  const workflow = readFileSync('.github/workflows/production-substantial-internal-review-canary.yml', 'utf8')
  const script = readFileSync('scripts/run-substantial-internal-review-canary.ts', 'utf8')
  assert.match(workflow, /RELEASE_5_BATCH2_INTERNAL_REVIEW_CANARIES/)
  assert.match(workflow, /production-database/)
  assert.match(script, /--publish requires --review/)
  assert.match(script, /EPISTEMIC_RELEASE_AUTHORITY_TOKEN/)
  assert.match(script, /EPISTEMIC_OPERATIONS_TOKEN/)
  assert.doesNotMatch(script, /console\.log\([^)]*TOKEN/)
})

test('review packets and decisions do not enter a public route', () => {
  const routeFiles = [
    'app/sitemap.ts',
    'lib/llms-manifest.ts',
    'app/knowledge/[kind]/[slug]/[recordSlug]/page.tsx',
  ].map((file) => readFileSync(file, 'utf8')).join('\n')
  for (const marker of ['internal-review-batch-2', 'substantial-internal-review-canary', 'BATCH_2_INTERNAL_REVIEW_PACKETS']) assert.doesNotMatch(routeFiles, new RegExp(marker))
})
