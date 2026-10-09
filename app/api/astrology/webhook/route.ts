import { astrologyBillingConfig, astrologyStripe } from '@/lib/billing/stripe'
import { recoverAstrologyCheckout } from '@/lib/astrology-entitlements'
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export async function POST(request: Request) {
  const headers = { 'Cache-Control': 'no-store' }, config = astrologyBillingConfig()
  if (!config) return Response.json({ error: 'Billing is not configured.' }, { status: 503, headers })
  const signature = request.headers.get('stripe-signature'); if (!signature) return Response.json({ error: 'Signature required.' }, { status: 400, headers })
  const body = await request.text(); if (Buffer.byteLength(body) > 65536) return new Response(null, { status: 413, headers })
  let event
  try { event = astrologyStripe().webhooks.constructEvent(body, signature, config.webhook) } catch { return Response.json({ error: 'Invalid webhook signature.' }, { status: 400, headers }) }
  try {
    if (['checkout.session.completed', 'checkout.session.async_payment_succeeded'].includes(event.type)) {
      const session = event.data.object as import('stripe').default.Checkout.Session
      if (session.metadata?.billing_kind === 'maha_astrology' && session.payment_status === 'paid' && session.client_reference_id) await recoverAstrologyCheckout(session.client_reference_id, session.id)
    }
    // Access is checked against current Stripe status/refund/dispute state on
    // every request, not a stale local subscription boolean or event ordering.
    return Response.json({ received: true }, { headers })
  } catch { return Response.json({ error: 'Fulfillment could not complete; retry is safe.' }, { status: 503, headers }) }
}
