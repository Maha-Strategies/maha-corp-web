import { createHash } from 'node:crypto'

import { canonicalJson } from '../evidence-dossier/digest.ts'
import {
  getOpenBookEdition,
  getOpenBookSection,
  readOpenBookManuscript,
  type OpenBookEdition,
} from '../open-book-editions.ts'
import type { JsonSchema, OfferDiscoveryContract } from './offer-schemas.ts'
import type { MachineBookId } from './book-section-product.ts'

const SITE_URL = 'https://www.mahastrategies.com'
const SHA = '^sha256:[a-f0-9]{64}$'

function digest(value: string): string {
  return `sha256:${createHash('sha256').update(value, 'utf8').digest('hex')}`
}

function countWords(value: string): number {
  return value.trim() ? value.trim().split(/\s+/).length : 0
}

function validateInput(input: unknown): void {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Request must be an empty JSON object.')
  if (Object.keys(input as Record<string, unknown>).length !== 0) throw new Error('This edition has no request parameters; send {}.')
}

function sectionManifest(book: OpenBookEdition) {
  return book.sections.map((section, index) => {
    const selected = getOpenBookSection(book, section.slug)
    if (!selected) throw new Error(`Published section ${section.slug} could not be reconstructed.`)
    return {
      index,
      id: section.slug,
      title: section.title,
      utf8Bytes: Buffer.byteLength(selected.markdown, 'utf8'),
      wordCount: countWords(selected.markdown),
      contentSha256: digest(selected.markdown),
    }
  })
}

export function buildBookEditionReceipt(bookId: MachineBookId, input: unknown) {
  validateInput(input)
  const book = getOpenBookEdition(bookId)
  if (!book) throw new Error('Book is not available.')
  const content = readOpenBookManuscript(book)
  const editionSha256 = digest(content)
  const request = { bookId, format: 'text/markdown; charset=utf-8' }
  const responseWithoutReceipt = {
    version: 'maha-machine-book-edition/0.1',
    offerId: `book-edition-${bookId}`,
    exampleOnly: false,
    book: {
      id: book.slug,
      title: book.title,
      subtitle: book.subtitle,
      author: 'Mayone Maha Rajan',
      publicEditionUrl: `${SITE_URL}/books/${book.slug}`,
      sectionCount: book.sections.length,
    },
    edition: {
      mediaType: 'text/markdown; charset=utf-8',
      utf8Bytes: Buffer.byteLength(content, 'utf8'),
      wordCount: countWords(content),
      editionSha256,
      sections: sectionManifest(book),
      content,
    },
    license: {
      grant: 'Non-exclusive personal or internal machine-readable use by the purchaser.',
      redistributionAllowed: false,
      resaleAllowed: false,
      modelTrainingRightsGranted: false,
      copyrightTransferred: false,
    },
    boundaries: {
      publicWebEditionRemainsFree: true,
      purchaseUnit: 'one complete deterministic machine-readable edition retrieval',
      editorialAnalysisIncluded: false,
      factualCertificationIncluded: false,
      recommendationIncluded: false,
      note: 'Payment purchases complete structured delivery and an integrity receipt. It does not make the freely readable text exclusive or transfer copyright.',
    },
  }
  const receiptPreimage = {
    version: 'maha-machine-book-receipt/0.1',
    requestSha256: digest(canonicalJson(request)),
    contentSha256: editionSha256,
    manifestSha256: digest(canonicalJson(responseWithoutReceipt.edition.sections)),
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

const inputSchema: JsonSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {},
}

const manifestItemSchema: JsonSchema = {
  type: 'object', additionalProperties: false,
  properties: {
    index: { type: 'integer', minimum: 0 }, id: { type: 'string' }, title: { type: 'string' },
    utf8Bytes: { type: 'integer', minimum: 1 }, wordCount: { type: 'integer', minimum: 1 }, contentSha256: { type: 'string', pattern: SHA },
  },
  required: ['index', 'id', 'title', 'utf8Bytes', 'wordCount', 'contentSha256'],
}

const outputSchema = (book: OpenBookEdition): JsonSchema => ({
  type: 'object', additionalProperties: false,
  properties: {
    version: { type: 'string', const: 'maha-machine-book-edition/0.1' },
    offerId: { type: 'string', const: `book-edition-${book.slug}` },
    exampleOnly: { type: 'boolean' },
    book: { type: 'object', additionalProperties: false, properties: {
      id: { type: 'string', const: book.slug }, title: { type: 'string', const: book.title }, subtitle: { type: 'string', const: book.subtitle },
      author: { type: 'string', const: 'Mayone Maha Rajan' }, publicEditionUrl: { type: 'string' }, sectionCount: { type: 'integer', const: book.sections.length },
    }, required: ['id', 'title', 'subtitle', 'author', 'publicEditionUrl', 'sectionCount'] },
    edition: { type: 'object', additionalProperties: false, properties: {
      mediaType: { type: 'string', const: 'text/markdown; charset=utf-8' }, utf8Bytes: { type: 'integer', minimum: 1 }, wordCount: { type: 'integer', minimum: 1 },
      editionSha256: { type: 'string', pattern: SHA }, sections: { type: 'array', minItems: 1, items: manifestItemSchema }, content: { type: 'string', minLength: 1 },
    }, required: ['mediaType', 'utf8Bytes', 'wordCount', 'editionSha256', 'sections', 'content'] },
    license: { type: 'object', additionalProperties: false, properties: {
      grant: { type: 'string' }, redistributionAllowed: { type: 'boolean', const: false }, resaleAllowed: { type: 'boolean', const: false },
      modelTrainingRightsGranted: { type: 'boolean', const: false }, copyrightTransferred: { type: 'boolean', const: false },
    }, required: ['grant', 'redistributionAllowed', 'resaleAllowed', 'modelTrainingRightsGranted', 'copyrightTransferred'] },
    boundaries: { type: 'object', additionalProperties: false, properties: {
      publicWebEditionRemainsFree: { type: 'boolean', const: true }, purchaseUnit: { type: 'string' }, editorialAnalysisIncluded: { type: 'boolean', const: false },
      factualCertificationIncluded: { type: 'boolean', const: false }, recommendationIncluded: { type: 'boolean', const: false }, note: { type: 'string' },
    }, required: ['publicWebEditionRemainsFree', 'purchaseUnit', 'editorialAnalysisIncluded', 'factualCertificationIncluded', 'recommendationIncluded', 'note'] },
    receipt: { type: 'object', additionalProperties: false, properties: {
      version: { type: 'string', const: 'maha-machine-book-receipt/0.1' }, requestSha256: { type: 'string', pattern: SHA }, contentSha256: { type: 'string', pattern: SHA },
      manifestSha256: { type: 'string', pattern: SHA }, responseSha256: { type: 'string', pattern: SHA }, canonicalization: { type: 'string' }, receiptSha256: { type: 'string', pattern: SHA },
    }, required: ['version', 'requestSha256', 'contentSha256', 'manifestSha256', 'responseSha256', 'canonicalization', 'receiptSha256'] },
  },
  required: ['version', 'offerId', 'exampleOnly', 'book', 'edition', 'license', 'boundaries', 'receipt'],
})

function discoveryExample(book: OpenBookEdition) {
  const placeholder = '# Complete edition content is returned after payment.'
  const sections = [{ index: 0, id: 'example', title: 'Compact discovery example', utf8Bytes: Buffer.byteLength(placeholder), wordCount: countWords(placeholder), contentSha256: digest(placeholder) }]
  const responseWithoutReceipt = {
    version: 'maha-machine-book-edition/0.1', offerId: `book-edition-${book.slug}`, exampleOnly: true,
    book: { id: book.slug, title: book.title, subtitle: book.subtitle, author: 'Mayone Maha Rajan', publicEditionUrl: `${SITE_URL}/books/${book.slug}`, sectionCount: book.sections.length },
    edition: { mediaType: 'text/markdown; charset=utf-8', utf8Bytes: Buffer.byteLength(placeholder), wordCount: countWords(placeholder), editionSha256: digest(placeholder), sections, content: placeholder },
    license: { grant: 'Non-exclusive personal or internal machine-readable use by the purchaser.', redistributionAllowed: false, resaleAllowed: false, modelTrainingRightsGranted: false, copyrightTransferred: false },
    boundaries: { publicWebEditionRemainsFree: true, purchaseUnit: 'one complete deterministic machine-readable edition retrieval', editorialAnalysisIncluded: false, factualCertificationIncluded: false, recommendationIncluded: false, note: 'This compact discovery example omits the actual book. A paid success response carries the complete edition and complete ordered section manifest.' },
  }
  const request = { bookId: book.slug, format: 'text/markdown; charset=utf-8' }
  const receiptPreimage = { version: 'maha-machine-book-receipt/0.1', requestSha256: digest(canonicalJson(request)), contentSha256: responseWithoutReceipt.edition.editionSha256, manifestSha256: digest(canonicalJson(sections)), responseSha256: digest(canonicalJson(responseWithoutReceipt)) }
  return { ...responseWithoutReceipt, receipt: { ...receiptPreimage, canonicalization: 'sorted-key canonical JSON with NFC-normalized strings', receiptSha256: digest(canonicalJson(receiptPreimage)) } }
}

export function bookEditionDiscovery(bookId: MachineBookId): OfferDiscoveryContract {
  const book = getOpenBookEdition(bookId)
  if (!book) throw new Error(`Unknown machine book ${bookId}.`)
  return { input: {}, inputSchema, output: discoveryExample(book), outputSchema: outputSchema(book) }
}
