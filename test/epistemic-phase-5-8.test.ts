import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

import { ADAPTED_EPISTEMIC_CANDIDATES } from '../lib/epistemic-adapters.ts'
import { buildEpistemicCandidateAudit } from '../lib/epistemic-audit.ts'
import {
  buildEpistemicFactoryRun,
  epistemicFactoryPersistenceKey,
  parseEpistemicFactoryRequest,
  type EpistemicFactoryTarget,
} from '../lib/epistemic-factory.ts'

const ROOT = new URL('../', import.meta.url)

function target(index: number): EpistemicFactoryTarget {
  const candidate = ADAPTED_EPISTEMIC_CANDIDATES[index]
  return {
    recordId: candidate.record.id,
    sourcePublicPath: candidate.sourcePublicPath,
    candidateSha256: candidate.candidateSha256,
    reviewTargetSha256: candidate.reviewTargetSha256,
    candidateSnapshot: structuredClone(candidate.record),
  }
}

test('automated audits bind exact candidate hashes without creating approval', () => {
  const candidate = target(0)
  const audit = buildEpistemicCandidateAudit(candidate.candidateSnapshot, new Date('2026-08-24T12:00:00.000Z'))
  assert.equal(audit.recordId, candidate.recordId)
  assert.equal(audit.candidateSha256, candidate.candidateSha256)
  assert.equal(audit.reviewTargetSha256, candidate.reviewTargetSha256)
  assert.match(audit.auditId, /^epiaudit_[a-f0-9]{32}$/)
  assert.match(audit.auditSha256, /^sha256:[a-f0-9]{64}$/)
  assert.match(audit.auditBoundary, /do not .*satisfy any expert-review scope/i)
  assert.equal(candidate.candidateSnapshot.publication.reviewEvents.length, 0)
})

test('source mismatches and unsupported inferences fail closed', () => {
  const candidate = target(0)
  candidate.candidateSnapshot.sources[0].boundary = 'This source does not establish the complete linked claim.'
  candidate.candidateSnapshot.summary = 'This system guarantees a future outcome.'
  const audit = buildEpistemicCandidateAudit(candidate.candidateSnapshot, new Date('2026-08-24T12:00:00.000Z'))
  assert.equal(audit.status, 'blocked')
  assert.ok(audit.findings.some((finding) => finding.code === 'source-to-claim-declared-mismatch'))
  assert.ok(audit.findings.some((finding) => finding.code === 'unsupported-inference:guaranteed-outcome'))
})

test('the factory compiles immutable packets that are always noncanonical and noindex', () => {
  const result = buildEpistemicFactoryRun([target(0), target(1)], new Date('2026-08-24T12:30:00.000Z'))
  assert.equal(result.run.targetCount, 2)
  assert.deepEqual(result.run.counts.canonical, 0)
  assert.deepEqual(result.run.counts.sitemapEligible, 0)
  assert.equal(result.run.canonicalReleaseAttempted, false)
  assert.match(result.run.runSha256, /^sha256:[a-f0-9]{64}$/)
  for (const packet of result.packets) {
    assert.equal(packet.canonicalStatus, 'noncanonical-draft')
    assert.deepEqual(packet.indexControl, { crawlable: false, sitemapEligible: false, robotsDirective: 'noindex, nofollow, noarchive' })
    assert.equal(packet.reviewScopes.length, 4)
    assert.ok(packet.reviewScopes.every((scope) => scope.status === 'unreviewed'))
    assert.match(packet.packetSha256, /^sha256:[a-f0-9]{64}$/)
    assert.equal(packet.candidateSnapshot.publication.reviewEvents.length, 0)
  }
})

test('the factory compiles the complete 134-record knowledge graph in one bounded run', () => {
  const targets: EpistemicFactoryTarget[] = ADAPTED_EPISTEMIC_CANDIDATES.map((candidate) => ({
    recordId: candidate.record.id,
    sourcePublicPath: candidate.sourcePublicPath,
    candidateSha256: candidate.candidateSha256,
    reviewTargetSha256: candidate.reviewTargetSha256,
    candidateSnapshot: structuredClone(candidate.record),
  }))
  const result = buildEpistemicFactoryRun(targets, new Date('2026-08-24T12:45:00.000Z'))
  assert.equal(result.run.targetCount, 134)
  assert.equal(result.packets.length, 134)
  assert.equal(new Set(result.packets.map((packet) => packet.packetId)).size, 134)
  assert.equal(new Set(result.packets.map((packet) => packet.packetSha256)).size, 134)
  assert.equal(result.packets.reduce((total, packet) => total + packet.reviewScopes.length, 0), 536)
  assert.equal(result.run.counts.canonical, 0)
  assert.equal(result.run.counts.sitemapEligible, 0)
  assert.equal(result.packets.some((packet) => packet.indexControl.crawlable), false)
})

test('the factory rejects digest drift, promoted records, duplicate targets, and unbounded batches', () => {
  const changed = target(0)
  changed.candidateSnapshot.summary += ' changed'
  assert.throws(() => buildEpistemicFactoryRun([changed]), /candidate digest/)
  const promoted = target(0)
  promoted.candidateSnapshot.publication.requestedPublicPromotion = true
  promoted.candidateSha256 = 'sha256:' + '0'.repeat(64)
  assert.throws(() => buildEpistemicFactoryRun([promoted]), /candidate digest|non-promoted draft/)
  assert.throws(() => buildEpistemicFactoryRun([target(0), target(0)]), /Duplicate factory target/)
  assert.throws(() => buildEpistemicFactoryRun([]), /1-500/)
})

test('factory request parsing is bounded and dry-run capable', () => {
  assert.deepEqual(parseEpistemicFactoryRequest({ operation: 'preview', recordIds: [], idempotencyKey: 'factory-preview-001' }), {
    operation: 'preview', recordIds: [], idempotencyKey: 'factory-preview-001',
  })
  assert.throws(() => parseEpistemicFactoryRequest({ operation: 'publish', recordIds: [], idempotencyKey: 'factory-publish-001' }), /preview or compile/)
  assert.throws(() => parseEpistemicFactoryRequest({ operation: 'compile', recordIds: ['bad'], idempotencyKey: 'factory-compile-001' }), /invalid/)
})

test('factory persistence idempotency is bound to the exact target set', () => {
  const first = target(0).reviewTargetSha256
  const second = target(1).reviewTargetSha256
  assert.equal(
    epistemicFactoryPersistenceKey('factory-compile-001', [first, second]),
    epistemicFactoryPersistenceKey('factory-compile-001', [second, first]),
  )
  assert.notEqual(
    epistemicFactoryPersistenceKey('factory-compile-001', [first]),
    epistemicFactoryPersistenceKey('factory-compile-001', [second]),
  )
  assert.throws(() => epistemicFactoryPersistenceKey('factory-compile-001', []), /target digest/)
})

test('Phase 5-8 persistence is append-only and cannot publish', async () => {
  const [migration, sitemap] = await Promise.all([
    readFile(new URL('supabase/migrations/20260825010000_epistemic_noncanonical_factory.sql', ROOT), 'utf8'),
    readFile(new URL('app/sitemap.ts', ROOT), 'utf8'),
  ])
  for (const contract of [
    'epistemic_factory_runs',
    'epistemic_candidate_audits',
    'epistemic_review_packets',
    'record_epistemic_factory_run',
    'reject_epistemic_ledger_mutation',
    'revoke insert, update, delete, truncate',
    'noindex, nofollow, noarchive',
    'latest immutable draft target',
    'Factory run counts do not agree with packet audit states',
    'Every reviewer packet must retain the four unreviewed scopes',
  ]) assert.match(migration, new RegExp(contract.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  assert.doesNotMatch(migration, /record_epistemic_canonical_release|published-canonical/)
  assert.doesNotMatch(sitemap, /epistemic_review_packets|epistemic-candidates/)
})
