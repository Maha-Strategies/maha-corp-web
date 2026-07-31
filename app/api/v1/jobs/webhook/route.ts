/**
 * POST /api/v1/jobs/webhook — GPU worker result receiver.
 *
 * CALLED BY OUR COMPUTE WORKERS, NOT BY CUSTOMERS. It carries no user API key,
 * so `/api/v1/jobs/webhook` is registered in SELF_MANAGED_KEY_ROUTES
 * (lib/api-proxy-policy.ts). Without that entry the middleware would demand a
 * bearer key, reject every callback with 401, and every job would expire.
 *
 * Authentication is HMAC-SHA256 over `<timestamp>.<raw body>`, matching the
 * scheme already used for the Stripe receivers in this codebase.
 */

import { createHmac, timingSafeEqual } from 'node:crypto'

import { JobValidationError, parseWorkerCallback } from '@/lib/jobs/contract'
import { settleJobFromCallback } from '@/lib/jobs/queue'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const SIGNATURE_TOLERANCE_SECONDS = 300

function json(body: unknown, status: number) {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } })
}

/**
 * Verify `X-Maha-Signature: t=<unix>,v1=<hex>`.
 *
 * The timestamp is inside the signed string, so a captured callback cannot be
 * replayed outside the tolerance window with its signature intact. Comparison
 * is constant-time; a plain `===` on a hex digest leaks a byte at a time under
 * a timing attack.
 */
function validSignature(raw: string, header: string | null, secret: string): boolean {
  if (!header) return false
  const timestamp = header.match(/(?:^|,)t=(\d+)(?:,|$)/)?.[1]
  const candidates = [...header.matchAll(/(?:^|,)v1=([^,]+)/g)].map((match) => match[1])
  if (!timestamp || !candidates.length) return false
  if (Math.abs(Date.now() / 1_000 - Number(timestamp)) > SIGNATURE_TOLERANCE_SECONDS) return false

  const expected = createHmac('sha256', secret).update(`${timestamp}.${raw}`).digest('hex')
  return candidates.some((candidate) => {
    const a = Buffer.from(candidate)
    const b = Buffer.from(expected)
    return a.length === b.length && timingSafeEqual(a, b)
  })
}

export async function POST(request: Request) {
  const secret = process.env.MAHA_WORKER_WEBHOOK_SECRET
  if (!secret) return json({ error: { code: 'webhook_not_configured', message: 'Worker webhook secret is not configured.' } }, 503)

  // Read the raw body: the signature covers the exact bytes sent, and
  // re-serializing a parsed object would not reproduce them.
  const raw = await request.text()
  if (!validSignature(raw, request.headers.get('x-maha-signature'), secret)) {
    return json({ error: { code: 'invalid_signature', message: 'The callback signature is missing or invalid.' } }, 401)
  }

  let body: unknown
  try { body = JSON.parse(raw) } catch {
    return json({ error: { code: 'invalid_json', message: 'Callback body must be valid JSON.' } }, 400)
  }

  let callback
  try { callback = parseWorkerCallback(body) } catch (error) {
    if (error instanceof JobValidationError) return json({ error: { code: error.code, message: error.message } }, 400)
    throw error
  }

  const outcome = await settleJobFromCallback(callback)

  switch (outcome.kind) {
    case 'unknown_job':
      // 404, not 500: a callback for an expired or purged job is the worker's
      // cue to stop retrying, not to back off and try again.
      return json({ error: { code: 'job_not_found', message: 'No job with that id is awaiting a result.' } }, 404)

    case 'input_hash_mismatch':
      return json({ error: { code: 'input_hash_mismatch', message: 'The callback inputHash does not match the dispatched problem. The result was discarded.' } }, 409)

    case 'already_terminal':
      // 200 so a duplicate delivery is not retried forever. `applied: false`
      // tells the worker its result was not the one recorded.
      return json({ received: true, applied: false, jobId: outcome.job.jobId, status: outcome.job.status }, 200)

    case 'settled':
      return json({
        received: true,
        applied: true,
        jobId: outcome.job.jobId,
        status: outcome.job.status,
        creditsCharged: outcome.creditsCharged,
        creditsRefunded: outcome.creditsRefunded,
      }, 200)
  }
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: { Allow: 'POST, OPTIONS', 'Cache-Control': 'no-store' } })
}

# Add this at the very bottom of workers/maha_workers.py

@app.local_entrypoint()
def main():
    test_payload = {
        "jobId": "test_job_123",
        "inputHash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        "callbackUrl": "https://httpbin.org/post",
        "problem": {"size": 4}
    }
    print("🚀 Spawning local test job on Modal GPU...")
    run_tensor_opt.remote(test_payload)
    print("✅ Local test execution completed successfully!")