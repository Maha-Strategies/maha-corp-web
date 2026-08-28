import { FRONTIER_ALIGNMENT_AUDIT, alignmentBlockers } from './frontier-source-alignment.ts'
import { sha256Canonical } from './epistemic-publication.ts'

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

const records: AlignmentBatch7IntakeRecord[] = FRONTIER_ALIGNMENT_AUDIT
  .filter((entry) => !entry.evidence.sourceContentInspected)
  .map((entry) => ({
    recordId: entry.recordId,
    domainSlug: entry.domainSlug,
    sourceContractId: entry.sourceContractId,
    assignmentOrigin: entry.assignmentOrigin as 'positional-legacy',
    currentVerdict: entry.evidence.subjectAligned as 'insufficient-evidence' | 'inaccessible-source',
    contentInspected: false as const,
    explanatoryEligible: false as const,
    canonicalEligible: false as const,
    blockerCodes: alignmentBlockers(entry.recordId),
  }))
  .sort((left, right) => left.recordId < right.recordId ? -1 : left.recordId > right.recordId ? 1 : 0)

const domainCounts = Object.fromEntries(
  [...new Set(records.map((record) => record.domainSlug))]
    .sort()
    .map((domainSlug) => [domainSlug, records.filter((record) => record.domainSlug === domainSlug).length]),
)

const sourceContractCount = new Set(records.map((record) => record.sourceContractId)).size
const inaccessibleCount = records.filter((record) => record.currentVerdict === 'inaccessible-source').length

const unsigned = {
  schemaVersion: ALIGNMENT_BATCH_7_INTAKE_SCHEMA,
  batchId: 'frontier-alignment-batch-7-intake',
  status: 'inspection-pending' as const,
  recordCount: records.length,
  sourceContractCount,
  inaccessibleCount,
  metadataOrInsufficientCount: records.length - inaccessibleCount,
  explanatoryEligibleCount: 0,
  canonicalEligibleCount: 0,
  domainCounts,
  records,
}

export const ALIGNMENT_BATCH_7_INTAKE = {
  ...unsigned,
  digest: sha256Canonical(unsigned),
}

if (records.length !== 94) throw new Error(`Batch 7 intake must freeze 94 uninspected records; found ${records.length}.`)
if (sourceContractCount !== 19) throw new Error(`Batch 7 intake must cover 19 source contracts; found ${sourceContractCount}.`)
if (Object.keys(domainCounts).length !== 8) throw new Error(`Batch 7 intake must cover eight domains; found ${Object.keys(domainCounts).length}.`)
for (const record of records) {
  if (record.assignmentOrigin !== 'positional-legacy') throw new Error(`${record.recordId}: uninspected record is not marked positional legacy.`)
  if (!record.blockerCodes.includes('source-not-inspected') || !record.blockerCodes.includes('source-assignment-positional-legacy')) {
    throw new Error(`${record.recordId}: missing mandatory inspection or positional-assignment blocker.`)
  }
}
