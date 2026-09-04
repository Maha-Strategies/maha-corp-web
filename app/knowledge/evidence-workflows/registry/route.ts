import { EVIDENCE_WORKFLOW_PUBLIC_REGISTRY, EVIDENCE_WORKFLOW_REGISTRY_DIGEST } from '@/lib/evidence-workflow-examples'

export const dynamic = 'force-static'

export function GET() {
  return Response.json(EVIDENCE_WORKFLOW_PUBLIC_REGISTRY, {
    headers: {
      'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
      ETag: `"${EVIDENCE_WORKFLOW_REGISTRY_DIGEST}"`,
      'X-Content-Digest': EVIDENCE_WORKFLOW_REGISTRY_DIGEST,
    },
  })
}
