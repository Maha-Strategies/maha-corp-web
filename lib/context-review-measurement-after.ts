import { after } from 'next/server'
import { recordReviewMeasurement } from './context-review-measurement-server'
import type { ReviewChannel, ReviewEvent } from './context-review-measurement'

// Next/Vercel keeps this callback alive after responding. Only enum values enter
// the closure, never the request, document text, report, headers or identifiers.
export function queueReviewMeasurement(event: ReviewEvent, channel: ReviewChannel, transport: 'web' | 'mcp' | 'browser') {
  after(async () => { await recordReviewMeasurement(event, channel, transport) })
}
