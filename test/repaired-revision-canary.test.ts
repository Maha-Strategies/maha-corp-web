import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import { getLegacyEpistemicAdapter } from '../lib/epistemic-adapters.ts'
import { epistemicReviewTargetHash } from '../lib/epistemic-publication.ts'
import { REPAIRED_REVISION_CANARY_RECORDS, REPAIRED_REVISION_CANARY_TARGETS, repairedRevisionCanaryReviewInputs } from '../lib/repaired-revision-canary.ts'

test('canary freezes exactly two repaired revisions', () => {
  assert.equal(REPAIRED_REVISION_CANARY_RECORDS.length, 2)
  assert.equal(REPAIRED_REVISION_CANARY_TARGETS.length, 2)
  assert.equal(new Set(REPAIRED_REVISION_CANARY_TARGETS.map((target) => target.recordId)).size, 2)
  for (const record of REPAIRED_REVISION_CANARY_RECORDS) {
    assert.equal(REPAIRED_REVISION_CANARY_TARGETS.find((target) => target.recordId === record.id)?.targetSha256, epistemicReviewTargetHash(record))
  }
})

test('adapter ingests only those exact targets without approving them', () => {
  const candidates = getLegacyEpistemicAdapter('repaired-revision-canary')!.adapt()
  assert.equal(candidates.length, 2)
  assert.deepEqual(candidates.map((candidate) => candidate.reviewTargetSha256), REPAIRED_REVISION_CANARY_TARGETS.map((target) => target.targetSha256))
  assert.equal(candidates.every((candidate) => candidate.record.publication.reviewEvents.length === 0), true)
})

test('four scoped decisions per record bind exact digests and disclose conflict', () => {
  const decisions = repairedRevisionCanaryReviewInputs()
  assert.equal(decisions.length, 8)
  assert.equal(new Set(decisions.map((decision) => decision.idempotencyKey)).size, 8)
  for (const target of REPAIRED_REVISION_CANARY_TARGETS) {
    const scoped = decisions.filter((decision) => decision.recordId === target.recordId)
    assert.equal(scoped.length, 4)
    assert.equal(scoped.every((decision) => decision.targetSha256 === target.targetSha256), true)
    assert.equal(scoped.every((decision) => decision.reviewer.reviewerKind === 'internal-editorial' && decision.reviewer.conflicts.length > 0), true)
  }
})

test('workflow requires protected environment and exact confirmation', () => {
  const workflow = readFileSync('.github/workflows/production-repaired-revision-canary.yml', 'utf8')
  assert.match(workflow, /environment: production-database/)
  assert.match(workflow, /RELEASE_2_REPAIRED_REVISIONS/)
  assert.match(workflow, /EPISTEMIC_OPERATIONS_TOKEN/)
  assert.match(workflow, /EPISTEMIC_RELEASE_AUTHORITY_TOKEN/)
})

test('operator is absent from public routes and discovery surfaces', () => {
  for (const file of ['app/sitemap.ts', 'lib/llms-manifest.ts', 'lib/substantial-page-public.ts']) {
    assert.doesNotMatch(readFileSync(file, 'utf8'), /repaired-revision-canary|run-repaired-revision-canary/)
  }
})
