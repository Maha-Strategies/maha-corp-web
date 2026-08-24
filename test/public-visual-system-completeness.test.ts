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
const darkEditorial = /^intelligence\//
const knowledge = /^knowledge\//
const books = /^books\//

test('every route belongs to one declared visual system', () => {
  const groups = { paper: 0, books: 0, knowledge: 0, darkEditorial: 0, operator: 0 }
  const missingPaperBoundary: string[] = []

  for (const path of pages) {
    const file = routeFile(path)
    if (operator.test(file)) { groups.operator += 1; continue }
    if (darkEditorial.test(file)) { groups.darkEditorial += 1; continue }
    if (knowledge.test(file)) { groups.knowledge += 1; continue }
    if (books.test(file)) { groups.books += 1; continue }

    groups.paper += 1
    const source = readFileSync(path, 'utf8')
    const ownsBoundary = source.includes('evidence-page')
    const delegatesBoundary = /<(?:ResearchBriefServicePage|EvidenceGuide|ContextCompilerPlayground)\b/.test(source)
    if (!ownsBoundary && !delegatesBoundary) missingPaperBoundary.push(file)
  }

  assert.equal(
    groups.paper + groups.books + groups.knowledge + groups.darkEditorial + groups.operator,
    pages.length,
  )
  assert.deepEqual(missingPaperBoundary, [])
  assert.deepEqual(groups, { paper: 115, books: 30, knowledge: 37, darkEditorial: 2, operator: 26 })
})

test('Books and Knowledge own bounded cyber-light overlays', () => {
  const booksLayout = readFileSync(new URL('../app/books/layout.tsx', import.meta.url), 'utf8')
  const knowledgeLayout = readFileSync(new URL('../app/knowledge/layout.tsx', import.meta.url), 'utf8')
  const rootLayout = readFileSync(new URL('../app/layout.tsx', import.meta.url), 'utf8')
  const siteTheme = readFileSync(new URL('../lib/site-theme.ts', import.meta.url), 'utf8')

  assert.match(booksLayout, /data-visual-system="cyber-light"/)
  assert.match(knowledgeLayout, /data-visual-system="cyber-light"/)
  assert.match(knowledgeLayout, /data-visual-scope="knowledge"/)
  assert.doesNotMatch(rootLayout, /cyber-light/)
  assert.doesNotMatch(siteTheme, /cyber-light/)
})

test('dark code panels cannot use paper-text tokens', () => {
  const offenders: string[] = []
  const darkPanelWithPaperText = /bg-\[#141816\][^"\n]*text-\[var\(--text-(?:primary|secondary|muted)\)\]/

  for (const path of pages) {
    const file = routeFile(path)
    if (operator.test(file) || darkEditorial.test(file) || books.test(file)) continue
    if (darkPanelWithPaperText.test(readFileSync(path, 'utf8'))) offenders.push(file)
  }

  assert.deepEqual(offenders, [])
})

test('the shared strong border token used by interactive controls is defined', () => {
  const globals = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8')
  assert.match(globals, /--border-strong:\s*#[\da-f]{6};/i)
})
