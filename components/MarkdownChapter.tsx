import { readFile } from 'node:fs/promises'
import path from 'node:path'
import Link from 'next/link'
import type { ReactNode } from 'react'
import ArticleTableOfContents from '@/components/ArticleTableOfContents'
import { MAHA_ORGANIZATION_ID, MAYONE_MAHA_RAJAN_ID } from '@/lib/entity'

type MarkdownChapterProps = {
  bookId: string
  bookTitle: string
  bookHref: string
  chapterTitle: string
  chapterDescription: string
  chapterUrl: string
  sourcePath: string
}

function inlineMarkdown(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g).filter(Boolean).map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={index}>{part.slice(2, -2)}</strong>
    }
    if (part.startsWith('*') && part.endsWith('*')) {
      return <em key={index}>{part.slice(1, -1)}</em>
    }
    return part
  })
}

function renderMarkdown(markdown: string): ReactNode[] {
  return markdown
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter((block) => block && block !== '&nbsp;')
    .map((block, index) => {
      if (/^-{3,}$/.test(block)) {
        return <hr key={index} className="my-10 border-[var(--border-default)]" />
      }

      const heading = block.match(/^(#{1,3})\s+(.+)$/)
      if (heading) {
        const level = index === 0 ? 1 : heading[1].length
        const text = inlineMarkdown(heading[2])
        if (level === 1) return <h1 key={index} className="text-4xl sm:text-5xl font-light text-[var(--text-primary)] leading-[1.1] tracking-tight mt-14 mb-8">{text}</h1>
        if (level === 2) return <h2 key={index} className="text-2xl sm:text-3xl font-light text-[var(--text-primary)] leading-tight mt-14 mb-6">{text}</h2>
        return <h3 key={index} className="text-lg sm:text-xl text-[var(--text-primary)] leading-tight mt-10 mb-5">{text}</h3>
      }

      return <p key={index}>{inlineMarkdown(block.replace(/\n/g, ' '))}</p>
    })
}

export default async function MarkdownChapter({
  bookId,
  bookTitle,
  bookHref,
  chapterTitle,
  chapterDescription,
  chapterUrl,
  sourcePath,
}: MarkdownChapterProps) {
  const markdown = await readFile(path.join(process.cwd(), 'content', sourcePath), 'utf8')
  const articleJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: chapterTitle,
    description: chapterDescription,
    url: chapterUrl,
    mainEntityOfPage: chapterUrl,
    isPartOf: { '@id': bookId },
    author: { '@id': MAYONE_MAHA_RAJAN_ID },
    publisher: { '@id': MAHA_ORGANIZATION_ID },
    datePublished: '2026-07-16',
    dateModified: '2026-07-16',
    isAccessibleForFree: true,
    inLanguage: 'en',
    articleSection: 'Chapter 1',
  }

  return (
    <main className="evidence-page">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }} />
      <article className="evidence-container evidence-container--narrow">
        <Link href={bookHref} className="inline-block font-mono text-xs text-[var(--status-sourced)] hover:text-[var(--text-primary)] tracking-widest uppercase transition-colors mb-12">
          ← {bookTitle}
        </Link>
        <header className="border-b border-[var(--border-default)] pb-10 mb-12">
          <p className="font-mono text-xs text-[var(--status-sourced)] tracking-widest uppercase mb-5">[ Open edition · Chapter 1 ]</p>
          <p className="text-lg text-[var(--text-secondary)] font-light leading-relaxed">{chapterDescription}</p>
        </header>
        <ArticleTableOfContents contentId="article-content" />
        <div id="article-content" data-article-content className="prose prose-lg max-w-none prose-p:text-[var(--text-secondary)] prose-p:leading-[1.85] prose-p:mb-7 prose-strong:text-[var(--text-primary)] prose-em:text-[var(--text-secondary)]">
          {renderMarkdown(markdown)}
        </div>
        <footer className="mt-16 pt-8 border-t border-[var(--border-default)]">
          <p className="font-mono text-xs text-[var(--text-muted)] tracking-widest uppercase mb-4">[ Continue reading ]</p>
          <Link href={bookHref} className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">Return to the book’s table of contents ↗</Link>
        </footer>
      </article>
    </main>
  )
}
