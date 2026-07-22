import { jsonResponse } from '@/lib/agent-inquiries'
import { createAgentInquiryLedger } from '@/lib/agent-inquiry-ledger'
import { authorizeMarketMapping, marketMappingHash } from '@/lib/market-mapping'
import { aggregateSalesPipeline } from '@/lib/sales-pipeline-metrics'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
const CAP = 50_000

function auth(request: Request) { const result = authorizeMarketMapping(request); return result.authorized && result.actorFingerprint ? result : null }
function unavailable(code?: string) {
  if (code === '22023') return jsonResponse({ error: { code: 'invalid_request', message: 'The pipeline attribution failed validation.' } }, 400)
  if (code === 'P0002') return jsonResponse({ error: { code: 'not_found', message: 'A prospect or revenue opportunity was not found.' } }, 404)
  if (code === '23505') return jsonResponse({ error: { code: 'already_linked', message: 'That prospect or revenue opportunity is already linked.' } }, 409)
  return jsonResponse({ error: { code: 'pipeline_unavailable', message: 'The private pipeline ledger is temporarily unavailable.' } }, 503)
}

export async function GET(request: Request) {
  if (!auth(request)) return jsonResponse({ error: { code: 'unauthorized', message: 'A valid market-mapping bearer token is required.' } }, 401)
  const ledger = createAgentInquiryLedger(); if (!ledger) return unavailable()
  const [prospects, attributions, opportunities, reconciliations] = await Promise.all([
    ledger.from('outbound_prospects').select('public_id,offer_id,source_kind,contact_basis,fit_score,status').limit(CAP),
    ledger.from('outbound_revenue_attributions').select('prospect_id,opportunity_id').limit(CAP),
    ledger.from('revenue_opportunities').select('public_id,offer_id,status').limit(CAP),
    ledger.from('revenue_payment_reconciliations').select('opportunity_id,gross_amount_cents,refunded_amount_cents,currency').limit(CAP),
  ])
  const failure = prospects.error ?? attributions.error ?? opportunities.error ?? reconciliations.error
  if (failure) return unavailable(failure.code)
  return jsonResponse({
    metrics: aggregateSalesPipeline({
      prospects: (prospects.data ?? []).map((r) => ({ publicId: r.public_id, offerId: r.offer_id, sourceKind: r.source_kind, contactBasis: r.contact_basis, fitScore: r.fit_score, status: r.status })),
      attributions: (attributions.data ?? []).map((r) => ({ prospectId: r.prospect_id, opportunityId: r.opportunity_id })),
      opportunities: (opportunities.data ?? []).map((r) => ({ publicId: r.public_id, offerId: r.offer_id, status: r.status })),
      reconciliations: (reconciliations.data ?? []).map((r) => ({ opportunityId: r.opportunity_id, grossAmountCents: r.gross_amount_cents, refundedAmountCents: r.refunded_amount_cents, currency: r.currency })),
    }),
    opportunities: opportunities.data ?? [], autonomousOutreachSupported: false, attributionInferenceSupported: false,
  }, 200)
}

export async function POST(request: Request) {
  const authorization = auth(request)
  if (!authorization) return jsonResponse({ error: { code: 'unauthorized', message: 'A valid market-mapping bearer token is required.' } }, 401)
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) return jsonResponse({ error: { code: 'unsupported_media_type', message: 'Content-Type must be application/json.' } }, 415)
  let body: Record<string, unknown>; try { body = await request.json() as Record<string, unknown> } catch { return jsonResponse({ error: { code: 'invalid_request', message: 'Request body must be valid JSON.' } }, 400) }
  const prospectReference = typeof body.prospectId === 'string' ? body.prospectId.trim() : ''
  const opportunityId = typeof body.opportunityId === 'string' ? body.opportunityId.trim() : ''
  const idempotencyKey = typeof body.idempotencyKey === 'string' ? body.idempotencyKey.trim() : ''
  const note = typeof body.note === 'string' ? body.note.trim() : ''
  if (!prospectReference || prospectReference.length > 160 || !/^revopp_[a-f0-9]{32}$/.test(opportunityId) || idempotencyKey.length < 8 || idempotencyKey.length > 120 || /[\r\n]/.test(idempotencyKey) || note.length > 2000) return unavailable('22023')
  const ledger = createAgentInquiryLedger(); if (!ledger) return unavailable()
  let prospectId = prospectReference
  if (!/^prospect_[a-f0-9]{32}$/.test(prospectId)) {
    const { data: prospect, error: prospectError } = await ledger.from('outbound_prospects').select('public_id').eq('company_name', prospectReference).maybeSingle()
    if (prospectError || !prospect) return unavailable('P0002')
    prospectId = prospect.public_id
  }
  const { data, error } = await ledger.rpc('link_outbound_prospect_to_revenue_opportunity', { p_prospect_id: prospectId, p_opportunity_id: opportunityId, p_note: note || null, p_idempotency_hash: marketMappingHash(idempotencyKey), p_actor_fingerprint: authorization.actorFingerprint, p_at: new Date().toISOString() })
  if (error || typeof data !== 'object' || data === null || Array.isArray(data)) return unavailable(error?.code)
  return jsonResponse({ attribution: data, attributionInferenceSupported: false }, 201)
}

export function OPTIONS() { return new Response(null, { status: 204, headers: { Allow: 'GET, POST, OPTIONS', 'Cache-Control': 'no-store' } }) }
