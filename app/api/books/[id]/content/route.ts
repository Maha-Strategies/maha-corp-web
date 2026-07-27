import { authorizeBookEntitlement, bearerToken } from '@/lib/agent-client-credentials'
import { jsonResponse } from '@/lib/agent-inquiries'
import { isKnownBook } from '@/lib/books'
import { recordCommercialApiUsage } from '@/lib/commercial-api-metering'
import { readBookAst } from '@/lib/content'
import { createAgentInquiryLedger } from '@/lib/agent-inquiry-ledger'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// The structured AST is the paid payload. The same text is free to read on the
// public web page; only this machine-readable, chunk-addressable form is gated
// behind a book entitlement. (Route param is `id` to match the sibling
// [id]/entitlement route — Next.js forbids differing sibling slug names.)
export async function GET(request: Request, context: RouteContext<'/api/books/[id]/content'>) {
  const { id } = await context.params
  if (typeof id !== 'string' || !isKnownBook(id)) {
    return jsonResponse({ error: { code: 'book_not_found', message: 'No such book.' } }, 404)
  }

  const token = bearerToken(request)
  if (!token) {
    return jsonResponse({ error: { code: 'unauthorized', message: 'A valid client credential is required.' } }, 401)
  }

  const authorization = await authorizeBookEntitlement(token, id)
  if (authorization.kind === 'unavailable') {
    return jsonResponse({ error: { code: 'gateway_unavailable', message: 'The entitlement registry is not available.' } }, 503)
  }
  if (authorization.kind === 'unauthorized') {
    return jsonResponse({ error: { code: 'unauthorized', message: 'A valid client credential is required.' } }, 401)
  }
  if (authorization.kind === 'not_entitled') {
    return jsonResponse({ error: { code: 'not_entitled', message: 'This credential has not purchased this book.' } }, 403)
  }

  const ast = readBookAst(id)
  if (!ast) {
    return jsonResponse({ error: { code: 'content_unavailable', message: 'Structured content is not available for this book yet.' } }, 404)
  }
  const ledger = createAgentInquiryLedger()
  if (ledger) await recordCommercialApiUsage(ledger, { credentialId: authorization.credentialId, operation: 'book_content', statusCode: 200 })
  return jsonResponse({ book: ast.slug, title: ast.title, chunkCount: ast.chunkCount, chunks: ast.chunks }, 200)
}
