import { createHash } from 'node:crypto'

import { canonicalJson } from '../evidence-dossier/digest.ts'
import { getOpenBookEdition, getOpenBookSection, type OpenBookEdition } from '../open-book-editions.ts'
import type { JsonSchema, OfferDiscoveryContract } from './offer-schemas.ts'

export const MACHINE_BOOK_IDS = ['the-imagined-life', 'the-volcanic-engine'] as const
export type MachineBookId = (typeof MACHINE_BOOK_IDS)[number]

const SITE_URL = 'https://www.mahastrategies.com'
const SHA = '^sha256:[a-f0-9]{64}$'

function digest(value: string): string {
  return `sha256:${createHash('sha256').update(value, 'utf8').digest('hex')}`
}

function countWords(value: string): number {
  return value.trim() ? value.trim().split(/\s+/).length : 0
}

export function buildBookSectionReceipt(bookId: MachineBookId, input: unknown) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Request must be a JSON object.')
  const record = input as Record<string, unknown>
  if (Object.keys(record).some((key) => key !== 'sectionId')) throw new Error('Only sectionId is accepted.')
  if (typeof record.sectionId !== 'string' || !/^[a-z0-9][a-z0-9-]{0,79}$/.test(record.sectionId)) {
    throw new Error('sectionId must be a published section slug.')
  }

  const book = getOpenBookEdition(bookId)
  if (!book) throw new Error('Book is not available.')
  const selected = getOpenBookSection(book, record.sectionId)
  if (!selected) throw new Error('Unknown sectionId for this edition.')
  const sectionIndex = book.sections.findIndex((section) => section.slug === record.sectionId)
  const contentSha256 = digest(selected.markdown)
  const request = { bookId, sectionId: selected.section.slug }
  const responseWithoutReceipt = {
    version: 'maha-machine-book-section/0.1',
    offerId: `book-section-${bookId}`,
    book: {
      id: book.slug,
      title: book.title,
      subtitle: book.subtitle,
      author: 'Mayone Maha Rajan',
      publicEditionUrl: `${SITE_URL}/books/${book.slug}`,
      sectionCount: book.sections.length,
    },
    section: {
      id: selected.section.slug,
      index: sectionIndex,
      title: selected.section.title,
      mediaType: 'text/markdown; charset=utf-8',
      utf8Bytes: Buffer.byteLength(selected.markdown, 'utf8'),
      wordCount: countWords(selected.markdown),
      contentSha256,
      content: selected.markdown,
    },
    boundaries: {
      publicWebEditionRemainsFree: true,
      purchaseUnit: 'one deterministic machine-readable section retrieval',
      editorialAnalysisIncluded: false,
      factualCertificationIncluded: false,
      licenseTransferIncluded: false,
      note: 'Payment purchases structured delivery and an integrity receipt; it does not make the freely readable text exclusive or transfer copyright.',
    },
  }
  const receiptPreimage = {
    version: 'maha-machine-book-receipt/0.1',
    requestSha256: digest(canonicalJson(request)),
    contentSha256,
    responseSha256: digest(canonicalJson(responseWithoutReceipt)),
  }
  return {
    ...responseWithoutReceipt,
    receipt: {
      ...receiptPreimage,
      canonicalization: 'sorted-key canonical JSON with NFC-normalized strings',
      receiptSha256: digest(canonicalJson(receiptPreimage)),
    },
  }
}

const inputSchema = (book: OpenBookEdition): JsonSchema => ({
  type: 'object', additionalProperties: false,
  properties: {
    sectionId: {
      type: 'string',
      enum: book.sections.map((section) => section.slug),
      description: 'Exact published section slug. The complete ordered section catalog is embedded here so a buyer can select before paying.',
    },
  },
  required: ['sectionId'],
})

const outputSchema = (book: OpenBookEdition): JsonSchema => ({
  type: 'object', additionalProperties: false,
  properties: {
    version: { type: 'string', const: 'maha-machine-book-section/0.1' },
    offerId: { type: 'string', const: `book-section-${book.slug}` },
    book: { type: 'object', additionalProperties: false, properties: {
      id: { type: 'string', const: book.slug }, title: { type: 'string', const: book.title }, subtitle: { type: 'string', const: book.subtitle },
      author: { type: 'string', const: 'Mayone Maha Rajan' }, publicEditionUrl: { type: 'string' }, sectionCount: { type: 'integer', const: book.sections.length },
    }, required: ['id', 'title', 'subtitle', 'author', 'publicEditionUrl', 'sectionCount'] },
    section: { type: 'object', additionalProperties: false, properties: {
      id: { type: 'string' }, index: { type: 'integer', minimum: 0 }, title: { type: 'string' }, mediaType: { type: 'string', const: 'text/markdown; charset=utf-8' },
      utf8Bytes: { type: 'integer', minimum: 1 }, wordCount: { type: 'integer', minimum: 1 }, contentSha256: { type: 'string', pattern: SHA }, content: { type: 'string', minLength: 1 },
    }, required: ['id', 'index', 'title', 'mediaType', 'utf8Bytes', 'wordCount', 'contentSha256', 'content'] },
    boundaries: { type: 'object', additionalProperties: false, properties: {
      publicWebEditionRemainsFree: { type: 'boolean', const: true }, purchaseUnit: { type: 'string' }, editorialAnalysisIncluded: { type: 'boolean', const: false },
      factualCertificationIncluded: { type: 'boolean', const: false }, licenseTransferIncluded: { type: 'boolean', const: false }, note: { type: 'string' },
    }, required: ['publicWebEditionRemainsFree', 'purchaseUnit', 'editorialAnalysisIncluded', 'factualCertificationIncluded', 'licenseTransferIncluded', 'note'] },
    receipt: { type: 'object', additionalProperties: false, properties: {
      version: { type: 'string', const: 'maha-machine-book-receipt/0.1' }, requestSha256: { type: 'string', pattern: SHA }, contentSha256: { type: 'string', pattern: SHA },
      responseSha256: { type: 'string', pattern: SHA }, canonicalization: { type: 'string' }, receiptSha256: { type: 'string', pattern: SHA },
    }, required: ['version', 'requestSha256', 'contentSha256', 'responseSha256', 'canonicalization', 'receiptSha256'] },
  },
  required: ['version', 'offerId', 'book', 'section', 'boundaries', 'receipt'],
})

export function bookSectionDiscovery(bookId: MachineBookId): OfferDiscoveryContract {
  const book = getOpenBookEdition(bookId)
  if (!book) throw new Error(`Unknown machine book ${bookId}.`)
  const input = { sectionId: book.sections[0].slug }
  return { input, inputSchema: inputSchema(book), output: buildBookSectionReceipt(bookId, input), outputSchema: outputSchema(book) }
}
