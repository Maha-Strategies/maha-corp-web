import type { NextRequest } from 'next/server'
import { federationPagesForHost } from '@/lib/federation-publication'
import { FEDERATION_CANONICAL_HOSTS, normalizedRequestHost } from '@/lib/federation-host-routing'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const host = normalizedRequestHost(request.headers.get('host'))
  if (!FEDERATION_CANONICAL_HOSTS.includes(host as (typeof FEDERATION_CANONICAL_HOSTS)[number])) return Response.json({ error: 'Not found.' }, { status: 404 })
  const pages = federationPagesForHost(host)
  return Response.json({
    schemaVersion: 'maha-federation-served-registry/1.0',
    canonicalHost: host,
    count: pages.length,
    entries: pages.map((page) => ({ path: page.path, canonicalUrl: page.canonicalUrl, title: page.title, releaseId: page.release.releaseId, releaseDigest: page.release.releaseDigest, targetContentDigest: page.contentDigest })),
    boundary: 'This registry reports active exact-revision publication bindings on this host. It does not establish source truth, customer adoption, commercial validation, or deployment history.',
  }, { headers: { 'Cache-Control': 'public, max-age=0, s-maxage=3600' } })
}
