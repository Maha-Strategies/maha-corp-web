import claimsData from '@/lib/atlas/generated-claims.json'
import { buildLlmsManifest } from '@/lib/llms-manifest'
import { getPublicEpistemicRecords } from '@/lib/public-epistemic-releases'
import type { MpsClaim } from '@/scripts/expand-graph'

export const dynamic = 'force-dynamic'

export async function GET() {
  const manifest = buildLlmsManifest(claimsData as MpsClaim[], await getPublicEpistemicRecords())
  return new Response(manifest, { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=0, s-maxage=3600', Link: '</mcp.json>; rel="alternate"; type="application/json"' } })
}
