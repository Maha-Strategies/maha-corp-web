import { BATCH13_CATALYSTS } from './batch13-catalysts.ts'
import { BATCH13_POLYMERS } from './batch13-polymers.ts'
import { BATCH13_ALLOYS } from './batch13-alloys.ts'
import { BATCH13_CERAMICS } from './batch13-ceramics.ts'
export const THIRTEENTH_BATCH_AUDITS = [...BATCH13_CATALYSTS, ...BATCH13_POLYMERS, ...BATCH13_ALLOYS, ...BATCH13_CERAMICS]
if (THIRTEENTH_BATCH_AUDITS.length !== 50 || new Set(THIRTEENTH_BATCH_AUDITS.map(s => s.id)).size !== 50) throw Error('invalid_batch13_scope')
const byId = new Map(THIRTEENTH_BATCH_AUDITS.map(s => [s.id, s]))
export const batch13Audit = (id: string) => byId.get(id)
export const THIRTEENTH_BATCH_SAMPLES = Object.fromEntries(THIRTEENTH_BATCH_AUDITS.map(s => [s.id, s.sample]))
