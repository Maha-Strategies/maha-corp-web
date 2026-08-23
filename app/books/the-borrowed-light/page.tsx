import type { Metadata } from 'next'
import Link from 'next/link'
import MarkdownArticle from '@/components/MarkdownArticle'
import { parseMarkdownBlocks } from '@/lib/content'
import { MAHA_ORGANIZATION_ID } from '@/lib/entity'
import { openBookEditions, readOpenBookManuscript } from '@/lib/open-book-editions'

const SITE_URL = 'https://www.mahastrategies.com'
const book = openBookEditions['the-borrowed-light']

export const metadata: Metadata = {
  title: 'The Borrowed Light | Maha Strategies',
  description: 'An open web edition of The Borrowed Light: a book about the self, relationship, and the physics of reflected light.',
  alternates: { canonical: '/books/the-borrowed-light' },
  openGraph: {
    type: 'article',
    url: `${SITE_URL}/books/the-borrowed-light`,
    title: 'The Borrowed Light',
    description: 'A book about the self, relationship, and the physics of reflected light.',
    images: [{ url: '/og-master.png', width: 1200, height: 630, alt: 'The Borrowed Light — Maha Strategies' }],
  },
  twitter: { card: 'summary_large_image', title: 'The Borrowed Light', description: 'A book about the self, relationship, and the physics of reflected light.', images: ['/og-master.png'], creator: '@mayonemaha' },
}

const bookJsonLd = {
  '@context': 'https://schema.org', '@type': 'Book', '@id': `${SITE_URL}/books/the-borrowed-light#book`,
  name: 'The Borrowed Light', alternativeHeadline: book.subtitle,
  description: 'A book about the self, relationship, and the physics of reflected light.',
  url: `${SITE_URL}/books/the-borrowed-light`, author: { '@type': 'Person', name: 'Mayone Maha Rajan' },
  publisher: { '@id': MAHA_ORGANIZATION_ID }, bookFormat: 'https://schema.org/EBook', isAccessibleForFree: true,
  inLanguage: 'en', datePublished: '2026-07-28', potentialAction: { '@type': 'ReadAction', target: `${SITE_URL}/books/the-borrowed-light/read` },
}

export default function TheBorrowedLightHub() {
  const blocks = parseMarkdownBlocks(readOpenBookManuscript(book))
  return <main className="evidence-page">
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(bookJsonLd) }} />
    <article className="evidence-container evidence-container--narrow">
      <header className="max-w-3xl border-l border-indigo-500 pl-6 sm:pl-8">
        <p className="font-mono text-xs text-[var(--status-sourced)] tracking-widest uppercase mb-5">[ Maha Strategies // Open Edition ]</p>
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-light text-[var(--text-primary)] leading-[1.08] tracking-tight mb-5">The Borrowed Light</h1>
        <p className="text-lg sm:text-xl text-[var(--text-secondary)] font-light leading-relaxed mb-3">{book.subtitle}</p>
        <p className="font-mono text-xs text-[var(--text-muted)] tracking-widest uppercase">By Mayone Maha Rajan</p>
      </header>
      <section className="mt-16 max-w-3xl">
        <p className="text-xl sm:text-2xl text-[var(--text-primary)] font-light leading-relaxed mb-6">The self can feel entirely private and self-made. This book follows the contrary, more generous possibility: that a person is formed in relationship, borrowing light without becoming any less real.</p>
        <p className="text-base sm:text-lg text-[var(--text-secondary)] leading-relaxed">Across eleven chapters and two appendices, it uses the structures of M-theory as a carefully marked analogy—not as proof—to explore intimacy, belief, commitment, grief, and the conditions under which a life can hold its shape.</p>
      </section>
      <Link href="/books/the-borrowed-light/read" className="mt-10 inline-block bg-white px-7 py-4 font-mono text-xs font-bold uppercase tracking-widest text-black transition-colors hover:bg-zinc-200">Choose a chapter ↗</Link>
      <p className="mt-5 text-sm leading-relaxed text-[var(--text-secondary)]">New to the physics? Start with the <Link href="/books/the-borrowed-light/m-theory-faq" className="text-[var(--status-sourced)] underline underline-offset-4 hover:text-[var(--text-primary)]">plain-English M-theory FAQ</Link>.</p>
      <MarkdownArticle blocks={blocks} />
    </article>
  </main>
}
