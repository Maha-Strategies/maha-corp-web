import { buildAtomFeed, latestFeedEntries, type FeedEntry } from '@/lib/feed'
import { getPublicContentPublicationSitemapRows } from '@/lib/public-content-publications'

export const revalidate = 3_600

export async function GET() {
  const publications = await getPublicContentPublicationSitemapRows()
  const humanPublishedEntries: FeedEntry[] = publications.map((publication) => ({
    id: `https://www.mahastrategies.com/insights/${publication.slug}`,
    url: `https://www.mahastrategies.com/insights/${publication.slug}`,
    title: publication.title ?? 'Maha Strategies insight',
    summary: publication.summary ?? 'Evidence-led insight from Maha Strategies LLC.',
    published: publication.published_at,
    updated: publication.updated_at,
    category: 'Evidence-led insight',
  }))
  return new Response(buildAtomFeed(latestFeedEntries(30, humanPublishedEntries)), {
    headers: {
      'Content-Type': 'application/atom+xml; charset=utf-8',
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
    },
  })
}
