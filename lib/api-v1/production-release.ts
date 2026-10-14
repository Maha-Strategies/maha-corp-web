import { createHash } from 'node:crypto'
import release from '../../content/api-v1/production-release-296.json' with { type: 'json' }
import { ENDPOINTS } from './endpoints.registry.ts'
import { assertEndpoint, type Endpoint } from './types.ts'
export const MODULAR_RELEASE = release
const targets = new Map(release.targets.map(t => [t.id, { ...t, input: JSON.parse(t.inputJson) as unknown, output: JSON.parse(t.outputJson) as unknown }]))
if (targets.size !== 296 || release.maximumBaseUnits !== '6098840' || release.targets.reduce((n, t) => n + BigInt(t.amount), 0n) !== 6098840n) throw Error('invalid_production_release')
export const PRODUCTION_ENDPOINTS: readonly Endpoint[] = Object.freeze(ENDPOINTS.filter(e => targets.has(e.id)).map(e => {
  const t = targets.get(e.id)!
  if (e.path !== t.path || e.amount !== t.amount || e.method !== t.method || e.status !== 'local-implemented'
    || e.schema_status !== 'validated-local' || e.sourceReview === 'pending' || e.execution_cost?.mode !== 'local-cpu-wasm'
    || 'sha256:' + createHash('sha256').update(JSON.stringify(e)).digest('hex') !== t.contractHash) throw Error('production_contract_drift:' + e.id)
  const promoted: Endpoint = { ...e, status: 'released', productionApproved: true }
  assertEndpoint(promoted); return Object.freeze(promoted)
}))
if (PRODUCTION_ENDPOINTS.length !== 296) throw Error('production_release_incomplete')
export const productionEndpointById = (id: string) => PRODUCTION_ENDPOINTS.find(e => e.id === id)
export const productionEndpointByRoute = (method: string, path: string) => PRODUCTION_ENDPOINTS.find(e => e.method === method && e.path === path)
export const releaseExample = (id: string) => targets.get(id)
export const modularLedgerPrices = () => PRODUCTION_ENDPOINTS.map(e => ({ id: 'modular-' + e.id, title: e.name + ' (modular)', amountBaseUnits: BigInt(e.amount) }))
