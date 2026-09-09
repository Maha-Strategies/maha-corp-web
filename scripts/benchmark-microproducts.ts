/** Local compute and payload measurements only; not Vercel cost or settlement latency. */
import { MICRO_IDS } from '../lib/x402/micro-contracts.ts'
import { MICRO_SAMPLE_INPUTS } from '../lib/x402/micro-samples.ts'
import { buildMicroProduct } from '../lib/x402/micro-products.ts'

if (process.argv.length > 2) throw new Error('No remote or deployment mode exists.')
for (const id of MICRO_IDS) {
  const sample = MICRO_SAMPLE_INPUTS[id]
  const start = performance.now()
  const first = await buildMicroProduct(id, sample)
  const coldMs = performance.now() - start
  const timings: number[] = []
  for (let i = 0; i < 30; i++) { const before = performance.now(); await buildMicroProduct(id, sample); timings.push(performance.now() - before) }
  timings.sort((a, b) => a - b)
  console.log(JSON.stringify({ id, coldMs: +coldMs.toFixed(3), warmP95Ms: +timings[28].toFixed(3), responseBytes: Buffer.byteLength(JSON.stringify(first)), calls: 31, basis: 'local-example-compute-only', providerCalls: 0 }))
}
