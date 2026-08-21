/**
 * MCRB-1 additive release: a dense/embedding retrieval baseline.
 *
 * The v1 results are frozen. This runner does not touch them. It rebuilds the
 * same cohort from the same pinned corpus, asserts that cohort is byte-identical
 * to the checked-in v1 cohort, evaluates one additional method against it, and
 * writes a separate additive release.
 *
 *   npm run benchmark:mcrb1-dense
 *   npm run benchmark:mcrb1-dense:publish
 *
 * Offline:
 *   MCRB_QASPER_DEV_JSON=/abs/path/qasper-dev-v0.3.json HF_HUB_OFFLINE=1 npm run benchmark:mcrb1-dense
 */
import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { encode } from 'gpt-tokenizer'

import {
  CASE_COUNT,
  QASPER_ARCHIVE_SHA256,
  QASPER_URL,
  QASPER_VERSION,
  TOKEN_BUDGET,
  evaluate,
  fit,
  loadQasper,
  makeCases,
  render,
  round,
  sha256,
  summarize,
  type BenchmarkCase,
  type CaseResult,
} from '../lib/benchmarks/mcrb1-harness.ts'

export const DENSE_METHOD = 'dense_bge_small_en_v15'
export const DENSE_RELEASE_VERSION = '1.1.0-dense'
const WRITE = process.argv.includes('--write')
const RANKER = new URL('mcrb1_dense_rank.py', import.meta.url).pathname

type RankerOutput = {
  model: string; revision: string; dim: number; pooling: string; normalized: boolean
  maxTokens: number; queryPrefix: string; torch: string; numpy: string
  similarityDigest: string; cases: Record<string, number[]>
}

async function rank(cases: BenchmarkCase[]): Promise<RankerOutput> {
  const python = process.env.MCRB_DENSE_PYTHON ?? 'python3'
  const payload = JSON.stringify({
    cases: cases.map((testCase) => ({
      id: testCase.id,
      question: testCase.question,
      passages: testCase.passages.map((passage) => passage.text),
    })),
  })
  return await new Promise((resolve, reject) => {
    const child = spawn(python, [RANKER], { stdio: ['pipe', 'pipe', 'inherit'] })
    let out = ''
    child.stdout.setEncoding('utf8')
    child.stdout.on('data', (chunk) => { out += chunk })
    child.on('error', reject)
    child.on('close', (code) => {
      if (code !== 0) { reject(new Error(`dense ranker exited ${code}`)); return }
      try { resolve(JSON.parse(out) as RankerOutput) } catch (error) { reject(error) }
    })
    child.stdin.end(payload)
  })
}

/**
 * The additive release is only meaningful if it ran the same 250 cases. This
 * compares the rebuilt cohort against the frozen v1 cohort field by field and
 * refuses to publish on any difference.
 */
async function assertFrozenCohort(cases: BenchmarkCase[]): Promise<string> {
  const path = new URL('../benchmarks/mcrb-1/cohort.json', import.meta.url)
  const raw = await readFile(path, 'utf8')
  const frozen = JSON.parse(raw) as {
    questionId: string; paperId: string; inputSha256: string
    evidenceSetSha256: string[]; inputTokensBpe: number; evidencePosition: string
  }[]
  if (frozen.length !== cases.length) throw new Error(`cohort size ${cases.length} does not match the frozen ${frozen.length}`)
  cases.forEach((testCase, index) => {
    const entry = frozen[index]
    const problems: string[] = []
    if (entry.questionId !== testCase.id) problems.push('questionId')
    if (entry.paperId !== testCase.paperId) problems.push('paperId')
    if (entry.inputSha256 !== sha256(testCase.document)) problems.push('inputSha256')
    if (entry.inputTokensBpe !== testCase.inputTokens) problems.push('inputTokensBpe')
    if (entry.evidencePosition !== testCase.position) problems.push('evidencePosition')
    const rebuilt = testCase.evidenceSets.map((set) => sha256(JSON.stringify(set)))
    if (JSON.stringify(entry.evidenceSetSha256) !== JSON.stringify(rebuilt)) problems.push('evidenceSetSha256')
    if (problems.length > 0) throw new Error(`case ${index} (${entry.questionId}) differs from the frozen cohort: ${problems.join(', ')}`)
  })
  return `sha256:${createHash('sha256').update(raw).digest('hex')}`
}

function runDense(testCase: BenchmarkCase, order: number[]): CaseResult {
  const started = performance.now()
  if (order.length !== testCase.passages.length) {
    throw new Error(`ranker returned ${order.length} positions for ${testCase.passages.length} passages`)
  }
  const ordered = order.map((index) => testCase.passages[index])
  // Identical packer, identical budget, identical scorer as every other
  // extractive method in v1. Only the ordering above is new.
  const selected = fit(testCase.question, ordered)
  const output = render(testCase.question, selected)
  return evaluate(testCase, DENSE_METHOD, selected.map((passage) => passage.text).join('\n\n'), encode(output).length, performance.now() - started)
}

const dataset = await loadQasper()
const cases = makeCases(dataset)
const cohortDigest = await assertFrozenCohort(cases)

const embedStarted = performance.now()
const ranking = await rank(cases)
const embedSeconds = round((performance.now() - embedStarted) / 1_000, 1)

const rows = cases.map((testCase) => runDense(testCase, ranking.cases[testCase.id] ?? []))
const dense = summarize(DENSE_METHOD, rows)

const v1 = JSON.parse(await readFile(new URL('../benchmarks/mcrb-1/results.json', import.meta.url), 'utf8'))
const comparison = [...v1.results.map((entry: Record<string, unknown>) => ({
  method: entry.method,
  completeEvidenceSetPercent: entry.completeEvidenceSetPercent,
  completeEvidenceSetWilson95: entry.completeEvidenceSetWilson95,
  anyEvidenceHitPercent: entry.anyEvidenceHitPercent,
  meanEvidenceRecallPercent: entry.meanEvidenceRecallPercent,
  meanOutputTokens: entry.meanOutputTokens,
  meanReductionPercent: entry.meanReductionPercent,
  citationTraceabilityPercent: entry.citationTraceabilityPercent,
  latencyMs: entry.latencyMs,
  release: 'mcrb-1 v1.0.0 (frozen)',
})), {
  method: dense.method,
  completeEvidenceSetPercent: dense.completeEvidenceSetPercent,
  completeEvidenceSetWilson95: dense.completeEvidenceSetWilson95,
  anyEvidenceHitPercent: dense.anyEvidenceHitPercent,
  meanEvidenceRecallPercent: dense.meanEvidenceRecallPercent,
  meanOutputTokens: dense.meanOutputTokens,
  meanReductionPercent: dense.meanReductionPercent,
  citationTraceabilityPercent: dense.citationTraceabilityPercent,
  latencyMs: dense.latencyMs,
  release: DENSE_RELEASE_VERSION,
}]

const budgetViolations = rows.filter((row) => row.outputTokens > TOKEN_BUDGET).length
const emptySelections = rows.filter((row) => row.outputTokens === 0).length

const release = {
  benchmark: 'Maha Context Retention Benchmark',
  id: 'mcrb-1',
  release: DENSE_RELEASE_VERSION,
  additiveTo: { release: v1.version, measuredOn: v1.measuredOn, primaryMetric: v1.protocol.primaryMetric },
  measuredOn: new Date().toISOString().slice(0, 10),
  scope: 'A dense/embedding retrieval baseline evaluated on the frozen MCRB-1 cohort under the v1 budget and scorer. Retrieval only: no generative compression or reconstruction step.',
  dataset: {
    name: 'QASPER', version: QASPER_VERSION, license: 'CC BY 4.0',
    archiveUrl: QASPER_URL, archiveSha256: QASPER_ARCHIVE_SHA256, split: 'dev',
    cases: cases.length, expectedCases: CASE_COUNT, cohortSha256: cohortDigest,
    cohortVerifiedAgainstV1: true,
  },
  model: {
    name: ranking.model, revision: ranking.revision, embeddingDimension: ranking.dim,
    pooling: ranking.pooling, l2Normalized: ranking.normalized, maxTokens: ranking.maxTokens,
    queryPrefix: ranking.queryPrefix, similarity: 'cosine', similarityDigest: ranking.similarityDigest,
    license: 'MIT', source: `https://huggingface.co/${ranking.model}`,
    weightsCommitted: false,
  },
  environment: {
    node: process.version, platform: process.platform, arch: process.arch,
    torch: ranking.torch, numpy: ranking.numpy, seed: 0,
    embedWallClockSeconds: embedSeconds,
  },
  protocol: {
    declaredTokenBudget: TOKEN_BUDGET,
    tokenizer: 'gpt-tokenizer cl100k_base-compatible encode()',
    chunking: 'v1 harness passagesFor + splitLongParagraph, unchanged',
    packing: 'v1 harness fit(), unchanged',
    scoring: 'v1 harness evaluate(), exact-span containment, unchanged',
    tuningAfterInspection: 'none',
  },
  results: [dense],
  comparison,
  failureClasses: {
    budgetExceeded: budgetViolations,
    emptySelection: emptySelections,
    rankerShortfall: 0,
    casesEvaluated: rows.length,
  },
  limitations: [
    'Retrieval-only against context compilation is not a like-for-like comparison of systems. The corpus, budget, packer and scorer are identical; the approaches are not.',
    'One embedding model at one revision. It does not represent dense retrieval in general.',
    'Passages longer than 512 model tokens are truncated by the embedder before scoring; the packer still sees the full passage.',
    'Exact-span containment penalises paraphrase equally for every method, and is not generated-answer accuracy.',
    'Latency excludes embedding wall-clock, which is reported separately in environment.embedWallClockSeconds; the per-case figure measures ordering and packing only.',
    'Measured locally in one process. It is not a network or service-level measurement.',
  ],
}

if (WRITE) {
  for (const directory of [new URL('../benchmarks/mcrb-1/dense/', import.meta.url), new URL('../public/benchmarks/mcrb-1/dense/', import.meta.url)]) {
    await mkdir(directory, { recursive: true })
    await writeFile(new URL('results.json', directory), `${JSON.stringify(release, null, 2)}\n`)
    await writeFile(new URL('cases.jsonl', directory), `${rows.map((row) => JSON.stringify(row)).join('\n')}\n`)
  }
}

console.log(JSON.stringify(release, null, 2))
