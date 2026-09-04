import { ASTROLOGY_WORKFLOW_PUBLIC_REGISTRY, ASTROLOGY_WORKFLOW_REGISTRY_DIGEST } from '@/lib/astrology-workflow-protocols'

export const dynamic = 'force-static'

export function GET() {
  return Response.json(ASTROLOGY_WORKFLOW_PUBLIC_REGISTRY, {
    headers: {
      'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
      ETag: `"${ASTROLOGY_WORKFLOW_REGISTRY_DIGEST}"`,
      'X-Content-Digest': ASTROLOGY_WORKFLOW_REGISTRY_DIGEST,
    },
  })
}
