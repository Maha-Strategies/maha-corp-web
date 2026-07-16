import { createHash, randomUUID, timingSafeEqual } from 'node:crypto'

import { Resend } from 'resend'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAX_BODY_BYTES = 32_768
const REQUEST_WINDOW_MS = 60 * 60 * 1000
const REQUEST_LIMIT = 12
const IDEMPOTENCY_WINDOW_MS = 24 * 60 * 60 * 1000

const OFFERS = {
  'rapid-intelligence-brief': 'Rapid Intelligence Brief',
  'verified-research-brief': 'Verified Research Brief',
} as const

type OfferId = keyof typeof OFFERS

type AgentInquiry = {
  clientRequestId: string
  offerId: OfferId
  requester: {
    name: string
    email: string
    organization?: string
  }
  decision: string
  question: string
  deadline?: string
  context?: string
  constraints?: string[]
  requesterAuthorized: true
  agent?: {
    name: string
    version?: string
  }
}

type InquiryReceipt = {
  inquiryId: string
  clientRequestId: string
  offerId: OfferId
  status: 'received_for_human_review'
  bindingCommitment: false
  autonomousPaymentSupported: false
}

const rateWindows = new Map<string, { startedAt: number; count: number }>()
const idempotencyReceipts = new Map<string, { expiresAt: number; receipt: InquiryReceipt }>()

function response(body: Record<string, unknown>, status: number) {
  return Response.json(body, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      'Content-Type': 'application/json; charset=utf-8',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Referrer-Policy': 'no-referrer',
    },
  })
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function text(value: unknown, field: string, maximum: number, minimum = 1): string {
  if (typeof value !== 'string') throw new Error(`${field} must be a string.`)
  const trimmed = value.trim()
  if (trimmed.length < minimum || trimmed.length > maximum) {
    throw new Error(`${field} must contain between ${minimum} and ${maximum} characters.`)
  }
  return trimmed
}

function singleLine(value: unknown, field: string, maximum: number, minimum = 1): string {
  const parsed = text(value, field, maximum, minimum)
  if (/[\r\n]/.test(parsed)) throw new Error(`${field} must be a single line.`)
  return parsed
}

function optionalText(value: unknown, field: string, maximum: number): string | undefined {
  if (value === undefined || value === null || value === '') return undefined
  return text(value, field, maximum)
}

function parseInquiry(value: unknown): AgentInquiry {
  if (!isObject(value)) throw new Error('Request body must be a JSON object.')
  if (!isObject(value.requester)) throw new Error('requester must be an object.')

  const offerId = singleLine(value.offerId, 'offerId', 80) as OfferId
  if (!(offerId in OFFERS)) throw new Error('offerId is not currently available for inquiry.')

  const email = singleLine(value.requester.email, 'requester.email', 254)
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('requester.email must be a valid email address.')
  if (value.requesterAuthorized !== true) {
    throw new Error('requesterAuthorized must be true before an inquiry can be sent.')
  }

  const deadline = optionalText(value.deadline, 'deadline', 64)
  if (deadline && Number.isNaN(Date.parse(deadline))) throw new Error('deadline must be an ISO-8601 date or date-time.')

  let constraints: string[] | undefined
  if (value.constraints !== undefined) {
    if (!Array.isArray(value.constraints) || value.constraints.length > 12) {
      throw new Error('constraints must contain at most 12 items.')
    }
    constraints = value.constraints.map((item) => text(item, 'constraints[]', 500))
  }

  let agent: AgentInquiry['agent']
  if (value.agent !== undefined) {
    if (!isObject(value.agent)) throw new Error('agent must be an object.')
    agent = {
      name: singleLine(value.agent.name, 'agent.name', 160),
      version: value.agent.version === undefined ? undefined : singleLine(value.agent.version, 'agent.version', 80),
    }
  }

  return {
    clientRequestId: singleLine(value.clientRequestId, 'clientRequestId', 120, 8),
    offerId,
    requester: {
      name: singleLine(value.requester.name, 'requester.name', 160),
      email,
      organization: value.requester.organization === undefined ? undefined : singleLine(value.requester.organization, 'requester.organization', 200),
    },
    decision: text(value.decision, 'decision', 1_500, 12),
    question: text(value.question, 'question', 5_000, 20),
    deadline,
    context: optionalText(value.context, 'context', 5_000),
    constraints,
    requesterAuthorized: true,
    agent,
  }
}

function bearerMatches(request: Request, expected: string): boolean {
  const authorization = request.headers.get('authorization')
  if (!authorization?.startsWith('Bearer ')) return false
  const supplied = Buffer.from(authorization.slice('Bearer '.length))
  const configured = Buffer.from(expected)
  return supplied.length === configured.length && timingSafeEqual(supplied, configured)
}

function tokenFingerprint(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

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

function idempotencyKey(fingerprint: string, clientRequestId: string): string {
  return `${fingerprint}:${clientRequestId}`
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
    return response({ error: { code: 'gateway_unavailable', message: 'The agent inquiry gateway is not enabled.' } }, 503)
  }
  if (!bearerMatches(request, gatewayToken)) {
    return response({ error: { code: 'unauthorized', message: 'A valid bearer token is required.' } }, 401)
  }
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
    return response({ error: { code: 'unsupported_media_type', message: 'Content-Type must be application/json.' } }, 415)
  }

  const contentLength = Number(request.headers.get('content-length') ?? '0')
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    return response({ error: { code: 'payload_too_large', message: 'Request body exceeds the 32 KB limit.' } }, 413)
  }

  const tokenHash = tokenFingerprint(gatewayToken)
  if (!acceptRateLimitedRequest(tokenHash)) {
    return response({ error: { code: 'rate_limited', message: 'Too many requests. Retry after one hour.' } }, 429)
  }

  let inquiry: AgentInquiry
  try {
    inquiry = parseInquiry(await request.json())
  } catch (error) {
    return response({ error: { code: 'invalid_request', message: error instanceof Error ? error.message : 'Invalid request body.' } }, 400)
  }

  const replayKey = idempotencyKey(tokenHash, inquiry.clientRequestId)
  const existing = idempotencyReceipts.get(replayKey)
  if (existing && existing.expiresAt > Date.now()) {
    return response({ ...existing.receipt, idempotentReplay: true }, 202)
  }

  const resendKey = process.env.RESEND_API_KEY
  if (!resendKey) {
    return response({ error: { code: 'delivery_unavailable', message: 'Inquiry delivery is not configured.' } }, 503)
  }

  const receipt: InquiryReceipt = {
    inquiryId: `agent-inquiry-${randomUUID()}`,
    clientRequestId: inquiry.clientRequestId,
    offerId: inquiry.offerId,
    status: 'received_for_human_review',
    bindingCommitment: false,
    autonomousPaymentSupported: false,
  }

  try {
    const resend = new Resend(resendKey)
    const { error } = await resend.emails.send({
      from: process.env.AGENT_INQUIRY_FROM ?? 'Maha Strategies <onboarding@resend.dev>',
      to: process.env.AGENT_INQUIRY_TO ?? 'mayone@mahastrategies.com',
      replyTo: inquiry.requester.email,
      subject: `[Agent inquiry — review required] ${OFFERS[inquiry.offerId]} · ${inquiry.requester.name}`,
      text: buildEmailText(inquiry, receipt.inquiryId),
    })
    if (error) {
      console.error('Agent inquiry email delivery was rejected:', error.name)
      return response({ error: { code: 'delivery_failed', message: 'The inquiry could not be delivered for review.' } }, 502)
    }
  } catch (error) {
    console.error('Agent inquiry email delivery failed:', error instanceof Error ? error.name : 'unknown_error')
    return response({ error: { code: 'delivery_failed', message: 'The inquiry could not be delivered for review.' } }, 502)
  }

  idempotencyReceipts.set(replayKey, { expiresAt: Date.now() + IDEMPOTENCY_WINDOW_MS, receipt })
  return response({
    ...receipt,
    nextStep: 'Maha Strategies will review fit, scope, sources, price, and timing before confirming any engagement.',
    idempotency: 'Best-effort replay protection is retained for 24 hours on the serving instance.',
  }, 202)
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: { Allow: 'POST, OPTIONS', 'Cache-Control': 'no-store' } })
}
