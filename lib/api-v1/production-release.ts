import { createHash } from 'node:crypto'
import release from '../../content/api-v1/production-release-296.json' with { type: 'json' }
import additions from '../../content/api-v1/production-additions-204.json' with { type: 'json' }
import nextAdditions from '../../content/api-v1/production-additions-125.json' with { type: 'json' }
import { ENDPOINTS } from './endpoints.registry.ts'
import { assertEndpoint, type Endpoint } from './types.ts'
import { demandDigest } from '../x402/demand6/digest.ts'
export const MODULAR_RELEASE = release
export const MODULAR_ADDITIONS = additions
export const MODULAR_NEXT_ADDITIONS = nextAdditions
const targets = new Map(release.targets.map(t => [t.id, { ...t, input: JSON.parse(t.inputJson) as unknown, output: JSON.parse(t.outputJson) as unknown }]))
if (targets.size !== 296 || release.maximumBaseUnits !== '6098840' || release.targets.reduce((n, t) => n + BigInt(t.amount), 0n) !== 6098840n) throw Error('invalid_production_release')
export const ORIGINAL_PRODUCTION_ENDPOINTS: readonly Endpoint[] = Object.freeze(ENDPOINTS.filter(e => targets.has(e.id)).map(e => {
  const t = targets.get(e.id)!
  if (e.path !== t.path || e.amount !== t.amount || e.method !== t.method || e.status !== 'local-implemented'
    || e.schema_status !== 'validated-local' || e.sourceReview === 'pending' || e.execution_cost?.mode !== 'local-cpu-wasm'
    || 'sha256:' + createHash('sha256').update(JSON.stringify(e)).digest('hex') !== t.contractHash) throw Error('production_contract_drift:' + e.id)
  const promoted: Endpoint = { ...e, status: 'released', productionApproved: true }
  assertEndpoint(promoted); return Object.freeze(promoted)
}))
if (ORIGINAL_PRODUCTION_ENDPOINTS.length !== 296) throw Error('production_release_incomplete')
const addedTargets = new Map(additions.targets.map(t => [t.id, { ...t, input: JSON.parse(t.inputJson) as unknown, output: JSON.parse(t.outputJson) as unknown }]))
if (addedTargets.size !== 204 || additions.maximumBaseUnits !== '2534496' || additions.targets.reduce((n, t) => n + BigInt(t.amount), 0n) !== 2534496n
  || additions.targetsDigest !== demandDigest(additions.targets) || additions.targets.some(t => targets.has(t.id))
  || additions.operatorWallet !== release.operatorWallet || additions.payee !== release.payee || additions.network !== release.network) throw Error('invalid_approved_additions')
export const PRODUCTION_ADDITION_ENDPOINTS: readonly Endpoint[] = Object.freeze(additions.targets.map(t => {
  const e = ENDPOINTS.find(e => e.id === t.id)
  if (!e || e.path !== t.path || e.amount !== t.amount || e.method !== t.method || e.status !== 'local-implemented'
    || e.schema_status !== 'validated-local' || e.sourceReview === 'pending' || e.execution_cost?.mode !== 'local-cpu-wasm'
    || 'sha256:' + createHash('sha256').update(JSON.stringify(e)).digest('hex') !== t.contractHash) throw Error('addition_contract_drift:' + t.id)
  const promoted: Endpoint = { ...e, status: 'released', productionApproved: true }; assertEndpoint(promoted); return Object.freeze(promoted)
}))
const nextTargets = new Map(nextAdditions.targets.map(t => [t.id, { ...t, input: JSON.parse(t.inputJson) as unknown, output: JSON.parse(t.outputJson) as unknown }]))
if (nextTargets.size !== 125 || nextAdditions.maximumBaseUnits !== '3574095' || nextAdditions.targets.reduce((n, t) => n + BigInt(t.amount), 0n) !== 3574095n
  || nextAdditions.targetsDigest !== demandDigest(nextAdditions.targets) || nextAdditions.targets.some(t => targets.has(t.id) || addedTargets.has(t.id))
  || nextAdditions.operatorWallet !== release.operatorWallet || nextAdditions.payee !== release.payee || nextAdditions.network !== release.network
  || nextAdditions.previousCount !== 500 || nextAdditions.targetReleasedCount !== 625 || nextAdditions.customerRevenue !== false
  || nextAdditions.organicDemand !== false || nextAdditions.automaticRepayment !== false) throw Error('invalid_approved_next_125')
export const NEXT_PRODUCTION_ENDPOINTS: readonly Endpoint[] = Object.freeze(nextAdditions.targets.map(t => {
  const e = ENDPOINTS.find(e => e.id === t.id)
  if (!e || e.path !== t.path || e.amount !== t.amount || e.method !== t.method || e.status !== 'local-implemented'
    || e.schema_status !== 'validated-local' || e.sourceReview === 'pending' || e.execution_cost?.mode !== 'local-cpu-wasm'
    || 'sha256:' + createHash('sha256').update(JSON.stringify(e)).digest('hex') !== t.contractHash) throw Error('next_addition_contract_drift:' + t.id)
  const promoted: Endpoint = { ...e, status: 'released', productionApproved: true }; assertEndpoint(promoted); return Object.freeze(promoted)
}))
export const PRODUCTION_ENDPOINTS: readonly Endpoint[] = Object.freeze([...ORIGINAL_PRODUCTION_ENDPOINTS, ...PRODUCTION_ADDITION_ENDPOINTS, ...NEXT_PRODUCTION_ENDPOINTS])
if (PRODUCTION_ENDPOINTS.length !== 625 || new Set(PRODUCTION_ENDPOINTS.map(e => e.id)).size !== 625) throw Error('production_625_incomplete')
export const productionEndpointById = (id: string) => PRODUCTION_ENDPOINTS.find(e => e.id === id)
export const productionEndpointByRoute = (method: string, path: string) => PRODUCTION_ENDPOINTS.find(e => e.method === method && e.path === path)
export const releaseExample = (id: string) => targets.get(id) ?? addedTargets.get(id) ?? nextTargets.get(id)
export const modularLedgerPrices = () => PRODUCTION_ENDPOINTS.map(e => ({ id: 'modular-' + e.id, title: e.name + ' (modular)', amountBaseUnits: BigInt(e.amount) }))
