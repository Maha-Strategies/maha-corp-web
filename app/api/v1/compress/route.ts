import { compileContextPack, maxContextPackBytes, parseContextPackRequest } from '@/lib/context-compiler'
import { withSlotRelease } from '@/lib/x402/slot'
import { accessModeFrom, recordContextCompilerUsage } from '@/lib/context-compiler-metering'
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
const handler = async (request: Request) => { if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) return Response.json({ error: { code: 'unsupported_media_type', message: 'Content-Type must be application/json.' } }, { status: 415 }); const raw = await request.text(); const limit = maxContextPackBytes(request.headers.get('x-maha-api-key-tier')); if (Buffer.byteLength(raw, 'utf8') > limit) return Response.json({ error: { code: 'payload_too_large', message: `Context input exceeds ${Math.round(limit / 1_000)} KB for this tier. The enterprise tier accepts larger payloads.` } }, { status: 413 }); try { const result = compileContextPack(parseContextPackRequest(JSON.parse(raw))); return Response.json({ ...result, sourceTextStored: false, compiledContextStored: false }, { status: 201, headers: { 'Cache-Control': 'no-store' } }) } catch (error) { return Response.json({ error: { code: 'invalid_request', message: error instanceof Error ? error.message : 'Invalid compression request.' } }, { status: 400 }) } }

// A paid caller holds a concurrency slot from the moment proxy.ts admits it.
// The work is done by the time this returns, so the slot is freed here rather
// than left to lapse on its TTL and refuse the next caller for no reason.
// Metering wraps the handler rather than living inside it, so the 415 and 413
// rejections are counted too -- an activation that fails on payload size is
// exactly the signal the funnel needs, and it never reaches the body of the
// handler. Runs after the response exists and cannot change it.
const metered = async (request: Request): Promise<Response> => {
  const response = await handler(request)
  const { mode, credentialId } = accessModeFrom(request.headers)
  let inputTokens = 0
  let outputTokens = 0
  if (response.ok) {
    try {
      const metrics = (await response.clone().json())?.metrics
      inputTokens = Number(metrics?.originalEstimatedTokens ?? 0)
      outputTokens = Number(metrics?.compiledEstimatedTokens ?? 0)
    } catch { /* volume is optional; the request count is not */ }
  }
  await recordContextCompilerUsage({ mode, credentialId, status: response.status, inputTokens, outputTokens })
  return response
}

// A paid caller holds a concurrency slot from the moment proxy.ts admits it.
export const POST = withSlotRelease(metered)
