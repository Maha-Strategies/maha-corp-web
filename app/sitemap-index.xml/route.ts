import { headers } from 'next/headers'
import { currentHostSitemap } from '@/app/sitemap'
import { indexingHost, renderSitemapIndex, segmentSitemapRows, XML_RESPONSE_HEADERS } from '@/lib/indexing-control-plane'

export const dynamic = 'force-dynamic'

export async function GET() {
  const host = indexingHost((await headers()).get('host'))
  const segments = segmentSitemapRows(await currentHostSitemap())
  const latest = new Date(Math.max(...[...segments.values()].flat().map((row) => row.lastModified ? new Date(row.lastModified).valueOf() : 0)))
  return new Response(renderSitemapIndex(host, segments.keys(), latest), { headers: XML_RESPONSE_HEADERS })
}
