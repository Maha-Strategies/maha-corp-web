import { apiKeyDataRedisKey, bearerApiKey, getApiKeyRecordForRawKey, hashApiKey } from '@/lib/api-key'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  if (process.env.API_KEY_DIAGNOSTICS === 'true') {
    const incomingHeaders = Object.fromEntries(request.headers.entries())
    if (incomingHeaders.authorization) incomingHeaders.authorization = '[REDACTED]'
    console.log('[DEBUG_INCOMING_HEADERS]', incomingHeaders)
  }
  const authHeader = request.headers.get('authorization')
  const rawKey = bearerApiKey(request)
  const keyHash = rawKey ? await hashApiKey(rawKey) : null
  const redisKey = keyHash ? apiKeyDataRedisKey(keyHash) : null
  if (process.env.API_KEY_DIAGNOSTICS === 'true') {
    // Deliberately never log authHeader itself: it contains a reusable secret.
    console.log('[KEY_BAL_DEBUG]', {
      authHeaderPresent: Boolean(authHeader),
      authScheme: authHeader?.match(/^\s*([^\s]+)/)?.[1] ?? null,
      parsedRawKeyPrefix: rawKey?.slice(0, 12),
      computedHash: keyHash,
    })
    console.log('[HASH_COMPARE]', { targetRedisKey: redisKey })
  }
  if (!rawKey) return Response.json({ error: { code: 'api_key_required', message: 'Provide Authorization: Bearer <API_KEY>.' } }, { status: 401 })
  try {
    const record = await getApiKeyRecordForRawKey(rawKey)
    if (!record || record.status !== 'active') return Response.json({ error: { code: 'invalid_api_key', message: 'This API key is invalid or inactive.' } }, { status: 401 })
    return Response.json({ balance_credits: Number(record.balance_credits), tier: record.tier }, { headers: { 'Cache-Control': 'no-store' } })
  } catch {
    return Response.json({ error: { code: 'api_key_service_unavailable', message: 'API authorization is temporarily unavailable.' } }, { status: 503 })
  }
}
