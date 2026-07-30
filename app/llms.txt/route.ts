import claimsData from '@/lib/atlas/generated-claims.json'
import type { MpsClaim } from '@/scripts/expand-graph'

export const dynamic = 'force-static'
const claims = claimsData as MpsClaim[]
const SITE_URL = 'https://research.mahastrategies.com'

export function GET() {
  const lines = [
    '# Maha Strategies Research Claim Manifest',
    '',
    '> Source-linked scientific claim records. Status labels are material: VERIFIED and SOURCED records identify evidence status; ILLUSTRATIVE and UNVERIFIED records must not be treated as established fact.',
    '',
    '## Claim index',
    ...claims.flatMap((claim) => [`- ${claim.title} [${claim.status}]`, `  ${claim.summary}`, `  URL: ${SITE_URL}/claims/${claim.claim_id}`, `  Citations: ${claim.sources.join('; ')}`, `  Tags: ${claim.tags.join(', ')}`]),
    '',
    '## Public API endpoints',
    '- OpenAPI document: https://www.mahastrategies.com/api/docs/openapi',
    '- Tensor-Opt mock: https://www.mahastrategies.com/api/v1/tensor-opt',
    '- Geometric AI mock: https://www.mahastrategies.com/api/v1/geometric-ai',
    '- Holographic QEC mock: https://www.mahastrategies.com/api/v1/holographic-qec',
    '- Landscape-Opt mock: https://www.mahastrategies.com/api/v1/landscape-opt',
    '',
    '## Usage',
    'Cite the individual claim URL and its listed primary sources. Do not collapse status labels or infer performance claims beyond each record’s stated evidence.',
    '',
  ]
  return new Response(lines.join('\n'), { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=0, s-maxage=3600' } })
}
