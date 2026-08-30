import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

import {
  ALIGNMENT_BATCH_8_DECISIONS,
  ALIGNMENT_BATCH_8_SOURCE_DISCOVERIES,
} from '../lib/frontier-alignment-batch-8.ts'
import {
  BATCH_8_COHORT,
  BATCH_8_FIRST_JUDGEMENTS,
  BATCH_8_REINSPECTIONS,
  FRONTIER_ALIGNMENT_AUDIT,
  alignmentBlockers,
  alignmentFor,
  verdictTotals,
} from '../lib/frontier-source-alignment.ts'

test('Batch 8 freezes and closes the complete post-Batch-7 uninspected backlog', () => {
  assert.equal(ALIGNMENT_BATCH_8_DECISIONS.length, 59)
  assert.equal(BATCH_8_COHORT.length, 59)
  assert.equal(BATCH_8_REINSPECTIONS.length, 40)
  assert.equal(BATCH_8_FIRST_JUDGEMENTS.length, 19)
  assert.equal(new Set(BATCH_8_COHORT).size, 59)
  assert.equal(ALIGNMENT_BATCH_8_DECISIONS.filter((entry) => entry.sourceContentInspected).length, 54)
  assert.equal(ALIGNMENT_BATCH_8_DECISIONS.filter((entry) => entry.verdict === 'inaccessible-source').length, 5)
})

test('source discovery stays separate from inspection and commits no retrieved content', () => {
  assert.equal(ALIGNMENT_BATCH_8_SOURCE_DISCOVERIES.length, 12)
  assert.equal(new Set(ALIGNMENT_BATCH_8_SOURCE_DISCOVERIES.map((entry) => entry.sourceContractId)).size, 12)
  assert.equal(ALIGNMENT_BATCH_8_SOURCE_DISCOVERIES.filter((entry) => entry.status === 'open-copy-located').length, 9)
  assert.equal(ALIGNMENT_BATCH_8_SOURCE_DISCOVERIES.filter((entry) => entry.status === 'public-abstract-only').length, 2)
  assert.equal(ALIGNMENT_BATCH_8_SOURCE_DISCOVERIES.filter((entry) => entry.status === 'closed-no-authorized-copy').length, 1)
  assert.ok(ALIGNMENT_BATCH_8_SOURCE_DISCOVERIES.every((entry) => entry.contentCommitted === false))
})

test('only the five wide-bandgap records remain uninspected and non-explanatory', () => {
  const uninspected = FRONTIER_ALIGNMENT_AUDIT.filter((entry) => !entry.evidence.sourceContentInspected)
  assert.equal(uninspected.length, 5)
  assert.ok(uninspected.every((entry) => entry.sourceContractId === 'source-advanced-materials-wide-bandgap'))
  for (const entry of uninspected) {
    assert.equal(entry.evidence.subjectAligned, 'inaccessible-source')
    assert.equal(entry.evidence.claimSupported, false)
    assert.ok(alignmentBlockers(entry.recordId).includes('source-not-inspected'))
  }
})

test('Batch 8 produces the reconciled active corpus totals', () => {
  assert.deepEqual(verdictTotals(), {
    supported: 90,
    'partially-supported': 50,
    mismatched: 86,
    'insufficient-evidence': 9,
    'inaccessible-source': 5,
  })
  assert.equal(FRONTIER_ALIGNMENT_AUDIT.filter((entry) => entry.evidence.sourceContentInspected).length, 235)
  assert.equal(FRONTIER_ALIGNMENT_AUDIT.filter((entry) => alignmentBlockers(entry.recordId).length === 0).length, 90)
})

test('PP1802 is inspected per record and no longer inherits stale infrastructure inaccessibility', () => {
  const pp1802 = FRONTIER_ALIGNMENT_AUDIT.filter((entry) => entry.sourceContractId === 'source-critical-supply-chains-pp1802')
  assert.equal(pp1802.length, 5)
  assert.ok(pp1802.every((entry) => entry.evidence.sourceContentInspected))
  assert.ok(pp1802.every((entry) => entry.evidence.subjectAligned !== 'inaccessible-source'))
  assert.deepEqual(
    pp1802.map((entry) => entry.evidence.subjectAligned).sort(),
    ['mismatched', 'mismatched', 'mismatched', 'mismatched', 'partially-supported'],
  )
})

test('active Batch 8 decisions preserve prior judgement provenance where one existed', () => {
  for (const decision of ALIGNMENT_BATCH_8_DECISIONS) {
    const active = alignmentFor(decision.recordId)!
    if (decision.priorBatchId) {
      assert.equal(active.priorJudgement?.batchId, decision.priorBatchId)
      assert.ok(active.priorJudgement?.reason)
    } else {
      assert.equal(active.priorJudgement, null)
    }
  }
})

test('Batch 8 artifacts regenerate byte-identically and stay outside public indexes', () => {
  const root = new URL('..', import.meta.url).pathname
  const paths = [
    'content/frontier-alignment/batch-8-results.json',
    'docs/frontier-audit/alignment-batch-8-results.md',
  ]
  const before = paths.map((path) => readFileSync(join(root, path), 'utf8'))
  execFileSync(process.execPath, ['--experimental-strip-types', join(root, 'scripts/generate-frontier-alignment-batch-8-results.ts')], { cwd: root })
  paths.forEach((path, index) => assert.equal(readFileSync(join(root, path), 'utf8'), before[index], `${path} drifted`))

  const servedIndexes = [readFileSync('app/sitemap.ts', 'utf8'), readFileSync('app/llms.txt/route.ts', 'utf8')].join('\n')
  for (const marker of ['batch-8-results', 'maha-frontier-alignment-batch/8.0', 'ALIGNMENT_BATCH_8']) {
    assert.doesNotMatch(servedIndexes, new RegExp(marker))
  }
})
