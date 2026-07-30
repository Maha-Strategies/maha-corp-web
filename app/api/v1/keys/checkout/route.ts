import { bearerApiKey, getApiKeyRecordForRawKey } from '@/lib/api-key'
import { createOrRecoverApiCreditCheckout, type ApiCreditPack, validClientRequestId } from '@/lib/api-credit-billing'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
const LEGACY_PACKS: Record<string, ApiCreditPack> = { starter: 'starter', builder: 'pro', scale: 'enterprise', pro: 'pro', enterprise: 'enterprise' }
function json(body: unknown, status = 200) { return Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } }) }

export async function POST(request: Request) {
  const key = bearerApiKey(request); if (!key) return json({ error: { code: 'api_key_required', message: 'Provide Authorization: Bearer <API_KEY>.' } }, 401)
  let body: { pack?: unknown; clientRequestId?: unknown }; try { body = await request.json() as typeof body } catch { return json({ error: { code: 'invalid_json', message: 'Request body must be valid JSON.' } }, 400) }
  if (typeof body.pack !== 'string' || !LEGACY_PACKS[body.pack]) return json({ error: { code: 'invalid_pack', message: 'pack must be starter, builder, scale, pro, or enterprise.' } }, 400)
  if (!validClientRequestId(body.clientRequestId)) return json({ error: { code: 'invalid_client_request_id', message: 'clientRequestId must contain 8-120 URL-safe characters.' } }, 400)
  try {
    const record = await getApiKeyRecordForRawKey(key); if (!record) return json({ error: { code: 'invalid_api_key', message: 'This API key is invalid or inactive.' } }, 401)
    const checkout = await createOrRecoverApiCreditCheckout({ request, apiKeyId: record.key_id, pack: LEGACY_PACKS[body.pack], clientRequestId: body.clientRequestId })
    if (checkout.kind === 'ready') return json({ checkoutUrl: checkout.url, pack: body.pack, idempotentReplay: checkout.idempotentReplay })
    if (checkout.kind === 'conflict') return json({ error: { code: 'idempotency_conflict', message: 'clientRequestId was already used for another pack.' } }, 409)
    if (checkout.kind === 'paid') return json({ error: { code: 'checkout_already_paid', message: 'This Checkout request has already completed.' } }, 409)
    return json({ error: { code: 'checkout_unavailable', message: 'Secure checkout is temporarily unavailable.' } }, checkout.kind === 'failed' ? 502 : 503)
  } catch { return json({ error: { code: 'checkout_unavailable', message: 'Secure checkout is temporarily unavailable.' } }, 503) }
}
export function OPTIONS() { return new Response(null, { status: 204, headers: { Allow: 'POST, OPTIONS', 'Cache-Control': 'no-store' } }) }
