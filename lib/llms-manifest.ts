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
    '- Tensor-Opt mock: https://www.mahastrategies.com/api/v1/tensor-opt',
    '- Geometric AI mock: https://www.mahastrategies.com/api/v1/geometric-ai',
    '- Holographic QEC mock: https://www.mahastrategies.com/api/v1/holographic-qec',
    '- Landscape-Opt mock: https://www.mahastrategies.com/api/v1/landscape-opt',
    '',
    // The commercial surfaces an evaluating agent needs next. Payment always
    // requires a human purchaser; the manifest states that boundary itself.
    '## Agentic commerce',
    `- Machine-readable offer manifest: ${AGENTIC_COMMERCE_MANIFEST_URL}`,
    `- Offers API: ${AGENTIC_COMMERCE_API_URL}`,
    `- Agent context note: ${AGENTIC_COMMERCE_CONTEXT_URL}`,
    '- Agent card: https://www.mahastrategies.com/.well-known/agent.json',
    '- MCP gateway contract: https://www.mahastrategies.com/mcp-gateway-contract.json',
    '- Submissions are non-binding. No autonomous payment is accepted; a human purchaser must authorize any checkout.',
    '',
    '## Usage',
    'Cite the individual claim URL and its listed primary sources. Do not collapse status labels or infer performance claims beyond each record’s stated evidence.',
    '',
  ].join('\n')
}
