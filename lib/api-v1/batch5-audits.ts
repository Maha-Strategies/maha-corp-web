import { BATCH5_CONTRACTS } from './batch5-contracts.ts'
import { BATCH5_POLICY } from './batch5-policy.ts'
import { BATCH5_MANUALS } from './batch5-manuals.ts'
import { BATCH5_MEETINGS } from './batch5-meetings.ts'
export const FIFTH_BATCH_AUDITS = [...BATCH5_CONTRACTS, ...BATCH5_POLICY, ...BATCH5_MANUALS, ...BATCH5_MEETINGS]
if (FIFTH_BATCH_AUDITS.length !== 50 || new Set(FIFTH_BATCH_AUDITS.map(s => s.id)).size !== 50) throw Error('invalid_fifth_batch_cohort')
const byId = new Map(FIFTH_BATCH_AUDITS.map(s => [s.id, s]))
export const batch5Audit = (id: string) => byId.get(id)
export const FIFTH_BATCH_SAMPLES: Record<string, Record<string, unknown>> = Object.fromEntries(FIFTH_BATCH_AUDITS.map(s => [s.id, s.sample]))
