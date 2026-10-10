import { authorizeObservatoryCron } from '@/lib/x402/observatory-cron'
import { refreshStoredSettlements, settlementStore } from '@/lib/x402/settlement-live-store'
import { settlementRefreshFailure } from '@/lib/x402/settlement-rpc'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function GET(request: Request) {
  if (!authorizeObservatoryCron(request)) return Response.json({ error: 'Unauthorized.' }, { status: 401 })
  if (process.env.VERCEL_ENV !== 'production') return Response.json({ error: 'Production refresh only.' }, { status: 409 })
  try {
    return Response.json(await refreshStoredSettlements(settlementStore()), { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error('Scheduled settlement refresh failed; previous snapshot retained.', { reason: settlementRefreshFailure(error) })
    return Response.json({ error: 'Settlement refresh unavailable; previous snapshot retained.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } })
  }
}
