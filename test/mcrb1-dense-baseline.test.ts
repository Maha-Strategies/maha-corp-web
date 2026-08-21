import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

import {
  CASE_COUNT,
  SELECTION_BUDGET,
  TOKEN_BUDGET,
  estimateTokensProxy,
  fit,
  render,
  sha256,
  wilson,
} from '../lib/benchmarks/mcrb1-harness.ts'

const ROOT = join(import.meta.dirname, '..')
const DENSE_RESULTS = join(ROOT, 'benchmarks/mcrb-1/dense/results.json')
const DENSE_CASES = join(ROOT, 'benchmarks/mcrb-1/dense/cases.jsonl')
const DENSE_MANIFEST = join(ROOT, 'benchmarks/mcrb-1/dense/manifest.json')
const V1_RESULTS = join(ROOT, 'benchmarks/mcrb-1/results.json')
const V1_COHORT = join(ROOT, 'benchmarks/mcrb-1/cohort.json')

const published = existsSync(DENSE_RESULTS)
const results = () => JSON.parse(readFileSync(DENSE_RESULTS, 'utf8'))
const rows = () => readFileSync(DENSE_CASES, 'utf8').trim().split('\n').map((line) => JSON.parse(line))

/** Ordering and packing must not depend on anything but the inputs. */
test('the packer is deterministic and never exceeds the selection allowance', () => {
  const passages = Array.from({ length: 40 }, (_, index) => ({
    id: `s1:p${index + 1}:1`,
    section: 'Body',
    text: `Passage ${index} about retrieval budgets and evidence spans. `.repeat(6),
  }))
  const question = 'Which passage describes the evidence budget?'
  const first = fit(question, passages)
  const second = fit(question, passages)
  assert.deepEqual(first.map((p) => p.id), second.map((p) => p.id), 'packing is not deterministic')
  assert.ok(first.length > 0)
  assert.ok(
    estimateTokensProxy(render(question, first)) <= SELECTION_BUDGET,
    'packed context exceeds the v1 selection allowance',
  )
})

test('a different ordering yields a different pack, so ordering is what the baseline changes', () => {
  const passages = Array.from({ length: 12 }, (_, index) => ({
    id: `s1:p${index + 1}:1`, section: 'Body', text: `Distinct passage ${index}. `.repeat(60),
  }))
  const question = 'anything'
  const forward = fit(question, passages).map((p) => p.id)
  const reversed = fit(question, [...passages].reverse()).map((p) => p.id)
  assert.notDeepEqual(forward, reversed)
})

test('the tie-break used by the ranker is total and index-ordered', () => {
  // Mirrors scripts/mcrb1_dense_rank.py: (-similarity, index).
  const similarities = [0.5, 0.9, 0.5, 0.9, 0.1]
  const order = [...similarities.keys()].sort((a, b) => (similarities[b] - similarities[a]) || (a - b))
  assert.deepEqual(order, [1, 3, 0, 2, 4], 'equal scores must fall back to original index')
})

test('the v1 release is untouched by this work', () => {
  const v1 = JSON.parse(readFileSync(V1_RESULTS, 'utf8'))
  assert.equal(v1.version, '1.0.0')
  assert.equal(v1.id, 'mcrb-1')
  const methods = v1.results.map((entry: { method: string }) => entry.method)
  assert.deepEqual(methods, ['maha_bm25', 'maha_keyword', 'front_truncation', 'tail_recency', 'seeded_random', 'oracle_ceiling'],
    'the frozen v1 method list changed')
  assert.equal(v1.results.length, 6, 'the dense method must not be added to the v1 release')
})

test('the frozen cohort still describes 250 cases', () => {
  const cohort = JSON.parse(readFileSync(V1_COHORT, 'utf8'))
  assert.equal(cohort.length, CASE_COUNT)
  for (const entry of cohort) {
    assert.match(entry.inputSha256, /^[0-9a-f]{64}$/)
    assert.ok(entry.evidenceSetSha256.length > 0)
  }
})

test('Wilson intervals behave, so published intervals mean what they say', () => {
  const interval = wilson(151, 250)
  assert.ok(interval.low < 60.4 && interval.high > 60.4)
  const certain = wilson(250, 250)
  assert.ok(certain.high <= 100 && certain.low > 95)
})

test('the harness digest is stable and bare hex, as the frozen cohort records it', () => {
  assert.equal(sha256('mcrb'), sha256('mcrb'))
  // Bare hex, not the context compiler's `sha256:` form. The frozen cohort was
  // written with this shape and the runner compares against it directly.
  assert.match(sha256('mcrb'), /^[0-9a-f]{64}$/)
})

test('the offline contract is documented and credential-free', () => {
  const runner = readFileSync(join(ROOT, 'scripts/run-mcrb1-dense-baseline.ts'), 'utf8')
  const ranker = readFileSync(join(ROOT, 'scripts/mcrb1_dense_rank.py'), 'utf8')
  assert.match(runner, /MCRB_QASPER_DEV_JSON/)
  assert.match(runner, /HF_HUB_OFFLINE=1/)
  assert.match(ranker, /HF_HUB_OFFLINE/)
  // No paid API, no provider inference, no credential anywhere in the path.
  for (const forbidden of ['api_key', 'API_KEY', 'ANTHROPIC', 'OPENAI', 'Authorization', 'Bearer ']) {
    assert.ok(!ranker.includes(forbidden), `ranker references ${forbidden}`)
    assert.ok(!runner.includes(forbidden), `runner references ${forbidden}`)
  }
})

test('model weights and embedding caches are never committed', () => {
  for (const path of ['benchmarks/mcrb-1/dense/model.safetensors', 'benchmarks/mcrb-1/dense/embeddings.npy', 'benchmarks/mcrb-1/dense/cache']) {
    assert.ok(!existsSync(join(ROOT, path)), `${path} must not be committed`)
  }
})

test('published dense results carry a complete, schema-valid release', { skip: !published }, () => {
  const release = results()
  assert.equal(release.id, 'mcrb-1')
  assert.equal(release.release, '1.1.0-dense')
  assert.equal(release.additiveTo.release, '1.0.0')
  assert.equal(release.dataset.archiveSha256, 'a28fdf966db827bcee3d873107d6b6669864fb7ca8fbf73a192f5e39191bdb5a')
  assert.equal(release.dataset.cases, CASE_COUNT)
  assert.equal(release.dataset.cohortVerifiedAgainstV1, true)
  assert.match(release.dataset.cohortSha256, /^sha256:[0-9a-f]{64}$/)

  assert.equal(release.model.name, 'BAAI/bge-small-en-v1.5')
  assert.equal(release.model.revision, '5c38ec7c405ec4b44b94cc5a9bb96e735b38267a')
  assert.equal(release.model.embeddingDimension, 384)
  assert.equal(release.model.pooling, 'cls')
  assert.equal(release.model.l2Normalized, true)
  assert.equal(release.model.similarity, 'cosine')
  assert.equal(release.model.weightsCommitted, false)
  assert.match(release.model.similarityDigest, /^sha256:[0-9a-f]{64}$/)

  for (const field of ['node', 'platform', 'arch', 'torch', 'numpy', 'seed']) {
    assert.ok(release.environment[field] !== undefined, `environment.${field} missing`)
  }
  assert.equal(release.protocol.tuningAfterInspection, 'none')
  assert.equal(release.protocol.declaredTokenBudget, TOKEN_BUDGET)
})

test('every case in the frozen cohort was evaluated, not a subset', { skip: !published }, () => {
  const cohort = JSON.parse(readFileSync(V1_COHORT, 'utf8'))
  const evaluated = rows()
  assert.equal(evaluated.length, CASE_COUNT)
  assert.deepEqual(
    evaluated.map((row: { caseId: string }) => row.caseId).sort(),
    cohort.map((entry: { questionId: string }) => entry.questionId).sort(),
    'the dense run did not cover exactly the frozen cohort',
  )
})

test('no published case breaches the declared budget', { skip: !published }, () => {
  for (const row of rows()) {
    assert.ok(row.outputTokens <= TOKEN_BUDGET, `case ${row.caseId} emitted ${row.outputTokens} tokens`)
  }
  assert.equal(results().failureClasses.budgetExceeded, 0)
})

test('aggregates re-derive from the published per-case rows', { skip: !published }, () => {
  const evaluated = rows()
  const dense = results().results[0]
  const complete = evaluated.filter((row: { completeEvidenceSet: boolean }) => row.completeEvidenceSet).length
  assert.equal(dense.completeEvidenceSetPercent, Math.round(complete / evaluated.length * 1000) / 10)
  const any = evaluated.filter((row: { anyEvidenceHit: boolean }) => row.anyEvidenceHit).length
  assert.equal(dense.anyEvidenceHitPercent, Math.round(any / evaluated.length * 1000) / 10)
  assert.deepEqual(dense.completeEvidenceSetWilson95, wilson(complete, evaluated.length))
})

test('the comparison table carries every v1 method plus the dense one', { skip: !published }, () => {
  const release = results()
  const methods = release.comparison.map((entry: { method: string }) => entry.method)
  for (const required of ['maha_bm25', 'maha_keyword', 'front_truncation', 'tail_recency', 'seeded_random', 'oracle_ceiling', 'dense_bge_small_en_v15']) {
    assert.ok(methods.includes(required), `comparison is missing ${required}`)
  }
  const frozen = release.comparison.filter((entry: { release: string }) => entry.release.startsWith('mcrb-1 v1.0.0'))
  assert.equal(frozen.length, 6, 'v1 rows must be carried through verbatim')
})

test('the release states its fairness limits rather than claiming superiority', { skip: !published }, () => {
  const release = results()
  const limitations = release.limitations.join(' ')
  assert.match(limitations, /not a like-for-like comparison/i)
  assert.match(limitations, /One embedding model at one revision/i)
  assert.match(limitations, /truncated/i)
  const text = JSON.stringify(release)
  for (const banned of ['state of the art', 'state-of-the-art', 'outperforms', 'best-in-class', 'superior to']) {
    assert.ok(!text.toLowerCase().includes(banned), `release claims "${banned}"`)
  }
})

test('the manifest binds corpus, results, model and environment', { skip: !published || !existsSync(DENSE_MANIFEST) }, () => {
  const manifest = JSON.parse(readFileSync(DENSE_MANIFEST, 'utf8'))
  assert.equal(manifest.corpus.archiveSha256, 'a28fdf966db827bcee3d873107d6b6669864fb7ca8fbf73a192f5e39191bdb5a')
  assert.match(manifest.artifacts.results.sha256, /^sha256:[0-9a-f]{64}$/)
  assert.match(manifest.artifacts.cases.sha256, /^sha256:[0-9a-f]{64}$/)
  assert.equal(manifest.model.revision, '5c38ec7c405ec4b44b94cc5a9bb96e735b38267a')
  assert.equal(manifest.model.weightsCommitted, false)
  assert.ok(manifest.runnerCommand.includes('benchmark:mcrb1-dense'))
  // The recorded digests must match the files on disk.
  const digest = (path: string) => `sha256:${createHash('sha256').update(readFileSync(path)).digest('hex')}`
  assert.equal(manifest.artifacts.results.sha256, digest(DENSE_RESULTS))
  assert.equal(manifest.artifacts.cases.sha256, digest(DENSE_CASES))
})
