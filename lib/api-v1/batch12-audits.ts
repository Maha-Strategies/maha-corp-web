import { BATCH12_ECOLOGY } from './batch12-ecology.ts'
import { BATCH12_REACTIONS } from './batch12-reactions.ts'
import { BATCH12_SPECTROMETRY } from './batch12-spectrometry.ts'
import { BATCH12_CATALYSTS } from './batch12-catalysts.ts'
export const TWELFTH_BATCH_AUDITS = [...BATCH12_ECOLOGY, ...BATCH12_REACTIONS, ...BATCH12_SPECTROMETRY, ...BATCH12_CATALYSTS]
if (TWELFTH_BATCH_AUDITS.length !== 50 || new Set(TWELFTH_BATCH_AUDITS.map(s => s.id)).size !== 50) throw Error('invalid_batch12_scope')
const byId = new Map(TWELFTH_BATCH_AUDITS.map(s => [s.id, s]))
export const batch12Audit = (id: string) => byId.get(id)
export const TWELFTH_BATCH_SAMPLES = Object.fromEntries(TWELFTH_BATCH_AUDITS.map(s => [s.id, s.sample]))
