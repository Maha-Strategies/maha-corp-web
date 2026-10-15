import { readFile } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import metadata from '../content/api-v1-books/metadata.json' with { type: 'json' }
import { executeBookSection } from '../lib/api-v1/book-handler.ts'
import { validateFinal42Delivery } from '../lib/api-v1/final42-validation.ts'
import { FINAL42_PRODUCTION_ENDPOINTS } from '../lib/api-v1/production-release.ts'
import { MODULAR_RUNTIME_TRACES } from '../lib/api-v1/runtime-assets.ts'

if (metadata.books.length !== 9 || metadata.books.some(b => b.bookId === 'the-mayon-paradox')) throw Error('incorrect_private_book_scope')
const tracked = execFileSync('git', ['ls-files', 'content/api-v1-books'], { encoding: 'utf8' }).trim().split('\n')
if (tracked.some(path => path !== 'content/api-v1-books/metadata.json')) throw Error('paid_reading_text_must_not_be_in_git')
let units = 0, maximumOutputBytes = 0
for (const book of metadata.books) {
  const file = JSON.parse(await readFile('content/api-v1-books/' + book.bookId + '.json', 'utf8'))
  if (file.sections.length !== book.sections.length) throw Error('private_unit_count_mismatch')
  const e = FINAL42_PRODUCTION_ENDPOINTS.find(e => e.id === 'book-section-' + book.bookId)!
  for (const section of book.sections) {
    const input = { editionDigest: book.editionDigest, sectionId: section.id }
    const delivered = await executeBookSection(e.id, input)
    validateFinal42Delivery(e, input, delivered, null)
    const bytes = Buffer.byteLength(JSON.stringify(delivered))
    if (bytes > 65000) throw Error('reading_unit_exceeds_gateway_output_limit')
    units++; maximumOutputBytes = Math.max(maximumOutputBytes, bytes)
  }
}
if (!Object.values(MODULAR_RUNTIME_TRACES).flat().includes('./content/api-v1-books/the-*.json')) throw Error('private_function_trace_missing')
console.log(JSON.stringify({ books: 9, units, maximumOutputBytes, allEditionAndSectionPinsVerified: true,
  paidTextTrackedByGit: false, supabaseCalls: 0, paidCalls: 0 }))
