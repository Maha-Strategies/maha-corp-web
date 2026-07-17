import { createHash } from 'node:crypto'

import { createAgentInquiryLedger } from '@/lib/agent-inquiry-ledger'
import { createClientId, createCredentialId, createCredentialSecret } from '@/lib/agent-client-credentials'
import { jsonResponse } from '@/lib/agent-inquiries'
import { MPS_AUDIT_CAPABILITY } from '@/lib/mps-audit-jobs'
import { MPS_AUDIT_CREDIT_UNIT, creditPackConfig, createCreditCheckoutId, parseCreditCheckoutRequest, requestHash } from '@/lib/mps-credits'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.mahastrategies.com'

export async function POST(request: Request) {
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
    return jsonResponse({ error: { code: 'unsupported_media_type', message: 'Content-Type must be application/json.' } }, 415)
  }
  let input: ReturnType<typeof parseCreditCheckoutRequest>
  try { input = parseCreditCheckoutRequest(await request.json()) }
  catch (error) { return jsonResponse({ error: { code: 'invalid_request', message: error instanceof Error ? error.message : 'Invalid request.' } }, 400) }

  let config
  try { config = creditPackConfig() }
  catch (error) {
    console.error('MPS credit checkout configuration invalid:', error instanceof Error ? error.message : 'unknown_error')
    return jsonResponse({ error: { code: 'credit_checkout_unavailable', message: 'MPS audit access is temporarily unavailable.' } }, 503)
  }
  if (!config) return jsonResponse({ error: { code: 'credit_checkout_not_enabled', message: 'MPS audit access is not currently available.' } }, 503)
  const ledger = createAgentInquiryLedger()
  if (!ledger) return jsonResponse({ error: { code: 'ledger_unavailable', message: 'MPS audit access is temporarily unavailable.' } }, 503)

  // A checkout creates a dormant, MPS-only credential. Its secret is returned once
  // to this browser and becomes usable only after the signed Stripe webhook activates it.
  const checkoutId = createCreditCheckoutId()
  const clientId = createClientId()
  const credentialId = createCredentialId()
  const credential = createCredentialSecret()
  const expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
  const { error: clientError } = await ledger.from('agent_clients').insert({ public_id: clientId, display_name: input.email, status: 'active' })
  if (clientError) return jsonResponse({ error: { code: 'ledger_unavailable', message: 'The purchase could not be prepared.' } }, 503)
  const { error: credentialError } = await ledger.from('agent_client_credentials').insert({
    public_id: credentialId, client_id: clientId, label: 'Self-service MPS audit access',
    secret_hash: createHash('sha256').update(credential).digest('hex'), secret_prefix: credential.slice(0, 14),
    allowed_offer_ids: [], allowed_capabilities: [MPS_AUDIT_CAPABILITY], rate_limit_per_hour: 100,
    expires_at: expiresAt, status: 'pending_payment', billing_mode: 'prepaid',
  })
  if (credentialError) return jsonResponse({ error: { code: 'ledger_unavailable', message: 'The purchase credential could not be prepared.' } }, 503)
  const { error: checkoutError } = await ledger.from('mps_credit_checkouts').insert({
    public_id: checkoutId, client_id: clientId, credential_id: credentialId, request_hash: requestHash(input.clientRequestId),
    stripe_price_id: config.stripePriceId, credit_quantity: config.creditQuantity, status: 'awaiting_payment',
  })
  if (checkoutError) return jsonResponse({ error: { code: 'ledger_unavailable', message: 'The purchase could not be prepared.' } }, 503)

  const form = new URLSearchParams({
    mode: 'payment', customer_email: input.email, client_reference_id: checkoutId,
    success_url: `${SITE_URL}/mps/audit-access?purchase=success`, cancel_url: `${SITE_URL}/mps/audit-access?purchase=cancelled`,
    'line_items[0][price]': config.stripePriceId, 'line_items[0][quantity]': '1',
    'metadata[mpsCreditCheckoutId]': checkoutId, 'metadata[mpsCreditQuantity]': String(config.creditQuantity),
    'metadata[mpsCreditUnit]': MPS_AUDIT_CREDIT_UNIT,
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
    console.error('MPS credit Stripe session failed:', stripeResponse.status, stripe.error?.message ?? 'unknown')
    await ledger.from('mps_credit_checkouts').update({ status: 'failed', failure_code: 'stripe_checkout_failed' }).eq('public_id', checkoutId)
    return jsonResponse({ error: { code: 'stripe_checkout_failed', message: 'Secure checkout could not be started.' } }, 502)
  }
  const { error: sessionError } = await ledger.from('mps_credit_checkouts').update({ stripe_checkout_session_id: stripe.id }).eq('public_id', checkoutId)
  if (sessionError) return jsonResponse({ error: { code: 'ledger_unavailable', message: 'Secure checkout could not be recorded.' } }, 503)

  return jsonResponse({ checkoutId, checkoutUrl: stripe.url, credential, credentialPrefix: credential.slice(0, 14),
    creditQuantity: config.creditQuantity, unit: MPS_AUDIT_CREDIT_UNIT, expiresAt,
    secretDisclosure: 'This credential is shown once. The purchase page stores it only in this browser until payment completes.' }, 201)
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: { Allow: 'POST, OPTIONS', 'Cache-Control': 'no-store' } })
}
