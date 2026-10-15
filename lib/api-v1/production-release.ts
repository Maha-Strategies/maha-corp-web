import { createHash } from 'node:crypto'
import release from '../../content/api-v1/production-release-296.json' with { type: 'json' }
import additions from '../../content/api-v1/production-additions-204.json' with { type: 'json' }
import nextAdditions from '../../content/api-v1/production-additions-125.json' with { type: 'json' }
import batch201 from '../../content/api-v1/production-additions-201.json' with { type: 'json' }
import batch132 from '../../content/api-v1/production-additions-132.json' with { type: 'json' }
import { ENDPOINTS } from './endpoints.registry.ts'
import { assertEndpoint, type Endpoint } from './types.ts'
import { demandDigest } from '../x402/demand6/digest.ts'
export const MODULAR_RELEASE = release
export const MODULAR_ADDITIONS = additions
export const MODULAR_NEXT_ADDITIONS = nextAdditions
export const MODULAR_201_ADDITIONS = batch201
export const MODULAR_132_ADDITIONS = batch132
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
const batch201Targets = new Map(batch201.targets.map(t => [t.id, { ...t, input: JSON.parse(t.inputJson) as unknown, output: JSON.parse(t.outputJson) as unknown }]))
if (batch201Targets.size !== 201 || batch201.maximumBaseUnits !== '7231980' || batch201.targets.reduce((n, t) => n + BigInt(t.amount), 0n) !== 7231980n
  || batch201.targetsDigest !== demandDigest(batch201.targets) || batch201.targets.some(t => targets.has(t.id) || addedTargets.has(t.id) || nextTargets.has(t.id))
  || batch201.operatorWallet !== release.operatorWallet || batch201.payee !== release.payee || batch201.network !== release.network
  || batch201.previousCount !== 625 || batch201.targetReleasedCount !== 826 || batch201.customerRevenue !== false
  || batch201.organicDemand !== false || batch201.automaticRepayment !== false) throw Error('invalid_approved_201')
export const BATCH201_PRODUCTION_ENDPOINTS: readonly Endpoint[] = Object.freeze(batch201.targets.map(t => {
  const e = ENDPOINTS.find(e => e.id === t.id)
  if (!e || e.path !== t.path || e.amount !== t.amount || e.method !== t.method || e.status !== 'local-implemented'
    || e.schema_status !== 'validated-local' || e.sourceReview === 'pending' || e.execution_cost?.mode !== 'local-cpu-wasm'
    || 'sha256:' + createHash('sha256').update(JSON.stringify(e)).digest('hex') !== t.contractHash) throw Error('batch201_contract_drift:' + t.id)
  const promoted: Endpoint = { ...e, status: 'released', productionApproved: true }; assertEndpoint(promoted); return Object.freeze(promoted)
}))
const batch132Targets = new Map(batch132.targets.map(t => [t.id, { ...t, input: JSON.parse(t.inputJson) as unknown, output: JSON.parse(t.outputJson) as unknown }]))
if (batch132Targets.size !== 132 || batch132.maximumBaseUnits !== '6996054' || batch132.targets.reduce((n, t) => n + BigInt(t.amount), 0n) !== 6996054n
  || batch132.targetsDigest !== demandDigest(batch132.targets) || batch132.targets.some(t => targets.has(t.id) || addedTargets.has(t.id) || nextTargets.has(t.id) || batch201Targets.has(t.id))
  || batch132.operatorWallet !== release.operatorWallet || batch132.payee !== release.payee || batch132.network !== release.network
  || batch132.previousCount !== 826 || batch132.targetReleasedCount !== 958 || batch132.customerRevenue !== false
  || batch132.reservedOriginalAttemptBaseUnits !== '38339' || batch132.organicDemand !== false || batch132.automaticRepayment !== false) throw Error('invalid_approved_132')
export const BATCH132_PRODUCTION_ENDPOINTS: readonly Endpoint[] = Object.freeze(batch132.targets.map(t => {
  const e = ENDPOINTS.find(e => e.id === t.id)
  if (!e || e.path !== t.path || e.amount !== t.amount || e.method !== t.method || e.status !== 'local-implemented'
    || e.schema_status !== 'validated-local' || e.sourceReview === 'pending' || e.execution_cost?.mode !== 'local-cpu-wasm'
    || 'sha256:' + createHash('sha256').update(JSON.stringify(e)).digest('hex') !== t.contractHash) throw Error('batch132_contract_drift:' + t.id)
  const promoted: Endpoint = { ...e, status: 'released', productionApproved: true }; assertEndpoint(promoted); return Object.freeze(promoted)
}))
export const PRODUCTION_ENDPOINTS: readonly Endpoint[] = Object.freeze([...ORIGINAL_PRODUCTION_ENDPOINTS, ...PRODUCTION_ADDITION_ENDPOINTS, ...NEXT_PRODUCTION_ENDPOINTS, ...BATCH201_PRODUCTION_ENDPOINTS, ...BATCH132_PRODUCTION_ENDPOINTS])
if (PRODUCTION_ENDPOINTS.length !== 958 || new Set(PRODUCTION_ENDPOINTS.map(e => e.id)).size !== 958) throw Error('production_958_incomplete')
export const productionEndpointById = (id: string) => PRODUCTION_ENDPOINTS.find(e => e.id === id)
export const productionEndpointByRoute = (method: string, path: string) => PRODUCTION_ENDPOINTS.find(e => e.method === method && e.path === path)
export const releaseExample = (id: string) => targets.get(id) ?? addedTargets.get(id) ?? nextTargets.get(id) ?? batch201Targets.get(id) ?? batch132Targets.get(id)
export const modularLedgerPrices = () => PRODUCTION_ENDPOINTS.map(e => ({ id: 'modular-' + e.id, title: e.name + ' (modular)', amountBaseUnits: BigInt(e.amount) }))
