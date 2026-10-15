import { TELESCOPE_CALIBRATION_AUDITS } from './batch16-telescope.ts'
import { BATCH17_PLANETARY } from './batch17-planetary.ts'
import { BATCH17_PUBLICATIONS } from './batch17-publications.ts'
import { BATCH17_TRIALS } from './batch17-trials.ts'
export const SEVENTEENTH_BATCH_AUDITS = [...TELESCOPE_CALIBRATION_AUDITS.slice(13), ...BATCH17_PLANETARY, ...BATCH17_PUBLICATIONS, ...BATCH17_TRIALS]
if (SEVENTEENTH_BATCH_AUDITS.length !== 50 || new Set(SEVENTEENTH_BATCH_AUDITS.map(s => s.id)).size !== 50) throw Error('invalid_batch17_scope')
const byId = new Map(SEVENTEENTH_BATCH_AUDITS.map(s => [s.id, s]))
export const batch17Audit = (id: string) => byId.get(id)
export const SEVENTEENTH_BATCH_SAMPLES = Object.fromEntries(SEVENTEENTH_BATCH_AUDITS.map(s => [s.id, s.sample]))
