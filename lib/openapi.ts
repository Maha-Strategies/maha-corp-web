import { MAX_AUDIT_CHARS, MPS_ACTIONS, MPS_TAGS, MPS_VERSION } from './mps-audit-engine.ts'
import { MPS_AUDIT_CREDIT_UNIT } from './mps-credits.ts'
import { AGENTIC_COMMERCE_API_URL } from './agentic-commerce.ts'
import {
  COMPATIBILITY_PACK_CONTRACT,
  COMPATIBILITY_PACK_OUTPUT_SCHEMA,
} from './agent-infrastructure-compatibility-pack.ts'

// Hand-authored OpenAPI 3.1 document for the public API. The runtime
// validators in lib/ are the source of truth; every pattern and bound here
// mirrors one of them, and test/openapi-docs.test.ts guards path drift.

const ERROR_ENVELOPE = {
  type: 'object',
  required: ['error'],
  properties: {
    error: {
      type: 'object',
      required: ['code', 'message'],
      properties: {
        code: { type: 'string', description: 'Stable machine-readable error code.' },
        message: { type: 'string', description: 'Human-readable explanation.' },
      },
    },
  },
} as const

function errorResponse(description: string) {
  return {
    description,
    content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorEnvelope' } } },
  }
}

const INFO_DESCRIPTION = `
The Maha Provenance Standard (MPS) API runs claim-level provenance audits over prose. Every factual claim in a passage is excerpted, tagged (${MPS_TAGS.join(', ')}), and returned with a rationale and a recommended action — so agents and editors can verify before they publish.

## Local bridge (CLI)

Install the open-source local bridge and point Claude Code, Cursor, or any MCP client at it:

\`\`\`sh
npm install -g @mahastrategies/maha-mcp-bridge
maha login        # verify and store your credential
maha serve        # start the stdio MCP server
\`\`\`

Raw rows and credentials stay local; only locally-redacted context reaches the agent's cloud model.

## Authentication

Commercial endpoints use bearer credentials:

\`\`\`
Authorization: Bearer mhaic_your_credential_here
\`\`\`

Credentials are shown **exactly once** at purchase. Store them in a secret manager; never commit them, log them, or place them in URLs. Each credential is scoped to the MPS audit capability only — it cannot touch any other service. Lost credentials cannot be recovered, only replaced.

The free preflight endpoint (\`POST /api/audit\`) needs no credential and is limited per visitor per day.

## The credit system

Paid audits are prepaid. Each successful audit consumes one \`${MPS_AUDIT_CREDIT_UNIT}\` credit; failed audits are refunded automatically in the same ledger.

When a credential runs out of credits, the API responds with **\`402 Payment Required\`**:

\`\`\`json
{
  "error": { "code": "payment_required", "message": "This prepaid credential has no audit credits remaining." },
  "purchase": { "href": "/mps/audit-access", "checkoutEndpoint": "/api/mps-credits/checkout", "unit": "${MPS_AUDIT_CREDIT_UNIT}" }
}
\`\`\`

Treat \`402\` as a routine signal, not an error: follow \`purchase.href\` to buy another pack, or call the checkout endpoint programmatically. Balances live in an append-only double-entry ledger — every grant, consumption, refund, and manual correction is a permanent, hash-chained row.

## Idempotency and webhook resilience

**Requests**: every audit takes a \`clientRequestId\` you choose (8–120 characters). Retrying with the same id and the same text returns the original result with \`idempotentReplay: true\` — never a duplicate charge. The same id with *different* text returns \`409 Conflict\`. Safe retry loop: keep the same id until you get a terminal status.

**Payments**: Stripe webhooks are processed exactly once. Each event id is claimed atomically in the same database transaction that moves credits, so a redelivered webhook can never double-credit a balance — duplicates get \`200 OK\` with \`"duplicate": true\` and change nothing. A crash between claim and grant rolls both back together. You never need to reconcile double-grants; the ledger cannot express them.
`.trim()

export const openApiDocument = {
  openapi: '3.1.0',
  info: {
    title: 'Maha Strategies MPS API',
    version: MPS_VERSION,
    description: INFO_DESCRIPTION,
    contact: { name: 'Maha Strategies', url: 'https://www.mahastrategies.com/contact' },
  },
  servers: [{ url: 'https://www.mahastrategies.com' }],
  tags: [
    { name: 'Agentic Commerce', description: 'Read-only offer and transaction-policy discovery for agents.' },
    { name: 'x402 Conformance', description: 'Factual protocol and Bazaar discovery observations without trust, security, or uptime scoring.' },
    { name: 'MPS Audit', description: 'Prepaid claim-level provenance audits.' },
    { name: 'Checkout', description: 'Self-service credit purchase.' },
    { name: 'Webhooks', description: 'Stripe payment confirmation (called by Stripe, documented for transparency).' },
    { name: 'Free Preflight', description: 'Rate-limited public demo, no credential required.' },
    { name: 'Books', description: 'Purchased-book entitlement checks for the local MCP bridge.' },
    { name: 'Enterprise MCP Gateway', description: 'Tenant-scoped MCP proxy for operator-registered public upstream servers.' },
    { name: 'Context Compiler', description: 'Deterministic, source-linked context-pack compilation with privacy-safe measurement.' },
    { name: 'Self-service API Keys', description: 'Instant starter-key provisioning and prepaid credit checkout.' },
    { name: 'Maha SDK', description: 'Small, credentialed context compression and provenance lookup endpoints for the public TypeScript SDK.' },
    { name: 'Maha OpenAI-compatible Proxy', description: 'Non-streaming OpenAI Chat Completions proxy with transient, deterministic context compaction.' },
    { name: 'GPU Heuristic Optimization', description: 'Bounded asynchronous QUBO/Ising optimization using the benchmarked bounded-bond tensor-network heuristic.' },
    { name: 'GPU Geometric Optimization', description: 'Bounded paired-point SE(3) registration with explicit residual and correspondence boundaries.' },
  ],
  paths: {
    '/api/discovery/agent-infrastructure-compatibility-pack': {
      get: {
        tags: ['Agentic Commerce'],
        operationId: 'getAgentInfrastructureCompatibilityPackContract',
        summary: 'Inspect the fixed-price Agent Infrastructure Compatibility Pack contract',
        description: 'Returns the exact input and output schemas, fixed price, bounded execution scope, limitations, and failure/refund policy. The runtime is withheld and this read-only route cannot create or pay for a pack.',
        security: [],
        responses: {
          '200': {
            description: 'Public contract. purchase.payableNow remains false until the durable delivery and refund runtime is promoted.',
            content: { 'application/json': { schema: {
              type: 'object',
              required: ['id', 'version', 'name', 'status', 'price', 'purchase', 'execution', 'failureAndRefund', 'limitations', 'inputSchema', 'outputSchema', 'sampleReportUrl'],
              properties: {
                id: { const: COMPATIBILITY_PACK_CONTRACT.id }, version: { const: COMPATIBILITY_PACK_CONTRACT.version }, name: { type: 'string' },
                status: { const: 'contract_published_runtime_withheld' }, description: { type: 'string' }, price: { type: 'object' }, deliveryTarget: { type: 'string' },
                purchase: { type: 'object', required: ['payableNow', 'reason'], properties: { payableNow: { const: false }, reason: { type: 'string' } } },
                execution: { type: 'object' }, failureAndRefund: { type: 'object' }, limitations: { type: 'array', items: { type: 'string' } },
                inputSchema: { type: 'object' }, outputSchema: { type: 'object' }, sampleReportUrl: { type: 'string', format: 'uri' },
              },
            } } },
          },
        },
      },
    },
    '/api/discovery/agent-infrastructure-compatibility-pack/sample': {
      get: {
        tags: ['Agentic Commerce'],
        operationId: 'getAgentInfrastructureCompatibilityPackSample',
        summary: 'Inspect a complete sample compatibility report',
        description: 'Returns an illustrative report conforming to the published output schema. It is not a report about a current customer or a certification.',
        security: [],
        responses: { '200': { description: 'Complete illustrative report.', content: { 'application/json': { schema: COMPATIBILITY_PACK_OUTPUT_SCHEMA } } } },
      },
    },
    '/api/v1/keys/generate': {
      post: {
        tags: ['Self-service API Keys'], operationId: 'generateStarterApiKey', summary: 'Generate a one-time starter API key with 20,000 free credits',
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['email'], properties: { email: { type: 'string', format: 'email' } } } } } },
        responses: { '201': { description: 'The API key is disclosed exactly once.', content: { 'application/json': { schema: { type: 'object', required: ['apiKey', 'apiKeyId', 'balanceCredits', 'tier'], properties: { apiKey: { type: 'string', description: 'Secret shown once; store it securely.' }, apiKeyId: { type: 'string' }, balanceCredits: { type: 'integer', const: 20000 }, tier: { const: 'starter' } } } } } }, '400': errorResponse('Invalid email.'), '429': errorResponse('Starter-key provisioning rate limit reached.'), '503': errorResponse('Key provisioning unavailable.') },
      },
    },
    '/api/v1/keys/checkout': {
      post: {
        tags: ['Self-service API Keys'], operationId: 'createApiCreditCheckout', summary: 'Create a hosted Stripe Checkout session for a prepaid API credit pack', security: [{ credential: [] }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['pack', 'clientRequestId'], properties: { pack: { type: 'string', enum: ['starter', 'builder', 'scale', 'pro', 'enterprise'] }, clientRequestId: { type: 'string', minLength: 8, maxLength: 120, pattern: '^[A-Za-z0-9_-]+$', description: 'Stable idempotency key. Reuse it only while retrying this exact pack purchase.' } } } } } },
        responses: { '200': { description: 'Hosted checkout URL.', content: { 'application/json': { schema: { type: 'object', required: ['checkoutUrl', 'pack', 'idempotentReplay'], properties: { checkoutUrl: { type: 'string', format: 'uri' }, pack: { type: 'string' }, idempotentReplay: { type: 'boolean' } } } } } }, '400': errorResponse('Invalid pack or idempotency key.'), '401': errorResponse('Invalid API key.'), '409': errorResponse('A reused request ID conflicts with another purchase or has already completed.'), '503': errorResponse('Checkout unavailable.') },
      },
    },
    '/api/v1/keys/balance': {
      get: {
        tags: ['Self-service API Keys'], operationId: 'getApiKeyBalance', summary: 'Get the balance for the current API key', security: [{ credential: [] }],
        responses: { '200': { description: 'Current prepaid API-key balance and non-secret key identifier.', content: { 'application/json': { schema: { type: 'object', required: ['api_key_id', 'balance_credits', 'tier'], properties: { api_key_id: { type: 'string', description: 'Non-secret identifier for this authenticated API key.' }, balance_credits: { type: 'integer', minimum: 0 }, tier: { type: 'string', enum: ['starter', 'builder', 'scale', 'enterprise'] } } } } } }, '401': errorResponse('Missing or invalid API key.'), '503': errorResponse('API-key service unavailable.') },
      },
    },
    '/api/v1/keys/rotate': {
      post: {
        tags: ['Self-service API Keys'], operationId: 'rotateCurrentApiKey', summary: 'Rotate the current API key without changing its balance or key ID', security: [{ credential: [] }],
        responses: { '201': { description: 'Replacement API key disclosed exactly once. The prior raw key is immediately revoked.', content: { 'application/json': { schema: { type: 'object', required: ['apiKey', 'apiKeyId', 'balanceCredits', 'tier', 'disclosure'], properties: { apiKey: { type: 'string', description: 'Replacement secret shown once; store it securely.' }, apiKeyId: { type: 'string' }, balanceCredits: { type: 'integer', minimum: 0 }, tier: { type: 'string', enum: ['starter', 'builder', 'scale', 'enterprise'] }, disclosure: { type: 'string' } } } } } }, '401': errorResponse('Missing, invalid, or inactive API key.'), '503': errorResponse('Key rotation unavailable.') },
      },
    },
    '/api/v1/keys/revoke': {
      post: {
        tags: ['Self-service API Keys'], operationId: 'revokeCurrentApiKey', summary: 'Permanently revoke the current API key', security: [{ credential: [] }],
        responses: { '200': { description: 'Key permanently revoked.', content: { 'application/json': { schema: { type: 'object', required: ['revoked'], properties: { revoked: { const: true } } } } } }, '401': errorResponse('Missing, invalid, or inactive API key.'), '503': errorResponse('Key revocation unavailable.') },
      },
    },
    '/api/v1/billing/subscription': {
      post: {
        tags: ['Checkout'], operationId: 'createTenantSubscriptionCheckout', summary: 'Create Builder or Scale subscription Checkout for the authenticated tenant', security: [{ credential: [] }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['tier', 'clientRequestId'], properties: { tier: { type: 'string', enum: ['builder', 'scale'] }, clientRequestId: { type: 'string', minLength: 8, maxLength: 120, pattern: '^[A-Za-z0-9_-]+$', description: 'Stable idempotency key for retrying this Checkout attempt.' } } } } } },
        responses: { '200': { description: 'Hosted Stripe subscription Checkout URL.', content: { 'application/json': { schema: { type: 'object', required: ['url'], properties: { url: { type: 'string', format: 'uri' } } } } } }, '400': errorResponse('Invalid tier.'), '401': errorResponse('Invalid API key.'), '409': errorResponse('Tenant already has a subscription.'), '503': errorResponse('Subscription Checkout unavailable.') },
      },
    },
    '/api/v1/billing/settings': {
      get: {
        tags: ['Checkout'], operationId: 'getTenantBillingSettings', summary: 'Get tenant subscription balances and auto-top-up state', security: [{ credential: [] }],
        responses: { '200': { description: 'Sanitized tenant billing state; Stripe identifiers are not returned.' }, '401': errorResponse('Invalid API key.'), '503': errorResponse('Billing settings unavailable.') },
      },
      post: {
        tags: ['Checkout'], operationId: 'updateTenantAutoTopup', summary: 'Explicitly enable or disable tenant automatic top-up', security: [{ credential: [] }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['autoTopupEnabled'], properties: { autoTopupEnabled: { type: 'boolean' } } } } } },
        responses: { '200': { description: 'Updated automatic top-up state.' }, '400': errorResponse('Invalid setting.'), '401': errorResponse('Invalid API key.'), '409': errorResponse('An active subscription and saved payment method are required.'), '503': errorResponse('Billing settings unavailable.') },
      },
    },
    '/api/v1/compress': {
      post: {
        tags: ['Maha SDK'], operationId: 'compressContext', summary: 'Compile a bounded context pack through the lightweight SDK contract',
        description: 'Deterministic context compilation available with a Maha API key or an autonomous $0.001 USDC payment over x402 v2 on Base. It does not retain source text or make factual-verification claims. Credentialed calls cost one credit per request, plus one credit for every whole 5,000 estimated input tokens the pack avoided, capped at 60 per call and charged only when metered billing is enabled for the deployment. Partial units are free and a call that saved nothing costs only the flat credit. Send x-maha-max-billable-credits to cap what one request may add. The x402 price is flat: an authorization is signed before the saving is known, so it is never metered.', security: [{ credential: [] }, {}],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['clientRequestId', 'task', 'tokenBudget', 'documents'], properties: { clientRequestId: { type: 'string', minLength: 8, maxLength: 120 }, task: { type: 'string', minLength: 8, maxLength: 1200 }, tokenBudget: { type: 'integer', minimum: 64, maximum: 16000 }, documents: { type: 'array', minItems: 1, maxItems: 8, items: { type: 'object', required: ['id', 'text'], properties: { id: { type: 'string' }, title: { type: 'string' }, text: { type: 'string', maxLength: 64000 } } } } } } } } },
        responses: { '201': { description: 'Transient compiled context pack.', content: { 'application/json': { schema: { type: 'object', required: ['packId', 'context', 'metrics', 'sources', 'warnings'], properties: { packId: { type: 'string' }, context: { type: 'string' }, metrics: { type: 'object' }, sources: { type: 'array', items: { type: 'object' } }, warnings: { type: 'array', items: { type: 'string' } }, sourceTextStored: { const: false }, compiledContextStored: { const: false }, billing: { type: 'object', description: 'What this call was charged. Present on credentialed calls only; x402 callers pay the signed amount and nothing else.', properties: { model: { type: 'string', enum: ['flat', 'flat_plus_metered'] }, flatCredits: { type: 'integer' }, meteredCredits: { type: 'integer', description: 'Credits actually taken, never the amount owed.' }, tokensSaved: { type: 'integer' }, tokensSavedPerCredit: { type: 'integer' }, remainingCredits: { type: 'integer', description: 'Omitted when the ledger did not report a balance.' }, unbilledReason: { type: 'string', enum: ['billing_disabled', 'ledger_unavailable', 'credit_balance_depleted', 'capped_by_caller'] } } } } } } } }, '400': errorResponse('Invalid compression request.'), '401': errorResponse('Missing or invalid API key.'), '402': { description: 'API-key credits are depleted, or an unauthenticated caller must answer the x402 v2 payment challenge.', headers: { 'PAYMENT-REQUIRED': { description: 'Base64-encoded x402 v2 PaymentRequired object, including Base USDC terms and Bazaar discovery metadata.', schema: { type: 'string' } } }, content: { 'application/json': { schema: { type: 'object' } } } }, '413': errorResponse('Context input exceeds the configured tier limit.'), '415': errorResponse('Content-Type must be application/json.') },
      },
    },
    '/api/discovery/x402-offers/{offerId}': {
      get: {
        tags: ['Maha SDK'], operationId: 'getX402OfferDeclaration', summary: 'Fetch the complete discovery declaration for an x402 offer', security: [{}],
        description: 'Public, unauthenticated and free. The PAYMENT-REQUIRED challenge carries a complete-but-compact declaration so that a conforming x402 v2 client, which echoes the declaration back inside PAYMENT-SIGNATURE, stays under the 16 KB request-header ceiling. This route serves the uncompacted input and output schemas and examples that had to be left out, and is the form a catalog should index. Returns the offer status and, when an offer is not payable in Production, the gates it is waiting on.',
        parameters: [{ name: 'offerId', in: 'path', required: true, schema: { type: 'string', enum: ['context-compression', 'deep-context-evaluation', 'mps-autonomous-audit'] } }],
        responses: { '200': { description: 'Complete offer declaration.', content: { 'application/json': { schema: { type: 'object', required: ['offerId', 'resource', 'payment', 'status', 'contract'], properties: { offerId: { type: 'string' }, metadataVersion: { type: 'string' }, declarationUrl: { type: 'string', format: 'uri' }, resource: { type: 'object' }, description: { type: 'string' }, payment: { type: 'object' }, status: { type: 'string', enum: ['available', 'preview', 'withheld'] }, availability: { type: 'object' }, maxRequestBytes: { type: 'integer' }, capabilityBoundaries: { type: 'array', items: { type: 'string' } }, retention: { type: 'object' }, contract: { type: 'object' } } } } } }, '404': errorResponse('No such x402 offer.') },
      },
    },
    '/api/discovery/offer-selection': {
      get: {
        tags: ['Maha SDK'], operationId: 'getOfferSelectionGuide', summary: 'Machine-readable Maha offer selection guide', security: [{}],
        description: 'Canonical public URL: https://www.mahastrategies.com/.well-known/maha/offer-selection.json, which rewrites to this route. Public, unauthenticated and free. A selection contract rather than product prose: it states which x402 offer an autonomous buyer should call, or that it should call neither. Generated from the offer catalog on every request, so prices, limits, status and availability cannot drift from the payable declarations. Carries the selection inputs, the ordered decision rules, per-offer fit and non-fit conditions, the two-stage flow relationship, and worked examples with their expected decisions. Advisory: a live PAYMENT-REQUIRED challenge remains authoritative for terms, and the buyer-policy package remains the signing authorization boundary.',
        responses: { '200': { description: 'The offer selection contract.', content: { 'application/json': { schema: { type: 'object', required: ['schemaVersion', 'canonicalUrl', 'provider', 'decisionPolicy', 'offers', 'nonFitConditions', 'examples'], properties: { schemaVersion: { type: 'string' }, canonicalUrl: { type: 'string', format: 'uri' }, provider: { type: 'object' }, advisory: { type: 'string' }, settlement: { type: 'object' }, selectionInputs: { type: 'object' }, decisionPolicy: { type: 'object', properties: { defaultOfferId: { type: 'string' }, failClosed: { type: 'boolean' }, substitutionPolicy: { type: 'string' }, rules: { type: 'array', items: { type: 'object' } } } }, flow: { type: 'object' }, offers: { type: 'array', items: { type: 'object' } }, nonFitConditions: { type: 'array', items: { type: 'string' } }, examples: { type: 'array', items: { type: 'object' } } } } } } } },
      },
    },
    '/api/v1/compress/evaluate': {
      post: {
        tags: ['Maha SDK'], operationId: 'evaluateContextPack', summary: 'Compile a context pack and measure exact retention of caller-labelled evidence spans',
        description: 'Deep Context Evaluation. Compiles 1-8 documents into a token-budgeted context pack, then reports whether each of 1-32 caller-supplied evidence spans survived selection verbatim. Available with a Maha API key or an autonomous $0.01 USDC payment over x402 v2 on Base Mainnet. The retention figure is exact span matching and nothing else: it is not factual accuracy, answer quality, verification, or hallucination prevention, and a retained span means the text was present, not that the text is true. Source text, compiled context and evidence spans are all transient; only hashes and counts are retained.', security: [{ credential: [] }, {}],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['clientRequestId', 'task', 'tokenBudget', 'documents', 'requiredEvidence'], properties: { clientRequestId: { type: 'string', minLength: 8, maxLength: 120 }, task: { type: 'string', minLength: 8, maxLength: 1200 }, tokenBudget: { type: 'integer', minimum: 64, maximum: 16000 }, documents: { type: 'array', minItems: 1, maxItems: 8, items: { type: 'object', required: ['id', 'text'], properties: { id: { type: 'string' }, title: { type: 'string' }, text: { type: 'string' } } } }, requiredEvidence: { type: 'array', minItems: 1, maxItems: 32, description: 'Spans the compiled pack must retain. Each must be an exact substring of its declared source document.', items: { type: 'object', required: ['evidenceId', 'sourceId', 'text'], properties: { evidenceId: { type: 'string' }, sourceId: { type: 'string' }, text: { type: 'string', minLength: 3, maxLength: 4000 } } } } } } } } },
        responses: { '201': { description: 'Compiled context pack with per-span retention.', content: { 'application/json': { schema: { type: 'object', required: ['evaluationId', 'contextPack', 'evidence', 'metrics', 'inputHash', 'outputHash', 'warningCodes', 'retentionBoundaries'], properties: { evaluationId: { type: 'string' }, offerId: { const: 'deep-context-evaluation' }, contextPack: { type: 'object' }, evidence: { type: 'array', items: { type: 'object', properties: { evidenceId: { type: 'string' }, sourceId: { type: 'string' }, evidenceHash: { type: 'string' }, status: { type: 'string', enum: ['retained', 'omitted'] } } } }, metrics: { type: 'object', properties: { requiredEvidenceCount: { type: 'integer' }, retainedEvidenceCount: { type: 'integer' }, requiredEvidenceRetentionPercent: { type: 'number', description: 'Exact span retention rate. Not factual accuracy, answer quality, verification, or hallucination prevention.' } } }, inputHash: { type: 'string' }, outputHash: { type: 'string' }, warnings: { type: 'array', items: { type: 'string' } }, warningCodes: { type: 'array', items: { type: 'string' } }, retentionBoundaries: { type: 'object' }, sourceTextStored: { const: false }, compiledContextStored: { const: false }, requiredEvidenceTextStored: { const: false } } } } } }, '400': errorResponse('Invalid evaluation request.'), '401': errorResponse('Missing or invalid API key.'), '402': { description: 'API-key credits are depleted, or an unauthenticated caller must answer the x402 v2 payment challenge for 10000 USDC base units.', headers: { 'PAYMENT-REQUIRED': { description: 'Base64-encoded x402 v2 PaymentRequired object.', schema: { type: 'string' } } }, content: { 'application/json': { schema: { type: 'object' } } } }, '413': errorResponse('Evaluation input exceeds 1,050,000 bytes.'), '415': errorResponse('Content-Type must be application/json.') },
      },
    },
    '/api/v1/mps/audit': {
      post: {
        tags: ['MPS Audit'], operationId: 'createAutonomousMpsAudit', summary: 'Triage the claims in a passage, paid autonomously over x402',
        description: 'Automated claim triage under the Maha Provenance Standard v0.1, priced at $0.10 USDC over x402 v2 on Base Mainnet. No Maha credential is required and no prepaid MPS audit credit is consumed; the credential and prepaid path at /api/mps-audits is unchanged. Each substantive claim is returned with a model-assigned provenance status, a rationale and a suggested action. This is triage, not factual certification, legal advice or human verification, and results must be checked before publication. The complete submitted passage is not retained; results retain short verbatim claim excerpts (6-25 words each), classifications, rationales, hashes and operational metadata. The response carries a one-time high-entropy retrievalToken: a paid job is recoverable and resumable at /api/v1/mps/audit/{auditId} without a second payment, so keep it.', security: [{}],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['clientRequestId', 'text'], properties: { clientRequestId: { type: 'string', minLength: 8, maxLength: 120, description: 'Replaying this value returns the job already paid for rather than charging again.' }, text: { type: 'string', minLength: 1, maxLength: 6000 } } } } } },
        responses: { '201': { description: 'Completed audit. retrievalToken is returned once and never again.', content: { 'application/json': { schema: { type: 'object', required: ['auditId', 'retrievalToken', 'status', 'warningCodes', 'retentionBoundaries'], properties: { auditId: { type: 'string' }, retrievalToken: { type: 'string' }, retrievalPath: { type: 'string' }, clientRequestId: { type: 'string' }, inputHash: { type: 'string' }, status: { type: 'string', enum: ['completed', 'processing', 'failed'] }, audit: { type: 'object' }, warnings: { type: 'array', items: { type: 'string' } }, warningCodes: { type: 'array', items: { type: 'string' } }, retentionBoundaries: { type: 'object' }, sourceTextStored: { const: false } } } } } }, '200': { description: 'Idempotent replay of a job this payer already bought.', content: { 'application/json': { schema: { type: 'object' } } } }, '202': { description: 'The job is still processing. Poll the retrieval path; no further payment is required.', content: { 'application/json': { schema: { type: 'object' } } } }, '400': errorResponse('Invalid request body.'), '402': { description: 'The x402 v2 payment challenge for 100000 USDC base units.', headers: { 'PAYMENT-REQUIRED': { description: 'Base64-encoded x402 v2 PaymentRequired object.', schema: { type: 'string' } } }, content: { 'application/json': { schema: { type: 'object' } } } }, '409': errorResponse('clientRequestId was already used with different source text.'), '413': errorResponse('Request body exceeds the 32 KB limit.'), '415': errorResponse('Content-Type must be application/json.'), '502': { description: 'The model did not complete. The payment is recorded against the auditId, which is returned with its retrievalToken so the job can be resumed without paying again.', content: { 'application/json': { schema: { type: 'object' } } } }, '503': errorResponse('The audit ledger is unavailable; no model call was made.') },
      },
    },
    '/api/v1/mps/audit/{auditId}': {
      get: {
        tags: ['MPS Audit'], operationId: 'getAutonomousMpsAudit', summary: 'Retrieve an audit already paid for', security: [{}],
        description: 'Returns the current state of a paid audit. Authenticated by the retrievalToken issued once at creation, presented as an Authorization Bearer credential; the auditId alone is not sufficient and is not a capability. This path is deliberately not priced, so recovering a job you already bought never costs a second payment.',
        parameters: [{ name: 'auditId', in: 'path', required: true, schema: { type: 'string', pattern: '^audit_[a-f0-9]{32}$' } }],
        responses: { '200': { description: 'Current job state.', content: { 'application/json': { schema: { type: 'object' } } } }, '404': errorResponse('No audit matches that id and retrieval token.'), '503': errorResponse('The audit ledger could not be read.') },
      },
      post: {
        tags: ['MPS Audit'], operationId: 'resumeAutonomousMpsAudit', summary: 'Resume a paid audit after a model failure or timeout', security: [{}],
        description: 'Re-runs the model for a job that has already been paid for, without charging again, up to 3 attempts in total. The original passage must be resubmitted: this offer retains no source text, so there is nothing stored to re-run against. The resubmitted passage must hash to the same value the job was paid for.',
        parameters: [{ name: 'auditId', in: 'path', required: true, schema: { type: 'string', pattern: '^audit_[a-f0-9]{32}$' } }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['text'], properties: { retrievalToken: { type: 'string', description: 'Alternative to the Authorization header.' }, text: { type: 'string', minLength: 1, maxLength: 6000 } } } } } },
        responses: { '200': { description: 'Completed audit.', content: { 'application/json': { schema: { type: 'object' } } } }, '202': { description: 'Still processing and not yet stale; the resume was not started.', content: { 'application/json': { schema: { type: 'object' } } } }, '400': errorResponse('The original passage is required to resume.'), '404': errorResponse('No audit matches that id and retrieval token.'), '409': errorResponse('The passage does not match the audit, or the retry allowance is exhausted.'), '502': { description: 'The model did not complete again.', content: { 'application/json': { schema: { type: 'object' } } } }, '503': errorResponse('The audit ledger is unavailable.') },
      },
    },
    '/api/v1/jobs/tensor-network': {
      post: {
        tags: ['GPU Heuristic Optimization'], operationId: 'createTensorNetworkJob', summary: 'Create a bounded-bond tensor-network QUBO/Ising job',
        description: 'Contracts the binary factor network in variable order and truncates the transfer frontier to the declared bond dimension. Exact enumeration is used only below the declared threshold; truncated results are heuristic and never claim optimality.', security: [{ credential: [] }],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/TensorNetworkJobRequest' } } } },
        responses: { '202': { description: 'Job queued; poll the returned pollUrl.', content: { 'application/json': { schema: { $ref: '#/components/schemas/TensorNetworkJob' } } } }, '200': { description: 'Idempotent replay.', content: { 'application/json': { schema: { $ref: '#/components/schemas/TensorNetworkJob' } } } }, '400': errorResponse('Invalid or unbenchmarked tensor-network configuration.'), '401': errorResponse('Missing or invalid API key.'), '402': errorResponse('Insufficient credits.'), '415': errorResponse('Content-Type must be application/json.'), '503': errorResponse('Job queue unavailable.') },
      },
    },
    '/api/v1/jobs/geometric-registration': {
      post: {
        tags: ['GPU Geometric Optimization'], operationId: 'createGeometricRegistrationJob', summary: 'Fit a weighted SE(3) transform to paired 3D points',
        description: 'Runs a weighted Kabsch SVD solve for the least-squares rigid transform between paired source and target points. It does not perform correspondence search or non-rigid deformation.', security: [{ credential: [] }],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/GeometricRegistrationJobRequest' } } } },
        responses: { '202': { description: 'Job queued; poll the returned pollUrl.', content: { 'application/json': { schema: { $ref: '#/components/schemas/GeometricRegistrationJob' } } } }, '200': { description: 'Idempotent replay.', content: { 'application/json': { schema: { $ref: '#/components/schemas/GeometricRegistrationJob' } } } }, '400': errorResponse('Invalid or unbenchmarked point-cloud configuration.'), '401': errorResponse('Missing or invalid API key.'), '402': errorResponse('Insufficient credits.'), '415': errorResponse('Content-Type must be application/json.'), '503': errorResponse('Job queue unavailable.') },
      },
    },
    '/api/v1/jobs/{jobId}': {
      get: {
        tags: ['GPU Heuristic Optimization'], operationId: 'getOptimizationJob', summary: 'Poll an optimization job owned by the current API key', security: [{ credential: [] }],
        parameters: [{ name: 'jobId', in: 'path', required: true, schema: { type: 'string', pattern: '^job_[a-f0-9]{32}$' } }],
        responses: { '200': { description: 'Credential-safe job state; submitted problem data is never echoed.', content: { 'application/json': { schema: { oneOf: [{ $ref: '#/components/schemas/TensorNetworkJob' }, { $ref: '#/components/schemas/GeometricRegistrationJob' }] } } } }, '400': errorResponse('Malformed job ID.'), '401': errorResponse('Missing or invalid API key.'), '404': errorResponse('Job not found for this API key.') },
      },
    },
    '/api/v1/chat/completions': {
      post: {
        tags: ['Maha OpenAI-compatible Proxy'], operationId: 'createMahaChatCompletion', summary: 'Create a non-streaming OpenAI-compatible chat completion through Maha context compaction',
        description: 'Accepts the standard Chat Completions payload shape and returns the upstream OpenAI JSON response unchanged. Text-only prior conversation may be deterministically compacted; multimodal or tool-call payloads are forwarded unchanged. Maha does not log or cache payloads. Streaming is not supported by this route.', security: [{ credential: [] }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['model', 'messages'], properties: { model: { type: 'string' }, messages: { type: 'array', minItems: 1, items: { type: 'object', required: ['role', 'content'], properties: { role: { type: 'string' }, content: {} } } }, temperature: { type: 'number' }, stream: { type: 'boolean', const: false } }, additionalProperties: true } } } },
        responses: {
          '200': { description: 'Unmodified upstream OpenAI Chat Completion JSON. Compression estimates are returned in X-Maha-* headers.', content: { 'application/json': { schema: { type: 'object', required: ['id', 'choices'], properties: { id: { type: 'string' }, choices: { type: 'array' }, usage: { type: 'object' } }, additionalProperties: true } } } },
          '400': errorResponse('Invalid request, unsupported streaming request, or unsafe compression input.'), '401': errorResponse('Missing or invalid Maha API key.'), '402': errorResponse('API-key credits depleted.'), '413': errorResponse('Chat request exceeds 512 KB.'), '429': errorResponse('API-key rate limit reached.'), '502': errorResponse('OpenAI upstream could not be reached.'), '503': errorResponse('Maha API-key service or upstream configuration unavailable.'),
        },
      },
    },
    '/api/v1/claims/{claimId}': {
      get: {
        tags: ['Maha SDK'], operationId: 'verifyGeneratedClaim', summary: 'Retrieve an active claim and its provenance fields',
        description: 'Returns a generated MPS claim node as published by the research graph. The result exposes its declared source citations and status; it does not independently re-verify a claim at request time.', security: [{ credential: [] }],
        parameters: [{ name: 'claimId', in: 'path', required: true, schema: { type: 'string', pattern: '^[a-z0-9]+(?:-[a-z0-9]+)*$' } }],
        responses: { '200': { description: 'Published claim node and canonical research URL.', content: { 'application/json': { schema: { type: 'object', required: ['claim_id', 'title', 'summary', 'status', 'latex_formulation', 'sources', 'tags', 'canonical_url'], properties: { claim_id: { type: 'string' }, title: { type: 'string' }, summary: { type: 'string' }, status: { type: 'string', enum: ['VERIFIED', 'SOURCED', 'ILLUSTRATIVE', 'UNVERIFIED'] }, latex_formulation: { type: 'string' }, sources: { type: 'array', items: { type: 'string' } }, tags: { type: 'array', items: { type: 'string' } }, canonical_url: { type: 'string', format: 'uri' } } } } } }, '401': errorResponse('Missing or invalid API key.'), '402': errorResponse('API-key credits depleted.'), '404': errorResponse('No active generated claim matches this ID.') },
      },
    },
    '/api/v1/audit/export': {
      get: {
        tags: ['MPS Audit'],
        summary: 'Export Provenance Audit Ledger',
        description: 'Generates an RFC 4180 CSV or cryptographic PDF report of the authenticated API key ledger. The caller cannot select another tenant ledger.',
        security: [{ credential: [] }],
        parameters: [
          { name: 'format', in: 'query', required: false, schema: { type: 'string', enum: ['csv', 'pdf'], default: 'csv' } },
          { name: 'startTime', in: 'query', required: false, schema: { type: 'integer' } },
          { name: 'endTime', in: 'query', required: false, schema: { type: 'integer' } },
        ],
        responses: {
          '200': {
            description: 'Audit file payload',
            content: {
              'text/csv': { schema: { type: 'string' } },
              'application/pdf': { schema: { type: 'string', format: 'binary' } },
            },
          },
          '400': errorResponse('Invalid format or time range.'),
          '401': errorResponse('Missing or invalid API key.'),
          '500': errorResponse('Internal audit export failure.'),
        },
      },
    },
    '/api/v1/mcp/register': {
      post: {
        tags: ['Enterprise MCP Gateway'],
        summary: 'Register Upstream MCP Server',
        description: 'Canonical gateway registration. Stores and encrypts upstream credentials, calls tools/list to persist a validated tool inventory, and applies an explicit method/tool policy. Encrypted credential material is never returned.',
        security: [{ credential: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name', 'baseUrl', 'authType', 'allowedMethods', 'allowedToolNames'],
                properties: {
                  name: { type: 'string' },
                  baseUrl: { type: 'string' },
                  authType: { type: 'string', enum: ['bearer', 'hmac', 'none'] },
                  secret: { type: 'string' },
                  allowedMethods: { type: 'array', minItems: 1, uniqueItems: true, items: { type: 'string', enum: ['initialize', 'notifications/initialized', 'ping', 'tools/list', 'resources/list', 'resources/read', 'prompts/list', 'prompts/get', 'tools/call'] } },
                  allowedToolNames: { type: 'array', maxItems: 256, uniqueItems: true, items: { type: 'string' }, description: 'tools/call requires at least one approved name. Names must come from the validated upstream inventory.' },
                },
              },
            },
          },
        },
        responses: {
          '201': {
            description: 'Server registered successfully.',
            content: {
              'application/json': {
                schema: { type: 'object' }
              }
            }
          },
          '400': errorResponse('Missing required fields or invalid authType.'),
          '401': errorResponse('Missing or invalid API key.'),
          '500': errorResponse('Internal failure registering MCP upstream server.'),
        },
      },
    },
    '/api/v1/mcp/servers': {
      get: {
        tags: ['Enterprise MCP Gateway'],
        summary: 'List Registered MCP Servers',
        description: 'Lists the authenticated API key’s registered MCP upstreams. Credentials and encrypted credential material are never returned.',
        security: [{ credential: [] }],
        responses: {
          '200': {
            description: 'Credential-safe MCP server summaries.',
            content: {
              'application/json': {
                schema: {
                  type: 'object', required: ['servers'], properties: {
                    servers: {
                      type: 'array', items: {
                        type: 'object', required: ['serverId', 'name', 'baseUrl', 'createdAt', 'status', 'policy', 'discovery'],
                        properties: {
                          serverId: { type: 'string' }, name: { type: 'string' }, baseUrl: { type: 'string', format: 'uri' },
                          createdAt: { type: 'integer' }, status: { type: 'string', enum: ['active', 'suspended'] },
                          policy: { type: 'object', required: ['allowedMethods', 'allowedToolNames', 'mode'], properties: { allowedMethods: { type: 'array', items: { type: 'string' } }, allowedToolNames: { type: 'array', items: { type: 'string' } }, mode: { type: 'string', enum: ['explicit', 'legacy_discovered'] } } },
                          discovery: {
                            type: 'object', required: ['status', 'tools'], properties: {
                              status: { type: 'string', enum: ['pending', 'ready', 'error'] },
                              discoveredAt: { type: 'integer' }, error: { type: 'string' },
                              tools: { type: 'array', items: { type: 'object', required: ['name', 'inputSchema'], properties: { name: { type: 'string' }, description: { type: 'string' }, inputSchema: { type: 'object' } } } },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          '401': errorResponse('Missing or invalid API key.'),
          '503': errorResponse('MCP registry unavailable.'),
        },
      },
    },
    '/api/v1/mcp/servers/{serverId}/discover': {
      post: {
        tags: ['Enterprise MCP Gateway'],
        summary: 'Refresh MCP Tool Discovery',
        description: 'Calls tools/list on a tenant-owned upstream, validates the bounded JSON-RPC response, and persists credential-safe tool metadata.',
        security: [{ credential: [] }],
        parameters: [{ name: 'serverId', in: 'path', required: true, schema: { type: 'string', pattern: '^mcp_srv_[a-f0-9]{16}$' } }],
        responses: {
          '200': { description: 'Validated tool inventory persisted.', content: { 'application/json': { schema: { type: 'object', required: ['server'], properties: { server: { type: 'object' } } } } } },
          '400': errorResponse('Invalid MCP server ID.'),
          '401': errorResponse('Missing or invalid API key.'),
          '404': errorResponse('MCP server not registered to this tenant.'),
          '429': errorResponse('Tenant MCP request limit reached.'),
          '502': errorResponse('Upstream discovery failed or returned invalid data.'),
          '503': errorResponse('Upstream circuit breaker open.'),
        },
      },
    },
    '/api/v1/mcp/servers/{serverId}': {
      patch: {
        tags: ['Enterprise MCP Gateway'],
        summary: 'Set MCP Server Method and Tool Policy',
        description: 'Replaces the explicit policy for a tenant-owned upstream. Callable tool names must appear in the latest validated tools/list inventory.',
        security: [{ credential: [] }],
        parameters: [{ name: 'serverId', in: 'path', required: true, schema: { type: 'string', pattern: '^mcp_srv_[a-f0-9]{16}$' } }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['allowedMethods', 'allowedToolNames'], properties: { allowedMethods: { type: 'array', minItems: 1, uniqueItems: true, items: { type: 'string' } }, allowedToolNames: { type: 'array', maxItems: 256, uniqueItems: true, items: { type: 'string' } }, status: { type: 'string', enum: ['active', 'suspended'] } } } } } },
        responses: { '200': { description: 'Updated credential-safe server summary.', content: { 'application/json': { schema: { type: 'object' } } } }, '400': errorResponse('Invalid policy, status, or unknown tool.'), '401': errorResponse('Missing or invalid API key.'), '404': errorResponse('MCP server not registered to this tenant.'), '415': errorResponse('Content-Type must be application/json.'), '503': errorResponse('MCP registry unavailable.') },
      },
    },
    '/api/v1/mcp/settings': {
      get: {
        tags: ['Enterprise MCP Gateway'], summary: 'Get Tenant MCP SLA Controls', security: [{ credential: [] }],
        responses: { '200': { description: 'Current tenant MCP controls.', content: { 'application/json': { schema: { type: 'object' } } } }, '401': errorResponse('Missing or invalid API key.'), '503': errorResponse('MCP controls unavailable.') },
      },
      post: {
        tags: ['Enterprise MCP Gateway'], summary: 'Set Tenant MCP SLA Controls', security: [{ credential: [] }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['requestsPerMinute', 'timeoutMs', 'failureThreshold', 'cooldownMs'], properties: { requestsPerMinute: { type: 'integer', minimum: 1, maximum: 600 }, timeoutMs: { type: 'integer', minimum: 1000, maximum: 30000 }, failureThreshold: { type: 'integer', minimum: 1, maximum: 10 }, cooldownMs: { type: 'integer', minimum: 5000, maximum: 300000 } } } } } },
        responses: { '200': { description: 'Updated tenant MCP controls.', content: { 'application/json': { schema: { type: 'object' } } } }, '400': errorResponse('Invalid MCP SLA controls.'), '401': errorResponse('Missing or invalid API key.'), '415': errorResponse('Content-Type must be application/json.'), '503': errorResponse('MCP controls unavailable.') },
      },
    },
    '/api/v1/mcp/gateway/{serverId}': {
      post: {
        tags: ['Enterprise MCP Gateway'],
        summary: 'Proxy JSON-RPC call to Upstream MCP Server (v1)',
        description: 'Proxies, signs, and audits tool calls made by enterprise AI agents via the v1 App Router endpoint. The upstream server must belong to the authenticated API key.',
        security: [{ credential: [] }],
        parameters: [
          { name: 'serverId', in: 'path', required: true, schema: { type: 'string' } },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['jsonrpc', 'method'],
                properties: {
                  jsonrpc: { const: '2.0' },
                  id: { oneOf: [{ type: 'string' }, { type: 'number' }] },
                  method: { type: 'string' },
                  params: { type: 'object' },
                }
              }
            }
          }
        },
        responses: {
          '200': { 
            description: 'JSON-RPC 2.0 Response from upstream.',
            content: {
              'application/json': {
                schema: { type: 'object' }
              }
            }
          },
          '400': errorResponse('Invalid JSON-RPC 2.0 payload.'),
          '413': errorResponse('MCP request exceeds 64 KB.'),
          '401': errorResponse('Missing or invalid API key.'),
          '404': errorResponse('Target MCP Server not registered for this tenant.'),
          '403': errorResponse('MCP method or tool is not permitted by the server policy.'),
          '429': errorResponse('Tenant MCP request limit reached.'),
          '502': errorResponse('Upstream MCP server returned an error or invalid response.'),
          '503': errorResponse('Upstream circuit breaker open or server suspended.'),
          '504': errorResponse('Upstream MCP timeout.'),
          '500': errorResponse('Internal MCP Gateway Processing Failure.'),
        },
      },
    },
    '/api/x402-observatory': {
      get: {
        tags: ['x402 Conformance'],
        operationId: 'getX402ConformanceObservatory',
        summary: 'Read the latest public x402 protocol and discovery observations',
        description: 'Returns factual point-in-time checks from the open x402 conformance observatory. A pass is not a security, quality, uptime, reputation, or trust endorsement.',
        security: [],
        responses: {
          '200': {
            description: 'Latest observation for each explicitly allowlisted public resource.',
            content: { 'application/json': { schema: {
              type: 'object', required: ['schemaVersion', 'generatedAt', 'scope', 'resources'],
              properties: {
                schemaVersion: { type: 'string', const: '1.0.0' },
                generatedAt: { type: 'string', format: 'date-time' },
                scope: { type: 'string' },
                resources: { type: 'array', items: {
                  type: 'object', required: ['id', 'name', 'url', 'operator', 'boundedSettlementEnabled', 'latest'],
                  properties: {
                    id: { type: 'string' }, name: { type: 'string' }, url: { type: 'string', format: 'uri' }, operator: { type: 'string' },
                    boundedSettlementEnabled: { type: 'boolean' },
                    latest: { type: ['object', 'null'], description: 'Latest append-only observation. Check states are pass, fail, unknown, or not_applicable.' },
                    lastSuccessfulBoundedSettlementAt: { type: ['string', 'null'], format: 'date-time' },
                    lastSuccessfulBoundedSettlementTransaction: { type: ['string', 'null'] },
                  },
                } },
              },
            } } },
          },
        },
      },
    },
    '/api/agentic-commerce/offers': {
      get: {
        tags: ['Agentic Commerce'],
        operationId: 'getAgenticCommerceOffers',
        summary: 'Discover public MPS commercial terms',
        description: `Returns the read-only canonical offer catalog. It cannot create a checkout, disclose a credential, or authorize a payment. Canonical URL: ${AGENTIC_COMMERCE_API_URL}.`,
        responses: {
          '200': {
            description: 'Public agentic-commerce discovery document.',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['schema', 'version', 'provider', 'transactionPolicy', 'offers'],
                  properties: {
                    schema: { type: 'string', format: 'uri' },
                    version: { type: 'string' },
                    provider: { type: 'object' },
                    discovery: { type: 'object' },
                    transactionPolicy: { type: 'object' },
                    offers: { type: 'array', minItems: 1, items: { type: 'object' } },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/api/mcp-bridge/manifest': {
      get: {
        tags: ['Agentic Commerce'], operationId: 'getMcpBridgeCompatibility', summary: 'Discover local MCP bridge compatibility',
        description: 'Returns the versioned contract for the local commercial bridge and explicitly distinguishes it from the hosted Cognitive Gateway.',
        responses: { '200': { description: 'Public compatibility manifest.', content: { 'application/json': { schema: { type: 'object', required: ['bridge', 'compatibility', 'security'], properties: { bridge: { type: 'object' }, compatibility: { type: 'object' }, security: { type: 'object' }, distinctServices: { type: 'array' } } } } } } },
      },
    },
    '/api/context-packs': {
      post: {
        tags: ['Context Compiler'],
        operationId: 'compileContextPack',
        summary: 'Compile bounded, source-linked context for an agent task',
        description: 'Deduplicates and ranks supplied text deterministically against a stated task, returning a Context Pack with source references and model-neutral estimated-token metrics. The source text and compiled pack are not retained in the service ledger.',
        security: [{ credential: [] }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['clientRequestId', 'task', 'tokenBudget', 'documents'], properties: { clientRequestId: { type: 'string', minLength: 8, maxLength: 120 }, task: { type: 'string', minLength: 8, maxLength: 1200 }, tokenBudget: { type: 'integer', minimum: 64, maximum: 16000 }, documents: { type: 'array', minItems: 1, maxItems: 8, items: { type: 'object', required: ['id', 'text'], properties: { id: { type: 'string' }, title: { type: 'string' }, text: { type: 'string', maxLength: 64000 } } } } } } } } },
        responses: {
          '201': { description: 'Compiled Context Pack; source text and compiled context were returned transiently only.', content: { 'application/json': { schema: { type: 'object', required: ['packId', 'context', 'metrics', 'sources', 'warnings'], properties: { packId: { type: 'string' }, context: { type: 'string' }, metrics: { type: 'object' }, sources: { type: 'array' }, warnings: { type: 'array', items: { type: 'string' } }, sourceTextStored: { const: false }, compiledContextStored: { const: false } } } } } },
          '400': errorResponse('Invalid Context Pack request.'),
          '401': errorResponse('Missing or invalid Context Compiler credential.'),
          '403': errorResponse('Credential lacks the context_compile capability.'),
          '409': errorResponse('clientRequestId was already used with different inputs.'),
          '413': errorResponse('Request exceeds the 128 KB input limit.'),
        },
      },
    },
    '/api/context-pack-evaluations': {
      post: {
        tags: ['Context Compiler'],
        operationId: 'evaluateContextPack',
        summary: 'Measure Context Pack efficiency and declared evidence retention',
        description: 'Compiles a bounded Context Pack and checks whether each caller-declared exact evidence span from a supplied source document remains in the output. This is deterministic span retention, not factual verification or downstream answer-quality evaluation.',
        security: [{ credential: [] }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['clientRequestId', 'task', 'tokenBudget', 'documents', 'requiredEvidence'], properties: { clientRequestId: { type: 'string' }, task: { type: 'string' }, tokenBudget: { type: 'integer', minimum: 64, maximum: 16000 }, documents: { type: 'array', minItems: 1, maxItems: 8, items: { type: 'object' } }, requiredEvidence: { type: 'array', minItems: 1, maxItems: 32, items: { type: 'object', required: ['evidenceId', 'sourceId', 'text'], properties: { evidenceId: { type: 'string' }, sourceId: { type: 'string' }, text: { type: 'string' } } } } } } } } },
        responses: {
          '201': { description: 'Privacy-safe evaluation result, including retained or omitted status for each declared evidence span.', content: { 'application/json': { schema: { type: 'object', required: ['evaluationId', 'metrics', 'evidence', 'warnings'], properties: { evaluationId: { type: 'string' }, metrics: { type: 'object' }, evidence: { type: 'array' }, warnings: { type: 'array', items: { type: 'string' } }, requiredEvidenceTextStored: { const: false } } } } } },
          '400': errorResponse('Invalid source document or required evidence declaration.'),
          '401': errorResponse('Missing or invalid Context Compiler credential.'),
          '403': errorResponse('Credential lacks the context_compile capability.'),
          '409': errorResponse('clientRequestId was already used with different inputs.'),
          '413': errorResponse('Request exceeds the 128 KB input limit.'),
        },
      },
    },
    '/api/books/{id}/entitlement': {
      get: {
        tags: ['Books'],
        operationId: 'getBookEntitlement',
        summary: 'Check whether a credential owns a book',
        description: 'Used by the `maha book mount` CLI to verify purchase authorization before serving a book over MCP. Returns the title if the authenticated credential holds an active entitlement for the book.',
        security: [{ credential: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            description: 'Lowercase book slug.',
            schema: { type: 'string', pattern: '^[a-z0-9][a-z0-9-]{1,63}$' },
          },
        ],
        responses: {
          '200': {
            description: 'The credential owns this book.',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['title'],
                  properties: { title: { type: 'string', description: 'Book title.' } },
                },
              },
            },
          },
          '401': errorResponse('Missing or invalid credential.'),
          '403': errorResponse('Credential is valid but holds no entitlement for this book.'),
          '404': errorResponse('No such book.'),
          '503': errorResponse('The entitlement registry is unavailable.'),
        },
      },
    },
    '/api/books/{id}/content': {
      get: {
        tags: ['Books'],
        operationId: 'getBookContent',
        summary: 'Fetch the structured book payload (paid)',
        description: 'Returns the book as an ordered array of heading-addressable chunks for the `maha book mount` MCP tool. The same text is free to read on the public web page; only this machine-readable form is gated behind an entitlement.',
        security: [{ credential: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, description: 'Lowercase book slug.', schema: { type: 'string', pattern: '^[a-z0-9][a-z0-9-]{1,63}$' } },
        ],
        responses: {
          '200': {
            description: 'Structured book content.',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['book', 'title', 'chunkCount', 'chunks'],
                  properties: {
                    book: { type: 'string' },
                    title: { type: 'string' },
                    chunkCount: { type: 'integer' },
                    chunks: {
                      type: 'array',
                      items: {
                        type: 'object',
                        required: ['index', 'depth', 'heading', 'anchor', 'wordCount', 'content'],
                        properties: {
                          index: { type: 'integer' },
                          depth: { type: 'integer', enum: [1, 2] },
                          heading: { type: 'string' },
                          anchor: { type: 'string' },
                          wordCount: { type: 'integer' },
                          content: { type: 'string' },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          '401': errorResponse('Missing or invalid credential.'),
          '403': errorResponse('Credential holds no entitlement for this book.'),
          '404': errorResponse('No such book, or no structured content available yet.'),
          '503': errorResponse('The entitlement registry is unavailable.'),
        },
      },
    },
    '/api/books/checkout': {
      post: {
        tags: ['Books'],
        operationId: 'createBookCheckout',
        summary: 'Start a book purchase',
        description: 'Creates a Stripe Checkout session for a book on the authenticated credential’s account. The entitlement is minted only after Stripe confirms payment via signed webhook.',
        security: [{ credential: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['bookId', 'clientRequestId'],
                properties: {
                  bookId: { type: 'string', pattern: '^[a-z0-9][a-z0-9-]{1,63}$', description: 'Book slug from the catalog.' },
                  clientRequestId: { type: 'string', minLength: 8, maxLength: 120, description: 'Caller-chosen request key, one line.' },
                },
              },
            },
          },
        },
        responses: {
          '201': {
            description: 'Checkout prepared. Redirect the buyer to `checkoutUrl`.',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['checkoutId', 'checkoutUrl', 'bookId', 'title'],
                  properties: {
                    checkoutId: { type: 'string', pattern: '^book_checkout_[a-f0-9]{32}$' },
                    checkoutUrl: { type: 'string', format: 'uri', description: 'Stripe-hosted payment page.' },
                    bookId: { type: 'string' },
                    title: { type: 'string' },
                  },
                },
              },
            },
          },
          '200': {
            description: 'Idempotent replay. Returns the original open Stripe Checkout URL, or the settled checkout state when payment already completed.',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['checkoutId', 'bookId', 'title', 'checkoutStatus', 'idempotentReplay'],
                  properties: {
                    checkoutId: { type: 'string', pattern: '^book_checkout_[a-f0-9]{32}$' },
                    checkoutUrl: { type: 'string', format: 'uri', description: 'Present only while checkout is awaiting payment.' },
                    bookId: { type: 'string' }, title: { type: 'string' },
                    checkoutStatus: { type: 'string', enum: ['awaiting_payment', 'paid'] },
                    idempotentReplay: { type: 'boolean', const: true },
                  },
                },
              },
            },
          },
          '400': errorResponse('Invalid bookId or clientRequestId.'),
          '401': errorResponse('Missing or invalid credential.'),
          '404': errorResponse('No such book is available for purchase.'),
          '409': errorResponse('clientRequestId conflicts with a different book, or the original checkout failed.'),
          '415': errorResponse('Content-Type must be application/json.'),
          '429': errorResponse('Hourly credential rate limit reached.'),
          '502': errorResponse('Stripe checkout could not be started.'),
          '503': errorResponse('Book purchases are not enabled or a backing service is unavailable.'),
        },
      },
    },
    '/api/books/public-checkout': {
      post: {
        tags: ['Books'], operationId: 'createPublicBookCheckout', summary: 'Start a book MCP-access purchase without a prior credential',
        description: 'Creates a dormant, book-only credential and Stripe Checkout session. The credential is shown once and activates with the paid entitlement after signed webhook confirmation.',
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['bookId', 'email', 'clientRequestId'], properties: { bookId: { type: 'string' }, email: { type: 'string', format: 'email' }, clientRequestId: { type: 'string', minLength: 8, maxLength: 120 } } } } } },
        responses: { '201': { description: 'Checkout prepared; save the one-time credential before redirecting.', content: { 'application/json': { schema: { type: 'object', required: ['checkoutId', 'checkoutUrl', 'credential', 'expiresAt'], properties: { checkoutId: { type: 'string' }, checkoutUrl: { type: 'string', format: 'uri' }, credential: { type: 'string' }, expiresAt: { type: 'string', format: 'date-time' } } } } } }, '400': errorResponse('Invalid request.'), '415': errorResponse('Content-Type must be application/json.'), '502': errorResponse('Stripe checkout could not be started.'), '503': errorResponse('Book checkout is not enabled.') },
      },
    },
    '/api/books/webhook': {
      post: {
        tags: ['Books'],
        operationId: 'stripeBooksWebhook',
        summary: 'Stripe book-payment webhook (Stripe calls this — you never do)',
        description: 'Verifies the `Stripe-Signature` header and mints book entitlements exactly once per Stripe event id. Confirmed refunds are deduplicated by refund id and revoke access only after the cumulative reversal reaches the original payment; a dispute revokes access only after Stripe closes it as lost.',
        parameters: [
          { name: 'Stripe-Signature', in: 'header', required: true, schema: { type: 'string' }, description: 'Stripe webhook signature (`t=…,v1=…`).' },
        ],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', description: 'Raw Stripe event payload.' } } },
        },
        responses: {
          '200': {
            description: 'Event handled. Redeliveries return `duplicate: true` and change nothing.',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['received'],
                  properties: {
                    received: { type: 'boolean', const: true },
                    duplicate: { type: 'boolean' },
                  },
                },
              },
            },
          },
          '400': { description: 'Invalid signature or malformed event.', content: { 'application/json': { schema: { type: 'object', properties: { error: { type: 'string' } } } } } },
          '503': { description: 'Ledger unavailable; Stripe will retry.', content: { 'application/json': { schema: { type: 'object', properties: { error: { type: 'string' } } } } } },
        },
      },
    },
    '/api/mps-audits': {
      post: {
        tags: ['MPS Audit'],
        operationId: 'runMpsAudit',
        summary: 'Run a claim-level provenance audit',
        description: 'Audits a passage and returns tagged claims. Idempotent per `clientRequestId`: an exact retry replays the stored result without consuming another credit.',
        security: [{ credential: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['clientRequestId', 'text'],
                properties: {
                  clientRequestId: { type: 'string', minLength: 8, maxLength: 120, description: 'Caller-chosen idempotency key, one line.' },
                  text: { type: 'string', maxLength: MAX_AUDIT_CHARS, description: `Passage to audit (max ${MAX_AUDIT_CHARS} characters). Never stored; only its hash is retained.` },
                },
              },
            },
          },
        },
        responses: {
          '201': {
            description: 'Audit completed.',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/AuditJob' } } },
          },
          '200': {
            description: 'Idempotent replay of a completed or failed audit (`idempotentReplay: true`).',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/AuditJob' } } },
          },
          '202': {
            description: 'Idempotent replay while the original request is still processing. Retry after `retryAfterSeconds`.',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/AuditJob' } } },
          },
          '400': errorResponse('Invalid request body.'),
          '401': errorResponse('Missing or invalid credential.'),
          '402': {
            description: 'No audit credits remaining on this prepaid credential.',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/ErrorEnvelope' },
                    {
                      type: 'object',
                      properties: {
                        purchase: {
                          type: 'object',
                          properties: {
                            href: { type: 'string' },
                            checkoutEndpoint: { type: 'string' },
                            unit: { type: 'string', const: MPS_AUDIT_CREDIT_UNIT },
                          },
                        },
                      },
                    },
                  ],
                },
              },
            },
          },
          '403': errorResponse('Credential lacks the MPS audit capability.'),
          '409': errorResponse('`clientRequestId` was already used with different source text.'),
          '413': errorResponse('Request body exceeds the 32 KB limit.'),
          '415': errorResponse('Content-Type must be application/json.'),
          '429': errorResponse('Hourly credential rate limit reached.'),
          '502': errorResponse('The audit model did not complete; the credit was refunded. Retry with a new `clientRequestId`.'),
          '503': errorResponse('A backing service is unavailable.'),
        },
      },
    },
    '/api/mps-credits': {
      get: {
        tags: ['Checkout'],
        operationId: 'getCreditBalance',
        summary: 'Check the credit balance for a credential',
        description: 'Returns the live ledger balance and recent checkouts for the authenticated credential. Poll this to decide when to buy another pack before hitting `402`.',
        security: [{ credential: [] }],
        responses: {
          '200': {
            description: 'Current balance and recent checkout history.',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['clientId', 'unit', 'balance', 'billingEnforcement', 'checkouts'],
                  properties: {
                    clientId: { type: 'string', pattern: '^client_[a-f0-9]{32}$' },
                    unit: { type: 'string', const: MPS_AUDIT_CREDIT_UNIT },
                    balance: { type: 'number', description: 'Sum of all ledger entries for this client.' },
                    billingEnforcement: { type: 'string', enum: ['prepaid', 'internal_meter'] },
                    checkouts: {
                      type: 'array',
                      maxItems: 20,
                      items: {
                        type: 'object',
                        properties: {
                          public_id: { type: 'string', pattern: '^credit_checkout_[a-f0-9]{32}$' },
                          credit_quantity: { type: 'integer' },
                          status: { type: 'string', enum: ['awaiting_payment', 'paid', 'failed'] },
                          created_at: { type: 'string', format: 'date-time' },
                          paid_at: { type: ['string', 'null'], format: 'date-time' },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          '401': errorResponse('Missing or invalid credential.'),
          '403': errorResponse('Credential lacks the MPS audit capability.'),
          '429': errorResponse('Hourly credential rate limit reached.'),
          '503': errorResponse('Credential registry or ledger unavailable.'),
        },
      },
    },
    '/api/mps-credits/checkout': {
      post: {
        tags: ['Checkout'],
        operationId: 'createCreditCheckout',
        summary: 'Start a prepaid credit-pack purchase',
        description: 'Creates a dormant MPS-only credential and a Stripe Checkout session. The credential secret is returned once, here, and activates only after Stripe confirms payment via signed webhook.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'clientRequestId'],
                properties: {
                  email: { type: 'string', format: 'email', maxLength: 254, description: 'Receipt email.' },
                  clientRequestId: { type: 'string', minLength: 8, maxLength: 120, description: 'Caller-chosen request key, one line.' },
                },
              },
            },
          },
        },
        responses: {
          '201': {
            description: 'Checkout prepared. Redirect the buyer to `checkoutUrl` and store `credential` now — it is never shown again.',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['checkoutId', 'checkoutUrl', 'credential', 'creditQuantity', 'unit', 'expiresAt'],
                  properties: {
                    checkoutId: { type: 'string', pattern: '^credit_checkout_[a-f0-9]{32}$' },
                    checkoutUrl: { type: 'string', format: 'uri', description: 'Stripe-hosted payment page.' },
                    credential: { type: 'string', description: 'One-time plaintext API credential (dormant until payment).' },
                    credentialPrefix: { type: 'string', pattern: '^mhaic_[A-Za-z0-9_-]{8}$' },
                    creditQuantity: { type: 'integer', minimum: 1 },
                    unit: { type: 'string', const: MPS_AUDIT_CREDIT_UNIT },
                    expiresAt: { type: 'string', format: 'date-time' },
                    secretDisclosure: { type: 'string' },
                  },
                },
              },
            },
          },
          '400': errorResponse('Invalid email or clientRequestId.'),
          '415': errorResponse('Content-Type must be application/json.'),
          '502': errorResponse('Stripe checkout could not be started.'),
          '503': errorResponse('Checkout is not enabled or a backing service is unavailable.'),
        },
      },
    },
    '/api/mps-credits/webhook': {
      post: {
        tags: ['Webhooks'],
        operationId: 'stripeCreditsWebhook',
        summary: 'Stripe payment webhook (Stripe calls this — you never do)',
        description: 'Verifies the `Stripe-Signature` header (HMAC-SHA256, ±5-minute replay window) and processes checkout completions and refunds exactly once per Stripe event id.',
        parameters: [
          { name: 'Stripe-Signature', in: 'header', required: true, schema: { type: 'string' }, description: 'Stripe webhook signature (`t=…,v1=…`).' },
        ],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', description: 'Raw Stripe event payload.' } } },
        },
        responses: {
          '200': {
            description: 'Event handled. Redeliveries of an already-processed event return `duplicate: true` and change nothing.',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['received'],
                  properties: {
                    received: { type: 'boolean', const: true },
                    duplicate: { type: 'boolean' },
                  },
                },
              },
            },
          },
          '400': { description: 'Invalid signature or malformed event.', content: { 'application/json': { schema: { type: 'object', properties: { error: { type: 'string' } } } } } },
          '503': { description: 'Ledger unavailable; Stripe will retry.', content: { 'application/json': { schema: { type: 'object', properties: { error: { type: 'string' } } } } } },
        },
      },
    },
    '/api/audit': {
      post: {
        tags: ['Free Preflight'],
        operationId: 'runFreePreflight',
        summary: 'Run a free, rate-limited audit preflight',
        description: `No credential required. Limited per visitor per day; passages up to ${MAX_AUDIT_CHARS} characters.`,
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['text'],
                properties: {
                  text: { type: 'string', maxLength: MAX_AUDIT_CHARS, description: 'Passage to audit.' },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Audit result.',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/AuditResult' } } },
          },
          '400': { $ref: '#/components/responses/FlatError' },
          '413': { $ref: '#/components/responses/FlatError' },
          '415': { $ref: '#/components/responses/FlatError' },
          '429': { $ref: '#/components/responses/FlatError' },
          '502': { $ref: '#/components/responses/FlatError' },
          '503': { $ref: '#/components/responses/FlatError' },
        },
      },
    },
  },
  components: {
    securitySchemes: {
      credential: {
        type: 'http',
        scheme: 'bearer',
        description: 'MPS client credential (`mhaic_…`), issued once at purchase.',
      },
    },
    responses: {
      FlatError: {
        description: 'Error (free preflight uses a flat error string).',
        content: { 'application/json': { schema: { type: 'object', required: ['error'], properties: { error: { type: 'string' } } } } },
      },
    },
    schemas: {
      ErrorEnvelope: ERROR_ENVELOPE,
      AuditClaim: {
        type: 'object',
        required: ['excerpt', 'tag', 'rationale', 'action'],
        properties: {
          excerpt: { type: 'string', description: 'Verbatim excerpt from the passage (6–25 words).' },
          tag: { type: 'string', enum: [...MPS_TAGS] },
          rationale: { type: 'string', maxLength: 1000 },
          action: { type: 'string', enum: [...MPS_ACTIONS] },
        },
      },
      AuditResult: {
        type: 'object',
        required: ['mps_version', 'input_hash', 'claims'],
        properties: {
          mps_version: { type: 'string', const: MPS_VERSION },
          input_hash: { type: 'string', description: 'SHA-256 of the audited passage.' },
          claims: { type: 'array', items: { $ref: '#/components/schemas/AuditClaim' } },
        },
      },
      AuditJob: {
        type: 'object',
        required: ['auditId', 'clientRequestId', 'inputHash', 'status', 'idempotentReplay', 'capability', 'sourceTextStored'],
        properties: {
          auditId: { type: 'string', pattern: '^audit_[a-f0-9]{32}$' },
          clientRequestId: { type: 'string' },
          inputHash: { type: 'string' },
          status: { type: 'string', enum: ['processing', 'completed', 'failed'] },
          idempotentReplay: { type: 'boolean' },
          capability: { type: 'string', const: 'mps_audit' },
          sourceTextStored: { type: 'boolean', const: false, description: 'Source text is never retained; only its hash.' },
          audit: { $ref: '#/components/schemas/AuditResult' },
          retryAfterSeconds: { type: 'integer', description: 'Present while status is `processing`.' },
          error: { type: 'object', properties: { code: { type: 'string' }, message: { type: 'string' } }, description: 'Present when status is `failed`.' },
        },
      },
      QuboTerm: {
        type: 'object', required: ['i', 'j', 'value'], additionalProperties: false,
        properties: { i: { type: 'integer', minimum: 0, maximum: 255 }, j: { type: 'integer', minimum: 0, maximum: 255 }, value: { type: 'number' } },
      },
      TensorNetworkJobRequest: {
        type: 'object', required: ['clientRequestId', 'problem'], additionalProperties: false,
        properties: {
          clientRequestId: { type: 'string', minLength: 8, maxLength: 120 },
          problem: { type: 'object', required: ['formulation', 'size', 'terms'], additionalProperties: false, properties: { formulation: { type: 'string', enum: ['qubo', 'ising'] }, size: { type: 'integer', minimum: 1, maximum: 256 }, terms: { type: 'array', minItems: 1, maxItems: 32896, items: { $ref: '#/components/schemas/QuboTerm' } } } },
          solver: { type: 'object', additionalProperties: false, properties: { bondDimension: { type: 'integer', minimum: 2, maximum: 4096, default: 256 }, exactThreshold: { type: 'integer', minimum: 0, maximum: 18, default: 18 } } },
          target: { type: 'string', const: 'gpu', default: 'gpu' }, timeoutSeconds: { type: 'integer', minimum: 1, maximum: 600, default: 120 },
        },
      },
      TensorNetworkJob: {
        type: 'object', required: ['jobId', 'kind', 'status', 'clientRequestId', 'inputHash', 'acceptedConfiguration', 'credits', 'result', 'methodBoundary'],
        properties: { jobId: { type: 'string', pattern: '^job_[a-f0-9]{32}$' }, kind: { type: 'string', const: 'tensor-network' }, status: { type: 'string', enum: ['queued', 'processing', 'completed', 'failed', 'cancelled'] }, clientRequestId: { type: 'string' }, inputHash: { type: 'string', pattern: '^[a-f0-9]{64}$' }, acceptedConfiguration: { type: 'object' }, credits: { type: 'object' }, result: { type: ['object', 'null'] }, diagnostics: { type: ['object', 'null'] }, error: { type: ['object', 'null'] }, pollUrl: { type: 'string' }, quotedCredits: { type: 'integer' }, problemStored: { type: 'boolean', const: false }, methodBoundary: { type: 'string' } },
      },
      PointVector: { type: 'array', minItems: 3, maxItems: 3, items: { type: 'number' } },
      GeometricRegistrationJobRequest: {
        type: 'object', required: ['clientRequestId', 'problem'], additionalProperties: false,
        properties: {
          clientRequestId: { type: 'string', minLength: 8, maxLength: 120 },
          problem: { type: 'object', required: ['sourcePoints', 'targetPoints'], additionalProperties: false, properties: { sourcePoints: { type: 'array', minItems: 3, maxItems: 16384, items: { $ref: '#/components/schemas/PointVector' } }, targetPoints: { type: 'array', minItems: 3, maxItems: 16384, items: { $ref: '#/components/schemas/PointVector' } }, weights: { type: 'array', minItems: 3, maxItems: 16384, items: { type: 'number', exclusiveMinimum: 0 } } } },
          solver: { type: 'object', additionalProperties: false, properties: { allowReflection: { type: 'boolean', const: false, default: false } } },
          target: { type: 'string', const: 'gpu', default: 'gpu' }, timeoutSeconds: { type: 'integer', minimum: 1, maximum: 600, default: 120 },
        },
      },
      GeometricRegistrationJob: {
        type: 'object', required: ['jobId', 'kind', 'status', 'clientRequestId', 'inputHash', 'acceptedConfiguration', 'credits', 'result', 'methodBoundary'],
        properties: { jobId: { type: 'string', pattern: '^job_[a-f0-9]{32}$' }, kind: { type: 'string', const: 'geometric-registration' }, status: { type: 'string', enum: ['queued', 'processing', 'completed', 'failed', 'cancelled'] }, clientRequestId: { type: 'string' }, inputHash: { type: 'string', pattern: '^[a-f0-9]{64}$' }, acceptedConfiguration: { type: 'object' }, credits: { type: 'object' }, result: { type: ['object', 'null'], description: 'Rotation matrix, translation vector, RMSE, maximum error, and determinant.' }, diagnostics: { type: ['object', 'null'] }, error: { type: ['object', 'null'] }, pollUrl: { type: 'string' }, quotedCredits: { type: 'integer' }, problemStored: { type: 'boolean', const: false }, methodBoundary: { type: 'string' } },
      },
    },
  },
} as const
