import { jsonResponse } from '@/lib/agent-inquiries'
import { createAgentInquiryLedger } from '@/lib/agent-inquiry-ledger'
import { authorizeMarketMapping } from '@/lib/market-mapping'
import { Resend } from 'resend'
import { createOutboundDeliveryId, createOutboundDraftId, createProspectId, draftSuggestion, outboundHash, parseDraftAction, parseDraftRevision, parseProviderSend, parseProspect, parseProspectAction, prospectFitScore } from '@/lib/outbound-control'

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
  const [{ data: prospects, error: prospectsError }, { data: drafts, error: draftsError }, { data: deliveries, error: deliveriesError }] = await Promise.all([
    ledger.from('outbound_prospects').select('public_id,source_kind,source_reference,company_name,company_website,contact_name,contact_email,contact_role,contact_basis,offer_id,relevance_note,fit_score,status,reviewer_note,created_at,updated_at').order('fit_score', { ascending: false }).order('created_at', { ascending: true }).limit(200),
    ledger.from('outbound_outreach_drafts').select('public_id,prospect_id,version,subject,body,status,created_at,approved_at,sent_at').order('created_at', { ascending: false }).limit(300),
    ledger.from('outbound_email_deliveries').select('public_id,prospect_id,draft_id,provider,status,provider_message_id,failure_code,claimed_at,sent_at,failed_at').order('claimed_at', { ascending: false }).limit(300),
  ])
  if (prospectsError || draftsError || deliveriesError) return unavailable(prospectsError?.code ?? draftsError?.code ?? deliveriesError?.code)
  return jsonResponse({
    prospects: prospects ?? [], drafts: drafts ?? [], deliveries: deliveries ?? [], autonomousOutreachSupported: false,
    sendingProviderConnected: process.env.MAHA_OUTBOUND_EMAIL_ENABLED === 'true' && Boolean(process.env.RESEND_API_KEY),
  }, 200)
}

export async function POST(request: Request) {
  const auth = authorized(request)
  if (!auth) return jsonResponse({ error: { code: 'unauthorized', message: 'A valid market-mapping bearer token is required.' } }, 401)
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) return jsonResponse({ error: { code: 'unsupported_media_type', message: 'Content-Type must be application/json.' } }, 415)
  let body: Record<string, unknown>
  try { body = await request.json() as Record<string, unknown> } catch { return jsonResponse({ error: { code: 'invalid_request', message: 'Request body must be valid JSON.' } }, 400) }
  const ledger = createAgentInquiryLedger()
  if (!ledger) return unavailable()

  if (body.action === 'send_approved') {
    let input: ReturnType<typeof parseProviderSend>
    try { input = parseProviderSend(body) } catch (error) { return jsonResponse({ error: { code: 'invalid_request', message: error instanceof Error ? error.message : 'Invalid provider-send request.' } }, 400) }
    const resendKey = process.env.RESEND_API_KEY
    if (process.env.MAHA_OUTBOUND_EMAIL_ENABLED !== 'true' || !resendKey) return jsonResponse({ error: { code: 'provider_disabled', message: 'Outbound provider delivery is disabled.' } }, 503)

    const { data: draft, error: draftError } = await ledger.from('outbound_outreach_drafts').select('public_id,prospect_id,subject,body,status').eq('public_id', input.draftId).maybeSingle()
    if (draftError || !draft) return unavailable(draftError?.code === 'PGRST116' ? 'P0002' : draftError?.code)
    const { data: prospect, error: prospectError } = await ledger.from('outbound_prospects').select('public_id,company_name,contact_email,status').eq('public_id', draft.prospect_id).maybeSingle()
    if (prospectError || !prospect) return unavailable(prospectError?.code === 'PGRST116' ? 'P0002' : prospectError?.code)
    if (draft.status !== 'approved' || prospect.status !== 'approved' || !prospect.contact_email) return jsonResponse({ error: { code: 'operation_not_allowed', message: 'Only an approved draft with a reviewed business recipient can be sent.' } }, 409)

    const deliveryId = createOutboundDeliveryId()
    const now = new Date().toISOString()
    const { data: claim, error: claimError } = await ledger.rpc('claim_outbound_provider_send', {
      p_delivery_id: deliveryId, p_draft_id: input.draftId, p_confirmation: input.confirmation,
      p_idempotency_hash: outboundHash(input.idempotencyKey), p_actor_fingerprint: auth.actorFingerprint, p_at: now,
    })
    if (claimError || typeof claim !== 'object' || claim === null || Array.isArray(claim)) return unavailable(claimError?.code)
    const claimed = claim as Record<string, unknown>
    if (claimed.idempotentReplay !== false || claimed.status !== 'claimed' || typeof claimed.deliveryId !== 'string') {
      return jsonResponse({ error: { code: 'send_already_claimed', message: 'This draft already has a provider-send claim. No retry was made.' }, delivery: claim }, 409)
    }

    let providerMessageId: string | null = null
    try {
      const result = await new Resend(resendKey).emails.send({
        from: process.env.MAHA_OUTBOUND_FROM ?? 'Mayone Rajan <mayone@mahastrategies.com>',
        replyTo: process.env.MAHA_OUTBOUND_REPLY_TO ?? 'mayone@mahastrategies.com',
        to: prospect.contact_email,
        subject: draft.subject,
        text: draft.body,
      }, { idempotencyKey: input.draftId })
      if (result.error || !result.data?.id) throw new Error('provider_rejected')
      providerMessageId = result.data.id
    } catch {
      await ledger.rpc('fail_outbound_provider_send', { p_delivery_id: claimed.deliveryId, p_failure_code: 'provider_rejected', p_actor_fingerprint: auth.actorFingerprint, p_at: new Date().toISOString() })
      return jsonResponse({ error: { code: 'delivery_failed', message: 'Provider delivery failed closed. No automatic retry was made.' } }, 502)
    }

    const { data: finalized, error: finalizeError } = await ledger.rpc('finalize_outbound_provider_send', { p_delivery_id: claimed.deliveryId, p_provider_message_id: providerMessageId, p_actor_fingerprint: auth.actorFingerprint, p_at: new Date().toISOString() })
    if (finalizeError || typeof finalized !== 'object' || finalized === null || Array.isArray(finalized)) return jsonResponse({ error: { code: 'delivery_reconciliation_required', message: 'The provider accepted the email, but ledger finalization failed. Do not retry.' } }, 503)
    return jsonResponse({ delivery: finalized, autonomousOutreachSupported: false, automaticRetrySupported: false }, 200)
  }

  if (body.action === 'revise_draft') {
    let input: ReturnType<typeof parseDraftRevision>
    try { input = parseDraftRevision(body) } catch (error) { return jsonResponse({ error: { code: 'invalid_request', message: error instanceof Error ? error.message : 'Invalid draft revision.' } }, 400) }
    const { data: existing, error: existingError } = await ledger.from('outbound_outreach_drafts').select('public_id,prospect_id,status').eq('public_id', input.draftId).maybeSingle()
    if (existingError || !existing) return unavailable(existingError?.code === 'PGRST116' ? 'P0002' : existingError?.code)
    if (existing.status !== 'draft') return jsonResponse({ error: { code: 'operation_not_allowed', message: 'Only an unapproved draft can be revised.' } }, 409)
    const { data, error } = await ledger.rpc('create_outbound_outreach_draft', { p_draft_id: createOutboundDraftId(), p_prospect_id: existing.prospect_id, p_subject: input.subject, p_body: input.body, p_idempotency_hash: outboundHash(input.idempotencyKey), p_actor_fingerprint: auth.actorFingerprint, p_at: new Date().toISOString() })
    if (error || typeof data !== 'object' || data === null || Array.isArray(data)) return unavailable(error?.code)
    return jsonResponse({ draft: data, autonomousOutreachSupported: false }, 201)
  }

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
