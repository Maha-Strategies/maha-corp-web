export const REVIEW_CHANNELS = ['web', 'chatgpt', 'claude', 'registry', 'mcp', 'unknown'] as const
export type ReviewChannel = typeof REVIEW_CHANNELS[number]
export const REVIEW_CLIENT_EVENTS = ['view', 'export', 'pilot_cta'] as const
export type ReviewClientEvent = typeof REVIEW_CLIENT_EVENTS[number]
export type ReviewEvent = ReviewClientEvent | 'completed' | 'failed'

export function reviewChannel(value: unknown): ReviewChannel {
  return REVIEW_CHANNELS.includes(value as ReviewChannel) ? value as ReviewChannel : 'unknown'
}

export function parseReviewClientEvent(value: unknown): { event: ReviewClientEvent; channel: ReviewChannel } {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid measurement.')
  const input = value as Record<string, unknown>
  if (Object.keys(input).some(key => !['event', 'channel'].includes(key))) throw new Error('Only event and channel are accepted.')
  if (!REVIEW_CLIENT_EVENTS.includes(input.event as ReviewClientEvent)) throw new Error('Unsupported event.')
  if (!REVIEW_CHANNELS.includes(input.channel as ReviewChannel)) throw new Error('Unsupported channel.')
  return { event: input.event as ReviewClientEvent, channel: input.channel as ReviewChannel }
}

export function reviewCounterField(event: ReviewEvent, channel: ReviewChannel, transport: 'web' | 'mcp' | 'browser') {
  // Transport is server-observed; channel is caller-declared, not authenticated.
  return `${transport}:${channel}:${event}`
}
