import type { SupabaseClient } from '@supabase/supabase-js'

import type { EpistemicCanonicalRelease } from './epistemic-release.ts'
import type {
  McpEvidenceExecutionReservation,
  McpEvidenceGrantSnapshot,
  McpEvidencePlanId,
  McpEvidenceSelector,
} from './mcp-evidence-licensing.ts'

type ReleaseRow = {
  release_id: string
  release_sha256: string
  release_snapshot: EpistemicCanonicalRelease
}

export async function findActiveMcpEvidenceRelease(
  client: SupabaseClient,
  selector: McpEvidenceSelector,
): Promise<EpistemicCanonicalRelease | null> {
  let query = client
    .from('epistemic_canonical_releases')
    .select('release_id,release_sha256,release_snapshot')
    .order('released_at', { ascending: false })
    .limit(selector.releaseId ? 2 : 100)
  query = selector.releaseId
    ? query.eq('release_id', selector.releaseId)
    : query.eq('canonical_path', selector.canonicalPath!)
  const { data, error } = await query
  if (error) throw new Error(`Canonical release lookup failed [${error.code ?? 'unknown'}].`)
  if (!data?.length) return null
  const rows = data as ReleaseRow[]
  const releaseIds = rows.map((row) => row.release_id)
  const [children, withdrawals] = await Promise.all([
    client.from('epistemic_canonical_releases').select('supersedes_release_id').in('supersedes_release_id', releaseIds),
    client.from('epistemic_release_withdrawals').select('release_id').in('release_id', releaseIds),
  ])
  if (children.error || withdrawals.error) throw new Error('Canonical release status lookup failed.')
  const superseded = new Set((children.data ?? []).map((row) => row.supersedes_release_id))
  const withdrawn = new Set((withdrawals.data ?? []).map((row) => row.release_id))
  const active = rows.filter((row) => !superseded.has(row.release_id) && !withdrawn.has(row.release_id))
  if (active.length !== 1) return null
  const row = active[0]
  if (row.release_snapshot.releaseId !== row.release_id || row.release_snapshot.releaseSha256 !== row.release_sha256) {
    throw new Error('Stored canonical release snapshot does not match its ledger identity.')
  }
  return row.release_snapshot
}

export type McpEvidenceReservationDecision =
  | ({ outcome: 'reserved' | 'idempotent_replay' } & McpEvidenceExecutionReservation)
  | { outcome: 'license_required' }
  | { outcome: 'quota_exhausted' }
  | { outcome: 'idempotency_conflict' }
  | { outcome: 'release_unavailable' }
  | { outcome: 'execution_failed' }

export async function reserveMcpEvidenceExecution(
  client: SupabaseClient,
  input: {
    executionId: string
    clientId: string
    credentialId: string
    clientRequestId: string
    requestSha256: string
    toolName: string
    releaseId: string
    releaseSha256: string
    observedAt: string
  },
): Promise<McpEvidenceReservationDecision> {
  const { data, error } = await client.rpc('reserve_mcp_evidence_execution', {
    p_execution_id: input.executionId,
    p_client_id: input.clientId,
    p_credential_id: input.credentialId,
    p_client_request_id: input.clientRequestId,
    p_request_sha256: input.requestSha256,
    p_tool_name: input.toolName,
    p_release_id: input.releaseId,
    p_release_sha256: input.releaseSha256,
    p_observed_at: input.observedAt,
  })
  if (error) throw new Error(`MCP evidence quota reservation failed [${error.code ?? 'unknown'}].`)
  const result = data as Record<string, unknown> | null
  const outcome = result?.outcome
  if (outcome === 'license_required' || outcome === 'quota_exhausted' || outcome === 'idempotency_conflict' || outcome === 'release_unavailable' || outcome === 'execution_failed') return { outcome }
  if (outcome !== 'reserved' && outcome !== 'idempotent_replay') throw new Error('MCP evidence quota reservation returned an invalid result.')
  if (!result) throw new Error('MCP evidence quota reservation returned no result.')
  return {
    outcome,
    executionId: String(result.executionId),
    grantId: String(result.grantId),
    planId: String(result.planId) as McpEvidencePlanId,
    planVersion: String(result.planVersion),
    clientRequestId: input.clientRequestId,
    requestSha256: input.requestSha256,
    releaseId: input.releaseId,
    releaseSha256: input.releaseSha256,
    quotaPeriodStartedAt: String(result.quotaPeriodStartedAt),
    unitQuantity: 1,
    idempotentReplay: outcome === 'idempotent_replay',
  }
}

export async function completeMcpEvidenceExecution(
  client: SupabaseClient,
  input: { executionId: string; outputSha256: string; eventSha256: string; completedAt: string },
) {
  const { data, error } = await client.rpc('complete_mcp_evidence_execution', {
    p_execution_id: input.executionId,
    p_output_sha256: input.outputSha256,
    p_event_sha256: input.eventSha256,
    p_completed_at: input.completedAt,
  })
  if (error) throw new Error(`MCP evidence completion failed [${error.code ?? 'unknown'}].`)
  return data as { outcome: 'completed' | 'idempotent_replay' }
}

export async function failMcpEvidenceExecution(
  client: SupabaseClient,
  input: { executionId: string; failureCode: string; eventSha256: string; failedAt: string },
) {
  const { data, error } = await client.rpc('fail_mcp_evidence_execution', {
    p_execution_id: input.executionId,
    p_failure_code: input.failureCode,
    p_event_sha256: input.eventSha256,
    p_failed_at: input.failedAt,
  })
  if (error) throw new Error(`MCP evidence failure recording failed [${error.code ?? 'unknown'}].`)
  return data as { outcome: 'failed' | 'idempotent_replay' }
}

export async function recordMcpEvidenceLicenseGrant(
  client: SupabaseClient,
  grant: McpEvidenceGrantSnapshot,
  idempotencySha256: string,
  actorFingerprint: string,
) {
  const { data, error } = await client.rpc('record_mcp_evidence_license_grant', {
    p_grant: grant,
    p_idempotency_sha256: idempotencySha256,
    p_actor_fingerprint: actorFingerprint,
  })
  if (error) throw new Error(`MCP evidence license grant failed [${error.code ?? 'unknown'}]: ${error.message}`)
  return data as { grantId: string; idempotentReplay: boolean }
}

export async function revokeMcpEvidenceLicenseGrant(
  client: SupabaseClient,
  input: { grantId: string; reason: string; revokedAt: string; idempotencySha256: string; actorFingerprint: string },
) {
  const { data, error } = await client.rpc('revoke_mcp_evidence_license_grant', {
    p_grant_id: input.grantId,
    p_reason: input.reason,
    p_revoked_at: input.revokedAt,
    p_idempotency_sha256: input.idempotencySha256,
    p_actor_fingerprint: input.actorFingerprint,
  })
  if (error) throw new Error(`MCP evidence license revocation failed [${error.code ?? 'unknown'}]: ${error.message}`)
  return data as { grantId: string; idempotentReplay: boolean }
}
