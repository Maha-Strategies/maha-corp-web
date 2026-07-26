import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
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
    sitemap: 'https://www.mahastrategies.com/sitemap.xml',
    host: 'https://www.mahastrategies.com',
  }
}
