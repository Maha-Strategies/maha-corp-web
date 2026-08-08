import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const root = new URL('../', import.meta.url)

const guidePaths = [
  'guides/context-compression-vs-conversation-summarization',
  'guides/preserve-citations-reducing-llm-context',
  'guides/crewai-context-compression-provenance',
  'guides/mcp-gateway-vs-direct-server',
] as const

test('search-cluster guides are canonical, evidence-linked, and in the sitemap', async () => {
  const sitemap = await readFile(new URL('app/sitemap.ts', root), 'utf8')
  for (const route of guidePaths) {
    const page = await readFile(new URL(`app/${route}/page.tsx`, root), 'utf8')
    assert.match(page, new RegExp(`canonical: path`))
    assert.match(sitemap, new RegExp(route.replaceAll('/', '\\/')))
  }
})

test('context cluster states the generative-summary comparison boundary', async () => {
  const page = await readFile(new URL('app/guides/context-compression-vs-conversation-summarization/page.tsx', root), 'utf8')
  assert.match(page, /does <strong[^>]*>not<\/strong> assign a score to LLM or LangChain summaries/)
  assert.match(page, /not a claim that BM25 beats every generative summary/)
  assert.match(page, /measurement\.results/)
})

test('pillar pages link into both search clusters', async () => {
  const [context, gateway, developers] = await Promise.all([
    readFile(new URL('app/context-compiler/page.tsx', root), 'utf8'),
    readFile(new URL('app/enterprise-mcp-gateway/page.tsx', root), 'utf8'),
    readFile(new URL('app/developers/page.tsx', root), 'utf8'),
  ])
  assert.match(context, /guides\/preserve-citations-reducing-llm-context/)
  assert.match(gateway, /guides\/mcp-gateway-vs-direct-server/)
  for (const route of guidePaths) assert.match(developers, new RegExp(route.replaceAll('/', '\\/')))
})
