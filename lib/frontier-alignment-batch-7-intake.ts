import { readFileSync } from 'node:fs'

/**
 * Immutable pre-inspection snapshot.
 *
 * Batch 7 changes the active audit, so deriving this intake from current state
 * would rewrite history. The committed JSON is the frozen 94-record queue that
 * existed before inspection; the separate results artifact records outcomes.
 */
export const ALIGNMENT_BATCH_7_INTAKE_SCHEMA = 'maha-frontier-alignment-intake/1.0' as const

export interface AlignmentBatch7IntakeRecord {
  recordId: string
  domainSlug: string
  sourceContractId: string
  assignmentOrigin: 'positional-legacy'
  currentVerdict: 'insufficient-evidence' | 'inaccessible-source'
  contentInspected: false
  explanatoryEligible: false
  canonicalEligible: false
  blockerCodes: readonly string[]
}

export interface AlignmentBatch7Intake {
  schemaVersion: typeof ALIGNMENT_BATCH_7_INTAKE_SCHEMA
  batchId: 'frontier-alignment-batch-7-intake'
  status: 'inspection-pending'
  recordCount: 94
  sourceContractCount: 19
  inaccessibleCount: number
  metadataOrInsufficientCount: number
  explanatoryEligibleCount: 0
  canonicalEligibleCount: 0
  domainCounts: Readonly<Record<string, number>>
  records: readonly AlignmentBatch7IntakeRecord[]
  digest: string
}

const intakeUrl = new URL('../content/frontier-alignment/batch-7-intake.json', import.meta.url)
export const ALIGNMENT_BATCH_7_INTAKE = JSON.parse(readFileSync(intakeUrl, 'utf8')) as AlignmentBatch7Intake

if (ALIGNMENT_BATCH_7_INTAKE.schemaVersion !== ALIGNMENT_BATCH_7_INTAKE_SCHEMA) throw new Error('Batch 7 intake schema drifted.')
if (ALIGNMENT_BATCH_7_INTAKE.records.length !== 94 || ALIGNMENT_BATCH_7_INTAKE.recordCount !== 94) {
  throw new Error('Batch 7 frozen intake must contain exactly 94 records.')
}
if (ALIGNMENT_BATCH_7_INTAKE.sourceContractCount !== 19) throw new Error('Batch 7 frozen intake must cover 19 source contracts.')
if (Object.keys(ALIGNMENT_BATCH_7_INTAKE.domainCounts).length !== 8) throw new Error('Batch 7 frozen intake must cover eight domains.')
