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
import type {
  EpistemicReviewInvitation,
  EpistemicReviewInvitationEvent,
} from './epistemic-review-invitation.ts'
import type { ControlledReingestionCompilation } from './epistemic-reingestion.ts'
import {
  type EpistemicCanonicalRelease,
  type EpistemicReleaseWithdrawal,
  type ReleaseAuthoritySnapshot,
} from './epistemic-release.ts'
import { sha256Canonical } from './epistemic-publication.ts'
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
  const [ingestionResult, reingestionResult] = await Promise.all([
    client
      .from('epistemic_ingestion_records')
      .select('candidate_record_id,candidate_sha256,review_target_sha256,source_public_path,gate_decision,record_snapshot,created_at')
      .order('created_at', { ascending: false })
      .limit(500),
    client
      .from('epistemic_reingestion_compilations')
      .select('candidate_record_id,output_candidate_sha256,output_review_target_sha256,source_public_path,base_target_sha256,gate_decision,record_snapshot,compiled_at')
      .order('compiled_at', { ascending: false })
      .limit(500),
  ])
  if (ingestionResult.error) throw new Error(`Epistemic ingestion target read failed: ${ingestionResult.error.message}`)
  if (reingestionResult.error) throw new Error(`Epistemic re-ingestion target read failed: ${reingestionResult.error.message}`)
  const ingestionTargets = (ingestionResult.data ?? []).map((row) => {
    const snapshot = row.record_snapshot as { candidateSnapshot?: EpistemicRecord }
    return {
      origin: 'ingestion' as const,
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
      baseTargetSha256: null,
    }
  })
  const reingestionTargets = (reingestionResult.data ?? []).map((row) => ({
    origin: 'reingestion' as const,
    recordId: row.candidate_record_id,
    domainSlug: (row.record_snapshot as EpistemicRecord | null)?.domainSlug,
    title: (row.record_snapshot as EpistemicRecord | null)?.title,
    slug: (row.record_snapshot as EpistemicRecord | null)?.slug,
    candidateSha256: row.output_candidate_sha256,
    reviewTargetSha256: row.output_review_target_sha256,
    sourcePublicPath: row.source_public_path,
    gateDecision: row.gate_decision,
    ingestedAt: row.compiled_at,
    candidateSnapshot: row.record_snapshot as EpistemicRecord | undefined,
    baseTargetSha256: row.base_target_sha256,
  }))
  const targets = [...ingestionTargets, ...reingestionTargets]
    .sort((left, right) => String(right.ingestedAt).localeCompare(String(left.ingestedAt)))
  const latest = new Map<string, (typeof targets)[number]>()
  for (const target of targets) if (!latest.has(target.recordId)) latest.set(target.recordId, target)
  return [...latest.values()]
}

export async function insertEpistemicReingestionCompilation(
  client: SupabaseClient,
  compilation: ControlledReingestionCompilation,
  idempotencyKey: string,
  actorFingerprint: string,
) {
  const { data, error } = await client.rpc('record_epistemic_reingestion_compilation', {
    p_compilation: compilation,
    p_idempotency_hash: epistemicOperationsHash(idempotencyKey),
    p_actor_fingerprint: actorFingerprint,
  })
  if (error) throw new Error(`Epistemic re-ingestion failed [${error.code ?? 'unknown'}]: ${error.message}`)
  return data as { compilationId: string; outputReviewTargetSha256: string; idempotentReplay: boolean }
}

export async function listEpistemicReingestionCompilations(client: SupabaseClient): Promise<ControlledReingestionCompilation[]> {
  const { data, error } = await client
    .from('epistemic_reingestion_compilations')
    .select('compilation_snapshot')
    .order('compiled_at', { ascending: false })
    .limit(500)
  if (error) throw new Error(`Epistemic re-ingestion read failed: ${error.message}`)
  return (data ?? []).map((row) => row.compilation_snapshot as ControlledReingestionCompilation)
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

export async function insertEpistemicReviewerInvitation(
  client: SupabaseClient,
  invitation: EpistemicReviewInvitation,
  idempotencyKey: string,
  actorFingerprint: string,
) {
  const { data, error } = await client.rpc('record_epistemic_reviewer_invitation', {
    p_invitation: invitation,
    p_idempotency_hash: epistemicOperationsHash(idempotencyKey),
    p_actor_fingerprint: actorFingerprint,
  })
  if (error) throw new Error(`Epistemic reviewer invitation failed [${error.code ?? 'unknown'}]: ${error.message}`)
  return data as { invitationId: string; idempotentReplay: boolean }
}

export async function listEpistemicReviewerInvitations(client: SupabaseClient): Promise<EpistemicReviewInvitation[]> {
  const { data, error } = await client
    .from('epistemic_reviewer_invitations')
    .select('invitation_snapshot')
    .order('created_at', { ascending: false })
    .limit(500)
  if (error) throw new Error(`Epistemic reviewer invitation read failed: ${error.message}`)
  return (data ?? []).map((row) => row.invitation_snapshot as EpistemicReviewInvitation)
}

export async function listEpistemicReviewerInvitationEvents(client: SupabaseClient): Promise<EpistemicReviewInvitationEvent[]> {
  const { data, error } = await client
    .from('epistemic_reviewer_invitation_events')
    .select('event_snapshot')
    .order('occurred_at', { ascending: false })
    .limit(500)
  if (error) throw new Error(`Epistemic reviewer invitation event read failed: ${error.message}`)
  return (data ?? []).map((row) => row.event_snapshot as EpistemicReviewInvitationEvent)
}

export async function getEpistemicReviewerInvitationByTokenHash(
  client: SupabaseClient,
  tokenSha256: string,
) {
  const { data: invitationRow, error: invitationError } = await client
    .from('epistemic_reviewer_invitations')
    .select('invitation_snapshot')
    .eq('token_sha256', tokenSha256)
    .maybeSingle()
  if (invitationError) throw new Error(`Epistemic reviewer invitation lookup failed: ${invitationError.message}`)
  if (!invitationRow) return null
  const invitation = invitationRow.invitation_snapshot as EpistemicReviewInvitation
  const { data: eventRow, error: eventError } = await client
    .from('epistemic_reviewer_invitation_events')
    .select('event_snapshot')
    .eq('invitation_id', invitation.invitationId)
    .maybeSingle()
  if (eventError) throw new Error(`Epistemic reviewer invitation event lookup failed: ${eventError.message}`)
  return {
    invitation,
    event: eventRow?.event_snapshot as EpistemicReviewInvitationEvent | undefined,
  }
}

export async function consumeEpistemicReviewerInvitation(
  client: SupabaseClient,
  tokenSha256: string,
  review: EpistemicExpertReview,
  idempotencyKey: string,
  event: EpistemicReviewInvitationEvent,
) {
  const { data, error } = await client.rpc('consume_epistemic_reviewer_invitation', {
    p_token_sha256: tokenSha256,
    p_review: review,
    p_profile_sha256: expertReviewProfileHash(review.reviewer),
    p_idempotency_hash: epistemicOperationsHash(idempotencyKey),
    p_event: event,
  })
  if (error) throw new Error(`Epistemic reviewer invitation consumption failed [${error.code ?? 'unknown'}]: ${error.message}`)
  return data as { reviewId: string; decision: string; invitationId: string; idempotentReplay: boolean }
}

export async function revokeEpistemicReviewerInvitation(
  client: SupabaseClient,
  invitationId: string,
  event: EpistemicReviewInvitationEvent,
  idempotencyKey: string,
  actorFingerprint: string,
) {
  const { data, error } = await client.rpc('revoke_epistemic_reviewer_invitation', {
    p_invitation_id: invitationId,
    p_event: event,
    p_idempotency_hash: epistemicOperationsHash(idempotencyKey),
    p_actor_fingerprint: actorFingerprint,
  })
  if (error) throw new Error(`Epistemic reviewer invitation revocation failed [${error.code ?? 'unknown'}]: ${error.message}`)
  return data as { eventId: string; invitationId: string; idempotentReplay: boolean }
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

export async function insertEpistemicCanonicalRelease(
  client: SupabaseClient,
  release: EpistemicCanonicalRelease,
  idempotencyKey: string,
  actorFingerprint: string,
) {
  const { data, error } = await client.rpc('record_epistemic_canonical_release', {
    p_release: release,
    p_authority_sha256: sha256Canonical(release.authority satisfies ReleaseAuthoritySnapshot),
    p_idempotency_hash: epistemicOperationsHash(idempotencyKey),
    p_actor_fingerprint: actorFingerprint,
  })
  if (error) throw new Error(`Epistemic canonical release failed [${error.code ?? 'unknown'}]: ${error.message}`)
  return data as { releaseId: string; canonicalPath: string; idempotentReplay: boolean }
}

export async function insertEpistemicReleaseWithdrawal(
  client: SupabaseClient,
  withdrawal: EpistemicReleaseWithdrawal,
  idempotencyKey: string,
  actorFingerprint: string,
) {
  const { data, error } = await client.rpc('record_epistemic_release_withdrawal', {
    p_withdrawal: withdrawal,
    p_authority_sha256: sha256Canonical(withdrawal.authority satisfies ReleaseAuthoritySnapshot),
    p_idempotency_hash: epistemicOperationsHash(idempotencyKey),
    p_actor_fingerprint: actorFingerprint,
  })
  if (error) throw new Error(`Epistemic release withdrawal failed [${error.code ?? 'unknown'}]: ${error.message}`)
  return data as { withdrawalId: string; releaseId: string; idempotentReplay: boolean }
}

export async function listEpistemicCanonicalReleases(client: SupabaseClient): Promise<EpistemicCanonicalRelease[]> {
  const { data, error } = await client
    .from('epistemic_canonical_releases')
    .select('release_snapshot')
    .order('released_at', { ascending: false })
    .limit(1_000)
  if (error) throw new Error(`Epistemic canonical release read failed: ${error.message}`)
  return (data ?? []).map((row) => row.release_snapshot as EpistemicCanonicalRelease)
}

export async function listEpistemicReleaseWithdrawals(client: SupabaseClient): Promise<EpistemicReleaseWithdrawal[]> {
  const { data, error } = await client
    .from('epistemic_release_withdrawals')
    .select('withdrawal_snapshot')
    .order('withdrawn_at', { ascending: false })
    .limit(1_000)
  if (error) throw new Error(`Epistemic release withdrawal read failed: ${error.message}`)
  return (data ?? []).map((row) => row.withdrawal_snapshot as EpistemicReleaseWithdrawal)
}
