import { contextReviewMcp } from '@/lib/context-review-http'
import { queueReviewMeasurement } from '@/lib/context-review-measurement-after'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 15
export function POST(request: Request) { return contextReviewMcp(request, queueReviewMeasurement) }
export function GET() { return new Response(null, { status: 405, headers: { Allow: 'POST', 'Cache-Control': 'no-store' } }) }
