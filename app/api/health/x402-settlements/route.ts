import { readPublicSettlementLedger } from '@/lib/x402/settlement-live-store'
import { settlementHealth } from '@/lib/x402/settlement-health'

export const runtime = 'nodejs'

export async function GET() {
  const health = settlementHealth(await readPublicSettlementLedger())
  return Response.json(health, {
    status: health.status === 'healthy' ? 200 : 503,
    headers: { 'Cache-Control': 'no-store' },
  })
}
