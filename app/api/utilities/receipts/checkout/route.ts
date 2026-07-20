import { jsonResponse } from '@/lib/agent-inquiries'
import { createAgentInquiryLedger } from '@/lib/agent-inquiry-ledger'
import { requestHash } from '@/lib/mps-credits'
import { RECEIPT_UTILITY } from '@/lib/receipt-utility'
import { createUtilityCheckoutId, isKnownUtility, utilityCatalogConfig } from '@/lib/utility-billing'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.mahastrategies.com'

type StoredCheckout = {
  public_id: string
  utility: string
  stripe_price_id: string
  stripe_checkout_url: string | null
  status: 'awaiting_payment' | 'paid' | 'failed'
}

function parseBody(value: unknown): { utility: string; clientRequestId: string } {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error('Request body must be a JSON object.')
  const body = value as Record<string, unknown>
  const utility = typeof body.utility === 'string' ? body.utility : RECEIPT_UTILITY
  const clientRequestId = body.clientRequestId
  if (typeof clientRequestId !== 'string') throw new Error('clientRequestId must be a string.')
  const trimmed = clientRequestId.trim()
  if (trimmed.length < 8 || trimmed.length > 120 || /[\r\n]/.test(trimmed)) {
    throw new Error('clientRequestId must contain between 8 and 120 characters on one line.')
  }
  return { utility, clientRequestId: trimmed }
}

export async function POST(request: Request) {
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
    return jsonResponse({ error: { code: 'unsupported_media_type', message: 'Content-Type must be application/json.' } }, 415)
  }
  let input: ReturnType<typeof parseBody>
  try { input = parseBody(await request.json()) }
  catch (error) { return jsonResponse({ error: { code: 'invalid_request', message: error instanceof Error ? error.message : 'Invalid request.' } }, 400) }

  let config
  try { config = utilityCatalogConfig() }
  catch (error) {
    console.error('Utility checkout configuration invalid:', error instanceof Error ? error.message : 'unknown_error')
    return jsonResponse({ error: { code: 'utility_checkout_unavailable', message: 'Paid runs are temporarily unavailable.' } }, 503)
  }
  if (!config) return jsonResponse({ error: { code: 'utility_checkout_not_enabled', message: 'Paid runs are not currently available.' } }, 503)

  const priceId = isKnownUtility(input.utility) ? config.priceByUtility[input.utility] : undefined
  if (!priceId || !isKnownUtility(input.utility)) {
    return jsonResponse({ error: { code: 'utility_not_found', message: 'No such paid utility.' } }, 404)
  }
  const utility = input.utility

  const ledger = createAgentInquiryLedger()
  if (!ledger) return jsonResponse({ error: { code: 'ledger_unavailable', message: 'The purchase could not be prepared.' } }, 503)

  // Idempotency: request_hash is globally unique (no login). A repeat returns
  // the same checkout rather than creating a second Stripe session.
  const requestIdHash = requestHash(input.clientRequestId)
  const checkoutId = createUtilityCheckoutId()
  const { error: insertError } = await ledger.from('utility_checkouts').insert({
    public_id: checkoutId, utility, request_hash: requestIdHash, stripe_price_id: priceId, status: 'awaiting_payment',
  })
  if (insertError?.code === '23505') {
    const { data, error } = await ledger.from('utility_checkouts')
      .select('public_id, utility, stripe_price_id, stripe_checkout_url, status').eq('request_hash', requestIdHash).maybeSingle()
    if (error || !data) return jsonResponse({ error: { code: 'ledger_unavailable', message: 'The existing checkout could not be read.' } }, 503)
    const existing = data as StoredCheckout
    if (existing.utility !== utility) return jsonResponse({ error: { code: 'idempotency_conflict', message: 'clientRequestId was already used for a different utility.' } }, 409)
    if (existing.status === 'paid') return jsonResponse({ checkoutId: existing.public_id, utility, checkoutStatus: 'paid', idempotentReplay: true }, 200)
    if (existing.status === 'failed') return jsonResponse({ error: { code: 'checkout_failed', message: 'This checkout failed. Use a new clientRequestId.' } }, 409)
    if (existing.stripe_checkout_url) return jsonResponse({ checkoutId: existing.public_id, utility, checkoutUrl: existing.stripe_checkout_url, idempotentReplay: true }, 200)
    return jsonResponse({ error: { code: 'ledger_unavailable', message: 'The existing checkout is not ready.' } }, 503)
  }
  if (insertError) return jsonResponse({ error: { code: 'ledger_unavailable', message: 'The purchase could not be prepared.' } }, 503)

  const form = new URLSearchParams({
    mode: 'payment', client_reference_id: checkoutId,
    success_url: `${SITE_URL}/utilities/receipts?purchase=success&checkout=${checkoutId}`,
    cancel_url: `${SITE_URL}/utilities/receipts?purchase=cancelled`,
    'line_items[0][price]': priceId, 'line_items[0][quantity]': '1',
    'metadata[utilityCheckoutId]': checkoutId, 'metadata[utility]': utility,
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
    console.error('Utility Stripe session failed:', stripeResponse.status, stripe.error?.message ?? 'unknown')
    await ledger.from('utility_checkouts').update({ status: 'failed', failure_code: 'stripe_checkout_failed' }).eq('public_id', checkoutId)
    return jsonResponse({ error: { code: 'stripe_checkout_failed', message: 'Secure checkout could not be started.' } }, 502)
  }
  const { error: sessionError } = await ledger.from('utility_checkouts').update({ stripe_checkout_session_id: stripe.id, stripe_checkout_url: stripe.url }).eq('public_id', checkoutId)
  if (sessionError) return jsonResponse({ error: { code: 'ledger_unavailable', message: 'Secure checkout could not be recorded.' } }, 503)

  return jsonResponse({ checkoutId, checkoutUrl: stripe.url, utility }, 201)
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: { Allow: 'POST, OPTIONS', 'Cache-Control': 'no-store' } })
}
