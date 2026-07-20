import { jsonResponse } from '@/lib/agent-inquiries'
import { createAgentInquiryLedger } from '@/lib/agent-inquiry-ledger'
import {
  authorizeRevenueOperations,
  createRevenueOpportunityId,
  parseRevenueControlAction,
  revenueIdempotencyHash,
  revenueSignalHash,
  routeRevenueSignal,
} from '@/lib/revenue-control-plane'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAX_BODY_BYTES = 8_192

function databaseError(code: string | undefined) {
  if (code === '22023') return jsonResponse({ error: { code: 'invalid_request', message: 'The control-plane action failed database validation.' } }, 400)
  if (code === 'P0002') return jsonResponse({ error: { code: 'not_found', message: 'The revenue opportunity was not found.' } }, 404)
  if (code === '23505') return jsonResponse({ error: { code: 'idempotency_conflict', message: 'A different signal already uses this source reference.' } }, 409)
  if (code === 'P0001') return jsonResponse({ error: { code: 'operation_not_allowed', message: 'This outcome is not allowed for the opportunity’s current state.' } }, 409)
  return jsonResponse({ error: { code: 'ledger_unavailable', message: 'The revenue control ledger could not be committed.' } }, 503)
}

export async function POST(request: Request) {
  const authorization = authorizeRevenueOperations(request)
  if (authorization.kind === 'unconfigured') return jsonResponse({ error: { code: 'operations_unavailable', message: 'The revenue control plane is not configured.' } }, 503)
  if (authorization.kind === 'unauthorized') return jsonResponse({ error: { code: 'unauthorized', message: 'A valid revenue control bearer token is required.' } }, 401)
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
    return jsonResponse({ error: { code: 'unsupported_media_type', message: 'Content-Type must be application/json.' } }, 415)
  }
  const raw = await request.text()
  if (Buffer.byteLength(raw, 'utf8') > MAX_BODY_BYTES) return jsonResponse({ error: { code: 'payload_too_large', message: 'Control-plane action exceeds the 8 KB limit.' } }, 413)
  let action: ReturnType<typeof parseRevenueControlAction>
  try { action = parseRevenueControlAction(JSON.parse(raw)) }
  catch (error) { return jsonResponse({ error: { code: 'invalid_request', message: error instanceof Error ? error.message : 'Invalid control-plane action.' } }, 400) }

  const ledger = createAgentInquiryLedger()
  if (!ledger) return databaseError(undefined)
  if (action.action === 'lookup') {
    const query = ledger.from('revenue_opportunities').select('public_id, source_type, source_reference, source_url, offer_id, route, qualified, qualification_reasons, status, created_at, updated_at')
    const { data: opportunity, error } = action.opportunityId
      ? await query.eq('public_id', action.opportunityId).maybeSingle()
      : await query.eq('source_type', action.sourceType!).eq('source_reference', action.sourceReference!).maybeSingle()
    if (error) return databaseError(error.code)
    if (!opportunity) return databaseError('P0002')
    const { data: events, error: eventsError } = await ledger.from('revenue_opportunity_events').select('event_type, reason, reference_id, amount_cents, currency, metadata, created_at').eq('opportunity_id', opportunity.public_id).order('created_at', { ascending: true })
    if (eventsError) return databaseError(eventsError.code)
    return jsonResponse({ opportunity, events, autonomousPaymentSupported: false, autonomousOutreachSupported: false }, 200)
  }

  if (action.action === 'route_inbound') {
    const routing = routeRevenueSignal(action.signal)
    const { data, error } = await ledger.rpc('create_revenue_opportunity', {
      p_opportunity_id: createRevenueOpportunityId(), p_source_type: action.signal.sourceType, p_source_reference: action.signal.sourceReference,
      p_source_url: action.signal.sourceUrl ?? null, p_offer_id: action.signal.offerId, p_signal_hash: revenueSignalHash(action.signal),
      p_route: routing.route, p_qualified: routing.qualified, p_qualification_reasons: routing.qualificationReasons,
      p_idempotency_hash: revenueIdempotencyHash(action.idempotencyKey), p_actor_fingerprint: authorization.actorFingerprint,
      p_reason: action.reason, p_reference_id: action.referenceId, p_created_at: new Date().toISOString(),
    })
    if (error || typeof data !== 'object' || data === null || Array.isArray(data)) return databaseError(error?.code)
    const opportunity = data as Record<string, unknown>
    return jsonResponse({
      opportunity, offer: { id: action.signal.offerId, name: routing.offer.name }, route: routing.route,
      qualified: routing.qualified, qualificationReasons: routing.qualificationReasons, humanReviewRequired: routing.humanReviewRequired,
      nextStep: routing.humanReviewRequired ? 'Human scope and price confirmation is required before an engagement can be accepted.' : `Present the existing self-service checkout at ${routing.offer.href}.`,
      autonomousPaymentSupported: false, autonomousOutreachSupported: false,
    }, opportunity.idempotentReplay === true ? 200 : 201)
  }

  const { data, error } = await ledger.rpc('record_revenue_opportunity_outcome', {
    p_opportunity_id: action.opportunityId, p_event_type: action.outcome, p_idempotency_hash: revenueIdempotencyHash(action.idempotencyKey),
    p_actor_fingerprint: authorization.actorFingerprint, p_reason: action.reason, p_reference_id: action.referenceId,
    p_amount_cents: action.amountCents ?? null, p_currency: action.currency ?? null, p_created_at: new Date().toISOString(),
  })
  if (error || typeof data !== 'object' || data === null || Array.isArray(data)) return databaseError(error?.code)
  return jsonResponse({ opportunity: data as Record<string, unknown>, autonomousPaymentSupported: false, autonomousOutreachSupported: false }, 200)
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: { Allow: 'POST, OPTIONS', 'Cache-Control': 'no-store' } })
}
