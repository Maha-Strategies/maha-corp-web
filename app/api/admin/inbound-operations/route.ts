import { createAgentInquiryLedger } from '@/lib/agent-inquiry-ledger'
import { jsonResponse } from '@/lib/agent-inquiries'
import { inboundOperationHash, inboundOperationsAuthorized, parseInboundOperation } from '@/lib/inbound-operations'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function databaseError(code: string | undefined) {
  if (code === '22023') return jsonResponse({ error: { code: 'invalid_request', message: 'The inbound operation failed validation.' } }, 400)
  if (code === 'P0002') return jsonResponse({ error: { code: 'not_found', message: 'Inbound submission not found.' } }, 404)
  if (code === 'P0001') return jsonResponse({ error: { code: 'operation_not_allowed', message: 'This action is not allowed for the current queue state.' } }, 409)
  return jsonResponse({ error: { code: 'queue_unavailable', message: 'Inbound operations are temporarily unavailable.' } }, 503)
}

export async function GET(request: Request) {
  const authorization = inboundOperationsAuthorized(request)
  if (!authorization.authorized) return jsonResponse({ error: { code: 'unauthorized', message: 'A valid inbound operations bearer token is required.' } }, 401)
  const ledger = createAgentInquiryLedger()
  if (!ledger) return databaseError(undefined)
  const { data, error } = await ledger.from('inbound_submissions')
    .select('public_id,offer_id,requester_name,requester_email,requester_organization,decision,question,deadline,context,agent,qualification_status,qualification_reasons,operations_status,reviewer_note,reviewed_at,revenue_opportunity_id,created_at')
    .order('created_at', { ascending: true }).limit(100)
  if (error) return databaseError(error.code)
  const opportunityIds = (data ?? []).map((item) => item.revenue_opportunity_id).filter((id): id is string => typeof id === 'string')
  const { data: opportunities, error: opportunitiesError } = opportunityIds.length
    ? await ledger.from('revenue_opportunities').select('public_id,status,route,qualified,updated_at').in('public_id', opportunityIds)
    : { data: [], error: null }
  if (opportunitiesError) return databaseError(opportunitiesError.code)
  return jsonResponse({ submissions: data ?? [], opportunities: opportunities ?? [], bindingCommitment: false, autonomousPaymentSupported: false, autonomousOutreachSupported: false }, 200)
}

export async function POST(request: Request) {
  const authorization = inboundOperationsAuthorized(request)
  if (!authorization.authorized || !authorization.actorFingerprint) return jsonResponse({ error: { code: 'unauthorized', message: 'A valid inbound operations bearer token is required.' } }, 401)
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) return jsonResponse({ error: { code: 'unsupported_media_type', message: 'Content-Type must be application/json.' } }, 415)
  let action: ReturnType<typeof parseInboundOperation>
  try { action = parseInboundOperation(await request.json()) }
  catch (error) { return jsonResponse({ error: { code: 'invalid_request', message: error instanceof Error ? error.message : 'Invalid inbound operation.' } }, 400) }
  const ledger = createAgentInquiryLedger()
  if (!ledger) return databaseError(undefined)
  const { data, error } = await ledger.rpc('operate_inbound_submission', {
    p_submission_id: action.submissionId, p_action: action.action, p_note: action.note || null,
    p_idempotency_hash: inboundOperationHash(action.idempotencyKey), p_actor_fingerprint: authorization.actorFingerprint, p_at: new Date().toISOString(),
  })
  if (error || typeof data !== 'object' || data === null || Array.isArray(data)) return databaseError(error?.code)
  return jsonResponse({ operation: data, bindingCommitment: false, autonomousPaymentSupported: false, autonomousOutreachSupported: false }, 200)
}

export function OPTIONS() { return new Response(null, { status: 204, headers: { Allow: 'GET, POST, OPTIONS', 'Cache-Control': 'no-store' } }) }
