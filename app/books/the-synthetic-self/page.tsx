import type { Metadata } from 'next'
import BookEndpointCTA from '@/components/BookEndpointCTA'
import MarkdownArticle from '@/components/MarkdownArticle'
import { parseMarkdownBlocks, readBookMarkdown } from '@/lib/content'

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
  publisher: { '@type': 'Organization', name: 'Maha Strategies LLC', url: SITE_URL },
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
    <main className="min-h-screen bg-[#0a0a0c] text-zinc-300 selection:bg-indigo-500 selection:text-white">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(bookJsonLd) }} />
      <article className="max-w-4xl mx-auto px-6 py-20 sm:py-28">
        <header className="max-w-3xl border-l border-indigo-500 pl-6 sm:pl-8">
          <p className="font-mono text-xs text-indigo-300 tracking-widest uppercase mb-5">
            [ Maha Strategies // Open Edition ]
          </p>
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-light text-white leading-[1.08] tracking-tight mb-5">
            The Synthetic Self
          </h1>
          <p className="text-lg sm:text-xl text-zinc-400 font-light leading-relaxed mb-3">
            Engineering the Soul of the Machine
          </p>
          <p className="font-mono text-xs text-zinc-500 tracking-widest uppercase">
            By Mayone Maha Rajan
          </p>
        </header>

        <section className="mt-16 max-w-3xl">
          <p className="text-xl sm:text-2xl text-zinc-200 font-light leading-relaxed mb-6">
            A large language model is not a mind that arrived from elsewhere. It is a compression of the human record—built from what we wrote, and therefore destined to reflect it back.
          </p>
          <p className="text-base sm:text-lg text-zinc-400 leading-relaxed">
            This book follows that idea from the machinery of training through energy, hallucination, alignment, work, and responsibility. It is written for curious non-specialists who want the mechanism without the mythology—and the human consequences without the slogans.
          </p>
        </section>

        <BookEndpointCTA title="The Synthetic Self" placement="top" />

        <MarkdownArticle blocks={blocks} />

        <BookEndpointCTA title="The Synthetic Self" placement="bottom" />
      </article>
    </main>
  )
}
