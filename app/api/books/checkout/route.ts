import { authorizeBookPurchase, bearerToken } from '@/lib/agent-client-credentials'
import { jsonResponse } from '@/lib/agent-inquiries'
import { createAgentInquiryLedger } from '@/lib/agent-inquiry-ledger'
import { bookCatalogConfig, bookTitle, createBookCheckoutId, isKnownBook } from '@/lib/books'
import { requestHash } from '@/lib/mps-credits'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.mahastrategies.com'

type StoredCheckout = {
  public_id: string
  book_id: string
  stripe_price_id: string
  stripe_checkout_session_id: string | null
  stripe_checkout_url: string | null
  status: 'awaiting_payment' | 'paid' | 'failed'
}

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

function checkoutResponse(checkout: StoredCheckout, idempotentReplay: boolean, checkoutUrl?: string) {
  const base = {
    checkoutId: checkout.public_id,
    bookId: checkout.book_id,
    title: bookTitle(checkout.book_id as Parameters<typeof bookTitle>[0]),
    checkoutStatus: checkout.status,
    ...(idempotentReplay ? { idempotentReplay: true } : {}),
  }
  return checkoutUrl ? { ...base, checkoutUrl } : base
}

async function createOrRecoverStripeSession(input: {
  checkout: StoredCheckout
  stripeSecretKey: string
  onSession: (session: { id: string; url: string }) => Promise<boolean>
}): Promise<{ kind: 'ready'; session: { id: string; url: string } } | { kind: 'unavailable' } | { kind: 'failed'; message: string }> {
  const form = new URLSearchParams({
    mode: 'payment', client_reference_id: input.checkout.public_id,
    success_url: `${SITE_URL}/books/${input.checkout.book_id}?purchase=success`, cancel_url: `${SITE_URL}/books/${input.checkout.book_id}?purchase=cancelled`,
    'line_items[0][price]': input.checkout.stripe_price_id, 'line_items[0][quantity]': '1',
    'metadata[bookCheckoutId]': input.checkout.public_id, 'metadata[bookId]': input.checkout.book_id,
  })
  let stripeResponse: Response
  let stripe: { id?: string; url?: string; error?: { message?: string } }
  try {
    stripeResponse = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST', headers: { Authorization: `Bearer ${input.stripeSecretKey}`, 'Content-Type': 'application/x-www-form-urlencoded', 'Idempotency-Key': input.checkout.public_id },
      body: form, cache: 'no-store',
    })
    stripe = await stripeResponse.json() as typeof stripe
  } catch { return { kind: 'unavailable' } }
  if (!stripeResponse.ok || !stripe.id || !stripe.url) {
    console.error('Book Stripe session failed:', stripeResponse.status, stripe.error?.message ?? 'unknown')
    return { kind: 'failed', message: 'Secure checkout could not be started.' }
  }
  if (!await input.onSession({ id: stripe.id, url: stripe.url })) return { kind: 'unavailable' }
  return { kind: 'ready', session: { id: stripe.id, url: stripe.url } }
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

  const requestIdHash = requestHash(input.clientRequestId)
  let checkout: StoredCheckout | null = null
  let created = false
  const { error: checkoutError } = await ledger.from('book_checkouts').insert({
    public_id: createBookCheckoutId(), client_id: authorization.clientId, book_id: bookId,
    request_hash: requestIdHash, stripe_price_id: priceId, status: 'awaiting_payment',
  })
  if (checkoutError?.code === '23505') {
    const { data, error } = await ledger.from('book_checkouts')
      .select('public_id, book_id, stripe_price_id, stripe_checkout_session_id, stripe_checkout_url, status')
      .eq('client_id', authorization.clientId).eq('request_hash', requestIdHash).maybeSingle()
    if (error || !data) return jsonResponse({ error: { code: 'ledger_unavailable', message: 'The existing checkout could not be read.' } }, 503)
    checkout = data as StoredCheckout
    if (checkout.book_id !== bookId) {
      return jsonResponse({ error: { code: 'idempotency_conflict', message: 'clientRequestId was already used for a different book.' } }, 409)
    }
    if (checkout.status === 'paid') return jsonResponse(checkoutResponse(checkout, true), 200)
    if (checkout.status === 'failed') {
      return jsonResponse({ error: { code: 'checkout_failed', message: 'This checkout failed. Use a new clientRequestId to start another purchase.' } }, 409)
    }
    if (checkout.stripe_checkout_url) return jsonResponse(checkoutResponse(checkout, true, checkout.stripe_checkout_url), 200)
  }
  if (checkoutError && checkoutError.code !== '23505') return jsonResponse({ error: { code: 'ledger_unavailable', message: 'The purchase could not be prepared.' } }, 503)
  if (!checkout) {
    const { data, error } = await ledger.from('book_checkouts')
      .select('public_id, book_id, stripe_price_id, stripe_checkout_session_id, stripe_checkout_url, status')
      .eq('client_id', authorization.clientId).eq('request_hash', requestIdHash).maybeSingle()
    if (error || !data) return jsonResponse({ error: { code: 'ledger_unavailable', message: 'The purchase could not be prepared.' } }, 503)
    checkout = data as StoredCheckout
    created = true
  }

  const stripeSession = await createOrRecoverStripeSession({
    checkout,
    stripeSecretKey: config.stripeSecretKey,
    onSession: async (session) => {
      const { error } = await ledger.from('book_checkouts')
        .update({ stripe_checkout_session_id: session.id, stripe_checkout_url: session.url })
        .eq('public_id', checkout.public_id).eq('status', 'awaiting_payment')
      return !error
    },
  })
  if (stripeSession.kind === 'unavailable') return jsonResponse({ error: { code: 'ledger_unavailable', message: 'Secure checkout could not be recorded.' } }, 503)
  if (stripeSession.kind === 'failed') {
    if (created) await ledger.from('book_checkouts').update({ status: 'failed', failure_code: 'stripe_checkout_failed' }).eq('public_id', checkout.public_id)
    return jsonResponse({ error: { code: 'stripe_checkout_failed', message: stripeSession.message } }, 502)
  }
  return jsonResponse(checkoutResponse(checkout, !created, stripeSession.session.url), created ? 201 : 200)
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: { Allow: 'POST, OPTIONS', 'Cache-Control': 'no-store' } })
}
