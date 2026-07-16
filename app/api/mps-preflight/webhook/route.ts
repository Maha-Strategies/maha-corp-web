import { createHmac, timingSafeEqual } from 'node:crypto'

import { createAgentInquiryLedger } from '@/lib/agent-inquiry-ledger'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function validSignature(raw: string, signature: string | null, secret: string): boolean {
  if (!signature) return false
  const timestamp = signature.match(/(?:^|,)t=(\d+)(?:,|$)/)?.[1]
  const candidates = [...signature.matchAll(/(?:^|,)v1=([^,]+)/g)].map((match) => match[1])
  if (!timestamp || !candidates.length || Math.abs(Date.now() / 1_000 - Number(timestamp)) > 300) return false
  const expected = createHmac('sha256', secret).update(`${timestamp}.${raw}`).digest('hex')
  return candidates.some((candidate) => {
    const a = Buffer.from(candidate)
    const b = Buffer.from(expected)
    return a.length === b.length && timingSafeEqual(a, b)
  })
}

export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  const raw = await request.text()
  if (!secret || !validSignature(raw, request.headers.get('stripe-signature'), secret)) {
    return Response.json({ error: 'Invalid Stripe signature.' }, { status: 400 })
  }
  let event: { type?: string; data?: { object?: { id?: string; payment_status?: string; client_reference_id?: string; metadata?: { preflightOrderId?: string } } } }
  try { event = JSON.parse(raw) } catch { return Response.json({ error: 'Invalid Stripe event.' }, { status: 400 }) }
  if (event.type !== 'checkout.session.completed' && event.type !== 'checkout.session.async_payment_succeeded') return Response.json({ received: true })

  const session = event.data?.object
  if (event.type === 'checkout.session.completed' && session?.payment_status !== 'paid') return Response.json({ received: true })
  const orderId = session?.metadata?.preflightOrderId ?? session?.client_reference_id
  if (!session?.id || !orderId) return Response.json({ received: true })
  const ledger = createAgentInquiryLedger()
  if (!ledger) return Response.json({ error: 'Ledger unavailable.' }, { status: 503 })
  const { error } = await ledger
    .from('mps_preflight_orders')
    .update({ status: 'paid' })
    .eq('public_id', orderId)
    .eq('stripe_checkout_session_id', session.id)
    .eq('status', 'awaiting_payment')
  if (error) {
    console.error('MPS Preflight payment update failed:', error.code)
    return Response.json({ error: 'Ledger unavailable.' }, { status: 503 })
  }
  return Response.json({ received: true })
}
