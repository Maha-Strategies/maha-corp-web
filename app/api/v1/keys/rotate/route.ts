import { bearerApiKey, rotateApiKey, UpstashRedisError } from '@/lib/api-key'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
function json(body: unknown, status = 200) { return Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } }) }

export async function POST(request: Request) {
  const rawKey = bearerApiKey(request)
  if (!rawKey) return json({ error: { code: 'api_key_required', message: 'Provide Authorization: Bearer <API_KEY>.' } }, 401)
  try {
    const replacement = await rotateApiKey(rawKey)
    if (!replacement) return json({ error: { code: 'invalid_api_key', message: 'This API key is invalid or inactive.' } }, 401)
    return json({ apiKey: replacement.key, apiKeyId: replacement.keyId, balanceCredits: replacement.balanceCredits, tier: replacement.tier, disclosure: 'Copy this replacement key now. The previous key has been permanently revoked and this value cannot be retrieved again.' }, 201)
  } catch (error) {
    if (error instanceof UpstashRedisError) return json({ error: { code: error.code, message: 'API key rotation is temporarily unavailable.' } }, 503)
    return json({ error: { code: 'api_key_rotation_unavailable', message: 'API key rotation is temporarily unavailable.' } }, 503)
  }
}

export function OPTIONS() { return new Response(null, { status: 204, headers: { Allow: 'POST, OPTIONS', 'Cache-Control': 'no-store' } }) }
