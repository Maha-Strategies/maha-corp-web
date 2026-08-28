import { authenticateWitnessRegistry, createWitnessRegistryHandlers, WITNESS_RESPONSE_HEADERS } from '@/lib/computational-witness-registry'
import { productionWitnessRegistryStore } from '@/lib/computational-witness-registry-store'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function handlers() {
  const store = productionWitnessRegistryStore()
  return store ? createWitnessRegistryHandlers({ authenticate: authenticateWitnessRegistry, store }) : null
}

export async function GET(request: Request, context: RouteContext<'/api/v1/witness/receipts/[receiptSha256]'>) {
  const registry = handlers()
  if (!registry) return Response.json({ error: { code: 'witness_registry_unavailable', message: 'Witness registry is not configured.' } }, { status: 503, headers: WITNESS_RESPONSE_HEADERS })
  const { receiptSha256 } = await context.params
  return registry.read(request, receiptSha256)
}

export async function DELETE(request: Request, context: RouteContext<'/api/v1/witness/receipts/[receiptSha256]'>) {
  const registry = handlers()
  if (!registry) return Response.json({ error: { code: 'witness_registry_unavailable', message: 'Witness registry is not configured.' } }, { status: 503, headers: WITNESS_RESPONSE_HEADERS })
  const { receiptSha256 } = await context.params
  return registry.purge(request, receiptSha256)
}
