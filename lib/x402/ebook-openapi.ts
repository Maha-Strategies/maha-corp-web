import { EBOOK_IDS, EBOOKS, ebookFormatLabel, ebookPath } from './ebook-contract.ts'
import { EBOOK_OFFERS } from './ebook-offers.ts'
const body = (schema: object) => ({ required: true, content: { 'application/json': { schema } } })
type EbookOperation = { tags: string[]; [field: string]: unknown }
export const EBOOK_OPENAPI_PATHS = Object.fromEntries(EBOOK_IDS.flatMap((id): [string, Record<string, EbookOperation>][] => {
  const offer = EBOOK_OFFERS.find(o => o.path === ebookPath(id))!
  const errors = { '400': { description: 'Invalid request; no new payment.' }, '503': { description: 'Unavailable or outcome unknown; reconcile, never repay automatically.' } }
  return [
    [ebookPath(id), {
      get: { tags: ['Books'], operationId: `getEpubContract_${id.replaceAll('-', '_')}`, security: [], summary: `${EBOOKS[id].title} purchase metadata`,
        responses: { '200': { description: 'Metadata and terms only; no EPUB bytes, secrets or free reading links.' }, '503': errors['503'] } },
      post: { tags: ['Books'], operationId: `purchaseEpub_${id.replaceAll('-', '_')}`, security: [], summary: `${EBOOKS[id].title} ${ebookFormatLabel(id)} — 10 USDC`,
        description: `Save the original version-pinned order and random recovery secret before paying. Includes ${ebookFormatLabel(id)}; no subscription or subsequent paid API calls.`,
        parameters: Object.entries(offer.discovery.requiredHeaders ?? {}).map(([name, contract]) => ({ name, in: 'header', required: true, schema: { type: 'string' }, description: JSON.stringify(contract) })),
        requestBody: body(offer.discovery.inputSchema), responses: { ...errors,
          '200': { description: 'Complete pinned ebook bundle encoded as base64; decode every file and verify its SHA-256 digest.', content: { 'application/json': { schema: offer.discovery.outputSchema } } },
          '402': { description: 'x402 quote for 10000000 USDC base units; no purchase yet.' }, '409': { description: 'Order/headers conflict; no new payment.' },
        },
      },
    }],
    [ebookPath(id) + '/retrieve', { post: { tags: ['Books'], operationId: `recoverEpub_${id.replaceAll('-', '_')}`, security: [], summary: 'Recover the original paid ebook bundle without repayment',
      requestBody: body({ type: 'object', additionalProperties: false, required: ['payer', 'order'], properties: {
        payer: { type: 'string', pattern: '^0x[0-9a-fA-F]{40}$' }, order: offer.discovery.inputSchema,
      } }), responses: { ...errors, '200': { description: 'Original pinned ebook bundle; no additional payment.', content: { 'application/json': { schema: offer.discovery.outputSchema } } }, '404': { description: 'Recovery unavailable; contact mayone@mahastrategies.com, do not repay.' } },
    } }],
  ]
}))
