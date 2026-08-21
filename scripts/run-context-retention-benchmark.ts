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

import { mkdir, writeFile } from 'node:fs/promises'

import {
  CASE_COUNT,
  MAX_INPUT_BYTES,
  QASPER_ARCHIVE_SHA256,
  QASPER_URL,
  QASPER_VERSION,
  TOKEN_BUDGET,
  VERSION,
  loadQasper,
  makeCases,
  round,
  runMethod,
  sha256,
  summarize,
  type Mcrb1MethodV1,
} from '../lib/benchmarks/mcrb1-harness.ts'

// The v1 method list stays here. The harness is shared with the additive dense
// baseline runner; this list is the frozen v1 release and does not grow.
const WRITE_RESULTS = process.argv.includes('--write')

const dataset = await loadQasper()
const cases = makeCases(dataset)
const methods: Mcrb1MethodV1[] = ['maha_bm25', 'maha_keyword', 'front_truncation', 'tail_recency', 'seeded_random', 'oracle_ceiling']
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
    maximumInputBytes: MAX_INPUT_BYTES,
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
