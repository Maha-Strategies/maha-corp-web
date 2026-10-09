import { createHash } from 'node:crypto'
import { getOpenBookEdition, getOpenBookSection, readOpenBookManuscript } from '../open-book-editions.ts'
import { canonicalJson } from '../evidence-dossier/digest.ts'
import type { X402Offer } from './offers.ts'

export const LICENSED_SECTION_BOOKS = ['the-maha-principle', 'the-orbital-mind'] as const
export type LicensedSectionBook = typeof LICENSED_SECTION_BOOKS[number]
export const licensedSectionId = (book: LicensedSectionBook) => `book-section-${book}`
export const licensedSectionPath = (book: LicensedSectionBook) => `/api/v1/books/${book}/section`
const hash = (value: string) => 'sha256:' + createHash('sha256').update(value, 'utf8').digest('hex')
const amounts: Record<LicensedSectionBook, string> = { 'the-maha-principle': '31000', 'the-orbital-mind': '33000' }
const digestSchema = { type: 'string', pattern: '^sha256:[a-f0-9]{64}$' }
const license = 'Non-exclusive personal reading or internal use only; no redistribution, resale, model-training rights or copyright transfer.'

function edition(bookId: LicensedSectionBook) {
  const book = getOpenBookEdition(bookId)
  if (!book || !LICENSED_SECTION_BOOKS.includes(bookId)) throw new Error('unsupported-book')
  const manuscript = readOpenBookManuscript(book)
  return { book, editionDigest: hash(manuscript) }
}

/** Metadata only: no manuscript text or free-reader links in catalogue discovery. */
export function licensedSectionMetadata(bookId: LicensedSectionBook) {
  const { book, editionDigest } = edition(bookId)
  return { bookId, title: book.title, subtitle: book.subtitle, author: 'Mayone Maha Rajan',
    editionBasis: 'repository-markdown/1', editionDigest, formatNote: 'A pinned Markdown section edition, not an EPUB/PDF bundle or a claim of identical editions.',
    sections: book.sections.map((s, index) => ({ id: s.slug, title: s.title, index })), license }
}

export function buildLicensedSection(bookId: LicensedSectionBook, value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('invalid-section-request')
  const v = value as Record<string, unknown>
  if (Object.keys(v).length !== 2 || !Object.hasOwn(v, 'sectionId') || !Object.hasOwn(v, 'editionDigest') || typeof v.editionDigest !== 'string' || typeof v.sectionId !== 'string' || !/^[a-z0-9][a-z0-9-]{0,79}$/.test(v.sectionId)) throw new Error('section-and-edition-digest-required')
  const sectionId = v.sectionId
  const { book, editionDigest } = edition(bookId)
  if (v.editionDigest !== editionDigest) throw new Error('edition-changed-read-metadata-before-paying')
  const selected = getOpenBookSection(book, sectionId)
  if (!selected || !selected.markdown.trim()) throw new Error('unknown-or-empty-section')
  const section = { id: sectionId, title: selected.section.title, mediaType: 'text/markdown; charset=utf-8', content: selected.markdown,
    utf8Bytes: Buffer.byteLength(selected.markdown, 'utf8'), wordCount: selected.markdown.trim().split(/\s+/u).length, contentSha256: hash(selected.markdown) }
  const body = { version: 'maha-licensed-book-section/1', offerId: licensedSectionId(bookId), bookId, book: { id: bookId, title: book.title }, editionBasis: 'repository-markdown/1', editionDigest,
    exampleOnly: false, section, license, limitations: ['One section only; no EPUB or PDF included.', 'Authorial prose, not factual certification or medical advice.', 'Receipt hashes are integrity checks, not proof of truth or copyright transfer.', 'Stateless delivery: save the result; no stored-result recovery and no automatic repayment.'] }
  const output = { ...body, receiptSha256: hash(canonicalJson(body)) }
  if (Buffer.byteLength(JSON.stringify(output)) > 262144) throw new Error('section-too-large')
  return output
}

export const LICENSED_SECTION_OFFERS: readonly X402Offer[] = LICENSED_SECTION_BOOKS.map(bookId => {
  const metadata = licensedSectionMetadata(bookId)
  return {
    id: licensedSectionId(bookId), method: 'POST', path: licensedSectionPath(bookId), amount: amounts[bookId],
    serviceName: `${metadata.title} — licensed Markdown section`,
    description: `Purchase one pinned Markdown section of ${metadata.title} with edition identity, word/byte counts and SHA-256 integrity receipt. Choose a section and confirm the edition digest before paying. Not an EPUB/PDF bundle, medical advice or factual certification. Personal/internal use only; no redistribution, resale, training rights or copyright transfer. No stored-result recovery.`,
    tags: ['books', 'licensed-sections', 'machine-readable', 'x402'], status: 'available',
    availability: { payableInProduction: true, blockedBy: [] }, requiresIdempotency: false, concurrencyCap: 4, maxRequestBytes: 1024,
    capabilityBoundaries: [metadata.formatNote, license, 'No model inference, personalized advice or factual certification.', 'Payment and delivery are separate; never repay automatically after an uncertain outcome.'],
    retention: { fullSourceTextStored: false, verbatimExcerptsRetained: false, retainedFields: ['payment metadata', 'coarse usage counts'], note: 'The published manuscript is the delivery source; request and result bodies are not persisted by this endpoint.' },
    discovery: {
      input: { sectionId: metadata.sections[0].id, editionDigest: metadata.editionDigest },
      inputSchema: { type: 'object', additionalProperties: false, required: ['sectionId', 'editionDigest'], properties: {
        sectionId: { type: 'string', enum: metadata.sections.map(s => s.id) }, editionDigest: { const: metadata.editionDigest },
      } },
      // Contract-only example, not a free chapter hidden in the payment challenge.
      output: { exampleOnly: true, note: 'Paid section content omitted. GET the route for the ordered section catalogue and edition digest.' },
      outputSchema: { oneOf: [
        { type: 'object', additionalProperties: false, required: ['exampleOnly', 'note'], properties: { exampleOnly: { const: true }, note: { type: 'string' } } },
        { type: 'object', additionalProperties: false, required: ['version', 'offerId', 'bookId', 'book', 'editionBasis', 'editionDigest', 'exampleOnly', 'section', 'license', 'limitations', 'receiptSha256'], properties: {
        version: { const: 'maha-licensed-book-section/1' }, offerId: { const: licensedSectionId(bookId) }, bookId: { const: bookId }, editionBasis: { const: 'repository-markdown/1' }, editionDigest: { const: metadata.editionDigest }, exampleOnly: { const: false },
        book: { type: 'object', additionalProperties: false, required: ['id', 'title'], properties: { id: { const: bookId }, title: { const: metadata.title } } },
        section: { type: 'object', additionalProperties: false, required: ['id', 'title', 'mediaType', 'content', 'utf8Bytes', 'wordCount', 'contentSha256'], properties: {
          id: { type: 'string', enum: metadata.sections.map(s => s.id) }, title: { type: 'string' }, mediaType: { const: 'text/markdown; charset=utf-8' }, content: { type: 'string', minLength: 1 }, utf8Bytes: { type: 'integer', minimum: 1, maximum: 262144 }, wordCount: { type: 'integer', minimum: 1 }, contentSha256: digestSchema,
        } }, license: { const: license }, limitations: { type: 'array', items: { type: 'string' } }, receiptSha256: digestSchema,
      } }] },
    },
  }
})
