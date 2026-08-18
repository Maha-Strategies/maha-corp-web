import { createHash } from 'node:crypto'

export const X402_TRUST_DEMO_EVENT_TYPES = [
  'demo_started',
  'scenario_completed',
  'evidence_downloaded',
  'integration_requested',
] as const

export const X402_TRUST_DEMO_SCENARIOS = ['proceed', 'review', 'deny'] as const

export type X402TrustDemoEventType = (typeof X402_TRUST_DEMO_EVENT_TYPES)[number]
export type X402TrustDemoScenario = (typeof X402_TRUST_DEMO_SCENARIOS)[number]

export type X402TrustDemoEvent = {
  eventId: string
  eventType: X402TrustDemoEventType
  scenarioId: X402TrustDemoScenario | null
}

const EVENT_ID = /^x402trust_[a-z0-9-]{16,96}$/

export function parseX402TrustDemoEvent(value: unknown): X402TrustDemoEvent {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error('Request body must be a JSON object.')
  const input = value as Record<string, unknown>
  const unexpected = Object.keys(input).filter((key) => !['eventId', 'eventType', 'scenarioId'].includes(key))
  if (unexpected.length > 0) throw new Error('Request body contains unsupported fields.')
  if (typeof input.eventId !== 'string' || !EVENT_ID.test(input.eventId)) throw new Error('eventId is invalid.')
  if (!X402_TRUST_DEMO_EVENT_TYPES.includes(input.eventType as X402TrustDemoEventType)) throw new Error('eventType is invalid.')

  const eventType = input.eventType as X402TrustDemoEventType
  const scenarioId = input.scenarioId === undefined || input.scenarioId === null ? null : input.scenarioId
  if (scenarioId !== null && !X402_TRUST_DEMO_SCENARIOS.includes(scenarioId as X402TrustDemoScenario)) throw new Error('scenarioId is invalid.')
  if ((eventType === 'scenario_completed' || eventType === 'evidence_downloaded') && scenarioId === null) throw new Error('scenarioId is required for this event.')
  if ((eventType === 'demo_started' || eventType === 'integration_requested') && scenarioId !== null) throw new Error('scenarioId is not allowed for this event.')

  return { eventId: input.eventId, eventType, scenarioId: scenarioId as X402TrustDemoScenario | null }
}

export function x402TrustDemoEventHash(eventId: string): string {
  return `sha256:${createHash('sha256').update(`x402_trust_demo|${eventId}`, 'utf8').digest('hex')}`
}
