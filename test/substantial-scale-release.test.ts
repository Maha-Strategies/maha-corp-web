import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

import { getLegacyEpistemicAdapter } from '../lib/epistemic-adapters.ts'
import { EXPERT_REVIEW_CRITERIA } from '../lib/epistemic-review.ts'
import { epistemicReviewTargetHash } from '../lib/epistemic-publication.ts'
import { FROZEN_ACTIVE_RELEASES } from '../lib/substantial-publication-queue.ts'
import {
  SUBSTANTIAL_SCALE_REVIEW_MANIFEST,
  SUBSTANTIAL_SCALE_REVIEW_PACKETS,
  substantialScaleReviewInputs,
} from '../lib/substantial-scale-internal-review.ts'
import {
  SUBSTANTIAL_SCALE_RELEASE_CANARY_IDS,
  SUBSTANTIAL_SCALE_RELEASE_RECORD_IDS,
} from '../lib/substantial-scale-cohort.ts'

test('the release-scale cohort is exactly 64 unique unreleased records', () => {
  assert.equal(SUBSTANTIAL_SCALE_RELEASE_RECORD_IDS.length, 64)
  assert.equal(new Set(SUBSTANTIAL_SCALE_RELEASE_RECORD_IDS).size, 64)
  assert.equal(SUBSTANTIAL_SCALE_RELEASE_CANARY_IDS.length, 10)
  const active = new Set(FROZEN_ACTIVE_RELEASES.map((release) => release.recordId))
  for (const recordId of SUBSTANTIAL_SCALE_RELEASE_RECORD_IDS) assert.equal(active.has(recordId), false, recordId)
})

test('every packet binds inspected evidence, exact locator, rights, quality, and exact revision', () => {
  assert.equal(SUBSTANTIAL_SCALE_REVIEW_PACKETS.length, 64)
  for (const packet of SUBSTANTIAL_SCALE_REVIEW_PACKETS) {
    assert.equal(packet.alignment.metadataVerified, true)
    assert.equal(packet.alignment.sourceContentInspected, true)
    assert.equal(packet.alignment.subjectSupported, true)
    assert.ok(packet.alignment.exactInspectedLocator.length > 2)
    assert.deepEqual(Object.values(packet.checklistFacts), new Array(9).fill(true))
    assert.match(packet.targetSha256, /^sha256:[a-f0-9]{64}$/)
    assert.match(packet.contractDigest, /^sha256:[a-f0-9]{64}$/)
    assert.match(packet.packetDigest, /^sha256:[a-f0-9]{64}$/)
  }
})

test('review inputs are record-specific, exact-revision scoped, and internally labelled', () => {
  const inputs = substantialScaleReviewInputs()
  assert.equal(inputs.length, 256)
  for (const packet of SUBSTANTIAL_SCALE_REVIEW_PACKETS) {
    const decisions = inputs.filter((input) => input.recordId === packet.recordId)
    assert.equal(decisions.length, 4)
    assert.deepEqual(decisions.map((entry) => entry.scope).sort(), Object.keys(EXPERT_REVIEW_CRITERIA).sort())
    for (const decision of decisions) {
      assert.equal(decision.targetSha256, packet.targetSha256)
      assert.equal(decision.reviewer.reviewerKind, 'internal-editorial')
      assert.match(decision.rationale, new RegExp(packet.recordId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
      assert.ok(decision.criteria.every((criterion) => criterion.verdict === 'satisfied' && criterion.rationale.length >= 80))
    }
  }
})

test('the ingestion adapter freezes exactly the reviewed revisions without approving them', () => {
  const adapter = getLegacyEpistemicAdapter('substantial-scale-release')
  assert.ok(adapter)
  const candidates = adapter.adapt()
  assert.equal(candidates.length, 64)
  assert.deepEqual(candidates.map((candidate) => candidate.record.id).sort(), [...SUBSTANTIAL_SCALE_RELEASE_RECORD_IDS].sort())
  for (const candidate of candidates) {
    assert.equal(candidate.reviewTargetSha256, epistemicReviewTargetHash(candidate.record))
    assert.equal(candidate.gateDecision.publicEligible, false)
  }
})

test('the canary and remainder confirmations are distinct and the runner cannot infer publication', () => {
  const runner = readFileSync(new URL('../scripts/run-substantial-scale-release.ts', import.meta.url), 'utf8')
  const workflow = readFileSync(new URL('../.github/workflows/production-substantial-scale-release.yml', import.meta.url), 'utf8')
  for (const phrase of ['RELEASE_10_SUBSTANTIAL_SCALE_CANARY', 'RELEASE_54_SUBSTANTIAL_SCALE_REMAINDER']) {
    assert.match(runner, new RegExp(phrase))
    assert.match(workflow, new RegExp(phrase))
  }
  assert.match(runner, /--publish/)
  assert.match(runner, /SUBSTANTIAL_SCALE_CONFIRM/)
  assert.match(workflow, /environment: production-database/)
  assert.match(workflow, /cancel-in-progress: false/)
})

test('the private review manifest regenerates byte for byte', () => {
  const root = new URL('..', import.meta.url).pathname
  const paths = ['content/substantial-pages/release-scale-review.json', 'docs/substantial-pages/release-scale-review.md']
  const before = paths.map((path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8'))
  execFileSync(process.execPath, ['--experimental-strip-types', 'scripts/generate-substantial-scale-review.ts'], { cwd: root })
  paths.forEach((path, index) => assert.equal(readFileSync(new URL(`../${path}`, import.meta.url), 'utf8'), before[index]))
  assert.equal(SUBSTANTIAL_SCALE_REVIEW_MANIFEST.counts.records, 64)
})

test('review packets and operational vocabulary do not enter public surfaces', () => {
  const sources = [
    readFileSync(new URL('../app/sitemap.ts', import.meta.url), 'utf8'),
    readFileSync(new URL('../lib/llms-manifest.ts', import.meta.url), 'utf8'),
    readFileSync(new URL('../lib/substantial-page-public.ts', import.meta.url), 'utf8'),
  ].join('\n')
  assert.doesNotMatch(sources, /release-scale-review|SUBSTANTIAL_SCALE_REVIEW|substantial-scale-release/)
})
