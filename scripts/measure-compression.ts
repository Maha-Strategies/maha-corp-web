/**
 * Measures what /api/v1/compress actually does to real-shaped payloads.
 *
 *   node --experimental-strip-types scripts/measure-compression.ts
 *   node --experimental-strip-types scripts/measure-compression.ts --json
 *   node --experimental-strip-types scripts/measure-compression.ts --corpus ./my-logs
 *
 * The point is to replace a projection with a measurement. Three things are
 * measured and they are not equally meaningful:
 *
 *   Reduction     Real, but the CALLER sets tokenBudget, so this is an input
 *                 parameter, not a property of the compiler. Asking for a
 *                 smaller pack always "reduces" more. Reported because the
 *                 economics depend on it, but it is not a quality claim.
 *
 *   Retention     Whether the passages carrying the answer survive. This is
 *                 the actual product claim and the only one a customer can
 *                 be disappointed by.
 *
 *   Latency       Compute time only. Network and, if payment is on the hot
 *                 path, settlement dominate the end-to-end figure. See the
 *                 note printed at the end.
 *
 * Token counts are real BPE, not the service's internal estimate. The service
 * says so itself: its own counter is "model-neutral" and "must not be used for
 * billing." Both are reported so the gap is visible.
 */

import { readFile } from 'node:fs/promises'

import { encode } from 'gpt-tokenizer'

import { compileContextPack, estimateTokens } from '../lib/context-compiler.ts'
import { CORPORA, loadCorporaFrom, type Corpus } from './compression-corpus.ts'

const AS_JSON = process.argv.includes('--json')
const corpusDirectory = process.argv[process.argv.indexOf('--corpus') + 1]
const USING_REAL_DATA = process.argv.includes('--corpus')

/** Budgets to sweep. The service caps tokenBudget at 16,000. */
const BUDGETS = [1_000, 2_000, 4_000, 8_000, 16_000]
const LATENCY_RUNS = 25

type Pricing = {
  _verifiedOn: string | null
  models: Array<{ id: string; label: string; inputPerMillionUsd: number; verified: boolean }>
  feeTiersUsd: number[]
}

type Measurement = {
  corpus: string
  budget: number
  inputTokens: number
  outputTokens: number
  savedTokens: number
  reductionPercent: number
  internalEstimateInput: number
  needlesRetained: number
  needlesTotal: number
  latencyP50Ms: number
  latencyP95Ms: number
}

const bpe = (text: string) => encode(text).length
const percentile = (sorted: number[], p: number) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))]
const usd = (value: number) => (value >= 0 ? ' ' : '-') + '$' + Math.abs(value).toFixed(4)

function measure(corpus: Corpus, budget: number): Measurement {
  const request = {
    clientRequestId: `measure-${corpus.name}-${budget}`,
    task: corpus.task,
    tokenBudget: budget,
    documents: corpus.documents,
  }

  const durations: number[] = []
  let pack = compileContextPack(request)
  for (let run = 0; run < LATENCY_RUNS; run += 1) {
    const started = performance.now()
    pack = compileContextPack(request)
    durations.push(performance.now() - started)
  }
  durations.sort((left, right) => left - right)

  const inputText = corpus.documents.map((document) => document.text).join('\n\n')
  const inputTokens = bpe(inputText)
  const outputTokens = bpe(pack.context)

  // Substring containment, deliberately. A needle that survived but was
  // reworded is not something this compiler can do -- it selects passages
  // verbatim -- so an exact check is the honest test.
  const needlesRetained = corpus.needles.filter((needle) => pack.context.includes(needle)).length

  return {
    corpus: corpus.name,
    budget,
    inputTokens,
    outputTokens,
    savedTokens: Math.max(0, inputTokens - outputTokens),
    reductionPercent: inputTokens > 0 ? ((inputTokens - outputTokens) / inputTokens) * 100 : 0,
    internalEstimateInput: estimateTokens(inputText),
    needlesRetained,
    needlesTotal: corpus.needles.length,
    latencyP50Ms: percentile(durations, 0.5),
    latencyP95Ms: percentile(durations, 0.95),
  }
}

/** Input tokens at which the saving exactly covers the fee. Below it, the caller loses money. */
function breakevenInputTokens(reductionFraction: number, feeUsd: number, pricePerMillion: number): number | null {
  if (reductionFraction <= 0 || pricePerMillion <= 0) return null
  return (feeUsd * 1_000_000) / (pricePerMillion * reductionFraction)
}

function table(rows: string[][], headers: string[]): string {
  const widths = headers.map((header, column) =>
    Math.max(header.length, ...rows.map((row) => (row[column] ?? '').length)))
  const line = (cells: string[]) => cells.map((cell, column) => (cell ?? '').padEnd(widths[column])).join('  ')
  return [line(headers), widths.map((width) => '-'.repeat(width)).join('  '), ...rows.map(line)].join('\n')
}

const pricing = JSON.parse(await readFile(new URL('./model-pricing.json', import.meta.url), 'utf8')) as Pricing
const corpora = USING_REAL_DATA ? await loadCorporaFrom(corpusDirectory) : CORPORA
const measurements = corpora.flatMap((corpus) => BUDGETS.map((budget) => measure(corpus, budget)))

if (AS_JSON) {
  console.log(JSON.stringify({ pricing, measurements, usingRealData: USING_REAL_DATA }, null, 2))
  process.exit(0)
}

console.log('\n' + '='.repeat(78))
console.log('COMPRESSION MEASUREMENT — /api/v1/compress')
console.log('='.repeat(78))

if (!USING_REAL_DATA) {
  console.log('\n  ⚠  SYNTHETIC CORPUS. These payloads are written to the shape of real')
  console.log('     agent logs, scrapes, SQL dumps and RAG retrievals, but they are not')
  console.log('     real traffic. Do not quote these numbers externally. Re-run with')
  console.log('     --corpus <dir> against real logs before they inform pricing.')
}
if (!pricing._verifiedOn) {
  console.log('\n  ⚠  MODEL PRICES ARE UNVERIFIED PLACEHOLDERS. Check scripts/model-pricing.json')
  console.log('     against current provider pricing and set _verifiedOn before quoting.')
}

// -- 1. What compression does -------------------------------------------------

console.log('\n\n1. REDUCTION AND RETENTION')
console.log('-'.repeat(78))
console.log('Reduction is caller-controlled: tokenBudget is an input. Retention is not.\n')

for (const corpus of corpora) {
  const rows = measurements.filter((row) => row.corpus === corpus.name).map((row) => [
    String(row.budget),
    String(row.inputTokens),
    String(row.outputTokens),
    `${row.reductionPercent.toFixed(1)}%`,
    `${row.needlesRetained}/${row.needlesTotal}`,
    row.needlesRetained === row.needlesTotal ? 'ok' : row.needlesRetained === 0 ? 'ANSWER LOST' : 'PARTIAL',
    `${row.latencyP50Ms.toFixed(2)}ms`,
  ])
  console.log(`${corpus.name} — "${corpus.task}"`)
  console.log(table(rows, ['budget', 'in', 'out', 'reduction', 'needles', 'verdict', 'p50']))
  console.log()
}

// -- 2. Tokenizer gap ---------------------------------------------------------

console.log('\n2. TOKEN COUNTING')
console.log('-'.repeat(78))
console.log('The service reports a model-neutral estimate it says must not be used for')
console.log('billing. Economics need real tokens. The gap:\n')
console.log(table(
  corpora.map((corpus) => {
    const row = measurements.find((entry) => entry.corpus === corpus.name)!
    const drift = ((row.internalEstimateInput - row.inputTokens) / row.inputTokens) * 100
    return [corpus.name, String(row.inputTokens), String(row.internalEstimateInput), `${drift >= 0 ? '+' : ''}${drift.toFixed(1)}%`]
  }),
  ['corpus', 'real BPE', 'service estimate', 'drift'],
))

// -- 3. Net economics ---------------------------------------------------------

console.log('\n\n3. NET ECONOMICS PER CALL')
console.log('-'.repeat(78))
console.log('Saving = tokens removed × input price. Net = saving − fee.')
console.log('Measured at the largest budget (16,000), the most conservative case.\n')

const atMaxBudget = measurements.filter((row) => row.budget === 16_000)

for (const model of pricing.models) {
  const rows = atMaxBudget.map((row) => {
    const saving = (row.savedTokens / 1_000_000) * model.inputPerMillionUsd
    return [
      row.corpus,
      String(row.savedTokens),
      usd(saving),
      ...pricing.feeTiersUsd.map((fee) => usd(saving - fee)),
    ]
  })
  console.log(`${model.label}  ($${model.inputPerMillionUsd.toFixed(2)}/M input)${model.verified ? '' : '  [unverified]'}`)
  console.log(table(rows, ['corpus', 'saved', 'saving', ...pricing.feeTiersUsd.map((fee) => `net@$${fee}`)]))
  console.log()
}

// -- 4. Breakeven -------------------------------------------------------------

console.log('\n4. BREAKEVEN INPUT SIZE')
console.log('-'.repeat(78))
console.log('Smallest input, in tokens, at which the saving covers the fee. Below this')
console.log('line the caller pays more than they save. Assumes the reduction fraction')
console.log('observed at the 16,000 budget holds.\n')

// Per corpus, not averaged. A mean across payload shapes that range from -58%
// to +20% describes none of them, and averaging a negative reduction into the
// denominator produces a breakeven that is arithmetic rather than meaningful.
const MAX_INPUT_TOKENS = 32_000 // 128 KB endpoint cap, at roughly 4 bytes per token

for (const corpus of corpora) {
  const row = atMaxBudget.find((entry) => entry.corpus === corpus.name)!
  const fraction = row.reductionPercent / 100
  console.log(`${corpus.name} — ${row.reductionPercent.toFixed(1)}% reduction at max budget`)
  if (fraction <= 0) {
    console.log('  no breakeven at any price: the pack is larger than the input.\n')
    continue
  }
  console.log(table(
    pricing.models.map((model) => [
      model.label,
      ...pricing.feeTiersUsd.map((fee) => {
        const breakeven = breakevenInputTokens(fraction, fee, model.inputPerMillionUsd)
        if (breakeven === null) return '—'
        const label = breakeven > 1_000_000 ? '>1M' : Math.round(breakeven).toLocaleString()
        // The endpoint refuses payloads above its own cap, so a breakeven above
        // it is unreachable however the price is set.
        return breakeven > MAX_INPUT_TOKENS ? `${label} !` : label
      }),
    ]),
    ['model', ...pricing.feeTiersUsd.map((fee) => `fee $${fee}`)],
  ))
  console.log()
}
console.log(`!  = above the endpoint's own ${MAX_INPUT_TOKENS.toLocaleString()}-token input cap, so unreachable at that price.`)

// -- 5. Latency ---------------------------------------------------------------

console.log('\n\n5. LATENCY')
console.log('-'.repeat(78))
const allP50 = measurements.map((row) => row.latencyP50Ms).sort((a, b) => a - b)
const allP95 = measurements.map((row) => row.latencyP95Ms).sort((a, b) => a - b)
console.log(`Compute only, in process: p50 ${percentile(allP50, 0.5).toFixed(2)}ms, p95 ${percentile(allP95, 0.95).toFixed(2)}ms`)
console.log(`Slowest single case: ${Math.max(...measurements.map((row) => row.latencyP95Ms)).toFixed(2)}ms`)
console.log()
console.log('This is the compiler alone. It excludes TLS, network round trip, cold')
console.log('starts, and — if payment sits on the hot path — facilitator verify and')
console.log('settle plus on-chain confirmation, which are seconds, not milliseconds.')
console.log('A sub-50ms end-to-end target is a statement about the payment')
console.log('architecture, not about this code.')

console.log('\n' + '='.repeat(78) + '\n')
