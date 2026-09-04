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
const operator = /^(?:admin|dashboard|operations|review)\//
const intelligence = /^intelligence\//
const knowledge = /^knowledge\//
const books = /^books\//
const apps = /^apps\//
const docs = /^docs\//
  // Internal, noindex demonstration surfaces. Not part of the public visual system.
  const internal = /^internal\//

test('every route belongs to one declared visual system', () => {
  const groups = { paper: 0, apps: 0, books: 0, docs: 0, knowledge: 0, intelligence: 0, operator: 0, internal: 0 }
  const missingPaperBoundary: string[] = []

  for (const path of pages) {
    const file = routeFile(path)
    if (operator.test(file)) { groups.operator += 1; continue }
    if (internal.test(file)) { groups.internal += 1; continue }
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
    groups.paper + groups.apps + groups.books + groups.docs + groups.knowledge + groups.intelligence + groups.operator + groups.internal,
    pages.length,
  )
  assert.deepEqual(missingPaperBoundary, [])
  // knowledge 48 -> 50: the Māyōṉ source dossier and its dynamic topic route;
  // 50 -> 52: the classical Tamil source cluster and its dynamic topic route.
  // join the Knowledge group and its bounded cyber-light overlay. books 38 -> 41 arrives with the
  // eighth open book. Every other group is unchanged, which is what this
  // assertion is really guarding.
  assert.deepEqual(groups, { paper: 112, apps: 6, books: 41, docs: 1, knowledge: 52, intelligence: 2, operator: 32, internal: 1 })
})

test('Apps, Books, Docs, Knowledge, and Intelligence own bounded cyber-light overlays', () => {
  const appsLayout = readFileSync(new URL('../app/apps/layout.tsx', import.meta.url), 'utf8')
  const booksLayout = readFileSync(new URL('../app/books/layout.tsx', import.meta.url), 'utf8')
  const docsLayout = readFileSync(new URL('../app/docs/layout.tsx', import.meta.url), 'utf8')
  const knowledgeLayout = readFileSync(new URL('../app/knowledge/layout.tsx', import.meta.url), 'utf8')
  const intelligenceLayout = readFileSync(new URL('../app/intelligence/layout.tsx', import.meta.url), 'utf8')
  const reviewerLayout = readFileSync(new URL('../app/review/layout.tsx', import.meta.url), 'utf8')
  const rootLayout = readFileSync(new URL('../app/layout.tsx', import.meta.url), 'utf8')
  const siteTheme = readFileSync(new URL('../lib/site-theme.ts', import.meta.url), 'utf8')

  assert.match(appsLayout, /data-visual-scope="apps"/)
  assert.match(booksLayout, /data-visual-system="cyber-light"/)
  assert.match(docsLayout, /data-visual-scope="docs"/)
  assert.match(knowledgeLayout, /data-visual-system="cyber-light"/)
  assert.match(knowledgeLayout, /data-visual-scope="knowledge"/)
  assert.match(intelligenceLayout, /data-visual-system="cyber-light"/)
  assert.match(intelligenceLayout, /data-visual-scope="intelligence"/)
  assert.match(reviewerLayout, /data-visual-system="cyber-light"/)
  assert.match(reviewerLayout, /data-visual-scope="reviewer"/)
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
