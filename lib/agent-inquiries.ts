import { createHash, timingSafeEqual } from 'node:crypto'

export const OFFERS = {
  'rapid-intelligence-brief': 'Rapid Intelligence Brief',
  'verified-research-brief': 'Verified Research Brief',
} as const

export type OfferId = keyof typeof OFFERS
export type InquiryStatus = 'received' | 'under_review' | 'needs_clarification' | 'declined' | 'approved_for_scoping'

export type AgentInquiry = {
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

export function jsonResponse(body: Record<string, unknown>, status: number) {
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

export function parseInquiry(value: unknown): AgentInquiry {
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

export function bearerMatches(request: Request, expected: string): boolean {
  const authorization = request.headers.get('authorization')
  if (!authorization?.startsWith('Bearer ')) return false
  const supplied = Buffer.from(authorization.slice('Bearer '.length))
  const configured = Buffer.from(expected)
  return supplied.length === configured.length && timingSafeEqual(supplied, configured)
}

export function tokenFingerprint(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue }

function normalizeJson(value: unknown): JsonValue {
  if (value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value
  if (Array.isArray(value)) return value.map(normalizeJson)
  if (typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, item]) => item !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, normalizeJson(item)]),
    )
  }
  throw new TypeError('Only JSON-compatible values can be hashed.')
}

export function contentHash(value: unknown): string {
  return `sha256:${createHash('sha256').update(JSON.stringify(normalizeJson(value))).digest('hex')}`
}

export function serializableInquiry(inquiry: AgentInquiry): Record<string, unknown> {
  return JSON.parse(JSON.stringify(inquiry)) as Record<string, unknown>
}
