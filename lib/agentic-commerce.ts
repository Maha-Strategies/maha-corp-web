import { MPS_AUDIT_CAPABILITY } from './mps-audit-jobs.ts'
import { MPS_AUDIT_CREDIT_UNIT } from './mps-credits.ts'
import { BOOKS } from './books.ts'

export const SITE_URL = 'https://www.mahastrategies.com'
export const AGENTIC_COMMERCE_MANIFEST_URL = `${SITE_URL}/agent-offers.json`
export const AGENTIC_COMMERCE_API_URL = `${SITE_URL}/api/agentic-commerce/offers`
export const AGENTIC_COMMERCE_CONTEXT_URL = `${SITE_URL}/llm-context/agentic-commerce.md`

export const contextCompressionX402Capability = {
  id: 'context-compression',
  endpoint: `${SITE_URL}/api/v1/compress`,
  method: 'POST',
  payment: {
    protocol: 'x402',
    version: 2,
    scheme: 'exact',
    network: 'eip155:8453',
    asset: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    assetSymbol: 'USDC',
    amount: '1000',
    amountUnit: 'base_units',
    displayAmount: '0.001 USDC',
  },
  discovery: 'https://api.cdp.coinbase.com/platform/v2/x402/discovery/mcp',
  buyerRecipe: `${SITE_URL}/recipes/bazaar-discovery-to-payment`,
  alternativeAuthorization: 'Bearer Maha API key',
} as const

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

const mpsPreflightOffer = {
  id: 'mps-preflight',
  name: 'MPS Preflight',
  status: 'available_for_self_service_purchase',
  serviceUrl: `${SITE_URL}/mps/preflight`,
  pricing: { currency: 'USD', type: 'fixed', amount: 49 },
  delivery: { type: 'automated_after_signed_payment_confirmation', report: 'Private claim map, verification backlog, and machine-readable record.' },
  input: { maximumCharacters: 12000, acceptedContent: 'A nonfiction document extract.' },
  purchase: {
    mode: 'human_confirmed_stripe_checkout', purchaseUrl: `${SITE_URL}/mps/preflight`, checkoutEndpoint: `${SITE_URL}/api/mps-preflight/checkout`, method: 'POST',
    authorization: 'A human purchaser must review and authorize payment in Stripe Checkout. This discovery surface does not authorize an autonomous charge.',
  },
  boundaries: ['Automated triage, not a public MPS certification or source-by-source human verification.', 'No legal, investment, or other regulated professional advice.', 'The source document is not saved in the ledger; the durable record retains an input hash and claim excerpts.'],
} as const

const mahaOsOffer = {
  id: 'maha-os-mobile-app',
  name: 'Maha OS',
  status: 'available_through_app_stores',
  serviceUrl: `${SITE_URL}/software`,
  description: 'A local-first mobile application for focus and metabolic awareness, designed to minimize non-essential off-device telemetry.',
  acquisition: {
    mode: 'external_app_store',
    iosUrl: 'https://apps.apple.com/us/app/maha-os/id6778333838',
    androidUrl: 'https://play.google.com/store/apps/details?id=com.maha.os',
    authorization: 'App-store terms and payment controls apply. Maha Strategies does not expose an autonomous purchase endpoint for the app.',
  },
} as const

const bookOffers = Object.entries(BOOKS).map(([id, name]) => ({
  id: `book-${id}`,
  name,
  status: 'open_web_edition_with_authenticated_machine_access',
  serviceUrl: `${SITE_URL}/books/${id}`,
  access: {
    publicWebEdition: 'Free to read on the public web page.',
    machineReadableContent: 'The paid entitlement adds a heading-addressable structured content API for local MCP use; it does not restrict the free public web edition.',
    entitlementEndpoint: `${SITE_URL}/api/books/${id}/entitlement`,
    contentEndpoint: `${SITE_URL}/api/books/${id}/content`,
  },
  pricing: {
    currency: 'USD',
    type: 'stripe_checkout_disclosed',
    disclosure: 'The current price is displayed in Stripe Checkout before payment is authorized.',
  },
  purchase: {
    mode: 'authenticated_stripe_checkout_when_enabled',
    checkoutEndpoint: `${SITE_URL}/api/books/checkout`,
    authorization: 'A valid client credential is required. The caller must obtain human approval before any checkout is opened; no merchant secret or autonomous spending authority is exposed.',
  },
  entitlementPolicy: {
    delivery: 'Stripe signed payment confirmation mints the entitlement exactly once.',
    refundAndDispute: 'Partial refunds preserve access. Access is revoked only after cumulative refunds reach the original payment or a Stripe dispute is closed as lost.',
    termsUrl: `${SITE_URL}/books/mcp-access`,
  },
}))

const inquiryOffers = [
  {
    id: 'rapid-intelligence-brief', name: 'Rapid Intelligence Brief', status: 'available_for_inquiry', serviceUrl: `${SITE_URL}/rapid-intelligence-brief`,
    pricing: { currency: 'USD', type: 'starting_at', amount: 500 }, delivery: { targetBusinessDays: 5, beginsAfter: 'A human confirms fit, scope, sources, deliverable, price, and timing.' },
    request: { mode: 'authenticated_json', url: `${SITE_URL}/api/agent-inquiries`, method: 'POST', inputSchema: `${SITE_URL}/agent-inquiry-schema.json`, inquiryType: 'rapid_intelligence', responseTargetBusinessDays: 2 },
  },
  {
    id: 'verified-research-brief', name: 'Verified Research Brief', status: 'available_for_inquiry', serviceUrl: `${SITE_URL}/consulting`,
    pricing: { currency: 'USD', type: 'fixed', amount: 2500 }, delivery: { targetBusinessDays: 10, beginsAfter: 'A human confirms and narrows the scoped question.' },
    request: { mode: 'authenticated_json', url: `${SITE_URL}/api/agent-inquiries`, method: 'POST', inputSchema: `${SITE_URL}/agent-inquiry-schema.json`, inquiryType: 'verified_research', responseTargetBusinessDays: 2 },
  },
] as const

export const availableOffers = [mpsAuditOffer, mpsPreflightOffer, ...bookOffers, mahaOsOffer, ...inquiryOffers] as const

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
      version: '0.3.2',
      install: 'npm install -g @mahastrategies/maha-mcp-bridge',
      manifest: `${SITE_URL}/api/mcp-bridge/manifest`,
      policy: 'The local bridge uses the documented API; it does not receive a merchant secret or autonomous spending authority.',
    },
    autonomousCapabilities: [contextCompressionX402Capability],
  },
  transactionPolicy: {
    mode: 'mixed_by_capability',
    autonomousPaymentSupported: true,
    autonomousPaymentScope: [contextCompressionX402Capability.id],
    humanConfirmationRequired: true,
    humanConfirmationScope: ['stripe-checkout', 'research-inquiries', 'enterprise-onboarding'],
    bindingCommitment: 'Only Context Compression accepts autonomous x402 payment under its published terms. Stripe purchases require purchaser authorization; research and enterprise engagements require human scope review.',
  },
  offers: availableOffers,
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
