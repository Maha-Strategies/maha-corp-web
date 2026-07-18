import { authorizeBookEntitlement, bearerToken } from '@/lib/agent-client-credentials'
import { jsonResponse } from '@/lib/agent-inquiries'
import { bookTitle, isKnownBook } from '@/lib/books'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: Request, context: RouteContext<'/api/books/[id]/entitlement'>) {
  const { id } = await context.params
  // Unknown-or-malformed slug answers 404 without revealing whether a credential
  // was supplied; existence is not leaked to unauthenticated callers.
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

  return jsonResponse({ title: bookTitle(id) }, 200)
}
