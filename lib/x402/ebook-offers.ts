import type { X402Offer } from './offers.ts'
import { EBOOK_AMOUNT, EBOOK_IDS, EBOOK_VERSION, EBOOKS, ebookArtifacts, ebookBundleHash, ebookFormatLabel, ebookOfferId, ebookPath, ebookTermsHash } from './ebook-contract.ts'

export const EBOOK_OFFERS: readonly X402Offer[] = Object.freeze(EBOOK_IDS.map<X402Offer>(id => ({
  id: ebookOfferId(id), method: 'POST' as const, path: ebookPath(id), amount: EBOOK_AMOUNT,
  description: `Purchase ${EBOOKS[id].title}, ${ebookFormatLabel(id)} for 10 USDC. ${EBOOKS[id].description} Version-pinned files delivered inline with SHA-256 digests. Personal/internal use only; no redistribution, resale or training rights. Recover a paid order with its private secret; never repay automatically.`,
  serviceName: `Maha Books — ${EBOOKS[id].title} (${ebookFormatLabel(id)})`,
  tags: ['books', 'ebook', 'epub', 'pdf', 'cabezon', 'digital-fulfillment', 'x402'],
  status: 'available' as const, availability: { payableInProduction: true, blockedBy: [] },
  concurrencyCap: 2, requiresIdempotency: true, maxRequestBytes: 2048,
  capabilityBoundaries: [
    `Complete version-pinned ${ebookFormatLabel(id)}; preserve the files and verify their digests before opening.`,
    EBOOKS[id].pdf?.editionNote ?? 'No PDF is included in this release.',
    'Non-exclusive personal reading or internal use. No redistribution, resale, copyright transfer or model-training license.',
    'No medical advice, factual certification, customized analysis or future paid calls.',
    'Payment is not proof of delivery or buyer acceptance. Save a fresh recovery secret before signing; never repay automatically.',
    'The two titles intentionally share the exact 10 USDC price. A transfer amount alone cannot identify which title was bought.',
  ],
  retention: { fullSourceTextStored: false, verbatimExcerptsRetained: false,
    retainedFields: ['payer', 'order ID', 'input hash', 'resource', 'amount', 'payment transaction', 'settlement state'],
    note: 'Payment metadata is retained in the admission ledger. The raw recovery secret is not stored. Seller-authored EPUB and PDF files are retained privately for delivery and recovery.',
  },
  discovery: {
    input: { clientRequestId: 'ebook-order-example', version: EBOOK_VERSION, artifactHash: ebookBundleHash(id),
      termsHash: ebookTermsHash(id), recoverySecret: 'GENERATE_32_RANDOM_BYTES_AS_64_LOWERCASE_HEX' },
    inputSchema: { type: 'object', additionalProperties: false, required: ['clientRequestId', 'version', 'artifactHash', 'termsHash', 'recoverySecret'], properties: {
      clientRequestId: { type: 'string', pattern: '^[A-Za-z0-9_-]{8,120}$' }, version: { const: EBOOK_VERSION },
      artifactHash: { const: ebookBundleHash(id), description: 'SHA-256 of the exact ordered file manifest returned by GET, not a single file digest.' }, termsHash: { const: ebookTermsHash(id) },
      recoverySecret: { type: 'string', description: 'Generate a new random 32-byte secret locally, encode as 64 lowercase hex characters, and save it before paying. The example is not a usable secret.' },
    } },
    output: { productId: ebookOfferId(id), version: EBOOK_VERSION, orderId: 'ebook-order-example', transaction: '0x' + '0'.repeat(64),
      recovered: false, delivery: 'inline_base64_ebook_bundle', acceptance: 'buyer_review_required', exampleOnly: true,
      manifestSha256: ebookBundleHash(id), artifacts: ebookArtifacts(id).map(file => ({ ...file, base64: '' })) },
    outputSchema: { type: 'object', additionalProperties: false, required: ['productId', 'version', 'orderId', 'transaction', 'recovered', 'delivery', 'acceptance', 'exampleOnly', 'manifestSha256', 'artifacts'], properties: {
      productId: { const: ebookOfferId(id) }, version: { const: EBOOK_VERSION }, orderId: { type: 'string' },
      transaction: { type: 'string', pattern: '^0x[0-9a-fA-F]{64}$' }, recovered: { type: 'boolean' },
      delivery: { const: 'inline_base64_ebook_bundle' }, acceptance: { const: 'buyer_review_required' }, exampleOnly: { type: 'boolean' },
      manifestSha256: { const: ebookBundleHash(id) },
      artifacts: { type: 'array', minItems: ebookArtifacts(id).length, maxItems: ebookArtifacts(id).length, items: {
        oneOf: ebookArtifacts(id).map(file => ({ type: 'object', additionalProperties: false,
          required: ['filename', 'mediaType', 'bytes', 'sha256', 'editionNote', 'base64'], properties: {
            filename: { const: file.filename }, mediaType: { const: file.mediaType }, bytes: { const: file.bytes }, sha256: { const: file.sha256 },
            editionNote: { const: file.editionNote }, base64: { type: 'string', description: 'Empty only in compact discovery examples. A paid/recovered response carries every complete file encoded as base64.' },
          },
        })),
      } },
    } },
    requiredHeaders: {
      'x-maha-idempotency-key': { preimage: 'clientRequestId', algorithm: 'identity', format: '8-120 ASCII letters/digits/underscore/hyphen' },
      'x-maha-input-hash': { preimage: 'UTF-8 JSON.stringify({clientRequestId,version,artifactHash,termsHash,recoverySecret}) in exactly this key order, no whitespace', algorithm: 'SHA-256', format: 'sha256:<lowercase hex>' },
    },
  },
})))
