/**
 * GET /api/v1/jobs/[jobId] — poll job status.
 *
 * Next.js 16: `params` is a Promise and must be awaited.
 */

import { validJobId } from '@/lib/jobs/contract'
import { getJob } from '@/lib/jobs/queue'
import { jobResponseHeaders, publicJobView } from '@/lib/jobs/provenance'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ jobId: string }> }

function json(body: unknown, status: number, headers: Record<string, string> = {}) {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store', ...headers } })
}

/** Suggested client backoff, in seconds, by state. */
const POLL_AFTER: Record<string, number | null> = { queued: 5, processing: 15, completed: null, failed: null, cancelled: null }

export async function GET(request: Request, { params }: Params) {
  const keyId = request.headers.get('x-maha-api-key-id')
  if (!keyId) {
    return json({ error: { code: 'api_key_required', message: 'Provide Authorization: Bearer <API_KEY>.' } }, 401)
  }

  const { jobId } = await params
  if (!validJobId(jobId)) {
    return json({ error: { code: 'invalid_job_id', message: 'The job id is malformed.' } }, 400)
  }

  const job = await getJob(jobId)

  // OWNERSHIP: an unknown job and someone else's job return the identical 404.
  // Distinguishing them would turn this endpoint into an oracle for which job
  // ids exist, and job ids are the only thing standing between a caller and
  // another tenant's optimization results.
  if (!job || job.keyId !== keyId) {
    return json({ error: { code: 'job_not_found', message: 'No job with that id exists for this API key.' } }, 404)
  }

  const headers = jobResponseHeaders({ zeroDataRetention: job.zeroDataRetention })
  const retryAfter = POLL_AFTER[job.status]
  if (retryAfter !== null && retryAfter !== undefined) headers['Retry-After'] = String(retryAfter)

  return json(publicJobView(job), 200, headers)
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: { Allow: 'GET, OPTIONS', 'Cache-Control': 'no-store' } })
}
