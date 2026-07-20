const SITE_URL = 'https://www.mahastrategies.com'

// The commercial bridge is deliberately local and credential-held. It is not
// the hosted Maha Cognitive Gateway at mcp.maha-os.com.
export const mcpBridgeManifest = {
  schema: `${SITE_URL}/schemas/mcp-bridge-compatibility/v0.1`,
  version: '0.1.0',
  bridge: {
    package: '@mahastrategies/maha-mcp-bridge',
    version: '0.3.2',
    transport: 'local_stdio',
    install: 'npm install -g @mahastrategies/maha-mcp-bridge',
    documentation: `${SITE_URL}/mcp-bridge`,
  },
  compatibility: {
    apiOpenApi: `${SITE_URL}/api/docs/openapi`,
    mpsAudit: { endpoint: `${SITE_URL}/api/mps-audits`, credentialScope: 'mps_audit' },
    books: {
      entitlementEndpoint: `${SITE_URL}/api/books/{id}/entitlement`,
      contentEndpoint: `${SITE_URL}/api/books/{id}/content`,
      purchaseEndpoint: `${SITE_URL}/api/books/public-checkout`,
    },
  },
  security: {
    credentialStorage: 'The buyer-held credential is stored locally by the bridge; it is never a merchant secret.',
    paymentAuthority: 'none',
    paymentPolicy: 'The bridge may open a documented checkout flow only after human approval. It cannot authorize a charge.',
  },
  distinctServices: [{
    name: 'Maha Cognitive Gateway',
    documentation: `${SITE_URL}/research/mcp`,
    endpoint: 'https://mcp.maha-os.com/mcp',
    relationship: 'Separate hosted MCP service for Maha OS, publishing, and research workflows. Its access token and tools are not interchangeable with the commercial bridge credential.',
  }],
} as const
