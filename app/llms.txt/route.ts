import claimsData from '@/lib/atlas/generated-claims.json'
import { buildLlmsManifest } from '@/lib/llms-manifest'
import { getPublicEpistemicRecords } from '@/lib/public-epistemic-releases'
import { eligibleSourceSlugs, projectSourceReference } from '@/lib/source-reference-projection'
import type { MpsClaim } from '@/scripts/expand-graph'

export const dynamic = 'force-dynamic'

export async function GET() {
  const slugs = await eligibleSourceSlugs()
  const references = (await Promise.all(slugs.map((slug) => projectSourceReference(slug))))
    .filter((page): page is NonNullable<typeof page> => page !== null)
    .map((page) => ({ slug: page.slug, title: page.title, sourceId: page.sourceId }))
  const manifest = buildLlmsManifest(claimsData as MpsClaim[], await getPublicEpistemicRecords(), references)
  return new Response(manifest, { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=0, s-maxage=3600', Link: '</mcp.json>; rel="alternate"; type="application/json"' } })
}
