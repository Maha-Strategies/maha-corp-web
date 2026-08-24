import { verifyEpistemicFactoryQueueJob } from '@/lib/epistemic-factory-worker'
import { authorizeEpistemicOperations } from '@/lib/epistemic-review'
import {
  claimEpistemicFactoryJobs,
  completeEpistemicFactoryJob,
  createEpistemicPersistenceClient,
  failEpistemicFactoryJob,
} from '@/lib/epistemic-store'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

function json(body: Record<string, unknown>, status: number) {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow, noarchive' } })
}

export async function POST(request: Request) {
  const authorization = authorizeEpistemicOperations(request)
  if (!authorization.authorized || !authorization.actorFingerprint) {
    return json({ error: { code: 'unauthorized', message: 'A valid epistemic-operations bearer token is required.' } }, 401)
  }
  let limit = 10
  if (request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
    try {
      const body = await request.json() as { limit?: unknown }
      if (body.limit !== undefined) limit = Number(body.limit)
    } catch { return json({ error: { code: 'invalid_json', message: 'Request body must be valid JSON.' } }, 400) }
  }
  if (!Number.isInteger(limit) || limit < 1 || limit > 50) return json({ error: { code: 'invalid_request', message: 'limit must be an integer from 1 to 50.' } }, 400)
  const client = createEpistemicPersistenceClient()
  if (!client) return json({ error: { code: 'unavailable', message: 'Epistemic persistence is unavailable.' } }, 503)
  try {
    const jobs = await claimEpistemicFactoryJobs(client, authorization.actorFingerprint, limit)
    const completed: Array<Record<string, unknown>> = []
    const failed: Array<Record<string, unknown>> = []
    for (const job of jobs) {
      try {
        const result = verifyEpistemicFactoryQueueJob(job)
        const persistence = await completeEpistemicFactoryJob(client, job, authorization.actorFingerprint, result)
        completed.push({ jobId: job.jobId, recordId: result.recordId, persistence })
      } catch (cause) {
        const message = cause instanceof Error ? cause.message : 'Factory job validation failed.'
        await failEpistemicFactoryJob(client, job.jobId, authorization.actorFingerprint, { code: 'worker_validation_failed', message })
        failed.push({ jobId: job.jobId, code: 'worker_validation_failed' })
      }
    }
    return json({
      claimed: jobs.length,
      completed,
      failed,
      remainingUnknown: true,
      canonicalReleaseAttempted: false,
      boundary: 'The worker only persists immutable noncanonical draft targets. Empty work is a successful no-op.',
    }, 200)
  } catch (cause) {
    console.error('Epistemic factory worker failed:', cause instanceof Error ? cause.message : 'unknown')
    return json({ error: { code: 'worker_unavailable', message: 'The epistemic factory worker is temporarily unavailable.' } }, 503)
  }
}

export function GET() {
  return new Response(null, { status: 405, headers: { Allow: 'POST', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow, noarchive' } })
}
