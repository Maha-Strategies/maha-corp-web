import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import { test } from 'node:test'

import {
  SUBSTANTIAL_BATCH_4_PAGES,
  SUBSTANTIAL_BATCH_4_READINESS,
} from '../lib/substantial-page-publication-batch-4.ts'
import { PUBLIC_SUBSTANTIAL_PAGES } from '../lib/substantial-page-public.ts'

test('Batch 4 refuses to manufacture pages from candidate or stale revisions', () => {
  assert.equal(SUBSTANTIAL_BATCH_4_READINESS.length, 26)
  assert.equal(SUBSTANTIAL_BATCH_4_PAGES.length, 0)
  assert.equal(SUBSTANTIAL_BATCH_4_READINESS.filter((entry) => entry.releaseState === 'prior-release-will-be-stale').length, 2)
  assert.equal(SUBSTANTIAL_BATCH_4_READINESS.filter((entry) => entry.releaseState === 'no-canonical-release').length, 24)
  assert.ok(SUBSTANTIAL_BATCH_4_READINESS.every((entry) => !entry.pageEligible && entry.blockerCodes.length === 4))
})

test('Batch 4 does not alter the 55-page public substantial projection', () => {
  assert.equal(PUBLIC_SUBSTANTIAL_PAGES.length, 55)
  const candidateIds = new Set(SUBSTANTIAL_BATCH_4_READINESS.map((entry) => entry.recordId))
  const overlaps = PUBLIC_SUBSTANTIAL_PAGES.filter((page) => candidateIds.has(page.contract.recordId))
  assert.equal(overlaps.length, 0)
  assert.ok(SUBSTANTIAL_BATCH_4_PAGES.every((page) => !candidateIds.has((page as { contract: { recordId: string } }).contract.recordId)))
})

test('Batch 4 readiness regenerates byte-identically', async () => {
  const run = () => spawnSync(process.execPath, ['--experimental-strip-types', 'scripts/generate-substantial-publication-batch-4.ts'], {
    cwd: process.cwd(), encoding: 'utf8', env: process.env,
  })
  assert.equal(run().status, 0)
  const first = await readFile('content/substantial-pages/publication-batch-4-readiness.json', 'utf8')
  assert.equal(run().status, 0)
  const second = await readFile('content/substantial-pages/publication-batch-4-readiness.json', 'utf8')
  assert.equal(second, first)
  assert.match(first, /"pagesPublished": 0/)
})

test('readiness data never enters sitemap or llms index sources', async () => {
  const sources = await Promise.all([readFile('app/sitemap.ts', 'utf8'), readFile('app/llms.txt/route.ts', 'utf8')])
  assert.doesNotMatch(sources.join('\n'), /publication-batch-4-readiness|full-record-revision-missing/)
})
