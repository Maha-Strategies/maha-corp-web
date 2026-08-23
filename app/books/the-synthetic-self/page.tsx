import type { Metadata } from 'next'
import Link from 'next/link'
import BookEndpointCTA from '@/components/BookEndpointCTA'
import MarkdownArticle from '@/components/MarkdownArticle'
import { parseMarkdownBlocks, readBookMarkdown } from '@/lib/content'
import { MAHA_ORGANIZATION_ID } from '@/lib/entity'

const SITE_URL = 'https://www.mahastrategies.com'

export const metadata: Metadata = {
  title: 'The Synthetic Self | Maha Strategies',
  description:
    'An open web edition of The Synthetic Self, a book about language models, human judgment, and the record we are teaching machines to reflect.',
  alternates: { canonical: '/books/the-synthetic-self' },
  openGraph: {
    type: 'article',
    url: `${SITE_URL}/books/the-synthetic-self`,
    title: 'The Synthetic Self',
    description:
      'A book about language models, human judgment, and the record we are teaching machines to reflect.',
    images: [{ url: '/og-master.png', width: 1200, height: 630, alt: 'The Synthetic Self — Maha Strategies' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'The Synthetic Self',
    description: 'A book about language models, human judgment, and the record we are teaching machines to reflect.',
    images: ['/og-master.png'],
    creator: '@mayonemaha',
  },
}

const bookJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Book',
  '@id': `${SITE_URL}/books/the-synthetic-self#book`,
  name: 'The Synthetic Self',
  alternativeHeadline: 'Engineering the Soul of the Machine',
  description: 'A book about language models, human judgment, and the record we are teaching machines to reflect.',
  url: `${SITE_URL}/books/the-synthetic-self`,
  author: { '@type': 'Person', name: 'Mayone Maha Rajan' },
  publisher: { '@id': MAHA_ORGANIZATION_ID },
  bookFormat: 'https://schema.org/EBook',
  isAccessibleForFree: true,
  inLanguage: 'en',
  datePublished: '2026-07-16',
  potentialAction: { '@type': 'ReadAction', target: `${SITE_URL}/books/the-synthetic-self` },
}

export default function TheSyntheticSelfHub() {
  // Read at build time (static route) via the path-safe reader; the leading H1
  // is skipped because the page header already renders the title.
  const blocks = parseMarkdownBlocks(readBookMarkdown('the-synthetic-self') ?? '', { skipFirstH1: true })
  return (
    <main className="evidence-page">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(bookJsonLd) }} />
      <article className="evidence-container evidence-container--narrow">
        <header className="max-w-3xl border-l border-indigo-500 pl-6 sm:pl-8">
          <p className="font-mono text-xs text-[var(--status-sourced)] tracking-widest uppercase mb-5">
            [ Maha Strategies // Open Edition ]
          </p>
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-light text-[var(--text-primary)] leading-[1.08] tracking-tight mb-5">
            The Synthetic Self
          </h1>
          <p className="text-lg sm:text-xl text-[var(--text-secondary)] font-light leading-relaxed mb-3">
            Engineering the Soul of the Machine
          </p>
          <p className="font-mono text-xs text-[var(--text-muted)] tracking-widest uppercase">
            By Mayone Maha Rajan
          </p>
        </header>

        <section className="mt-16 max-w-3xl">
          <p className="text-xl sm:text-2xl text-[var(--text-primary)] font-light leading-relaxed mb-6">
            A large language model is not a mind that arrived from elsewhere. It is a compression of the human record—built from what we wrote, and therefore destined to reflect it back.
          </p>
          <p className="text-base sm:text-lg text-[var(--text-secondary)] leading-relaxed">
            This book follows that idea from the machinery of training through energy, hallucination, alignment, work, and responsibility. It is written for curious non-specialists who want the mechanism without the mythology—and the human consequences without the slogans.
          </p>
        </section>

        <Link href="/books/the-synthetic-self/read" className="mt-10 inline-block bg-white px-7 py-4 font-mono text-xs font-bold uppercase tracking-widest text-black transition-colors hover:bg-zinc-200">Choose a chapter ↗</Link>

        <BookEndpointCTA title="The Synthetic Self" placement="top" />

        <MarkdownArticle blocks={blocks} />

        <BookEndpointCTA title="The Synthetic Self" placement="bottom" />
      </article>
    </main>
  )
}
