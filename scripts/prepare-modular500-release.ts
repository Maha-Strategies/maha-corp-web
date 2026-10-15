import { createHash } from 'node:crypto'
import { writeFile } from 'node:fs/promises'
import original from '../content/api-v1/production-release-296.json' with { type: 'json' }
import { ENDPOINTS } from '../lib/api-v1/endpoints.registry.ts'
import { handlerFor } from '../lib/api-v1/handlers.ts'
import { BATCH20_PORTS } from '../lib/api-v1/batch20-ports.ts'
import { demandDigest } from '../lib/x402/demand6/digest.ts'

const existing = new Set(original.targets.map(e => e.id))
const selected = ENDPOINTS.filter(e => !existing.has(e.id) && e.status === 'local-implemented' && e.schema_status === 'validated-local'
  && e.sourceReview !== 'pending' && e.execution_cost?.mode === 'local-cpu-wasm'
  // The history report includes a changing assessment age, so it cannot be
  // bound to the exact deterministic result used by this indexing runner.
  && e.id !== 'x402-quote-change-report').sort((a, b) => Number(a.amount) - Number(b.amount) || a.id.localeCompare(b.id)).slice(0, 204)
if (selected.length !== 204 || selected.reduce((n, e) => n + BigInt(e.amount), 0n) !== 2534496n) throw Error('approved_scope_or_price_changed')
const samples = new Map<string, unknown>(BATCH20_PORTS.map(s => [s.id, s.sample]))
for (let n = 4; n <= 20; n++) {
  const batchModule = await import('../lib/api-v1/batch' + n + '-audits.ts')
  for (const value of Object.values(batchModule)) if (Array.isArray(value)) for (const item of value) {
    if (item && typeof item === 'object' && typeof item.id === 'string' && item.sample) samples.set(item.id, item.sample)
  }
}
const targets = [], originalFetch = globalThis.fetch
globalThis.fetch = async () => { throw Error('release_preparation_network_forbidden') }
try {
  for (const e of selected) {
    const handler = handlerFor(e.id, e.amount)!, sample = samples.get(e.id)
    if (!sample) throw Error('missing_reviewed_synthetic_fixture:' + e.id)
    const input = handler.input.parse(sample), output = handler.output.parse(await handler.execute(input)), repeated = await handler.execute(input)
    if (demandDigest(output) !== demandDigest(repeated)) throw Error('nondeterministic_release_fixture:' + e.id)
    targets.push({ id: e.id, path: e.path, method: e.method, amount: e.amount,
      contractHash: 'sha256:' + createHash('sha256').update(JSON.stringify(e)).digest('hex'), inputJson: JSON.stringify(input), outputJson: JSON.stringify(output) })
  }
} finally { globalThis.fetch = originalFetch }
const release = { version: 'maha-modular-500-additions-20261015/1', previousCount: 296, additionalCount: 204, targetReleasedCount: 500,
  maximumBaseUnits: '2534496', operatorWallet: original.operatorWallet, payee: original.payee, network: original.network,
  indexingClassification: 'publisher-funded-operator-activity', customerRevenue: false, organicDemand: false, automaticRepayment: false,
  targets, targetsDigest: demandDigest(targets) }
await writeFile('content/api-v1/production-additions-204.json', JSON.stringify(release, null, 2) + '\n', { flag: 'wx' })
console.log(JSON.stringify({ additionalCount: 204, releasedAfterDeployment: 500, maximumBaseUnits: release.maximumBaseUnits, targetsDigest: release.targetsDigest, modelCalls: 0, paidCalls: 0 }))
