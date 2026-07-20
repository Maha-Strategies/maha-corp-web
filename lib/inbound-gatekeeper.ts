import { createHash, randomUUID } from 'node:crypto'

import { REVENUE_OFFERS, type RevenueOfferId } from './revenue-control-plane.ts'

export type InboundSubmission = {
  idempotencyKey: string
  offerId: RevenueOfferId
  requester: { name: string; email: string; organization?: string }
  decision: string
  question: string
  deadline?: string
  context?: string
  agent?: { name: string; version?: string }
  requesterAuthorized: true
}

function object(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error('Request body must be a JSON object.')
  return value as Record<string, unknown>
}
function line(value: unknown, name: string, min: number, max: number): string {
  if (typeof value !== 'string') throw new Error(`${name} must be a string.`)
  const result = value.trim()
  if (result.length < min || result.length > max || /[\r\n]/.test(result)) throw new Error(`${name} must contain between ${min} and ${max} characters on one line.`)
  return result
}
function text(value: unknown, name: string, min: number, max: number): string {
  if (typeof value !== 'string') throw new Error(`${name} must be a string.`)
  const result = value.trim()
  if (result.length < min || result.length > max) throw new Error(`${name} must contain between ${min} and ${max} characters.`)
  return result
}
function optional(value: unknown, name: string, max: number): string | undefined {
  return value === undefined || value === null || value === '' ? undefined : text(value, name, 1, max)
}

export function parseInboundSubmission(value: unknown): InboundSubmission {
  const body = object(value)
  if (body.website) throw new Error('Submission rejected.') // Honeypot: never disclose why.
  const requester = object(body.requester)
  const offerId = line(body.offerId, 'offerId', 3, 80)
  if (!(offerId in REVENUE_OFFERS)) throw new Error('offerId is not available.')
  const email = line(requester.email, 'requester.email', 3, 254).toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('requester.email must be valid.')
  if (body.requesterAuthorized !== true) throw new Error('requesterAuthorized must be true.')
  let agent: InboundSubmission['agent']
  if (body.agent !== undefined) {
    const raw = object(body.agent)
    agent = { name: line(raw.name, 'agent.name', 2, 160), version: raw.version === undefined ? undefined : line(raw.version, 'agent.version', 1, 80) }
  }
  return {
    idempotencyKey: line(body.idempotencyKey, 'idempotencyKey', 8, 120), offerId: offerId as RevenueOfferId,
    requester: { name: line(requester.name, 'requester.name', 2, 160), email, organization: requester.organization === undefined ? undefined : line(requester.organization, 'requester.organization', 2, 200) },
    decision: text(body.decision, 'decision', 12, 1_500), question: text(body.question, 'question', 20, 5_000),
    deadline: optional(body.deadline, 'deadline', 80), context: optional(body.context, 'context', 5_000), agent, requesterAuthorized: true,
  }
}

export function inboundId(): string { return `inbound_${randomUUID().replaceAll('-', '')}` }
export function inboundHash(value: string): string { return `sha256:${createHash('sha256').update(value).digest('hex')}` }
export function routeInboundSubmission(submission: InboundSubmission) {
  const offer = REVENUE_OFFERS[submission.offerId]
  const selfService = offer.acquisition === 'self_service_checkout'
  const reasons = [submission.decision ? 'defined_decision' : null, submission.question ? 'specific_question' : null, submission.requester.organization ? 'organization_identified' : null].filter((item): item is string => Boolean(item))
  return {
    status: selfService || reasons.length === 3 ? 'qualified' : 'needs_clarification',
    qualificationReasons: selfService ? ['self_service_offer'] : reasons,
    nextStep: selfService ? `Present the self-service purchase page: ${offer.href}` : reasons.length === 3 ? 'Queue for human scope and price review.' : 'Request the missing decision context or organization details.',
    route: selfService ? 'self_service_checkout' : 'human_scope_review',
  }
}
