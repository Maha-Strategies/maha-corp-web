import {
  EVIDENCE_BOUNDARY,
  MCP_SERVER_NAME,
  MCP_SERVER_VERSION,
  MCP_TOOLS,
} from './maha-mcp/index.ts'
import {
  MPS_PREFLIGHT_MCP_PROTOCOL_VERSION,
  MPS_PREFLIGHT_MCP_SERVER,
  MPS_PREFLIGHT_MCP_TOOL,
} from './mps-preflight-mcp.ts'
import { EPISTEMIC_FACTORY_MCP_TOOLS } from './epistemic-factory-tools.ts'

const SITE_URL = 'https://www.mahastrategies.com'

export const MCP_PUBLIC_MANIFEST_VERSION = 'maha-mcp-tools/0.1' as const

export const mcpPublicManifest = {
  $schema: `${SITE_URL}/schemas/mcp-tool-manifest-0.1.json`,
  schemaVersion: MCP_PUBLIC_MANIFEST_VERSION,
  canonicalUrl: `${SITE_URL}/mcp.json`,
  publishedAt: '2026-08-24',
  provider: {
    name: 'Maha Strategies LLC',
    website: SITE_URL,
    llmsIndex: `${SITE_URL}/llms.txt`,
    openApi: `${SITE_URL}/api/docs/openapi`,
  },
  protocol: {
    name: 'Model Context Protocol',
    defaultVersion: MPS_PREFLIGHT_MCP_PROTOCOL_VERSION,
    discoveryNote: 'Availability is declared per server. A manifest entry does not override authentication, quota, review, or payment policy at call time.',
  },
  summary: {
    servers: 3,
    tools: 1 + MCP_TOOLS.length + EPISTEMIC_FACTORY_MCP_TOOLS.length,
    callablePublicTools: 1,
    sourceAvailablePackageTools: MCP_TOOLS.length,
  },
  servers: [
    {
      id: MPS_PREFLIGHT_MCP_SERVER.name,
      title: MPS_PREFLIGHT_MCP_SERVER.title,
      version: MPS_PREFLIGHT_MCP_SERVER.version,
      status: 'available-public-rate-limited',
      transport: {
        type: 'streamable-http',
        url: `${SITE_URL}/api/mcp/mps-preflight`,
        method: 'POST',
      },
      authentication: { mode: 'none', quota: 'Public daily quota is enforced per visitor.' },
      documentation: `${SITE_URL}/mcp/mps-preflight.md`,
      registryMetadata: `${SITE_URL}/mcp/mps-preflight.server.json`,
      tools: [{
        ...MPS_PREFLIGHT_MCP_TOOL,
        effects: {
          externalModelCall: true,
          operationalTelemetryWrite: true,
          destructiveAction: false,
          paymentAuthority: 'none',
        },
        dataBoundary: {
          acceptedInput: 'Sanitized, non-sensitive nonfiction text only; maximum 6,000 characters.',
          prohibitedInput: ['confidential', 'personal', 'regulated', 'sensitive'],
          resultBoundary: 'Automated claim triage. It does not verify facts, certify a document, or replace specialist review.',
        },
      }],
    },
    {
      id: 'maha-epistemic-publication-factory',
      title: 'Maha Epistemic Publication Factory',
      version: '0.1.0',
      status: 'available-private-authenticated',
      transport: {
        type: 'streamable-http',
        url: `${SITE_URL}/api/mcp/epistemic-factory`,
        method: 'POST',
      },
      authentication: {
        mode: 'bearer-environment-secret',
        credentialName: 'EPISTEMIC_OPERATIONS_TOKEN',
        toolArgumentsAcceptCredentials: false,
      },
      documentation: `${SITE_URL}/knowledge/epistemic-system/publishing-factory`,
      tools: EPISTEMIC_FACTORY_MCP_TOOLS.map((tool) => ({
        name: tool.name,
        title: tool.title,
        description: tool.description,
        inputSchema: tool.inputSchema,
        annotations: { readOnlyHint: tool.readOnly, destructiveHint: false, openWorldHint: false },
        effects: {
          durableQueueWrite: false,
          canonicalPublication: false,
          publicSurfaceMutation: false,
          paymentAuthority: 'none',
          deploymentAuthority: 'none',
        },
        dataBoundary: {
          acceptedInput: 'Structured noncanonical maha-epistemic/1.0 records without credentials, personal data, or confidential source text.',
          sourceTextReturned: false,
          resultBoundary: 'Draft compilation, lexical conflict leads, and bridge-contract validation only. Durable queue submission and canonical release remain separate admin operations.',
        },
      })),
    },
    {
      id: MCP_SERVER_NAME,
      title: 'Maha Context Control',
      version: MCP_SERVER_VERSION,
      status: 'source-available-package-not-published',
      transport: {
        type: 'local-stdio',
        repository: 'https://github.com/Maha-Strategies/maha-corp-web/tree/main/packages/maha-mcp-server',
        build: 'npm --prefix packages/maha-mcp-server run build',
        command: 'node',
        args: ['packages/maha-mcp-server/dist/maha-mcp-server/cli.js'],
      },
      authentication: {
        mode: 'environment-only-when-compilation-is-configured',
        toolArgumentsAcceptCredentials: false,
      },
      documentation: `${SITE_URL}/developers`,
      tools: MCP_TOOLS.map((tool) => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema,
        annotations: {
          readOnlyHint: tool.readOnly,
          destructiveHint: false,
        },
        effects: {
          localFileWrite: tool.name === 'context_control.compile_sanitized',
          configuredCompilerRequest: tool.name === 'context_control.compile_sanitized',
          providerCall: false,
          paymentAuthority: 'none',
          deploymentAuthority: 'none',
        },
        dataBoundary: EVIDENCE_BOUNDARY,
      })),
    },
  ],
  automationBoundary: {
    yearOnePurpose: 'Stable discovery for bounded research, evidence, and context-control automation.',
    noImpliedAuthority: true,
    prohibitedInferences: [
      'No listed MCP tool is authorized to deploy infrastructure, spend funds, contact people, enqueue durable work, or publish canonical knowledge.',
      'Tool availability is not evidence that an output is factually correct, independently reviewed, production-ready, or suitable for a high-stakes decision.',
      'Source-available and package-not-published tools are not represented as hosted or installable services.',
    ],
  },
  indexes: {
    machineReadableRegistry: `${SITE_URL}/maha-machine-readable-registry.json`,
    agentCard: `${SITE_URL}/.well-known/agent.json`,
    offerCatalog: `${SITE_URL}/agent-offers.json`,
    knowledge: `${SITE_URL}/knowledge`,
  },
} as const
