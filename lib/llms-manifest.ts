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
    '## Knowledge registries',
    '- Knowledge index: https://www.mahastrategies.com/knowledge',
    '- Celestial fact layer: https://www.mahastrategies.com/knowledge/celestial',
    '- Celestial fact schema: https://www.mahastrategies.com/knowledge/celestial/schema',
    '- Astronomy knowledge layer: https://www.mahastrategies.com/knowledge/astronomy',
    '- Astronomy machine-readable registry: https://www.mahastrategies.com/knowledge/astronomy/registry',
    '- Astronomy registry schema: https://www.mahastrategies.com/knowledge/astronomy/schema',
    '- Epistemic publication system: https://www.mahastrategies.com/knowledge/epistemic-system',
    '- Epistemic schema: https://www.mahastrategies.com/knowledge/epistemic-system/schema',
    '- Epistemic legacy migration ledger: https://www.mahastrategies.com/knowledge/epistemic-system/migrations',
    '- Epistemic machine-readable migration registry: https://www.mahastrategies.com/knowledge/epistemic-system/migration-registry',
    '- Epistemic canonical release ledger: https://www.mahastrategies.com/knowledge/epistemic-system/releases',
    '- Epistemic canonical release registry: https://www.mahastrategies.com/knowledge/epistemic-system/releases/registry.json',
    '- Epistemic Phase 4 pilot corpus: https://www.mahastrategies.com/knowledge/epistemic-system/pilot-corpus',
    '- Epistemic Phase 4 pilot registry: https://www.mahastrategies.com/knowledge/epistemic-system/pilot-corpus/registry.json',
    '- Quantum systems pilot registry: https://www.mahastrategies.com/knowledge/quantum-systems/registry',
    '- Synthetic biology pilot registry: https://www.mahastrategies.com/knowledge/synthetic-biology/registry',
    '',
    '## Open research editions',
    '- Books and essays index: https://www.mahastrategies.com/books',
    '- The Volcanic Engine — open research edition: https://www.mahastrategies.com/books/the-volcanic-engine',
    '- The Volcanic Engine — section reader: https://www.mahastrategies.com/books/the-volcanic-engine/read',
    '- The Volcanic Engine — sources and verification register: https://www.mahastrategies.com/books/the-volcanic-engine/read/sources-and-further-reading',
    '- Companion guide — Why do volcanoes explode?: https://www.mahastrategies.com/books/the-volcanic-engine/why-volcanoes-explode',
    '- Myth check — Is Yellowstone overdue?: https://www.mahastrategies.com/books/the-volcanic-engine/is-yellowstone-overdue',
    '  - Research boundary: the edition preserves empirical, theoretical, speculative, and pending-verification labels. Do not upgrade a draft verification note into an established claim.',
    '',
    '## Public API endpoints',
    '- OpenAPI document: https://www.mahastrategies.com/api/docs/openapi',
    '- Context compression: https://www.mahastrategies.com/api/v1/compress',
    '- Deep context evaluation: https://www.mahastrategies.com/api/v1/compress/evaluate',
    '- Autonomous MPS audit: https://www.mahastrategies.com/api/v1/mps/audit',
    '- GPU tensor-network QUBO/Ising heuristic: https://www.mahastrategies.com/api/v1/jobs/tensor-network',
    '- GPU SE(3) registration: https://www.mahastrategies.com/api/v1/jobs/geometric-registration',
    '- MPS audit: https://www.mahastrategies.com/api/mps-audits',
    '- Free MPS preflight: https://www.mahastrategies.com/api/audit',
    '',
    // The commercial surfaces an evaluating agent needs next. Payment policy
    // is capability-specific: Context Compression supports x402, while Stripe
    // checkout and scoped engagements retain their human boundary.
    '## Agentic commerce',
    '- Maha Machine-Readable Registry (public capabilities, evidence, schemas, and boundaries): https://www.mahastrategies.com/maha-machine-readable-registry.json',
    `- Machine-readable offer manifest: ${AGENTIC_COMMERCE_MANIFEST_URL}`,
    `- Offers API: ${AGENTIC_COMMERCE_API_URL}`,
    `- Agent context note: ${AGENTIC_COMMERCE_CONTEXT_URL}`,
    '- Agent card: https://www.mahastrategies.com/.well-known/agent.json',
    '- CABEZON Seller role v0.2 mirror (digital fulfillment adopted upstream from Maha PR #1): https://www.mahastrategies.com/.well-known/carp/seller-role.json',
    '- Maha CARP Seller profile and Deep Context Evaluation offer: https://www.mahastrategies.com/.well-known/carp/seller.json',
    '- Maha CARP DID: https://www.mahastrategies.com/.well-known/carp/did.json',
    '- Maha signed CARP Agent Descriptor (SAD): https://www.mahastrategies.com/.well-known/carp/sad.json',
    '- Agent Infrastructure Compatibility Pack: https://www.mahastrategies.com/agent-infrastructure-compatibility-pack',
    '  - Machine contract and exact schemas: https://www.mahastrategies.com/api/discovery/agent-infrastructure-compatibility-pack',
    '  - Fixed price: 49.00 USDC on Base Mainnet. CONTRACT PUBLISHED, RUNTIME WITHHELD: not currently payable. One A2A agent, one MCP server, one caller-declared non-mutating action per target. Compatibility failures are report findings; Maha delivery failures after settlement receive a full automatic refund.',
    '- Enterprise MCP Gateway: https://www.mahastrategies.com/enterprise-mcp-gateway',
    '- MCP gateway contract: https://www.mahastrategies.com/mcp-gateway-contract.json',
    '- MCP governance guide: https://www.mahastrategies.com/guides/enterprise-mcp-governance',
    // Naming the exact three, and naming what is excluded, because an agent
    // that assumes every /api/v1 route is payable will sign for one it cannot
    // buy. Matching is by exact method and path: a sub-path of a priced route
    // is not priced, and a GET beside a priced POST is not the priced resource.
    '- Autonomous x402 v2 payment on Base Mainnet (eip155:8453) is accepted on POST /api/v1/compress and POST /api/v1/compress/evaluate. A third offer is published below and is NOT currently payable. The status field on each offer is authoritative, and a live PAYMENT-REQUIRED challenge is the only proof an offer can be bought.',
    // Which offer to call, or none. The two compression offers are easy to
    // confuse -- both compile a context pack and only one measures anything --
    // and the MPS audit is a different product entirely, so the selection
    // contract is named here rather than left to be inferred from three
    // descriptions read side by side.
    '- Machine-readable Maha offer selection guide: https://www.mahastrategies.com/.well-known/maha/offer-selection.json',
    '  - Deterministic rules for choosing Context Compression, Deep Context Evaluation, the Autonomous MPS Audit, or none of them, with published non-fit conditions and worked examples. Advisory only: the live PAYMENT-REQUIRED challenge remains authoritative for terms.',
    '  - POST /api/v1/compress - 1000 USDC base units (0.001 USDC). API-key access also available.',
    '  - POST /api/v1/compress/evaluate - 10000 USDC base units (0.01 USDC). API-key access also available. Reports exact retention of caller-labelled evidence spans; this is span matching, not factual accuracy, answer quality, verification, or hallucination prevention.',
    '  - POST /api/v1/mps/audit - 100000 USDC base units (0.10 USDC). WITHHELD: described here but not currently payable. x402 only; needs no Maha credential and consumes no prepaid MPS credit. Automated claim triage with provenance statuses, not factual certification, legal advice, or human verification. The complete submitted passage is not retained; results retain short verbatim claim excerpts, classifications, rationales, hashes and operational metadata. Requires an idempotency key and an input hash, both claimed before settlement, so a replayed request returns the job already paid for rather than charging twice. The response carries a one-time retrievalToken; GET /api/v1/mps/audit/{auditId} with that token resumes or retrieves the job and is deliberately unpriced, so recovering a job you already bought never costs a second payment.',
    '- No other endpoint accepts autonomous payment. The GPU routes (/api/v1/jobs/*) are not x402 products and require a provisioned API key.',
    '- Complete machine-readable declarations: https://www.mahastrategies.com/api/discovery/x402-offers/{offerId}',
    '- A paid MPS audit is retrievable and resumable at /api/v1/mps/audit/{auditId} with the one-time retrievalToken, without a second payment.',
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
