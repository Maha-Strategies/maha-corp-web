import { jsonResponse } from '@/lib/agent-inquiries'
import { createAgentInquiryLedger } from '@/lib/agent-inquiry-ledger'
import { authorizeMarketMapping } from '@/lib/market-mapping'
import { createOutboundDraftId, createProspectId, draftSuggestion, outboundHash, parseDraftAction, parseProspect, parseProspectAction, prospectFitScore } from '@/lib/outbound-control'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function unavailable(code?: string) {
  if (code === '22023') return jsonResponse({ error: { code: 'invalid_request', message: 'The outbound record failed validation.' } }, 400)
  if (code === 'P0002') return jsonResponse({ error: { code: 'not_found', message: 'The outbound record was not found.' } }, 404)
  if (code === 'P0001') return jsonResponse({ error: { code: 'operation_not_allowed', message: 'That action is not allowed for the current review state.' } }, 409)
  return jsonResponse({ error: { code: 'outbound_unavailable', message: 'The private outbound ledger is temporarily unavailable.' } }, 503)
}
function authorized(request: Request) {
  const result = authorizeMarketMapping(request)
  return result.authorized && result.actorFingerprint ? result : null
}

export async function GET(request: Request) {
  if (!authorized(request)) return jsonResponse({ error: { code: 'unauthorized', message: 'A valid market-mapping bearer token is required.' } }, 401)
  const ledger = createAgentInquiryLedger()
  if (!ledger) return unavailable()
  const [{ data: prospects, error: prospectsError }, { data: drafts, error: draftsError }] = await Promise.all([
    ledger.from('outbound_prospects').select('public_id,source_kind,source_reference,company_name,company_website,contact_name,contact_email,contact_role,contact_basis,offer_id,relevance_note,fit_score,status,reviewer_note,created_at,updated_at').order('fit_score', { ascending: false }).order('created_at', { ascending: true }).limit(200),
    ledger.from('outbound_outreach_drafts').select('public_id,prospect_id,version,subject,body,status,created_at,approved_at,sent_at').order('created_at', { ascending: false }).limit(300),
  ])
  if (prospectsError || draftsError) return unavailable(prospectsError?.code ?? draftsError?.code)
  return jsonResponse({ prospects: prospects ?? [], drafts: drafts ?? [], autonomousOutreachSupported: false, sendingProviderConnected: false }, 200)
}

export async function POST(request: Request) {
  const auth = authorized(request)
  if (!auth) return jsonResponse({ error: { code: 'unauthorized', message: 'A valid market-mapping bearer token is required.' } }, 401)
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) return jsonResponse({ error: { code: 'unsupported_media_type', message: 'Content-Type must be application/json.' } }, 415)
  let body: Record<string, unknown>
  try { body = await request.json() as Record<string, unknown> } catch { return jsonResponse({ error: { code: 'invalid_request', message: 'Request body must be valid JSON.' } }, 400) }
  const ledger = createAgentInquiryLedger()
  if (!ledger) return unavailable()

  if (body.action === 'approve_draft' || body.action === 'record_manual_send' || body.action === 'record_reply' || body.action === 'mark_won' || body.action === 'mark_lost') {
    let input: ReturnType<typeof parseDraftAction>
    try { input = parseDraftAction(body) } catch (error) { return jsonResponse({ error: { code: 'invalid_request', message: error instanceof Error ? error.message : 'Invalid draft operation.' } }, 400) }
    const { data, error } = await ledger.rpc('operate_outbound_outreach_draft', { p_draft_id: input.draftId, p_action: input.action, p_note: input.note || null, p_idempotency_hash: outboundHash(input.idempotencyKey), p_actor_fingerprint: auth.actorFingerprint, p_at: new Date().toISOString() })
    if (error || typeof data !== 'object' || data === null || Array.isArray(data)) return unavailable(error?.code)
    return jsonResponse({ operation: data, autonomousOutreachSupported: false }, 200)
  }
  if (body.action === 'start_review' || body.action === 'qualify' || body.action === 'reject') {
    let input: ReturnType<typeof parseProspectAction>
    try { input = parseProspectAction(body) } catch (error) { return jsonResponse({ error: { code: 'invalid_request', message: error instanceof Error ? error.message : 'Invalid prospect operation.' } }, 400) }
    const { data, error } = await ledger.rpc('operate_outbound_prospect', { p_prospect_id: input.prospectId, p_action: input.action, p_note: input.note || null, p_idempotency_hash: outboundHash(input.idempotencyKey), p_actor_fingerprint: auth.actorFingerprint, p_at: new Date().toISOString() })
    if (error || typeof data !== 'object' || data === null || Array.isArray(data)) return unavailable(error?.code)
    return jsonResponse({ operation: data, autonomousOutreachSupported: false }, 200)
  }
  if (body.action === 'prepare_draft') {
    let input: ReturnType<typeof parseProspectAction>
    try { input = parseProspectAction(body) } catch (error) { return jsonResponse({ error: { code: 'invalid_request', message: error instanceof Error ? error.message : 'Invalid prospect operation.' } }, 400) }
    const { data: prospect, error: readError } = await ledger.from('outbound_prospects').select('public_id,company_name,contact_name,offer_id,relevance_note').eq('public_id', input.prospectId).maybeSingle()
    if (readError || !prospect) return unavailable(readError?.code === 'PGRST116' ? 'P0002' : readError?.code)
    const suggestion = draftSuggestion({ companyName: prospect.company_name, contactName: prospect.contact_name, offerId: prospect.offer_id, relevanceNote: prospect.relevance_note })
    const { data, error } = await ledger.rpc('create_outbound_outreach_draft', { p_draft_id: createOutboundDraftId(), p_prospect_id: input.prospectId, p_subject: suggestion.subject, p_body: suggestion.body, p_idempotency_hash: outboundHash(input.idempotencyKey), p_actor_fingerprint: auth.actorFingerprint, p_at: new Date().toISOString() })
    if (error || typeof data !== 'object' || data === null || Array.isArray(data)) return unavailable(error?.code)
    return jsonResponse({ draft: data, autonomousOutreachSupported: false }, 201)
  }

  let input: ReturnType<typeof parseProspect>
  try { input = parseProspect(body) } catch (error) { return jsonResponse({ error: { code: 'invalid_request', message: error instanceof Error ? error.message : 'Invalid prospect.' } }, 400) }
  const { data, error } = await ledger.rpc('create_outbound_prospect', {
    p_prospect_id: createProspectId(), p_source_kind: input.sourceKind, p_source_reference: input.sourceReference, p_company_name: input.companyName, p_company_website: input.companyWebsite, p_contact_name: input.contactName, p_contact_email: input.contactEmail, p_contact_role: input.contactRole, p_contact_basis: input.contactBasis, p_offer_id: input.offerId, p_relevance_note: input.relevanceNote, p_fit_score: prospectFitScore(input), p_idempotency_hash: outboundHash(input.idempotencyKey), p_actor_fingerprint: auth.actorFingerprint, p_at: new Date().toISOString(),
  })
  if (error || typeof data !== 'object' || data === null || Array.isArray(data)) return unavailable(error?.code)
  return jsonResponse({ prospect: data, autonomousOutreachSupported: false }, 201)
}

export function OPTIONS() { return new Response(null, { status: 204, headers: { Allow: 'GET, POST, OPTIONS', 'Cache-Control': 'no-store' } }) }
