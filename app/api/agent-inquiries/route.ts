import { randomUUID } from 'node:crypto'

import { Resend } from 'resend'

import {
  OFFERS,
  type AgentInquiry,
  bearerMatches,
  contentHash,
  jsonResponse,
  parseInquiry,
  serializableInquiry,
  tokenFingerprint,
} from '@/lib/agent-inquiries'
import { createAgentInquiryLedger } from '@/lib/agent-inquiry-ledger'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAX_BODY_BYTES = 32_768
const REQUEST_WINDOW_MS = 60 * 60 * 1000
const REQUEST_LIMIT = 12

const rateWindows = new Map<string, { startedAt: number; count: number }>()

function acceptRateLimitedRequest(fingerprint: string): boolean {
  const now = Date.now()
  const current = rateWindows.get(fingerprint)
  if (!current || now - current.startedAt >= REQUEST_WINDOW_MS) {
    rateWindows.set(fingerprint, { startedAt: now, count: 1 })
    return true
  }
  if (current.count >= REQUEST_LIMIT) return false
  current.count += 1
  return true
}

function buildEmailText(inquiry: AgentInquiry, inquiryId: string): string {
  return `
AGENT INQUIRY — HUMAN REVIEW REQUIRED
--------------------------------------
INQUIRY ID: ${inquiryId}
CLIENT REQUEST ID: ${inquiry.clientRequestId}
OFFER: ${OFFERS[inquiry.offerId]} (${inquiry.offerId})
AUTHORIZATION ATTESTATION: requesterAuthorized=true

REQUESTER
NAME: ${inquiry.requester.name}
EMAIL: ${inquiry.requester.email}
ORGANIZATION: ${inquiry.requester.organization ?? 'Not provided'}

AGENT
NAME: ${inquiry.agent?.name ?? 'Not provided'}
VERSION: ${inquiry.agent?.version ?? 'Not provided'}

DECISION TO INFORM
${inquiry.decision}

QUESTION
${inquiry.question}

DEADLINE
${inquiry.deadline ?? 'Not provided'}

CONTEXT
${inquiry.context ?? 'Not provided'}

CONSTRAINTS
${inquiry.constraints?.length ? inquiry.constraints.map((item) => `- ${item}`).join('\n') : 'Not provided'}

GATEWAY STATUS
Received for human review only. No scope, price, delivery date, payment, or work commitment has been made.
`.trim()
}

export async function POST(request: Request) {
  const gatewayToken = process.env.AGENT_INQUIRY_TOKEN
  if (!gatewayToken) {
    return jsonResponse({ error: { code: 'gateway_unavailable', message: 'The agent inquiry gateway is not enabled.' } }, 503)
  }
  if (!bearerMatches(request, gatewayToken)) {
    return jsonResponse({ error: { code: 'unauthorized', message: 'A valid bearer token is required.' } }, 401)
  }
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
    return jsonResponse({ error: { code: 'unsupported_media_type', message: 'Content-Type must be application/json.' } }, 415)
  }

  const contentLength = Number(request.headers.get('content-length') ?? '0')
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    return jsonResponse({ error: { code: 'payload_too_large', message: 'Request body exceeds the 32 KB limit.' } }, 413)
  }

  const tokenHash = tokenFingerprint(gatewayToken)
  if (!acceptRateLimitedRequest(tokenHash)) {
    return jsonResponse({ error: { code: 'rate_limited', message: 'Too many requests. Retry after one hour.' } }, 429)
  }

  let inquiry: AgentInquiry
  try {
    inquiry = parseInquiry(await request.json())
  } catch (error) {
    return jsonResponse({ error: { code: 'invalid_request', message: error instanceof Error ? error.message : 'Invalid request body.' } }, 400)
  }

  const ledger = createAgentInquiryLedger()
  if (!ledger) {
    return jsonResponse({ error: { code: 'ledger_unavailable', message: 'The inquiry ledger is not configured.' } }, 503)
  }

  const payload = serializableInquiry(inquiry)
  const payloadHash = contentHash(payload)
  const publicId = `inq_${randomUUID().replaceAll('-', '')}`
  const { data: inserted, error: insertError } = await ledger
    .from('agent_inquiries')
    .insert({
      public_id: publicId,
      client_token_fingerprint: tokenHash,
      client_request_id: inquiry.clientRequestId,
      offer_id: inquiry.offerId,
      requester_name: inquiry.requester.name,
      requester_email: inquiry.requester.email,
      requester_organization: inquiry.requester.organization ?? null,
      decision: inquiry.decision,
      question: inquiry.question,
      deadline: inquiry.deadline ?? null,
      payload,
      payload_hash: payloadHash,
      status: 'received',
      notification_status: 'pending',
    })
    .select('public_id, status')
    .maybeSingle()

  if (insertError?.code === '23505') {
    const { data: existing, error: existingError } = await ledger
      .from('agent_inquiries')
      .select('public_id, status, notification_status')
      .eq('client_token_fingerprint', tokenHash)
      .eq('client_request_id', inquiry.clientRequestId)
      .maybeSingle()
    if (existingError || !existing) {
      console.error('Agent inquiry idempotency lookup failed:', existingError?.code ?? 'missing_record')
      return jsonResponse({ error: { code: 'ledger_unavailable', message: 'The inquiry ledger could not be read.' } }, 503)
    }
    return jsonResponse({
      inquiryId: existing.public_id,
      clientRequestId: inquiry.clientRequestId,
      offerId: inquiry.offerId,
      status: existing.status,
      notificationStatus: existing.notification_status,
      idempotentReplay: true,
      bindingCommitment: false,
      autonomousPaymentSupported: false,
    }, 202)
  }

  if (insertError || !inserted) {
    console.error('Agent inquiry ledger write failed:', insertError?.code ?? 'missing_record')
    return jsonResponse({ error: { code: 'ledger_unavailable', message: 'The inquiry could not be recorded.' } }, 503)
  }

  let notificationStatus: 'sent' | 'failed' | 'pending' = 'pending'
  const resendKey = process.env.RESEND_API_KEY
  if (resendKey) {
    try {
      const resend = new Resend(resendKey)
      const { error } = await resend.emails.send({
        from: process.env.AGENT_INQUIRY_FROM ?? 'Maha Strategies <onboarding@resend.dev>',
        to: process.env.AGENT_INQUIRY_TO ?? 'mayone@mahastrategies.com',
        replyTo: inquiry.requester.email,
        subject: `[Agent inquiry — review required] ${OFFERS[inquiry.offerId]} · ${inquiry.requester.name}`,
        text: buildEmailText(inquiry, inserted.public_id),
      })
      notificationStatus = error ? 'failed' : 'sent'
      if (error) console.error('Agent inquiry email delivery was rejected:', error.name)
    } catch (error) {
      notificationStatus = 'failed'
      console.error('Agent inquiry email delivery failed:', error instanceof Error ? error.name : 'unknown_error')
    }
  }

  if (notificationStatus !== 'pending') {
    const { error: notificationError } = await ledger
      .from('agent_inquiries')
      .update({ notification_status: notificationStatus })
      .eq('public_id', inserted.public_id)
    if (notificationError) console.error('Agent inquiry notification status update failed:', notificationError.code)
  }

  return jsonResponse({
    inquiryId: inserted.public_id,
    clientRequestId: inquiry.clientRequestId,
    offerId: inquiry.offerId,
    status: 'received_for_human_review',
    notificationStatus,
    bindingCommitment: false,
    autonomousPaymentSupported: false,
    nextStep: 'Maha Strategies will review fit, scope, sources, price, and timing before confirming any engagement.',
  }, 202)
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: { Allow: 'POST, OPTIONS', 'Cache-Control': 'no-store' } })
}
