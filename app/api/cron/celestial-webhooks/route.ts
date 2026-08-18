import { createHypothesisRegistryClient } from '@/lib/celestial-hypotheses/store'
import { deliverPendingWebhooks } from '@/lib/celestial-enterprise/webhooks'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const expected = process.env.CRON_SECRET
  if (!expected || request.headers.get('authorization') !== `Bearer ${expected}`) return Response.json({ error: 'unauthorized' }, { status: 401 })
  const client = createHypothesisRegistryClient()
  if (!client) return Response.json({ error: 'unconfigured' }, { status: 503 })
  try { return Response.json(await deliverPendingWebhooks(client)) }
  catch { return Response.json({ error: 'delivery_failed' }, { status: 502 }) }
}
