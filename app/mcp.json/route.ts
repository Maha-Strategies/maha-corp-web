import { mcpPublicManifest } from '@/lib/mcp-public-manifest'

export const dynamic = 'force-static'

export function GET() {
  return Response.json(mcpPublicManifest, {
    headers: {
      'Cache-Control': 'public, max-age=0, s-maxage=3600',
      Link: '</llms.txt>; rel="alternate"; type="text/plain"',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
