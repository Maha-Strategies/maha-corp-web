import type { SupabaseClient } from '@supabase/supabase-js'

import {
  ingestionBatchSnapshot,
  type EpistemicIngestionBatch,
} from './epistemic-ingestion.ts'
import { epistemicOperationsHash } from './epistemic-review.ts'

/**
 * Write-side ingestion persistence.
 *
 * Kept separate from the public release-ledger store so private adapter and
 * audit corpora cannot enter a public page's server bundle through a shared
 * module import.
 */
export async function insertEpistemicIngestionBatch(
  client: SupabaseClient,
  batch: EpistemicIngestionBatch,
  idempotencyKey: string,
  actorFingerprint: string,
) {
  const rpc = batch.adapterId === 'frontier-canary'
    ? 'record_epistemic_frontier_canary_batch'
    : batch.adapterId === 'substantial-batch-2-internal-review'
      ? 'record_substantial_batch2_internal_review_targets'
      : batch.adapterId === 'substantial-scale-release'
        ? 'record_substantial_scale_release_targets_v2'
      : batch.adapterId === 'repaired-revision-canary'
        ? 'record_repaired_revision_canary_targets'
      : batch.adapterId === 'source-override-revision-canary'
        ? 'record_source_override_revision_canary_targets'
      : batch.adapterId === 'mcp-private-canary'
        ? 'record_mcp_private_canary_target'
      : batch.adapterId === 'batch-11-mixed-lineage-rehearsal'
        ? 'record_batch_11_rehearsal_targets'
      : 'record_epistemic_ingestion_batch'
  const { data, error } = await client.rpc(rpc, {
    p_batch: ingestionBatchSnapshot(batch),
    p_records: batch.records,
    p_idempotency_hash: epistemicOperationsHash(idempotencyKey),
    p_actor_fingerprint: actorFingerprint,
  })
  if (error) throw new Error(`Epistemic ingestion failed [${error.code ?? 'unknown'}]: ${error.message}`)
  return data as { batchId: string; recordCount: number; idempotentReplay: boolean }
}
