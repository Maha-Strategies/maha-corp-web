import Anthropic from '@anthropic-ai/sdk'

import { authorizeClientCapability, bearerToken } from '@/lib/agent-client-credentials'
import { createAgentInquiryLedger } from '@/lib/agent-inquiry-ledger'
import { auditInputHash, MpsAuditError, runMpsAudit, type MpsAuditResult, validateAuditPassage } from '@/lib/mps-audit-engine'
import {
  MPS_AUDIT_CAPABILITY,
  createMpsAuditJobId,
  parseMpsAuditJobRequest,
  serializableMpsAuditResult,
} from '@/lib/mps-audit-jobs'
import { jsonResponse } from '@/lib/agent-inquiries'
import { createCreditLedgerEntryId, ledgerEventHash, MPS_AUDIT_CREDIT_UNIT } from '@/lib/mps-credits'
import { billingDecision } from '@/lib/mps-audit-billing'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 30

const MAX_BODY_BYTES = 32_768
const MODEL = 'claude-sonnet-4-6'

type StoredAudit = {
  public_id: string
  client_request_id: string
  input_hash: string
  status: 'processing' | 'completed' | 'failed'
  result: MpsAuditResult | null
  failure_code: string | null
}

function auditResponse(audit: StoredAudit, idempotentReplay = false) {
  const response: Record<string, unknown> = {
    auditId: audit.public_id,
    clientRequestId: audit.client_request_id,
    inputHash: audit.input_hash,
    status: audit.status,
    idempotentReplay,
    capability: MPS_AUDIT_CAPABILITY,
    sourceTextStored: false,
  }
  if (audit.status === 'completed' && audit.result) {
    response.audit = audit.result
  }
  if (audit.status === 'failed') {
    response.error = { code: audit.failure_code ?? 'audit_failed', message: 'The audit did not complete. Retry with a new clientRequestId.' }
  }
  if (audit.status === 'processing') {
    response.retryAfterSeconds = 5
  }
  return response
}

async function existingAudit(ledger: NonNullable<ReturnType<typeof createAgentInquiryLedger>>, credentialId: string, clientRequestId: string) {
  const { data, error } = await ledger
    .from('agent_mps_audits')
    .select('public_id, client_request_id, input_hash, status, result, failure_code')
    .eq('credential_id', credentialId)
    .eq('client_request_id', clientRequestId)
    .maybeSingle()
  return { data: data as StoredAudit | null, error }
}

async function changeAuditCredit(
  ledger: NonNullable<ReturnType<typeof createAgentInquiryLedger>>,
  operation: 'consume_mps_audit_credit' | 'refund_mps_audit_credit',
  clientId: string,
  auditId: string,
) {
  const entryId = createCreditLedgerEntryId()
  const createdAt = new Date().toISOString()
  const quantity = operation === 'consume_mps_audit_credit' ? -1 : 1
  const sourceId = auditId
  return ledger.rpc(operation, {
    p_client_id: clientId, p_audit_id: auditId, p_entry_id: entryId, p_created_at: createdAt,
    p_event_hash: ledgerEventHash({ entryId, clientId, checkoutId: auditId, quantity, sourceId, createdAt }),
  })
}

function purchaseRequired() {
  return jsonResponse({
    error: { code: 'payment_required', message: 'This prepaid credential has no audit credits remaining.' },
    purchase: { href: '/mps/audit-access', checkoutEndpoint: '/api/mps-credits/checkout', unit: MPS_AUDIT_CREDIT_UNIT },
  }, 402)
}

export async function POST(request: Request) {
  const credentialToken = bearerToken(request)
  if (!credentialToken) return jsonResponse({ error: { code: 'unauthorized', message: 'A valid client credential is required.' } }, 401)
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
    return jsonResponse({ error: { code: 'unsupported_media_type', message: 'Content-Type must be application/json.' } }, 415)
  }
  const contentLength = Number(request.headers.get('content-length') ?? '0')
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    return jsonResponse({ error: { code: 'payload_too_large', message: 'Request body exceeds the 32 KB limit.' } }, 413)
  }

  let input: ReturnType<typeof parseMpsAuditJobRequest> & { passage: string; inputHash: string }
  try {
    const requestBody = parseMpsAuditJobRequest(await request.json())
    const passage = validateAuditPassage(requestBody.text)
    input = { ...requestBody, passage, inputHash: auditInputHash(passage) }
  } catch (error) {
    const status = error instanceof MpsAuditError ? error.status : 400
    return jsonResponse({ error: { code: 'invalid_request', message: error instanceof Error ? error.message : 'Invalid request body.' } }, status)
  }

  const authorization = await authorizeClientCapability(credentialToken, MPS_AUDIT_CAPABILITY)
  if (authorization.kind === 'unavailable') return jsonResponse({ error: { code: 'gateway_unavailable', message: 'The credential registry is not available.' } }, 503)
  if (authorization.kind === 'unauthorized') return jsonResponse({ error: { code: 'unauthorized', message: 'A valid client credential is required.' } }, 401)
  if (authorization.kind === 'forbidden') return jsonResponse({ error: { code: 'capability_not_authorized', message: 'This credential is not authorized to run MPS audits.' } }, 403)
  if (authorization.kind === 'rate_limited') return jsonResponse({ error: { code: 'rate_limited', message: 'Credential request limit reached. Retry after one hour.' } }, 429)

  const ledger = createAgentInquiryLedger()
  if (!ledger) return jsonResponse({ error: { code: 'ledger_unavailable', message: 'The MPS audit ledger is not configured.' } }, 503)

  const known = await existingAudit(ledger, authorization.credentialId, input.clientRequestId)
  if (known.error) return jsonResponse({ error: { code: 'ledger_unavailable', message: 'The MPS audit ledger could not be read.' } }, 503)
  if (known.data) {
    if (known.data.input_hash !== input.inputHash) {
      return jsonResponse({ error: { code: 'idempotency_conflict', message: 'clientRequestId was already used with different source text.' } }, 409)
    }
    return jsonResponse(auditResponse(known.data, true), known.data.status === 'processing' ? 202 : 200)
  }

  const auditId = createMpsAuditJobId()

  // Mandatory model boundary: no audit record, Anthropic client, or message
  // request is created for a new audit until this explicitly returns `allow`.
  const billing = await billingDecision(authorization.billingMode, async () => {
    const { data, error } = await changeAuditCredit(ledger, 'consume_mps_audit_credit', authorization.clientId, auditId)
    return { accepted: data === true, errorCode: error?.code }
  })
  if (billing.kind === 'payment_required') return purchaseRequired()
  if (billing.kind === 'unavailable') {
    console.error('MPS audit credit consumption failed:', billing.errorCode)
    return jsonResponse({ error: { code: 'ledger_unavailable', message: 'The audit credit could not be reserved.' } }, 503)
  }

  const { error: createError } = await ledger.from('agent_mps_audits').insert({
    public_id: auditId,
    client_id: authorization.clientId,
    credential_id: authorization.credentialId,
    client_request_id: input.clientRequestId,
    input_hash: input.inputHash,
    status: 'processing',
    model: MODEL,
  })
  if (createError?.code === '23505') {
    if (billing.creditReserved) await changeAuditCredit(ledger, 'refund_mps_audit_credit', authorization.clientId, auditId)
    const replay = await existingAudit(ledger, authorization.credentialId, input.clientRequestId)
    if (!replay.error && replay.data && replay.data.input_hash === input.inputHash) {
      return jsonResponse(auditResponse(replay.data, true), replay.data.status === 'processing' ? 202 : 200)
    }
    return jsonResponse({ error: { code: 'idempotency_conflict', message: 'clientRequestId was already used with different source text.' } }, 409)
  }
  if (createError) {
    if (billing.creditReserved) await changeAuditCredit(ledger, 'refund_mps_audit_credit', authorization.clientId, auditId)
    console.error('MPS audit ledger creation failed:', createError.code)
    return jsonResponse({ error: { code: 'ledger_unavailable', message: 'The MPS audit could not be recorded.' } }, 503)
  }

  // ANTHROPIC MODEL BOUNDARY — reachable only after billing.kind === 'allow'.
  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const result = await runMpsAudit(input.passage, async (prompt) => {
      const message = await client.messages.create({
        model: MODEL,
        max_tokens: 1_500,
        messages: [{ role: 'user', content: prompt }],
      })
      return message.content.map((block) => block.type === 'text' ? block.text : '').join('\n')
    })
    const { data: completed, error: completeError } = await ledger
      .from('agent_mps_audits')
      .update({ status: 'completed', result: serializableMpsAuditResult(result), completed_at: new Date().toISOString() })
      .eq('public_id', auditId)
      .select('public_id, client_request_id, input_hash, status, result, failure_code')
      .maybeSingle()
    if (completeError || !completed) {
      if (authorization.billingMode === 'prepaid') await changeAuditCredit(ledger, 'refund_mps_audit_credit', authorization.clientId, auditId)
      console.error('MPS audit completion write failed:', completeError?.code ?? 'missing_record')
      return jsonResponse({ error: { code: 'ledger_unavailable', message: 'The audit result could not be recorded.' } }, 503)
    }
    return jsonResponse(auditResponse(completed as StoredAudit), 201)
  } catch (error) {
    const failureCode = error instanceof MpsAuditError ? 'invalid_model_response' : 'model_unavailable'
    const { error: failError } = await ledger
      .from('agent_mps_audits')
      .update({ status: 'failed', failure_code: failureCode, completed_at: new Date().toISOString() })
      .eq('public_id', auditId)
    if (failError) console.error('MPS audit failure write failed:', failError.code)
    if (authorization.billingMode === 'prepaid') {
      const { error: refundError } = await changeAuditCredit(ledger, 'refund_mps_audit_credit', authorization.clientId, auditId)
      if (refundError) console.error('MPS audit credit refund failed:', refundError.code)
    }
    console.error('MPS audit execution failed:', error instanceof Error ? error.name : 'unknown_error')
    return jsonResponse({ error: { code: failureCode, message: 'The audit did not complete. Try again with a new clientRequestId.' } }, 502)
  }
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: { Allow: 'POST, OPTIONS', 'Cache-Control': 'no-store' } })
}
