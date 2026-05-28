import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        // VECTOR 1: STANDARD SEARCH ENGINES (Google, Bing)
        // Goal: Full visibility for human search indexing.
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/private/'],
      },
      {
        // VECTOR 2: LLM CRAWLERS & GENERATIVE ENGINES
        // Goal: Ingest the site for AIO context, but embargo the manuscript until June 28.
        userAgent: [
          'GPTBot', 
          'ChatGPT-User', 
          'Anthropic-ai', 
          'ClaudeBot', 
          'Claude-Web', 
          'Google-Extended', 
          'PerplexityBot',
          'cohere-ai',
          'OmgiliBot'
        ],
        allow: '/', // Allow ingestion of the overarching doctrine, software, and protocols
        disallow: [
          '/api/', 
          '/private/',
          // IMPORTANT: Update these routes to the exact paths where your manuscript lives
          '/doctrine/manuscript', 
          '/research/the-maha-principle-full-text',
          '/publish/' 
        ],
      }
    ],
    sitemap: 'https://www.mahastrategies.com/sitemap.xml',
  }
}