/**
 * How /compress behaves as payloads grow past the endpoint's current cap.
 *
 *   node --experimental-strip-types scripts/measure-compression-scale.ts
 *
 * Two questions, both of which decide whether raising the 128 KB limit is
 * worth doing:
 *
 *   Latency   Does cost grow with input, or faster than input? A cap set
 *             below the point where it turns superlinear is a cheap cap; one
 *             set above it is a promise the service cannot keep.
 *
 *   Retention Under a fixed 16,000-token budget, a 100k input must discard
 *             84% of itself. Whether the passages carrying the answer survive
 *             that is the whole question -- reduction is trivially high and
 *             tells you nothing.
 *
 * This calls compileContextPack directly, so it deliberately bypasses the
 * 128 KB request validation. The point is to find out what the cap should be,
 * which cannot be done from inside it.
 */

import { encode } from 'gpt-tokenizer'

import { compileContextPack, type ProvenanceStyle } from '../lib/context-compiler.ts'

const BUDGET = 16_000
const RUNS = 7
const bpe = (text: string) => encode(text).length
const percentile = (sorted: number[], p: number) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))]

// Filler turns are index-varied so the compiler's hash deduplication cannot
// collapse them; identical filler would leave the input nominally large and
// effectively small, which would flatter every number below.
function agentTrace(turns: number): string {
  const blocks: string[] = []
  for (let index = 0; index < turns; index += 1) {
    blocks.push([
      `[turn ${index + 1}] assistant: Checking the next service in the dependency chain before drawing a conclusion.`,
      `[turn ${index + 1}] tool_call: get_service_health({"service":"svc-${index}","window":"24h"})`,
      `[turn ${index + 1}] observation: status=healthy checks_passed=14 checks_failed=0 p99_latency_ms=${120 + index} error_rate=0.00 last_deploy=2026-07-${(index % 28) + 1}T0${index % 6}:00:00Z region=us-east-1 replicas=${4 + (index % 5)} cpu_pct=${30 + (index % 40)} mem_pct=${40 + (index % 30)} disk_pct=${20 + (index % 50)} open_conns=${100 + index} queue_depth=${index % 17} gc_pause_ms=${2 + (index % 5)} heap_mb=${900 + index} uptime_s=${86400 + index} build=ci-${20000 + index} sli_availability=99.9${index % 9} error_budget_pct=${70 + (index % 25)} warehouse_sync=ok`,
    ].join('\n\n'))
    // The needles sit a third of the way in, so they are neither first nor
    // last and cannot win on positional bonus alone.
    if (index === Math.floor(turns / 3)) {
      blocks.push([
        `[turn ${index + 1}] assistant: The dependency chain is clean, so the failure is in the job itself.`,
        `[turn ${index + 1}] tool_call: get_job_logs({"job":"nightly-inventory-reconciliation"})`,
        '[turn X] observation: FATAL: reconciliation aborted after 4 retries. Cause: warehouse WH-7 returned a stock ledger with 312 rows whose location_id is null, violating the not-null constraint on the staging table.',
      ].join('\n\n'))
      blocks.push('[turn X] observation: warehouse=WH-7 status=degraded schema_version=3.9.0 note=warehouse still on schema 3.9.0, which does not enforce location_id on outbound stock ledger rows')
    }
  }
  return blocks.join('\n\n')
}

const NEEDLES = [
  'warehouse WH-7 returned a stock ledger with 312 rows whose location_id is null',
  'warehouse still on schema 3.9.0, which does not enforce location_id',
]

const TASK = 'Why did the nightly inventory reconciliation job fail and which warehouse is affected?'

type Row = {
  inputTokens: number
  passages: number
  packTokens: number
  contentTokens: number
  reductionPercent: number
  needles: number
  p50: number
  p95: number
  usPerToken: number
}

function run(turns: number, provenance: ProvenanceStyle): Row {
  const text = agentTrace(turns)
  const request = { clientRequestId: `scale-${turns}-${provenance}`, task: TASK, tokenBudget: BUDGET, documents: [{ id: 'trace', title: 'Agent trace', text }], provenance }

  let pack = compileContextPack(request)
  const durations: number[] = []
  for (let index = 0; index < RUNS; index += 1) {
    const started = performance.now()
    pack = compileContextPack(request)
    durations.push(performance.now() - started)
  }
  durations.sort((left, right) => left - right)

  const inputTokens = bpe(text)
  const packTokens = bpe(pack.context)
  const p50 = percentile(durations, 0.5)

  return {
    inputTokens,
    passages: pack.includedPassages.length,
    packTokens,
    contentTokens: bpe(pack.includedPassages.map((passage) => passage.text).join('\n\n')),
    reductionPercent: ((inputTokens - packTokens) / inputTokens) * 100,
    needles: NEEDLES.filter((needle) => pack.context.includes(needle)).length,
    p50,
    p95: percentile(durations, 0.95),
    usPerToken: (p50 * 1_000) / inputTokens,
  }
}

function table(rows: string[][], headers: string[]): string {
  const widths = headers.map((header, column) => Math.max(header.length, ...rows.map((row) => (row[column] ?? '').length)))
  const line = (cells: string[]) => cells.map((cell, column) => (cell ?? '').padEnd(widths[column])).join('  ')
  return [line(headers), widths.map((width) => '-'.repeat(width)).join('  '), ...rows.map(line)].join('\n')
}

// Turn counts chosen to land near 8k, 16k, 32k, 50k, 100k and 200k tokens.
const SIZES = [55, 110, 220, 340, 690, 1_380]

console.log('\n' + '='.repeat(86))
console.log(`COMPRESSION AT SCALE — fixed ${BUDGET.toLocaleString()}-token budget, budget-bound agent trace`)
console.log('='.repeat(86))
console.log('\nSynthetic corpus. Shape is realistic; the traffic is not. The 128 KB request')
console.log('cap (~32k tokens) is bypassed deliberately — the question is where it should be.\n')

for (const provenance of ['full', 'none'] as ProvenanceStyle[]) {
  const rows = SIZES.map((turns) => run(turns, provenance))
  console.log(`\nprovenance: ${provenance}`)
  console.log(table(
    rows.map((row) => [
      row.inputTokens.toLocaleString(),
      row.passages.toLocaleString(),
      row.packTokens.toLocaleString(),
      row.contentTokens.toLocaleString(),
      `${((row.contentTokens / row.packTokens) * 100).toFixed(1)}%`,
      `${row.reductionPercent.toFixed(1)}%`,
      `${row.needles}/2`,
      `${row.p50.toFixed(1)}ms`,
      `${row.p95.toFixed(1)}ms`,
      row.usPerToken.toFixed(2),
    ]),
    ['input', 'passages', 'pack', 'content', 'density', 'reduction', 'needles', 'p50', 'p95', 'µs/tok'],
  ))

  // Superlinearity shows up as µs-per-token climbing with input. Flat means
  // the cost is proportional and the cap can be set on other grounds.
  const first = rows[0]
  const last = rows[rows.length - 1]
  const inputGrowth = last.inputTokens / first.inputTokens
  const timeGrowth = last.p50 / first.p50
  console.log(`\n  input ×${inputGrowth.toFixed(1)}  →  time ×${timeGrowth.toFixed(1)}   (exponent ≈ ${(Math.log(timeGrowth) / Math.log(inputGrowth)).toFixed(2)}; 1.0 is linear)`)
  const over50 = rows.filter((row) => row.p50 > 50)
  console.log(over50.length > 0
    ? `  first size past 50ms compute: ${over50[0].inputTokens.toLocaleString()} tokens`
    : '  no size measured exceeds 50ms of compute')
}

console.log('\n' + '='.repeat(86))
console.log('Compute only. Network, TLS, cold start and — if payment sits on the hot path —')
console.log('facilitator settlement are excluded and are larger than everything above.')
console.log('='.repeat(86) + '\n')
