import { bearerMatches, jsonResponse } from '@/lib/agent-inquiries'
import { validCredentialId } from '@/lib/agent-client-credentials'
import { createAgentInquiryLedger } from '@/lib/agent-inquiry-ledger'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function reviewerAuthorized(request: Request): boolean {
  const token = process.env.AGENT_REVIEW_TOKEN
  return Boolean(token && bearerMatches(request, token))
}

function reason(value: unknown): string | null {
  if (value === undefined || value === null || value === '') return null
  if (typeof value !== 'string') throw new Error('reason must be a string.')
  const trimmed = value.trim()
  if (!trimmed || trimmed.length > 500) throw new Error('reason must be between 1 and 500 characters.')
  return trimmed
}

export async function GET(request: Request, context: RouteContext<'/api/agent-credentials/[credentialId]'>) {
  const { credentialId } = await context.params
  if (!reviewerAuthorized(request)) {
    return jsonResponse({ error: { code: 'unauthorized', message: 'A valid reviewer bearer token is required.' } }, 401)
  }
  if (!validCredentialId(credentialId)) return jsonResponse({ error: { code: 'not_found', message: 'Credential not found.' } }, 404)

  const ledger = createAgentInquiryLedger()
  if (!ledger) return jsonResponse({ error: { code: 'ledger_unavailable', message: 'The credential registry is not configured.' } }, 503)
  const { data: credential, error: credentialError } = await ledger
    .from('agent_client_credentials')
    .select('public_id, client_id, label, secret_prefix, allowed_offer_ids, rate_limit_per_hour, expires_at, status, issued_at, revoked_at, revocation_reason')
    .eq('public_id', credentialId)
    .maybeSingle()
  if (credentialError) return jsonResponse({ error: { code: 'ledger_unavailable', message: 'The credential could not be read.' } }, 503)
  if (!credential) return jsonResponse({ error: { code: 'not_found', message: 'Credential not found.' } }, 404)

  const { data: events, error: eventsError } = await ledger
    .from('agent_credential_events')
    .select('event_type, actor_type, event_hash, metadata, created_at')
    .eq('credential_id', credentialId)
    .order('created_at', { ascending: true })
  if (eventsError) return jsonResponse({ error: { code: 'ledger_unavailable', message: 'The credential audit trail could not be read.' } }, 503)

  return jsonResponse({ credential, events, secretsIncluded: false }, 200)
}

export async function PATCH(request: Request, context: RouteContext<'/api/agent-credentials/[credentialId]'>) {
  const { credentialId } = await context.params
  if (!reviewerAuthorized(request)) {
    return jsonResponse({ error: { code: 'unauthorized', message: 'A valid reviewer bearer token is required.' } }, 401)
  }
  if (!validCredentialId(credentialId)) return jsonResponse({ error: { code: 'not_found', message: 'Credential not found.' } }, 404)
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
    return jsonResponse({ error: { code: 'unsupported_media_type', message: 'Content-Type must be application/json.' } }, 415)
  }

  let revocationReason: string | null
  try {
    const body = await request.json() as { action?: unknown; reason?: unknown }
    if (body.action !== 'revoke') throw new Error('action must be revoke.')
    revocationReason = reason(body.reason)
  } catch (error) {
    return jsonResponse({ error: { code: 'invalid_request', message: error instanceof Error ? error.message : 'Invalid request body.' } }, 400)
  }

  const ledger = createAgentInquiryLedger()
  if (!ledger) return jsonResponse({ error: { code: 'ledger_unavailable', message: 'The credential registry is not configured.' } }, 503)
  const revokedAt = new Date().toISOString()
  const { data, error } = await ledger
    .from('agent_client_credentials')
    .update({ status: 'revoked', revoked_at: revokedAt, revocation_reason: revocationReason })
    .eq('public_id', credentialId)
    .eq('status', 'active')
    .select('public_id, client_id, status, revoked_at')
    .maybeSingle()
  if (error) return jsonResponse({ error: { code: 'ledger_unavailable', message: 'The credential could not be revoked.' } }, 503)
  if (!data) return jsonResponse({ error: { code: 'not_found', message: 'Active credential not found.' } }, 404)

  return jsonResponse({ credential: data, revoked: true, note: 'Revocation takes effect immediately for new inquiry requests.' }, 200)
}
