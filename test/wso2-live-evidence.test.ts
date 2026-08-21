import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import {
  WSO2_LIVE_EVIDENCE_PATH,
  WSO2_LIVE_EVIDENCE_PATHS,
  deriveAggregates,
  deriveComparison,
  findForbiddenKeys,
  formatCostUsd,
  loadWso2LiveEvidence,
  parseWso2LiveEvidence,
} from '../lib/integrations/wso2-live-evidence.ts'

const committed = () => JSON.parse(readFileSync(WSO2_LIVE_EVIDENCE_PATH, 'utf8'))

/** A fresh mutable clone, so one test's damage never reaches another. */
const clone = () => structuredClone(committed())

test('the committed artifact validates, and its aggregates are re-derived rather than trusted', () => {
  const artifact = loadWso2LiveEvidence()
  assert.equal(artifact.workloads.length, 20)
  assert.equal(artifact.workloads.flatMap((workload) => workload.rows).length, 60)
  assert.deepEqual(artifact.aggregates, deriveAggregates(artifact.workloads))
  assert.deepEqual(artifact.comparison, deriveComparison(artifact.aggregates))
})

test('the corpus is declared synthetic, because it is', () => {
  const artifact = loadWso2LiveEvidence()
  assert.equal(artifact.corpus.synthetic, true)
  assert.equal(artifact.sanitization.syntheticCorpus, true)
  assert.ok(artifact.limitations.some((limitation) => /synthetic/i.test(limitation)))
})

test('a hand-edited aggregate fails instead of publishing', () => {
  const artifact = clone()
  artifact.aggregates['wso2-maha-context-compiler'].providerInputTokens -= 1
  assert.throws(() => parseWso2LiveEvidence(artifact), /does not match the value derived from workload rows/)
})

test('a hand-edited comparison headline fails instead of publishing', () => {
  const artifact = clone()
  artifact.comparison.inputTokenReductionPercent = '99.99'
  assert.throws(() => parseWso2LiveEvidence(artifact), /comparison does not match/)
})

test('a dropped workload fails rather than shrinking the denominator quietly', () => {
  const artifact = clone()
  artifact.workloads.pop()
  assert.throws(() => parseWso2LiveEvidence(artifact), /must contain 20 workloads; found 19/)
})

test('a workload missing one path fails rather than averaging over a hole', () => {
  const artifact = clone()
  artifact.workloads[0].rows = artifact.workloads[0].rows.filter(
    (row: { path: string }) => row.path !== 'wso2-native-prompt-compressor',
  )
  assert.throws(() => parseWso2LiveEvidence(artifact), /exactly one 'wso2-native-prompt-compressor' row; found 0/)
})

test('a duplicated workload id fails', () => {
  const artifact = clone()
  artifact.workloads[1].workloadId = artifact.workloads[0].workloadId
  assert.throws(() => parseWso2LiveEvidence(artifact), /is duplicated/)
})

test('an unsupported path label is rejected', () => {
  const artifact = clone()
  artifact.workloads[0].rows[0].path = 'wso2-some-other-compressor'
  assert.throws(() => parseWso2LiveEvidence(artifact), /must be one of/)
})

test('model answer text cannot be smuggled into the artifact at any depth', () => {
  for (const mutate of [
    (artifact: Record<string, unknown>) => { (artifact as { reviewText?: string }).reviewText = 'leak' },
    (artifact: Record<string, unknown>) => {
      const workloads = artifact.workloads as { rows: Record<string, unknown>[] }[]
      workloads[0].rows[0].answer = 'leak'
    },
    (artifact: Record<string, unknown>) => {
      const workloads = artifact.workloads as Record<string, unknown>[]
      workloads[3].documents = ['leak']
    },
  ]) {
    const artifact = clone()
    mutate(artifact)
    assert.ok(findForbiddenKeys(artifact).length > 0)
    assert.throws(() => parseWso2LiveEvidence(artifact), /forbidden field/)
  }
})

test('a sanitization flag cannot be flipped to claim retention is allowed', () => {
  const artifact = clone()
  artifact.sanitization.modelAnswerTextRetained = true
  assert.throws(() => parseWso2LiveEvidence(artifact), /modelAnswerTextRetained must be false/)
})

test('both fact scores are carried, and they disagree — which is the point', () => {
  const artifact = loadWso2LiveEvidence()
  const maha = artifact.aggregates['wso2-maha-context-compiler']
  assert.equal(maha.adjudicatedFacts.total, 60)
  assert.equal(maha.deterministicFacts.total, 60)
  assert.notEqual(maha.adjudicatedFacts.answered, maha.deterministicFacts.answered)
  assert.ok(artifact.limitations.some((limitation) => /which one it is/i.test(limitation)))
})

test('a fact score claiming more answered than total is rejected', () => {
  const artifact = clone()
  artifact.workloads[0].rows[0].adjudicatedFacts.answered = 99
  assert.throws(() => parseWso2LiveEvidence(artifact), /cannot exceed/)
})

test('bypass is reported only where a bypass decision exists', () => {
  const artifact = loadWso2LiveEvidence()
  for (const workload of artifact.workloads) {
    for (const row of workload.rows) {
      if (row.path === 'wso2-maha-context-compiler') assert.equal(typeof row.bypassApplied, 'boolean')
      else assert.equal(row.bypassApplied, null)
    }
  }
  const broken = clone()
  broken.workloads[0].rows[0].bypassApplied = false
  assert.throws(() => parseWso2LiveEvidence(broken), /must be null outside the Maha path/)
})

test('the primary evidence is identified by digest and declared uncommitted', () => {
  const artifact = loadWso2LiveEvidence()
  assert.equal(artifact.generation.primaryEvidenceCommitted, false)
  for (const digest of [
    artifact.generation.sourceCheckpointSha256,
    artifact.generation.sourceAdjudicationSha256,
    artifact.generation.sourceAdjudicationKeySha256,
  ]) {
    assert.match(digest, /^sha256:[0-9a-f]{64}$/)
  }
})

test('cost formatting is exact at six decimals and never drifts through a float', () => {
  assert.equal(formatCostUsd(1_632_963), '1.632963')
  assert.equal(formatCostUsd(29_379), '0.029379')
  assert.equal(formatCostUsd(0), '0.000000')
  const artifact = loadWso2LiveEvidence()
  for (const path of WSO2_LIVE_EVIDENCE_PATHS) {
    assert.equal(artifact.aggregates[path].costUsd, formatCostUsd(artifact.aggregates[path].costMicrodollars))
  }
})
