import { BATCH14_CERAMICS } from './batch14-ceramics.ts'
import { BATCH14_BATTERIES } from './batch14-batteries.ts'
import { BATCH14_OPTICAL } from './batch14-optical.ts'
import { BATCH14_THERMAL } from './batch14-thermal.ts'
export const FOURTEENTH_BATCH_AUDITS = [...BATCH14_CERAMICS, ...BATCH14_BATTERIES, ...BATCH14_OPTICAL, ...BATCH14_THERMAL]
if (FOURTEENTH_BATCH_AUDITS.length !== 50 || new Set(FOURTEENTH_BATCH_AUDITS.map(s => s.id)).size !== 50) throw Error('invalid_batch14_scope')
const byId = new Map(FOURTEENTH_BATCH_AUDITS.map(s => [s.id, s]))
export const batch14Audit = (id: string) => byId.get(id)
export const FOURTEENTH_BATCH_SAMPLES = Object.fromEntries(FOURTEENTH_BATCH_AUDITS.map(s => [s.id, s.sample]))
