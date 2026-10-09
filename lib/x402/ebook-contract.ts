import { createHash } from 'node:crypto'
import { EBOOKS_CURRENT, EBOOKS_V1, type EbookId } from './ebook-editions.ts'
export type { EbookId } from './ebook-editions.ts'

export const EBOOK_ORIGIN = 'https://www.mahastrategies.com'
export const EBOOK_AMOUNT = '10000000'
export const EBOOK_VERSION = '1.1.0'
export const EBOOKS = EBOOKS_CURRENT
export const EBOOK_VERSIONS = ['1.0.0', EBOOK_VERSION] as const
export function ebookBooksForVersion(version: string = EBOOK_VERSION) {
  if (version === EBOOK_VERSION) return EBOOKS
  if (version === '1.0.0') return EBOOKS_V1
  throw new Error('ebook_version_unavailable')
}
export const EBOOK_IDS = Object.keys(EBOOKS) as EbookId[]
export const ebookOfferId = (id: EbookId) => `book-epub-${id}`
export const ebookPath = (id: EbookId) => `/api/v1/books/${id}/epub`
export const ebookResource = (id: EbookId) => EBOOK_ORIGIN + ebookPath(id)
export const ebookHash = (value: string | Uint8Array) => 'sha256:' + createHash('sha256').update(value).digest('hex')
export const ebookIdForOffer = (offerId: string): EbookId | null => EBOOK_IDS.find(id => ebookOfferId(id) === offerId) ?? null
export function ebookArtifacts(id: EbookId, version: string = EBOOK_VERSION) {
  const book = ebookBooksForVersion(version)[id]
  const epub = { filename: book.filename, mediaType: 'application/epub+zip', bytes: book.bytes, sha256: book.sha256, editionNote: 'Complete EPUB edition.' }
  return book.pdf ? [epub, { ...book.pdf, mediaType: 'application/pdf' }] : [epub]
}
export const ebookBundleHash = (id: EbookId, version: string = EBOOK_VERSION) => ebookHash(JSON.stringify(ebookArtifacts(id, version)))
export const ebookFormatLabel = (id: EbookId, version: string = EBOOK_VERSION) => ebookBooksForVersion(version)[id].pdf ? 'EPUB + print PDF' : 'EPUB'

export function ebookTerms(id: EbookId, version: string = EBOOK_VERSION): string {
  const book = ebookBooksForVersion(version)[id]
  return `${book.title}, digital bundle ${version}: 10 USDC for ${ebookFormatLabel(id, version)} with SHA-256 commitments for every file and the ordered manifest (${ebookBundleHash(id, version)}). ${book.pdf?.editionNote ?? 'No PDF is included in this release.'} Non-exclusive personal reading or internal use only; no resale, redistribution, model-training rights or copyright transfer. No subscription, personalized advice or subsequent API calls included. Save the original order and private 32-byte recovery secret before authorizing payment. Secret-bound recovery of the same paid bundle requires no second payment. Contact mayone@mahastrategies.com for delivery problems; payment and delivery are separate. Network or wallet fees, if any, are additional and must be approved separately.`
}
export const ebookTermsHash = (id: EbookId, version: string = EBOOK_VERSION) => ebookHash(ebookTerms(id, version))
export type EbookOrder = { clientRequestId: string; version: string; artifactHash: string; termsHash: string; recoverySecret: string }

export function parseEbookOrder(id: EbookId, value: unknown): EbookOrder {
  return validateOrder(id, value, false)
}
export function parseEbookRecoveryOrder(id: EbookId, value: unknown): EbookOrder {
  return validateOrder(id, value, true)
}
function validateOrder(id: EbookId, value: unknown, recovery: boolean): EbookOrder {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('invalid_order')
  const v = value as Record<string, unknown>
  const keys = ['clientRequestId', 'version', 'artifactHash', 'termsHash', 'recoverySecret']
  if (Object.keys(v).length !== keys.length || keys.some(k => typeof v[k] !== 'string')) throw new Error('invalid_order_fields')
  if (!/^[A-Za-z0-9_-]{8,120}$/.test(v.clientRequestId as string)) throw new Error('invalid_order_id')
  const version = v.version as string
  if ((!recovery && version !== EBOOK_VERSION) || !EBOOK_VERSIONS.some(known => known === version)) throw new Error('edition_or_terms_changed')
  if (v.artifactHash !== ebookBundleHash(id, version) || v.termsHash !== ebookTermsHash(id, version)) throw new Error('edition_or_terms_changed')
  if (!/^[a-f0-9]{64}$/.test(v.recoverySecret as string) || new Set(v.recoverySecret as string).size < 8) throw new Error('use_random_32_byte_recovery_secret')
  return Object.fromEntries(keys.map(k => [k, v[k]])) as EbookOrder
}
export const ebookOrderHash = (id: EbookId, order: EbookOrder) => ebookHash(JSON.stringify(parseEbookRecoveryOrder(id, order)))
