import { buildAtomFeed } from '@/lib/feed'

export const revalidate = 3_600

export function GET() {
  return new Response(buildAtomFeed(), {
    headers: {
      'Content-Type': 'application/atom+xml; charset=utf-8',
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
    },
  })
}
