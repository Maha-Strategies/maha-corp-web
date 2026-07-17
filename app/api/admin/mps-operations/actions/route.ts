import { createHash } from 'node:crypto'

import { createCredentialId, createCredentialSecret } from '@/lib/agent-client-credentials'
import { jsonResponse } from '@/lib/agent-inquiries'
import { createAgentInquiryLedger } from '@/lib/agent-inquiry-ledger'
import { createCreditLedgerEntryId } from '@/lib/mps-credits'
import {
  authorizeMpsOperations,
  createMpsOperatorActionId,
  operatorActionRequestHash,
  operatorIdempotencyHash,
  parseMpsOperatorAction,
} from '@/lib/mps-operations'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAX_BODY_BYTES = 8_192

function databaseError(code: string | undefined) {
  if (code === '22023') return jsonResponse({ error: { code: 'invalid_request', message: 'The operation failed database validation.' } }, 400)
  if (code === 'P0002') return jsonResponse({ error: { code: 'not_found', message: 'The operation target was not found.' } }, 404)
  if (code === '23505') return jsonResponse({ error: { code: 'idempotency_conflict', message: 'The idempotency key or replacement target was already used.' } }, 409)
  if (code === 'P0001') return jsonResponse({ error: { code: 'operation_not_allowed', message: 'The requested operation is not allowed for the target’s current state.' } }, 409)
  return jsonResponse({ error: { code: 'ledger_unavailable', message: 'The operational action could not be committed.' } }, 503)
}

async function handlePost(request: Request) {
  const authorization = authorizeMpsOperations(request)
  if (authorization.kind === 'unconfigured') {
    return jsonResponse({ error: { code: 'operations_unavailable', message: 'The MPS operations control plane is not configured.' } }, 503)
  }
  if (authorization.kind === 'unauthorized') {
    return jsonResponse({ error: { code: 'unauthorized', message: 'A valid MPS operations bearer token is required.' } }, 401)
  }
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
    return jsonResponse({ error: { code: 'unsupported_media_type', message: 'Content-Type must be application/json.' } }, 415)
  }
  const contentLength = Number(request.headers.get('content-length') ?? '0')
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    return jsonResponse({ error: { code: 'payload_too_large', message: 'Operational action exceeds the 8 KB limit.' } }, 413)
  }

  let action: ReturnType<typeof parseMpsOperatorAction>
  try {
    const raw = await request.text()
    if (Buffer.byteLength(raw, 'utf8') > MAX_BODY_BYTES) {
      return jsonResponse({ error: { code: 'payload_too_large', message: 'Operational action exceeds the 8 KB limit.' } }, 413)
    }
    action = parseMpsOperatorAction(JSON.parse(raw))
  } catch (error) {
    return jsonResponse({ error: { code: 'invalid_request', message: error instanceof Error ? error.message : 'Invalid operational action.' } }, 400)
  }

  const ledger = createAgentInquiryLedger()
  if (!ledger) return jsonResponse({ error: { code: 'ledger_unavailable', message: 'The operational ledger is not configured.' } }, 503)

  const common = {
    p_action_id: createMpsOperatorActionId(),
    p_idempotency_hash: operatorIdempotencyHash(action.idempotencyKey),
    p_request_hash: operatorActionRequestHash(action),
    p_actor_fingerprint: authorization.actorFingerprint,
    p_reason: action.reason,
    p_reference_id: action.referenceId,
    p_created_at: new Date().toISOString(),
  }

  if (action.action === 'credit_adjustment') {
    const { data, error } = await ledger.rpc('apply_mps_operator_credit_adjustment', {
      ...common,
      p_client_id: action.clientId,
      p_quantity: action.quantity,
      p_entry_id: createCreditLedgerEntryId(),
    })
    if (error) {
      console.error('MPS operator credit adjustment failed:', error.code)
      return databaseError(error.code)
    }
    if (typeof data !== 'object' || data === null || Array.isArray(data)) return databaseError(undefined)
    return jsonResponse({ operation: data as Record<string, unknown>, secretsIncluded: false }, 200)
  }

  if (action.action === 'credential_revocation') {
    const { data, error } = await ledger.rpc('apply_mps_operator_credential_revocation', {
      ...common,
      p_credential_id: action.credentialId,
    })
    if (error) {
      console.error('MPS operator credential revocation failed:', error.code)
      return databaseError(error.code)
    }
    if (typeof data !== 'object' || data === null || Array.isArray(data)) return databaseError(undefined)
    return jsonResponse({ operation: data as Record<string, unknown>, secretsIncluded: false }, 200)
  }

  const replacementCredentialId = createCredentialId()
  const replacementCredential = createCredentialSecret()
  const { data, error } = await ledger.rpc('apply_mps_operator_credential_replacement', {
    ...common,
    p_credential_id: action.credentialId,
    p_replacement_credential_id: replacementCredentialId,
    p_replacement_secret_hash: createHash('sha256').update(replacementCredential).digest('hex'),
    p_replacement_secret_prefix: replacementCredential.slice(0, 14),
  })
  if (error) {
    console.error('MPS operator credential replacement failed:', error.code)
    return databaseError(error.code)
  }
  if (typeof data !== 'object' || data === null || Array.isArray(data)) return databaseError(undefined)
  const operation = data as Record<string, unknown>
  if (operation.idempotentReplay === true) {
    return jsonResponse({
      operation,
      credential: null,
      secretDisclosure: 'This is an idempotent replay. The replacement plaintext is not recoverable from the ledger; use the original response or replace the replacement credential.',
    }, 200)
  }
  return jsonResponse({
    operation,
    credential: replacementCredential,
    credentialPrefix: replacementCredential.slice(0, 14),
    secretDisclosure: 'This replacement credential is shown once. Deliver it through an approved secret-sharing channel and do not put it in tickets, logs, source control, or chat.',
  }, 201)
}

export async function POST(request: Request) {
  try {
    return await handlePost(request)
  } catch (error) {
    console.error('MPS operator action request failed:', error instanceof Error ? error.name : 'unknown_error')
    return databaseError(undefined)
  }
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: { Allow: 'POST, OPTIONS', 'Cache-Control': 'no-store' } })
}
