import { openApiDocument } from '@/lib/openapi'

// The spec is a build-time constant; let Next prerender it as a static route.
export const dynamic = 'force-static'

export function GET() {
  return Response.json(openApiDocument, {
    headers: { 'Cache-Control': 'public, max-age=300, must-revalidate' },
  })
}
