import { BATCH15_THERMAL } from './batch15-thermal.ts'
import { BATCH15_ROBOTICS } from './batch15-robotics.ts'
import { BATCH15_NEURAL } from './batch15-neural.ts'
import { BATCH15_SKY } from './batch15-sky.ts'
export const FIFTEENTH_BATCH_AUDITS = [...BATCH15_THERMAL, ...BATCH15_ROBOTICS, ...BATCH15_NEURAL, ...BATCH15_SKY]
if (FIFTEENTH_BATCH_AUDITS.length !== 50 || new Set(FIFTEENTH_BATCH_AUDITS.map(s => s.id)).size !== 50) throw Error('invalid_batch15_scope')
const byId = new Map(FIFTEENTH_BATCH_AUDITS.map(s => [s.id, s]))
export const batch15Audit = (id: string) => byId.get(id)
export const FIFTEENTH_BATCH_SAMPLES = Object.fromEntries(FIFTEENTH_BATCH_AUDITS.map(s => [s.id, s.sample]))
