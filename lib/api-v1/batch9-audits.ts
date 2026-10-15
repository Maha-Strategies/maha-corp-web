import { BATCH9_TABULAR } from './batch9-tabular.ts'
import { BATCH9_IDENTITIES, BATCH9_PROVENANCE, BATCH9_LICENSES } from './batch9-record-suite.ts'
export const NINTH_BATCH_AUDITS = [...BATCH9_TABULAR, ...BATCH9_IDENTITIES, ...BATCH9_PROVENANCE, ...BATCH9_LICENSES]
if (NINTH_BATCH_AUDITS.length !== 50 || new Set(NINTH_BATCH_AUDITS.map(s => s.id)).size !== 50) throw Error('invalid_batch9_scope')
const byId = new Map(NINTH_BATCH_AUDITS.map(s => [s.id, s]))
export const batch9Audit = (id: string) => byId.get(id)
export const NINTH_BATCH_SAMPLES = Object.fromEntries(NINTH_BATCH_AUDITS.map(s => [s.id, s.sample]))
