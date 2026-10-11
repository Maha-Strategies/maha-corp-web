import { createHash } from 'node:crypto'
import { objectSchema as o, arraySchema as a, enumSchema as e, textSchema as t, ID_SCHEMA as id, HASH_SCHEMA as hash, type MicroSchema } from './micro-schema.ts'
import { buildLicensedSection, licensedSectionMetadata } from './licensed-book-sections.ts'

const metadata = licensedSectionMetadata('the-maha-principle')
export const BOOK_READING_PACK_ID = 'book-reading-pack-the-maha-principle'
const sections = metadata.sections.map(s => s.id)
export const SPECS = {
  [BOOK_READING_PACK_ID]: {
    amount: '91000', title: 'The Maha Principle — Multi-Section Reading Pack', category: 'books', paidContent: true,
    description: 'Purchase 1-3 complete selected Markdown sections of The Maha Principle in your reading order, pinned to the current edition digest. Maximum combined text 48,000 UTF-8 bytes. Includes per-section and pack integrity hashes; no EPUB/PDF, redistribution, resale, training rights, factual certification or personalized medical advice.',
    inputSchema: o({ dataClass: e('public', 'synthetic'), editionDigest: { ...hash, enum: [metadata.editionDigest] }, sectionIds: a(e(...sections), 1, 3) }),
    sample: { dataClass: 'public', editionDigest: metadata.editionDigest, sectionIds: ['map-of-the-terrain', 'founders-pledge'] },
    resultSchema: o({ bookId: e('the-maha-principle'), editionDigest: hash, readingOrder: a(e(...sections), 1, 3), sections: a(o({ id, title: t(200), content: { type: 'string', minLength: 1, maxLength: 48000 }, contentSha256: hash, utf8Bytes: { type: 'integer', minimum: 1, maximum: 48000 }, wordCount: { type: 'integer', minimum: 1, maximum: 24000 } }), 1, 3), totalTextBytes: { type: 'integer', minimum: 1, maximum: 48000 }, packDigest: hash, license: e(metadata.license), editionBasis: e('repository-markdown/1'), factualCertification: { type: 'boolean', enum: [false] } }),
  },
} as const satisfies Record<string, { amount: string; title: string; description: string; category: string; paidContent: boolean; inputSchema: MicroSchema; sample: Record<string, unknown>; resultSchema: MicroSchema }>

export function buildBookPackExpansion(product: string, input: Record<string, unknown>): Record<string, unknown> | null {
  if (product !== BOOK_READING_PACK_ID) return null
  const selected = input.sectionIds as string[]
  if (new Set(selected).size !== selected.length || input.editionDigest !== metadata.editionDigest) throw new Error('invalid-or-stale-reading-pack')
  const delivered = selected.map(sectionId => buildLicensedSection('the-maha-principle', { sectionId, editionDigest: input.editionDigest }).section)
  const totalTextBytes = delivered.reduce((n, s) => n + s.utf8Bytes, 0)
  if (totalTextBytes > 48000) throw new Error('reading-pack-text-limit')
  const result = { bookId: 'the-maha-principle', editionDigest: metadata.editionDigest, readingOrder: selected, sections: delivered.map(s => ({ id: s.id, title: s.title, content: s.content, contentSha256: s.contentSha256, utf8Bytes: s.utf8Bytes, wordCount: s.wordCount })), totalTextBytes,
    packDigest: 'sha256:' + createHash('sha256').update(JSON.stringify(delivered.map(s => [s.id, s.contentSha256]))).digest('hex'), license: metadata.license, editionBasis: 'repository-markdown/1', factualCertification: false }
  return result
}
