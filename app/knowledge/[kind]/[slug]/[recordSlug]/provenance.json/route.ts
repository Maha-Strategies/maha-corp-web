import { PUBLIC_EPISTEMIC_RECORDS, getPublicEpistemicRecord } from '@/lib/epistemic-pilots'
import { buildProvenanceBundle, recordKindSegment } from '@/lib/epistemic-publication'
import { getActiveEpistemicRecordByPath } from '@/lib/public-epistemic-releases'

type RouteContext = { params: Promise<{ kind: string; slug: string; recordSlug: string }> }

export const dynamicParams = true
export function generateStaticParams() {
  return PUBLIC_EPISTEMIC_RECORDS.map((record) => ({ kind: record.domainSlug, slug: recordKindSegment(record), recordSlug: record.slug }))
}

export async function GET(_request: Request, { params }: RouteContext) {
  const { kind, slug, recordSlug } = await params
  const record = getPublicEpistemicRecord(kind, slug, recordSlug)
    ?? await getActiveEpistemicRecordByPath(`/knowledge/${kind}/${slug}/${recordSlug}`)
  if (!record) return Response.json({ error: 'Canonical record not found' }, { status: 404 })
  return Response.json(buildProvenanceBundle(record), {
    headers: { 'Cache-Control': 'public, max-age=0, s-maxage=3600' },
  })
}
