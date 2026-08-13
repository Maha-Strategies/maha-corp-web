import type { NextConfig } from "next";
import { withSentryConfig } from '@sentry/nextjs'

const nextConfig: NextConfig = {
  // The discovery documents keep their canonical public URLs while their
  // internal route-handler paths remain implementation details. The primary
  // agent surfaces are also metered; the CARP proposal is intentionally static
  // until a real CARP identity and directory membership exist.
  async rewrites() {
    return [
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
