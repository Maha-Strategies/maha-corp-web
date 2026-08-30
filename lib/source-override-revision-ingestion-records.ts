import snapshot from '../content/epistemic/source-override-revision-ingestion-records.json' with { type: 'json' }

import { sha256Canonical } from './epistemic-publication.ts'
import type { EpistemicRecord } from './epistemic-schema.ts'

export const SOURCE_OVERRIDE_REVISION_CANARY_VERSION = 'maha-source-override-revision-canary/0.1' as const

if (snapshot.schemaVersion !== SOURCE_OVERRIDE_REVISION_CANARY_VERSION
  || snapshot.purpose !== 'exact-record-ingestion-snapshot'
  || snapshot.records.length !== 5
  || sha256Canonical(snapshot.records) !== snapshot.recordsSha256) {
  throw new Error('The source-override revision ingestion snapshot is invalid or has drifted.')
}

/**
 * Minimal route-safe projection used only by the admin ingestion adapter.
 * Audit findings, review decisions, release plans, and remediation packets are
 * deliberately excluded from this snapshot and remain private build inputs.
 */
export const SOURCE_OVERRIDE_REVISED_INGESTION_RECORDS =
  snapshot.records as unknown as readonly EpistemicRecord[]
