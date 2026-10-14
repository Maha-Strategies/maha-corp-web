import { z } from 'zod'
import { BOOK_INPUT, BOOK_OUTPUT, AUTHORIZED_BOOKS, bookMetadata } from './book-catalogue.ts'
import { executeBookSection } from './book-handler.ts'
import { demandDigest } from '../x402/demand6/digest.ts'
import { id, digest, list, object } from './batch4-audit-core.ts'
import type { HandlerContract } from './types.ts'
export const BOOK_PACK_IDS = ['volcano-concept-evidence-pack', 'cross-book-concept-pack', 'book-reading-pack-the-maha-principle'] as const
export type BookPackId = typeof BOOK_PACK_IDS[number]
const bookId = z.enum(AUTHORIZED_BOOKS.map(([id]) => id) as [string, ...string[]])
const unit = BOOK_INPUT.extend({ bookId, referenceId: id }).strict()
const concept = object({ id, label: z.string().min(1).max(160), referenceIds: list(id, 1, 3) })
const declared = { dataClass: z.enum(['public', 'synthetic']), units: list(unit, 1, 3) }
export const BOOK_PACK_INPUTS = {
  'volcano-concept-evidence-pack': object({ ...declared, concepts: list(concept, 1, 8) }),
  'cross-book-concept-pack': object({ ...declared, concepts: list(concept, 1, 8) }),
  'book-reading-pack-the-maha-principle': object(declared),
}
export const BOOK_PACK_DESCRIPTIONS = {
  'volcano-concept-evidence-pack': 'Deliver up to three current selected-EPUB units of The Volcanic Engine with caller-declared concept references. Exact edition pins; personal/internal reading only; no hazard forecast or factual certification.',
  'cross-book-concept-pack': 'Deliver a bounded current-EPUB reading pack from at least two authorized Maha books with declared cross-book concept links. No third-party text, inferred equivalence, redistribution or training rights.',
  'book-reading-pack-the-maha-principle': 'Deliver up to three distinct selected-EPUB reading units of The Maha Principle in requested order, with exact edition/content hashes. No images, layout, full-book bundle or redistribution/training rights.',
}
export function bookPackHandler(productId: BookPackId, amount: string): HandlerContract {
  const output = object({ version: z.literal('maha-pinned-book-pack/1'), productId: z.literal(productId), inputHash: digest,
    result: object({ sections: list(BOOK_OUTPUT.extend({ referenceId: id }).strict(), 1, 3), concepts: list(concept, 0, 8),
      relationshipBasis: z.literal('caller-declared-reading-links-not-evidence-of-truth'),
      license: z.literal('Personal reading or internal use only. No redistribution, resale, model-training rights or copyright transfer.') }),
    resultHash: digest, chargedAmount: z.literal(amount), limitations: list(z.string().min(1).max(800), 1, 8) }).superRefine((r, ctx) => {
      if (r.resultHash !== demandDigest(r.result)) ctx.addIssue({ code: 'custom', message: 'book_pack_commitment_mismatch' })
    })
  return { input: BOOK_PACK_INPUTS[productId], output, execute: async supplied => {
    const i = BOOK_PACK_INPUTS[productId].parse(supplied)
    const references = new Set(i.units.map(u => u.referenceId)), uniqueUnits = new Set(i.units.map(u => u.bookId + ':' + u.sectionId))
    if (references.size !== i.units.length || uniqueUnits.size !== i.units.length) throw Error('duplicate_book_pack_reference_or_unit')
    if (productId === 'book-reading-pack-the-maha-principle' && i.units.some(u => u.bookId !== 'the-maha-principle')) throw Error('pack_book_scope_mismatch')
    if (productId === 'volcano-concept-evidence-pack' && i.units.some(u => u.bookId !== 'the-volcanic-engine')) throw Error('pack_book_scope_mismatch')
    if (productId === 'cross-book-concept-pack' && new Set(i.units.map(u => u.bookId)).size < 2) throw Error('cross_book_pack_requires_distinct_books')
    const concepts = list(concept, 0, 8).parse('concepts' in i ? i.concepts : [])
    if (new Set(concepts.map(c => c.id)).size !== concepts.length || concepts.some(c => c.referenceIds.some(r => !references.has(r)) || new Set(c.referenceIds).size !== c.referenceIds.length)) throw Error('pack_concept_reference_mismatch')
    if (productId === 'cross-book-concept-pack' && concepts.some(c => new Set(c.referenceIds.map(r => i.units.find(u => u.referenceId === r)!.bookId)).size < 2)) throw Error('cross_book_concept_requires_distinct_book_links')
    // Existing allowlisted loader verifies the current selected EPUB snapshot;
    // no free web edition, arbitrary manuscript path or older Markdown corpus.
    const sections = []
    for (const u of i.units) sections.push({ ...await executeBookSection('book-section-' + u.bookId, { sectionId: u.sectionId, editionDigest: u.editionDigest }), referenceId: u.referenceId })
    const result = { sections, concepts, relationshipBasis: 'caller-declared-reading-links-not-evidence-of-truth' as const,
      license: 'Personal reading or internal use only. No redistribution, resale, model-training rights or copyright transfer.' as const }
    const data = output.parse({ version: 'maha-pinned-book-pack/1', productId, inputHash: demandDigest(i), result, resultHash: demandDigest(result), chargedAmount: amount,
      limitations: ['Exact selected-EPUB units only; source selection and rights still require release review. No images, PDF layout, third-party or excluded manuscript content.',
        'Concept labels and links are caller declarations, not semantic entailment, factual or clinical certification.',
        'Result content is retained for 24 hours and receipt metadata for 90 days. Original deadlines do not extend; no automatic repayment.',
        'Paid pack text must remain private. The source archive and recovery outbox must not be publicly uploaded.'] })
    if (Buffer.byteLength(JSON.stringify(data)) > 65000) throw Error('book_pack_too_large_select_smaller_units_before_payment')
    return data
  } }
}
const pin = (book: string, referenceId: string) => {
  const meta = bookMetadata('book-section-' + book)!
  return { referenceId, bookId: book, sectionId: meta.sections.find(s => s.utf8Bytes < 4000)!.id, editionDigest: meta.editionDigest }
}
export const BOOK_PACK_SAMPLES: Record<BookPackId, Record<string, unknown>> = {
  'volcano-concept-evidence-pack': { dataClass: 'synthetic', units: [pin('the-volcanic-engine', 'volcano')], concepts: [{ id: 'declared-topic', label: 'Declared reading topic', referenceIds: ['volcano'] }] },
  'cross-book-concept-pack': { dataClass: 'synthetic', units: [pin('the-maha-principle', 'principle'), pin('the-orbital-mind', 'orbital')], concepts: [{ id: 'declared-comparison', label: 'Declared authorial comparison', referenceIds: ['principle', 'orbital'] }] },
  'book-reading-pack-the-maha-principle': { dataClass: 'synthetic', units: [pin('the-maha-principle', 'principle')] },
}
