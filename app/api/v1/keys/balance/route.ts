import { bearerApiKey, getApiKeyRecordForRawKey, tenantBalanceForRawKey } from '@/lib/api-key'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const rawKey = bearerApiKey(request)
  if (!rawKey) return Response.json({ error: { code: 'api_key_required', message: 'Provide Authorization: Bearer <API_KEY>.' } }, { status: 401 })
  try {
    const record = await getApiKeyRecordForRawKey(rawKey)
    if (!record || record.status !== 'active') return Response.json({ error: { code: 'invalid_api_key', message: 'This API key is invalid or inactive.' } }, { status: 401 })
    const tenant = await tenantBalanceForRawKey(rawKey)
    if (!tenant) return Response.json({ error: { code: 'invalid_api_key', message: 'This API key is invalid or inactive.' } }, { status: 401 })
    return Response.json({ api_key_id: record.key_id, tenant_id: tenant.tenantId, balance_credits: tenant.balanceCredits, subscription_credits: tenant.subscriptionCredits, topup_credits: tenant.topupCredits, tier: tenant.tier }, { headers: { 'Cache-Control': 'no-store' } })
  } catch {
    return Response.json({ error: { code: 'api_key_service_unavailable', message: 'API authorization is temporarily unavailable.' } }, { status: 503 })
  }
}
