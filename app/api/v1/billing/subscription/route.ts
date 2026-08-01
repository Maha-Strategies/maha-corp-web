import { bearerApiKey, tenantBillingStateForRawKey } from '@/lib/api-key'
import { createTenantSubscriptionCheckout, isTenantSubscriptionTier, validClientRequestId } from '@/lib/api-credit-billing'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
function json(body: unknown, status = 200) { return Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } }) }

export async function POST(request: Request) {
  const rawKey = bearerApiKey(request); if (!rawKey) return json({ error: { code: 'api_key_required', message: 'Connect an active API key.' } }, 401)
  let body: { tier?: unknown; clientRequestId?: unknown }; try { body = await request.json() as typeof body } catch { return json({ error: { code: 'invalid_json', message: 'Request body must be valid JSON.' } }, 400) }
  if (!isTenantSubscriptionTier(body.tier)) return json({ error: { code: 'invalid_tier', message: 'tier must be builder or scale.' } }, 400)
  if (!validClientRequestId(body.clientRequestId)) return json({ error: { code: 'invalid_client_request_id', message: 'clientRequestId must be 8-120 letters, numbers, underscores, or hyphens.' } }, 400)
  try {
    const state = await tenantBillingStateForRawKey(rawKey); if (!state) return json({ error: { code: 'invalid_api_key', message: 'This API key is invalid or inactive.' } }, 401)
    if (state.stripeSubscriptionId && ['active', 'trialing', 'past_due'].includes(state.subscriptionStatus)) return json({ error: { code: 'subscription_exists', message: 'Manage the existing subscription before changing tiers.' } }, 409)
    const checkout = await createTenantSubscriptionCheckout({ request, state, tier: body.tier, clientRequestId: body.clientRequestId })
    return checkout.kind === 'ready' ? json({ url: checkout.url }) : json({ error: { code: 'checkout_unavailable', message: 'Subscription Checkout is temporarily unavailable.' } }, checkout.kind === 'failed' ? 502 : 503)
  } catch { return json({ error: { code: 'checkout_unavailable', message: 'Subscription Checkout is temporarily unavailable.' } }, 503) }
}

export function OPTIONS() { return new Response(null, { status: 204, headers: { Allow: 'POST, OPTIONS', 'Cache-Control': 'no-store' } }) }
