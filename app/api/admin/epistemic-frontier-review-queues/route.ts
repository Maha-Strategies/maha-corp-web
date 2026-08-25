import { activeEpistemicReleases } from '@/lib/epistemic-release'
import { authorizeEpistemicOperations } from '@/lib/epistemic-review'
import { buildFrontierReviewQueues } from '@/lib/frontier-review-queue'
import {
  createEpistemicPersistenceClient,
  listEpistemicCanonicalReleases,
  listEpistemicExpertReviews,
  listEpistemicReleaseWithdrawals,
  listEpistemicReviewTargets,
  listFrontierSourceVerificationReports,
} from '@/lib/epistemic-store'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function json(body: Record<string, unknown>, status: number) {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } })
}

export async function GET(request: Request) {
  const authorization = authorizeEpistemicOperations(request)
  if (!authorization.authorized) return json({ error: { code: 'unauthorized', message: 'A valid epistemic-operations bearer token is required.' } }, 401)
  const client = createEpistemicPersistenceClient()
  if (!client) return json({ error: { code: 'frontier_queues_unavailable', message: 'Frontier review queues are temporarily unavailable.' } }, 503)
  try {
    const [targets, reviews, reports, releases, withdrawals] = await Promise.all([
      listEpistemicReviewTargets(client),
      listEpistemicExpertReviews(client),
      listFrontierSourceVerificationReports(client),
      listEpistemicCanonicalReleases(client),
      listEpistemicReleaseWithdrawals(client),
    ])
    const activeIds = new Set(activeEpistemicReleases(releases, withdrawals).map((release) => release.recordId))
    return json(buildFrontierReviewQueues(targets, reviews, reports[0] ?? null, activeIds), 200)
  } catch {
    return json({ error: { code: 'frontier_queues_unavailable', message: 'Frontier review queues are temporarily unavailable.' } }, 503)
  }
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: { Allow: 'GET, OPTIONS', 'Cache-Control': 'no-store' } })
}
