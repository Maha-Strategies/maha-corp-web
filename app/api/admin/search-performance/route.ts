import { jsonResponse } from '@/lib/agent-inquiries'
import { createAgentInquiryLedger } from '@/lib/agent-inquiry-ledger'
import { authorizeMarketMapping } from '@/lib/market-mapping'
import { searchPerformanceInsights, type SearchPerformanceSnapshot } from '@/lib/search-performance-feedback'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function summary(rows: SearchPerformanceSnapshot[]) {
  const impressions = rows.reduce((total, row) => total + row.impressions, 0)
  const clicks = rows.reduce((total, row) => total + row.clicks, 0)
  const weightedPosition = impressions > 0 ? rows.reduce((total, row) => total + row.position * row.impressions, 0) / impressions : null
  return {
    queries: rows.length,
    clicks,
    impressions,
    ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
    position: weightedPosition,
  }
}

export async function GET(request: Request) {
  const authorization = authorizeMarketMapping(request)
  if (!authorization.authorized) return jsonResponse({ error: { code: 'unauthorized', message: 'A valid market-mapping bearer token is required.' } }, 401)
  const ledger = createAgentInquiryLedger()
  if (!ledger) return jsonResponse({ error: { code: 'search_performance_unavailable', message: 'Search performance storage is unavailable.' } }, 503)
  const { data, error } = await ledger.from('search_console_query_snapshots').select('observed_on,query,clicks,impressions,ctr,position').order('observed_on', { ascending: false }).limit(10_000)
  if (error) return jsonResponse({ error: { code: 'search_performance_unavailable', message: 'Search performance storage is unavailable. Apply the feedback migration first.' } }, 503)
  const snapshots = (data ?? []).map((row): SearchPerformanceSnapshot => ({ observedOn: row.observed_on, query: row.query, clicks: row.clicks, impressions: row.impressions, ctr: Number(row.ctr), position: Number(row.position) }))
  const latestObservedOn = snapshots.reduce((latest, row) => row.observedOn > latest ? row.observedOn : latest, '')
  const observationDates = [...new Set(snapshots.map((row) => row.observedOn))].sort((left, right) => right.localeCompare(left))
  const previousObservedOn = observationDates[1] ?? null
  const latestRows = snapshots.filter((row) => row.observedOn === latestObservedOn).sort((left, right) => right.impressions - left.impressions || right.clicks - left.clicks || left.query.localeCompare(right.query))
  const previousRows = snapshots.filter((row) => row.observedOn === previousObservedOn)
  const previousByQuery = new Map(previousRows.map((row) => [row.query, row]))
  const topQueries = latestRows.slice(0, 100).map((row) => ({ ...row, previous: previousByQuery.get(row.query) ?? null }))
  return jsonResponse({
    latestObservedOn: latestObservedOn || null,
    previousObservedOn,
    snapshots: snapshots.length,
    latest: summary(latestRows),
    previous: previousObservedOn ? summary(previousRows) : null,
    topQueries,
    insights: searchPerformanceInsights(snapshots),
    autonomousPublishingSupported: false,
  }, 200)
}

export function OPTIONS() { return new Response(null, { status: 204, headers: { Allow: 'GET, OPTIONS', 'Cache-Control': 'no-store' } }) }
