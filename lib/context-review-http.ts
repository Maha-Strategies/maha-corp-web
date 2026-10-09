import { CONTEXT_REVIEW_MAX_BYTES, CONTEXT_REVIEW_TOOL, reviewContextRetention } from './context-review.ts'
import { reviewChannel, type ReviewChannel, type ReviewEvent } from './context-review-measurement.ts'
import { recordReviewMeasurement } from './context-review-measurement-server.ts'

const versions = ['2025-03-26', '2025-06-18', '2025-11-25']
const headers = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }
export async function readReviewBody(request: Request, maxBytes = CONTEXT_REVIEW_MAX_BYTES) {
  const sizeError = maxBytes === CONTEXT_REVIEW_MAX_BYTES ? 'Request exceeds 64 KiB.' : 'Request exceeds size limit.'
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) throw new Error('Use application/json.')
  if (Number(request.headers.get('content-length')) > maxBytes) throw new Error(sizeError)
  // Bound reads as they arrive, rather than allocating an unbounded request.text().
  const reader = request.body?.getReader()
  if (!reader) throw new Error('Request body is required.')
  let size = 0
  const chunks: Uint8Array[] = []
  try {
    for (;;) {
      const next = await reader.read()
      if (next.done) break
      size += next.value.byteLength
      if (size > maxBytes) { await reader.cancel(); throw new Error(sizeError) }
      chunks.push(next.value)
    }
  } finally { reader.releaseLock() }
  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown
}

type ReviewMeasurement = (event: ReviewEvent, channel: ReviewChannel, transport: 'web' | 'mcp' | 'browser') => void | Promise<unknown>
export async function contextReviewMcp(request: Request, measure: ReviewMeasurement = recordReviewMeasurement) {
  const json = (body: object, status = 200) => Response.json(body, { status, headers })
  let id: string | number | null = null
  const fail = (code: number, message: string, status = 200) => json({ jsonrpc: '2.0', id, error: { code, message } }, status)
  const origin = request.headers.get('origin')
  // This public computation handles only explicitly supplied snippets. No account data/credentials.
  if (origin && !['https://www.mahastrategies.com', 'https://mahastrategies.com', 'https://chatgpt.com', 'https://claude.ai'].includes(origin)) return fail(-32600, 'Origin not permitted.', 403)
  let message: Record<string, unknown>
  try {
    const body = await readReviewBody(request)
    if (!body || typeof body !== 'object' || Array.isArray(body)) return fail(-32600, 'Invalid JSON-RPC envelope.', 400)
    message = body as Record<string, unknown>
  } catch { return fail(-32700, 'Invalid JSON or request exceeds 64 KiB.', 400) }
  if (message.jsonrpc !== '2.0' || typeof message.method !== 'string') return fail(-32600, 'Invalid JSON-RPC envelope.', 400)
  if (message.id !== undefined && typeof message.id !== 'string' && typeof message.id !== 'number') return fail(-32600, 'Invalid request ID.', 400)
  if (message.id === undefined) return new Response(null, { status: 202, headers })
  id = message.id as string | number
  const params = message.params as Record<string, unknown> | undefined
  const version = request.headers.get('mcp-protocol-version')
  if (version && !versions.includes(version)) return fail(-32600, 'Unsupported protocol version.', 400)
  const result = (value: object) => json({ jsonrpc: '2.0', id, result: value })
  if (message.method === 'initialize') {
    const requested = params?.protocolVersion
    return result({ protocolVersion: typeof requested === 'string' && versions.includes(requested) ? requested : versions.at(-1), capabilities: { tools: { listChanged: false } }, serverInfo: { name: 'maha-context-review', version: '1.0.2' } })
  }
  if (message.method === 'ping') return result({})
  if (message.method === 'tools/list') return result({ tools: [CONTEXT_REVIEW_TOOL] })
  if (message.method !== 'tools/call') return fail(-32601, 'Method not found.')
  if (params?.name !== CONTEXT_REVIEW_TOOL.name) return fail(-32602, 'Unknown tool.')
  const channel = reviewChannel(new URL(request.url).searchParams.get('channel') ?? 'mcp')
  try {
    const report = reviewContextRetention(params.arguments)
    await measure('completed', channel, 'mcp')
    return result({ content: [{ type: 'text', text: JSON.stringify(report) }], structuredContent: report, isError: false })
  } catch (error) {
    await measure('failed', channel, 'mcp')
    return result({ content: [{ type: 'text', text: error instanceof Error ? error.message : 'Review failed.' }], isError: true })
  }
}
