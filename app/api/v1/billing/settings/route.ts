import { bearerApiKey, setTenantAutoTopup, tenantBillingStateForRawKey } from '@/lib/api-key'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
function json(body: unknown, status = 200) { return Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } }) }

export async function GET(request: Request) {
  const rawKey = bearerApiKey(request); if (!rawKey) return json({ error: { code: 'api_key_required', message: 'Connect an active API key.' } }, 401)
  try { const state = await tenantBillingStateForRawKey(rawKey); return state ? json({ tenantId: state.tenantId, tier: state.tier, subscriptionStatus: state.subscriptionStatus, subscriptionCredits: state.subscriptionCredits, topupCredits: state.topupCredits, autoTopupEnabled: state.autoTopupEnabled, canEnableAutoTopup: Boolean(state.stripeCustomerId && state.stripePaymentMethodId && state.subscriptionStatus === 'active') }) : json({ error: { code: 'invalid_api_key', message: 'This API key is invalid or inactive.' } }, 401) }
  catch { return json({ error: { code: 'billing_unavailable', message: 'Billing settings are temporarily unavailable.' } }, 503) }
}

export async function POST(request: Request) {
  const rawKey = bearerApiKey(request); if (!rawKey) return json({ error: { code: 'api_key_required', message: 'Connect an active API key.' } }, 401)
  let body: { autoTopupEnabled?: unknown }; try { body = await request.json() as typeof body } catch { return json({ error: { code: 'invalid_json', message: 'Request body must be valid JSON.' } }, 400) }
  if (typeof body.autoTopupEnabled !== 'boolean') return json({ error: { code: 'invalid_setting', message: 'autoTopupEnabled must be a boolean.' } }, 400)
  try { const result = await setTenantAutoTopup(rawKey, body.autoTopupEnabled); if (!result) return json({ error: { code: 'invalid_api_key', message: 'This API key is invalid or inactive.' } }, 401); if (result.kind === 'payment_method_required') return json({ error: { code: 'payment_method_required', message: 'An active subscription with a saved default payment method is required.' } }, 409); return json({ autoTopupEnabled: result.state.autoTopupEnabled }) }
  catch { return json({ error: { code: 'billing_unavailable', message: 'Billing settings are temporarily unavailable.' } }, 503) }
}

export function OPTIONS() { return new Response(null, { status: 204, headers: { Allow: 'GET, POST, OPTIONS', 'Cache-Control': 'no-store' } }) }
