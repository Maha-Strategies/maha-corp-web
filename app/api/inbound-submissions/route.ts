import { createAgentInquiryLedger } from '@/lib/agent-inquiry-ledger'
import { jsonResponse } from '@/lib/agent-inquiries'
import { contactSourcePath, inboundLedgerSourcePath, isLikelyCommercialSolicitation, optionalCampaignValue, parseContactReferralSource } from '@/lib/contact-qualification'
import { inboundHash, inboundId, parseInboundSubmission, routeInboundSubmission } from '@/lib/inbound-gatekeeper'
import { publicUtilityVisitorHash } from '@/lib/public-utility'
import { createRevenueOpportunityId, revenueSignalHash } from '@/lib/revenue-control-plane'
import { verifyContactTurnstile } from '@/lib/turnstile'
import { Resend } from 'resend'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
const MAX_BODY_BYTES = 16_384

async function notifyInbound(submission: ReturnType<typeof parseInboundSubmission>, metadata: { referralSource: string; referralDetail?: string; sourcePath: string; utmSource?: string; utmMedium?: string; utmCampaign?: string }) {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return
  try {
    await new Resend(apiKey).emails.send({
      from: process.env.INBOUND_NOTIFICATION_FROM ?? 'Maha Strategies <onboarding@resend.dev>',
      to: process.env.INBOUND_NOTIFICATION_TO ?? 'mayone@mahastrategies.com',
      replyTo: submission.requester.email,
      subject: `[Maha inquiry] ${submission.offerId}`,
      text: `NEW QUALIFIED INQUIRY\n\nNAME: ${submission.requester.name}\nEMAIL: ${submission.requester.email}\nORGANIZATION: ${submission.requester.organization ?? 'Not provided'}\nOFFER: ${submission.offerId}\nSOURCE: ${metadata.sourcePath}\nREFERRAL: ${metadata.referralSource}${metadata.referralDetail ? ` — ${metadata.referralDetail}` : ''}\nCAMPAIGN: ${[metadata.utmSource, metadata.utmMedium, metadata.utmCampaign].filter(Boolean).join(' / ') || 'None'}\n\nDECISION:\n${submission.decision}\n\nQUESTION:\n${submission.question}`,
    })
  } catch { /* The durable ledger is authoritative; alert delivery is best effort. */ }
}

export async function POST(request: Request) {
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) return jsonResponse({ error: { code: 'unsupported_media_type', message: 'Content-Type must be application/json.' } }, 415)
  const raw = await request.text()
  if (Buffer.byteLength(raw, 'utf8') > MAX_BODY_BYTES) return jsonResponse({ error: { code: 'payload_too_large', message: 'Submission exceeds the 16 KB limit.' } }, 413)
  let body: Record<string, unknown>, submission: ReturnType<typeof parseInboundSubmission>
  try {
    const parsed = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) throw new Error('Request body must be a JSON object.')
    body = parsed as Record<string, unknown>
    submission = parseInboundSubmission(body)
  }
  catch (error) { return jsonResponse({ error: { code: 'invalid_request', message: error instanceof Error ? error.message : 'Invalid submission.' } }, 400) }
  const verification = await verifyContactTurnstile(body.turnstileToken, request)
  if (!verification.accepted) return jsonResponse({ error: { code: 'verification_failed', message: 'Verification expired or failed. Please retry.' } }, 400)
  let metadata: { referralSource: string; referralDetail?: string; sourcePath: string; utmSource?: string; utmMedium?: string; utmCampaign?: string }
  try {
    metadata = {
      referralSource: parseContactReferralSource(body.referralSource), referralDetail: optionalCampaignValue(body.referralDetail, 'referralDetail'),
      sourcePath: contactSourcePath(body.sourcePath), utmSource: optionalCampaignValue(body.utmSource, 'utmSource'),
      utmMedium: optionalCampaignValue(body.utmMedium, 'utmMedium'), utmCampaign: optionalCampaignValue(body.utmCampaign, 'utmCampaign'),
    }
  } catch (error) { return jsonResponse({ error: { code: 'invalid_request', message: error instanceof Error ? error.message : 'Invalid attribution.' } }, 400) }
  // Do not reward cold agency pitches with a lead, notification, or revenue record.
  // Return the same non-committal response to avoid teaching spammers the filter.
  if (isLikelyCommercialSolicitation(submission)) return jsonResponse({ accepted: true, status: 'screened_out', bindingCommitment: false }, 202)
  let visitorHash: string
  try { visitorHash = publicUtilityVisitorHash(request) }
  catch { return jsonResponse({ error: { code: 'gateway_unavailable', message: 'Inbound gateway is not configured.' } }, 503) }
  const ledger = createAgentInquiryLedger()
  if (!ledger) return jsonResponse({ error: { code: 'ledger_unavailable', message: 'Inbound gateway is temporarily unavailable.' } }, 503)
  const { data: allowed, error: limitError } = await ledger.rpc('consume_inbound_submission_rate_limit', { p_visitor_hash: visitorHash, p_limit: 8 })
  if (limitError || typeof allowed !== 'boolean') return jsonResponse({ error: { code: 'gateway_unavailable', message: 'Inbound gateway is temporarily unavailable.' } }, 503)
  if (!allowed) return jsonResponse({ error: { code: 'rate_limited', message: 'Too many submissions. Retry in one hour.' } }, 429)

  const routing = routeInboundSubmission(submission)
  const idempotencyHash = inboundHash(submission.idempotencyKey)
  const { data: inserted, error: insertError } = await ledger.from('inbound_submissions').insert({
    public_id: inboundId(), visitor_hash: visitorHash, idempotency_hash: idempotencyHash, offer_id: submission.offerId,
    requester_name: submission.requester.name, requester_email: submission.requester.email, requester_organization: submission.requester.organization ?? null,
    decision: submission.decision, question: submission.question, deadline: submission.deadline ?? null, context: submission.context ?? null, agent: submission.agent ?? null,
    qualification_status: routing.status, qualification_reasons: routing.qualificationReasons,
    inquiry_class: submission.offerId === 'mps-preflight' ? 'support' : 'buyer', referral_source: metadata.referralSource, referral_detail: metadata.referralDetail ?? null,
    source_path: inboundLedgerSourcePath(), utm_source: metadata.utmSource ?? null, utm_medium: metadata.utmMedium ?? null, utm_campaign: metadata.utmCampaign ?? null,
  }).select('public_id, revenue_opportunity_id').maybeSingle()
  let record = inserted
  let replay = false
  if (insertError?.code === '23505') {
    const { data: existing, error } = await ledger.from('inbound_submissions').select('public_id, revenue_opportunity_id').eq('visitor_hash', visitorHash).eq('idempotency_hash', idempotencyHash).maybeSingle()
    if (error || !existing) return jsonResponse({ error: { code: 'ledger_unavailable', message: 'Inbound submission could not be recovered.' } }, 503)
    if (existing.revenue_opportunity_id) return jsonResponse({ submissionId: existing.public_id, opportunityId: existing.revenue_opportunity_id, status: routing.status, nextStep: routing.nextStep, idempotentReplay: true, bindingCommitment: false }, 202)
    record = existing; replay = true
  }
  if ((insertError && insertError.code !== '23505') || !record) return jsonResponse({ error: { code: 'ledger_unavailable', message: 'Inbound submission could not be recorded.' } }, 503)

  const sourceReference = record.public_id
  const { data: revenue, error: revenueError } = await ledger.rpc('create_revenue_opportunity', {
    p_opportunity_id: createRevenueOpportunityId(), p_source_type: 'website_contact', p_source_reference: sourceReference, p_source_url: null,
    p_offer_id: submission.offerId, p_signal_hash: revenueSignalHash({ sourceType: 'website_contact', sourceReference, offerId: submission.offerId, hasDefinedDecision: true, hasSpecificQuestion: true, hasOrganization: Boolean(submission.requester.organization) }),
    p_route: routing.route, p_qualified: routing.status === 'qualified', p_qualification_reasons: routing.qualificationReasons,
    p_idempotency_hash: inboundHash(`revenue:${submission.idempotencyKey}`), p_actor_fingerprint: inboundHash('inbound-gateway-v1'), p_reason: `Public inbound submission through ${metadata.sourcePath} passed deterministic validation.`, p_reference_id: sourceReference, p_created_at: new Date().toISOString(),
  })
  if (revenueError || typeof revenue !== 'object' || revenue === null || Array.isArray(revenue)) return jsonResponse({ error: { code: 'ledger_unavailable', message: 'Submission was received but commercial routing is temporarily unavailable. Please retry with the same idempotency key.' } }, 503)
  const opportunityId = (revenue as { opportunityId?: unknown }).opportunityId
  if (typeof opportunityId !== 'string') return jsonResponse({ error: { code: 'ledger_unavailable', message: 'Commercial routing is temporarily unavailable.' } }, 503)
  await ledger.from('inbound_submissions').update({ revenue_opportunity_id: opportunityId, updated_at: new Date().toISOString() }).eq('public_id', record.public_id)
  await notifyInbound(submission, metadata)
  return jsonResponse({ submissionId: record.public_id, opportunityId, status: routing.status, nextStep: routing.nextStep, idempotentReplay: replay || undefined, bindingCommitment: false, autonomousPaymentSupported: false }, 202)
}

export function OPTIONS() { return new Response(null, { status: 204, headers: { Allow: 'POST, OPTIONS', 'Cache-Control': 'no-store' } }) }
