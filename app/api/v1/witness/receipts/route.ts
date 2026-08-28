import { authenticateWitnessRegistry, createWitnessRegistryHandlers, WITNESS_RESPONSE_HEADERS } from '@/lib/computational-witness-registry'
import { productionWitnessRegistryStore } from '@/lib/computational-witness-registry-store'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const store = productionWitnessRegistryStore()
  if (!store) return Response.json({ error: { code: 'witness_registry_unavailable', message: 'Witness registry is not configured.' } }, { status: 503, headers: WITNESS_RESPONSE_HEADERS })
  return createWitnessRegistryHandlers({ authenticate: authenticateWitnessRegistry, store }).submit(request)
}
