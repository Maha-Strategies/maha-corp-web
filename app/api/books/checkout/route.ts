import { authorizeBookPurchase, bearerToken } from '@/lib/agent-client-credentials'
import { jsonResponse } from '@/lib/agent-inquiries'
import { createAgentInquiryLedger } from '@/lib/agent-inquiry-ledger'
import { bookCatalogConfig, bookTitle, createBookCheckoutId, isKnownBook } from '@/lib/books'
import { requestHash } from '@/lib/mps-credits'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.mahastrategies.com'

function parseBody(value: unknown): { bookId: string; clientRequestId: string } {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error('Request body must be a JSON object.')
  const body = value as Record<string, unknown>
  if (typeof body.bookId !== 'string') throw new Error('bookId must be a string.')
  const clientRequestId = body.clientRequestId
  if (typeof clientRequestId !== 'string') throw new Error('clientRequestId must be a string.')
  const trimmed = clientRequestId.trim()
  if (trimmed.length < 8 || trimmed.length > 120 || /[\r\n]/.test(trimmed)) {
    throw new Error('clientRequestId must contain between 8 and 120 characters on one line.')
  }
  return { bookId: body.bookId, clientRequestId: trimmed }
}

export async function POST(request: Request) {
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
    return jsonResponse({ error: { code: 'unsupported_media_type', message: 'Content-Type must be application/json.' } }, 415)
  }
  let input: ReturnType<typeof parseBody>
  try { input = parseBody(await request.json()) }
  catch (error) { return jsonResponse({ error: { code: 'invalid_request', message: error instanceof Error ? error.message : 'Invalid request.' } }, 400) }

  const token = bearerToken(request)
  if (!token) return jsonResponse({ error: { code: 'unauthorized', message: 'A valid client credential is required.' } }, 401)
  const authorization = await authorizeBookPurchase(token)
  if (authorization.kind === 'unavailable') return jsonResponse({ error: { code: 'gateway_unavailable', message: 'The credential registry is not available.' } }, 503)
  if (authorization.kind === 'unauthorized' || authorization.kind === 'forbidden') {
    return jsonResponse({ error: { code: 'unauthorized', message: 'A valid client credential is required.' } }, 401)
  }
  if (authorization.kind === 'rate_limited') return jsonResponse({ error: { code: 'rate_limited', message: 'Credential request limit reached. Retry after one hour.' } }, 429)

  let config
  try { config = bookCatalogConfig() }
  catch (error) {
    console.error('Book checkout configuration invalid:', error instanceof Error ? error.message : 'unknown_error')
    return jsonResponse({ error: { code: 'book_checkout_unavailable', message: 'Book purchases are temporarily unavailable.' } }, 503)
  }
  if (!config) return jsonResponse({ error: { code: 'book_checkout_not_enabled', message: 'Book purchases are not currently available.' } }, 503)

  const priceId = isKnownBook(input.bookId) ? config.priceByBook[input.bookId] : undefined
  if (!priceId || !isKnownBook(input.bookId)) {
    return jsonResponse({ error: { code: 'book_not_found', message: 'No such book is available for purchase.' } }, 404)
  }
  const bookId = input.bookId

  const ledger = createAgentInquiryLedger()
  if (!ledger) return jsonResponse({ error: { code: 'ledger_unavailable', message: 'The purchase could not be prepared.' } }, 503)

  const checkoutId = createBookCheckoutId()
  const { error: checkoutError } = await ledger.from('book_checkouts').insert({
    public_id: checkoutId, client_id: authorization.clientId, book_id: bookId,
    request_hash: requestHash(input.clientRequestId), stripe_price_id: priceId, status: 'awaiting_payment',
  })
  if (checkoutError?.code === '23505') {
    return jsonResponse({ error: { code: 'duplicate_request', message: 'This clientRequestId was already used for a book checkout.' } }, 409)
  }
  if (checkoutError) return jsonResponse({ error: { code: 'ledger_unavailable', message: 'The purchase could not be prepared.' } }, 503)

  const form = new URLSearchParams({
    mode: 'payment', client_reference_id: checkoutId,
    success_url: `${SITE_URL}/books/${bookId}?purchase=success`, cancel_url: `${SITE_URL}/books/${bookId}?purchase=cancelled`,
    'line_items[0][price]': priceId, 'line_items[0][quantity]': '1',
    'metadata[bookCheckoutId]': checkoutId, 'metadata[bookId]': bookId,
  })
  let stripeResponse: Response
  let stripe: { id?: string; url?: string; error?: { message?: string } }
  try {
    stripeResponse = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST', headers: { Authorization: `Bearer ${config.stripeSecretKey}`, 'Content-Type': 'application/x-www-form-urlencoded', 'Idempotency-Key': checkoutId },
      body: form, cache: 'no-store',
    })
    stripe = await stripeResponse.json() as typeof stripe
  } catch { return jsonResponse({ error: { code: 'stripe_unavailable', message: 'Secure checkout could not be started.' } }, 502) }
  if (!stripeResponse.ok || !stripe.id || !stripe.url) {
    console.error('Book Stripe session failed:', stripeResponse.status, stripe.error?.message ?? 'unknown')
    await ledger.from('book_checkouts').update({ status: 'failed', failure_code: 'stripe_checkout_failed' }).eq('public_id', checkoutId)
    return jsonResponse({ error: { code: 'stripe_checkout_failed', message: 'Secure checkout could not be started.' } }, 502)
  }
  const { error: sessionError } = await ledger.from('book_checkouts').update({ stripe_checkout_session_id: stripe.id }).eq('public_id', checkoutId)
  if (sessionError) return jsonResponse({ error: { code: 'ledger_unavailable', message: 'Secure checkout could not be recorded.' } }, 503)

  return jsonResponse({ checkoutId, checkoutUrl: stripe.url, bookId, title: bookTitle(bookId) }, 201)
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: { Allow: 'POST, OPTIONS', 'Cache-Control': 'no-store' } })
}
