import { base44OpenApiDocument } from '@/lib/base44-integration'

export const dynamic = 'force-static'

export function GET() {
  return Response.json(base44OpenApiDocument, { headers: { 'Cache-Control': 'public, max-age=300, must-revalidate' } })
}
