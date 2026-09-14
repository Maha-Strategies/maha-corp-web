import { timingSafeEqual } from 'node:crypto'
import { buildJyotishaReading } from './jyotisha-reading.ts'

const headers = { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' }
/** A private pilot. The server supplies the access token; callers cannot submit review approvals. */
export async function handleJyotishaReading(request: Request, token: string | undefined): Promise<Response> {
  if (!token || token.length < 32) return Response.json({ error: 'pilot_unavailable' }, { status: 404, headers })
  const supplied = Buffer.from(request.headers.get('authorization') ?? '')
  const expected = Buffer.from(`Bearer ${token}`)
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
    return Response.json({ error: 'unauthorized' }, { status: 401, headers })
  }
  if (request.method !== 'POST') return Response.json({ error: 'method_not_allowed' }, { status: 405, headers: { ...headers, Allow: 'POST' } })
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
    return Response.json({ error: 'json_required' }, { status: 415, headers })
  }
  const reader = request.body?.getReader()
  if (!reader) return Response.json({ error: 'invalid_request' }, { status: 400, headers })
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > 2048) {
        await reader.cancel()
        return Response.json({ error: 'request_too_large' }, { status: 413, headers })
      }
      chunks.push(value)
    }
    const input = JSON.parse(Buffer.concat(chunks).toString('utf8'))
    return Response.json(buildJyotishaReading(input), { headers })
  } catch {
    return Response.json({ error: 'invalid_or_unsupported_request' }, { status: 400, headers })
  } finally { reader.releaseLock() }
}
