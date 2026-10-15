import { createHash } from 'node:crypto'
import { writeFile } from 'node:fs/promises'
import original from '../content/api-v1/production-release-296.json' with { type: 'json' }
import previous from '../content/api-v1/production-additions-204.json' with { type: 'json' }
import latest from '../content/api-v1/production-additions-125.json' with { type: 'json' }
import batch201 from '../content/api-v1/production-additions-201.json' with { type: 'json' }
import { ENDPOINTS } from '../lib/api-v1/endpoints.registry.ts'
import { handlerFor } from '../lib/api-v1/handlers.ts'
import { isLegacyPort } from '../lib/api-v1/legacy-adapters.ts'
import { MICRO_SAMPLE_INPUTS } from '../lib/x402/micro-samples.ts'
import { batch20PortSpec } from '../lib/api-v1/batch20-ports.ts'
import { assertEndpoint } from '../lib/api-v1/types.ts'
import { demandDigest } from '../lib/x402/demand6/digest.ts'

const existing = new Set([...original.targets, ...previous.targets, ...latest.targets, ...batch201.targets].map(e => e.id))
const excluded = new Set(['x402-quote-change-report', 'context-compression'])
const selected = ENDPOINTS.filter(e => !existing.has(e.id) && !excluded.has(e.id) && e.status === 'local-implemented'
  && e.schema_status === 'validated-local' && e.sourceReview !== 'pending' && e.execution_cost?.mode === 'local-cpu-wasm')
  .sort((a, b) => Number(a.amount) - Number(b.amount) || a.id.localeCompare(b.id)).slice(0, 132)
if (existing.size !== 826 || selected.length !== 132 || selected.reduce((n, e) => n + BigInt(e.amount), 0n) !== 6996054n) throw Error('approved_132_scope_or_price_changed')
// Use the same specific resolver precedence as handlerFor. Exported helper
// arrays may contain generic or future variants, not the executable contract.
const resolvers: ((id: string) => { sample: unknown } | undefined)[] = []
for (let n = 20; n >= 4; n--) {
  const batchModule = await import('../lib/api-v1/batch' + n + '-audits.ts')
  resolvers.push(batchModule['batch' + n + 'Audit'])
  if (n === 20) resolvers.push(batch20PortSpec)
}
const targets = [], originalFetch = globalThis.fetch
globalThis.fetch = async () => { throw Error('release_preparation_network_forbidden') }
try {
  for (const e of selected) {
    assertEndpoint(e)
    const handler = handlerFor(e.id, e.amount)!, spec = resolvers.map(resolve => resolve(e.id)).find(Boolean)
      ?? (isLegacyPort(e.id) ? { sample: MICRO_SAMPLE_INPUTS[e.id] } : undefined)
    if (!handler || !spec) throw Error('missing_reviewed_synthetic_fixture:' + e.id)
    const input = handler.input.parse(spec.sample), output = handler.output.parse(await handler.execute(input))
    const repeated = handler.output.parse(await handler.execute(input))
    if (demandDigest(output) !== demandDigest(repeated)) throw Error('nondeterministic_release_fixture:' + e.id)
    targets.push({ id: e.id, path: e.path, method: e.method, amount: e.amount,
      contractHash: 'sha256:' + createHash('sha256').update(JSON.stringify(e)).digest('hex'), inputJson: JSON.stringify(input), outputJson: JSON.stringify(output) })
  }
} finally { globalThis.fetch = originalFetch }
const release = { version: 'maha-modular-958-additions-20261015/1', previousCount: 826, additionalCount: 132, targetReleasedCount: 958,
  maximumBaseUnits: '6996054', observedWalletBalanceBaseUnits: '7071050', reservedOriginalAttemptBaseUnits: '38339', operatorWallet: original.operatorWallet, payee: original.payee, network: original.network,
  indexingClassification: 'publisher-funded-operator-activity', customerRevenue: false, organicDemand: false, automaticRepayment: false,
  targets, targetsDigest: demandDigest(targets) }
await writeFile('content/api-v1/production-additions-132.json', JSON.stringify(release, null, 2) + '\n', { flag: 'wx' })
console.log(JSON.stringify({ additionalCount: 132, releasedAfterDeployment: 958, maximumBaseUnits: release.maximumBaseUnits,
  remainderBaseUnits: '74996', targetsDigest: release.targetsDigest, modelCalls: 0, paidCalls: 0 }))
