import Link from 'next/link'
import type { Metadata } from 'next'
import BookChapterList from '@/components/BookChapterList'
import BookReaderPaths from '@/components/BookReaderPaths'
import { MAHA_ORGANIZATION_ID } from '@/lib/entity'

const SITE_URL = 'https://www.mahastrategies.com'

export const metadata: Metadata = {
  title: 'The Orbital Mind | Maha Strategies',
  description:
    'An open web edition of The Orbital Mind: a systems psychology of attention, desire, agency, limit, imagination, and integration.',
  alternates: { canonical: '/books/the-orbital-mind' },
  openGraph: {
    type: 'article',
    url: `${SITE_URL}/books/the-orbital-mind`,
    title: 'The Orbital Mind',
    description: 'A systems psychology of attention, desire, agency, limit, imagination, and integration.',
    images: [{ url: '/og-master.png', width: 1200, height: 630, alt: 'The Orbital Mind — Maha Strategies' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'The Orbital Mind',
    description: 'A systems psychology of attention, desire, agency, limit, imagination, and integration.',
    images: ['/og-master.png'],
    creator: '@mayonemaha',
  },
}

const bookJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Book',
  '@id': `${SITE_URL}/books/the-orbital-mind#book`,
  name: 'The Orbital Mind',
  alternativeHeadline: 'The Astrophysics of the Self',
  description: 'A systems psychology of attention, desire, agency, limit, imagination, and integration.',
  url: `${SITE_URL}/books/the-orbital-mind`,
  author: { '@type': 'Person', name: 'Mayone Maha Rajan' },
  publisher: { '@id': MAHA_ORGANIZATION_ID },
  bookFormat: 'https://schema.org/EBook',
  isAccessibleForFree: true,
  inLanguage: 'en',
  datePublished: '2026-07-16',
  potentialAction: { '@type': 'ReadAction', target: `${SITE_URL}/books/the-orbital-mind` },
}

const parts = [
  {
    number: 'I',
    title: 'The Conditions of Coherence',
    subtitle: 'Sun · Earth and Moon · Saturn',
    chapters: ['The Governing Center', 'The Body and Its Rhythms', 'Structure and Limit'],
  },
  {
    number: 'II',
    title: 'The Functions of a Living Self',
    subtitle: 'Mercury · Venus · Mars · Jupiter',
    chapters: ['Thought and Attention', 'Desire and Value', 'Agency and Boundary', 'Responsibility and Coordination'],
  },
  {
    number: 'III',
    title: 'Openness and Transformation',
    subtitle: 'Uranus · Neptune · Pluto · Planet Nine',
    chapters: ['Disruption and Novelty', 'Ambiguity and Imagination', 'Depth and Grief', 'Orientation Toward the Unseen'],
  },
  {
    number: 'IV',
    title: 'Orbital Dynamics',
    subtitle: 'The grammar of the whole',
    chapters: ['The Five Collisions', 'The Diagnostic Protocol', 'The Alloy'],
  },
  {
    number: 'V',
    title: 'The Formal Turn',
    subtitle: 'A conjecture designed to be testable',
    chapters: ['The Formal Model', 'The Cross-Scale Conjecture', 'Predictions That Could Lose'],
  },
]

export default function TheOrbitalMindHub() {
  return (
    <main className="min-h-screen bg-[#0a0a0c] text-zinc-300 selection:bg-indigo-500 selection:text-white">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(bookJsonLd) }} />
      <article className="max-w-4xl mx-auto px-6 py-20 sm:py-28">
        <header className="max-w-3xl border-l border-indigo-500 pl-6 sm:pl-8">
          <p className="font-mono text-xs text-indigo-300 tracking-widest uppercase mb-5">
            [ Maha Strategies // Open Edition ]
          </p>
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-light text-white leading-[1.08] tracking-tight mb-5">
            The Orbital Mind
          </h1>
          <p className="text-lg sm:text-xl text-zinc-400 font-light leading-relaxed mb-3">
            The Astrophysics of the Self
          </p>
          <p className="font-mono text-xs text-zinc-500 tracking-widest uppercase">
            By Mayone Maha Rajan
          </p>
        </header>

        <section className="mt-16 max-w-3xl">
          <p className="text-xl sm:text-2xl text-zinc-200 font-light leading-relaxed mb-6">
            A person is not a fixed type. A person is a living system: many functions held in a workable relation against the pull of their own forces.
          </p>
          <p className="text-base sm:text-lg text-zinc-400 leading-relaxed">
            This is a systems psychology of attention, desire, agency, structure, imagination, grief, and purpose. The solar system serves as a vivid language for thinking with—not as a source of proof, prediction, or destiny.
          </p>
        </section>

        <section className="mt-16 border border-indigo-900/50 bg-indigo-950/20 p-7 sm:p-10 relative overflow-hidden">
          <div className="absolute top-0 left-0 h-full w-1 bg-indigo-500" />
          <p className="font-mono text-xs text-indigo-300 tracking-widest uppercase mb-4">[ Chapter-by-chapter edition ]</p>
          <h2 className="text-2xl sm:text-3xl font-light text-white mb-4">Read the book one chapter at a time</h2>
          <p className="text-zinc-400 leading-relaxed max-w-2xl mb-7">
            The complete book is available online as a chapter reader: begin with the framework, choose a section, and continue with stable next-chapter links.
          </p>
          <Link href="/books/the-orbital-mind/read" className="inline-block bg-white text-black font-mono font-bold text-xs tracking-widest uppercase px-7 py-4 hover:bg-zinc-200 transition-colors">
            Choose a chapter ↗
          </Link>
          <BookReaderPaths
            guideHref="/books/the-orbital-mind/what-is-executive-function"
            guideTitle="What is executive function?"
            guideDescription="A plain-English guide to working memory, inhibitory control, cognitive flexibility, and self-regulation."
            essayHref="/books/the-orbital-mind/the-map-is-not-the-mind"
            essayTitle="The map is not the mind"
          />
        </section>

        <section className="mt-20">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
            <div>
              <p className="font-mono text-xs text-indigo-300 tracking-widest uppercase mb-3">[ Table of contents ]</p>
              <h2 className="text-2xl sm:text-3xl font-light text-white">Read yourself by collision, not by type.</h2>
            </div>
            <p className="font-mono text-xs text-zinc-500 tracking-widest uppercase">Five parts · formal appendices · full text</p>
          </div>
          <BookChapterList parts={parts} availableChapters={{
            'The Governing Center': '/books/the-orbital-mind/read/the-governing-center',
            'The Body and Its Rhythms': '/books/the-orbital-mind/read/body-and-rhythms',
            'Structure and Limit': '/books/the-orbital-mind/read/structure-and-limit',
            'Thought and Attention': '/books/the-orbital-mind/read/thought-and-attention',
            'Desire and Value': '/books/the-orbital-mind/read/desire-and-value',
            'Agency and Boundary': '/books/the-orbital-mind/read/agency-and-boundary',
            'Responsibility and Coordination': '/books/the-orbital-mind/read/responsibility-and-coordination',
            'Disruption and Novelty': '/books/the-orbital-mind/read/disruption-and-novelty',
            'Ambiguity and Imagination': '/books/the-orbital-mind/read/ambiguity-and-imagination',
            'Depth and Grief': '/books/the-orbital-mind/read/depth-and-grief',
            'Orientation Toward the Unseen': '/books/the-orbital-mind/read/orientation-toward-the-unseen',
            'The Five Collisions': '/books/the-orbital-mind/read/five-collisions',
            'The Diagnostic Protocol': '/books/the-orbital-mind/read/orbital-dynamics',
            'The Alloy': '/books/the-orbital-mind/read/orbital-dynamics',
            'The Formal Model': '/books/the-orbital-mind/read/formal-model',
            'The Cross-Scale Conjecture': '/books/the-orbital-mind/read/maha-invariance',
            'Predictions That Could Lose': '/books/the-orbital-mind/read/predictions-that-could-lose',
          }} />
        </section>

        <section className="mt-20 border-t border-zinc-800 pt-10 max-w-3xl">
          <p className="font-mono text-xs text-indigo-300 tracking-widest uppercase mb-4">[ Reading contract ]</p>
          <p className="text-zinc-400 leading-relaxed mb-5">
            The book separates empirical support, philosophical interpretation, symbolic image, metaphysical question, and—only in its final part—formal conjecture. An image may illuminate an idea; it is never presented as evidence for it.
          </p>
          <p className="text-sm text-zinc-400 leading-relaxed">
            This book is for reflection and ordinary self-development, not diagnosis or therapy. If you are in crisis or need mental-health support, seek help from a qualified professional or local emergency service.
          </p>
        </section>
      </article>
    </main>
  )
}
