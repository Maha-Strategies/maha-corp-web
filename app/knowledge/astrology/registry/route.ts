import { buildAstrologyRegistry } from '@/lib/astrology-traditions'

export const dynamic = 'force-static'

export function GET() {
  return Response.json(buildAstrologyRegistry(), { headers: { 'Cache-Control': 'public, max-age=3600, s-maxage=86400', 'X-Content-Type-Options': 'nosniff' } })
}
