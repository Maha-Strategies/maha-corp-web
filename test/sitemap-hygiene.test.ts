import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const sitemapSourceUrl = new URL('../app/sitemap.ts', import.meta.url)

test('the sitemap only publishes defensible freshness signals', async () => {
  const source = await readFile(sitemapSourceUrl, 'utf8')

  assert.doesNotMatch(source, /lastModified:\s*new Date\(\)/)
  assert.doesNotMatch(source, /\bchangeFrequency:/)
  assert.doesNotMatch(source, /\bpriority:/)

  assert.match(source, /lastModified:\s*new Date\('\d{4}-\d{2}-\d{2}'\)/)
  assert.match(source, /lastModified:\s*new Date\(publication\.updated_at\)/)
})
