import { readFile } from 'node:fs/promises'
import path from 'node:path'
import Link from 'next/link'
import type { ReactNode } from 'react'

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
        return <hr key={index} className="my-10 border-zinc-800" />
      }

      const heading = block.match(/^(#{1,3})\s+(.+)$/)
      if (heading) {
        const level = index === 0 ? 1 : heading[1].length
        const text = inlineMarkdown(heading[2])
        if (level === 1) return <h1 key={index} className="text-4xl sm:text-5xl font-light text-white leading-[1.1] tracking-tight mt-14 mb-8">{text}</h1>
        if (level === 2) return <h2 key={index} className="text-2xl sm:text-3xl font-light text-white leading-tight mt-14 mb-6">{text}</h2>
        return <h3 key={index} className="text-lg sm:text-xl text-zinc-100 leading-tight mt-10 mb-5">{text}</h3>
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
    author: { '@type': 'Person', name: 'Mayone Maha Rajan' },
    publisher: { '@type': 'Organization', name: 'Maha Strategies LLC', url: 'https://www.mahastrategies.com' },
    datePublished: '2026-07-16',
    dateModified: '2026-07-16',
    isAccessibleForFree: true,
    inLanguage: 'en',
    articleSection: 'Chapter 1',
  }

  return (
    <main className="min-h-screen bg-[#0a0a0c] text-zinc-300 selection:bg-indigo-500 selection:text-white">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }} />
      <article className="max-w-3xl mx-auto px-6 py-20 sm:py-28">
        <Link href={bookHref} className="inline-block font-mono text-[10px] text-indigo-400 hover:text-white tracking-widest uppercase transition-colors mb-12">
          ← {bookTitle}
        </Link>
        <header className="border-b border-zinc-800 pb-10 mb-12">
          <p className="font-mono text-[10px] text-indigo-400 tracking-widest uppercase mb-5">[ Open edition · Chapter 1 ]</p>
          <p className="text-lg text-zinc-400 font-light leading-relaxed">{chapterDescription}</p>
        </header>
        <div className="prose prose-invert prose-lg max-w-none prose-p:text-zinc-300 prose-p:leading-[1.85] prose-p:mb-7 prose-strong:text-white prose-em:text-zinc-400">
          {renderMarkdown(markdown)}
        </div>
        <footer className="mt-16 pt-8 border-t border-zinc-800">
          <p className="font-mono text-[10px] text-zinc-600 tracking-widest uppercase mb-4">[ Continue reading ]</p>
          <Link href={bookHref} className="text-zinc-300 hover:text-white transition-colors">Return to the book’s table of contents ↗</Link>
        </footer>
      </article>
    </main>
  )
}
