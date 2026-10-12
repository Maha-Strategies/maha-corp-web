import { authorizeObservatoryCron } from '@/lib/x402/observatory-cron'
import { refreshAllStoredSettlements } from '@/lib/x402/settlement-live-store'
import { settlementRefreshFailure } from '@/lib/x402/settlement-rpc'
import { pruneDiscoveryAttribution } from '@/lib/x402/discovery-attribution'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function GET(request: Request) {
  if (!authorizeObservatoryCron(request)) return Response.json({ error: 'Unauthorized.' }, { status: 401 })
  if (process.env.VERCEL_ENV !== 'production') return Response.json({ error: 'Production refresh only.' }, { status: 409 })
  // Cleanup remains independent of scan success and cannot discard its snapshot.
  const attributionRetention = await pruneDiscoveryAttribution()
  if (!attributionRetention.available || attributionRetention.expiredRemaining) console.error('x402 attribution retention needs attention.')
  try {
    const result = await refreshAllStoredSettlements()
    return Response.json({ ...result, attributionRetention }, { status: result.status === 'degraded' ? 503 : 200, headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error('Scheduled settlement refresh failed; previous snapshot retained.', { reason: settlementRefreshFailure(error) })
    return Response.json({ error: 'Settlement refresh unavailable; previous snapshot retained.', attributionRetention }, { status: 503, headers: { 'Cache-Control': 'no-store' } })
  }
}
