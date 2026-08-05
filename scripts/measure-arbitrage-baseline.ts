/**
 * What compression is actually worth, measured against what a caller would
 * otherwise have done.
 *
 *   node --experimental-strip-types scripts/measure-arbitrage-baseline.ts
 *   node --experimental-strip-types scripts/measure-arbitrage-baseline.ts --corpus <dir>
 *
 * Revision 3 reported $1.42 of saving per call and refused to use it. The
 * figure came from comparing a 16,000-token pack against a 490,000-token raw
 * trace, which assumes the caller would have sent all 490,000 tokens to a
 * model. Nobody does. It exceeds most context windows, which is the reason the
 * trace is being compressed in the first place. The saving was measured
 * against something that never happens.
 *
 * So the baseline here is what a caller without this service actually does
 * with an oversized payload:
 *
 *   truncate   Send the head of the payload, up to the model's window, and
 *              lose the rest. One call. Cheapest, and silently wrong whenever
 *              the answer was further down.
 *
 *   chunk      Split into window-sized pieces and call the model once per
 *              piece, then reconcile. Nothing is lost; the whole payload is
 *              paid for, plus a per-call overhead for instructions.
 *
 * Both are measured for retention as well as cost, because the comparison only
 * means something if the alternatives are judged on whether they still answer
 * the question. Truncation is cheap precisely because it throws away most of
 * the input, and a cost comparison that ignores that is not a comparison.
 */

import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'

import { encode } from 'gpt-tokenizer'

import { compileContextPack } from '../lib/context-compiler.ts'
import { CORPORA, type Corpus } from './compression-corpus.ts'

const corpusDirectory = process.argv.includes('--corpus') ? process.argv[process.argv.indexOf('--corpus') + 1] : null

/** Context windows a caller might be working within. */
const WINDOWS = [
  { label: '128k window', tokens: 128_000 },
  { label: '32k window', tokens: 32_000 },
]

const PACK_BUDGET = 16_000
const FEE_USD = 0.001
const PRICE_PER_MILLION = 3.00
/** Instructions and reconciliation prompt repeated on every chunked call. */
const CHUNK_OVERHEAD_TOKENS = 400

const bpe = (text: string) => encode(text).length
const usd = (value: number) => `$${value.toFixed(4)}`

type Strategy = { name: string; inputTokens: number; calls: number; retained: number; note: string }

function truncate(text: string, needles: string[], window: number): Strategy {
  // Character-proportional head, then measured exactly. Good enough: the point
  // is what survives, not a precise token boundary.
  const ratio = window / Math.max(1, bpe(text))
  const head = text.slice(0, Math.floor(text.length * Math.min(1, ratio)))
  return {
    name: 'truncate to window',
    inputTokens: Math.min(window, bpe(head)),
    calls: 1,
    retained: needles.filter((needle) => head.includes(needle)).length,
    note: 'one call; everything past the window is discarded unseen',
  }
}

function chunk(text: string, needles: string[], window: number): Strategy {
  const total = bpe(text)
  const usable = window - CHUNK_OVERHEAD_TOKENS
  const calls = Math.max(1, Math.ceil(total / usable))
  return {
    name: 'chunk across calls',
    // The whole payload is paid for, plus instructions on every call.
    inputTokens: total + calls * CHUNK_OVERHEAD_TOKENS,
    calls,
    // Nothing is dropped, so every needle is seen by some call.
    retained: needles.length,
    note: `${calls} calls; nothing dropped, whole payload billed`,
  }
}

function compressed(corpus: Corpus): Strategy {
  const pack = compileContextPack({
    clientRequestId: 'arbitrage', task: corpus.task, tokenBudget: PACK_BUDGET, documents: corpus.documents,
  })
  return {
    name: 'compress, then one call',
    inputTokens: bpe(pack.context),
    calls: 1,
    retained: corpus.needles.filter((needle) => pack.context.includes(needle)).length,
    note: 'one call; selection decides what survives',
  }
}

function table(rows: string[][], headers: string[]): string {
  const widths = headers.map((header, column) => Math.max(header.length, ...rows.map((row) => (row[column] ?? '').length)))
  const line = (cells: string[]) => cells.map((cell, column) => (cell ?? '').padEnd(widths[column])).join('  ')
  return [line(headers), widths.map((width) => '-'.repeat(width)).join('  '), ...rows.map(line)].join('\n')
}

let corpora: Corpus[] = CORPORA
if (corpusDirectory) {
  const files = (await readdir(corpusDirectory)).filter((name) => name.endsWith('.json'))
  corpora = await Promise.all(files.map(async (name) => JSON.parse(await readFile(join(corpusDirectory, name), 'utf8')) as Corpus))
}

console.log('\n' + '='.repeat(84))
console.log('ARBITRAGE BASELINE — measured against what a caller would otherwise do')
console.log('='.repeat(84))
console.log(`\nModel input $${PRICE_PER_MILLION.toFixed(2)}/M · compression fee ${usd(FEE_USD)} · pack budget ${PACK_BUDGET.toLocaleString()}`)
if (!corpusDirectory) console.log('Synthetic corpus. Re-run with --corpus against real traces before quoting.')

for (const window of WINDOWS) {
  console.log(`\n\n${window.label} (${window.tokens.toLocaleString()} tokens)`)
  console.log('-'.repeat(84))

  for (const corpus of corpora) {
    const text = corpus.documents.map((document) => document.text).join('\n\n')
    const total = bpe(text)
    // A payload that already fits has no fallback problem and no arbitrage.
    if (total <= window.tokens) {
      console.log(`\n${corpus.name}: ${total.toLocaleString()} tokens already fits — no fallback needed, no arbitrage to measure.`)
      continue
    }

    const strategies = [truncate(text, corpus.needles, window.tokens), chunk(text, corpus.needles, window.tokens), compressed(corpus)]
    const compress = strategies[2]
    const compressCost = (compress.inputTokens / 1_000_000) * PRICE_PER_MILLION + FEE_USD

    console.log(`\n${corpus.name} — ${total.toLocaleString()} tokens in`)
    console.log(table(strategies.map((strategy) => {
      const cost = (strategy.inputTokens / 1_000_000) * PRICE_PER_MILLION + (strategy === compress ? FEE_USD : 0)
      const delta = strategy === compress ? '—' : usd(cost - compressCost)
      return [
        strategy.name,
        strategy.calls.toString(),
        strategy.inputTokens.toLocaleString(),
        usd(cost),
        delta,
        corpus.needles.length === 0 ? '—' : `${strategy.retained}/${corpus.needles.length}`,
        strategy.note,
      ]
    }), ['strategy', 'calls', 'input tok', 'cost', 'vs compress', 'answer', 'note']))
  }
}

console.log('\n\n' + '='.repeat(84))
console.log('Reading this table')
console.log('='.repeat(84))
console.log('The saving against chunking is the honest arbitrage: same answer, fewer tokens.')
console.log('The saving against truncation is not a saving at all where truncation loses the')
console.log('answer — that is a quality difference priced as though it were a cost one, and')
console.log('it is the comparison a customer will make if we let them.')
console.log('')
console.log('Costs are model input only. Output tokens, latency and the second call a wrong')
console.log('answer provokes are all excluded, and all favour compression.')
console.log('')
