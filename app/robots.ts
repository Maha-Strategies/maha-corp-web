import { MetadataRoute } from 'next'
import { headers } from 'next/headers'
import { indexingHost } from '@/lib/indexing-control-plane'

export const dynamic = 'force-dynamic'

export default async function robots(): Promise<MetadataRoute.Robots> {
  const host = indexingHost((await headers()).get('host'))
  return {
    rules: [
      {
        // VECTOR 1: STANDARD SEARCH ENGINES (Google, Bing, etc.)
        // Full visibility for the public discovery corpus (doctrine,
        // protocols, intelligence briefs). Operational routes withheld.
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/private/'],
      },
    ],
    sitemap: [`https://${host}/sitemap-index.xml`, `https://${host}/sitemap.xml`],
    host: `https://${host}`,
  }
}
