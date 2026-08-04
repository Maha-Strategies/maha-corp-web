/**
 * POST /api/v1/jobs/tensor-opt — enqueue a GPU-native QUBO/Ising optimization.
 *
 * AUTHORIZATION happens in proxy.ts, which matches /api/v1/:path*, validates the
 * bearer key, consumes one request unit, and forwards the identity as request
 * headers. This handler therefore reads `x-maha-api-key-id` rather than
 * re-authenticating — but it does NOT trust the header blindly: see the note on
 * `identityFromRequest` below.
 *
 * The response is 202 with a job id. Nothing is computed here; the GPU handoff
 * runs in `after()` so a slow worker control plane cannot delay the accept.
 */

import { after } from 'next/server'

import { JobValidationError, parseTensorOptJobRequest } from '@/lib/jobs/contract'
import { dispatchToWorker, enqueueTensorOptJob } from '@/lib/jobs/queue'
import { quoteJobCredits } from '@/lib/jobs/pricing'
import { jobResponseHeaders, publicJobView } from '@/lib/jobs/provenance'
import { releaseHeldSlot, slotFromRequest } from '@/lib/x402/slot'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function json(body: unknown, status: number, headers: Record<string, string> = {}) {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store', ...headers } })
}

/**
 * Identity injected by the middleware.
 *
 * `NextResponse.next({ request: { headers } })` sets these on the inbound
 * request, and Vercel strips client-supplied `x-maha-*` headers at the proxy
 * boundary — but only for paths the middleware matches. If this route is ever
 * moved out from under `/api/v1/`, the matcher stops covering it and these
 * headers become client-controlled, which is an authentication bypass. The
 * absence check below fails closed rather than defaulting to an anonymous key.
 */
function identityFromRequest(request: Request) {
  const keyId = request.headers.get('x-maha-api-key-id')
  if (!keyId) return null
  return {
    keyId,
    tier: request.headers.get('x-maha-api-key-tier') ?? 'starter',
    zeroDataRetention: request.headers.get('x-maha-zero-data-retention') === 'true',
    creditsRemaining: Number(request.headers.get('x-maha-credits-remaining')),
  }
}

function callbackUrl(request: Request) {
  // Derived from the deployment's own origin so a preview deployment tells the
  // worker to call the preview back, not production.
  const configured = process.env.MAHA_PUBLIC_ORIGIN
  const origin = configured ?? new URL(request.url).origin
  return `${origin}/api/v1/jobs/webhook`
}

export async function POST(request: Request) {
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
    return json({ error: { code: 'unsupported_media_type', message: 'Content-Type must be application/json.' } }, 415)
  }

  const slot = slotFromRequest(request)

  const identity = identityFromRequest(request)
  if (!identity) {
    // A paid caller reaching here has already settled, and a job needs a key to
    // reserve credits against. Rather than answer a settled payment with a
    // confusing 401, say what happened and free the capacity slot the payment
    // bought. The real fix is upstream: do not list an async job path in
    // X402_RESOURCES until paid callers have a job identity.
    if (slot) {
      await releaseHeldSlot(slot)
      return json({ error: { code: 'paid_jobs_unavailable', message: 'This endpoint does not yet accept machine payment. The payment settled and no job was started; contact support@mahastrategies.com for a refund.' } }, 501)
    }
    return json({ error: { code: 'api_key_required', message: 'Provide Authorization: Bearer <API_KEY>.', href: '/tools/token-calc' } }, 401)
  }

  let body: unknown
  try { body = await request.json() } catch {
    return json({ error: { code: 'invalid_json', message: 'Request body must be valid JSON.' } }, 400)
  }

  let parsed
  try { parsed = parseTensorOptJobRequest(body) } catch (error) {
    if (error instanceof JobValidationError) return json({ error: { code: error.code, message: error.message } }, 400)
    throw error
  }

  let outcome
  try {
    outcome = await enqueueTensorOptJob({
      request: parsed,
      keyId: identity.keyId,
      zeroDataRetention: identity.zeroDataRetention,
      callbackUrl: callbackUrl(request),
      // A paid caller holds a capacity slot acquired in proxy.ts. It is stored
      // on the job rather than released here, because this handler returns as
      // soon as the job is dispatched and the GPU runs long after.
      slot,
    })
  } catch {
    // No job exists to release the slot later, so release it here.
    await releaseHeldSlot(slot)
    return json({ error: { code: 'job_enqueue_failed', message: 'The job could not be queued. No credits were charged.' } }, 503)
  }

  // Every outcome except `queued` means no GPU work will run under this slot.
  // `duplicate` included: the original job holds its own slot and settles it.
  if (outcome.kind !== 'queued') await releaseHeldSlot(slot)

  if (outcome.kind === 'insufficient_credits') {
    return json({
      error: {
        code: 'credit_balance_depleted',
        message: `This job requires ${outcome.required} credits, which exceeds the remaining balance.`,
        requiredCredits: outcome.required,
      },
    }, 402)
  }

  if (outcome.kind === 'unavailable') {
    return json({ error: { code: 'api_key_service_unavailable', message: 'Credit reservation is temporarily unavailable.' } }, 503)
  }

  const headers = jobResponseHeaders({ zeroDataRetention: identity.zeroDataRetention })

  // A replayed clientRequestId returns the original job, unchanged and
  // uncharged. 200 rather than 202 so a client can tell the difference.
  if (outcome.kind === 'duplicate') {
    return json({ ...publicJobView(outcome.job), idempotentReplay: true }, 200, headers)
  }

  // Handoff after the response. A dispatch failure leaves the job `queued` for
  // the reclaim sweep rather than failing a request the customer was already
  // told succeeded.
  after(async () => { await dispatchToWorker(outcome.handoff) })

  return json({
    ...publicJobView(outcome.job),
    status: 'queued',
    quotedCredits: quoteJobCredits('tensor-opt', parsed.problem.size),
    pollUrl: `/api/v1/jobs/${outcome.job.jobId}`,
  }, 202, headers)
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: { Allow: 'POST, OPTIONS', 'Cache-Control': 'no-store' } })
}
