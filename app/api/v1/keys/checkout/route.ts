import Stripe from 'stripe'
import { bearerApiKey, getApiKeyRecord, sha256 } from '@/lib/api-key'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
const PACKS = { starter: { name: 'Starter Pack', amountCents: 1000, credits: 100_000 }, builder: { name: 'Builder Pack', amountCents: 5000, credits: 600_000 }, scale: { name: 'Scale Pack', amountCents: 20_000, credits: 3_000_000 } } as const
type PackId = keyof typeof PACKS
function json(body: unknown, status = 200) { return Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } }) }
export async function POST(request: Request) {
  const secret = process.env.STRIPE_SECRET_KEY; if (!secret) return json({ error: { code: 'checkout_unavailable', message: 'Credit checkout is not configured.' } }, 503)
  const key = bearerApiKey(request); if (!key) return json({ error: { code: 'api_key_required', message: 'Provide the API key being topped up as a Bearer token.' } }, 401)
  let body: { pack?: unknown }; try { body = await request.json() as { pack?: unknown } } catch { return json({ error: { code: 'invalid_json', message: 'Request body must be valid JSON.' } }, 400) }
  if (typeof body.pack !== 'string' || !(body.pack in PACKS)) return json({ error: { code: 'invalid_pack', message: 'pack must be starter, builder, or scale.' } }, 400)
  const record = await getApiKeyRecord(await sha256(key)); if (!record || record.status !== 'active') return json({ error: { code: 'invalid_api_key', message: 'The supplied API key is invalid or inactive.' } }, 401)
  const pack = PACKS[body.pack as PackId]; const origin = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.mahastrategies.com'
  try { const stripe = new Stripe(secret); const session = await stripe.checkout.sessions.create({ mode: 'payment', success_url: `${origin}/tools/token-calc?checkout=success`, cancel_url: `${origin}/tools/token-calc?checkout=cancelled`, metadata: { api_key_id: record.key_id, credits: String(pack.credits), pack: body.pack }, line_items: [{ quantity: 1, price_data: { currency: 'usd', product_data: { name: `Maha API Credits — ${pack.name}` }, unit_amount: pack.amountCents } }] })
    if (!session.url) throw new Error('Stripe did not return a checkout URL.'); return json({ checkoutUrl: session.url, pack: body.pack, credits: pack.credits })
  } catch { return json({ error: { code: 'checkout_unavailable', message: 'Secure checkout could not be created.' } }, 503) }
}
export function OPTIONS() { return new Response(null, { status: 204, headers: { Allow: 'POST, OPTIONS', 'Cache-Control': 'no-store' } }) }
