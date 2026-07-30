import { bearerApiKey, getApiKeyRecordForRawKey } from '@/lib/api-key'
import { createOrRecoverApiCreditCheckout, isApiCreditPack, validClientRequestId } from '@/lib/api-credit-billing'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function json(body: unknown, status = 200) { return Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } }) }

export async function POST(request: Request) {
  const rawKey = bearerApiKey(request)
  if (!rawKey) return json({ error: { code: 'api_key_required', message: 'Connect an active API key before starting Checkout.' } }, 401)
  let body: { pack?: unknown; clientRequestId?: unknown }
  try { body = await request.json() as { pack?: unknown; clientRequestId?: unknown } }
  catch { return json({ error: { code: 'invalid_json', message: 'Request body must be valid JSON.' } }, 400) }
  if (!isApiCreditPack(body.pack)) return json({ error: { code: 'invalid_pack', message: 'pack must be starter, pro, or enterprise.' } }, 400)
  if (!validClientRequestId(body.clientRequestId)) return json({ error: { code: 'invalid_client_request_id', message: 'clientRequestId must contain 8-120 URL-safe characters.' } }, 400)
  try {
    const record = await getApiKeyRecordForRawKey(rawKey)
    if (!record || record.status !== 'active') return json({ error: { code: 'invalid_api_key', message: 'This API key is invalid or inactive.' } }, 401)
    const checkout = await createOrRecoverApiCreditCheckout({ request, apiKeyId: record.key_id, pack: body.pack, clientRequestId: body.clientRequestId })
    if (checkout.kind === 'ready') return json({ url: checkout.url, idempotentReplay: checkout.idempotentReplay })
    if (checkout.kind === 'conflict') return json({ error: { code: 'idempotency_conflict', message: 'This request ID was already used for another credit pack.' } }, 409)
    if (checkout.kind === 'paid') return json({ error: { code: 'checkout_already_paid', message: 'This Checkout request has already completed.' } }, 409)
    if (checkout.kind === 'failed') return json({ error: { code: 'checkout_failed', message: 'Secure checkout could not be created. Start a new request.' } }, 502)
    return json({ error: { code: 'checkout_unavailable', message: 'Billing infrastructure is temporarily unavailable.' } }, 503)
  } catch {
    return json({ error: { code: 'checkout_unavailable', message: 'Billing infrastructure is temporarily unavailable.' } }, 503)
  }
}

export function OPTIONS() { return new Response(null, { status: 204, headers: { Allow: 'POST, OPTIONS', 'Cache-Control': 'no-store' } }) }
