import { createHash } from 'node:crypto'

export const EBOOK_ORIGIN = 'https://www.mahastrategies.com'
export const EBOOK_AMOUNT = '10000000'
export const EBOOK_VERSION = '1.0.0'
export const EBOOKS = {
  'the-maha-principle': {
    title: 'The Maha Principle', subtitle: 'The Architecture of Human Flourishing',
    filename: 'The-Maha-Principle.epub', bytes: 828345,
    sha256: 'sha256:4dad89b9b24e9225638989ce2b917cda83a2ce360d8a8b48e4d88d3e187e013f',
    pdf: { filename: 'The-Maha-Principle-print.pdf', bytes: 2048145,
      sha256: 'sha256:3906e8761a6dd2668e9def504206d0e5b2ccac7f39871d126a6a5018f72f17e0',
      editionNote: 'Author-approved print PDF dated July 6, 2026; a separate print edition, not a byte-equivalent rendering of the EPUB.' },
    description: 'A book on human flourishing, strategy and humane governance. Includes the author’s medical disclaimer; not medical advice or a validated treatment.',
  },
  'the-orbital-mind': {
    title: 'The Orbital Mind', subtitle: 'The Astrophysics of the Self',
    filename: 'The-Orbital-Mind.epub', bytes: 1324291,
    sha256: 'sha256:82072241663d51b26d98d393d8a703350ef33cc78f15316a269ff0b792bc8642',
    pdf: { filename: 'The-Orbital-Mind-print.pdf', bytes: 1886017,
      sha256: 'sha256:021d00d04293b0f333f9c20201a74d5453ea42e2f1af7c6adb4fdc79662fef31',
      editionNote: 'October 2026 print reading edition aligned to the author-selected EPUB, with linked contents, bookmarks and added publishing matter. The EPUB supplies no bibliographic entries; this limitation is disclosed rather than supplemented with invented references.' },
    description: 'A book using orbital dynamics as a framework for attention, agency, limits and integration. Metaphor and conjecture are not established psychological or medical findings.',
  },
} as const
export type EbookId = keyof typeof EBOOKS
export const EBOOK_IDS = Object.keys(EBOOKS) as EbookId[]
export const ebookOfferId = (id: EbookId) => `book-epub-${id}`
export const ebookPath = (id: EbookId) => `/api/v1/books/${id}/epub`
export const ebookResource = (id: EbookId) => EBOOK_ORIGIN + ebookPath(id)
export const ebookHash = (value: string | Uint8Array) => 'sha256:' + createHash('sha256').update(value).digest('hex')
export const ebookIdForOffer = (offerId: string): EbookId | null => EBOOK_IDS.find(id => ebookOfferId(id) === offerId) ?? null
export function ebookArtifacts(id: EbookId) {
  const book = EBOOKS[id]
  const epub = { filename: book.filename, mediaType: 'application/epub+zip', bytes: book.bytes, sha256: book.sha256, editionNote: 'Complete EPUB edition.' }
  return book.pdf ? [epub, { ...book.pdf, mediaType: 'application/pdf' }] : [epub]
}
export const ebookBundleHash = (id: EbookId) => ebookHash(JSON.stringify(ebookArtifacts(id)))
export const ebookFormatLabel = (id: EbookId) => EBOOKS[id].pdf ? 'EPUB + print PDF' : 'EPUB'

export function ebookTerms(id: EbookId): string {
  return `${EBOOKS[id].title}, digital bundle ${EBOOK_VERSION}: 10 USDC for ${ebookFormatLabel(id)} with SHA-256 commitments for every file and the ordered manifest (${ebookBundleHash(id)}). ${EBOOKS[id].pdf?.editionNote ?? 'No PDF is included in this release.'} Non-exclusive personal reading or internal use only; no resale, redistribution, model-training rights or copyright transfer. No subscription, personalized advice or subsequent API calls included. Save the original order and private 32-byte recovery secret before authorizing payment. Secret-bound recovery of the same paid bundle requires no second payment. Contact mayone@mahastrategies.com for delivery problems; payment and delivery are separate. Network or wallet fees, if any, are additional and must be approved separately.`
}
export const ebookTermsHash = (id: EbookId) => ebookHash(ebookTerms(id))
export type EbookOrder = { clientRequestId: string; version: string; artifactHash: string; termsHash: string; recoverySecret: string }

export function parseEbookOrder(id: EbookId, value: unknown): EbookOrder {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('invalid_order')
  const v = value as Record<string, unknown>
  const keys = ['clientRequestId', 'version', 'artifactHash', 'termsHash', 'recoverySecret']
  if (Object.keys(v).length !== keys.length || keys.some(k => typeof v[k] !== 'string')) throw new Error('invalid_order_fields')
  if (!/^[A-Za-z0-9_-]{8,120}$/.test(v.clientRequestId as string)) throw new Error('invalid_order_id')
  if (v.version !== EBOOK_VERSION || v.artifactHash !== ebookBundleHash(id) || v.termsHash !== ebookTermsHash(id)) throw new Error('edition_or_terms_changed')
  if (!/^[a-f0-9]{64}$/.test(v.recoverySecret as string) || new Set(v.recoverySecret as string).size < 8) throw new Error('use_random_32_byte_recovery_secret')
  return Object.fromEntries(keys.map(k => [k, v[k]])) as EbookOrder
}
export const ebookOrderHash = (id: EbookId, order: EbookOrder) => ebookHash(JSON.stringify(parseEbookOrder(id, order)))
