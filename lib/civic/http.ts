import { z } from 'zod'

export class CivicHttpError extends Error {
  status: number
  constructor(message: string, status: number) { super(message); this.status = status }
}
/** Bound the stream itself, including chunked requests without Content-Length. */
export async function readCivicJson(request: Request, maxBytes: number): Promise<unknown> {
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) throw new CivicHttpError('Use application/json.', 415)
  const contentLength = request.headers.get('content-length')
  if (contentLength && (!/^\d+$/.test(contentLength) || Number(contentLength) > maxBytes)) throw new CivicHttpError('Request too large.', 413)
  if (!request.body) throw new CivicHttpError('Request body is required.', 400)
  const reader = request.body.getReader(), chunks: Uint8Array[] = []
  let size = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > maxBytes) { await reader.cancel(); throw new CivicHttpError('Request too large.', 413) }
      chunks.push(value)
    }
    return JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } finally { reader.releaseLock() }
}
export function civicResponse(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } })
}
export function civicInputError(error: unknown) {
  if (error instanceof CivicHttpError) return civicResponse({ error: error.message }, error.status)
  if (error instanceof z.ZodError) return civicResponse({ error: 'Invalid civic input.', issues: error.issues.map(i => ({ path: i.path, message: i.message })) }, 400)
  return civicResponse({ error: error instanceof SyntaxError ? 'Malformed JSON.' : error instanceof Error ? error.message : 'Invalid civic input.' }, 400)
}
