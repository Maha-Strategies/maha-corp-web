import { ENDPOINTS } from '../lib/api-v1/endpoints.registry.ts'
import { PREVIOUS_958_PRODUCTION_ENDPOINTS as PRODUCTION_ENDPOINTS } from '../lib/api-v1/production-release.ts'
import { final42Input, final42OfflineHandler } from './lib/api-v1-final42-fixtures.ts'
import { demandDigest } from '../lib/x402/demand6/digest.ts'
import { validate } from '../test/helpers/json-schema.ts'

const released = new Set(PRODUCTION_ENDPOINTS.map(e => e.id)), remaining = ENDPOINTS.filter(e => !released.has(e.id))
if (released.size !== 958 || remaining.length !== 42 || remaining.reduce((n, e) => n + BigInt(e.amount), 0n) !== 2592940n) throw Error('approved_final42_scope_changed')
let failures = 0
for (const e of remaining) {
  try {
    const h = final42OfflineHandler(e), input = h.input.parse(final42Input(e))
    const output = h.output.parse(await h.execute(input)), repeated = h.output.parse(await h.execute(input))
    const errors = validate({ success: true, data: output, proof: { settlement_id: '0x' + '1'.repeat(64) } }, e.schema.output)
    if (errors.length) throw Error('output_json_schema:' + JSON.stringify(errors))
    if (demandDigest(output) !== demandDigest(repeated)) throw Error('nondeterministic_offline_fixture')
    if (Buffer.byteLength(JSON.stringify(output)) > 65000) throw Error('output_over_65kb')
    console.log(JSON.stringify({ id: e.id, state: 'offline_validated', outputBytes: Buffer.byteLength(JSON.stringify(output)) }))
  } catch (error) { failures++; console.log(JSON.stringify({ id: e.id, state: 'blocked', error: error instanceof Error ? error.message : 'unknown' })) }
}
console.log(JSON.stringify({ checked: remaining.length, failures, deployment: false, payments: 0, modelCalls: 0 }))
if (failures) process.exitCode = 1
