import { getPublicEpistemicReleaseRegistry } from '@/lib/public-epistemic-releases'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  return Response.json(await getPublicEpistemicReleaseRegistry(), {
    headers: { 'Cache-Control': 'public, max-age=60, stale-while-revalidate=300' },
  })
}
