import { createAccessSecret, createPreflightId, hashSecret, parseCustomerEmail, parseDocumentLabel, reportPath, SITE_URL } from '@/lib/mps-preflight'
import { createAgentInquiryLedger } from '@/lib/agent-inquiry-ledger'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function response(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(request: Request) {
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
    return response({ error: 'Content-Type must be application/json.' }, 415)
  }

  let email: string
  let documentLabel: string | null
  try {
    const body = await request.json() as { email?: unknown; documentLabel?: unknown }
    email = parseCustomerEmail(body.email)
    documentLabel = parseDocumentLabel(body.documentLabel)
  } catch (error) {
    return response({ error: error instanceof Error ? error.message : 'Invalid request.' }, 400)
  }

  const ledger = createAgentInquiryLedger()
  if (!ledger) return response({ error: 'Purchasing is temporarily unavailable.' }, 503)

  const stripeKey = process.env.STRIPE_SECRET_KEY
  const stripePriceId = process.env.STRIPE_MPS_PREFLIGHT_PRICE_ID
  if (!stripeKey || !stripePriceId) {
    console.error('MPS Preflight checkout is missing Stripe configuration.')
    return response({ error: 'Purchasing is not yet activated. Please use the human audit request path.' }, 503)
  }

  const orderId = createPreflightId()
  const access = createAccessSecret()
  const { error: insertError } = await ledger.from('mps_preflight_orders').insert({
    public_id: orderId,
    access_hash: hashSecret(access),
    customer_email: email,
    document_label: documentLabel,
    status: 'awaiting_payment',
  })
  if (insertError) {
    console.error('MPS Preflight order creation failed:', insertError.code)
    return response({ error: 'We could not create the purchase session.' }, 503)
  }

  const form = new URLSearchParams({
    mode: 'payment',
    customer_email: email,
    client_reference_id: orderId,
    success_url: `${SITE_URL}/mps/preflight/submit?orderId=${encodeURIComponent(orderId)}&access=${encodeURIComponent(access)}`,
    cancel_url: `${SITE_URL}/mps/preflight?purchase=cancelled`,
    'line_items[0][price]': stripePriceId,
    'line_items[0][quantity]': '1',
    'metadata[preflightOrderId]': orderId,
  })
  const stripeResponse = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${stripeKey}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form,
    cache: 'no-store',
  })
  const stripe = await stripeResponse.json() as { id?: string; url?: string; error?: { message?: string } }
  if (!stripeResponse.ok || !stripe.id || !stripe.url) {
    console.error('MPS Preflight Stripe session failed:', stripeResponse.status, stripe.error?.message ?? 'unknown')
    return response({ error: 'We could not start the secure checkout. Please try again.' }, 502)
  }
  const { error: updateError } = await ledger
    .from('mps_preflight_orders')
    .update({ stripe_checkout_session_id: stripe.id })
    .eq('public_id', orderId)
  if (updateError) {
    console.error('MPS Preflight checkout session storage failed:', updateError.code)
    return response({ error: 'We could not secure the purchase session.' }, 503)
  }

  return response({ checkoutUrl: stripe.url, reportUrl: reportPath(orderId, access) }, 201)
}
