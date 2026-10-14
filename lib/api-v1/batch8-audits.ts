import { BATCH8_RECOVERY } from './batch8-recovery.ts'
import { BATCH8_API, BATCH8_TOOLS } from './batch8-contracts.ts'
import { BATCH8_TABULAR } from './batch8-tabular.ts'
export const EIGHTH_BATCH_AUDITS = [...BATCH8_RECOVERY, ...BATCH8_API, ...BATCH8_TOOLS, ...BATCH8_TABULAR]
if (EIGHTH_BATCH_AUDITS.length !== 50 || new Set(EIGHTH_BATCH_AUDITS.map(s => s.id)).size !== 50) throw Error('invalid_eighth_batch_cohort')
const byId = new Map(EIGHTH_BATCH_AUDITS.map(s => [s.id, s]))
export const batch8Audit = (id: string) => byId.get(id)
export const EIGHTH_BATCH_SAMPLES: Record<string, Record<string, unknown>> = Object.fromEntries(EIGHTH_BATCH_AUDITS.map(s => [s.id, s.sample]))
