import { createClient, type SupabaseClient } from '@supabase/supabase-js'

import type { EpistemicRecord } from './epistemic-schema.ts'

import {
  ingestionBatchSnapshot,
  type EpistemicIngestionBatch,
} from './epistemic-ingestion.ts'
import {
  epistemicOperationsHash,
  expertReviewProfileHash,
  type EpistemicExpertReview,
  type ExpertReviewerSnapshot,
} from './epistemic-review.ts'
import {
  sourceCompletionIdempotencyHash,
  type SourceCompletionEvent,
} from './epistemic-work-queue.ts'

export function createEpistemicPersistenceClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceRoleKey) return null
  return createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })
}

export async function insertEpistemicIngestionBatch(
  client: SupabaseClient,
  batch: EpistemicIngestionBatch,
  idempotencyKey: string,
  actorFingerprint: string,
) {
  const { data, error } = await client.rpc('record_epistemic_ingestion_batch', {
    p_batch: ingestionBatchSnapshot(batch),
    p_records: batch.records,
    p_idempotency_hash: epistemicOperationsHash(idempotencyKey),
    p_actor_fingerprint: actorFingerprint,
  })
  if (error) throw new Error(`Epistemic ingestion failed [${error.code ?? 'unknown'}]: ${error.message}`)
  return data as { batchId: string; recordCount: number; idempotentReplay: boolean }
}

export async function listEpistemicIngestionBatches(client: SupabaseClient) {
  const { data, error } = await client
    .from('epistemic_ingestion_batches')
    .select('batch_snapshot')
    .order('ingested_at', { ascending: false })
    .limit(100)
  if (error) throw new Error(`Epistemic ingestion batch read failed: ${error.message}`)
  return (data ?? []).map((row) => row.batch_snapshot)
}

export async function listEpistemicReviewTargets(client: SupabaseClient) {
  const { data, error } = await client
    .from('epistemic_ingestion_records')
    .select('candidate_record_id,candidate_sha256,review_target_sha256,source_public_path,gate_decision,record_snapshot,created_at')
    .order('created_at', { ascending: false })
    .limit(500)
  if (error) throw new Error(`Epistemic ingestion target read failed: ${error.message}`)
  const targets = (data ?? []).map((row) => {
    const snapshot = row.record_snapshot as { candidateSnapshot?: EpistemicRecord }
    return {
      recordId: row.candidate_record_id,
      domainSlug: snapshot.candidateSnapshot?.domainSlug,
      title: snapshot.candidateSnapshot?.title,
      slug: snapshot.candidateSnapshot?.slug,
      candidateSha256: row.candidate_sha256,
      reviewTargetSha256: row.review_target_sha256,
      sourcePublicPath: row.source_public_path,
      gateDecision: row.gate_decision,
      ingestedAt: row.created_at,
      candidateSnapshot: snapshot.candidateSnapshot,
    }
  })
  const latest = new Map<string, (typeof targets)[number]>()
  for (const target of targets) if (!latest.has(target.recordId)) latest.set(target.recordId, target)
  return [...latest.values()]
}

export async function insertEpistemicExpertReview(
  client: SupabaseClient,
  review: EpistemicExpertReview,
  idempotencyKey: string,
  actorFingerprint: string,
) {
  const { data, error } = await client.rpc('record_epistemic_expert_review', {
    p_review: review,
    p_profile_sha256: expertReviewProfileHash(review.reviewer),
    p_idempotency_hash: epistemicOperationsHash(idempotencyKey),
    p_actor_fingerprint: actorFingerprint,
  })
  if (error) throw new Error(`Epistemic expert review failed [${error.code ?? 'unknown'}]: ${error.message}`)
  return data as { reviewId: string; decision: string; idempotentReplay: boolean }
}

export async function listEpistemicExpertReviews(client: SupabaseClient): Promise<EpistemicExpertReview[]> {
  const { data, error } = await client
    .from('epistemic_expert_review_decisions')
    .select('review_snapshot')
    .order('reviewed_at', { ascending: false })
    .limit(500)
  if (error) throw new Error(`Epistemic expert review read failed: ${error.message}`)
  return (data ?? []).map((row) => row.review_snapshot as EpistemicExpertReview)
}

export async function listEpistemicReviewerProfiles(client: SupabaseClient): Promise<ExpertReviewerSnapshot[]> {
  const { data, error } = await client
    .from('epistemic_expert_reviewer_profiles')
    .select('profile_snapshot')
    .order('created_at', { ascending: false })
    .limit(500)
  if (error) throw new Error(`Epistemic reviewer profile read failed: ${error.message}`)
  return (data ?? []).map((row) => row.profile_snapshot as ExpertReviewerSnapshot)
}

export async function insertEpistemicSourceCompletionEvent(
  client: SupabaseClient,
  event: SourceCompletionEvent,
  idempotencyKey: string,
  actorFingerprint: string,
) {
  const { data, error } = await client.rpc('record_epistemic_source_completion_event', {
    p_event: event,
    p_idempotency_hash: sourceCompletionIdempotencyHash(idempotencyKey),
    p_actor_fingerprint: actorFingerprint,
  })
  if (error) throw new Error(`Epistemic source-completion event failed [${error.code ?? 'unknown'}]: ${error.message}`)
  return data as { eventId: string; state: string; idempotentReplay: boolean }
}

export async function listEpistemicSourceCompletionEvents(client: SupabaseClient): Promise<SourceCompletionEvent[]> {
  const { data, error } = await client
    .from('epistemic_source_completion_events')
    .select('event_snapshot')
    .order('occurred_at', { ascending: false })
    .limit(2_000)
  if (error) throw new Error(`Epistemic source-completion event read failed: ${error.message}`)
  return (data ?? []).map((row) => row.event_snapshot as SourceCompletionEvent)
}
