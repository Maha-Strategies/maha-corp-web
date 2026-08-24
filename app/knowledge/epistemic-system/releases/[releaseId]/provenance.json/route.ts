import { getPublicEpistemicReleaseProvenance } from '@/lib/public-epistemic-releases'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(_request: Request, { params }: { params: Promise<{ releaseId: string }> }) {
  const { releaseId } = await params
  const provenance = await getPublicEpistemicReleaseProvenance(releaseId)
  if (!provenance) return Response.json({ error: { code: 'not_found', message: 'Canonical release provenance was not found.' } }, { status: 404 })
  return Response.json(provenance, {
    headers: { 'Cache-Control': 'public, max-age=300, stale-while-revalidate=3600' },
  })
}
