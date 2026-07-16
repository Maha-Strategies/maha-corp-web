import { type InquiryStatus, bearerMatches, jsonResponse } from '@/lib/agent-inquiries'
import { createAgentInquiryLedger } from '@/lib/agent-inquiry-ledger'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type ReviewAction = 'start_review' | 'needs_clarification' | 'decline' | 'approve_for_scoping'

const ACTION_STATUS: Record<ReviewAction, InquiryStatus> = {
  start_review: 'under_review',
  needs_clarification: 'needs_clarification',
  decline: 'declined',
  approve_for_scoping: 'approved_for_scoping',
}

function reviewerAuthorized(request: Request): boolean {
  const token = process.env.AGENT_REVIEW_TOKEN
  return Boolean(token && bearerMatches(request, token))
}

function validInquiryId(value: string): boolean {
  return /^inq_[a-f0-9]{32}$/.test(value)
}

function reviewNote(value: unknown): string | null {
  if (value === undefined || value === null || value === '') return null
  if (typeof value !== 'string') throw new Error('note must be a string.')
  const trimmed = value.trim()
  if (trimmed.length > 2_000) throw new Error('note must be no longer than 2000 characters.')
  return trimmed || null
}

export async function GET(_request: Request, context: RouteContext<'/api/agent-inquiries/[inquiryId]'>) {
  const { inquiryId } = await context.params
  if (!reviewerAuthorized(_request)) {
    return jsonResponse({ error: { code: 'unauthorized', message: 'A valid reviewer bearer token is required.' } }, 401)
  }
  if (!validInquiryId(inquiryId)) {
    return jsonResponse({ error: { code: 'not_found', message: 'Inquiry not found.' } }, 404)
  }
  const ledger = createAgentInquiryLedger()
  if (!ledger) return jsonResponse({ error: { code: 'ledger_unavailable', message: 'The inquiry ledger is not configured.' } }, 503)

  const { data, error } = await ledger
    .from('agent_inquiries')
    .select('public_id, client_id, credential_id, offer_id, requester_name, requester_email, requester_organization, decision, question, deadline, payload, payload_hash, status, notification_status, reviewer_note, created_at, reviewed_at')
    .eq('public_id', inquiryId)
    .maybeSingle()
  if (error) return jsonResponse({ error: { code: 'ledger_unavailable', message: 'The inquiry ledger could not be read.' } }, 503)
  if (!data) return jsonResponse({ error: { code: 'not_found', message: 'Inquiry not found.' } }, 404)

  const { data: events, error: eventsError } = await ledger
    .from('agent_inquiry_events')
    .select('event_type, actor_type, event_hash, metadata, created_at')
    .eq('inquiry_id', inquiryId)
    .order('created_at', { ascending: true })
  if (eventsError) return jsonResponse({ error: { code: 'ledger_unavailable', message: 'The inquiry history could not be read.' } }, 503)

  return jsonResponse({ inquiry: data, events, bindingCommitment: false, autonomousPaymentSupported: false }, 200)
}

export async function PATCH(request: Request, context: RouteContext<'/api/agent-inquiries/[inquiryId]'>) {
  const { inquiryId } = await context.params
  if (!reviewerAuthorized(request)) {
    return jsonResponse({ error: { code: 'unauthorized', message: 'A valid reviewer bearer token is required.' } }, 401)
  }
  if (!validInquiryId(inquiryId)) {
    return jsonResponse({ error: { code: 'not_found', message: 'Inquiry not found.' } }, 404)
  }
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
    return jsonResponse({ error: { code: 'unsupported_media_type', message: 'Content-Type must be application/json.' } }, 415)
  }

  let action: ReviewAction
  let note: string | null
  try {
    const body = await request.json() as { action?: unknown; note?: unknown }
    if (typeof body.action !== 'string' || !(body.action in ACTION_STATUS)) throw new Error('action is not supported.')
    action = body.action as ReviewAction
    note = reviewNote(body.note)
  } catch (error) {
    return jsonResponse({ error: { code: 'invalid_request', message: error instanceof Error ? error.message : 'Invalid request body.' } }, 400)
  }

  const ledger = createAgentInquiryLedger()
  if (!ledger) return jsonResponse({ error: { code: 'ledger_unavailable', message: 'The inquiry ledger is not configured.' } }, 503)
  const status = ACTION_STATUS[action]
  const reviewedAt = new Date().toISOString()
  const { data, error } = await ledger
    .from('agent_inquiries')
    .update({ status, reviewer_note: note, reviewed_at: reviewedAt, updated_at: reviewedAt })
    .eq('public_id', inquiryId)
    .select('public_id, status, reviewed_at')
    .maybeSingle()
  if (error) return jsonResponse({ error: { code: 'ledger_unavailable', message: 'The inquiry could not be updated.' } }, 503)
  if (!data) return jsonResponse({ error: { code: 'not_found', message: 'Inquiry not found.' } }, 404)

  return jsonResponse({
    inquiryId: data.public_id,
    status: data.status,
    reviewedAt: data.reviewed_at,
    bindingCommitment: false,
    autonomousPaymentSupported: false,
    note: 'This records an internal review state only. A separate written scope and price confirmation is still required.',
  }, 200)
}
