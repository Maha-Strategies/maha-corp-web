import { CELESTIAL_FACT_SCHEMA } from '@/lib/celestial-facts'

export const dynamic = 'force-static'

export function GET() {
  return Response.json(CELESTIAL_FACT_SCHEMA, {
    headers: {
      'Cache-Control': 'public, max-age=3600, s-maxage=86400',
      'Content-Type': 'application/schema+json; charset=utf-8',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
