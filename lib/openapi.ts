import { MAX_AUDIT_CHARS, MPS_ACTIONS, MPS_TAGS, MPS_VERSION } from './mps-audit-engine.ts'
import { MPS_AUDIT_CREDIT_UNIT } from './mps-credits.ts'
import { AGENTIC_COMMERCE_API_URL } from './agentic-commerce.ts'

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
  ],
  paths: {
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
          '400': errorResponse('Invalid bookId or clientRequestId.'),
          '401': errorResponse('Missing or invalid credential.'),
          '404': errorResponse('No such book is available for purchase.'),
          '409': errorResponse('clientRequestId was already used for a book checkout.'),
          '415': errorResponse('Content-Type must be application/json.'),
          '429': errorResponse('Hourly credential rate limit reached.'),
          '502': errorResponse('Stripe checkout could not be started.'),
          '503': errorResponse('Book purchases are not enabled or a backing service is unavailable.'),
        },
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
