import { searchEndpoints, localDiscovery } from '@/lib/api-v1/discovery'
import { apiJson, apiFailure, API_HEADERS } from '@/lib/api-v1/with402Payment'
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export function GET(request: Request) {
  const p = new URL(request.url).searchParams
  if ([...p.keys()].some(k => !['q', 'domain', 'limit'].includes(k)) || [...new Set(p.keys())].some(k => p.getAll(k).length !== 1)) return apiFailure('invalid_search_parameters', 400)
  try { return apiJson(searchEndpoints({ q: p.get('q') ?? '', ...(p.has('domain') ? { domain: p.get('domain') } : {}),
    limit: p.has('limit') ? Number(p.get('limit')) : 5 }, { local: localDiscovery() })) } catch { return apiFailure('invalid_search_parameters', 400) }
}
export const OPTIONS = () => new Response(null, { status: 204, headers: API_HEADERS })
