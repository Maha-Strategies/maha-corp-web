import type { Metadata } from 'next'
import Link from 'next/link'
import BookEndpointCTA from '@/components/BookEndpointCTA'
import MarkdownArticle from '@/components/MarkdownArticle'
import { parseMarkdownBlocks, readBookMarkdown } from '@/lib/content'
import { MAHA_ORGANIZATION_ID } from '@/lib/entity'

const SITE_URL = 'https://www.mahastrategies.com'

export const metadata: Metadata = {
  title: 'The Imagined Life | Maha Strategies',
  description:
    'An open web edition of The Imagined Life: living inside a dreaming brain, and learning to steer the faculty of the possible.',
  alternates: { canonical: '/books/the-imagined-life' },
  openGraph: {
    type: 'article',
    url: `${SITE_URL}/books/the-imagined-life`,
    title: 'The Imagined Life',
    description: 'Living inside a dreaming brain, and learning to steer the faculty of the possible.',
    images: [{ url: '/og-master.png', width: 1200, height: 630, alt: 'The Imagined Life — Maha Strategies' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'The Imagined Life',
    description: 'Living inside a dreaming brain, and learning to steer the faculty of the possible.',
    images: ['/og-master.png'],
    creator: '@mayonemaha',
  },
}

const bookJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Book',
  '@id': `${SITE_URL}/books/the-imagined-life#book`,
  name: 'The Imagined Life',
  alternativeHeadline: 'Living Inside a Dreaming Brain',
  description: 'A book about dreaming, imagination, and the work of turning a possible future into an actual one.',
  url: `${SITE_URL}/books/the-imagined-life`,
  author: { '@type': 'Person', name: 'Mayone Maha Rajan' },
  publisher: { '@id': MAHA_ORGANIZATION_ID },
  bookFormat: 'https://schema.org/EBook',
  isAccessibleForFree: true,
  inLanguage: 'en',
  datePublished: '2026-07-16',
  potentialAction: { '@type': 'ReadAction', target: `${SITE_URL}/books/the-imagined-life` },
}

export default function TheImaginedLifeHub() {
  // Read at build time (static route) via the path-safe reader; the leading H1
  // is skipped because the page header already renders the title.
  const blocks = parseMarkdownBlocks(readBookMarkdown('the-imagined-life') ?? '', { skipFirstH1: true })
  return (
    <main className="evidence-page">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(bookJsonLd) }} />
      <article className="evidence-container evidence-container--narrow">
        <header className="max-w-3xl border-l border-indigo-500 pl-6 sm:pl-8">
          <p className="font-mono text-xs text-[var(--status-sourced)] tracking-widest uppercase mb-5">
            [ Maha Strategies // Open Edition ]
          </p>
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-light text-[var(--text-primary)] leading-[1.08] tracking-tight mb-5">
            The Imagined Life
          </h1>
          <p className="text-lg sm:text-xl text-[var(--text-secondary)] font-light leading-relaxed mb-3">
            Living Inside a Dreaming Brain
          </p>
          <p className="font-mono text-xs text-[var(--text-muted)] tracking-widest uppercase">
            By Mayone Maha Rajan
          </p>
        </header>

        <section className="mt-16 max-w-3xl">
          <p className="text-xl sm:text-2xl text-[var(--text-primary)] font-light leading-relaxed mb-6">
            Imagination is not a decoration on the mind. It is the faculty that lets us hold a version of the world that does not yet exist—and, through the actions it changes, begin to make it real.
          </p>
          <p className="text-base sm:text-lg text-[var(--text-secondary)] leading-relaxed">
            This book begins with the measurable architecture of sleep and dreaming, crosses the uncertain border between brains and generative machines, and ends with the practical question of how to become a deliberate steward of one&apos;s own imagination.
          </p>
        </section>

        <Link href="/books/the-imagined-life/read" className="mt-10 inline-block bg-white px-7 py-4 font-mono text-xs font-bold uppercase tracking-widest text-black transition-colors hover:bg-zinc-200">Choose a chapter ↗</Link>
        <p className="mt-5 text-sm leading-relaxed text-[var(--text-secondary)]">New to the book? Start with the <Link href="/books/the-imagined-life/sleep-stages-explained" className="text-[var(--status-sourced)] underline underline-offset-4 hover:text-[var(--text-primary)]">plain-English guide to NREM, REM, and sleep stages</Link>.</p>

        <BookEndpointCTA title="The Imagined Life" placement="top" />

        <MarkdownArticle blocks={blocks} />

        <BookEndpointCTA title="The Imagined Life" placement="bottom" />
      </article>
    </main>
  )
}
