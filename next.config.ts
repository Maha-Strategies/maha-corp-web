import type { NextConfig } from "next";
import { withSentryConfig } from '@sentry/nextjs'

const nextConfig: NextConfig = {
  // The discovery documents keep their canonical public URLs. They are served
  // by route handlers rather than from public/ so that each request reaches the
  // origin and can be counted; see lib/agent-discovery-metering.ts.
  async rewrites() {
    return [
      { source: '/.well-known/agent.json', destination: '/api/discovery/agent-card' },
      { source: '/agent-offers.json', destination: '/api/discovery/agent-offers' },
      { source: '/llm-context/agentic-commerce.md', destination: '/api/discovery/agent-context' },
      { source: '/mcp-gateway-contract.json', destination: '/api/discovery/mcp-contract' },
      { source: '/.well-known/maha/offer-selection.json', destination: '/api/discovery/offer-selection' },
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
