import {
  MAX_X402_EVALUATION_BYTES,
  buildDeepContextEvaluation,
  parseDeepContextRequest,
} from '@/lib/deep-context-evaluation'
import { withSlotRelease } from '@/lib/x402/slot'
import { DEEP_CONTEXT_EVALUATION_OFFER } from '@/lib/x402/offers'
import { discoverySourceFrom, recordOfferUsage } from '@/lib/x402/offer-telemetry'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 30

// Deep Context Evaluation. Compiles a context pack and reports exact retention
// of the caller's own labelled evidence spans.
//
// This route is reachable two ways and behaves identically on both: an x402
// payment admitted by proxy.ts, or an API key consumed by proxy.ts. It never
// checks credentials itself -- the proxy is the only authorization boundary,
// and a paid request arrives here already authorized, which is why there is no
// bearer-token branch below to accidentally reject one.

const handler = async (request: Request): Promise<Response> => {
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
    return Response.json({ error: { code: 'unsupported_media_type', message: 'Content-Type must be application/json.' } }, { status: 415 })
  }

  // Read the body before parsing it, and measure the bytes we actually
  // received rather than trusting Content-Length. A caller that understates
  // the header would otherwise get the large-payload path for free.
  const raw = await request.text()
  if (Buffer.byteLength(raw, 'utf8') > MAX_X402_EVALUATION_BYTES) {
    return Response.json({
      error: {
        code: 'payload_too_large',
        message: `Evaluation input exceeds the ${MAX_X402_EVALUATION_BYTES.toLocaleString('en-US')} byte limit for this offer.`,
      },
    }, { status: 413 })
  }

  try {
    const result = buildDeepContextEvaluation(parseDeepContextRequest(JSON.parse(raw)))
    return Response.json(result, { status: 201, headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    return Response.json({
      error: { code: 'invalid_request', message: error instanceof Error ? error.message : 'Invalid evaluation request.' },
    }, { status: 400 })
  }
}

/**
 * Counts the invocation, and nothing about its contents.
 *
 * Wraps the handler rather than living inside it so the 415 and 413 rejections
 * are counted too: an activation that fails on payload size is exactly the
 * signal the funnel needs, and it never reaches the body of the handler. Runs
 * after the response exists and cannot change it.
 *
 * Only invocations are recorded here. The 402 challenge for this offer
 * terminates in proxy.ts and is recorded there; writing both from one place
 * is what would double-count, so the two never meet.
 */
const metered = async (request: Request): Promise<Response> => {
  const response = await handler(request)

  let inputTokens = 0
  let outputTokens = 0
  let tokensSaved = 0
  let requiredEvidenceCount = 0
  let retainedEvidenceCount = 0
  if (response.ok) {
    try {
      const body = await response.clone().json() as Record<string, unknown>
      const metrics = body?.metrics as Record<string, unknown> | undefined
      inputTokens = Number(metrics?.originalEstimatedTokens ?? 0)
      outputTokens = Number(metrics?.compiledEstimatedTokens ?? 0)
      tokensSaved = Number(metrics?.tokensSaved ?? 0)
      requiredEvidenceCount = Number(metrics?.requiredEvidenceCount ?? 0)
      retainedEvidenceCount = Number(metrics?.retainedEvidenceCount ?? 0)
    } catch {
      // Volume is optional; the request count is not.
    }
  }

  await recordOfferUsage({
    offerId: DEEP_CONTEXT_EVALUATION_OFFER.id,
    eventKind: 'invocation',
    status: response.status,
    discoverySource: discoverySourceFrom(request.headers),
    inputTokens,
    outputTokens,
    tokensSaved,
    requiredEvidenceCount,
    retainedEvidenceCount,
  })

  return response
}

// A paid caller holds a concurrency slot from the moment proxy.ts admits it.
// The work is done by the time this returns, so the slot is freed here rather
// than left to lapse on its TTL and refuse the next caller for no reason. The
// release is in a `finally`, so a validation failure and a thrown handler free
// capacity exactly as a success does.
export const POST = withSlotRelease(metered)

export function OPTIONS() {
  return new Response(null, { status: 204, headers: { Allow: 'POST, OPTIONS', 'Cache-Control': 'no-store' } })
}
