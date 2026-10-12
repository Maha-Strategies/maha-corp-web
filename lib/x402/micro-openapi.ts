import { MICRO_OFFERS } from './micro-offers.ts'
import { isScienceProduct } from './science/contracts.ts'

/** Availability follows the exact release cohort; live configuration is checked separately. */
export const MICRO_OPENAPI_PATHS = Object.fromEntries(MICRO_OFFERS.map(offer => [offer.path, {
  get: {
    tags: ['x402 Microproducts'], operationId: `describe-${offer.id}`, security: [],
    summary: 'Free contract and synthetic example',
    responses: { '200': { description: 'Contract, prices, boundaries and example; no caller-specific execution.' }, '400': { description: 'Query parameters are refused.' } },
  },
  post: {
    tags: ['x402 Microproducts'], operationId: offer.id, security: [],
    summary: `${offer.serviceName} (${offer.status})`,
    description: `${offer.description} ${offer.availability.payableInProduction ? 'Owner-authorized release; execution requires enabled payment configuration.' : 'Withheld; Preview and Production POST refuse before payment.'} x402-only, no enterprise credits. Valid negative findings are results, not approvals. An unsigned integrity digest is not expert review or proof of source authenticity. ${isScienceProduct(offer.id) ? 'Persist the purchase ID, private recovery secret and original input before signing. Within 30 days request no-payment recovery by supplying those headers, x-maha-recovery-mode: replay and the original payer. Changed results or unknown outcomes require operator review; never automatically repay.' : 'Save the response: there is no stored-result recovery. Inspect settlement before retrying after network loss.'}`,
    'x-maha-status': offer.status, 'x-maha-payable-in-production': offer.availability.payableInProduction,
    'x-maha-price-base-units': offer.amount, 'x-maha-max-request-bytes': offer.maxRequestBytes,
    parameters: [{ in: 'header', name: 'PAYMENT-SIGNATURE', required: false, schema: { type: 'string' }, description: 'x402 v2 payment payload after a challenge; never put submitted input in this header.' }, ...Object.entries(offer.discovery.requiredHeaders ?? {}).map(([name,rule])=>({in:'header',name,required:true,schema:{type:'string'},description:rule.format+'; '+rule.preimage}))],
    requestBody: { required: true, content: { 'application/json': { schema: offer.discovery.inputSchema, example: offer.discovery.input } } },
    responses: {
      '200': { description: 'Deterministic result and input-bound integrity receipt after confirmed payment; withheld offers refuse.', content: { 'application/json': { schema: offer.discovery.outputSchema, example: offer.discovery.output } }, headers: { 'PAYMENT-RESPONSE': { schema: { type: 'string' } } } },
      '400': { description: 'Malformed, private, stale or unsupported input; refused before payment.' },
      '402': { description: 'Payment challenge, not delivery.', headers: { 'PAYMENT-REQUIRED': { schema: { type: 'string' } } } },
      '408': { description: 'Body read exceeded five seconds; no payment attempted.' },
      '409': { description: 'Payment replay refused.' },
      '413': { description: 'Body exceeds 32,768 bytes; no payment attempted.' },
      '415': { description: 'Only uncompressed application/json is supported.' },
      '429': { description: 'Work or settlement capacity exhausted.' },
      '502': { description: 'Settlement evidence contradicted by chain verification.' },
      '503': { description: 'Offer unpublished, payment unavailable or settlement outcome unknown. Do not automatically pay again.' },
    },
  },
}]))
