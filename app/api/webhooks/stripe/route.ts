import Stripe from 'stripe'

import { bindTenantSubscription, creditKeyOnce, creditTenantTopupOnce, endTenantSubscription, releaseTenantAutoTopup, resetTenantSubscriptionCreditsOnce, reverseKeyCreditsOnce, setTenantSubscriptionStatus } from '../../../../lib/api-key.ts'
import { apiCreditWebhookConfig, createApiCreditLedgerEntryId, isTenantSubscriptionTier, tenantBillingConfig } from '../../../../lib/api-credit-billing.ts'
import { createAgentInquiryLedger } from '../../../../lib/agent-inquiry-ledger.ts'
import { stripeWebhookPayloadHash } from '../../../../lib/mps-credits.ts'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function response(body: unknown, status = 200) { return Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } }) }
function paymentIntentId(value: string | Stripe.PaymentIntent | null | undefined) { return typeof value === 'string' ? value : value?.id ?? null }
function priceId(value: string | Stripe.Price | null | undefined) { return typeof value === 'string' ? value : value?.id ?? null }
function acknowledgeMalformedEvent(event: Stripe.Event, warning: string) {
  // A valid signature proves Stripe sent this, but retrying cannot repair bad metadata.
  console.error('[API_CREDIT_WEBHOOK_MALFORMED]', { eventId: event.id, eventType: event.type, warning })
  return response({ received: true, warning })
}

async function checkoutPriceId(stripe: Stripe, sessionId: string) {
  const lines = await stripe.checkout.sessions.listLineItems(sessionId, { limit: 2 })
  if (lines.data.length !== 1) return null
  return priceId(lines.data[0].price)
}

async function processPurchase(input: { stripe: Stripe; event: Stripe.Event; session: Stripe.Checkout.Session; payloadHash: string }) {
  const checkoutId = input.session.metadata?.api_credit_checkout_id
  const intentId = paymentIntentId(input.session.payment_intent)
  if (!checkoutId || !intentId || !input.session.id || !input.session.amount_total || !input.session.currency) return acknowledgeMalformedEvent(input.event, 'malformed_payload')
  const price = await checkoutPriceId(input.stripe, input.session.id)
  if (!price) return acknowledgeMalformedEvent(input.event, 'malformed_line_items')
  const ledger = createAgentInquiryLedger(); if (!ledger) return response({ error: 'Billing ledger unavailable.' }, 503)
  const { data, error } = await ledger.rpc('process_api_credit_checkout_event', {
    p_event_id: input.event.id, p_event_type: input.event.type, p_payload_hash: input.payloadHash,
    p_checkout_id: checkoutId, p_session_id: input.session.id, p_payment_intent_id: intentId,
    p_amount: input.session.amount_total, p_currency: input.session.currency, p_price_id: price,
    p_entry_id: createApiCreditLedgerEntryId(), p_received_at: new Date().toISOString(),
  })
  if (error || !['processed', 'already_paid', 'duplicate'].includes(String(data))) return response({ error: 'Billing ledger unavailable.' }, 503)
  const { data: checkout, error: checkoutError } = await ledger.from('api_credit_checkouts').select('api_key_id,credit_quantity').eq('public_id', checkoutId).maybeSingle()
  if (checkoutError || !checkout) return response({ error: 'Billing ledger unavailable.' }, 503)
  if (data === 'already_paid' || data === 'duplicate') return response({ received: true, duplicate: true })
  try { const balance = await creditKeyOnce(input.event.id, checkout.api_key_id, Number(checkout.credit_quantity)); return response({ received: true, duplicate: balance === false }) }
  catch { return response({ error: 'Credit application unavailable.' }, 503) }
}

async function processSubscriptionCheckout(stripe: Stripe, session: Stripe.Checkout.Session) {
  const tenantId = session.metadata?.tenant_id; const tier = session.metadata?.tier
  const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id
  const subscriptionId = typeof session.subscription === 'string' ? session.subscription : session.subscription?.id
  if (!tenantId || !isTenantSubscriptionTier(tier) || !customerId || !subscriptionId) return response({ received: true, warning: 'malformed_subscription_checkout' })
  const subscription = await stripe.subscriptions.retrieve(subscriptionId)
  const paymentMethodId = typeof subscription.default_payment_method === 'string' ? subscription.default_payment_method : subscription.default_payment_method?.id
  await bindTenantSubscription({ tenantId, customerId, subscriptionId, paymentMethodId, tier, status: subscription.status })
  return response({ received: true })
}

async function processSubscriptionInvoice(event: Stripe.Event, invoice: Stripe.Invoice) {
  const details = invoice.parent?.subscription_details; const metadata = details?.metadata
  const tenantId = metadata?.tenant_id; const tier = metadata?.tier
  const subscriptionId = typeof details?.subscription === 'string' ? details.subscription : details?.subscription?.id
  const customerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id
  if (!tenantId || !isTenantSubscriptionTier(tier) || !subscriptionId || !customerId) return response({ received: true, ignored: true })
  const config = tenantBillingConfig(); if (!config) return response({ error: 'Tenant billing is unavailable.' }, 503)
  const expectedPrice = config.prices[tier]
  const priceMatches = invoice.lines.data.some((line) => { const price = line.pricing?.price_details?.price; return (typeof price === 'string' ? price : price?.id) === expectedPrice })
  if (!priceMatches) return acknowledgeMalformedEvent(event, 'subscription_price_mismatch')
  await bindTenantSubscription({ tenantId, customerId, subscriptionId, tier, status: 'active' })
  const applied = await resetTenantSubscriptionCreditsOnce({ eventId: event.id, tenantId, tier, subscriptionId, periodEnd: invoice.period_end })
  return response({ received: true, duplicate: !applied })
}

async function processSubscriptionLifecycle(event: Stripe.Event, subscription: Stripe.Subscription) {
  const tenantId = subscription.metadata.tenant_id; const tier = subscription.metadata.tier
  if (!tenantId || !isTenantSubscriptionTier(tier)) return response({ received: true, ignored: true })
  if (event.type === 'customer.subscription.deleted') {
    const ended = await endTenantSubscription(tenantId, subscription.id)
    return response({ received: true, ignored: !ended })
  }
  const config = tenantBillingConfig(); if (!config) return response({ error: 'Tenant billing is unavailable.' }, 503)
  if (!subscription.items.data.some((item) => item.price.id === config.prices[tier])) return acknowledgeMalformedEvent(event, 'subscription_price_mismatch')
  const customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id
  const paymentMethodId = typeof subscription.default_payment_method === 'string' ? subscription.default_payment_method : subscription.default_payment_method?.id
  await bindTenantSubscription({ tenantId, customerId, subscriptionId: subscription.id, paymentMethodId, tier, status: subscription.status })
  return response({ received: true })
}

async function processReversal(input: { event: Stripe.Event; reversalId: string; paymentIntentId: string; amount: number; currency: string; payloadHash: string }) {
  const ledger = createAgentInquiryLedger(); if (!ledger) return response({ error: 'Billing ledger unavailable.' }, 503)
  const { data, error } = await ledger.rpc('process_api_credit_reversal_event', {
    p_event_id: input.event.id, p_event_type: input.event.type, p_payload_hash: input.payloadHash,
    p_reversal_id: input.reversalId, p_payment_intent_id: input.paymentIntentId, p_amount: input.amount,
    p_currency: input.currency, p_entry_id: createApiCreditLedgerEntryId(), p_received_at: new Date().toISOString(),
  }) as { data: { result?: string; credits?: number; apiKeyId?: string } | null; error: { code?: string } | null }
  if (error || !data || !['processed', 'duplicate'].includes(String(data.result))) return response({ error: 'Billing ledger unavailable.' }, 503)
  if (!data.credits || !data.apiKeyId) return response({ received: true, duplicate: data.result === 'duplicate' })
  try { const reversal = await reverseKeyCreditsOnce(input.event.id, data.apiKeyId, data.credits); return response({ received: true, duplicate: data.result === 'duplicate' || !reversal.applied, accountSuspended: reversal.suspended }) }
  catch { return response({ error: 'Credit reversal unavailable.' }, 503) }
}

export async function POST(request: Request) {
  const config = apiCreditWebhookConfig()
  if (!config) return response({ error: 'Webhook is not configured.' }, 503)
  const raw = await request.text(); const signature = request.headers.get('stripe-signature')
  if (!signature) return response({ error: 'Missing Stripe signature.' }, 400)
  const stripe = new Stripe(config.stripeSecretKey, { apiVersion: '2026-06-24.dahlia' })
  let event: Stripe.Event
  try { event = stripe.webhooks.constructEvent(raw, signature, config.webhookSecret) }
  catch { return response({ error: 'Invalid Stripe signature.' }, 400) }
  try {
    if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') {
      const session = event.data.object as Stripe.Checkout.Session
      if (session.metadata?.billing_kind === 'tenant_subscription') return processSubscriptionCheckout(stripe, session)
      if (event.type === 'checkout.session.completed' && session.payment_status !== 'paid') return response({ received: true, ignored: true })
      return processPurchase({ stripe, event, session, payloadHash: stripeWebhookPayloadHash(raw) })
    }
    if (event.type === 'invoice.paid') return processSubscriptionInvoice(event, event.data.object as Stripe.Invoice)
    if (event.type === 'invoice.payment_failed') {
      const invoice = event.data.object as Stripe.Invoice; const tenantId = invoice.parent?.subscription_details?.metadata?.tenant_id
      if (tenantId) await setTenantSubscriptionStatus(tenantId, 'past_due')
      return response({ received: true })
    }
    if (event.type === 'customer.subscription.updated' || event.type === 'customer.subscription.deleted') return processSubscriptionLifecycle(event, event.data.object as Stripe.Subscription)
    if (event.type === 'payment_intent.succeeded') {
      const intent = event.data.object as Stripe.PaymentIntent
      if (intent.metadata.billing_kind !== 'tenant_auto_topup') return response({ received: true, ignored: true })
      if (!intent.metadata.tenant_id || !intent.metadata.attempt_id || intent.metadata.credits !== '5000' || intent.amount_received !== 1_000 || intent.currency !== 'usd') return acknowledgeMalformedEvent(event, 'malformed_auto_topup')
      const balance = await creditTenantTopupOnce(event.id, intent.metadata.tenant_id, intent.metadata.attempt_id, 5_000)
      if (balance === -1) return acknowledgeMalformedEvent(event, 'auto_topup_attempt_mismatch')
      return response({ received: true, duplicate: balance === false })
    }
    if (event.type === 'payment_intent.payment_failed') {
      const intent = event.data.object as Stripe.PaymentIntent
      if (intent.metadata.billing_kind === 'tenant_auto_topup' && intent.metadata.tenant_id && intent.metadata.attempt_id) await releaseTenantAutoTopup(intent.metadata.tenant_id, intent.metadata.attempt_id)
      return response({ received: true })
    }
    if (event.type === 'refund.created' || event.type === 'refund.updated') {
      const refund = event.data.object as Stripe.Refund
      const intentId = paymentIntentId(refund.payment_intent)
      if (refund.status !== 'succeeded' || !intentId || !refund.id || !refund.amount || !refund.currency) return response({ received: true, ignored: true })
      return processReversal({ event, reversalId: refund.id, paymentIntentId: intentId, amount: refund.amount, currency: refund.currency, payloadHash: stripeWebhookPayloadHash(raw) })
    }
    if (event.type === 'charge.dispute.closed') {
      const dispute = event.data.object as Stripe.Dispute
      if (dispute.status !== 'lost' || !dispute.id || !dispute.amount || !dispute.currency) return response({ received: true, ignored: true })
      const charge = typeof dispute.charge === 'string' ? await stripe.charges.retrieve(dispute.charge) : dispute.charge
      const intentId = paymentIntentId(charge?.payment_intent)
      if (!intentId) return response({ error: 'Stripe reversal dependency is not ready.' }, 503)
      return processReversal({ event, reversalId: dispute.id, paymentIntentId: intentId, amount: dispute.amount, currency: dispute.currency, payloadHash: stripeWebhookPayloadHash(raw) })
    }
    return response({ received: true, ignored: true })
  } catch (error) {
    console.error('[API_CREDIT_WEBHOOK_ERROR]', error)
    return response({ error: 'Billing webhook unavailable.' }, 503)
  }
}
