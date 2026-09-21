import { BUYER_BRIEF_OFFER as offer } from './buyer-brief-offer.ts'
const body = (schema: object) => ({ required: true, content: { 'application/json': { schema } } })
const recovery = { type: 'object', additionalProperties: false, required: ['payer', 'order'], properties: {
  payer: { type: 'string', pattern: '^0x[0-9a-fA-F]{40}$' }, order: offer.discovery.inputSchema,
} }
const responses = { '200': { description: 'Pinned archive bytes; verify digest and review contents. Not buyer acceptance.' }, '400': { description: 'Invalid request; no new payment.' }, '503': { description: 'Unavailable or outcome unknown; reconcile, do not pay again.' } }
export const BUYER_BRIEF_OPENAPI_PATHS = {
  '/api/v1/cabezon/buyer-brief': {
    get: { tags: ['Buyer-Brief'], operationId: 'getBuyerBriefContract', security: [], summary: 'Free pinned artifact metadata, terms and current purchase gate', responses: { '200': { description: 'Metadata only, not archive contents. purchaseEnabled must be true before purchase.' }, '503': { description: 'Private artifact unavailable; do not pay.' } } },
    post: { tags: ['Buyer-Brief'], operationId: 'purchaseBuyerBrief', security: [], summary: 'Purchase the prepared Buyer-Brief archive for 20 USDC', description: 'Only payable after activation. x402-only, Base native USDC. Save the random recovery secret before signing. No extra API calls are included.',
      parameters: Object.entries(offer.discovery.requiredHeaders ?? {}).map(([name, contract]) => ({ name, in: 'header', required: true, schema: { type: 'string' }, description: JSON.stringify(contract) })),
      requestBody: body(offer.discovery.inputSchema), responses: { ...responses, '402': { description: 'Unsigned x402 quote; no purchase.', headers: { 'PAYMENT-REQUIRED': { schema: { type: 'string' } } } }, '409': { description: 'Changed bundle or mismatched order binding; reapprove before signing.' } } },
  },
  '/api/v1/cabezon/buyer-brief/retrieve': { post: { tags: ['Buyer-Brief'], operationId: 'recoverBuyerBrief', security: [], summary: 'Recover a settled order without repayment', description: 'POST saved payer and exact order, including the private recovery secret. Never send a payment header or put the secret in the URL.', requestBody: body(recovery), responses: { ...responses, '404': { description: 'Recovery unavailable; contact seller, do not repay.' } } } },
  '/api/v1/cabezon/buyer-brief/support': { post: { tags: ['Buyer-Brief'], operationId: 'requestBuyerBriefSupport', security: [], summary: 'Queue an authenticated delivery, correction or refund request', requestBody: body({ ...recovery, required: ['payer', 'order', 'kind'], properties: { ...recovery.properties, kind: { enum: ['delivery_problem', 'correction_requested', 'refund_requested'] } } }), responses: { '202': { description: 'Ticket queued; email delivery and refund are not confirmed.' }, '400': responses['400'], '503': responses['503'] } } },
}
