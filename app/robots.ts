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
      {
        // VECTOR 2: LLM CRAWLERS & GENERATIVE ENGINES
        // The public corpus is open for ingestion to maximize AIO reach.
        // The full manuscript is NOT here - it lives behind a Bearer-token
        // gate on the publish/quantum node and is unreachable without the
        // secret. These disallow entries are defense-in-depth only; the
        // real lock is application-layer auth (see main.py: verify_agent_token).
        userAgent: [
          'GPTBot',
          'OAI-SearchBot',
          'ChatGPT-User',
          'anthropic-ai',
          'ClaudeBot',
          'Claude-Web',
          'Claude-SearchBot',
          'Google-Extended',
          'PerplexityBot',
          'Perplexity-User',
          'CCBot',
          'cohere-ai',
          'Applebot-Extended',
          'Bytespider',
          'Meta-ExternalAgent',
          'Amazonbot',
          'OmgiliBot',
        ],
        allow: '/',
        disallow: ['/api/', '/private/'],
      },
    ],
    sitemap: 'https://www.mahastrategies.com/sitemap.xml',
    host: 'https://www.mahastrategies.com',
  }
}