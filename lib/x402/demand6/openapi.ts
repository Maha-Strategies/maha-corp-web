import { DEMAND6_OFFERS } from './offers.ts'
export const DEMAND6_OPENAPI_PATHS = Object.fromEntries(DEMAND6_OFFERS.map(offer => [offer.path, {
  get: { tags: ['x402 Demand Products'], operationId: 'describe-' + offer.id, security: [], summary: 'Free contract and synthetic example', responses: { '200': { description: 'Local implementation contract. No work or payment.' } } },
  post: { tags: ['x402 Demand Products'], operationId: offer.id, security: [], summary: offer.serviceName + ' (withheld)', description: offer.description + ' Local implementation only; production refuses before work or payment until release approval.',
    'x-maha-status': offer.status, 'x-maha-payable-in-production': false, 'x-maha-price-base-units': offer.amount,
    requestBody: { required: true, content: { 'application/json': { schema: offer.discovery.inputSchema, example: offer.discovery.input } } },
    parameters: Object.entries(offer.discovery.requiredHeaders ?? {}).map(([name, rule]) => ({ in: 'header', name, required: true, schema: { type: 'string' }, description: rule.preimage + '; ' + rule.format + '. ' + (rule.notes ?? '') })),
    responses: { '200': { description: 'Bounded result after verified settlement or retained same-authorization recovery.', content: { 'application/json': { schema: offer.discovery.outputSchema, example: offer.discovery.output } } },
      '400': { description: 'Invalid input, purchase binding or payment authorization; no work/settlement.' }, '402': { description: 'Unpaid quote only.' },
      '408': { description: 'Body read deadline exceeded; no payment.' }, '409': { description: 'Invalid purchase evidence; operator review, do not repay.' },
      '413': { description: 'Request exceeds 32 KiB.' }, '415': { description: 'Uncompressed JSON only.' }, '422': { description: 'Work unavailable or unsupported; no payment.' },
      '429': { description: 'Capacity or same-purchase lock; retry same authorization.' }, '503': { description: 'Unpublished, retention unavailable or payment outcome unknown. Do not automatically repay.' } },
  },
}]))
