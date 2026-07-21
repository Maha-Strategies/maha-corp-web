import { jsonResponse } from '@/lib/agent-inquiries'
import { createAgentInquiryLedger } from '@/lib/agent-inquiry-ledger'
import { authorizeMarketMapping } from '@/lib/market-mapping'
import { searchPerformanceInsights, type SearchPerformanceSnapshot } from '@/lib/search-performance-feedback'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const authorization = authorizeMarketMapping(request)
  if (!authorization.authorized) return jsonResponse({ error: { code: 'unauthorized', message: 'A valid market-mapping bearer token is required.' } }, 401)
  const ledger = createAgentInquiryLedger()
  if (!ledger) return jsonResponse({ error: { code: 'search_performance_unavailable', message: 'Search performance storage is unavailable.' } }, 503)
  const { data, error } = await ledger.from('search_console_query_snapshots').select('observed_on,query,clicks,impressions,ctr,position').order('observed_on', { ascending: false }).limit(10_000)
  if (error) return jsonResponse({ error: { code: 'search_performance_unavailable', message: 'Search performance storage is unavailable. Apply the feedback migration first.' } }, 503)
  const snapshots = (data ?? []).map((row): SearchPerformanceSnapshot => ({ observedOn: row.observed_on, query: row.query, clicks: row.clicks, impressions: row.impressions, ctr: Number(row.ctr), position: Number(row.position) }))
  const latestObservedOn = snapshots.reduce((latest, row) => row.observedOn > latest ? row.observedOn : latest, '')
  return jsonResponse({ latestObservedOn: latestObservedOn || null, snapshots: snapshots.length, insights: searchPerformanceInsights(snapshots), autonomousPublishingSupported: false }, 200)
}

export function OPTIONS() { return new Response(null, { status: 204, headers: { Allow: 'GET, OPTIONS', 'Cache-Control': 'no-store' } }) }
