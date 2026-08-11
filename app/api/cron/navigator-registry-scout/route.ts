import { timingSafeEqual } from 'node:crypto'

import { httpNavigatorDraftSubmitter, runNavigatorRegistryScout } from '@/lib/navigator-registry-runner'
import { NavigatorRegistryConfigError, configuredNavigatorRegistrySources } from '@/lib/navigator-registry-sources'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

function authorized(request: Request): boolean {
  const token = process.env.CRON_SECRET
  const supplied = request.headers.get('authorization')?.replace(/^Bearer\s+/, '')
  if (!token || !supplied) return false
  const expected = Buffer.from(token), actual = Buffer.from(supplied)
  return expected.length === actual.length && timingSafeEqual(expected, actual)
}

// Scheduled read-only registry ingestion. The only write is a draft candidate
// in Navigator's append-only research queue. Email remains impossible here.
export async function GET(request: Request) {
  if (!authorized(request)) return Response.json({ error: 'Unauthorized.' }, { status: 401 })
  const token = process.env.INBOUND_OPERATIONS_TOKEN
  if (!token) return Response.json({ error: 'Navigator registry research is not configured.' }, { status: 503 })
  try {
    const summary = await runNavigatorRegistryScout({
      fetchImpl: fetch,
      submit: httpNavigatorDraftSubmitter(new URL(request.url).origin, token),
      sources: configuredNavigatorRegistrySources(),
    })
    return Response.json({ registryScout: summary, recommendationStatus: 'draft', emailAuthorized: false, outreachAuthorized: false })
  } catch (error) {
    if (error instanceof NavigatorRegistryConfigError) return Response.json({ error: error.message }, { status: 503 })
    console.error('Scheduled Navigator registry scout failed:', error instanceof Error ? error.message : 'unknown_error')
    return Response.json({ error: 'Navigator registry research failed.' }, { status: 502 })
  }
}
