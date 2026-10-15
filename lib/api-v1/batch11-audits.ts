import { BATCH11_CALIBRATIONS } from './batch10-calibrations.ts'
import { BATCH11_ASSAYS } from './batch11-assays.ts'
import { BATCH11_GENOMICS } from './batch11-genomics.ts'
import { BATCH11_PROTEINS } from './batch11-proteins.ts'
export const ELEVENTH_BATCH_AUDITS = [...BATCH11_CALIBRATIONS, ...BATCH11_ASSAYS, ...BATCH11_GENOMICS, ...BATCH11_PROTEINS]
if (ELEVENTH_BATCH_AUDITS.length !== 50 || new Set(ELEVENTH_BATCH_AUDITS.map(s => s.id)).size !== 50) throw Error('invalid_batch11_scope')
const byId = new Map(ELEVENTH_BATCH_AUDITS.map(s => [s.id, s]))
export const batch11Audit = (id: string) => byId.get(id)
export const ELEVENTH_BATCH_SAMPLES = Object.fromEntries(ELEVENTH_BATCH_AUDITS.map(s => [s.id, s.sample]))
