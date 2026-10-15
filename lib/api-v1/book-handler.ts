import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import type { z } from 'zod'
import { BOOK_INPUT, BOOK_OUTPUT, bookMetadata } from './book-catalogue.ts'
import { demandDigest } from '../x402/demand6/digest.ts'
export async function executeBookSection(id: string, supplied: unknown) {
  const input = BOOK_INPUT.parse(supplied), m = bookMetadata(id)
  if (!m || input.editionDigest !== m.editionDigest) throw Error('edition_changed_refresh_metadata_before_purchase')
  // Private, separately authorized book sources must not be statically bundled
  // into a release that withholds every book product. Metadata is allowlisted.
  if (!/^the-[a-z-]+$/.test(m.bookId)) throw Error('invalid_book_identity')
  const data = JSON.parse(await readFile(resolve('content/api-v1-books', m.bookId + '.json'), 'utf8')) as {
    editionDigest: string; bookId: string; editionBasis: string; sections: z.infer<typeof BOOK_OUTPUT>['section'][] }
  if (data.editionDigest !== input.editionDigest || data.bookId !== m.bookId) throw Error('book_snapshot_identity_mismatch')
  const section = data.sections.find(s => s.id === input.sectionId)
  const pinned = m.sections.find(s => s.id === input.sectionId)
  if (!section || section.contentSha256 !== 'sha256:' + createHash('sha256').update(section.content).digest('hex')
    || Buffer.byteLength(section.content) !== section.utf8Bytes || !pinned
    || Object.entries(pinned).some(([key, value]) => section[key as keyof typeof section] !== value)) throw Error('section_missing_or_integrity_mismatch')
  return BOOK_OUTPUT.parse({ version: 'maha-book-reading-unit/1', bookId: m.bookId, title: m.title, editionDigest: m.editionDigest,
    editionBasis: data.editionBasis, inputHash: demandDigest(input), section, mediaType: 'text/plain; charset=utf-8',
    license: 'Personal reading or internal use only. No redistribution, resale, model-training rights or copyright transfer.', imagesOrLayoutIncluded: false, factualCertificationProvided: false })
}
