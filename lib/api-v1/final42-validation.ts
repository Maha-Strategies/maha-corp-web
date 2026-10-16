import { createHash } from 'node:crypto'
import { demandDigest } from '../x402/demand6/digest.ts'
import { BOOK_INPUT, BOOK_OUTPUT, bookMetadata } from './book-catalogue.ts'
import { BOOK_PACK_IDS } from './batch4-book-packs.ts'
import { handlerFor } from './handlers.ts'
import { calculationDigest, parseCalculationInput } from '../x402/celestial-products.ts'
import type { Endpoint } from './types.ts'
import { assertFrozenDelivery } from './frozen-delivery.ts'

export const isPaidReadingProduct = (id: string) => !!bookMetadata(id) || BOOK_PACK_IDS.some(p => p === id)
function assertReadingUnit(value: unknown, input: unknown, bookId: string) {
  const v = BOOK_OUTPUT.parse(value), i = BOOK_INPUT.parse(input), meta = bookMetadata(bookId)!
  const pin = meta.sections.find(s => s.id === i.sectionId)
  if (!pin || v.bookId !== meta.bookId || v.title !== meta.title || v.editionDigest !== meta.editionDigest
    || v.editionDigest !== i.editionDigest || v.inputHash !== demandDigest(i)
    || Object.entries(pin).some(([key, expected]) => v.section[key as keyof typeof v.section] !== expected)
    || v.section.contentSha256 !== 'sha256:' + createHash('sha256').update(v.section.content).digest('hex')
    || v.section.utf8Bytes !== Buffer.byteLength(v.section.content)) throw Error('paid_reading_unit_not_pinned')
}
/** Dynamic source observations need integrity+input checks, not equality with a
 * historical mock response. Paid books are never published as free examples. */
export function validateFinal42Delivery(e: Endpoint, input: unknown, actual: unknown, example: unknown) {
  const h = handlerFor(e.id, e.amount)!, normalized = h.input.parse(input), parsed = h.output.parse(actual)
  const v = parsed as Record<string, unknown>
  if ('inputHash' in v && v.inputHash !== demandDigest(normalized)) throw Error('final42_input_binding_mismatch')
  if ('resultHash' in v && v.resultHash !== demandDigest(v.result)) throw Error('final42_result_hash_mismatch')
  if (bookMetadata(e.id)) assertReadingUnit(parsed, normalized, e.id)
  else if (BOOK_PACK_IDS.some(p => p === e.id)) {
    const units = (normalized as { units: { bookId: string; referenceId: string; sectionId: string; editionDigest: string }[] }).units
    const sections = (v.result as { sections: ({ referenceId: string } & Record<string, unknown>)[] }).sections
    if (sections.length !== units.length) throw Error('book_pack_count_mismatch')
    for (let n = 0; n < units.length; n++) {
      const { referenceId, ...section } = sections[n], unit = units[n]
      if (referenceId !== unit.referenceId) throw Error('book_pack_order_mismatch')
      assertReadingUnit(section, { sectionId: unit.sectionId, editionDigest: unit.editionDigest }, 'book-section-' + unit.bookId)
    }
  } else if (e.execution_cost?.mode === 'external-source-read' || e.id === 'x402-quote-change-report') {
    if ('receiptDigest' in v && v.receiptDigest !== demandDigest({ version: v.version, productId: v.productId,
      inputHash: v.inputHash, resultHash: v.resultHash })) throw Error('source_receipt_commitment_mismatch')
  } else if (e.id === 'celestial-vimshottari-timing') {
    const { receiptDigest, ...payload } = v.result as Record<string, unknown>
    const request = (normalized as { request: unknown }).request
    if (receiptDigest !== calculationDigest(payload) || payload.inputDigest !== calculationDigest(parseCalculationInput(e.id, request))) throw Error('timing_receipt_commitment_mismatch')
  } else assertFrozenDelivery(e.id, parsed, example)
  return parsed
}
