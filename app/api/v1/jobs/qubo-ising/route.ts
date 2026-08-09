/**
 * POST a bounded asynchronous GPU QUBO/Ising heuristic job.
 *
 * BETA, and deliberately undiscoverable. The standalone parallel-replica
 * reference engine has no passing A10G promotion evidence: candidate 9e5be53
 * failed the reviewed 500 ms warm-p95 gate, and the vectorized successor has
 * never been benchmarked. Until it is, this route is withheld from OpenAPI,
 * the agent card, the offers manifest and the LLM manifest, so nothing
 * advertises an engine whose latency and quality are unmeasured.
 *
 * The route still answers for callers who already hold the URL. Withdrawing
 * discovery is reversible; deleting a live customer route is not, and the
 * benchmark that decides the question has not run yet. See
 * docs/qubo-reference-promotion.md.
 */

import { after } from 'next/server'

import { JobValidationError, parseQuboIsingJobRequest } from '@/lib/jobs/contract'
import { dispatchToWorker, enqueueQuboIsingJob, failUndispatchedJob, workerDispatchConfigured } from '@/lib/jobs/queue'
import { quoteJobCredits } from '@/lib/jobs/pricing'
import { jobResponseHeaders, publicJobView } from '@/lib/jobs/provenance'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function json(body: unknown, status: number, headers: Record<string, string> = {}) {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store', ...headers } })
}

function identityFromRequest(request: Request) {
  const keyId = request.headers.get('x-maha-api-key-id')
  return keyId ? { keyId, zeroDataRetention: request.headers.get('x-maha-zero-data-retention') === 'true' } : null
}

export async function POST(request: Request) {
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
    return json({ error: { code: 'unsupported_media_type', message: 'Content-Type must be application/json.' } }, 415)
  }
  const identity = identityFromRequest(request)
  if (!identity) return json({ error: { code: 'api_key_required', message: 'Provide Authorization: Bearer <API_KEY>.' } }, 401)

  let body: unknown
  try { body = await request.json() } catch { return json({ error: { code: 'invalid_json', message: 'Request body must be valid JSON.' } }, 400) }
  let parsed
  try { parsed = parseQuboIsingJobRequest(body) } catch (error) {
    if (error instanceof JobValidationError) return json({ error: { code: error.code, message: error.message } }, 400)
    throw error
  }
  if (!workerDispatchConfigured()) return json({ error: { code: 'worker_unavailable', message: 'GPU job dispatch is not configured. No credits were charged.' } }, 503)

  let outcome
  try {
    outcome = await enqueueQuboIsingJob({
      request: parsed,
      keyId: identity.keyId,
      zeroDataRetention: identity.zeroDataRetention,
      callbackUrl: `${new URL(request.url).origin}/api/v1/jobs/webhook`,
    })
  } catch {
    return json({ error: { code: 'job_enqueue_failed', message: 'The job could not be queued. No credits were charged.' } }, 503)
  }
  if (outcome.kind === 'insufficient_credits') return json({ error: { code: 'credit_balance_depleted', message: `This job requires ${outcome.required} credits.`, requiredCredits: outcome.required } }, 402)
  if (outcome.kind === 'unavailable') return json({ error: { code: 'api_key_service_unavailable', message: 'Credit reservation is temporarily unavailable.' } }, 503)

  const headers = jobResponseHeaders({ zeroDataRetention: identity.zeroDataRetention })
  if (outcome.kind === 'duplicate') return json({ ...publicJobView(outcome.job), idempotentReplay: true }, 200, headers)

  after(async () => {
    if (!await dispatchToWorker(outcome.handoff)) await failUndispatchedJob(outcome.handoff)
  })
  return json({
    ...publicJobView(outcome.job),
    quotedCredits: quoteJobCredits('qubo-ising', parsed.problem.size),
    pollUrl: `/api/v1/jobs/${outcome.job.jobId}`,
  }, 202, headers)
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: { Allow: 'POST, OPTIONS', 'Cache-Control': 'no-store' } })
}
