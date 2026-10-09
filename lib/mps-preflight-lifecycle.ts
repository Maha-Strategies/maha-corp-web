import { provenanceDigest } from './evidence-dossier/digest.ts'

export const MPS_PREFLIGHT_LIFECYCLE_VERSION = 'maha-mps-preflight-lifecycle/1.0' as const

export type MpsPreflightLifecycleState =
  | 'not_started'
  | 'awaiting_payment'
  | 'paid'
  | 'submission_accepted'
  | 'processing'
  | 'delivered'
  | 'acknowledged'
  | 'processing_failed'
  | 'delivery_failed'
  | 'refunded'

export type MpsPreflightLifecycleEventType =
  | 'checkout_created'
  | 'payment_confirmed'
  | 'submission_accepted'
  | 'processing_started'
  | 'private_delivery_ready'
  | 'acknowledgement_recorded'
  | 'processing_failed'
  | 'delivery_failed'
  | 'refund_recorded'

export type MpsPreflightLifecycleEvent = {
  eventId: string
  type: MpsPreflightLifecycleEventType
  occurredAt: string
  payloadSha256: string
}

export type MpsPreflightLifecycle = {
  schemaVersion: typeof MPS_PREFLIGHT_LIFECYCLE_VERSION
  synthetic: boolean
  orderSha256: string
  state: MpsPreflightLifecycleState
  events: MpsPreflightLifecycleEvent[]
  lifecycleSha256: string
}

export type MpsPreflightTransitionResult = {
  operation: 'applied' | 'idempotent'
  lifecycle: MpsPreflightLifecycle
}

const SHA256 = /^sha256:[a-f0-9]{64}$/
const EVENT_ID = /^mps_event_[a-z0-9_]{8,80}$/
const UTC_SECONDS = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/

const transitions: Record<MpsPreflightLifecycleEventType, readonly MpsPreflightLifecycleState[]> = {
  checkout_created: ['not_started'],
  payment_confirmed: ['awaiting_payment'],
  submission_accepted: ['paid'],
  processing_started: ['submission_accepted'],
  private_delivery_ready: ['processing'],
  acknowledgement_recorded: ['delivered'],
  processing_failed: ['processing'],
  delivery_failed: ['processing'],
  refund_recorded: ['paid', 'submission_accepted', 'processing', 'processing_failed', 'delivery_failed', 'delivered', 'acknowledged'],
}

const resultingState: Record<MpsPreflightLifecycleEventType, MpsPreflightLifecycleState> = {
  checkout_created: 'awaiting_payment',
  payment_confirmed: 'paid',
  submission_accepted: 'submission_accepted',
  processing_started: 'processing',
  private_delivery_ready: 'delivered',
  acknowledgement_recorded: 'acknowledged',
  processing_failed: 'processing_failed',
  delivery_failed: 'delivery_failed',
  refund_recorded: 'refunded',
}

function lifecycleBody(lifecycle: Omit<MpsPreflightLifecycle, 'lifecycleSha256'>) {
  return {
    schemaVersion: lifecycle.schemaVersion,
    synthetic: lifecycle.synthetic,
    orderSha256: lifecycle.orderSha256,
    state: lifecycle.state,
    events: lifecycle.events,
  }
}

function finish(lifecycle: Omit<MpsPreflightLifecycle, 'lifecycleSha256'>): MpsPreflightLifecycle {
  return { ...lifecycle, lifecycleSha256: provenanceDigest(lifecycleBody(lifecycle)) }
}

export function createMpsPreflightLifecycle(orderSha256: string, synthetic = false): MpsPreflightLifecycle {
  if (!SHA256.test(orderSha256)) throw new Error('orderSha256 is invalid.')
  return finish({ schemaVersion: MPS_PREFLIGHT_LIFECYCLE_VERSION, synthetic, orderSha256, state: 'not_started', events: [] })
}

export function applyMpsPreflightLifecycleEvent(
  current: MpsPreflightLifecycle,
  event: MpsPreflightLifecycleEvent,
): MpsPreflightTransitionResult {
  if (verifyMpsPreflightLifecycle(current).length) throw new Error('Current lifecycle is invalid.')
  if (!EVENT_ID.test(event.eventId) || !UTC_SECONDS.test(event.occurredAt) || !SHA256.test(event.payloadSha256)) {
    throw new Error('Lifecycle event is invalid.')
  }
  const existing = current.events.find((candidate) => candidate.eventId === event.eventId)
  if (existing) {
    if (provenanceDigest(existing) !== provenanceDigest(event)) throw new Error('Lifecycle event replay conflicts with the recorded event.')
    return { operation: 'idempotent', lifecycle: current }
  }
  if (!transitions[event.type].includes(current.state)) {
    throw new Error(`Lifecycle transition ${current.state} -> ${event.type} is not permitted.`)
  }
  const lifecycle = finish({
    schemaVersion: current.schemaVersion,
    synthetic: current.synthetic,
    orderSha256: current.orderSha256,
    state: resultingState[event.type],
    events: [...current.events, event],
  })
  return { operation: 'applied', lifecycle }
}

export function verifyMpsPreflightLifecycle(lifecycle: MpsPreflightLifecycle): string[] {
  const findings: string[] = []
  if (lifecycle.schemaVersion !== MPS_PREFLIGHT_LIFECYCLE_VERSION) findings.push('schema-version-mismatch')
  if (!SHA256.test(lifecycle.orderSha256)) findings.push('order-digest-invalid')
  if (lifecycle.lifecycleSha256 !== provenanceDigest(lifecycleBody(lifecycle))) findings.push('lifecycle-digest-mismatch')
  const ids = lifecycle.events.map((event) => event.eventId)
  if (new Set(ids).size !== ids.length) findings.push('event-id-duplicate')
  let derivedState: MpsPreflightLifecycleState = 'not_started'
  let previousTime = ''
  lifecycle.events.forEach((event, index) => {
    if (!EVENT_ID.test(event.eventId) || !UTC_SECONDS.test(event.occurredAt) || !SHA256.test(event.payloadSha256)) {
      findings.push(`event-invalid:${index}`)
      return
    }
    if (previousTime && event.occurredAt < previousTime) findings.push(`event-time-reordered:${index}`)
    previousTime = event.occurredAt
    if (!transitions[event.type]?.includes(derivedState)) {
      findings.push(`event-transition-invalid:${index}`)
      return
    }
    derivedState = resultingState[event.type]
  })
  if (derivedState !== lifecycle.state) findings.push('state-mismatch')
  return findings
}

export function mpsPreflightReportSha256(report: unknown): string {
  return provenanceDigest({ schemaVersion: 'maha-mps-preflight-report-binding/1.0', report })
}

export function mpsPreflightAcknowledgementSha256(orderId: string, reportSha256: string): string {
  if (!/^preflight_[a-f0-9]{32}$/.test(orderId) || !SHA256.test(reportSha256)) throw new Error('Acknowledgement target is invalid.')
  return provenanceDigest({ schemaVersion: 'maha-mps-preflight-acknowledgement/1.0', orderId, reportSha256, received: true })
}

export function syntheticLifecycleEvent(
  eventId: string,
  type: MpsPreflightLifecycleEventType,
  occurredAt: string,
  payload: unknown,
): MpsPreflightLifecycleEvent {
  return { eventId, type, occurredAt, payloadSha256: provenanceDigest({ type, payload }) }
}
