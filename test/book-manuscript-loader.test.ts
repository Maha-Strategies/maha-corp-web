import assert from 'node:assert/strict'
import { test } from 'node:test'

import { BOOKS } from '../lib/books.ts'
import { joinManuscriptFiles, manuscriptPath, readBookAst, readBookMarkdown } from '../lib/content.ts'
import { openBookEditions } from '../lib/open-book-editions.ts'

test('books with a single master file are unchanged', () => {
  // The fix must not disturb the three books that already had a payload.
  for (const [slug, chunks] of [['the-imagined-life', 100], ['the-synthetic-self', 107], ['the-orbital-mind', 167]] as const) {
    assert.equal(readBookAst(slug)?.chunkCount, chunks, `${slug} changed`)
  }
})

test('a filename that escapes the book directory is refused', () => {
  // The invariant above CONTENT_ROOT is that only a catalog-checked slug reaches
  // the filesystem. Reading names from edition data breaks that unless each is
  // checked, so each is.
  const slug = 'the-imagined-life' as keyof typeof BOOKS
  for (const bad of ['../secrets.md', 'a/../../etc/passwd.md', 'sub/dir.md', '../../.env.md']) {
    assert.equal(manuscriptPath(slug, bad), null, `${bad} was not refused`)
  }
})

test('a filename that is not a plain markdown file is refused', () => {
  const slug = 'the-imagined-life' as keyof typeof BOOKS
  for (const bad of ['.env', 'notes.txt', '', '.hidden.md', 'file.md.exe']) {
    assert.equal(manuscriptPath(slug, bad), null, `${bad} was not refused`)
  }
})

test('a well-formed manuscript filename resolves inside its own book', () => {
  const path = manuscriptPath('the-imagined-life' as keyof typeof BOOKS, 'The-Volcanic-Engine-Chapter-1.md')
  assert.ok(path?.endsWith('/content/books/the-imagined-life/The-Volcanic-Engine-Chapter-1.md'),
    'a valid name must resolve under the book directory it was asked for')
})

test('the declared reading order is the one on disk', () => {
  // The order was never missing; it simply was not read. If a manuscript file
  // named in the edition data does not exist, the loader must not quietly serve
  // a shorter book.
  for (const slug of ['the-volcanic-engine', 'the-borrowed-light'] as const) {
    const declared = openBookEditions[slug].manuscriptFiles
    assert.ok(declared.length > 1, `${slug} should be a multi-file manuscript`)
    for (const filename of declared) {
      assert.ok(manuscriptPath('the-imagined-life' as keyof typeof BOOKS, filename),
        `${filename} would be refused by the path check`)
    }
  }
})

test('an unregistered book yields nothing, whatever is on disk', () => {
  // The Volcanic Engine has seventeen manuscript files and is not in BOOKS, so
  // the paid route answers 404 by design rather than leaking its existence.
  // Registering it is a commercial decision and not this fix's to make.
  assert.equal(readBookMarkdown('the-volcanic-engine'), null)
  assert.equal(readBookAst('the-volcanic-engine'), null)
  assert.ok(!('the-volcanic-engine' in BOOKS))
})

test('an incomplete manuscript is refused, not served short', () => {
  // The failure worth preventing: fifteen of seventeen chapters would produce a
  // plausible chunk count that nothing downstream could tell was incomplete.
  const slug = 'the-imagined-life' as keyof typeof BOOKS
  const real = openBookEditions['the-volcanic-engine'].manuscriptFiles
  assert.equal(joinManuscriptFiles(slug, ['does-not-exist.md']), null)
  assert.equal(joinManuscriptFiles(slug, [...real.slice(0, 2), 'missing-chapter.md']), null,
    'one unreadable file must refuse the whole manuscript')
  assert.equal(joinManuscriptFiles(slug, []), null, 'an empty declaration is not an empty book')
})

test('a refused filename refuses the whole manuscript', () => {
  const slug = 'the-imagined-life' as keyof typeof BOOKS
  const real = openBookEditions['the-volcanic-engine'].manuscriptFiles
  assert.equal(joinManuscriptFiles(slug, [real[0], '../escape.md']), null)
})

test('declared files concatenate in the order given', () => {
  const slug = 'the-volcanic-engine' as keyof typeof BOOKS
  const files = openBookEditions['the-volcanic-engine'].manuscriptFiles
  const forward = joinManuscriptFiles(slug, files.slice(0, 3))
  const reversed = joinManuscriptFiles(slug, [...files.slice(0, 3)].reverse())
  assert.ok(forward && reversed)
  assert.equal(forward.length, reversed.length, 'same files, same bytes')
  assert.notEqual(forward, reversed, 'order must be preserved, not sorted')
})
