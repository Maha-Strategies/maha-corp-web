import { SKY_RECORD_AUDITS } from './batch15-sky.ts'
import { BATCH16_ORBITAL } from './batch16-orbital.ts'
import { BATCH16_EPHEMERIS } from './batch16-ephemeris.ts'
import { BATCH16_TELESCOPE } from './batch16-telescope.ts'
export const SIXTEENTH_BATCH_AUDITS = [...SKY_RECORD_AUDITS.slice(10), ...BATCH16_ORBITAL, ...BATCH16_EPHEMERIS, ...BATCH16_TELESCOPE]
if (SIXTEENTH_BATCH_AUDITS.length !== 50 || new Set(SIXTEENTH_BATCH_AUDITS.map(s => s.id)).size !== 50) throw Error('invalid_batch16_scope')
const byId = new Map(SIXTEENTH_BATCH_AUDITS.map(s => [s.id, s]))
export const batch16Audit = (id: string) => byId.get(id)
export const SIXTEENTH_BATCH_SAMPLES = Object.fromEntries(SIXTEENTH_BATCH_AUDITS.map(s => [s.id, s.sample]))
