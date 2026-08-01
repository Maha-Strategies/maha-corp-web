import { bearerApiKey, revokeApiKey, UpstashRedisError } from '@/lib/api-key'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
function json(body: unknown, status = 200) { return Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } }) }

export async function POST(request: Request) {
  const rawKey = bearerApiKey(request)
  if (!rawKey) return json({ error: { code: 'api_key_required', message: 'Provide Authorization: Bearer <API_KEY>.' } }, 401)
  try {
    if (!await revokeApiKey(rawKey)) return json({ error: { code: 'invalid_api_key', message: 'This API key is invalid or inactive.' } }, 401)
    return json({ revoked: true })
  } catch (error) {
    if (error instanceof UpstashRedisError) return json({ error: { code: error.code, message: 'API key revocation is temporarily unavailable.' } }, 503)
    return json({ error: { code: 'api_key_revocation_unavailable', message: 'API key revocation is temporarily unavailable.' } }, 503)
  }
}

export function OPTIONS() { return new Response(null, { status: 204, headers: { Allow: 'POST, OPTIONS', 'Cache-Control': 'no-store' } }) }
