import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import test from 'node:test'

import { canonicalJson } from '../lib/evidence-dossier/digest.ts'
import { buildBookSectionReceipt } from '../lib/x402/book-section-product.ts'
import { buildBookEditionReceipt } from '../lib/x402/book-edition-product.ts'
import {
  IMAGINED_LIFE_EDITION_OFFER,
  IMAGINED_LIFE_SECTION_OFFER,
  VOLCANIC_ENGINE_EDITION_OFFER,
  VOLCANIC_ENGINE_SECTION_OFFER,
  offerFor,
} from '../lib/x402/offers.ts'
import { validate } from './helpers/json-schema.ts'

const sha = (value: string) => `sha256:${createHash('sha256').update(value, 'utf8').digest('hex')}`

test('both book offers are exact $0.005 deterministic section resources', () => {
  assert.equal(IMAGINED_LIFE_SECTION_OFFER.amount, '5000')
  assert.equal(VOLCANIC_ENGINE_SECTION_OFFER.amount, '5000')
  assert.equal(offerFor('POST', '/api/v1/books/the-imagined-life/section'), IMAGINED_LIFE_SECTION_OFFER)
  assert.equal(offerFor('POST', '/api/v1/books/the-volcanic-engine/section'), VOLCANIC_ENGINE_SECTION_OFFER)
  assert.equal(offerFor('GET', '/api/v1/books/the-imagined-life/section'), undefined)
})

test('The Imagined Life returns one exact section and a reconstructable receipt', () => {
  const result = buildBookSectionReceipt('the-imagined-life', { sectionId: 'introduction' })
  assert.equal(result.book.title, 'The Imagined Life')
  assert.equal(result.section.id, 'introduction')
  assert.ok(result.section.content.startsWith('# Introduction: The Faculty of the Possible'))
  assert.equal(result.section.contentSha256, sha(result.section.content))
  assert.equal(result.receipt.contentSha256, result.section.contentSha256)
  const receiptPreimage = {
    version: result.receipt.version,
    requestSha256: result.receipt.requestSha256,
    contentSha256: result.receipt.contentSha256,
    responseSha256: result.receipt.responseSha256,
  }
  assert.equal(result.receipt.receiptSha256, sha(canonicalJson(receiptPreimage)))
})

test('The Volcanic Engine split-file edition returns the selected chapter only', () => {
  const result = buildBookSectionReceipt('the-volcanic-engine', { sectionId: 'the-rock-that-flows' })
  assert.equal(result.book.title, 'The Volcanic Engine')
  assert.match(result.section.content, /^# Chapter 1: The Rock That Flows/)
  assert.doesNotMatch(result.section.content, /# Chapter 2: The Physics of the Cork/)
})

test('published examples validate and tampering changes the content commitment', () => {
  for (const offer of [IMAGINED_LIFE_SECTION_OFFER, VOLCANIC_ENGINE_SECTION_OFFER]) {
    assert.deepEqual(validate(offer.discovery.input, offer.discovery.inputSchema), [])
    assert.deepEqual(validate(offer.discovery.output, offer.discovery.outputSchema), [])
  }
  const result = buildBookSectionReceipt('the-imagined-life', { sectionId: 'introduction' })
  assert.notEqual(sha(`${result.section.content}tampered`), result.section.contentSha256)
})

test('discovery exposes the complete section catalog before payment', () => {
  const imagined = IMAGINED_LIFE_SECTION_OFFER.discovery.inputSchema.properties as Record<string, { enum: string[] }>
  const volcanic = VOLCANIC_ENGINE_SECTION_OFFER.discovery.inputSchema.properties as Record<string, { enum: string[] }>
  assert.equal(imagined.sectionId.enum.length, 14)
  assert.equal(volcanic.sectionId.enum.length, 17)
  assert.ok(imagined.sectionId.enum.includes('future-of-dreaming'))
  assert.ok(volcanic.sectionId.enum.includes('the-caldera-problem'))
})

test('unknown books, sections and fields fail closed', () => {
  assert.throws(() => buildBookSectionReceipt('the-imagined-life', { sectionId: 'missing' }), /Unknown sectionId/)
  assert.throws(() => buildBookSectionReceipt('the-imagined-life', { sectionId: 'introduction', extra: true }), /Only sectionId/)
})

test('both complete-edition offers are exact $2.99 resources beside the section offers', () => {
  assert.equal(IMAGINED_LIFE_EDITION_OFFER.amount, '2990000')
  assert.equal(VOLCANIC_ENGINE_EDITION_OFFER.amount, '2990000')
  assert.equal(offerFor('POST', '/api/v1/books/the-imagined-life/edition'), IMAGINED_LIFE_EDITION_OFFER)
  assert.equal(offerFor('POST', '/api/v1/books/the-volcanic-engine/edition'), VOLCANIC_ENGINE_EDITION_OFFER)
  assert.equal(offerFor('GET', '/api/v1/books/the-volcanic-engine/edition'), undefined)
})

test('complete editions carry all content, ordered section commitments and reconstructable receipts', () => {
  for (const [bookId, expectedCount] of [['the-imagined-life', 14], ['the-volcanic-engine', 17]] as const) {
    const result = buildBookEditionReceipt(bookId, {})
    assert.equal(result.exampleOnly, false)
    assert.equal(result.edition.sections.length, expectedCount)
    assert.equal(result.edition.editionSha256, sha(result.edition.content))
    assert.equal(result.receipt.contentSha256, result.edition.editionSha256)
    assert.equal(result.receipt.manifestSha256, sha(canonicalJson(result.edition.sections)))
    const receiptPreimage = {
      version: result.receipt.version,
      requestSha256: result.receipt.requestSha256,
      contentSha256: result.receipt.contentSha256,
      manifestSha256: result.receipt.manifestSha256,
      responseSha256: result.receipt.responseSha256,
    }
    assert.equal(result.receipt.receiptSha256, sha(canonicalJson(receiptPreimage)))
    assert.equal(result.license.copyrightTransferred, false)
    assert.equal(result.license.modelTrainingRightsGranted, false)
  }
})

test('complete-edition discovery examples stay compact and validate without publishing the book in a payment header', () => {
  for (const offer of [IMAGINED_LIFE_EDITION_OFFER, VOLCANIC_ENGINE_EDITION_OFFER]) {
    assert.deepEqual(validate(offer.discovery.input, offer.discovery.inputSchema), [])
    assert.deepEqual(validate(offer.discovery.output, offer.discovery.outputSchema), [])
    assert.equal(offer.discovery.output.exampleOnly, true)
    assert.ok(JSON.stringify(offer.discovery.output).length < 5000)
  }
})

test('complete-edition requests reject every caller-supplied field', () => {
  assert.throws(() => buildBookEditionReceipt('the-imagined-life', { format: 'pdf' }), /no request parameters/)
  assert.throws(() => buildBookEditionReceipt('the-volcanic-engine', null), /empty JSON object/)
})
