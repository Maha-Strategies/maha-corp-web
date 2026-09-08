import { currentHostSitemap } from '@/app/sitemap'
import { INDEXING_SEGMENTS, renderSitemapXml, segmentSitemapRows, XML_RESPONSE_HEADERS, type IndexingSegment } from '@/lib/indexing-control-plane'

export const dynamic = 'force-dynamic'

export async function GET(_request: Request, { params }: { params: Promise<{ segment: string }> }) {
  const requested = (await params).segment
  const segment = requested.endsWith('.xml') ? requested.slice(0, -4) : requested
  if (!INDEXING_SEGMENTS.includes(segment as IndexingSegment)) return new Response('Not found', { status: 404 })

  const rows = segmentSitemapRows(await currentHostSitemap()).get(segment as IndexingSegment)
  if (!rows?.length) return new Response('Not found', { status: 404 })
  return new Response(renderSitemapXml(rows), { headers: XML_RESPONSE_HEADERS })
}
