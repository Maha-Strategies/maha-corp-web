import { BATCH10_LICENSES, BATCH10_PACKAGES } from './batch10-manifests.ts'
import { BATCH10_CIRCUITS } from './batch10-circuits.ts'
import { BATCH10_CALIBRATIONS } from './batch10-calibrations.ts'
export const TENTH_BATCH_AUDITS = [...BATCH10_LICENSES, ...BATCH10_PACKAGES, ...BATCH10_CIRCUITS, ...BATCH10_CALIBRATIONS]
if (TENTH_BATCH_AUDITS.length !== 50 || new Set(TENTH_BATCH_AUDITS.map(s => s.id)).size !== 50) throw Error('invalid_batch10_scope')
const byId = new Map(TENTH_BATCH_AUDITS.map(s => [s.id, s]))
export const batch10Audit = (id: string) => byId.get(id)
export const TENTH_BATCH_SAMPLES = Object.fromEntries(TENTH_BATCH_AUDITS.map(s => [s.id, s.sample]))
