/** POST a bounded asynchronous GPU SE(3) paired point-cloud registration job. */

import { after } from 'next/server'

import { JobValidationError, parseGeometricRegistrationJobRequest } from '@/lib/jobs/contract'
import { dispatchToWorker, enqueueGeometricRegistrationJob, failUndispatchedJob, workerDispatchConfigured } from '@/lib/jobs/queue'
import { quoteJobCredits } from '@/lib/jobs/pricing'
import { jobResponseHeaders, publicJobView } from '@/lib/jobs/provenance'
import { resolveTaskAttribution, resolveTenantId } from '@/lib/agent-task-attribution'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function json(body: unknown, status: number, headers: Record<string, string> = {}) {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store', ...headers } })
}

export async function POST(request: Request) {
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) return json({ error: { code: 'unsupported_media_type', message: 'Content-Type must be application/json.' } }, 415)
  const keyId = request.headers.get('x-maha-api-key-id')
  if (!keyId) return json({ error: { code: 'api_key_required', message: 'Provide Authorization: Bearer <API_KEY>.' } }, 401)
  let body: unknown
  try { body = await request.json() } catch { return json({ error: { code: 'invalid_json', message: 'Request body must be valid JSON.' } }, 400) }
  let parsed
  try { parsed = parseGeometricRegistrationJobRequest(body) } catch (error) {
    if (error instanceof JobValidationError) return json({ error: { code: error.code, message: error.message } }, 400)
    throw error
  }
  if (!workerDispatchConfigured()) return json({ error: { code: 'worker_unavailable', message: 'GPU job dispatch is not configured. No credits were charged.' } }, 503)
  const zeroDataRetention = request.headers.get('x-maha-zero-data-retention') === 'true'
  // Captured here and carried on the job record: the settlement webhook is
  // where the real charge becomes known, and this request is gone by then.
  const attribution = { ...resolveTaskAttribution(request.headers), tenantId: resolveTenantId(request.headers) }
  let outcome
  try {
    outcome = await enqueueGeometricRegistrationJob({ request: parsed, keyId, zeroDataRetention, attribution, callbackUrl: `${new URL(request.url).origin}/api/v1/jobs/webhook` })
  } catch { return json({ error: { code: 'job_enqueue_failed', message: 'The job could not be queued. No credits were charged.' } }, 503) }
  if (outcome.kind === 'insufficient_credits') return json({ error: { code: 'credit_balance_depleted', message: `This job requires ${outcome.required} credits.`, requiredCredits: outcome.required } }, 402)
  if (outcome.kind === 'unavailable') return json({ error: { code: 'api_key_service_unavailable', message: 'Credit reservation is temporarily unavailable.' } }, 503)
  const headers = jobResponseHeaders({ zeroDataRetention })
  if (outcome.kind === 'duplicate') return json({ ...publicJobView(outcome.job), idempotentReplay: true }, 200, headers)
  after(async () => {
    if (!await dispatchToWorker(outcome.handoff)) await failUndispatchedJob(outcome.handoff)
  })
  return json({ ...publicJobView(outcome.job), quotedCredits: quoteJobCredits('geometric-registration', parsed.problem.sourcePoints.length), pollUrl: `/api/v1/jobs/${outcome.job.jobId}` }, 202, headers)
}

export function OPTIONS() { return new Response(null, { status: 204, headers: { Allow: 'POST, OPTIONS', 'Cache-Control': 'no-store' } }) }
