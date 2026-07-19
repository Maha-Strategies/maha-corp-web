import { jsonResponse } from '@/lib/agent-inquiries'
import { createAgentInquiryLedger } from '@/lib/agent-inquiry-ledger'
import { bookCatalogConfig, createBookEntitlementId, validBookCheckoutId } from '@/lib/books'
import { stripeWebhookPayloadHash, validStripeEventId, validStripeWebhookSignature } from '@/lib/mps-credits'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type StripeCheckoutSession = {
  id?: string
  payment_intent?: string | null
  payment_status?: string
  client_reference_id?: string | null
  metadata?: { bookCheckoutId?: string }
  amount_total?: number | null
  currency?: string | null
}

function validPaymentAmount(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0
}

function validCurrency(value: unknown): value is string {
  return typeof value === 'string' && /^[a-z]{3}$/i.test(value)
}

function validEventType(value: unknown): value is string {
  return typeof value === 'string' && /^[a-z0-9_.]{1,128}$/.test(value)
}

function objectId(value: unknown): string | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null
  const id = (value as { id?: unknown }).id
  return typeof id === 'string' && id.length <= 255 ? id : null
}

type ProcessingResult = 'processed' | 'duplicate' | 'ignored' | 'retry'

function processingResponse(result: unknown, errorCode: string | undefined) {
  if (errorCode || !['processed', 'duplicate', 'ignored', 'retry'].includes(String(result))) {
    console.error('Book webhook processing failed:', errorCode ?? 'invalid_rpc_response')
    return Response.json({ error: 'Ledger unavailable.' }, { status: 503 })
  }
  if (result === 'retry') {
    return Response.json({ error: 'Webhook dependency is not ready.' }, { status: 503 })
  }
  return Response.json({ received: true, duplicate: result === 'duplicate' })
}

async function recordEvent(eventId: string, eventType: string, payloadHash: string, stripeObjectId: string | null) {
  const ledger = createAgentInquiryLedger()
  if (!ledger) return Response.json({ error: 'Ledger unavailable.' }, { status: 503 })
  const { data, error } = await ledger.rpc('record_book_webhook_event', {
    p_event_id: eventId,
    p_event_type: eventType,
    p_object_id: stripeObjectId,
    p_payload_hash: payloadHash,
    p_received_at: new Date().toISOString(),
  })
  return processingResponse(data as ProcessingResult | null, error?.code)
}

export async function POST(request: Request) {
  let config
  try { config = bookCatalogConfig() }
  catch (error) {
    console.error('Book webhook configuration invalid:', error instanceof Error ? error.message : 'unknown_error')
    return jsonResponse({ error: { code: 'webhook_unavailable', message: 'Book webhook is not configured.' } }, 503)
  }
  const raw = await request.text()
  if (!config || !validStripeWebhookSignature(raw, request.headers.get('stripe-signature'), config.webhookSecret)) {
    return Response.json({ error: 'Invalid Stripe signature.' }, { status: 400 })
  }

  let event: { id?: unknown; type?: unknown; data?: { object?: unknown } }
  try { event = JSON.parse(raw) } catch { return Response.json({ error: 'Invalid Stripe event.' }, { status: 400 }) }
  if (typeof event.id !== 'string' || !validStripeEventId(event.id) || !validEventType(event.type)) {
    return Response.json({ error: 'Invalid Stripe event.' }, { status: 400 })
  }
  const eventId = event.id
  const eventType = event.type
  const stripeObject = event.data?.object
  const payloadHash = stripeWebhookPayloadHash(raw)

  if (eventType !== 'checkout.session.completed' && eventType !== 'checkout.session.async_payment_succeeded') {
    return recordEvent(eventId, eventType, payloadHash, objectId(stripeObject))
  }

  const session = stripeObject as StripeCheckoutSession | undefined
  if (eventType === 'checkout.session.completed' && session?.payment_status !== 'paid') {
    return recordEvent(eventId, eventType, payloadHash, objectId(stripeObject))
  }
  const checkoutId = session?.metadata?.bookCheckoutId ?? session?.client_reference_id
  if (!session?.id || !checkoutId || !validBookCheckoutId(checkoutId) || !validPaymentAmount(session.amount_total) || !validCurrency(session.currency)) {
    return recordEvent(eventId, eventType, payloadHash, objectId(stripeObject))
  }

  const ledger = createAgentInquiryLedger()
  if (!ledger) return Response.json({ error: 'Ledger unavailable.' }, { status: 503 })
  const { data, error } = await ledger.rpc('process_book_checkout_event', {
    p_event_id: eventId,
    p_event_type: eventType,
    p_payload_hash: payloadHash,
    p_checkout_id: checkoutId,
    p_session_id: session.id,
    p_payment_intent_id: session.payment_intent ?? null,
    p_amount: session.amount_total,
    p_currency: session.currency,
    p_entitlement_id: createBookEntitlementId(),
    p_allowed_price_ids: Object.keys(config.bookByPrice),
    p_received_at: new Date().toISOString(),
  })
  return processingResponse(data as ProcessingResult | null, error?.code)
}
