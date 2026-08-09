import type { MpsClaim } from '../scripts/expand-graph.ts'

import {
  AGENTIC_COMMERCE_API_URL,
  AGENTIC_COMMERCE_CONTEXT_URL,
  AGENTIC_COMMERCE_MANIFEST_URL,
} from './agentic-commerce.ts'

const RESEARCH_URL = 'https://research.mahastrategies.com'

/**
 * The document served at /llms.txt, extracted from the route so its contents
 * can be asserted rather than assumed.
 *
 * It previously listed the research claim index and the API endpoints but not
 * the commercial surfaces, so an agent reading the conventional orientation
 * file was never pointed at the offers manifest. A test now holds that open.
 */
export function buildLlmsManifest(claims: readonly MpsClaim[]): string {
  return [
    '# Maha Strategies Research Claim Manifest',
    '',
    '> Source-linked scientific claim records. Status labels are material: VERIFIED and SOURCED records identify evidence status; ILLUSTRATIVE and UNVERIFIED records must not be treated as established fact.',
    '',
    '## Claim index',
    ...claims.flatMap((claim) => [`- ${claim.title} [${claim.status}]`, `  ${claim.summary}`, `  URL: ${RESEARCH_URL}/claims/${claim.claim_id}`, `  Citations: ${claim.sources.join('; ')}`, `  Tags: ${claim.tags.join(', ')}`]),
    '',
    '## Public API endpoints',
    '- OpenAPI document: https://www.mahastrategies.com/api/docs/openapi',
    '- Context compression: https://www.mahastrategies.com/api/v1/compress',
    '- GPU tensor-network QUBO/Ising heuristic: https://www.mahastrategies.com/api/v1/jobs/tensor-network',
    '- GPU SE(3) registration: https://www.mahastrategies.com/api/v1/jobs/geometric-registration',
    '- MPS audit: https://www.mahastrategies.com/api/mps-audits',
    '- Free MPS preflight: https://www.mahastrategies.com/api/audit',
    '',
    // The commercial surfaces an evaluating agent needs next. Payment policy
    // is capability-specific: Context Compression supports x402, while Stripe
    // checkout and scoped engagements retain their human boundary.
    '## Agentic commerce',
    `- Machine-readable offer manifest: ${AGENTIC_COMMERCE_MANIFEST_URL}`,
    `- Offers API: ${AGENTIC_COMMERCE_API_URL}`,
    `- Agent context note: ${AGENTIC_COMMERCE_CONTEXT_URL}`,
    '- Agent card: https://www.mahastrategies.com/.well-known/agent.json',
    '- Enterprise MCP Gateway: https://www.mahastrategies.com/enterprise-mcp-gateway',
    '- MCP gateway contract: https://www.mahastrategies.com/mcp-gateway-contract.json',
    '- MCP governance guide: https://www.mahastrategies.com/guides/enterprise-mcp-governance',
    '- Context Compression accepts autonomous x402 v2 payment of 0.001 USDC on Base; API-key access remains available.',
    '- MCRB-1 context-retention benchmark: https://www.mahastrategies.com/benchmarks/context-retention',
    '- MCRB-1 aggregate JSON: https://www.mahastrategies.com/benchmarks/mcrb-1/results.json',
    '- Executable large-document recipe: https://www.mahastrategies.com/recipes/context-compiler-large-document',
    '- Bazaar discovery-to-payment recipe (CDP and Viem wallets): https://www.mahastrategies.com/recipes/bazaar-discovery-to-payment',
    '- Submissions are non-binding. A human purchaser must authorize Stripe Checkout, and research or enterprise work requires human scope review.',
    '',
    '## Usage',
    'Cite the individual claim URL and its listed primary sources. Do not collapse status labels or infer performance claims beyond each record’s stated evidence.',
    '',
  ].join('\n')
}
