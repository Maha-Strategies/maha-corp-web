import { compileContextPack, maxContextPackBytes, parseContextPackRequest } from '@/lib/context-compiler'
import { withSlotRelease } from '@/lib/x402/slot'
import { accessModeFrom, recordContextCompilerUsage } from '@/lib/context-compiler-metering'
import { consumeAdditionalApiCredits } from '@/lib/api-key'
import { isAttributable, resolveTaskAttribution } from '@/lib/agent-task-attribution'
import { recordAgentTaskSpend } from '@/lib/agent-task-spend'
import {
  CREDITS_CHARGED_HEADER,
  MAX_BILLABLE_CREDITS_HEADER,
  buildBillingDisclosure,
  meteredBillingEnabled,
  parseCallerCeiling,
  quoteMeteredCredits,
  type BillingDisclosure,
} from '@/lib/context-compiler-pricing'
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
  let tokensSaved = 0
  let body: Record<string, unknown> | null = null
  if (response.ok) {
    try {
      body = await response.clone().json() as Record<string, unknown>
      const metrics = body?.metrics as Record<string, unknown> | undefined
      inputTokens = Number(metrics?.originalEstimatedTokens ?? 0)
      outputTokens = Number(metrics?.compiledEstimatedTokens ?? 0)
      tokensSaved = Number(metrics?.tokensSaved ?? 0)
    } catch { /* volume is optional; the request count is not */ }
  }
  await recordContextCompilerUsage({ mode, credentialId, status: response.status, inputTokens, outputTokens })

  // Usage billing applies only to the credential path. An x402 caller signed an
  // authorization for an exact amount before the work existed, so there is no
  // honest way to charge it for a saving discovered afterwards -- and no
  // dishonest way either, because EIP-3009 will not settle more than was
  // signed. That path stays flat, and the challenge keeps advertising one price.
  if (!body || mode !== 'api_key' || !credentialId) return response
  return withBilling(response, body, { credentialId, tokensSaved, inputTokens, outputTokens, request })
}

/**
 * Charge for the saving, then tell the caller what it paid.
 *
 * This runs after the pack exists. The work is done and the response is
 * already correct, so a ledger failure here must not withhold it: the caller
 * would have paid for a request it never received. The charge is dropped
 * instead, and the reason is stated in the response rather than hidden, so the
 * gap is visible to whoever reconciles it.
 */
async function withBilling(
  response: Response,
  body: Record<string, unknown>,
  context: { credentialId: string; tokensSaved: number; inputTokens: number; outputTokens: number; request: Request },
): Promise<Response> {
  const enabled = meteredBillingEnabled()
  const quote = quoteMeteredCredits({
    tokensSaved: context.tokensSaved,
    callerCeiling: parseCallerCeiling(context.request.headers.get(MAX_BILLABLE_CREDITS_HEADER)),
  })

  const charge = enabled && quote.meteredCredits > 0
    ? await consumeAdditionalApiCredits(context.credentialId, quote.meteredCredits)
      .catch(() => ({ kind: 'unavailable' as const }))
    : undefined

  const disclosure: BillingDisclosure = buildBillingDisclosure({ quote, enabled, charge })

  // Attribution is out-of-band by construction: it runs after the response
  // body exists, writes nothing the caller waits on, and cannot change what is
  // delivered. A call carrying no task identifier writes no row at all rather
  // than an unallocatable line an invoice cannot use.
  const attribution = resolveTaskAttribution(context.request.headers)
  const tenantId = context.request.headers.get('x-maha-tenant-id')
  if (isAttributable(attribution, tenantId)) {
    await recordAgentTaskSpend({
      tenantId: tenantId!,
      taskId: attribution.taskId!,
      costCenter: attribution.costCenter,
      surface: 'compress',
      // What was taken, not what was quoted.
      creditsCharged: disclosure.flatCredits + disclosure.meteredCredits,
      inputTokens: context.inputTokens,
      outputTokens: context.outputTokens,
      tokensSaved: context.tokensSaved,
    })
  }

  const headers = new Headers(response.headers)
  headers.set(CREDITS_CHARGED_HEADER, String(disclosure.meteredCredits))
  return Response.json({ ...body, billing: disclosure }, { status: response.status, headers })
}

// A paid caller holds a concurrency slot from the moment proxy.ts admits it.
export const POST = withSlotRelease(metered)
