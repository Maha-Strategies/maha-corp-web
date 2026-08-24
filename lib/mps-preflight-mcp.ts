export const MPS_PREFLIGHT_MCP_PROTOCOL_VERSION = '2025-11-25' as const

export const MPS_PREFLIGHT_MCP_SERVER = {
  name: 'maha-mps-preflight',
  version: '0.1.0',
  title: 'Maha MPS Preflight',
  description: 'Public, rate-limited claim-level provenance preflight for sanitized nonfiction passages.',
} as const

export const MPS_PREFLIGHT_MCP_TOOL = {
  name: 'mps_claim_preflight',
  title: 'MPS Claim Preflight',
  description: 'Classify substantive claims in a sanitized nonfiction passage using Maha Provenance Standard v0.1. Returns claim excerpts, provenance tags, and suggested actions. Do not submit sensitive, personal, regulated, or confidential material. This is automated triage, not factual verification, certification, or advice.',
  inputSchema: {
    type: 'object' as const,
    additionalProperties: false,
    required: ['text'],
    properties: {
      text: { type: 'string', minLength: 1, maxLength: 6000, description: 'A sanitized nonfiction passage, maximum 6,000 characters.' },
    },
  },
  outputSchema: {
    type: 'object' as const,
    additionalProperties: false,
    required: ['mps_version', 'input_hash', 'claims'],
    properties: {
      mps_version: { type: 'string' },
      input_hash: { type: 'string' },
      claims: { type: 'array' },
    },
  },
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: false, openWorldHint: false },
} as const
