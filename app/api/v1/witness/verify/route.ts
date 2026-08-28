import { authenticateWitnessRegistry, verifyWitnessRegistryRequest } from '@/lib/computational-witness-registry'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  return verifyWitnessRegistryRequest(request, authenticateWitnessRegistry)
}
