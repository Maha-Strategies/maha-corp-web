import { ENDPOINTS, endpointById } from './endpoints.registry.ts'
import firstIds from '../../content/api-v1/batch-1-ids.json' with { type: 'json' }
import { SECOND_BATCH_IDS } from './batch2-ports.ts'
import { THIRD_BATCH_IDS } from './batch3-ports.ts'
import { FOURTH_BATCH_LEGACY_PORTS, FOURTH_BATCH_BOOK_PORTS } from './batch4-ports.ts'
import { FOURTH_BATCH_AUDITS } from './batch4-audits.ts'
import { FIFTH_BATCH_AUDITS } from './batch5-audits.ts'
import { SIXTH_BATCH_AUDITS } from './batch6-audits.ts'
import { SEVENTH_BATCH_AUDITS } from './batch7-audits.ts'
import { EIGHTH_BATCH_AUDITS } from './batch8-audits.ts'
export const FIRST_BATCH = firstIds.map(id => { const endpoint = endpointById(id); if (!endpoint || endpoint.status !== 'local-implemented') throw Error('first_batch_identity_missing'); return endpoint })
if (FIRST_BATCH.length !== 50 || FIRST_BATCH.some(e => e.productionApproved)) throw Error('invalid_local_first_batch')
export const SECOND_BATCH = SECOND_BATCH_IDS.map(id => { const endpoint = endpointById(id); if (!endpoint || endpoint.status !== 'local-implemented') throw Error('second_batch_identity_missing'); return endpoint })
if (SECOND_BATCH.length !== 50 || SECOND_BATCH.some(e => e.productionApproved) || SECOND_BATCH.some(e => firstIds.includes(e.id))) throw Error('invalid_local_second_batch')
export const THIRD_BATCH = THIRD_BATCH_IDS.map(id => { const endpoint = endpointById(id); if (!endpoint || endpoint.status !== 'local-implemented') throw Error('third_batch_identity_missing'); return endpoint })
if (THIRD_BATCH.length !== 50 || THIRD_BATCH.some(e => e.productionApproved) || THIRD_BATCH.some(e => firstIds.includes(e.id) || SECOND_BATCH_IDS.some(id => id === e.id))) throw Error('invalid_local_third_batch')
export const FOURTH_BATCH_IDS = [...FOURTH_BATCH_LEGACY_PORTS.map(p => p[0]), ...FOURTH_BATCH_BOOK_PORTS.map(p => p[0]), ...FOURTH_BATCH_AUDITS.map(s => s.id)]
export const FOURTH_BATCH = FOURTH_BATCH_IDS.map(id => { const e = endpointById(id); if (!e || e.status !== 'local-implemented') throw Error('fourth_batch_identity_missing'); return e })
if (FOURTH_BATCH.length !== 50 || new Set(FOURTH_BATCH_IDS).size !== 50 || FOURTH_BATCH.some(e => e.productionApproved || [...FIRST_BATCH, ...SECOND_BATCH, ...THIRD_BATCH].some(p => p.id === e.id))) throw Error('invalid_local_fourth_batch')
export const FIFTH_BATCH_IDS = FIFTH_BATCH_AUDITS.map(s => s.id)
export const FIFTH_BATCH = FIFTH_BATCH_IDS.map(id => { const e = endpointById(id); if (!e || e.status !== 'local-implemented') throw Error('fifth_batch_identity_missing'); return e })
if (FIFTH_BATCH.length !== 50 || new Set(FIFTH_BATCH_IDS).size !== 50 || FIFTH_BATCH.some(e => e.productionApproved || [...FIRST_BATCH, ...SECOND_BATCH, ...THIRD_BATCH, ...FOURTH_BATCH].some(p => p.id === e.id))) throw Error('invalid_local_fifth_batch')
export const SIXTH_BATCH_IDS = SIXTH_BATCH_AUDITS.map(s => s.id)
export const SIXTH_BATCH = SIXTH_BATCH_IDS.map(id => { const e = endpointById(id); if (!e || e.status !== 'local-implemented') throw Error('sixth_batch_identity_missing'); return e })
if (SIXTH_BATCH.length !== 50 || new Set(SIXTH_BATCH_IDS).size !== 50 || SIXTH_BATCH.some(e => e.productionApproved || [...FIRST_BATCH, ...SECOND_BATCH, ...THIRD_BATCH, ...FOURTH_BATCH, ...FIFTH_BATCH].some(p => p.id === e.id))) throw Error('invalid_local_sixth_batch')
export const SEVENTH_BATCH_IDS = SEVENTH_BATCH_AUDITS.map(s => s.id)
export const SEVENTH_BATCH = SEVENTH_BATCH_IDS.map(id => { const e = endpointById(id); if (!e || e.status !== 'local-implemented') throw Error('seventh_batch_identity_missing'); return e })
if (SEVENTH_BATCH.length !== 50 || new Set(SEVENTH_BATCH_IDS).size !== 50 || SEVENTH_BATCH.some(e => e.productionApproved || [...FIRST_BATCH, ...SECOND_BATCH, ...THIRD_BATCH, ...FOURTH_BATCH, ...FIFTH_BATCH, ...SIXTH_BATCH].some(p => p.id === e.id))) throw Error('invalid_local_seventh_batch')
export const EIGHTH_BATCH_IDS = EIGHTH_BATCH_AUDITS.map(s => s.id)
export const EIGHTH_BATCH = EIGHTH_BATCH_IDS.map(id => { const e = endpointById(id); if (!e || e.status !== 'local-implemented') throw Error('eighth_batch_identity_missing'); return e })
if (EIGHTH_BATCH.length !== 50 || new Set(EIGHTH_BATCH_IDS).size !== 50 || EIGHTH_BATCH.some(e => e.productionApproved || [...FIRST_BATCH, ...SECOND_BATCH, ...THIRD_BATCH, ...FOURTH_BATCH, ...FIFTH_BATCH, ...SIXTH_BATCH, ...SEVENTH_BATCH].some(p => p.id === e.id))) throw Error('invalid_local_eighth_batch')
export const LOCAL_BATCH_PLAN = {
  target: 1000, batchSize: 50, totalBatches: 20, implemented: FIRST_BATCH.length + SECOND_BATCH.length + THIRD_BATCH.length + FOURTH_BATCH.length + FIFTH_BATCH.length + SIXTH_BATCH.length + SEVENTH_BATCH.length + EIGHTH_BATCH.length,
  batchOne: FIRST_BATCH.map(e => ({ id: e.id, path: e.path, method: e.method, proposedAtomicAmount: e.amount, productionApproved: false })),
  batchTwo: SECOND_BATCH.map(e => ({ id: e.id, path: e.path, method: e.method, proposedAtomicAmount: e.amount, productionApproved: false })),
  batchThree: THIRD_BATCH.map(e => ({ id: e.id, path: e.path, method: e.method, proposedAtomicAmount: e.amount, productionApproved: false })),
  batchFour: FOURTH_BATCH.map(e => ({ id: e.id, path: e.path, method: e.method, proposedAtomicAmount: e.amount, productionApproved: false })),
  batchFive: FIFTH_BATCH.map(e => ({ id: e.id, path: e.path, method: e.method, proposedAtomicAmount: e.amount, productionApproved: false })),
  batchSix: SIXTH_BATCH.map(e => ({ id: e.id, path: e.path, method: e.method, proposedAtomicAmount: e.amount, productionApproved: false })),
  batchSeven: SEVENTH_BATCH.map(e => ({ id: e.id, path: e.path, method: e.method, proposedAtomicAmount: e.amount, productionApproved: false })),
  batchEight: EIGHTH_BATCH.map(e => ({ id: e.id, path: e.path, method: e.method, proposedAtomicAmount: e.amount, productionApproved: false })),
  remaining: ENDPOINTS.filter(e => e.status !== 'local-implemented').map(e => ({ id: e.id, status: e.status, domain: e.domain })),
  plannedBatches: Array.from({ length: 12 }, (_, index) => ({ number: index + 9, status: 'not-built-needs-contract-review',
    products: ENDPOINTS.filter(e => e.status !== 'local-implemented').slice(index * 50, (index + 1) * 50).map(e => e.id) })),
  gates: ['Exact domain input/output contract', 'Distinct useful buyer task, not a parameter-only duplicate', 'Algorithm and adverse-case fixtures',
    'Independent client quote, result and recovery validation', 'Explicit source/rights and retention policy', 'Measured cost cap',
    'Local receipt, delivery and expiry evidence', 'User approval before deployment/indexing'],
  localOnly: true, paidCallsAuthorized: false, deploymentAuthorized: false,
}
