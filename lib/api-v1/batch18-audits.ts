import { TRIAL_REGISTRY_AUDITS } from './batch17-trials.ts'
import { BATCH18_GRANTS } from './batch18-grants.ts'
import { BATCH18_PROCUREMENT } from './batch18-procurement.ts'
import { BATCH18_CAMPAIGN } from './batch18-campaign.ts'
import { BATCH18_MARKET } from './batch18-market.ts'
export const EIGHTEENTH_BATCH_AUDITS = [...TRIAL_REGISTRY_AUDITS.slice(15), ...BATCH18_GRANTS, ...BATCH18_PROCUREMENT, ...BATCH18_CAMPAIGN, ...BATCH18_MARKET]
if (EIGHTEENTH_BATCH_AUDITS.length !== 50 || new Set(EIGHTEENTH_BATCH_AUDITS.map(s => s.id)).size !== 50) throw Error('invalid_batch18_scope')
const byId = new Map(EIGHTEENTH_BATCH_AUDITS.map(s => [s.id, s]))
export const batch18Audit = (id: string) => byId.get(id)
export const EIGHTEENTH_BATCH_SAMPLES = Object.fromEntries(EIGHTEENTH_BATCH_AUDITS.map(s => [s.id, s.sample]))
