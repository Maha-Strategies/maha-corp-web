import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { performance } from 'node:perf_hooks'
import { EIGHTEENTH_BATCH } from '../lib/api-v1/batch50.ts'
import { handlerFor } from '../lib/api-v1/handlers.ts'
import { EIGHTEENTH_BATCH_SAMPLES } from '../lib/api-v1/batch18-audits.ts'
const out = resolve(process.argv[2] ?? '/Users/mayonerajan/Projects/maha-corp-web/output/api-v1-batch18-2026-10-15')
await mkdir(out, { recursive: true })
let networkAttempts = 0
const originalFetch = globalThis.fetch
globalThis.fetch = async () => { networkAttempts++; throw Error('local_only_no_external_calls') }
const rows = []
for (const e of EIGHTEENTH_BATCH) {
  if (e.execution_cost?.mode !== 'local-cpu-wasm') throw Error('not_a_local_benchmark:' + e.id)
  const handler = handlerFor(e.id, e.amount)!, input = structuredClone(EIGHTEENTH_BATCH_SAMPLES[e.id])
  const start = performance.now(); const result = await handler.execute(input); const coldWallMs = performance.now() - start
  const warmWallMs: number[] = [], cpu = process.cpuUsage()
  for (let i = 0; i < 10; i++) { const t = performance.now(); await handler.execute(input); warmWallMs.push(performance.now() - t) }
  const usage = process.cpuUsage(cpu); warmWallMs.sort((a, b) => a - b)
  rows.push({ id: e.id, coldWallMs, warmMedianWallMs: (warmWallMs[4] + warmWallMs[5]) / 2, warmMaximumWallMs: warmWallMs.at(-1),
    tenRunsCpuMicroseconds: usage.user + usage.system, inputBytes: Buffer.byteLength(JSON.stringify(input)), outputBytes: Buffer.byteLength(JSON.stringify(result)) })
}
globalThis.fetch = originalFetch
if (networkAttempts) throw Error('unexpected_network_attempt')
const proof = { measuredAt: new Date().toISOString(), localOnly: true, scope: 'One bounded synthetic nonpersonal metadata sample per adapter, 10 warm repetitions; no raw documents or meeting transcripts; not worst-case or concurrency sizing.',
  usdCostMeasured: false, grossMarginEstablished: false, modelCalls: 0, networkCalls: 0,
  limitation: 'Local process timing excludes hosting, idle time, facilitator fees, egress, storage, cold fleet capacity and support. It cannot establish $0.0001/call or 99% margins.', rows }
await writeFile(resolve(out, 'local-runtime-samples.json'), JSON.stringify(proof, null, 2) + '\n')
console.log(JSON.stringify({ out, sampleCount: rows.length, maximumWarmWallMs: Math.max(...rows.map(r => r.warmMaximumWallMs!)), usdCostMeasured: false, modelCalls: 0 }))
