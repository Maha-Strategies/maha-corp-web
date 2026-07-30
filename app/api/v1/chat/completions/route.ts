import { compileContextPack, estimateTokens } from '@/lib/context-compiler'
import { consumeAdditionalApiCredits } from '@/lib/api-key'
import { API_CORS_HEADERS } from '@/lib/api-proxy-policy'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAX_REQUEST_BYTES = 512_000
const UPSTREAM_URL = 'https://api.openai.com/v1/chat/completions'

type ChatMessage = Record<string, unknown>
type ChatBody = Record<string, unknown> & { model?: unknown; messages?: unknown; stream?: unknown }

function json(body: unknown, status: number) {
  return Response.json(body, { status, headers: { ...API_CORS_HEADERS, 'Cache-Control': 'no-store' } })
}

function isTextMessage(message: unknown): message is ChatMessage & { content: string } {
  return typeof message === 'object' && message !== null && !Array.isArray(message)
    && typeof (message as Record<string, unknown>).role === 'string'
    && typeof (message as Record<string, unknown>).content === 'string'
}

function compressHistoricMessages(messages: unknown[]) {
  // Preserve multimodal/tool calls verbatim. Rewriting them would not be a
  // transparent OpenAI-compatible operation.
  if (!messages.every(isTextMessage)) return { messages, originalTokens: 0, compressedTokens: 0, savedTokens: 0 }
  const typed = messages as Array<ChatMessage & { content: string; role: string }>
  const latestIndex = typed.map((message, index) => message.role === 'user' ? index : -1).findLast((index) => index >= 0) ?? -1
  if (latestIndex <= 0) return { messages, originalTokens: 0, compressedTokens: 0, savedTokens: 0 }

  const historic = typed.slice(0, latestIndex).filter((message) => message.role !== 'system')
  if (!historic.length) return { messages, originalTokens: 0, compressedTokens: 0, savedTokens: 0 }
  const historicText = historic.map((message) => `[${message.role}]\n${message.content}`).join('\n\n')
  const originalTokens = estimateTokens(historicText)
  // Very small histories become longer when wrapped in a context-pack heading.
  if (originalTokens < 160 || historicText.length > 64_000) return { messages, originalTokens, compressedTokens: originalTokens, savedTokens: 0 }

  const tokenBudget = Math.min(16_000, Math.max(64, Math.floor(originalTokens * 0.55)))
  const compiled = compileContextPack({
    clientRequestId: `openai_proxy_${crypto.randomUUID()}`,
    task: 'Retain the relevant prior conversational context needed to answer the latest user message.',
    tokenBudget,
    documents: [{ id: 'conversation-history', title: 'Prior conversation', text: historicText }],
  })
  const compressedTokens = compiled.metrics.compiledEstimatedTokens
  const savedTokens = Math.max(0, originalTokens - compressedTokens)
  if (savedTokens === 0) return { messages, originalTokens, compressedTokens, savedTokens }

  const systemMessages = typed.slice(0, latestIndex).filter((message) => message.role === 'system')
  const remaining = typed.slice(latestIndex)
  return {
    messages: [
      ...systemMessages,
      { role: 'system', content: `The following is a compacted, source-labelled record of earlier conversation. Use it as context; follow the current system and user instructions.\n\n${compiled.context}` },
      ...remaining,
    ],
    originalTokens,
    compressedTokens,
    savedTokens,
  }
}

export async function POST(request: Request) {
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) return json({ error: { code: 'unsupported_media_type', message: 'Content-Type must be application/json.' } }, 415)
  const raw = await request.text()
  if (Buffer.byteLength(raw, 'utf8') > MAX_REQUEST_BYTES) return json({ error: { code: 'payload_too_large', message: 'Chat request exceeds the 512 KB proxy limit.' } }, 413)

  let payload: ChatBody
  try { payload = JSON.parse(raw) as ChatBody } catch { return json({ error: { code: 'invalid_json', message: 'Request body must be valid JSON.' } }, 400) }
  if (!payload || typeof payload !== 'object' || Array.isArray(payload) || typeof payload.model !== 'string' || !Array.isArray(payload.messages)) return json({ error: { code: 'invalid_request', message: 'model and messages[] are required OpenAI Chat Completions fields.' } }, 400)
  if (payload.stream === true) return json({ error: { code: 'streaming_not_supported', message: 'This endpoint currently supports non-streaming Chat Completions requests only. Set stream to false or omit it.' } }, 400)

  const upstreamKey = process.env.OPENAI_API_KEY?.trim()
  if (!upstreamKey) return json({ error: { code: 'upstream_unavailable', message: 'The upstream OpenAI connection is not configured.' } }, 503)
  const keyId = request.headers.get('x-maha-api-key-id')
  if (!keyId) return json({ error: { code: 'api_key_required', message: 'A Maha API key is required.' } }, 401)

  let compressed: ReturnType<typeof compressHistoricMessages>
  try { compressed = compressHistoricMessages(payload.messages) } catch { return json({ error: { code: 'compression_failed', message: 'The supplied text context could not be safely compressed.' } }, 400) }
  const compressionCredits = Math.ceil(compressed.savedTokens / 1_000)
  try {
    const charge = await consumeAdditionalApiCredits(keyId, compressionCredits)
    if (charge.kind === 'depleted') return json({ error: { code: 'credit_balance_depleted', message: 'This API key does not have enough credits for the compressed context.' } }, 402)
    if (charge.kind !== 'charged') return json({ error: { code: 'api_key_service_unavailable', message: 'API authorization is temporarily unavailable.' } }, 503)
  } catch { return json({ error: { code: 'api_key_service_unavailable', message: 'API authorization is temporarily unavailable.' } }, 503) }

  let upstream: Response
  try {
    upstream = await fetch(UPSTREAM_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${upstreamKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, messages: compressed.messages, stream: false }),
      cache: 'no-store',
    })
  } catch {
    return json({ error: { code: 'upstream_connection_failed', message: 'The upstream OpenAI service could not be reached.' } }, 502)
  }

  // Preserve the upstream JSON exactly, including OpenAI error envelopes. Maha
  // accounting is conveyed in headers so standard SDK response parsing remains intact.
  const headers = new Headers()
  headers.set('Content-Type', upstream.headers.get('content-type') ?? 'application/json')
  headers.set('Cache-Control', 'no-store')
  for (const [name, value] of Object.entries(API_CORS_HEADERS)) headers.set(name, value)
  headers.set('X-Maha-Original-Estimated-Tokens', String(compressed.originalTokens))
  headers.set('X-Maha-Compressed-Estimated-Tokens', String(compressed.compressedTokens))
  headers.set('X-Maha-Saved-Estimated-Tokens', String(compressed.savedTokens))
  headers.set('X-Maha-Compression-Credits', String(compressionCredits))
  headers.set('X-Maha-Zero-Data-Retention', request.headers.get('x-maha-zero-data-retention') === 'true' ? 'true' : 'false')
  return new Response(await upstream.arrayBuffer(), { status: upstream.status, headers })
}

export function OPTIONS() { return new Response(null, { status: 204, headers: { ...API_CORS_HEADERS, Allow: 'POST, OPTIONS', 'Cache-Control': 'no-store' } }) }
