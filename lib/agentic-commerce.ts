import { MPS_AUDIT_CAPABILITY } from './mps-audit-jobs.ts'
import { MPS_AUDIT_CREDIT_UNIT } from './mps-credits.ts'

export const SITE_URL = 'https://www.mahastrategies.com'
export const AGENTIC_COMMERCE_MANIFEST_URL = `${SITE_URL}/agent-offers.json`
export const AGENTIC_COMMERCE_API_URL = `${SITE_URL}/api/agentic-commerce/offers`
export const AGENTIC_COMMERCE_CONTEXT_URL = `${SITE_URL}/llm-context/agentic-commerce.md`

// This is deliberately a public, read-only description of the MPS offer. It
// never reads Stripe configuration or returns a credential, checkout session,
// customer data, or a payment capability.
export const mpsAuditOffer = {
  id: 'mps-prepaid-audit-access',
  name: 'MPS Prepaid Audit API Access',
  status: 'available_for_self_service_purchase',
  serviceUrl: `${SITE_URL}/mps/audit-access`,
  capability: MPS_AUDIT_CAPABILITY,
  pricing: {
    currency: 'USD',
    type: 'stripe_checkout_disclosed',
    disclosure: 'The current fixed-pack price and payment methods are displayed by Stripe Checkout before payment is authorized.',
  },
  delivery: {
    type: 'automated_after_signed_payment_confirmation',
    credentialScope: 'MPS audit API only',
    credentialExpiry: 'One year after checkout preparation unless the credential is revoked sooner.',
  },
  prepaidCredits: {
    unit: MPS_AUDIT_CREDIT_UNIT,
    consumption: 'One credit is reserved before each successful MPS API audit runs.',
    failedAuditPolicy: 'If an audit fails after a credit is reserved, the credit is automatically returned to the append-only ledger.',
    insufficientBalance: {
      httpStatus: 402,
      code: 'payment_required',
      action: 'Buy another prepaid pack through the purchase URL or checkout endpoint in the response.',
    },
  },
  purchase: {
    mode: 'human_confirmed_stripe_checkout',
    purchaseUrl: `${SITE_URL}/mps/audit-access`,
    checkoutEndpoint: `${SITE_URL}/api/mps-credits/checkout`,
    method: 'POST',
    inputSchema: {
      type: 'object',
      required: ['email', 'clientRequestId'],
      properties: {
        email: { type: 'string', format: 'email', description: 'Receipt email for the purchaser.' },
        clientRequestId: { type: 'string', minLength: 8, maxLength: 120, description: 'Caller-chosen idempotency key, one line.' },
      },
    },
    authorization: 'A human purchaser must review and authorize the Stripe-hosted payment. This discovery surface does not authorize an autonomous charge.',
  },
  credentialPolicy: {
    issuance: 'A new credential is generated for each self-service checkout and becomes active only after Stripe signed webhook confirmation.',
    storage: 'The plaintext credential is disclosed once in the purchasing browser. Store it in a secret manager before closing the page.',
    recovery: 'Plaintext credentials cannot be recovered. Support can revoke and replace a credential, but cannot reveal the original secret.',
    access: 'Credentials are scoped, rate-limited, expiring, revocable, and cannot access internal services.',
  },
  api: {
    openApi: `${SITE_URL}/api/docs/openapi`,
    auditEndpoint: `${SITE_URL}/api/mps-audits`,
    balanceEndpoint: `${SITE_URL}/api/mps-credits`,
    authorization: `Bearer client credential with explicit ${MPS_AUDIT_CAPABILITY} capability.`,
  },
  safeguards: [
    'Stripe webhooks are idempotent: a duplicate Stripe event cannot grant credits twice.',
    'Credit consumption is atomic and occurs before the audit model is invoked.',
    'Credential request limits are enforced by shared database state, not process memory.',
    'The source passage is not retained in the private audit ledger; the ledger stores a hash and result metadata.',
  ],
} as const

export const agenticCommerceDiscovery = {
  schema: `${SITE_URL}/schemas/agentic-commerce/v0.1`,
  version: '0.1.0',
  provider: {
    name: 'Maha Strategies LLC',
    url: SITE_URL,
    contactUrl: `${SITE_URL}/contact`,
  },
  discovery: {
    manifest: AGENTIC_COMMERCE_MANIFEST_URL,
    context: AGENTIC_COMMERCE_CONTEXT_URL,
    openApi: `${SITE_URL}/api/docs/openapi`,
    localMcpBridge: {
      package: '@mahastrategies/maha-mcp-bridge',
      install: 'npm install -g @mahastrategies/maha-mcp-bridge',
      policy: 'The local bridge uses the documented API; it does not receive a merchant secret or autonomous spending authority.',
    },
  },
  transactionPolicy: {
    autonomousPaymentSupported: false,
    humanConfirmationRequired: true,
    bindingCommitment: 'A purchase is binding only when the purchaser authorizes payment in Stripe Checkout. This discovery document cannot initiate or authorize a charge.',
  },
  offers: [mpsAuditOffer],
} as const

export const mpsAuditServiceJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Service',
  '@id': `${SITE_URL}/mps/audit-access#service`,
  name: mpsAuditOffer.name,
  description: 'Prepaid, claim-level provenance audits through the MPS API. Credits are consumed before an audit and returned automatically when execution fails.',
  url: mpsAuditOffer.serviceUrl,
  serviceType: 'Claim-level provenance audit API',
  provider: { '@id': `${SITE_URL}/#organization` },
  additionalProperty: [
    { '@type': 'PropertyValue', name: 'Credential scope', value: mpsAuditOffer.delivery.credentialScope },
    { '@type': 'PropertyValue', name: 'Billing model', value: 'Prepaid audit credits' },
    { '@type': 'PropertyValue', name: 'Insufficient credit response', value: 'HTTP 402 Payment Required' },
    { '@type': 'PropertyValue', name: 'Machine-readable commercial manifest', value: AGENTIC_COMMERCE_MANIFEST_URL },
  ],
} as const
