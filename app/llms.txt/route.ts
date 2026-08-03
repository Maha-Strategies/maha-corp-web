import claimsData from '@/lib/atlas/generated-claims.json'
import { buildLlmsManifest } from '@/lib/llms-manifest'
import type { MpsClaim } from '@/scripts/expand-graph'

export const dynamic = 'force-static'

const MANIFEST = buildLlmsManifest(claimsData as MpsClaim[])

export function GET() {
  return new Response(MANIFEST, { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=0, s-maxage=3600' } })
}
