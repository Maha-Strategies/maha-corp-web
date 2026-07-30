import Stripe from 'stripe'
import { getApiKeyData } from '@/lib/redis'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const PACKS = {
  starter: { priceIdEnvironment: 'STRIPE_API_CREDITS_STARTER_PRICE_ID', credits: 100_000 },
  pro: { priceIdEnvironment: 'STRIPE_API_CREDITS_PRO_PRICE_ID', credits: 600_000 },
  enterprise: { priceIdEnvironment: 'STRIPE_API_CREDITS_ENTERPRISE_PRICE_ID', credits: 3_000_000 },
} as const

type Pack = keyof typeof PACKS

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } })
}

function siteOrigin(request: Request) {
  return process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, '') || new URL(request.url).origin
}

function configuredPriceId(pack: Pack) {
  const value = process.env[PACKS[pack].priceIdEnvironment]?.trim()
  return value && /^price_[A-Za-z0-9]+$/.test(value) ? value : null
}

export async function POST(request: Request) {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY?.trim()
  if (!stripeSecretKey) return json({ error: { code: 'checkout_unavailable', message: 'Credit checkout is not configured.' } }, 503)

  let body: { pack?: unknown; apiKeyId?: unknown }
  try {
    body = await request.json() as { pack?: unknown; apiKeyId?: unknown }
  } catch {
    return json({ error: { code: 'invalid_json', message: 'Request body must be valid JSON.' } }, 400)
  }

  if (typeof body.pack !== 'string' || !(body.pack in PACKS)) {
    return json({ error: { code: 'invalid_pack', message: 'pack must be starter, pro, or enterprise.' } }, 400)
  }
  if (typeof body.apiKeyId !== 'string' || !/^key_[A-Za-z0-9]+$/.test(body.apiKeyId)) {
    return json({ error: { code: 'invalid_api_key_id', message: 'apiKeyId must be a valid API key identifier.' } }, 400)
  }

  try {
    const keyData = await getApiKeyData(body.apiKeyId)
    if (!keyData || keyData.status !== 'active') {
      return json({ error: { code: 'invalid_api_key', message: 'This API key is invalid or inactive.' } }, 404)
    }

    const pack = body.pack as Pack
    const { credits } = PACKS[pack]
    const priceId = configuredPriceId(pack)
    if (!priceId) return json({ error: { code: 'checkout_unavailable', message: 'This credit pack is not configured.' } }, 503)
    const origin = siteOrigin(request)
    const dashboardUrl = new URL('/dashboard', origin)
    dashboardUrl.searchParams.set('apiKeyId', body.apiKeyId)
    dashboardUrl.searchParams.set('status', 'success')
    const cancelUrl = new URL('/dashboard', origin)
    cancelUrl.searchParams.set('apiKeyId', body.apiKeyId)

    const stripe = new Stripe(stripeSecretKey, { apiVersion: '2026-06-24.dahlia' })
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      metadata: { pack, api_key_id: body.apiKeyId, credits: String(credits) },
      success_url: dashboardUrl.toString(),
      cancel_url: cancelUrl.toString(),
    })

    if (!session.url) throw new Error('Stripe did not return a Checkout URL.')
    return json({ url: session.url })
  } catch (error) {
    console.error('[STRIPE_CHECKOUT_ERROR]', error)
    return json({ error: { code: 'checkout_unavailable', message: 'Secure checkout could not be created.' } }, 503)
  }
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: { Allow: 'POST, OPTIONS', 'Cache-Control': 'no-store' } })
}
