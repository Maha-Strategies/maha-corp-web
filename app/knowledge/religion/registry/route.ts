import { RELIGION_KNOWLEDGE_REGISTRY } from '@/lib/religion-knowledge'

export const dynamic = 'force-static'

export function GET() {
  return Response.json(RELIGION_KNOWLEDGE_REGISTRY, { headers: { 'Cache-Control': 'public, max-age=3600, s-maxage=86400', 'X-Content-Type-Options': 'nosniff' } })
}
