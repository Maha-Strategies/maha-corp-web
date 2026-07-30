import { ApiKeyConfigurationError, apiKeyDataRedisKey, consumeProvisioningLimit, apiKeyServiceConfigured, hashApiKey, provisionStarterKey, UpstashRedisError } from '@/lib/api-key'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
function json(body: unknown, status = 200) { return Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } }) }

function infrastructureError(error: unknown) {
  if (error instanceof ApiKeyConfigurationError) return { code: 'api_key_configuration_missing', message: 'API key provisioning is temporarily unavailable.' }
  if (error instanceof UpstashRedisError) return { code: error.code, message: 'API key provisioning is temporarily unavailable.' }
  return { code: 'api_key_provisioning_failed', message: 'API key provisioning is temporarily unavailable.' }
}

export async function POST(request: Request) {
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) return json({ error: { code: 'unsupported_media_type', message: 'Content-Type must be application/json.' } }, 415)
  let body: { email?: unknown }; try { body = await request.json() as { email?: unknown } } catch { return json({ error: { code: 'invalid_json', message: 'Request body must be valid JSON.' } }, 400) }
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return json({ error: { code: 'invalid_email', message: 'Provide a valid email address.' } }, 400)
  if (!apiKeyServiceConfigured()) { console.error('[KEY_GEN_CONFIG_MISSING] UPSTASH_REDIS_REST_URL or TOKEN is undefined in process.env'); return json({ error: { code: 'api_key_configuration_missing', message: 'API key provisioning is temporarily unavailable.' } }, 503) }
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown'
  try {
    if (!await consumeProvisioningLimit(ip)) return json({ error: { code: 'provisioning_rate_limited', message: 'Free key generation is temporarily limited. Retry later.' } }, 429)
    const result = await provisionStarterKey(email)
    if (process.env.API_KEY_DIAGNOSTICS === 'true') {
      const keyHash = await hashApiKey(result.key)
      const redisKey = apiKeyDataRedisKey(keyHash)
      console.log('[KEY_GEN_DEBUG]', { rawKeyPrefix: result.key.slice(0, 12), hash: keyHash, redisKey })
      console.log('[HASH_COMPARE]', { targetRedisKey: redisKey })
    }
    return json({ apiKey: result.key, apiKeyId: result.keyId, balanceCredits: result.balanceCredits, tier: result.tier, disclosure: 'Copy this API key now. It is not stored in the browser or returned by this endpoint again.' }, 201)
  } catch (error) { console.error('[KEY_GEN_ERROR]', error); return json({ error: infrastructureError(error) }, 503) }
}
export function OPTIONS() { return new Response(null, { status: 204, headers: { Allow: 'POST, OPTIONS', 'Cache-Control': 'no-store' } }) }
