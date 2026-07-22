export const CONVERSION_EVENT_TYPES = ['cta_click', 'inquiry_submitted'] as const
export type PublicConversionEventType = (typeof CONVERSION_EVENT_TYPES)[number]

export type PublicConversionEvent = {
  eventId: string
  eventName: string
  eventType: PublicConversionEventType
  experimentId: string | null
  sourcePath: string
}

export type ConversionMeasurement = {
  experiment_id: string | null
  event_type: string
  source_kind: string
}

export type ConversionSummary = {
  ctaClicks: number
  inquiries: number
  checkoutStarts: number
  paidConversions: number
  unverifiedClientSignals: number
}

const EVENT_ID = /^conv_[a-z0-9-]{16,80}$/
const EVENT_NAME = /^[a-z][a-z0-9_]{2,79}$/
const EXPERIMENT_ID = /^experiment_[a-f0-9]{32}$/

export function validExperimentId(value: unknown): value is string {
  return typeof value === 'string' && EXPERIMENT_ID.test(value)
}

export function validSourcePath(value: unknown): value is string {
  return typeof value === 'string'
    && value.length >= 1
    && value.length <= 300
    && value.startsWith('/')
    && !value.includes('?')
    && !value.includes('#')
    && !value.includes('..')
    && !/[\r\n]/.test(value)
}

export function parsePublicConversionEvent(value: unknown): PublicConversionEvent {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error('Request body must be a JSON object.')
  const input = value as Record<string, unknown>
  if (typeof input.eventId !== 'string' || !EVENT_ID.test(input.eventId)) throw new Error('eventId is invalid.')
  if (typeof input.eventName !== 'string' || !EVENT_NAME.test(input.eventName)) throw new Error('eventName is invalid.')
  if (!CONVERSION_EVENT_TYPES.includes(input.eventType as PublicConversionEventType)) throw new Error('eventType is invalid.')
  if (input.experimentId !== undefined && input.experimentId !== null && !validExperimentId(input.experimentId)) throw new Error('experimentId is invalid.')
  if (!validSourcePath(input.sourcePath)) throw new Error('sourcePath is invalid.')
  return {
    eventId: input.eventId,
    eventName: input.eventName,
    eventType: input.eventType as PublicConversionEventType,
    experimentId: input.experimentId ?? null,
    sourcePath: input.sourcePath,
  }
}

export function aggregateConversionMeasurements(rows: ConversionMeasurement[]) {
  const blank = (): ConversionSummary => ({ ctaClicks: 0, inquiries: 0, checkoutStarts: 0, paidConversions: 0, unverifiedClientSignals: 0 })
  const byExperiment: Record<string, ConversionSummary> = {}
  const unattributed = blank()
  for (const row of rows) {
    const target = row.experiment_id ? (byExperiment[row.experiment_id] ??= blank()) : unattributed
    if (row.event_type === 'cta_click') target.ctaClicks += 1
    if (row.event_type === 'inquiry_submitted') target.inquiries += 1
    if (row.event_type === 'checkout_started') target.checkoutStarts += 1
    if (row.event_type === 'paid_conversion') target.paidConversions += 1
    if (row.source_kind === 'client_unverified') target.unverifiedClientSignals += 1
  }
  return { byExperiment, unattributed }
}
