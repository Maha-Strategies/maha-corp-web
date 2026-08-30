import snapshot from '../content/epistemic/batch-11-revision-ingestion-records.json' with { type: 'json' }

import { epistemicReviewTargetHash, sha256Canonical } from './epistemic-publication.ts'
import type { EpistemicRecord } from './epistemic-schema.ts'

export const BATCH_11_REVISION_INGESTION_VERSION = 'maha-batch-11-revision-ingestion/1.0' as const

if (snapshot.schemaVersion !== BATCH_11_REVISION_INGESTION_VERSION
  || snapshot.purpose !== 'exact-record-ingestion-snapshot'
  || snapshot.records.length !== 5
  || sha256Canonical(snapshot.records) !== snapshot.recordsSha256) {
  throw new Error('The Batch 11 revision ingestion snapshot is invalid or has drifted.')
}

/**
 * Route-safe projection used by the admin ingestion adapter. The private audit,
 * decision, lineage, and remediation modules are deliberately absent from this
 * dependency path.
 */
export const BATCH_11_REVISED_INGESTION_RECORDS = snapshot.records as unknown as readonly EpistemicRecord[]

export const BATCH_11_REVISION_INSPECTION_ATTESTATIONS = BATCH_11_REVISED_INGESTION_RECORDS.map((record) => {
  const source = record.sources[0]
  if (record.sources.length !== 1 || !source?.exactLocator) {
    throw new Error(`${record.id}: Batch 11 ingestion attestation requires one exactly located source.`)
  }
  const base = {
    schemaVersion: 'maha-batch-11-inspection-attestation/1.0',
    recordId: record.id,
    reviewTargetSha256: epistemicReviewTargetHash(record),
    sourceId: source.id,
    exactLocator: source.exactLocator,
    inspectionKind: 'internal-content-inspection',
    externalReviewClaimed: false,
    independentlyReproduced: false,
  }
  return { ...base, attestationSha256: sha256Canonical(base) }
})
