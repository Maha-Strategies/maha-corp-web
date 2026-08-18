import { createHypothesisRegistryClient } from '@/lib/celestial-hypotheses/store'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const expected = process.env.CRON_SECRET
  if (!expected || request.headers.get('authorization') !== `Bearer ${expected}`) return Response.json({ error: 'unauthorized' }, { status: 401 })
  const client = createHypothesisRegistryClient()
  if (!client) return Response.json({ error: 'unconfigured' }, { status: 503 })
  const { data, error } = await client.rpc('purge_expired_celestial_reports', { p_limit: 1000 })
  return error ? Response.json({ error: 'purge_failed' }, { status: 502 }) : Response.json({ purged: Number(data ?? 0) })
}
