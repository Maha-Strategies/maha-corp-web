import { RESEARCH_AUDITS } from './batch4-research-audits.ts'
import { CONTRACT_AUDITS } from './batch4-contract-audits.ts'
import { INFRASTRUCTURE_AUDITS } from './batch4-infrastructure-audits.ts'
export const FOURTH_BATCH_AUDITS = [...RESEARCH_AUDITS, ...CONTRACT_AUDITS, ...INFRASTRUCTURE_AUDITS]
if (FOURTH_BATCH_AUDITS.length !== 39 || new Set(FOURTH_BATCH_AUDITS.map(s => s.id)).size !== 39) throw Error('invalid_batch4_audit_cohort')
export const batch4Audit = (id: string) => FOURTH_BATCH_AUDITS.find(s => s.id === id)
