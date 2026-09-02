import { readFileSync } from 'node:fs'
import { resolve, sep } from 'node:path'

import { isKnownBook, type BookId } from './books.ts'

// Master markdown lives at content/books/<slug>/<slug>.md. Only the slug (already
// validated against the catalog) ever enters the path, and the resolved path is
// asserted to stay under CONTENT_ROOT — so no request can traverse the tree.
const CONTENT_ROOT = resolve(process.cwd(), 'content', 'books')

export interface BookChunk {
  index: number
  depth: 1 | 2
  heading: string
  anchor: string
  wordCount: number
  content: string
}

export interface BookAst {
  slug: string
  title: string
  chunkCount: number
  chunks: BookChunk[]
}

function masterPath(slug: BookId): string | null {
  const path = resolve(CONTENT_ROOT, slug, `${slug}.md`)
  if (path !== CONTENT_ROOT && !path.startsWith(CONTENT_ROOT + sep)) return null
  return path
}

export function readBookMarkdown(slug: string): string | null {
  if (!isKnownBook(slug)) return null
  const path = masterPath(slug)
  if (!path) return null
  try { return readFileSync(path, 'utf8') } catch { return null }
}

function anchorFor(heading: string): string {
  return heading.toLowerCase().replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-').slice(0, 80) || 'section'
}

function wordCount(text: string): number {
  return text ? text.split(/\s+/).filter(Boolean).length : 0
}

// Splits the flat markdown into ordered chunks at every H1/H2 boundary so a
// client can request a specific logical section instead of the whole book.
export function chunkMarkdown(markdown: string): { title: string; chunks: BookChunk[] } {
  const chunks: BookChunk[] = []
  let current: { depth: 1 | 2; heading: string; body: string[] } | null = null

  const flush = () => {
    if (!current) return
    const content = current.body.join('\n').trim()
    chunks.push({
      index: chunks.length,
      depth: current.depth,
      heading: current.heading,
      anchor: anchorFor(current.heading),
      wordCount: wordCount(content),
      content,
    })
    current = null
  }

  for (const line of markdown.split(/\r?\n/)) {
    const match = /^(#{1,2})\s+(.+?)\s*$/.exec(line)
    if (match) {
      flush()
      current = { depth: match[1].length as 1 | 2, heading: match[2], body: [] }
    } else if (current) {
      current.body.push(line)
    }
  }
  flush()

  const title = chunks.find((chunk) => chunk.depth === 1)?.heading ?? 'Untitled'
  return { title, chunks }
}

export function readBookAst(slug: string): BookAst | null {
  const markdown = readBookMarkdown(slug)
  if (markdown === null) return null
  const { title, chunks } = chunkMarkdown(markdown)
  return { slug, title, chunkCount: chunks.length, chunks }
}

export type MarkdownBlock =
  | { type: 'heading'; level: number; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'list'; items: string[] }
  | { type: 'hr' }

// Block-level parser for server-side rendering the full book as semantic HTML.
// Handles the element vocabulary the manuscripts actually use: ATX headings,
// unordered lists, thematic breaks, and blank-line-separated paragraphs. Inline
// spans (**bold**, *italic*) are left in `text` for the renderer to turn into
// React elements — nothing here emits HTML, so there is no injection surface.
export function parseMarkdownBlocks(markdown: string, options?: { skipFirstH1?: boolean }): MarkdownBlock[] {
  const blocks: MarkdownBlock[] = []
  let paragraph: string[] = []
  let list: string[] = []
  let skippedFirstH1 = false

  const flushParagraph = () => {
    if (paragraph.length) { blocks.push({ type: 'paragraph', text: paragraph.join(' ') }); paragraph = [] }
  }
  const flushList = () => {
    if (list.length) { blocks.push({ type: 'list', items: list.slice() }); list = [] }
  }
  const flush = () => { flushParagraph(); flushList() }

  for (const raw of markdown.split(/\r?\n/)) {
    const line = raw.replace(/\s+$/, '')
    const isPrintPageBreak = /^\\newpage$/.test(line.trim())
    const heading = /^(#{1,6})\s+(.+)$/.exec(line)
    const listItem = /^\s*[-*]\s+(.+)$/.exec(line)
    const isRule = /^(-{3,}|\*{3,}|_{3,})$/.test(line.trim())

    if (isPrintPageBreak) {
      // LaTeX page breaks belong to print/PDF layout and should not become
      // visible paragraphs in the web edition.
      flush()
    } else if (heading) {
      flush()
      const level = heading[1].length
      if (options?.skipFirstH1 && level === 1 && !skippedFirstH1) { skippedFirstH1 = true; continue }
      blocks.push({ type: 'heading', level, text: heading[2].trim() })
    } else if (isRule) {
      flush()
      blocks.push({ type: 'hr' })
    } else if (listItem) {
      flushParagraph()
      list.push(listItem[1].trim())
    } else if (line.trim() === '') {
      flush()
    } else {
      flushList()
      paragraph.push(line.trim())
    }
  }
  flush()
  return blocks
}
