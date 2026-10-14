import { z } from 'zod'
import snapshot from '../../content/api-v1-books/metadata.json' with { type: 'json' }
/** Owner authorization: nine section services, explicitly excluding The Mayon Paradox.
 * Manuscript/edition pinning and delivery review are separate release gates. */
export const AUTHORIZED_BOOKS = [
  ['the-maha-principle', 'The Maha Principle'], ['the-orbital-mind', 'The Orbital Mind'],
  ['the-imagined-life', 'The Imagined Life'], ['the-volcanic-engine', 'The Volcanic Engine'],
  ['the-synthetic-self', 'The Synthetic Self'], ['the-unfinished-species', 'The Unfinished Species'],
  ['the-cosmic-recursion', 'The Cosmic Recursion'], ['the-borrowed-light', 'The Borrowed Light'],
  ['the-material-floor', 'The Material Floor'],
] as const
export const BOOK_INPUT = z.object({ sectionId: z.string().regex(/^unit-\d{3}-part-\d+$/), editionDigest: z.string().regex(/^sha256:[a-f0-9]{64}$/) }).strict()
const hash = z.string().regex(/^sha256:[a-f0-9]{64}$/)
export const BOOK_OUTPUT = z.object({ version: z.literal('maha-book-reading-unit/1'), bookId: z.enum(AUTHORIZED_BOOKS.map(b => b[0]) as [string, ...string[]]),
  title: z.string().min(1).max(300), editionDigest: hash, editionBasis: z.literal('selected-local-epub/1'),
  inputHash: hash, section: z.object({ id: z.string().regex(/^unit-\d{3}-part-\d+$/), title: z.string().max(300),
    spineIndex: z.number().int().nonnegative(), part: z.number().int().min(1), parts: z.number().int().min(1),
    content: z.string().min(1).max(45000), contentSha256: hash, utf8Bytes: z.number().int().min(1).max(45000) }).strict(),
  mediaType: z.literal('text/plain; charset=utf-8'), license: z.literal('Personal reading or internal use only. No redistribution, resale, model-training rights or copyright transfer.'),
  imagesOrLayoutIncluded: z.literal(false), factualCertificationProvided: z.literal(false) }).strict()
export function bookMetadata(id: string) {
  const slug = id.replace(/^book-section-/, '')
  return snapshot.books.find(b => b.bookId === slug)
}
export const publicBookMetadata = (id: string) => {
  const m = bookMetadata(id)
  return m ? { bookId: m.bookId, title: m.title, editionDigest: m.editionDigest, editionBasis: m.editionBasis, readingUnits: m.sections,
    formatNote: m.formatNote, sourceSelectionReviewRequiredBeforeDeployment: true } : undefined
}
