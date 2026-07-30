import { MAX_AUDIT_CHARS, MPS_ACTIONS, MPS_TAGS, MPS_VERSION } from './mps-audit-engine.ts'
import { MPS_AUDIT_CREDIT_UNIT } from './mps-credits.ts'
import { AGENTIC_COMMERCE_API_URL } from './agentic-commerce.ts'
import { geometricAiOpenApiPath } from './openapi-geometric.ts'
import { holographicQecOpenApiPath } from './openapi-holographic-qec.ts'
import { landscapeOpenApiPath } from './openapi-landscape.ts'

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
    { name: 'MPS Audit', description: 'Prepaid claim-level provenance audits.' },
    { name: 'Checkout', description: 'Self-service credit purchase.' },
    { name: 'Webhooks', description: 'Stripe payment confirmation (called by Stripe, documented for transparency).' },
    { name: 'Free Preflight', description: 'Rate-limited public demo, no credential required.' },
    { name: 'Books', description: 'Purchased-book entitlement checks for the local MCP bridge.' },
    { name: 'Enterprise MCP Gateway', description: 'Tenant-scoped MCP proxy for operator-registered public upstream servers.' },
    { name: 'Context Compiler', description: 'Deterministic, source-linked context-pack compilation with privacy-safe measurement.' },
    { name: 'Maha Tensor-Opt (Mock)', description: 'Integration-only mock contract for the planned tensor-network optimization service.' },
    { name: 'Maha Geometric AI (Mock)', description: 'Integration-only mock contract for symmetry-aware geometric AI workloads.' },
    { name: 'Maha QEC-Compiler (Mock)', description: 'Integration-only mock contract for holographic QEC layout compilation.' },
    { name: 'Maha Landscape-Opt (Mock)', description: 'Integration-only mock contract for high-dimensional landscape optimization.' },
    { name: 'Self-service API Keys', description: 'Instant starter-key provisioning and prepaid credit checkout.' },
    { name: 'Maha SDK', description: 'Small, credentialed context compression and provenance lookup endpoints for the public TypeScript SDK.' },
  ],
  paths: {
    ...geometricAiOpenApiPath,
    ...holographicQecOpenApiPath,
    ...landscapeOpenApiPath,
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
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['pack'], properties: { pack: { type: 'string', enum: ['starter', 'builder', 'scale'] } } } } } },
        responses: { '200': { description: 'Hosted checkout URL.', content: { 'application/json': { schema: { type: 'object', required: ['checkoutUrl', 'pack', 'credits'], properties: { checkoutUrl: { type: 'string', format: 'uri' }, pack: { type: 'string' }, credits: { type: 'integer' } } } } } }, '401': errorResponse('Invalid API key.'), '503': errorResponse('Checkout unavailable.') },
      },
    },
    '/api/v1/keys/balance': {
      get: {
        tags: ['Self-service API Keys'], operationId: 'getApiKeyBalance', summary: 'Get the balance for the current API key', security: [{ credential: [] }],
        responses: { '200': { description: 'Current prepaid API-key balance.', content: { 'application/json': { schema: { type: 'object', required: ['balance_credits', 'tier'], properties: { balance_credits: { type: 'integer', minimum: 0 }, tier: { type: 'string', enum: ['starter', 'builder', 'scale'] } } } } } }, '401': errorResponse('Missing or invalid API key.'), '503': errorResponse('API-key service unavailable.') },
      },
    },
    '/api/v1/compress': {
      post: {
        tags: ['Maha SDK'], operationId: 'compressContext', summary: 'Compile a bounded context pack through the lightweight SDK contract',
        description: 'Credentialed version of deterministic context compilation. It does not retain source text or make factual-verification claims.', security: [{ credential: [] }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['clientRequestId', 'task', 'tokenBudget', 'documents'], properties: { clientRequestId: { type: 'string', minLength: 8, maxLength: 120 }, task: { type: 'string', minLength: 8, maxLength: 1200 }, tokenBudget: { type: 'integer', minimum: 64, maximum: 16000 }, documents: { type: 'array', minItems: 1, maxItems: 8, items: { type: 'object', required: ['id', 'text'], properties: { id: { type: 'string' }, title: { type: 'string' }, text: { type: 'string', maxLength: 64000 } } } } } } } } },
        responses: { '201': { description: 'Transient compiled context pack.', content: { 'application/json': { schema: { type: 'object', required: ['packId', 'context', 'metrics', 'sources', 'warnings'], properties: { packId: { type: 'string' }, context: { type: 'string' }, metrics: { type: 'object' }, sources: { type: 'array', items: { type: 'object' } }, warnings: { type: 'array', items: { type: 'string' } }, sourceTextStored: { const: false }, compiledContextStored: { const: false } } } } } }, '400': errorResponse('Invalid compression request.'), '401': errorResponse('Missing or invalid API key.'), '402': errorResponse('API-key credits depleted.'), '413': errorResponse('Context input exceeds 128 KB.'), '415': errorResponse('Content-Type must be application/json.') },
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
    '/api/v1/tensor-opt': {
      post: {
        tags: ['Maha Tensor-Opt (Mock)'],
        operationId: 'createMockTensorOptJob',
        summary: 'Validate a Tensor-Opt integration request and return a mock job',
        description: 'Integration stub only. The endpoint does not accept matrix terms, queue compute, store source input, or make a performance claim. It returns a deterministic mock job envelope for frontend and SDK work.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object', required: ['clientRequestId', 'problem'], properties: {
                  clientRequestId: { type: 'string', minLength: 8, maxLength: 120 },
                  problem: {
                    type: 'object', required: ['formulation'], properties: {
                      formulation: { type: 'string', enum: ['qubo', 'ising'] },
                      variableCount: { type: 'integer', minimum: 1, maximum: 1000000, description: 'Required for QUBO.' },
                      spinCount: { type: 'integer', minimum: 1, maximum: 1000000, description: 'Required for Ising.' },
                    },
                  },
                  solver: { type: 'object', properties: { bondDimensionMax: { type: 'number' }, maxSweeps: { type: 'number' }, seed: { type: 'number' } } },
                  target: { type: 'object', properties: { kind: { type: 'string', enum: ['gpu', 'tpu'] } } },
                },
              },
            },
          },
        },
        responses: {
          '202': {
            description: 'Mock job accepted; no optimization has run.',
            headers: { 'X-Maha-API-Mode': { schema: { const: 'mock' }, description: 'Signals that this response is a contract stub.' } },
            content: { 'application/json': { schema: { type: 'object', required: ['mock', 'jobId', 'status', 'clientRequestId', 'inputHash', 'citations', 'sourceTextStored'], properties: { mock: { const: true }, jobId: { type: 'string', pattern: '^topt_[a-f0-9]{32}$' }, status: { const: 'queued' }, clientRequestId: { type: 'string' }, inputHash: { type: 'string', pattern: '^[a-f0-9]{64}$' }, citations: { type: 'array', minItems: 1, items: { type: 'object' } }, sourceTextStored: { const: false } } } } },
          },
          '400': errorResponse('Invalid mock Tensor-Opt request.'),
          '415': errorResponse('Content-Type must be application/json.'),
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
    '/api/mcp-gateway/{serverId}': {
      post: {
        tags: ['Enterprise MCP Gateway'],
        operationId: 'proxyTenantMcpMessage',
        summary: 'Send an allowlisted MCP message through a tenant gateway',
        description: 'Forwards a JSON-RPC MCP message only when the caller credential and registered server belong to the same tenant, the method is allowed, and tools/call names are allowlisted. An operator can additionally require selected tools to receive an exact Context Pack registered to the same tenant: the call supplies contextPackId, contextPackHash and context, and the gateway verifies the content hash before forwarding. The first release supports public HTTPS JSON upstreams only; it does not forward bearer tokens, store upstream credentials, or stream SSE.',
        security: [{ credential: [] }],
        parameters: [
          { name: 'serverId', in: 'path', required: true, schema: { type: 'string', pattern: '^mcp_srv_[a-f0-9]{32}$' } },
          { name: 'Mcp-Method', in: 'header', required: true, description: 'Must match JSON-RPC method exactly.', schema: { type: 'string' } },
          { name: 'Mcp-Name', in: 'header', required: false, description: 'Required for tools/call, resources/read, and prompts/get; must match the requested name or URI.', schema: { type: 'string' } },
        ],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['jsonrpc', 'method'], properties: { jsonrpc: { const: '2.0' }, id: { oneOf: [{ type: 'string' }, { type: 'number' }, { type: 'null' }] }, method: { type: 'string' }, params: { type: 'object' } } } } } },
        responses: {
          '200': { description: 'JSON response from the allowlisted upstream MCP server.', content: { 'application/json': { schema: { type: 'object' } } } },
          '400': errorResponse('Invalid JSON-RPC message or MCP headers.'),
          '401': errorResponse('Missing or invalid tenant credential.'),
          '403': errorResponse('Tenant boundary, method, tool, origin, or Context Pack admission policy denied the request.'),
          '413': errorResponse('Request exceeds 64 KB.'),
          '502': errorResponse('Registered upstream was unavailable or returned a response over 1 MB.'),
        },
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
    },
  },
} as const
