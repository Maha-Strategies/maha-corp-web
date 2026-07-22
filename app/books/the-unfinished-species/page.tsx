import Link from 'next/link'
import type { Metadata } from 'next'
import BookChapterList from '@/components/BookChapterList'
import BookReaderPaths from '@/components/BookReaderPaths'

const SITE_URL = 'https://www.mahastrategies.com'

export const metadata: Metadata = {
  title: 'The Unfinished Species | Maha Strategies',
  description:
    'An open web edition of The Unfinished Species: how intelligence learned to redesign its own substrate.',
  alternates: { canonical: '/books/the-unfinished-species' },
  openGraph: {
    type: 'article',
    url: `${SITE_URL}/books/the-unfinished-species`,
    title: 'The Unfinished Species',
    description: 'How intelligence learned to redesign its own substrate.',
    images: [{ url: '/og-master.png', width: 1200, height: 630, alt: 'The Unfinished Species — Maha Strategies' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'The Unfinished Species',
    description: 'How intelligence learned to redesign its own substrate.',
    images: ['/og-master.png'],
    creator: '@mayonemaha',
  },
}

const bookJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Book',
  '@id': `${SITE_URL}/books/the-unfinished-species#book`,
  name: 'The Unfinished Species',
  alternativeHeadline: 'How Intelligence Learned to Redesign Its Own Substrate',
  description: 'A book about evolution, self-design, and the conditions intelligence creates for its own development.',
  url: `${SITE_URL}/books/the-unfinished-species`,
  author: { '@type': 'Person', name: 'Mayone Maha Rajan' },
  publisher: { '@type': 'Organization', name: 'Maha Strategies LLC', url: SITE_URL },
  bookFormat: 'https://schema.org/EBook',
  isAccessibleForFree: true,
  inLanguage: 'en',
  datePublished: '2026-07-16',
  potentialAction: { '@type': 'ReadAction', target: `${SITE_URL}/books/the-unfinished-species` },
}

const parts = [
  {
    number: 'I',
    title: 'The Blind Architect',
    subtitle: 'Natural Selection · The Era of Randomness',
    chapters: ['The Algorithm', 'The Crucible'],
  },
  {
    number: 'II',
    title: 'The Failed Architect',
    subtitle: 'Unnatural Selection · The Era of Domestication',
    chapters: ['The Zoo', 'The Runaway Maximizer'],
  },
  {
    number: 'III',
    title: 'The Interface',
    subtitle: 'The Science of Self-Design · Where Biology Meets Will',
    chapters: ['Software Writes Hardware', 'The Switchboard of Sovereignty', 'Building the Selection Pressure'],
  },
  {
    number: 'IV',
    title: 'The Computational Architect',
    subtitle: 'The New Instruments · AI and Quantum as Tools of Sovereign Selection',
    chapters: ['The Merger Already Happened', 'The Quantum Substrate', 'The Cyborg Fallacy'],
  },
  {
    number: 'V',
    title: 'The Conscious Architect',
    subtitle: 'Sovereign Selection · What We Choose to Become',
    chapters: ['Design as Destiny'],
  },
]

export default function TheUnfinishedSpeciesHub() {
  return (
    <main className="min-h-screen bg-[#0a0a0c] text-zinc-300 selection:bg-indigo-500 selection:text-white">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(bookJsonLd) }} />
      <article className="max-w-4xl mx-auto px-6 py-20 sm:py-28">
        <header className="max-w-3xl border-l border-indigo-500 pl-6 sm:pl-8">
          <p className="font-mono text-xs text-indigo-300 tracking-widest uppercase mb-5">
            [ Maha Strategies // Open Edition ]
          </p>
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-light text-white leading-[1.08] tracking-tight mb-5">
            The Unfinished Species
          </h1>
          <p className="text-lg sm:text-xl text-zinc-400 font-light leading-relaxed mb-3">
            How Intelligence Learned to Redesign Its Own Substrate
          </p>
          <p className="font-mono text-xs text-zinc-500 tracking-widest uppercase">
            By Mayone Maha Rajan
          </p>
        </header>

        <section className="mt-16 max-w-3xl">
          <p className="text-xl sm:text-2xl text-zinc-200 font-light leading-relaxed mb-6">
            Evolution may be passing from blind natural selection, through the accidental pressures of modernity, toward an era in which intelligence can read and deliberately redesign the conditions that shape it.
          </p>
          <p className="text-base sm:text-lg text-zinc-400 leading-relaxed">
            This book follows that proposition from evolutionary biology and mismatch through learning, epigenetics, artificial intelligence, and the ethics of self-design. It argues for responsibility over nostalgia, and for human dignity without biological determinism.
          </p>
        </section>

        <section className="mt-16 border border-indigo-900/50 bg-indigo-950/20 p-7 sm:p-10 relative overflow-hidden">
          <div className="absolute top-0 left-0 h-full w-1 bg-indigo-500" />
          <p className="font-mono text-xs text-indigo-300 tracking-widest uppercase mb-4">[ Complete edition ]</p>
          <h2 className="text-2xl sm:text-3xl font-light text-white mb-4">Read the full book</h2>
          <p className="text-zinc-400 leading-relaxed max-w-2xl mb-7">
            The full manuscript is now available online: the introduction, all eleven chapters, and the method and sources that close the book.
          </p>
          <Link href="/books/the-unfinished-species/read" className="inline-block bg-white text-black font-mono font-bold text-xs tracking-widest uppercase px-7 py-4 hover:bg-zinc-200 transition-colors">
            Read the complete edition ↗
          </Link>
          <BookReaderPaths
            guideHref="/books/the-unfinished-species/what-is-natural-selection"
            guideTitle="What is natural selection?"
            guideDescription="A plain-English guide to variation, inheritance, selection, and the limits of evolutionary explanation."
            essayHref="/books/the-unfinished-species/the-blind-watchmaker-opens-his-eyes"
            essayTitle="The blind watchmaker opens his eyes"
          />
        </section>

        <section className="mt-20">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
            <div>
              <p className="font-mono text-xs text-indigo-300 tracking-widest uppercase mb-3">[ Table of contents ]</p>
              <h2 className="text-2xl sm:text-3xl font-light text-white">From selection to self-design.</h2>
            </div>
            <p className="font-mono text-xs text-zinc-500 tracking-widest uppercase">Introduction · 11 chapters · method & sources</p>
          </div>
          <BookChapterList parts={parts} availableChapters={{
            'The Algorithm': '/books/the-unfinished-species/read/the-algorithm',
            'The Crucible': '/books/the-unfinished-species/read/the-crucible',
            'The Zoo': '/books/the-unfinished-species/read/the-zoo',
            'The Runaway Maximizer': '/books/the-unfinished-species/read/the-runaway-maximizer',
            'Software Writes Hardware': '/books/the-unfinished-species/read/software-writes-hardware',
            'The Switchboard of Sovereignty': '/books/the-unfinished-species/read/the-switchboard-of-sovereignty',
            'Building the Selection Pressure': '/books/the-unfinished-species/read/building-the-selection-pressure',
            'The Merger Already Happened': '/books/the-unfinished-species/read/the-merger-already-happened',
            'The Quantum Substrate': '/books/the-unfinished-species/read/the-quantum-substrate',
            'The Cyborg Fallacy': '/books/the-unfinished-species/read/the-cyborg-fallacy',
            'Design as Destiny': '/books/the-unfinished-species/read/design-as-destiny',
          }} />
        </section>

        <section className="mt-20 border-t border-zinc-800 pt-10 max-w-3xl">
          <p className="font-mono text-xs text-indigo-300 tracking-widest uppercase mb-4">[ Epistemic contract ]</p>
          <p className="text-zinc-400 leading-relaxed">
            The book separates established findings from inferences drawn from them and from clearly fenced speculation. AI assisted the drafting process; Mayone Maha Rajan is responsible for the argument, editorial decisions, and source verification. The complete manuscript is published as an open edition; readers should consult the method and sources before treating any claim as settled.
          </p>
        </section>
      </article>
    </main>
  )
}
