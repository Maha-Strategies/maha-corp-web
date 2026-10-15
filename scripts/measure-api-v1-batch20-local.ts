import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { performance } from 'node:perf_hooks'
import { TWENTIETH_BATCH } from '../lib/api-v1/batch50.ts'
import { handlerFor } from '../lib/api-v1/handlers.ts'
import { TWENTIETH_BATCH_AUDITS } from '../lib/api-v1/batch20-audits.ts'
import { BATCH20_PORTS } from '../lib/api-v1/batch20-ports.ts'
import { batch20FixtureHandler } from './lib/api-v1-batch20-fixtures.ts'
const TWENTIETH_BATCH_SAMPLES = Object.fromEntries([...TWENTIETH_BATCH_AUDITS, ...BATCH20_PORTS].map(s => [s.id, s.sample]))
const out = resolve(process.argv[2] ?? '/Users/mayonerajan/Projects/maha-corp-web/output/api-v1-batch20-2026-10-15')
await mkdir(out, { recursive: true })
let networkAttempts = 0
const originalFetch = globalThis.fetch
globalThis.fetch = async () => { networkAttempts++; throw Error('local_only_no_external_calls') }
const rows = []
for (const e of TWENTIETH_BATCH) {
  const handler = batch20FixtureHandler(e.id, e.amount) ?? handlerFor(e.id, e.amount)!, input = structuredClone(TWENTIETH_BATCH_SAMPLES[e.id])
  const start = performance.now(); const result = await handler.execute(input); const coldWallMs = performance.now() - start
  const warmWallMs: number[] = [], cpu = process.cpuUsage()
  for (let i = 0; i < 10; i++) { const t = performance.now(); await handler.execute(input); warmWallMs.push(performance.now() - t) }
  const usage = process.cpuUsage(cpu); warmWallMs.sort((a, b) => a - b)
  rows.push({ id: e.id, executionMode: e.execution_cost!.mode, sourceOrModelFixturesOnly: e.execution_cost!.mode !== 'local-cpu-wasm', coldWallMs, warmMedianWallMs: (warmWallMs[4] + warmWallMs[5]) / 2, warmMaximumWallMs: warmWallMs.at(-1),
    tenRunsCpuMicroseconds: usage.user + usage.system, inputBytes: Buffer.byteLength(JSON.stringify(input)), outputBytes: Buffer.byteLength(JSON.stringify(result)) })
}
globalThis.fetch = originalFetch
if (networkAttempts) throw Error('unexpected_network_attempt')
const proof = { measuredAt: new Date().toISOString(), localOnly: true, scope: 'One bounded synthetic nonpersonal metadata sample per adapter, 10 warm repetitions; source/model-backed paths use fixtures; public/synthetic text samples only; not worst-case or concurrency sizing.',
  usdCostMeasured: false, grossMarginEstablished: false, liveModelCalls: 0, modelAndSourceBackedAdaptersUseFixtures: true, networkCalls: 0,
  limitation: 'Local process timing excludes hosting, idle time, facilitator fees, egress, storage, cold fleet capacity and support. It cannot establish $0.0001/call or 99% margins.', rows }
await writeFile(resolve(out, 'local-runtime-samples.json'), JSON.stringify(proof, null, 2) + '\n')
console.log(JSON.stringify({ out, sampleCount: rows.length, maximumWarmWallMs: Math.max(...rows.map(r => r.warmMaximumWallMs!)), usdCostMeasured: false, modelCalls: 0 }))
