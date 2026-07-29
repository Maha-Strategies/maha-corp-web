import { authorizeClientCapability, bearerToken } from '@/lib/agent-client-credentials'
import { createAgentInquiryLedger } from '@/lib/agent-inquiry-ledger'
import { jsonResponse } from '@/lib/agent-inquiries'
import {
  compileContextPack, CONTEXT_COMPILER_CAPABILITY, MAX_CONTEXT_PACK_BYTES,
  parseContextPackRequest,
} from '@/lib/context-compiler'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 15

export async function POST(request: Request) {
  const token = bearerToken(request)
  if (!token) return jsonResponse({ error: { code: 'unauthorized', message: 'A Context Compiler client credential is required.' } }, 401)
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) return jsonResponse({ error: { code: 'unsupported_media_type', message: 'Content-Type must be application/json.' } }, 415)
  const length = Number(request.headers.get('content-length') ?? '0')
  if (Number.isFinite(length) && length > MAX_CONTEXT_PACK_BYTES) return jsonResponse({ error: { code: 'payload_too_large', message: 'Context Pack input exceeds the 128 KB limit.' } }, 413)
  const authorization = await authorizeClientCapability(token, CONTEXT_COMPILER_CAPABILITY)
  if (authorization.kind === 'unavailable') return jsonResponse({ error: { code: 'gateway_unavailable', message: 'The credential registry is unavailable.' } }, 503)
  if (authorization.kind === 'unauthorized') return jsonResponse({ error: { code: 'unauthorized', message: 'A valid Context Compiler client credential is required.' } }, 401)
  if (authorization.kind === 'forbidden') return jsonResponse({ error: { code: 'capability_not_authorized', message: 'This credential is not authorized to compile Context Packs.' } }, 403)
  if (authorization.kind === 'rate_limited') return jsonResponse({ error: { code: 'rate_limited', message: 'Credential request limit reached. Retry after one hour.' } }, 429)

  let result: ReturnType<typeof compileContextPack>
  try {
    const raw = await request.text()
    if (Buffer.byteLength(raw, 'utf8') > MAX_CONTEXT_PACK_BYTES) return jsonResponse({ error: { code: 'payload_too_large', message: 'Context Pack input exceeds the 128 KB limit.' } }, 413)
    result = compileContextPack(parseContextPackRequest(JSON.parse(raw)))
  } catch (caught) {
    return jsonResponse({ error: { code: 'invalid_request', message: caught instanceof Error ? caught.message : 'Invalid Context Pack request.' } }, 400)
  }

  const ledger = createAgentInquiryLedger()
  if (!ledger) return jsonResponse({ error: { code: 'ledger_unavailable', message: 'The Context Pack ledger is unavailable.' } }, 503)
  const { data: existing, error: existingError } = await ledger.from('agent_context_packs')
    .select('input_hash').eq('credential_id', authorization.credentialId).eq('client_request_id', result.clientRequestId).maybeSingle()
  if (existingError) return jsonResponse({ error: { code: 'ledger_unavailable', message: 'The Context Pack ledger could not be read.' } }, 503)
  if (existing && existing.input_hash !== result.inputHash) return jsonResponse({ error: { code: 'idempotency_conflict', message: 'clientRequestId was already used with different inputs.' } }, 409)
  if (!existing) {
    const { error: insertError } = await ledger.from('agent_context_packs').insert({
      public_id: result.packId, client_id: authorization.clientId, credential_id: authorization.credentialId,
      client_request_id: result.clientRequestId, input_hash: result.inputHash, output_hash: result.outputHash,
      source_count: result.metrics.sourceCount, token_budget: result.tokenBudget,
      original_bytes: result.metrics.originalBytes, compiled_bytes: result.metrics.compiledBytes,
      original_estimated_tokens: result.metrics.originalEstimatedTokens, compiled_estimated_tokens: result.metrics.compiledEstimatedTokens,
      estimated_reduction_percent: result.metrics.estimatedReductionPercent, source_coverage_percent: result.metrics.sourceCoveragePercent,
      duplicate_passages_removed: result.metrics.duplicatePassagesRemoved,
    })
    if (insertError?.code === '23505') return jsonResponse({ error: { code: 'idempotency_conflict', message: 'clientRequestId could not be recorded safely. Retry the same request.' } }, 409)
    if (insertError) return jsonResponse({ error: { code: 'ledger_unavailable', message: 'The Context Pack result could not be recorded.' } }, 503)
  }
  return jsonResponse({ ...result, idempotentReplay: Boolean(existing), sourceTextStored: false, compiledContextStored: false }, existing ? 200 : 201)
}

export function OPTIONS() { return new Response(null, { status: 204, headers: { Allow: 'POST, OPTIONS', 'Cache-Control': 'no-store' } }) }
