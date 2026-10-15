import { ENDPOINTS } from '../lib/api-v1/endpoints.registry.ts'
import { handlerFor } from '../lib/api-v1/handlers.ts'
import { final42Input } from './lib/api-v1-final42-fixtures.ts'
import { demandDigest } from '../lib/x402/demand6/digest.ts'
if (process.argv.slice(2).join(' ') !== '--unpaid-public-reads') throw Error('explicit_unpaid_public_read_mode_required')
const products = ENDPOINTS.filter(e => e.execution_cost?.mode === 'external-source-read')
if (products.length !== 8) throw Error('unexpected_source_review_scope')
let failures = 0
for (const e of products) {
  const started = Date.now()
  try {
    const h = handlerFor(e.id, e.amount)!, input = h.input.parse(final42Input(e))
    const output = h.output.parse(await h.execute(input))
    console.log(JSON.stringify({ id: e.id, state: 'unpaid_source_read_validated', elapsedMs: Date.now() - started,
      outputHash: demandDigest(output), outputBytes: Buffer.byteLength(JSON.stringify(output)), paidCalls: 0, modelCalls: 0 }))
  } catch (error) {
    failures++; console.log(JSON.stringify({ id: e.id, state: 'source_check_failed', elapsedMs: Date.now() - started,
      error: error instanceof Error ? error.message.slice(0, 200) : 'unknown', paidCalls: 0 }))
  }
}
console.log(JSON.stringify({ checked: products.length, failures, payments: 0, models: 0 }))
if (failures) process.exitCode = 1
