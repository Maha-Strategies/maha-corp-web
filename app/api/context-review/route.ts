import { readReviewBody } from '@/lib/context-review-http'
import { reviewContextRetention } from '@/lib/context-review'
import { reviewChannel } from '@/lib/context-review-measurement'
import { queueReviewMeasurement } from '@/lib/context-review-measurement-after'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export async function POST(request: Request) {
  const headers = { 'Cache-Control': 'no-store' }
  const origin = request.headers.get('origin')
  if (origin && origin !== new URL(request.url).origin) return Response.json({ error: 'Origin not permitted.' }, { status: 403, headers })
  const channel = reviewChannel(new URL(request.url).searchParams.get('channel') ?? 'web')
  try {
    const report = reviewContextRetention(await readReviewBody(request))
    queueReviewMeasurement('completed', channel, 'web')
    return Response.json(report, { headers })
  } catch (error) {
    queueReviewMeasurement('failed', channel, 'web')
    return Response.json({ error: error instanceof Error ? error.message : 'Review failed.' }, { status: 400, headers })
  }
}
