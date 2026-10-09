import type { NextConfig } from "next";
import { withSentryConfig } from '@sentry/nextjs'
import { COLLECTION_HUB_PATHS, COLLECTION_INTERNAL_PATH } from './lib/collection-hub-paths.ts'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { EBOOK_IDS, ebookArtifacts } from './lib/x402/ebook-contract.ts'

// An enabled book release must never be built without its private assets.
// CLI uploads include them only in server functions, never public/ or Git.
if (process.env.X402_CABEZON_EBOOKS_ENABLED === 'true' && process.env.X402_EBOOK_STORAGE !== 'private') {
  for (const id of EBOOK_IDS) for (const file of ebookArtifacts(id)) {
    if (!existsSync(resolve('content/paid-ebooks', file.filename))) throw new Error('Enabled ebook release is missing private assets; deployment refused.')
  }
}

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    '/api/v1/books/the-maha-principle/section': ['./content/books/the-maha-principle/*.md'],
    '/api/v1/books/the-orbital-mind/section': ['./content/books/the-orbital-mind/*.md'],
    '/api/astrology/platform': ['./lib/dossier/executive-astrology-dossier.typ'],
    '/api/v1/books/the-maha-principle/epub': ['./content/paid-ebooks/The-Maha-Principle.epub', './content/paid-ebooks/The-Maha-Principle-print.pdf'],
    '/api/v1/books/the-maha-principle/epub/retrieve': ['./content/paid-ebooks/The-Maha-Principle.epub', './content/paid-ebooks/The-Maha-Principle-print.pdf', './content/paid-ebooks/archive/*/The-Maha-Principle*'],
    '/api/v1/books/the-orbital-mind/epub': ['./content/paid-ebooks/The-Orbital-Mind.epub', './content/paid-ebooks/The-Orbital-Mind-print.pdf'],
    '/api/v1/books/the-orbital-mind/epub/retrieve': ['./content/paid-ebooks/The-Orbital-Mind.epub', './content/paid-ebooks/The-Orbital-Mind-print.pdf', './content/paid-ebooks/archive/*/The-Orbital-Mind*'],
  },
  // The customer-owned container uses Next's minimal standalone server. Maha's
  // Vercel builds leave this unset and retain the platform adapter.
  output: process.env.MAHA_STANDALONE_BUILD === 'true' ? 'standalone' : undefined,
  // Private builds commonly run inside a memory-bounded build VM. Keep their
  // static-generation fan-out bounded without changing Maha's Vercel builds.
  experimental: process.env.MAHA_STANDALONE_BUILD === 'true' ? { cpus: 2 } : undefined,
  // The discovery documents keep their canonical public URLs while their
  // internal route-handler paths remain implementation details. The primary
  // agent surfaces are also metered; the CARP proposal is intentionally static
  // until a real CARP identity and directory membership exist.
  async rewrites() {
    return [
      // Exact, path-only rewrites preserve article routes and avoid network
      // proxying. Host and direct-internal-path checks run first in proxy.ts.
      ...COLLECTION_HUB_PATHS.map(source => ({ source, destination: COLLECTION_INTERNAL_PATH + source })),
      { source: '/.well-known/agent.json', destination: '/api/discovery/agent-card' },
      { source: '/agent-offers.json', destination: '/api/discovery/agent-offers' },
      { source: '/llm-context/agentic-commerce.md', destination: '/api/discovery/agent-context' },
      { source: '/mcp-gateway-contract.json', destination: '/api/discovery/mcp-contract' },
      { source: '/.well-known/maha/offer-selection.json', destination: '/api/discovery/offer-selection' },
      { source: '/.well-known/carp/seller-role.json', destination: '/api/discovery/carp/seller-role' },
      { source: '/.well-known/carp/seller.json', destination: '/api/discovery/carp/seller-profile' },
      { source: '/.well-known/carp/did.json', destination: '/api/discovery/carp/did' },
      { source: '/.well-known/carp/sad.json', destination: '/api/discovery/carp/sad' },
      { source: '/cgi-bin/did', destination: '/api/discovery/carp/did' },
      { source: '/cgi-bin/maha-strategies', destination: '/api/discovery/carp/sad' },
      { source: '/cgi-bin/challenge', destination: '/api/carp/challenge' },
      { source: '/cgi-bin/response', destination: '/api/carp/response' },
      { source: '/cgi-bin/encrequest', destination: '/api/carp/encrequest' },
      { source: '/cgi-bin/encresult', destination: '/api/carp/encresult' },
    ]
  },
  async redirects() {
    return [
      {
        // The Mayon app documentation is consolidated into the hub at /mayon.
        // Exact source on purpose: /apps/mayon/privacy is a separate legal
        // page and must keep resolving. `permanent: true` is Next's 308.
        source: '/apps/mayon',
        destination: '/mayon',
        permanent: true,
      },
      {
        source: '/research/chronobiological-entrainment-endocrine-homeostasis',
        destination: 'https://research.mahastrategies.com/papers/chronobiological-entrainment',
        permanent: true, // 301
      },
    ];
  },
};

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: true,
  telemetry: false,
  sourcemaps: { disable: !process.env.SENTRY_AUTH_TOKEN },
  webpack: {
    treeshake: { removeDebugLogging: true },
    automaticVercelMonitors: true,
  },
})
