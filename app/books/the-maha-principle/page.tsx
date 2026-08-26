import Image from 'next/image'
import Link from 'next/link'
import type { Metadata } from 'next'

import { MAHA_ORGANIZATION_ID } from '@/lib/entity'
import { openBookEditions } from '@/lib/open-book-editions'

const SITE_URL = 'https://www.mahastrategies.com'
const book = openBookEditions['the-maha-principle']

export const metadata: Metadata = {
  title: 'The Maha Principle | Maha Strategies',
  description:
    'Read the complete free web edition of The Maha Principle: The Architecture of Human Flourishing, by Mayone Maha Rajan.',
  alternates: { canonical: `/books/${book.slug}` },
  openGraph: {
    type: 'book',
    url: `${SITE_URL}/books/${book.slug}`,
    title: book.title,
    description: `${book.subtitle}. A complete free web edition by Mayone Maha Rajan.`,
    images: [{ url: '/books/the-maha-principle/cover.jpg', width: 1632, height: 2624, alt: 'Cover of The Maha Principle' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: book.title,
    description: `${book.subtitle}. A complete free web edition.`,
    images: ['/books/the-maha-principle/cover.jpg'],
    creator: '@mayonemaha',
  },
}

const bookJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Book',
  '@id': `${SITE_URL}/books/${book.slug}#book`,
  name: book.title,
  alternativeHeadline: book.subtitle,
  description:
    'A systems manifesto connecting health, attention, community, execution, governance, complexity, and civic renewal.',
  url: `${SITE_URL}/books/${book.slug}`,
  author: { '@type': 'Person', name: 'Mayone Maha Rajan' },
  publisher: { '@id': MAHA_ORGANIZATION_ID },
  bookFormat: 'https://schema.org/EBook',
  isAccessibleForFree: true,
  inLanguage: 'en',
  datePublished: '2026-06-22',
  image: `${SITE_URL}/books/the-maha-principle/cover.jpg`,
  potentialAction: { '@type': 'ReadAction', target: `${SITE_URL}/books/${book.slug}/read` },
}

export default function TheMahaPrinciplePage() {
  return (
    <main className="evidence-page">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(bookJsonLd) }} />
      <article className="evidence-container evidence-container--narrow">
        <Link href="/books" className="evidence-link inline-block font-mono text-xs uppercase tracking-widest">
          ← All books
        </Link>

        <header className="mt-10 grid gap-10 border-t border-[var(--border-default)] pt-8 md:grid-cols-[minmax(0,1fr)_240px] md:items-start">
          <div>
            <p className="evidence-kicker">[ Maha Strategies // Complete free web edition ]</p>
            <h1 className="evidence-title evidence-title--product mt-5">{book.title}</h1>
            <p className="evidence-lede mt-5">{book.subtitle}</p>
            <p className="evidence-copy mt-6">By Mayone Maha Rajan</p>
            <p className="evidence-copy mt-7">
              A systems manifesto about reclaiming health, attention, community, capable action, humane governance,
              strategic clarity, and the conditions for human flourishing.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href={`/books/${book.slug}/read`} className="evidence-action evidence-action--primary">
                Read the complete edition ↗
              </Link>
              <Link href={`/books/${book.slug}/read/introduction`} className="evidence-action">
                Start with the introduction ↗
              </Link>
            </div>
          </div>
          <Image
            src="/books/the-maha-principle/cover.jpg"
            alt="Cover of The Maha Principle"
            width={1632}
            height={2624}
            priority
            className="mx-auto h-auto w-full max-w-[240px] border border-[var(--border-default)]"
          />
        </header>

        <section className="evidence-section" aria-labelledby="edition-boundary">
          <p className="evidence-kicker">[ Edition boundary ]</p>
          <h2 id="edition-boundary" className="evidence-section-title mt-4">Free to read on the web.</h2>
          <div className="mt-7 grid gap-5 sm:grid-cols-2">
            <div className="evidence-card">
              <p className="evidence-card-title">Complete manuscript</p>
              <p className="evidence-copy mt-4">
                All 40 front-matter, chapter, protocol, appendix, acknowledgment, and reference sections have stable web URLs.
              </p>
            </div>
            <div className="evidence-card">
              <p className="evidence-card-title">Copyright retained</p>
              <p className="evidence-copy mt-4">
                Free web access does not grant permission to republish, resell, or create derivative editions.
              </p>
            </div>
          </div>
        </section>

        <section className="evidence-section" aria-labelledby="health-boundary">
          <p className="evidence-kicker text-[var(--status-boundary)]">[ Health boundary ]</p>
          <h2 id="health-boundary" className="evidence-section-title mt-4">Educational and philosophical—not medical advice.</h2>
          <p className="evidence-copy mt-6">
            The edition includes dietary, cold-exposure, fasting, and self-assessment material. Read the medical disclaimer
            before applying any protocol, and consult a qualified healthcare professional where appropriate.
          </p>
          <Link href={`/books/${book.slug}/read/medical-disclaimer`} className="evidence-link mt-6 inline-block">
            Read the medical disclaimer ↗
          </Link>
        </section>
      </article>
    </main>
  )
}
