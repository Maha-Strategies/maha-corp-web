import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { join, relative } from 'node:path'
import test from 'node:test'

const appRoot = new URL('../app', import.meta.url).pathname

function pageFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) return pageFiles(path)
    return entry.name === 'page.tsx' ? [path] : []
  })
}

function routeFile(path: string): string {
  return relative(appRoot, path).replaceAll('\\', '/')
}

const pages = pageFiles(appRoot)
const operator = /^(?:admin|dashboard|operations)\//
const intelligence = /^intelligence\//
const knowledge = /^knowledge\//
const books = /^books\//
const apps = /^apps\//
const docs = /^docs\//

test('every route belongs to one declared visual system', () => {
  const groups = { paper: 0, apps: 0, books: 0, docs: 0, knowledge: 0, intelligence: 0, operator: 0 }
  const missingPaperBoundary: string[] = []

  for (const path of pages) {
    const file = routeFile(path)
    if (operator.test(file)) { groups.operator += 1; continue }
    if (intelligence.test(file)) { groups.intelligence += 1; continue }
    if (knowledge.test(file)) { groups.knowledge += 1; continue }
    if (books.test(file)) { groups.books += 1; continue }
    if (apps.test(file)) { groups.apps += 1; continue }
    if (docs.test(file)) { groups.docs += 1; continue }

    groups.paper += 1
    const source = readFileSync(path, 'utf8')
    const ownsBoundary = source.includes('evidence-page')
    const delegatesBoundary = /<(?:ResearchBriefServicePage|EvidenceGuide|ContextCompilerPlayground)\b/.test(source)
    if (!ownsBoundary && !delegatesBoundary) missingPaperBoundary.push(file)
  }

  assert.equal(
    groups.paper + groups.apps + groups.books + groups.docs + groups.knowledge + groups.intelligence + groups.operator,
    pages.length,
  )
  assert.deepEqual(missingPaperBoundary, [])
  assert.deepEqual(groups, { paper: 108, apps: 6, books: 35, docs: 1, knowledge: 42, intelligence: 2, operator: 30 })
})

test('Apps, Books, Docs, Knowledge, and Intelligence own bounded cyber-light overlays', () => {
  const appsLayout = readFileSync(new URL('../app/apps/layout.tsx', import.meta.url), 'utf8')
  const booksLayout = readFileSync(new URL('../app/books/layout.tsx', import.meta.url), 'utf8')
  const docsLayout = readFileSync(new URL('../app/docs/layout.tsx', import.meta.url), 'utf8')
  const knowledgeLayout = readFileSync(new URL('../app/knowledge/layout.tsx', import.meta.url), 'utf8')
  const intelligenceLayout = readFileSync(new URL('../app/intelligence/layout.tsx', import.meta.url), 'utf8')
  const rootLayout = readFileSync(new URL('../app/layout.tsx', import.meta.url), 'utf8')
  const siteTheme = readFileSync(new URL('../lib/site-theme.ts', import.meta.url), 'utf8')

  assert.match(appsLayout, /data-visual-scope="apps"/)
  assert.match(booksLayout, /data-visual-system="cyber-light"/)
  assert.match(docsLayout, /data-visual-scope="docs"/)
  assert.match(knowledgeLayout, /data-visual-system="cyber-light"/)
  assert.match(knowledgeLayout, /data-visual-scope="knowledge"/)
  assert.match(intelligenceLayout, /data-visual-system="cyber-light"/)
  assert.match(intelligenceLayout, /data-visual-scope="intelligence"/)
  assert.doesNotMatch(rootLayout, /cyber-light/)
  assert.doesNotMatch(siteTheme, /cyber-light/)
})

test('dark code panels cannot use paper-text tokens', () => {
  const offenders: string[] = []
  const darkPanelWithPaperText = /bg-\[#141816\][^"\n]*text-\[var\(--text-(?:primary|secondary|muted)\)\]/

  for (const path of pages) {
    const file = routeFile(path)
    if (operator.test(file) || intelligence.test(file) || books.test(file)) continue
    if (darkPanelWithPaperText.test(readFileSync(path, 'utf8'))) offenders.push(file)
  }

  assert.deepEqual(offenders, [])
})

test('the shared strong border token used by interactive controls is defined', () => {
  const globals = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8')
  assert.match(globals, /--border-strong:\s*#[\da-f]{6};/i)
})
