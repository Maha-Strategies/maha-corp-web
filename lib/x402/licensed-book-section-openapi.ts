import { LICENSED_SECTION_OFFERS } from './licensed-book-sections.ts'
export const LICENSED_SECTION_OPENAPI_PATHS = Object.fromEntries(LICENSED_SECTION_OFFERS.map(offer => [offer.path, {
  get: { tags: ['Books'], operationId: `get_${offer.id.replaceAll('-', '_')}_catalogue`, summary: 'Inspect section metadata and the pinned edition digest; no manuscript text.', security: [], responses: { '200': { description: 'Metadata and payment contract only.' }, '400': { description: 'Query or route mismatch.' } } },
  post: { tags: ['Books'], operationId: offer.id.replaceAll('-', '_'), summary: offer.serviceName, description: offer.description, security: [],
    requestBody: { required: true, content: { 'application/json': { schema: offer.discovery.inputSchema, example: offer.discovery.input } } },
    responses: {
      '200': { description: 'Paid Markdown section; save locally and verify its integrity receipt.', content: { 'application/json': { schema: offer.discovery.outputSchema } } },
      '400': { description: 'Invalid section or changed edition; no settlement attempted for invalid signed input.' },
      '402': { description: 'Payment required; inspect exact USDC terms before signing.', headers: { 'PAYMENT-REQUIRED': { schema: { type: 'string' } } } },
      '408': { description: 'Body-read timeout.' }, '413': { description: 'Body exceeds 1024 bytes.' },
      '415': { description: 'Unsupported body media type or encoding.' }, '429': { description: 'Capacity exhausted.' },
      '503': { description: 'Disabled route or unknown payment outcome; do not repay automatically.' },
    },
  },
}]))
