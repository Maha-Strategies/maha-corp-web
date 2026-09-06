import { readFileSync } from 'node:fs'
import { resolve, sep } from 'node:path'

import { isKnownBook, type BookId } from './books.ts'
import { openBookEditions } from './open-book-editions.ts'

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

/**
 * A manuscript filename that may be joined to a book directory.
 *
 * The comment above CONTENT_ROOT promises that only the slug — already checked
 * against the catalog — reaches the filesystem. Reading filenames from the
 * edition data breaks that promise unless each one is checked, so each is: a
 * bare `.md` name with no separator and no traversal, resolving inside the
 * book's own directory. Anything else is dropped rather than sanitised, because
 * a name needing repair is a data error worth noticing, not worth guessing at.
 */
export function manuscriptPath(slug: BookId, filename: string): string | null {
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*\.md$/.test(filename)) return null
  if (filename.includes('..')) return null
  const bookRoot = resolve(CONTENT_ROOT, slug)
  const path = resolve(bookRoot, filename)
  // Redundant with the pattern above, which already rejects separators and
  // dots. Kept as the check that still holds if that pattern is ever loosened,
  // and annotated as redundant because a test cannot distinguish it — removing
  // it changes no behaviour, so it must not be mistaken for the thing doing
  // the work.
  if (!path.startsWith(bookRoot + sep)) return null
  return path
}

/**
 * The manuscript, from whichever shape the book was authored in.
 *
 * Most books have a single master at `<slug>/<slug>.md`. Two do not: The
 * Volcanic Engine is seventeen files and The Borrowed Light fourteen, each
 * named for its chapter. They had no AST at all, and so no paid payload, purely
 * because this function looked for one filename and found nothing.
 *
 * The reading order was never missing — `openBookEditions[slug].manuscriptFiles`
 * has always declared it, correctly sequenced. It simply was not read. So the
 * master file stays the primary path, unchanged for the books that have one,
 * and the declared list is the fallback rather than a rewrite of the working
 * case.
 */
export function readBookMarkdown(slug: string): string | null {
  if (!isKnownBook(slug)) return null

  const master = masterPath(slug)
  if (master) {
    try { return readFileSync(master, 'utf8') } catch { /* fall through to the declared files */ }
  }

  const declared = (openBookEditions as Record<string, { manuscriptFiles?: readonly string[] } | undefined>)[slug]?.manuscriptFiles
  if (!declared || declared.length === 0) return null

  return joinManuscriptFiles(slug, declared)
}

/**
 * Concatenates the declared files, or refuses.
 *
 * A missing or unreadable file returns null rather than a short book. Serving
 * fifteen of seventeen chapters as the paid payload would be worse than serving
 * none, because the chunk count would look plausible and nothing downstream
 * could tell it was incomplete.
 *
 * Exported so that refusal is testable: it is the behaviour the comment claims,
 * and a claim in a comment that no test exercises is a claim nobody checked.
 */
export function joinManuscriptFiles(slug: BookId, filenames: readonly string[]): string | null {
  if (filenames.length === 0) return null
  const parts: string[] = []
  for (const filename of filenames) {
    const path = manuscriptPath(slug, filename)
    if (!path) return null
    try { parts.push(readFileSync(path, 'utf8')) } catch { return null }
  }
  return parts.join('\n\n')
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
