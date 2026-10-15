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
import { NINTH_BATCH_AUDITS } from './batch9-audits.ts'
import { TENTH_BATCH_AUDITS } from './batch10-audits.ts'
import { ELEVENTH_BATCH_AUDITS } from './batch11-audits.ts'
import { TWELFTH_BATCH_AUDITS } from './batch12-audits.ts'
import { THIRTEENTH_BATCH_AUDITS } from './batch13-audits.ts'
import { FOURTEENTH_BATCH_AUDITS } from './batch14-audits.ts'
import { FIFTEENTH_BATCH_AUDITS } from './batch15-audits.ts'
import { SIXTEENTH_BATCH_AUDITS } from './batch16-audits.ts'
import { SEVENTEENTH_BATCH_AUDITS } from './batch17-audits.ts'
import { EIGHTEENTH_BATCH_AUDITS } from './batch18-audits.ts'
import { NINETEENTH_BATCH_AUDITS } from './batch19-audits.ts'
import { TWENTIETH_BATCH_AUDITS } from './batch20-audits.ts'
import { BATCH20_PORTS } from './batch20-ports.ts'
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
export const NINTH_BATCH_IDS = NINTH_BATCH_AUDITS.map(s => s.id)
export const NINTH_BATCH = NINTH_BATCH_IDS.map(id => { const e = endpointById(id); if (!e || e.status !== 'local-implemented') throw Error('ninth_batch_identity_missing'); return e })
if (NINTH_BATCH.length !== 50 || new Set(NINTH_BATCH_IDS).size !== 50 || NINTH_BATCH.some(e => e.productionApproved || [...FIRST_BATCH, ...SECOND_BATCH, ...THIRD_BATCH, ...FOURTH_BATCH, ...FIFTH_BATCH, ...SIXTH_BATCH, ...SEVENTH_BATCH, ...EIGHTH_BATCH].some(p => p.id === e.id))) throw Error('invalid_local_ninth_batch')
export const TENTH_BATCH_IDS = TENTH_BATCH_AUDITS.map(s => s.id)
export const TENTH_BATCH = TENTH_BATCH_IDS.map(id => { const e = endpointById(id); if (!e || e.status !== 'local-implemented') throw Error('tenth_batch_identity_missing'); return e })
if (TENTH_BATCH.length !== 50 || new Set(TENTH_BATCH_IDS).size !== 50 || TENTH_BATCH.some(e => e.productionApproved || [...FIRST_BATCH, ...SECOND_BATCH, ...THIRD_BATCH, ...FOURTH_BATCH, ...FIFTH_BATCH, ...SIXTH_BATCH, ...SEVENTH_BATCH, ...EIGHTH_BATCH, ...NINTH_BATCH].some(p => p.id === e.id))) throw Error('invalid_local_tenth_batch')
export const ELEVENTH_BATCH_IDS = ELEVENTH_BATCH_AUDITS.map(s => s.id)
export const ELEVENTH_BATCH = ELEVENTH_BATCH_IDS.map(id => { const e = endpointById(id); if (!e || e.status !== 'local-implemented') throw Error('eleventh_batch_identity_missing'); return e })
if (ELEVENTH_BATCH.length !== 50 || new Set(ELEVENTH_BATCH_IDS).size !== 50 || ELEVENTH_BATCH.some(e => e.productionApproved || [...FIRST_BATCH, ...SECOND_BATCH, ...THIRD_BATCH, ...FOURTH_BATCH, ...FIFTH_BATCH, ...SIXTH_BATCH, ...SEVENTH_BATCH, ...EIGHTH_BATCH, ...NINTH_BATCH, ...TENTH_BATCH].some(p => p.id === e.id))) throw Error('invalid_local_eleventh_batch')
export const TWELFTH_BATCH_IDS = TWELFTH_BATCH_AUDITS.map(s => s.id)
export const TWELFTH_BATCH = TWELFTH_BATCH_IDS.map(id => { const e = endpointById(id); if (!e || e.status !== 'local-implemented') throw Error('twelfth_batch_identity_missing'); return e })
if (TWELFTH_BATCH.length !== 50 || new Set(TWELFTH_BATCH_IDS).size !== 50 || TWELFTH_BATCH.some(e => e.productionApproved || [...FIRST_BATCH, ...SECOND_BATCH, ...THIRD_BATCH, ...FOURTH_BATCH, ...FIFTH_BATCH, ...SIXTH_BATCH, ...SEVENTH_BATCH, ...EIGHTH_BATCH, ...NINTH_BATCH, ...TENTH_BATCH, ...ELEVENTH_BATCH].some(p => p.id === e.id))) throw Error('invalid_local_twelfth_batch')
export const THIRTEENTH_BATCH_IDS = THIRTEENTH_BATCH_AUDITS.map(s => s.id)
export const THIRTEENTH_BATCH = THIRTEENTH_BATCH_IDS.map(id => { const e = endpointById(id); if (!e || e.status !== 'local-implemented') throw Error('thirteenth_batch_identity_missing'); return e })
if (THIRTEENTH_BATCH.length !== 50 || new Set(THIRTEENTH_BATCH_IDS).size !== 50 || THIRTEENTH_BATCH.some(e => e.productionApproved || [...FIRST_BATCH, ...SECOND_BATCH, ...THIRD_BATCH, ...FOURTH_BATCH, ...FIFTH_BATCH, ...SIXTH_BATCH, ...SEVENTH_BATCH, ...EIGHTH_BATCH, ...NINTH_BATCH, ...TENTH_BATCH, ...ELEVENTH_BATCH, ...TWELFTH_BATCH].some(p => p.id === e.id))) throw Error('invalid_local_thirteenth_batch')
export const FOURTEENTH_BATCH_IDS = FOURTEENTH_BATCH_AUDITS.map(s => s.id)
export const FOURTEENTH_BATCH = FOURTEENTH_BATCH_IDS.map(id => { const e = endpointById(id); if (!e || e.status !== 'local-implemented') throw Error('fourteenth_batch_identity_missing'); return e })
if (FOURTEENTH_BATCH.length !== 50 || new Set(FOURTEENTH_BATCH_IDS).size !== 50 || FOURTEENTH_BATCH.some(e => e.productionApproved || [...FIRST_BATCH, ...SECOND_BATCH, ...THIRD_BATCH, ...FOURTH_BATCH, ...FIFTH_BATCH, ...SIXTH_BATCH, ...SEVENTH_BATCH, ...EIGHTH_BATCH, ...NINTH_BATCH, ...TENTH_BATCH, ...ELEVENTH_BATCH, ...TWELFTH_BATCH, ...THIRTEENTH_BATCH].some(p => p.id === e.id))) throw Error('invalid_local_fourteenth_batch')
export const FIFTEENTH_BATCH_IDS = FIFTEENTH_BATCH_AUDITS.map(s => s.id)
export const FIFTEENTH_BATCH = FIFTEENTH_BATCH_IDS.map(id => { const e = endpointById(id); if (!e || e.status !== 'local-implemented') throw Error('fifteenth_batch_identity_missing'); return e })
if (FIFTEENTH_BATCH.length !== 50 || new Set(FIFTEENTH_BATCH_IDS).size !== 50 || FIFTEENTH_BATCH.some(e => e.productionApproved || [...FIRST_BATCH, ...SECOND_BATCH, ...THIRD_BATCH, ...FOURTH_BATCH, ...FIFTH_BATCH, ...SIXTH_BATCH, ...SEVENTH_BATCH, ...EIGHTH_BATCH, ...NINTH_BATCH, ...TENTH_BATCH, ...ELEVENTH_BATCH, ...TWELFTH_BATCH, ...THIRTEENTH_BATCH, ...FOURTEENTH_BATCH].some(p => p.id === e.id))) throw Error('invalid_local_fifteenth_batch')
export const SIXTEENTH_BATCH_IDS = SIXTEENTH_BATCH_AUDITS.map(s => s.id)
export const SIXTEENTH_BATCH = SIXTEENTH_BATCH_IDS.map(id => { const e = endpointById(id); if (!e || e.status !== 'local-implemented') throw Error('sixteenth_batch_identity_missing'); return e })
if (SIXTEENTH_BATCH.length !== 50 || new Set(SIXTEENTH_BATCH_IDS).size !== 50 || SIXTEENTH_BATCH.some(e => e.productionApproved || [...FIRST_BATCH, ...SECOND_BATCH, ...THIRD_BATCH, ...FOURTH_BATCH, ...FIFTH_BATCH, ...SIXTH_BATCH, ...SEVENTH_BATCH, ...EIGHTH_BATCH, ...NINTH_BATCH, ...TENTH_BATCH, ...ELEVENTH_BATCH, ...TWELFTH_BATCH, ...THIRTEENTH_BATCH, ...FOURTEENTH_BATCH, ...FIFTEENTH_BATCH].some(p => p.id === e.id))) throw Error('invalid_local_sixteenth_batch')
export const SEVENTEENTH_BATCH_IDS = SEVENTEENTH_BATCH_AUDITS.map(s => s.id)
export const SEVENTEENTH_BATCH = SEVENTEENTH_BATCH_IDS.map(id => { const e = endpointById(id); if (!e || e.status !== 'local-implemented') throw Error('seventeenth_batch_identity_missing'); return e })
if (SEVENTEENTH_BATCH.length !== 50 || new Set(SEVENTEENTH_BATCH_IDS).size !== 50 || SEVENTEENTH_BATCH.some(e => e.productionApproved || [...FIRST_BATCH, ...SECOND_BATCH, ...THIRD_BATCH, ...FOURTH_BATCH, ...FIFTH_BATCH, ...SIXTH_BATCH, ...SEVENTH_BATCH, ...EIGHTH_BATCH, ...NINTH_BATCH, ...TENTH_BATCH, ...ELEVENTH_BATCH, ...TWELFTH_BATCH, ...THIRTEENTH_BATCH, ...FOURTEENTH_BATCH, ...FIFTEENTH_BATCH, ...SIXTEENTH_BATCH].some(p => p.id === e.id))) throw Error('invalid_local_seventeenth_batch')
export const EIGHTEENTH_BATCH_IDS = EIGHTEENTH_BATCH_AUDITS.map(s => s.id)
export const EIGHTEENTH_BATCH = EIGHTEENTH_BATCH_IDS.map(id => { const e = endpointById(id); if (!e || e.status !== 'local-implemented') throw Error('eighteenth_batch_identity_missing'); return e })
if (EIGHTEENTH_BATCH.length !== 50 || new Set(EIGHTEENTH_BATCH_IDS).size !== 50 || EIGHTEENTH_BATCH.some(e => e.productionApproved || [...FIRST_BATCH, ...SECOND_BATCH, ...THIRD_BATCH, ...FOURTH_BATCH, ...FIFTH_BATCH, ...SIXTH_BATCH, ...SEVENTH_BATCH, ...EIGHTH_BATCH, ...NINTH_BATCH, ...TENTH_BATCH, ...ELEVENTH_BATCH, ...TWELFTH_BATCH, ...THIRTEENTH_BATCH, ...FOURTEENTH_BATCH, ...FIFTEENTH_BATCH, ...SIXTEENTH_BATCH, ...SEVENTEENTH_BATCH].some(p => p.id === e.id))) throw Error('invalid_local_eighteenth_batch')
export const NINETEENTH_BATCH_IDS = NINETEENTH_BATCH_AUDITS.map(s => s.id)
export const NINETEENTH_BATCH = NINETEENTH_BATCH_IDS.map(id => { const e = endpointById(id); if (!e || e.status !== 'local-implemented') throw Error('nineteenth_batch_identity_missing'); return e })
if (NINETEENTH_BATCH.length !== 50 || new Set(NINETEENTH_BATCH_IDS).size !== 50 || NINETEENTH_BATCH.some(e => e.productionApproved || [...FIRST_BATCH, ...SECOND_BATCH, ...THIRD_BATCH, ...FOURTH_BATCH, ...FIFTH_BATCH, ...SIXTH_BATCH, ...SEVENTH_BATCH, ...EIGHTH_BATCH, ...NINTH_BATCH, ...TENTH_BATCH, ...ELEVENTH_BATCH, ...TWELFTH_BATCH, ...THIRTEENTH_BATCH, ...FOURTEENTH_BATCH, ...FIFTEENTH_BATCH, ...SIXTEENTH_BATCH, ...SEVENTEENTH_BATCH, ...EIGHTEENTH_BATCH].some(p => p.id === e.id))) throw Error('invalid_local_nineteenth_batch')
export const TWENTIETH_BATCH_IDS = [...BATCH20_PORTS.map(s => s.id), ...TWENTIETH_BATCH_AUDITS.map(s => s.id)]
export const TWENTIETH_BATCH = TWENTIETH_BATCH_IDS.map(id => { const e = endpointById(id); if (!e || e.status !== 'local-implemented') throw Error('twentieth_batch_identity_missing'); return e })
if (TWENTIETH_BATCH.length !== 50 || new Set(TWENTIETH_BATCH_IDS).size !== 50 || TWENTIETH_BATCH.some(e => e.productionApproved)) throw Error('invalid_local_twentieth_batch')
export const LOCAL_BATCH_PLAN = {
  target: 1000, batchSize: 50, totalBatches: 20, implemented: FIRST_BATCH.length + SECOND_BATCH.length + THIRD_BATCH.length + FOURTH_BATCH.length + FIFTH_BATCH.length + SIXTH_BATCH.length + SEVENTH_BATCH.length + EIGHTH_BATCH.length + NINTH_BATCH.length + TENTH_BATCH.length + ELEVENTH_BATCH.length + TWELFTH_BATCH.length + THIRTEENTH_BATCH.length + FOURTEENTH_BATCH.length + FIFTEENTH_BATCH.length + SIXTEENTH_BATCH.length + SEVENTEENTH_BATCH.length + EIGHTEENTH_BATCH.length + NINETEENTH_BATCH.length + TWENTIETH_BATCH.length,
  batchOne: FIRST_BATCH.map(e => ({ id: e.id, path: e.path, method: e.method, proposedAtomicAmount: e.amount, productionApproved: false })),
  batchTwo: SECOND_BATCH.map(e => ({ id: e.id, path: e.path, method: e.method, proposedAtomicAmount: e.amount, productionApproved: false })),
  batchThree: THIRD_BATCH.map(e => ({ id: e.id, path: e.path, method: e.method, proposedAtomicAmount: e.amount, productionApproved: false })),
  batchFour: FOURTH_BATCH.map(e => ({ id: e.id, path: e.path, method: e.method, proposedAtomicAmount: e.amount, productionApproved: false })),
  batchFive: FIFTH_BATCH.map(e => ({ id: e.id, path: e.path, method: e.method, proposedAtomicAmount: e.amount, productionApproved: false })),
  batchSix: SIXTH_BATCH.map(e => ({ id: e.id, path: e.path, method: e.method, proposedAtomicAmount: e.amount, productionApproved: false })),
  batchSeven: SEVENTH_BATCH.map(e => ({ id: e.id, path: e.path, method: e.method, proposedAtomicAmount: e.amount, productionApproved: false })),
  batchEight: EIGHTH_BATCH.map(e => ({ id: e.id, path: e.path, method: e.method, proposedAtomicAmount: e.amount, productionApproved: false })),
  batchNine: NINTH_BATCH.map(e => ({ id: e.id, path: e.path, method: e.method, proposedAtomicAmount: e.amount, productionApproved: false })),
  batchTen: TENTH_BATCH.map(e => ({ id: e.id, path: e.path, method: e.method, proposedAtomicAmount: e.amount, productionApproved: false })),
  batchEleven: ELEVENTH_BATCH.map(e => ({ id: e.id, path: e.path, method: e.method, proposedAtomicAmount: e.amount, productionApproved: false })),
  batchTwelve: TWELFTH_BATCH.map(e => ({ id: e.id, path: e.path, method: e.method, proposedAtomicAmount: e.amount, productionApproved: false })),
  batchThirteen: THIRTEENTH_BATCH.map(e => ({ id: e.id, path: e.path, method: e.method, proposedAtomicAmount: e.amount, productionApproved: false })),
  batchFourteen: FOURTEENTH_BATCH.map(e => ({ id: e.id, path: e.path, method: e.method, proposedAtomicAmount: e.amount, productionApproved: false })),
  batchFifteen: FIFTEENTH_BATCH.map(e => ({ id: e.id, path: e.path, method: e.method, proposedAtomicAmount: e.amount, productionApproved: false })),
  batchSixteen: SIXTEENTH_BATCH.map(e => ({ id: e.id, path: e.path, method: e.method, proposedAtomicAmount: e.amount, productionApproved: false })),
  batchSeventeen: SEVENTEENTH_BATCH.map(e => ({ id: e.id, path: e.path, method: e.method, proposedAtomicAmount: e.amount, productionApproved: false })),
  batchEighteen: EIGHTEENTH_BATCH.map(e => ({ id: e.id, path: e.path, method: e.method, proposedAtomicAmount: e.amount, productionApproved: false })),
  batchNineteen: NINETEENTH_BATCH.map(e => ({ id: e.id, path: e.path, method: e.method, proposedAtomicAmount: e.amount, productionApproved: false })),
  batchTwenty: TWENTIETH_BATCH.map(e => ({ id: e.id, path: e.path, method: e.method, proposedAtomicAmount: e.amount, productionApproved: false })),
  remaining: ENDPOINTS.filter(e => e.status !== 'local-implemented').map(e => ({ id: e.id, status: e.status, domain: e.domain })),
  plannedBatches: Array.from({ length: 0 }, (_, index) => ({ number: index + 21, status: 'not-built-needs-contract-review',
    products: ENDPOINTS.filter(e => e.status !== 'local-implemented').slice(index * 50, (index + 1) * 50).map(e => e.id) })),
  gates: ['Exact domain input/output contract', 'Distinct useful buyer task, not a parameter-only duplicate', 'Algorithm and adverse-case fixtures',
    'Independent client quote, result and recovery validation', 'Explicit source/rights and retention policy', 'Measured cost cap',
    'Local receipt, delivery and expiry evidence', 'User approval before deployment/indexing'],
  localOnly: true, paidCallsAuthorized: false, deploymentAuthorized: false,
}
