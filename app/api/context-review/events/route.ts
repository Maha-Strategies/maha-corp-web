import { readReviewBody } from '@/lib/context-review-http'
import { parseReviewClientEvent } from '@/lib/context-review-measurement'
import { queueReviewMeasurement } from '@/lib/context-review-measurement-after'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export async function POST(request: Request) {
  const headers = { 'Cache-Control': 'no-store' }
  if (request.headers.get('origin') !== new URL(request.url).origin) return Response.json({ accepted: false }, { status: 403, headers })
  try {
    const input = parseReviewClientEvent(await readReviewBody(request, 512))
    queueReviewMeasurement(input.event, input.channel, 'browser')
    return Response.json({ accepted: true, storage: 'queued_best_effort', verification: 'client_unverified' }, { status: 202, headers })
  } catch { return Response.json({ accepted: false }, { status: 400, headers }) }
}
