import { ASTROLOGY_ANSWER_PUBLIC_REGISTRY, ASTROLOGY_ANSWER_REGISTRY_DIGEST } from '@/lib/astrology-answer-graph'

export const dynamic = 'force-static'

export function GET() {
  return Response.json(
    { ...ASTROLOGY_ANSWER_PUBLIC_REGISTRY, digest: ASTROLOGY_ANSWER_REGISTRY_DIGEST },
    { headers: { 'Cache-Control': 'public, max-age=3600, s-maxage=86400', 'X-Content-Type-Options': 'nosniff', ETag: `"${ASTROLOGY_ANSWER_REGISTRY_DIGEST}"` } },
  )
}
