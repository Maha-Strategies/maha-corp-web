import Stripe from 'stripe'
import { creditKeyOnce } from '../../../../lib/api-key.ts'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
const CREDIT_PACKS: Record<string, number> = { starter: 100_000, builder: 600_000, scale: 3_000_000 }

function malformedPayload(eventId: string) {
  // Stripe has authenticated this event, but retrying cannot repair its metadata.
  console.error('Maha API-credit Stripe event has malformed payload metadata.', { eventId })
  return Response.json({ received: true, warning: 'malformed_payload' })
}

export async function POST(request: Request) {
  const secret = process.env.STRIPE_SECRET_KEY; const webhookSecret = process.env.STRIPE_API_KEY_WEBHOOK_SECRET
  if (!secret || !webhookSecret) return Response.json({ error: 'Webhook is not configured.' }, { status: 503 })
  const raw = await request.text(); const signature = request.headers.get('stripe-signature'); if (!signature) return Response.json({ error: 'Missing Stripe signature.' }, { status: 400 })
  let event: Stripe.Event; try { event = new Stripe(secret).webhooks.constructEvent(raw, signature, webhookSecret) } catch { return Response.json({ error: 'Invalid Stripe signature.' }, { status: 400 }) }
  if (event.type !== 'checkout.session.completed') return Response.json({ received: true, ignored: true })
  const session = event.data.object as Stripe.Checkout.Session; if (session.payment_status !== 'paid') return Response.json({ received: true, ignored: true })
  const keyId = session.metadata?.api_key_id; const pack = session.metadata?.pack; const credits = pack ? CREDIT_PACKS[pack] : undefined
  if (!keyId || !credits || session.metadata?.credits !== String(credits)) return malformedPayload(event.id)
  try { const balance = await creditKeyOnce(event.id, keyId, credits); return Response.json({ received: true, duplicate: balance === false, balanceCredits: balance === false ? undefined : balance }) } catch { return Response.json({ error: 'Credit ledger unavailable.' }, { status: 503 }) }
}
