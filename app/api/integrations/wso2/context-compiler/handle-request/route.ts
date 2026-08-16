import { handleWso2ContextRequest } from '@/lib/integrations/wso2-context-interceptor'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 15

const MAX_INTERCEPTOR_ENVELOPE_BYTES = 750_000

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(request: Request) {
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
    return json({ error: { code: 'unsupported_media_type', message: 'Content-Type must be application/json.' } }, 415)
  }

  const declaredLength = Number(request.headers.get('content-length') ?? '0')
  if (Number.isFinite(declaredLength) && declaredLength > MAX_INTERCEPTOR_ENVELOPE_BYTES) {
    return json({ error: { code: 'payload_too_large', message: 'The WSO2 interceptor envelope exceeds 750 KB.' } }, 413)
  }

  const raw = await request.text()
  if (Buffer.byteLength(raw, 'utf8') > MAX_INTERCEPTOR_ENVELOPE_BYTES) {
    return json({ error: { code: 'payload_too_large', message: 'The WSO2 interceptor envelope exceeds 750 KB.' } }, 413)
  }

  let body: unknown
  try { body = JSON.parse(raw) }
  catch { return json({ error: { code: 'invalid_json', message: 'Request body must be valid JSON.' } }, 400) }

  return json(handleWso2ContextRequest(body, process.env.WSO2_CONTEXT_INTERCEPTOR_SECRET))
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: { Allow: 'POST, OPTIONS', 'Cache-Control': 'no-store' } })
}
