import type { Metadata } from 'next'
import Link from 'next/link'
import MarkdownArticle from '@/components/MarkdownArticle'
import { parseMarkdownBlocks } from '@/lib/content'
import { MAHA_ORGANIZATION_ID } from '@/lib/entity'
import { openBookEditions, readOpenBookManuscript } from '@/lib/open-book-editions'

const SITE_URL = 'https://www.mahastrategies.com'
const book = openBookEditions['the-cosmic-recursion']

export const metadata: Metadata = {
  title: 'The Cosmic Recursion | Maha Strategies',
  description: 'An open web edition of The Cosmic Recursion: What Survives the Compression, by Mayone Maha Rajan.',
  alternates: { canonical: '/books/the-cosmic-recursion' },
  openGraph: {
    type: 'book',
    url: `${SITE_URL}/books/the-cosmic-recursion`,
    title: 'The Cosmic Recursion',
    description: 'What survives when every physical system must compress, discard, and pay to remember.',
    images: [{ url: '/og-master.png', width: 1200, height: 630, alt: 'The Cosmic Recursion — Maha Strategies' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'The Cosmic Recursion',
    description: 'What survives when every physical system must compress, discard, and pay to remember.',
    images: ['/og-master.png'],
    creator: '@mayonemaha',
  },
}

const bookJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Book',
  '@id': `${SITE_URL}/books/the-cosmic-recursion#book`,
  name: book.title,
  alternativeHeadline: book.subtitle,
  description: 'A book about information, erasure, physical limits, cosmic structure, and the disciplined losses through which anything persists.',
  url: `${SITE_URL}/books/the-cosmic-recursion`,
  author: { '@type': 'Person', name: 'Mayone Maha Rajan' },
  publisher: { '@id': MAHA_ORGANIZATION_ID },
  bookFormat: 'https://schema.org/EBook',
  isAccessibleForFree: true,
  inLanguage: 'en',
  datePublished: '2026-09-02',
  potentialAction: { '@type': 'ReadAction', target: `${SITE_URL}/books/the-cosmic-recursion/read` },
}

export default function TheCosmicRecursionHub() {
  const blocks = parseMarkdownBlocks(readOpenBookManuscript(book), { skipFirstH1: true })

  return (
    <main className="evidence-page">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(bookJsonLd).replace(/</g, '\\u003c') }} />
      <article className="evidence-container evidence-container--narrow">
        <Link href="/books" className="evidence-link inline-block font-mono text-xs uppercase tracking-widest">← All books</Link>
        <header className="mt-12 max-w-3xl border-l border-indigo-500 pl-6 sm:pl-8">
          <p className="mb-5 font-mono text-xs uppercase tracking-widest text-[var(--status-sourced)]">[ Maha Strategies // Open Edition ]</p>
          <h1 className="mb-5 text-4xl font-light leading-[1.08] tracking-tight text-[var(--text-primary)] sm:text-5xl md:text-6xl">{book.title}</h1>
          <p className="mb-3 text-lg font-light leading-relaxed text-[var(--text-secondary)] sm:text-xl">{book.subtitle}</p>
          <p className="font-mono text-xs uppercase tracking-widest text-[var(--text-muted)]">By Mayone Maha Rajan</p>
        </header>

        <section className="mt-16 max-w-3xl">
          <p className="mb-6 text-xl font-light leading-relaxed text-[var(--text-primary)] sm:text-2xl">Nothing keeps everything. Every persistent structure—from a star to a memory to a civilisation—is a policy about what to discard.</p>
          <p className="text-base leading-relaxed text-[var(--text-secondary)] sm:text-lg">Across eleven chapters and three appendices, the book follows information through cosmic backgrounds, thermodynamic erasure, stellar foundries, pulsars, black holes, dark matter, galactic mergers, sparse inference, and the far future. Its empirical, inferred, and analogical registers remain explicitly separated.</p>
        </section>

        <div className="mt-10 flex flex-wrap gap-3">
          <Link href="/books/the-cosmic-recursion/read" className="evidence-action evidence-action--primary">Choose a chapter ↗</Link>
          <Link href="/books/the-cosmic-recursion/reader-faq" className="evidence-action">New reader FAQ ↗</Link>
        </div>
        <p className="mt-5 text-sm leading-relaxed text-[var(--text-secondary)]">The complete edition includes a provenance index and chapter-level sources and verification register.</p>

        <MarkdownArticle blocks={blocks} />
      </article>
    </main>
  )
}
