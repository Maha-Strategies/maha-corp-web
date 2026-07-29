import { createHash, randomUUID, timingSafeEqual } from 'node:crypto'

export const REVENUE_OFFERS = {
  'mps-prepaid-audit-access': {
    name: 'MPS Prepaid Audit API Access', acquisition: 'self_service_checkout', href: '/mps/audit-access',
  },
  'mps-preflight': {
    name: 'MPS Preflight', acquisition: 'self_service_checkout', href: '/mps/preflight',
  },
  'mps-evidence-audit': {
    name: 'MPS Evidence Audit', acquisition: 'human_scope_review', href: '/evidence-audit',
  },
  'book-the-imagined-life': {
    name: 'The Imagined Life — MCP Access', acquisition: 'self_service_checkout', href: '/books/mcp-access',
  },
  'book-the-orbital-mind': {
    name: 'The Orbital Mind — MCP Access', acquisition: 'self_service_checkout', href: '/books/mcp-access',
  },
  'book-the-synthetic-self': {
    name: 'The Synthetic Self — MCP Access', acquisition: 'self_service_checkout', href: '/books/mcp-access',
  },
  'book-the-unfinished-species': {
    name: 'The Unfinished Species — MCP Access', acquisition: 'self_service_checkout', href: '/books/mcp-access',
  },
  'rapid-intelligence-brief': {
    name: 'Rapid Intelligence Brief', acquisition: 'human_scope_review', href: '/rapid-intelligence-brief',
  },
  'verified-research-brief': {
    name: 'Verified Research Brief', acquisition: 'human_scope_review', href: '/consulting',
  },
} as const

export type RevenueOfferId = keyof typeof REVENUE_OFFERS
export type RevenueSourceType = 'agent_inquiry' | 'website_contact' | 'manual_operator'
export type RevenueOutcome = 'human_review_started' | 'checkout_started' | 'paid' | 'delivered' | 'refunded' | 'declined' | 'closed_lost'

export type RevenueRoutingInput = {
  sourceType: RevenueSourceType
  sourceReference: string
  sourceUrl?: string
  offerId: RevenueOfferId
  hasDefinedDecision?: boolean
  hasSpecificQuestion?: boolean
  hasOrganization?: boolean
  hasDeadline?: boolean
}

type OperatorCommon = { idempotencyKey: string; reason: string; referenceId: string }

export type RevenueControlAction =
  | (OperatorCommon & { action: 'route_inbound'; signal: RevenueRoutingInput })
  | (OperatorCommon & { action: 'record_outcome'; opportunityId: string; outcome: RevenueOutcome; amountCents?: number; currency?: string })
  | { action: 'lookup'; opportunityId?: string; sourceType?: RevenueSourceType; sourceReference?: string }

export type RevenueOperationsAuthorization =
  | { kind: 'authorized'; actorFingerprint: string }
  | { kind: 'unauthorized' }
  | { kind: 'unconfigured' }

function singleLine(value: unknown, field: string, minimum: number, maximum: number): string {
  if (typeof value !== 'string') throw new Error(`${field} must be a string.`)
  const trimmed = value.trim()
  if (trimmed.length < minimum || trimmed.length > maximum || /[\r\n]/.test(trimmed)) {
    throw new Error(`${field} must contain between ${minimum} and ${maximum} characters on one line.`)
  }
  return trimmed
}

function optionalUrl(value: unknown): string | undefined {
  if (value === undefined || value === null || value === '') return undefined
  const parsed = singleLine(value, 'signal.sourceUrl', 8, 2_000)
  let url: URL
  try { url = new URL(parsed) } catch { throw new Error('signal.sourceUrl must be an absolute HTTPS URL.') }
  if (url.protocol !== 'https:') throw new Error('signal.sourceUrl must be an absolute HTTPS URL.')
  return url.toString()
}

function validOfferId(value: string): value is RevenueOfferId {
  return value in REVENUE_OFFERS
}

function validSourceType(value: unknown): value is RevenueSourceType {
  return value === 'agent_inquiry' || value === 'website_contact' || value === 'manual_operator'
}

function validOutcome(value: unknown): value is RevenueOutcome {
  return value === 'human_review_started' || value === 'checkout_started' || value === 'paid' || value === 'delivered' || value === 'refunded' || value === 'declined' || value === 'closed_lost'
}

function boolean(value: unknown, field: string): boolean | undefined {
  if (value === undefined) return undefined
  if (typeof value !== 'boolean') throw new Error(`${field} must be a boolean.`)
  return value
}

function parseSignal(value: unknown): RevenueRoutingInput {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error('signal must be an object.')
  const signal = value as Record<string, unknown>
  if (!validSourceType(signal.sourceType)) throw new Error('signal.sourceType is not supported.')
  const offerId = singleLine(signal.offerId, 'signal.offerId', 3, 80)
  if (!validOfferId(offerId)) throw new Error('signal.offerId is not a supported revenue offer.')
  return {
    sourceType: signal.sourceType,
    sourceReference: singleLine(signal.sourceReference, 'signal.sourceReference', 3, 200),
    sourceUrl: optionalUrl(signal.sourceUrl),
    offerId,
    hasDefinedDecision: boolean(signal.hasDefinedDecision, 'signal.hasDefinedDecision'),
    hasSpecificQuestion: boolean(signal.hasSpecificQuestion, 'signal.hasSpecificQuestion'),
    hasOrganization: boolean(signal.hasOrganization, 'signal.hasOrganization'),
    hasDeadline: boolean(signal.hasDeadline, 'signal.hasDeadline'),
  }
}

export function authorizeRevenueOperations(request: Request): RevenueOperationsAuthorization {
  const token = process.env.REVENUE_CONTROL_TOKEN
  if (!token) return { kind: 'unconfigured' }
  const authorization = request.headers.get('authorization')
  if (!authorization?.startsWith('Bearer ')) return { kind: 'unauthorized' }
  const supplied = Buffer.from(authorization.slice('Bearer '.length))
  const configured = Buffer.from(token)
  if (supplied.length !== configured.length || !timingSafeEqual(supplied, configured)) return { kind: 'unauthorized' }
  return { kind: 'authorized', actorFingerprint: `sha256:${createHash('sha256').update(token).digest('hex')}` }
}

export function createRevenueOpportunityId(): string {
  return `revopp_${randomUUID().replaceAll('-', '')}`
}

export function revenueIdempotencyHash(value: string): string {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`
}

export function revenueSignalHash(signal: RevenueRoutingInput): string {
  return `sha256:${createHash('sha256').update(JSON.stringify(signal)).digest('hex')}`
}

export function routeRevenueSignal(signal: RevenueRoutingInput) {
  const offer = REVENUE_OFFERS[signal.offerId]
  const qualificationReasons = [
    signal.hasDefinedDecision ? 'defined_decision' : null,
    signal.hasSpecificQuestion ? 'specific_question' : null,
    signal.hasOrganization ? 'organization_identified' : null,
    signal.hasDeadline ? 'deadline_identified' : null,
  ].filter((reason): reason is string => reason !== null)

  if (offer.acquisition === 'self_service_checkout') {
    return {
      offer,
      route: 'self_service_checkout' as const,
      status: 'routed' as const,
      qualified: true,
      qualificationReasons: ['self_service_offer'],
      humanReviewRequired: false,
    }
  }

  return {
    offer,
    route: 'human_scope_review' as const,
    status: 'awaiting_human_review' as const,
    qualified: qualificationReasons.includes('defined_decision') && qualificationReasons.includes('specific_question'),
    qualificationReasons,
    humanReviewRequired: true,
  }
}

export function parseRevenueControlAction(value: unknown): RevenueControlAction {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error('Request body must be a JSON object.')
  const body = value as Record<string, unknown>

  if (body.action === 'lookup') {
    if (body.opportunityId !== undefined) {
      const opportunityId = singleLine(body.opportunityId, 'opportunityId', 7, 80)
      if (!/^revopp_[a-f0-9]{32}$/.test(opportunityId)) throw new Error('opportunityId is not valid.')
      return { action: 'lookup', opportunityId }
    }
    if (!validSourceType(body.sourceType)) throw new Error('sourceType is not supported.')
    return { action: 'lookup', sourceType: body.sourceType, sourceReference: singleLine(body.sourceReference, 'sourceReference', 3, 200) }
  }

  const common = {
    idempotencyKey: singleLine(body.idempotencyKey, 'idempotencyKey', 8, 120),
    reason: singleLine(body.reason, 'reason', 3, 500),
    referenceId: singleLine(body.referenceId, 'referenceId', 3, 200),
  }
  if (body.action === 'route_inbound') return { action: 'route_inbound', signal: parseSignal(body.signal), ...common }

  if (body.action === 'record_outcome') {
    const opportunityId = singleLine(body.opportunityId, 'opportunityId', 7, 80)
    if (!/^revopp_[a-f0-9]{32}$/.test(opportunityId)) throw new Error('opportunityId is not valid.')
    if (!validOutcome(body.outcome)) throw new Error('outcome is not supported.')
    const rawAmountCents = body.amountCents
    if (rawAmountCents !== undefined && (typeof rawAmountCents !== 'number' || !Number.isInteger(rawAmountCents) || rawAmountCents < 1 || rawAmountCents > 100_000_000)) {
      throw new Error('amountCents must be an integer between 1 and 100000000.')
    }
    const amountCents = rawAmountCents as number | undefined
    const currency = body.currency === undefined ? undefined : singleLine(body.currency, 'currency', 3, 3).toLowerCase()
    if ((body.outcome === 'paid' || body.outcome === 'refunded') && (amountCents === undefined || !currency || !/^[a-z]{3}$/.test(currency))) {
      throw new Error('paid and refunded outcomes require amountCents and a three-letter currency.')
    }
    return { action: 'record_outcome', opportunityId, outcome: body.outcome, amountCents, currency, ...common }
  }
  throw new Error('action must be route_inbound, record_outcome, or lookup.')
}
