import { jsonResponse } from '@/lib/agent-inquiries'
import { createAgentInquiryLedger } from '@/lib/agent-inquiry-ledger'
import { authorizeMarketMapping, createMarketOpportunityId, marketMappingHash, marketOpportunityScore, parseMarketOperation, parseMarketOpportunity } from '@/lib/market-mapping'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function unavailable(code?: string) {
  if (code === '22023') return jsonResponse({ error: { code: 'invalid_request', message: 'The market-mapping request failed validation.' } }, 400)
  if (code === 'P0002') return jsonResponse({ error: { code: 'not_found', message: 'Market opportunity not found.' } }, 404)
  if (code === 'P0001') return jsonResponse({ error: { code: 'operation_not_allowed', message: 'That action is not allowed for this opportunity.' } }, 409)
  if (code === '23505') return jsonResponse({ error: { code: 'idempotency_conflict', message: 'This source has already been mapped.' } }, 409)
  return jsonResponse({ error: { code: 'market_mapping_unavailable', message: 'The market-mapping ledger is temporarily unavailable.' } }, 503)
}

function authorized(request: Request) {
  const result = authorizeMarketMapping(request)
  return result.authorized && result.actorFingerprint ? result : null
}

export async function GET(request: Request) {
  if (!authorized(request)) return jsonResponse({ error: { code: 'unauthorized', message: 'A valid market-mapping bearer token is required.' } }, 401)
  const ledger = createAgentInquiryLedger()
  if (!ledger) return unavailable()
  const { data, error } = await ledger.from('market_opportunities')
    .select('public_id,source,signal_class,source_reference,title,problem,buyer,proposed_solution,evidence,demand_evidence,commercial_intent,capability_fit,speed_to_validate,risk_penalty,score,status,reviewer_note,created_at,updated_at')
    .order('score', { ascending: false }).order('created_at', { ascending: true }).limit(100)
  if (error) return unavailable(error.code)
  return jsonResponse({ opportunities: data ?? [], autonomousPublishingSupported: false, autonomousSpendSupported: false, autonomousOutreachSupported: false }, 200)
}

export async function POST(request: Request) {
  const auth = authorized(request)
  if (!auth) return jsonResponse({ error: { code: 'unauthorized', message: 'A valid market-mapping bearer token is required.' } }, 401)
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) return jsonResponse({ error: { code: 'unsupported_media_type', message: 'Content-Type must be application/json.' } }, 415)
  let body: Record<string, unknown>
  try { body = await request.json() as Record<string, unknown> } catch { return jsonResponse({ error: { code: 'invalid_request', message: 'Request body must be valid JSON.' } }, 400) }
  const ledger = createAgentInquiryLedger()
  if (!ledger) return unavailable()

  if (body.action === 'start_review' || body.action === 'approve_experiment' || body.action === 'reject' || body.action === 'archive') {
    let operation: ReturnType<typeof parseMarketOperation>
    try { operation = parseMarketOperation(body) } catch (error) { return jsonResponse({ error: { code: 'invalid_request', message: error instanceof Error ? error.message : 'Invalid operation.' } }, 400) }
    const { data, error } = await ledger.rpc('operate_market_opportunity', {
      p_opportunity_id: operation.opportunityId, p_action: operation.action, p_note: operation.note || null,
      p_idempotency_hash: marketMappingHash(operation.idempotencyKey), p_actor_fingerprint: auth.actorFingerprint, p_at: new Date().toISOString(),
    })
    if (error || typeof data !== 'object' || data === null || Array.isArray(data)) return unavailable(error?.code)
    return jsonResponse({ operation: data, autonomousPublishingSupported: false, autonomousSpendSupported: false, autonomousOutreachSupported: false }, 200)
  }

  let input: ReturnType<typeof parseMarketOpportunity>
  try { input = parseMarketOpportunity(body) } catch (error) { return jsonResponse({ error: { code: 'invalid_request', message: error instanceof Error ? error.message : 'Invalid opportunity.' } }, 400) }
  const idempotencyKey = typeof body.idempotencyKey === 'string' ? body.idempotencyKey.trim() : ''
  if (idempotencyKey.length < 8 || idempotencyKey.length > 120 || /[\r\n]/.test(idempotencyKey)) return jsonResponse({ error: { code: 'invalid_request', message: 'idempotencyKey must contain between 8 and 120 characters on one line.' } }, 400)
  const { data, error } = await ledger.rpc('create_market_opportunity', {
    p_opportunity_id: createMarketOpportunityId(), p_source: input.source, p_signal_class: input.signalClass, p_source_reference: input.sourceReference, p_title: input.title,
    p_problem: input.problem, p_buyer: input.buyer, p_proposed_solution: input.proposedSolution, p_evidence: input.evidence,
    p_demand_evidence: input.demandEvidence, p_commercial_intent: input.commercialIntent, p_capability_fit: input.capabilityFit,
    p_speed_to_validate: input.speedToValidate, p_risk_penalty: input.riskPenalty, p_score: marketOpportunityScore(input),
    p_idempotency_hash: marketMappingHash(idempotencyKey), p_actor_fingerprint: auth.actorFingerprint, p_at: new Date().toISOString(),
  })
  if (error || typeof data !== 'object' || data === null || Array.isArray(data)) return unavailable(error?.code)
  return jsonResponse({ opportunity: data, autonomousPublishingSupported: false, autonomousSpendSupported: false, autonomousOutreachSupported: false }, 201)
}

export function OPTIONS() { return new Response(null, { status: 204, headers: { Allow: 'GET, POST, OPTIONS', 'Cache-Control': 'no-store' } }) }
