import { timingSafeEqual } from 'node:crypto'

import { SCOUT_MAX_RESULTS } from '@/lib/market-scout'
import { ScoutConfigError, configuredScoutSources } from '@/lib/market-scout-sources'
import { globalFetchImpl, httpQueueSubmitter, runMarketScout } from '@/lib/market-scout-runner'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

// Bounded, scheduled Outbound Scout run. Added only after the manual trigger path
// (POST /api/admin/market-scout) and its tests. READ-ONLY discovery → proposals to
// the private queue. No outreach, publishing, spend, or deployment.
function authorized(request: Request): boolean {
  const token = process.env.CRON_SECRET
  const supplied = request.headers.get('authorization')?.replace(/^Bearer\s+/, '')
  if (!token || !supplied) return false
  const expected = Buffer.from(token), actual = Buffer.from(supplied)
  return expected.length === actual.length && timingSafeEqual(expected, actual)
}

export async function GET(request: Request) {
  if (!authorized(request)) return Response.json({ error: 'Unauthorized.' }, { status: 401 })

  const token = process.env.MARKET_MAPPING_TOKEN
  if (!token) return Response.json({ error: 'Scout not configured.' }, { status: 503 }) // fail closed

  let sources
  try { sources = configuredScoutSources() } // fail closed on missing source credential
  catch (error) { return Response.json({ error: error instanceof ScoutConfigError ? error.message : 'Scout not configured.' }, { status: 503 }) }

  const origin = new URL(request.url).origin
  try {
    const summary = await runMarketScout({
      fetchImpl: globalFetchImpl,
      submit: httpQueueSubmitter(origin, token),
      sources,
      limit: SCOUT_MAX_RESULTS,
    })
    return Response.json({ scout: summary })
  } catch (error) {
    if (error instanceof ScoutConfigError) return Response.json({ error: error.message }, { status: 503 })
    console.error('Scheduled market scout failed:', error instanceof Error ? error.message : 'unknown_error')
    return Response.json({ error: 'Scout run failed.' }, { status: 502 })
  }
}
