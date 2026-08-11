import { jsonResponse } from '@/lib/agent-inquiries'
import { inboundOperationsAuthorized } from '@/lib/inbound-operations'
import { httpNavigatorDraftSubmitter, runNavigatorRegistryScout } from '@/lib/navigator-registry-runner'
import { NavigatorRegistryConfigError, configuredNavigatorRegistrySources } from '@/lib/navigator-registry-sources'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

// Manual, bounded registry research. It reads public machine catalogs and
// writes evidence-backed drafts to Navigator. It cannot email, DM, publish,
// spend, or turn a human disposition into contact authority.
export async function POST(request: Request) {
  const auth = inboundOperationsAuthorized(request)
  if (!auth.authorized) return jsonResponse({ error: { code: 'unauthorized', message: 'A valid inbound operations bearer token is required.' } }, 401)
  const token = process.env.INBOUND_OPERATIONS_TOKEN
  if (!token) return jsonResponse({ error: { code: 'navigator_registry_unavailable', message: 'Navigator registry research is not configured.' } }, 503)
  let limit: number | undefined
  if (request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
    try {
      const body = await request.json() as { limit?: unknown }
      if (typeof body.limit === 'number' && Number.isFinite(body.limit)) limit = body.limit
    } catch { return jsonResponse({ error: { code: 'invalid_request', message: 'Request body must be valid JSON.' } }, 400) }
  }
  try {
    const summary = await runNavigatorRegistryScout({
      fetchImpl: fetch,
      submit: httpNavigatorDraftSubmitter(new URL(request.url).origin, token),
      sources: configuredNavigatorRegistrySources(),
      limit,
    })
    return jsonResponse({ registryScout: summary, recommendationStatus: 'draft', emailAuthorized: false, outreachAuthorized: false }, 200)
  } catch (error) {
    if (error instanceof NavigatorRegistryConfigError) return jsonResponse({ error: { code: 'navigator_registry_unavailable', message: error.message } }, 503)
    console.error('Navigator registry scout failed:', error instanceof Error ? error.message : 'unknown_error')
    return jsonResponse({ error: { code: 'navigator_registry_failed', message: 'Navigator registry research could not be completed.' } }, 502)
  }
}

export function OPTIONS() { return new Response(null, { status: 204, headers: { Allow: 'POST, OPTIONS', 'Cache-Control': 'no-store' } }) }
