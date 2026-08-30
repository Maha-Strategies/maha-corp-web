import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import { getLegacyEpistemicAdapter } from '../lib/epistemic-adapters.ts'
import { buildEpistemicIngestionBatch } from '../lib/epistemic-ingestion.ts'
import { epistemicReviewTargetHash } from '../lib/epistemic-publication.ts'
import { parseEpistemicExpertReview } from '../lib/epistemic-review.ts'
import {
  BATCH_11_REVISED_RECORDS,
  batch11RevisionReviewInputs,
} from '../lib/batch-11-revision-canary.ts'
import snapshot from '../content/epistemic/batch-11-revision-ingestion-records.json' with { type: 'json' }

test('the dedicated adapter freezes exactly the five Batch 11 revisions', () => {
  const adapter = getLegacyEpistemicAdapter('batch-11-revision-canary')
  assert.ok(adapter)
  const candidates = adapter.adapt()
  assert.equal(candidates.length, 5)
  assert.deepEqual(candidates.map((entry) => entry.reviewTargetSha256), BATCH_11_REVISED_RECORDS.map(epistemicReviewTargetHash))
  assert.deepEqual(snapshot.records.map((record) => record.id), BATCH_11_REVISED_RECORDS.map((record) => record.id))
})

test('Batch 11 ingestion carries digest-bound inspection attestations and remains draft', () => {
  const batch = buildEpistemicIngestionBatch({
    adapterId: 'batch-11-revision-canary',
    idempotencyKey: 'batch-11-revision-ingestion-test',
  }, new Date('2026-08-30T00:00:00.000Z'))
  assert.equal(batch.records.length, 5)
  for (const record of batch.records) {
    assert.equal(record.alignmentDecision.contentInspectionState, 'internally-inspected-batch-11-revision')
    assert.equal(record.alignmentDecision.canonicalEligible, true)
    assert.match(record.alignmentDecision.inspectionAttestationSha256 ?? '', /^sha256:[a-f0-9]{64}$/)
    assert.equal(record.gateDecision.publicEligible, false)
    assert.equal(record.candidateSnapshot.publication.reviewState, 'draft')
    assert.equal(record.candidateSnapshot.publication.requestedPublicPromotion, false)
  }
})

test('twenty API review inputs bind four scopes to each exact revision', () => {
  const inputs = batch11RevisionReviewInputs()
  assert.equal(inputs.length, 20)
  for (const record of BATCH_11_REVISED_RECORDS) {
    const scoped = inputs.filter((input) => input.recordId === record.id)
    assert.equal(scoped.length, 4)
    assert.equal(new Set(scoped.map((input) => input.scope)).size, 4)
    for (const input of scoped) {
      const parsed = parseEpistemicExpertReview(input)
      assert.equal(parsed.targetSha256, epistemicReviewTargetHash(record))
      assert.equal(parsed.reviewer.reviewerKind, 'internal-editorial')
      assert.match(parsed.reviewer.reviewMethod ?? '', /exact-revision/i)
    }
  }
})

test('the migration is Preview-scoped, allowlisted and cannot manufacture review decisions', () => {
  const migration = readFileSync('supabase/migrations/20260830200000_batch_11_revision_preview_rehearsal.sql', 'utf8')
  assert.match(migration, /record_batch_11_revision_canary_targets/)
  assert.match(migration, /bootstrap_batch_11_preview_prior_lineages/)
  assert.equal((migration.match(/'batch-11-revision-canary'/g) ?? []).length >= 3, true)
  assert.match(migration, /jsonb_array_length\(p_fixtures\) <> 4/)
  assert.match(migration, /jsonb_array_length\(p_records\) <> 5/)
  assert.doesNotMatch(migration, /insert into public\.epistemic_expert_review_decisions/i)
})

test('workflow and runner are exact-branch Preview-only and verify all five projections', () => {
  const workflow = readFileSync('.github/workflows/preview-batch-11-lineage-rehearsal.yml', 'utf8')
  const runner = readFileSync('scripts/run-batch-11-preview-lineage-rehearsal.ts', 'utf8')
  for (const source of [workflow, runner]) {
    assert.match(source, /codex\/batch-11-preview-lifecycle/)
    assert.match(source, /RELEASE_BATCH_11_MIXED_LINEAGE_IN_PREVIEW/)
    assert.match(source, /Production.*forbidden|Production host.*never|Production database forbidden/i)
  }
  assert.match(workflow, /environment: Preview/)
  assert.match(workflow, /\.release\.initialCount == 1/)
  assert.match(workflow, /\.release\.supersedingCount == 4/)
  assert.match(workflow, /\.sitemapIncluded == true/)
  assert.match(workflow, /\.llmsIncluded == true/)
  assert.doesNotMatch(runner, /eyJ[A-Za-z0-9_-]{20,}/)
})
