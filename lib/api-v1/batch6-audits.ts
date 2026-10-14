import { BATCH6_MEETINGS } from './batch6-meetings.ts'
import { BATCH6_STUDY } from './batch6-study.ts'
import { BATCH6_INCIDENTS } from './batch6-incidents.ts'
import { BATCH6_SOURCES } from './batch6-sources.ts'
export const SIXTH_BATCH_AUDITS = [...BATCH6_MEETINGS, ...BATCH6_STUDY, ...BATCH6_INCIDENTS, ...BATCH6_SOURCES]
if (SIXTH_BATCH_AUDITS.length !== 50 || new Set(SIXTH_BATCH_AUDITS.map(s => s.id)).size !== 50) throw Error('invalid_sixth_batch_cohort')
const byId = new Map(SIXTH_BATCH_AUDITS.map(s => [s.id, s]))
export const batch6Audit = (id: string) => byId.get(id)
export const SIXTH_BATCH_SAMPLES: Record<string, Record<string, unknown>> = Object.fromEntries(SIXTH_BATCH_AUDITS.map(s => [s.id, s.sample]))
