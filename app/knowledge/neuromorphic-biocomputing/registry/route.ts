import { NEUROMORPHIC_REGISTRY } from '@/lib/neuromorphic-biocomputing'

export const dynamic = 'force-static'

export function GET() {
  return Response.json(NEUROMORPHIC_REGISTRY, { headers: { 'Cache-Control': 'public, max-age=3600, s-maxage=86400', 'X-Content-Type-Options': 'nosniff' } })
}
