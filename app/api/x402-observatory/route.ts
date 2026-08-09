import { PUBLIC_X402_OBSERVATORY_RESOURCES } from '@/lib/x402/observatory-registry'
import { getPublicObservatoryEntries } from '@/lib/x402/observatory-store'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const resources = await getPublicObservatoryEntries(PUBLIC_X402_OBSERVATORY_RESOURCES)
  return Response.json({
    schemaVersion: '1.0.0',
    generatedAt: new Date().toISOString(),
    scope: 'x402 protocol and discovery correctness only; not trust, security, quality, or uptime scoring',
    resources: resources.map((resource) => ({
      id: resource.id,
      name: resource.name,
      url: resource.url,
      operator: resource.operator,
      boundedSettlementEnabled: resource.boundedSettlement.enabled,
      latest: resource.latest,
      lastSuccessfulBoundedSettlementAt: resource.lastSuccessfulBoundedSettlementAt,
      lastSuccessfulBoundedSettlementTransaction: resource.lastSuccessfulBoundedSettlementTransaction,
    })),
  }, { headers: { 'Cache-Control': 'public, max-age=60, stale-while-revalidate=300' } })
}
