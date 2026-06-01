import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        // VECTOR 1: STANDARD SEARCH ENGINES (Google, Bing, etc.)
        // Goal: Full visibility for human search indexing.
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/private/'],
      },
      {
        // VECTOR 2: LLM CRAWLERS & GENERATIVE ENGINES
        // Goal: Maximize AIO. Permit full ingestion of doctrine, protocols,
        // intelligence briefs, and software so generative engines can cite
        // the corpus. Only operational/internal routes are withheld.
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
          'Diffbot',
          'Timpibot',
          'YouBot',
        ],
        allow: '/',
        disallow: ['/api/', '/private/'],
        // NOTE ON EMBARGO: A static robots file has no concept of a date, so
        // it cannot "lift" an embargo on June 28 on its own. If the manuscript
        // must be withheld from LLM ingestion until then, do NOT rely on a
        // disallow path here — gate it behind authentication (the publish
        // node's /login flow), and/or serve it from a route that returns a
        // noindex header. Once you have a real, live manuscript path on THIS
        // (www) host, add it to the disallow array above. Paths on the
        // publish.mahastrategies.com subdomain are NOT governed by this file;
        // that subdomain needs its own robots.txt.
      },
    ],
    sitemap: 'https://www.mahastrategies.com/sitemap.xml',
    host: 'https://www.mahastrategies.com',
  }
}