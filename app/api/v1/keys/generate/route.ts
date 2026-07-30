import { consumeProvisioningLimit, provisionStarterKey } from '@/lib/api-key'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
function json(body: unknown, status = 200) { return Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } }) }
export async function POST(request: Request) {
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) return json({ error: { code: 'unsupported_media_type', message: 'Content-Type must be application/json.' } }, 415)
  let body: { email?: unknown }; try { body = await request.json() as { email?: unknown } } catch { return json({ error: { code: 'invalid_json', message: 'Request body must be valid JSON.' } }, 400) }
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return json({ error: { code: 'invalid_email', message: 'Provide a valid email address.' } }, 400)
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown'
  if (!await consumeProvisioningLimit(ip)) return json({ error: { code: 'provisioning_rate_limited', message: 'Free key generation is temporarily limited. Retry later.' } }, 429)
  try { const result = await provisionStarterKey(email); return json({ apiKey: result.key, apiKeyId: result.keyId, balanceCredits: result.balanceCredits, tier: result.tier, disclosure: 'Copy this API key now. It is not stored in the browser or returned by this endpoint again.' }, 201) } catch { return json({ error: { code: 'key_provisioning_unavailable', message: 'API key provisioning is temporarily unavailable.' } }, 503) }
}
export function OPTIONS() { return new Response(null, { status: 204, headers: { Allow: 'POST, OPTIONS', 'Cache-Control': 'no-store' } }) }
