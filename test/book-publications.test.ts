import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import test from 'node:test'
import { BOOK_PUBLICATIONS, BOOK_PUBLICATIONS_DATE, buildBookPublications, bookPublicationJsonLd } from '../lib/book-publications.ts'
import { GET } from '../app/books/publications.json/route.ts'
import { buildLlmsManifest } from '../lib/llms-manifest.ts'
import { MAYONE_MAHA_RAJAN_ID } from '../lib/entity.ts'

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const requireFromSdk = createRequire(new URL('../node_modules/@modelcontextprotocol/sdk/package.json', import.meta.url))
const Ajv = requireFromSdk('ajv')
const validator = new Ajv({ allErrors: true, strict: true })
requireFromSdk('ajv-formats')(validator)
const validate = validator.compile(JSON.parse(read('public/schemas/book-publications-1.0.json')))

test('publication catalog validates and rejects private or unsupported fields/statuses', () => {
  const catalog = buildBookPublications()
  assert.equal(validate(catalog), true, JSON.stringify(validate.errors))
  assert.equal(validate({ ...catalog, credentials: 'private' }), false)
  const bad = structuredClone(catalog)
  // A vague submission claim must not become an invented publication state.
  bad.books[2].editions[1].status = 'available_everywhere' as never
  assert.equal(validate(bad), false)
  assert.deepEqual(catalog.books.map((book) => book.title), ['The Maha Principle', 'The Orbital Mind', 'The Imagined Life'])
  assert.equal(new Set(catalog.books.map((book) => book.workId)).size, 3)
  assert.doesNotMatch(JSON.stringify(catalog), /kdp\.amazon|draft2digital\.com\/book\/|\/Users\/|sha256|royalty|Claire/)
})

test('edition identifiers retain their format and paperback submissions remain pending', () => {
  const orbital = BOOK_PUBLICATIONS[1]
  assert.equal(orbital.editions.find((entry) => entry.id === 'amazon-kindle')?.asin, 'B0HMKDMCM9')
  assert.equal(orbital.editions.find((entry) => entry.id === 'amazon-paperback')?.asin, 'B0HMKHJNYK')
  const imagined = BOOK_PUBLICATIONS[2]
  assert.equal(imagined.editions.find((entry) => entry.id === 'amazon-paperback')?.status, 'in_review')
  assert.equal(imagined.editions.find((entry) => entry.id === 'd2d-paperback')?.status, 'preparing_manuscript')
  assert.equal(imagined.editions.find((entry) => entry.id === 'd2d-paperback')?.isbn, undefined)
  for (const book of BOOK_PUBLICATIONS) {
    for (const entry of book.editions) {
      assert.equal(entry.statusAsOf, BOOK_PUBLICATIONS_DATE)
      if (!entry.isbn) continue
      const digits = [...entry.isbn].map(Number)
      assert.equal(digits.reduce((sum, digit, i) => sum + digit * (i % 2 ? 3 : 1), 0) % 10, 0, `Invalid ISBN ${entry.isbn}`)
    }
  }
})

test('JSON-LD distinguishes free web editions, commercial editions, and the work', () => {
  for (const book of BOOK_PUBLICATIONS) {
    const graph = bookPublicationJsonLd(book)['@graph']
    const work = graph[0]
    assert.equal(work['@id'], book.workId)
    assert.deepEqual(work.author, { '@id': MAYONE_MAHA_RAJAN_ID })
    assert.equal('datePublished' in work, false)
    assert.equal('isAccessibleForFree' in work, false)
    const web = graph.find((entry) => entry['@id'].endsWith('-open-web'))
    assert.equal(!!web, !!book.openWebEdition)
    if (web) {
      assert.equal('isAccessibleForFree' in web && web.isAccessibleForFree, true)
      assert.equal('datePublished' in web && web.datePublished, '2026-07-16')
    }
    for (const edition of graph.slice(1).filter((entry) => !entry['@id'].endsWith('-open-web'))) {
      assert.equal('isAccessibleForFree' in edition && edition.isAccessibleForFree, false)
      assert.equal('datePublished' in edition, false, 'Do not invent retail release dates from web dates or submission dates')
      assert.equal('offers' in edition, false, 'Publisher status is not verified retail stock')
    }
  }
})

test('JSON endpoint, discovery manifest, and registry expose the same publication catalog', async () => {
  const response = GET()
  assert.equal(response.status, 200)
  assert.match(response.headers.get('content-type') ?? '', /application\/json/)
  assert.match(response.headers.get('link') ?? '', /describedby/)
  assert.deepEqual(await response.json(), buildBookPublications())
  const llms = buildLlmsManifest([])
  for (const book of BOOK_PUBLICATIONS) assert.ok(llms.includes(`${book.title}: ${book.subtitle}`))
  assert.ok(llms.includes('https://www.mahastrategies.com/books/publications.json'))
  const registry = JSON.parse(read('public/maha-machine-readable-registry.json'))
  assert.equal(registry.resources.find((resource: { id: string }) => resource.id === 'book-publications')?.url, buildBookPublications().url)
})
