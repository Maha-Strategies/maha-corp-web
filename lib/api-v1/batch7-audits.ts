import { BATCH7_TOOLS } from './batch7-tools.ts'
import { BATCH7_QUOTES } from './batch7-quotes.ts'
import { BATCH7_RECEIPTS } from './batch7-receipts.ts'
import { BATCH7_MANIFESTS } from './batch7-manifests.ts'
export const SEVENTH_BATCH_AUDITS = [...BATCH7_MANIFESTS.slice(0, 1), ...BATCH7_TOOLS, ...BATCH7_QUOTES, ...BATCH7_RECEIPTS, ...BATCH7_MANIFESTS.slice(1)]
if (SEVENTH_BATCH_AUDITS.length !== 50 || new Set(SEVENTH_BATCH_AUDITS.map(s => s.id)).size !== 50) throw Error('invalid_seventh_batch_cohort')
const byId = new Map(SEVENTH_BATCH_AUDITS.map(s => [s.id, s]))
export const batch7Audit = (id: string) => byId.get(id)
export const SEVENTH_BATCH_SAMPLES: Record<string, Record<string, unknown>> = Object.fromEntries(SEVENTH_BATCH_AUDITS.map(s => [s.id, s.sample]))
