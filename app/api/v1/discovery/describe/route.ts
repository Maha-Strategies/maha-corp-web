import { describeById, localDiscovery } from '@/lib/api-v1/discovery'
import { apiJson, apiFailure } from '@/lib/api-v1/with402Payment'
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export function GET(request: Request) {
  const p = new URL(request.url).searchParams
  if ([...p.keys()].some(k => k !== 'id') || p.getAll('id').length !== 1 || p.get('id')!.length > 160) return apiFailure('invalid_endpoint_id', 400)
  const endpoint = describeById(p.get('id')!, localDiscovery())
  return endpoint ? apiJson(endpoint) : apiFailure('endpoint_not_discoverable', 404)
}
