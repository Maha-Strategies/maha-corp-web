import { sha256Canonical } from './epistemic-publication.ts'

/**
 * Immutable public metadata for the licensed-evidence capability.
 *
 * This module deliberately has no dependency on credential, release-runtime,
 * database, or authorization code so public documentation can describe the
 * contract without pulling those implementation paths into a served bundle.
 */
export const MCP_EVIDENCE_PROTOCOL_VERSION = '2025-11-25' as const
export const MCP_EVIDENCE_LICENSE_VERSION = 'maha-mcp-evidence-license/1.0' as const
export const MCP_EVIDENCE_EXECUTION_VERSION = 'maha-mcp-evidence-execution/1.0' as const
export const MCP_EVIDENCE_PROJECTION_VERSION = 'maha-licensed-evidence/1.0' as const
export const MCP_EVIDENCE_CAPABILITY = 'mcp_evidence_retrieval' as const
export const MCP_EVIDENCE_TOOL_NAME = 'evidence.retrieve_released_record' as const

export const MCP_EVIDENCE_SERVER = {
  name: 'maha-licensed-evidence',
  version: '0.1.0',
  title: 'Maha Licensed Evidence Retrieval',
  description: 'Entitlement-gated retrieval of exact, active Maha canonical releases with claim-level provenance and explicit boundaries.',
} as const

export const MCP_EVIDENCE_TOOL = {
  name: MCP_EVIDENCE_TOOL_NAME,
  title: 'Retrieve released evidence',
  description: 'Retrieve one active canonical Maha record by release ID or canonical path. Requires an active credential capability and license grant. Returns source-bound claims, exact locators, limitations, prohibited inferences, release provenance, and a deterministic execution receipt. A license grants machine-format access; it does not upgrade evidence quality or certify truth.',
  inputSchema: {
    type: 'object' as const,
    additionalProperties: false,
    required: ['clientRequestId', 'selector'],
    properties: {
      clientRequestId: {
        type: 'string' as const,
        minLength: 8,
        maxLength: 160,
        pattern: '^[A-Za-z0-9][A-Za-z0-9._:-]{7,159}$',
        description: 'Stable idempotency key. Reuse only when retrying the exact same request.',
      },
      selector: {
        type: 'object' as const,
        additionalProperties: false,
        oneOf: [
          { required: ['releaseId'], properties: { releaseId: { type: 'string', pattern: '^epirelease_[a-f0-9]{32}$' } } },
          { required: ['canonicalPath'], properties: { canonicalPath: { type: 'string', pattern: '^/knowledge/[a-z0-9-]+/[a-z0-9-]+/[a-z0-9-]+$' } } },
        ],
      },
    },
  },
  outputSchema: {
    type: 'object' as const,
    additionalProperties: false,
    required: ['schemaVersion', 'execution', 'release', 'record', 'provenance', 'licenseBoundary'],
    properties: {
      schemaVersion: { const: MCP_EVIDENCE_PROJECTION_VERSION },
      execution: { type: 'object' },
      release: { type: 'object' },
      record: { type: 'object' },
      provenance: { type: 'object' },
      licenseBoundary: { type: 'string' },
    },
  },
  annotations: {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
  },
} as const

export const MCP_EVIDENCE_LICENSE_PLANS = {
  'evidence-internal-canary-v1': {
    planId: 'evidence-internal-canary-v1',
    planVersion: '1.0.0',
    title: 'Internal evidence retrieval canary',
    audience: 'internal-evaluation',
    monthlyQuotaUnits: 25,
    listPriceUsdCents: 0,
    allowedTools: [MCP_EVIDENCE_TOOL_NAME],
  },
  'evidence-developer-v1': {
    planId: 'evidence-developer-v1',
    planVersion: '1.0.0',
    title: 'Developer evidence retrieval',
    audience: 'commercial-developer',
    monthlyQuotaUnits: 10_000,
    listPriceUsdCents: 125_000,
    allowedTools: [MCP_EVIDENCE_TOOL_NAME],
  },
  'evidence-enterprise-v1': {
    planId: 'evidence-enterprise-v1',
    planVersion: '1.0.0',
    title: 'Enterprise evidence retrieval',
    audience: 'commercial-enterprise',
    monthlyQuotaUnits: 100_000,
    listPriceUsdCents: null,
    allowedTools: [MCP_EVIDENCE_TOOL_NAME],
  },
} as const

export type McpEvidencePlanId = keyof typeof MCP_EVIDENCE_LICENSE_PLANS

export const MCP_EVIDENCE_LICENSE_TERMS = {
  schemaVersion: MCP_EVIDENCE_LICENSE_VERSION,
  licensedRight: 'Authenticated machine-readable retrieval of active canonical Maha evidence records through the declared MCP tool.',
  evidenceBoundary: 'Entitlement changes access only. It never changes release state, review assurance, source fidelity, evidence maturity, uncertainty, or prohibited inferences.',
  redistributionBoundary: 'The grant does not convey source-publication copyright or permission to redistribute third-party text beyond each source rights record.',
  availabilityBoundary: 'Withdrawn, superseded, unreleased, stale, or selector-substituted records are unavailable even when quota remains.',
  highStakesBoundary: 'Outputs are evidence-navigation artifacts, not medical, legal, investment, safety, patent-validity, regulatory, or scientific-certification decisions.',
} as const

export const MCP_EVIDENCE_LICENSE_TERMS_SHA256 = sha256Canonical(MCP_EVIDENCE_LICENSE_TERMS)
