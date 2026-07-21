import { MAX_AUDIT_CHARS, MPS_ACTIONS, MPS_TAGS, MPS_VERSION } from './mps-audit-engine.ts'

const SITE_URL = 'https://www.mahastrategies.com'

// A deliberately narrow OpenAPI document for Base44 workspace integrations.
// It exposes one application-runtime operation only: a prepaid MPS audit.
// Checkout, credential issuance, books, and internal operations are excluded.
export const base44OpenApiDocument = {
  openapi: '3.1.0',
  info: {
    title: 'Maha MPS Audit for Base44',
    version: MPS_VERSION,
    description: 'Use this integration to verify claim-level provenance before your Base44 app presents or publishes AI-generated content. A human must purchase and configure a credential; this API cannot authorize payment.',
  },
  servers: [{ url: SITE_URL }],
  paths: {
    '/api/mps-audits': {
      post: {
        operationId: 'runMpsClaimAudit',
        summary: 'Verify claims before presenting content',
        description: 'Runs a claim-level provenance audit. Keep the same clientRequestId when retrying the same text. A successful audit consumes one prepaid credit; a failed audit refunds its credit automatically.',
        security: [{ bearerCredential: [] }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', required: ['clientRequestId', 'text'], properties: { clientRequestId: { type: 'string', minLength: 8, maxLength: 120 }, text: { type: 'string', maxLength: MAX_AUDIT_CHARS } } } } },
        },
        responses: {
          '201': { description: 'Audit completed.', content: { 'application/json': { schema: { $ref: '#/components/schemas/AuditJob' } } } },
          '200': { description: 'Idempotent replay.', content: { 'application/json': { schema: { $ref: '#/components/schemas/AuditJob' } } } },
          '202': { description: 'The original audit is still processing. Retry using the same clientRequestId.', content: { 'application/json': { schema: { $ref: '#/components/schemas/AuditJob' } } } },
          '400': { $ref: '#/components/responses/Error' }, '401': { $ref: '#/components/responses/Error' }, '403': { $ref: '#/components/responses/Error' },
          '402': { description: 'No prepaid audit credits remain. Direct the human operator to the Maha purchase page.', content: { 'application/json': { schema: { $ref: '#/components/schemas/PaymentRequired' } } } },
          '409': { $ref: '#/components/responses/Error' }, '413': { $ref: '#/components/responses/Error' }, '415': { $ref: '#/components/responses/Error' }, '429': { $ref: '#/components/responses/Error' }, '502': { $ref: '#/components/responses/Error' }, '503': { $ref: '#/components/responses/Error' },
        },
      },
    },
  },
  components: {
    securitySchemes: { bearerCredential: { type: 'http', scheme: 'bearer', description: 'Buyer-held MPS audit credential. Configure it only as a Base44 workspace secret.' } },
    responses: { Error: { description: 'Request failed.', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorEnvelope' } } } } },
    schemas: {
      ErrorEnvelope: { type: 'object', required: ['error'], properties: { error: { type: 'object', required: ['code', 'message'], properties: { code: { type: 'string' }, message: { type: 'string' } } } } },
      PaymentRequired: { allOf: [{ $ref: '#/components/schemas/ErrorEnvelope' }, { type: 'object', properties: { purchase: { type: 'object', properties: { href: { type: 'string' }, unit: { type: 'string', const: 'mps_audit_invocation' } } } } }] },
      AuditClaim: { type: 'object', required: ['excerpt', 'tag', 'rationale', 'action'], properties: { excerpt: { type: 'string' }, tag: { type: 'string', enum: [...MPS_TAGS] }, rationale: { type: 'string' }, action: { type: 'string', enum: [...MPS_ACTIONS] } } },
      AuditJob: { type: 'object', required: ['auditId', 'clientRequestId', 'inputHash', 'status', 'idempotentReplay', 'capability', 'sourceTextStored'], properties: { auditId: { type: 'string' }, clientRequestId: { type: 'string' }, inputHash: { type: 'string' }, status: { type: 'string', enum: ['processing', 'completed', 'failed'] }, idempotentReplay: { type: 'boolean' }, capability: { type: 'string', const: 'mps_audit' }, sourceTextStored: { type: 'boolean', const: false }, audit: { type: 'object', properties: { mps_version: { type: 'string', const: MPS_VERSION }, input_hash: { type: 'string' }, claims: { type: 'array', items: { $ref: '#/components/schemas/AuditClaim' } } } }, retryAfterSeconds: { type: 'integer' }, error: { $ref: '#/components/schemas/ErrorEnvelope' } } },
    },
  },
} as const
