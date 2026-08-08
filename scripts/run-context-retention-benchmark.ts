/**
 * Maha Context Retention Benchmark v1 (MCRB-1).
 *
 * Downloads the pinned CC BY 4.0 QASPER development split, selects a
 * deterministic cohort of independently written questions with human evidence
 * annotations, and compares fixed-budget extractive context selectors.
 *
 * Run without writing repository files:
 *   npm run benchmark:context-retention
 *
 * Regenerate the checked-in publication artifacts:
 *   npm run benchmark:context-retention:publish
 */

import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { gunzipSync } from 'node:zlib'

import { encode } from 'gpt-tokenizer'

import { compileContextPack, estimateTokens, parseContextPackRequest } from '../lib/context-compiler.ts'

const VERSION = '1.0.0'
const QASPER_VERSION = '0.3.0'
const QASPER_URL = 'https://qasper-dataset.s3.us-west-2.amazonaws.com/qasper-train-dev-v0.3.tgz'
const QASPER_ARCHIVE_SHA256 = 'a28fdf966db827bcee3d873107d6b6669864fb7ca8fbf73a192f5e39191bdb5a'
const QASPER_DEV_FILE = 'qasper-dev-v0.3.json'
const CASE_COUNT = 250
const TOKEN_BUDGET = 2_048
const SELECTION_BUDGET = Math.floor(TOKEN_BUDGET * 0.72)
const MAX_INPUT_BYTES = 525_000
const MIN_INPUT_TOKENS = TOKEN_BUDGET * 2
const WRITE_RESULTS = process.argv.includes('--write')

type QasperAnswer = {
  answer: {
    unanswerable: boolean
    highlighted_evidence?: string[]
  }
}

type QasperQuestion = {
  question: string
  question_id: string
  answers: QasperAnswer[]
}

type QasperPaper = {
  title: string
  abstract: string
  full_text: Array<{ section_name: string; paragraphs: string[] }>
  qas: QasperQuestion[]
}

type Passage = {
  id: string
  section: string
  text: string
}

type BenchmarkCase = {
  id: string
  paperId: string
  title: string
  question: string
  document: string
  passages: Passage[]
  evidenceSets: string[][]
  inputTokens: number
  inputBytes: number
  position: 'front' | 'middle' | 'back'
}

type MethodId = 'maha_bm25' | 'maha_keyword' | 'front_truncation' | 'tail_recency' | 'seeded_random' | 'oracle_ceiling'

type CaseResult = {
  caseId: string
  paperId: string
  method: MethodId
  inputTokens: number
  outputTokens: number
  reductionPercent: number
  evidenceRecall: number
  completeEvidenceSet: boolean
  anyEvidenceHit: boolean
  citationTraceabilityPercent: number
  latencyMs: number
  evidencePosition: BenchmarkCase['position']
}

function sha256(value: string | Uint8Array): string {
  return createHash('sha256').update(value).digest('hex')
}

function normalize(value: string): string {
  return value.replace(/\r\n?/g, '\n').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim()
}

function round(value: number, places = 2): number {
  return Number(value.toFixed(places))
}

function percentile(values: number[], quantile: number): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * quantile) - 1))]
}

function wilson(successes: number, total: number): { low: number; high: number } {
  if (total === 0) return { low: 0, high: 0 }
  const z = 1.959963984540054
  const p = successes / total
  const denominator = 1 + (z * z) / total
  const center = (p + (z * z) / (2 * total)) / denominator
  const margin = (z * Math.sqrt((p * (1 - p)) / total + (z * z) / (4 * total * total))) / denominator
  return { low: round(Math.max(0, center - margin) * 100, 1), high: round(Math.min(1, center + margin) * 100, 1) }
}

function extractTarEntry(gzip: Uint8Array, wanted: string): Uint8Array {
  const tar = gunzipSync(gzip)
  for (let offset = 0; offset + 512 <= tar.length;) {
    const name = tar.subarray(offset, offset + 100).toString('utf8').replace(/\0.*$/, '')
    if (!name) break
    const sizeText = tar.subarray(offset + 124, offset + 136).toString('ascii').replace(/\0.*$/, '').trim()
    const size = Number.parseInt(sizeText || '0', 8)
    const start = offset + 512
    if (name === wanted) return tar.subarray(start, start + size)
    offset = start + Math.ceil(size / 512) * 512
  }
  throw new Error(`${wanted} was not present in the pinned QASPER archive.`)
}

async function loadQasper(): Promise<Record<string, QasperPaper>> {
  const supplied = process.env.MCRB_QASPER_DEV_JSON?.trim()
  if (supplied) return JSON.parse(await readFile(supplied, 'utf8')) as Record<string, QasperPaper>

  const cacheDirectory = join(tmpdir(), 'maha-mcrb-1')
  const cacheFile = join(cacheDirectory, QASPER_DEV_FILE)
  try {
    return JSON.parse(await readFile(cacheFile, 'utf8')) as Record<string, QasperPaper>
  } catch {
    // Cache miss. The archive is content-addressed below before extraction.
  }

  const response = await fetch(QASPER_URL)
  if (!response.ok) throw new Error(`QASPER download failed with HTTP ${response.status}.`)
  const archive = new Uint8Array(await response.arrayBuffer())
  if (sha256(archive) !== QASPER_ARCHIVE_SHA256) throw new Error('QASPER archive checksum did not match the pinned manifest.')
  const data = extractTarEntry(archive, QASPER_DEV_FILE)
  await mkdir(cacheDirectory, { recursive: true })
  await writeFile(cacheFile, data)
  return JSON.parse(Buffer.from(data).toString('utf8')) as Record<string, QasperPaper>
}

function splitLongParagraph(value: string): string[] {
  if (value.length <= 1_600) return [value]
  return value.match(/[^.!?]+[.!?]+(?:\s|$)|.{1,1200}(?:\s|$)/g) ?? [value]
}

function passagesFor(paper: QasperPaper): Passage[] {
  const sections = [
    ...(paper.abstract ? [{ section_name: 'Abstract', paragraphs: [paper.abstract] }] : []),
    ...paper.full_text,
  ]
  const passages: Passage[] = []
  for (const [sectionIndex, section] of sections.entries()) {
    for (const [paragraphIndex, paragraph] of section.paragraphs.entries()) {
      for (const [partIndex, part] of splitLongParagraph(normalize(paragraph)).entries()) {
        if (!part) continue
        passages.push({
          id: `s${sectionIndex + 1}:p${paragraphIndex + 1}:${partIndex + 1}`,
          section: section.section_name || `Section ${sectionIndex + 1}`,
          text: part,
        })
      }
    }
  }
  return passages
}

function evidenceSetsFor(question: QasperQuestion, document: string): string[][] {
  const source = normalize(document)
  const seen = new Set<string>()
  const sets: string[][] = []
  for (const annotation of question.answers) {
    if (annotation.answer.unanswerable) continue
    const spans = [...new Set((annotation.answer.highlighted_evidence ?? []).map(normalize).filter((span) => span.length >= 3 && source.includes(span)))]
    if (spans.length === 0) continue
    const key = JSON.stringify(spans)
    if (!seen.has(key)) { seen.add(key); sets.push(spans) }
  }
  return sets
}

function evidencePosition(document: string, sets: string[][]): BenchmarkCase['position'] {
  const normalized = normalize(document)
  const offsets = sets.flatMap((set) => set.map((span) => normalized.indexOf(span))).filter((offset) => offset >= 0)
  const ratio = Math.min(...offsets) / Math.max(1, normalized.length)
  return ratio < 1 / 3 ? 'front' : ratio < 2 / 3 ? 'middle' : 'back'
}

function makeCases(dataset: Record<string, QasperPaper>): BenchmarkCase[] {
  const candidates: BenchmarkCase[] = []
  for (const [paperId, paper] of Object.entries(dataset)) {
    const passages = passagesFor(paper)
    const document = passages.map((passage) => `[${passage.section}]\n${passage.text}`).join('\n\n')
    const inputBytes = Buffer.byteLength(document, 'utf8')
    const inputTokens = encode(document).length
    if (inputBytes > MAX_INPUT_BYTES || inputTokens < MIN_INPUT_TOKENS) continue
    for (const question of paper.qas) {
      const evidenceSets = evidenceSetsFor(question, document)
      if (evidenceSets.length === 0) continue
      candidates.push({
        id: question.question_id,
        paperId,
        title: paper.title,
        question: normalize(question.question),
        document,
        passages,
        evidenceSets,
        inputTokens,
        inputBytes,
        position: evidencePosition(document, evidenceSets),
      })
    }
  }
  const selected = candidates.sort((left, right) => sha256(left.id).localeCompare(sha256(right.id))).slice(0, CASE_COUNT)
  if (selected.length !== CASE_COUNT) throw new Error(`Only ${selected.length} eligible QASPER cases were found; expected ${CASE_COUNT}.`)
  return selected
}

function render(question: string, passages: Passage[]): string {
  return ['# Context Pack', `Task: ${question}`, '', ...passages.map((passage) => `[paper:${passage.id}] ${passage.text}`)].join('\n\n')
}

function fit(question: string, ordered: Passage[]): Passage[] {
  const selected: Passage[] = []
  for (const passage of ordered) {
    const candidate = [...selected, passage]
    if (estimateTokens(render(question, candidate)) <= SELECTION_BUDGET) selected.push(passage)
  }
  return selected
}

function seededOrder(passages: Passage[], seed: string): Passage[] {
  let state = Number.parseInt(sha256(seed).slice(0, 8), 16) >>> 0
  const random = () => {
    state ^= state << 13; state ^= state >>> 17; state ^= state << 5
    return (state >>> 0) / 0x100000000
  }
  const shuffled = [...passages]
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1))
    ;[shuffled[index], shuffled[target]] = [shuffled[target], shuffled[index]]
  }
  return shuffled
}

function oracleOrder(testCase: BenchmarkCase): Passage[] {
  const evidence = new Set(testCase.evidenceSets.flat())
  return [...testCase.passages].sort((left, right) => {
    const leftGold = [...evidence].some((span) => normalize(left.text).includes(span)) ? 1 : 0
    const rightGold = [...evidence].some((span) => normalize(right.text).includes(span)) ? 1 : 0
    return rightGold - leftGold || left.id.localeCompare(right.id)
  })
}

function evaluate(testCase: BenchmarkCase, method: MethodId, selectedText: string, outputTokens: number, latencyMs: number): CaseResult {
  const retained = (span: string) => normalize(selectedText).includes(span)
  const recalls = testCase.evidenceSets.map((set) => set.filter(retained).length / set.length)
  const bestRecall = Math.max(...recalls)
  return {
    caseId: testCase.id,
    paperId: testCase.paperId,
    method,
    inputTokens: testCase.inputTokens,
    outputTokens,
    reductionPercent: round(Math.max(0, (1 - outputTokens / testCase.inputTokens) * 100), 2),
    evidenceRecall: round(bestRecall * 100, 2),
    completeEvidenceSet: recalls.some((recall) => recall === 1),
    anyEvidenceHit: recalls.some((recall) => recall > 0),
    citationTraceabilityPercent: 100,
    latencyMs: round(latencyMs, 4),
    evidencePosition: testCase.position,
  }
}

function runMethod(testCase: BenchmarkCase, method: MethodId): CaseResult {
  const started = performance.now()
  if (method === 'maha_bm25' || method === 'maha_keyword') {
    const compiled = compileContextPack(parseContextPackRequest({
      clientRequestId: `mcrb_${testCase.id}`,
      task: testCase.question,
      tokenBudget: TOKEN_BUDGET,
      documents: [{ id: 'paper', title: testCase.title, text: testCase.document }],
      provenance: 'compact',
      scoring: method === 'maha_bm25' ? 'bm25' : 'keyword',
      budgetMode: 'guaranteed',
    }))
    return evaluate(testCase, method, compiled.includedPassages.map((passage) => passage.text).join('\n\n'), encode(compiled.context).length, performance.now() - started)
  }

  const order = method === 'front_truncation'
    ? testCase.passages
    : method === 'tail_recency'
      ? [...testCase.passages].reverse()
      : method === 'seeded_random'
        ? seededOrder(testCase.passages, testCase.id)
        : oracleOrder(testCase)
  const selected = fit(testCase.question, order)
  const output = render(testCase.question, selected)
  return evaluate(testCase, method, selected.map((passage) => passage.text).join('\n\n'), encode(output).length, performance.now() - started)
}

function summarize(method: MethodId, rows: CaseResult[]) {
  const complete = rows.filter((row) => row.completeEvidenceSet).length
  const any = rows.filter((row) => row.anyEvidenceHit).length
  const byPosition = Object.fromEntries((['front', 'middle', 'back'] as const).map((position) => {
    const subset = rows.filter((row) => row.evidencePosition === position)
    return [position, {
      cases: subset.length,
      completeEvidenceSetPercent: round(subset.filter((row) => row.completeEvidenceSet).length / Math.max(1, subset.length) * 100, 1),
      meanEvidenceRecallPercent: round(subset.reduce((sum, row) => sum + row.evidenceRecall, 0) / Math.max(1, subset.length), 1),
    }]
  }))
  return {
    method,
    cases: rows.length,
    completeEvidenceSetPercent: round(complete / rows.length * 100, 1),
    completeEvidenceSetWilson95: wilson(complete, rows.length),
    anyEvidenceHitPercent: round(any / rows.length * 100, 1),
    anyEvidenceHitWilson95: wilson(any, rows.length),
    meanEvidenceRecallPercent: round(rows.reduce((sum, row) => sum + row.evidenceRecall, 0) / rows.length, 1),
    meanOutputTokens: round(rows.reduce((sum, row) => sum + row.outputTokens, 0) / rows.length, 1),
    meanReductionPercent: round(rows.reduce((sum, row) => sum + row.reductionPercent, 0) / rows.length, 1),
    citationTraceabilityPercent: 100,
    latencyMs: {
      p50: round(percentile(rows.map((row) => row.latencyMs), 0.5), 2),
      p95: round(percentile(rows.map((row) => row.latencyMs), 0.95), 2),
    },
    byEvidencePosition: byPosition,
  }
}

const dataset = await loadQasper()
const cases = makeCases(dataset)
const methods: MethodId[] = ['maha_bm25', 'maha_keyword', 'front_truncation', 'tail_recency', 'seeded_random', 'oracle_ceiling']
const caseResults = cases.flatMap((testCase) => methods.map((method) => runMethod(testCase, method)))
const aggregate = methods.map((method) => summarize(method, caseResults.filter((row) => row.method === method)))
const meanInputTokens = cases.reduce((sum, testCase) => sum + testCase.inputTokens, 0) / cases.length
const maha = aggregate.find((result) => result.method === 'maha_bm25')!
const averageTokensAvoided = meanInputTokens - maha.meanOutputTokens
const referenceInputPrice = 3
const result = {
  benchmark: 'Maha Context Retention Benchmark',
  id: 'mcrb-1',
  version: VERSION,
  measuredOn: new Date().toISOString().slice(0, 10),
  scope: 'Fixed-budget extractive context selection. This benchmark does not measure generated-answer accuracy or factuality.',
  dataset: {
    name: 'QASPER',
    version: QASPER_VERSION,
    license: 'CC BY 4.0',
    source: 'https://allenai.org/data/qasper',
    archiveUrl: QASPER_URL,
    archiveSha256: QASPER_ARCHIVE_SHA256,
    split: 'dev',
    selection: `First ${CASE_COUNT} eligible answerable questions ordered by SHA-256(question_id).`,
    cases: cases.length,
    uniquePapers: new Set(cases.map((testCase) => testCase.paperId)).size,
    meanInputTokensBpe: round(meanInputTokens, 1),
    evidencePositionCounts: Object.fromEntries((['front', 'middle', 'back'] as const).map((position) => [position, cases.filter((testCase) => testCase.position === position).length])),
  },
  protocol: {
    declaredTokenBudget: TOKEN_BUDGET,
    tokenizer: 'gpt-tokenizer cl100k_base-compatible encode()',
    mahaMode: { scoring: 'bm25', provenance: 'compact', budgetMode: 'guaranteed' },
    methods,
    primaryMetric: 'completeEvidenceSetPercent',
  },
  results: aggregate,
  economics: {
    referenceInputPriceUsdPerMillionTokens: referenceInputPrice,
    productionX402FeeUsd: 0.001,
    mahaMeanInputTokensAvoided: round(averageTokensAvoided, 1),
    mahaGrossInputCostAvoidedUsd: round(averageTokensAvoided / 1_000_000 * referenceInputPrice, 6),
    mahaNetInputCostAvoidedAfterFeeUsd: round(averageTokensAvoided / 1_000_000 * referenceInputPrice - 0.001, 6),
    scope: 'Input-token cost only. Output generation cost is excluded equally from every method.',
  },
  limitations: [
    'QASPER contains NLP research papers and does not represent every enterprise or agent workload.',
    'Evidence retention is exact-span containment against independent human annotations; it is not generated-answer accuracy.',
    'All evaluated methods are extractive and therefore retain stable passage citations. Generative summarizers require a separate answer-quality protocol.',
    'Latency was measured locally in one process and is useful for relative algorithmic comparison, not a network SLA.',
    'The oracle is an unattainable upper bound that ranks known gold evidence first, not a deployable competitor.',
  ],
}

if (WRITE_RESULTS) {
  const directory = new URL('../benchmarks/mcrb-1/', import.meta.url)
  const publicDirectory = new URL('../public/benchmarks/mcrb-1/', import.meta.url)
  await mkdir(directory, { recursive: true })
  await mkdir(publicDirectory, { recursive: true })
  const resultJson = `${JSON.stringify(result, null, 2)}\n`
  const casesJsonl = `${caseResults.map((row) => JSON.stringify(row)).join('\n')}\n`
  const cohortJson = `${JSON.stringify(cases.map((testCase) => ({
    questionId: testCase.id,
    paperId: testCase.paperId,
    question: testCase.question,
    inputSha256: sha256(testCase.document),
    evidenceSetSha256: testCase.evidenceSets.map((set) => sha256(JSON.stringify(set))),
    inputTokensBpe: testCase.inputTokens,
    evidencePosition: testCase.position,
  })), null, 2)}\n`
  for (const outputDirectory of [directory, publicDirectory]) {
    await writeFile(new URL('results.json', outputDirectory), resultJson)
    await writeFile(new URL('cases.jsonl', outputDirectory), casesJsonl)
    await writeFile(new URL('cohort.json', outputDirectory), cohortJson)
  }
}

console.log(JSON.stringify(result, null, 2))
