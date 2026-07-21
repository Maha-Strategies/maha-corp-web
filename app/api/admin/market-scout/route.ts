import { jsonResponse } from '@/lib/agent-inquiries'
import { authorizeMarketMapping } from '@/lib/market-mapping'
import { ScoutConfigError, configuredScoutSources } from '@/lib/market-scout-sources'
import { globalFetchImpl, httpQueueSubmitter, runMarketScout } from '@/lib/market-scout-runner'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

// Manual trigger for a bounded, READ-ONLY Outbound Scout run. It discovers signals
// from approved sources and submits scored PROPOSALS to the private market-mapping
// queue. It performs no outreach, publishing, spend, or deployment.
export async function POST(request: Request) {
  const auth = authorizeMarketMapping(request)
  if (!auth.authorized || !auth.actorFingerprint) {
    // Fail closed: missing/invalid MARKET_MAPPING_TOKEN cannot trigger a run.
    return jsonResponse({ error: { code: 'unauthorized', message: 'A valid market-mapping bearer token is required.' } }, 401)
  }

  let limit: number | undefined
  if (request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
    try {
      const body = await request.json() as { limit?: unknown }
      if (typeof body.limit === 'number' && Number.isFinite(body.limit)) limit = body.limit
    } catch { return jsonResponse({ error: { code: 'invalid_request', message: 'Request body must be valid JSON.' } }, 400) }
  }

  const token = process.env.MARKET_MAPPING_TOKEN
  if (!token) return jsonResponse({ error: { code: 'scout_unavailable', message: 'The scout is not configured.' } }, 503)

  let sources
  try { sources = configuredScoutSources() } // fail closed on missing source credential
  catch (error) {
    if (error instanceof ScoutConfigError) return jsonResponse({ error: { code: 'scout_unavailable', message: error.message } }, 503)
    return jsonResponse({ error: { code: 'scout_unavailable', message: 'The scout is not configured.' } }, 503)
  }

  const origin = new URL(request.url).origin
  try {
    const summary = await runMarketScout({
      fetchImpl: globalFetchImpl,
      submit: httpQueueSubmitter(origin, token),
      sources,
      limit,
    })
    return jsonResponse({ scout: summary, autonomousOutreachSupported: false, autonomousSpendSupported: false, autonomousPublishingSupported: false }, 200)
  } catch (error) {
    if (error instanceof ScoutConfigError) return jsonResponse({ error: { code: 'scout_unavailable', message: error.message } }, 503)
    console.error('Market scout run failed:', error instanceof Error ? error.message : 'unknown_error')
    return jsonResponse({ error: { code: 'scout_run_failed', message: 'The scout run could not be completed.' } }, 502)
  }
}

export function OPTIONS() { return new Response(null, { status: 204, headers: { Allow: 'POST, OPTIONS', 'Cache-Control': 'no-store' } }) }
