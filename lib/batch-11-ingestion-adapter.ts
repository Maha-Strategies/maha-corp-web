import { definition } from './epistemic-adapters.ts'
import { epistemicRecordPath } from './epistemic-publication.ts'
import { BATCH_11_REVISED_RECORDS } from './batch-11-revision-canary.ts'

/**
 * Private Batch 11 adapter.
 *
 * This module is imported only by the write-side ingestion path. Keeping it
 * outside the general adapter registry prevents its audit corpus and source
 * inspection dependencies from entering public publishing-factory bundles.
 */
export const BATCH_11_MIXED_LINEAGE_REHEARSAL_ADAPTER = definition({
  id: 'batch-11-mixed-lineage-rehearsal',
  name: 'Batch 11 mixed-lineage Preview rehearsal',
  description: 'Exactly five inspected, internally reviewed revised targets for the isolated mixed-lineage Preview rehearsal. Ingestion cannot approve or release them.',
  sourceDatasetVersion: 'maha-batch-11-revision-canary/0.1',
  sourceRecords: BATCH_11_REVISED_RECORDS,
  sourceSources: BATCH_11_REVISED_RECORDS.flatMap((record) => record.sources),
  build: () => BATCH_11_REVISED_RECORDS.map((record) => ({
    sourceRecordId: record.id,
    sourceRecord: record,
    sourcePublicPath: epistemicRecordPath(record),
    record: structuredClone(record),
  })),
})
