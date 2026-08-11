import { createAgentInquiryLedger } from '@/lib/agent-inquiry-ledger'
import { jsonResponse } from '@/lib/agent-inquiries'
import { inboundOperationHash, inboundOperationsAuthorized } from '@/lib/inbound-operations'
import { buildNavigatorCommercialFunnel, parseNavigatorCommercialOperation, type NavigatorCommercialEventRow } from '@/lib/navigator-commercial-loop'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function unavailable(code?: string) {
  if (code === '22023') return jsonResponse({ error: { code: 'invalid_request', message: 'The commercial-loop event failed validation.' } }, 400)
  if (code === 'P0002') return jsonResponse({ error: { code: 'not_found', message: 'The Navigator candidate was not found.' } }, 404)
  if (code === 'P0001') return jsonResponse({ error: { code: 'invalid_transition', message: 'The commercial stage is not supported by the evidence recorded so far.' } }, 409)
  return jsonResponse({ error: { code: 'navigator_commercial_loop_unavailable', message: 'Navigator commercial-loop measurement is temporarily unavailable.' } }, 503)
}

export async function GET(request: Request) {
  if (!inboundOperationsAuthorized(request).authorized) return jsonResponse({ error: { code: 'unauthorized', message: 'A valid inbound operations bearer token is required.' } }, 401)
  const ledger = createAgentInquiryLedger()
  if (!ledger) return unavailable()
  const { data, error } = await ledger.from('navigator_commercial_loop_events')
    .select('id,candidate_id,stage,offer_id,channel,reference_hash,actor_type,created_at')
    .order('created_at', { ascending: true })
    .limit(5_000)
  if (error) return unavailable(error.code)
  const events = (data ?? []) as (NavigatorCommercialEventRow & { id: string; actor_type: string })[]
  return jsonResponse({ funnel: buildNavigatorCommercialFunnel(events), events, automationSupported: false }, 200)
}

export async function POST(request: Request) {
  const auth = inboundOperationsAuthorized(request)
  if (!auth.authorized || !auth.actorFingerprint) return jsonResponse({ error: { code: 'unauthorized', message: 'A valid inbound operations bearer token is required.' } }, 401)
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) return jsonResponse({ error: { code: 'unsupported_media_type', message: 'Content-Type must be application/json.' } }, 415)
  const declaredLength = Number(request.headers.get('content-length') ?? '0')
  if (Number.isFinite(declaredLength) && declaredLength > 20_000) return jsonResponse({ error: { code: 'payload_too_large', message: 'Commercial-loop operations are limited to 20 KB.' } }, 413)
  try {
    const operation = parseNavigatorCommercialOperation(await request.json())
    const ledger = createAgentInquiryLedger()
    if (!ledger) return unavailable()
    const { data, error } = await ledger.rpc('record_navigator_commercial_event', {
      p_candidate_id: operation.candidateId,
      p_stage: operation.stage,
      p_offer_id: operation.offerId,
      p_channel: operation.channel,
      p_reference_hash: operation.referenceId ? inboundOperationHash(operation.referenceId) : null,
      p_idempotency_hash: inboundOperationHash(operation.idempotencyKey),
      p_actor_fingerprint: auth.actorFingerprint,
      p_at: new Date().toISOString(),
    })
    if (error || typeof data !== 'object' || data === null || Array.isArray(data)) return unavailable(error?.code)
    return jsonResponse({ operation: data, automationSupported: false }, 201)
  } catch (error) {
    return jsonResponse({ error: { code: 'invalid_request', message: error instanceof Error ? error.message : 'Invalid commercial-loop operation.' } }, 400)
  }
}

export function OPTIONS() { return new Response(null, { status: 204, headers: { Allow: 'GET, POST, OPTIONS', 'Cache-Control': 'no-store' } }) }
