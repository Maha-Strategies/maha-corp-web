import type { Metadata } from 'next'
import Link from 'next/link'

import BookChapterList from '@/components/BookChapterList'
import { MAHA_ORGANIZATION_ID, MAYONE_MAHA_RAJAN_ID } from '@/lib/entity'

const SITE_URL = 'https://www.mahastrategies.com'
const BOOK_PATH = '/books/the-volcanic-engine'

export const metadata: Metadata = {
  title: 'The Volcanic Engine | Maha Strategies',
  description:
    'An open research edition of The Volcanic Engine: how a firing planet builds continents, regulates climate, creates hazards, and stays habitable.',
  alternates: { canonical: BOOK_PATH },
  openGraph: {
    type: 'article',
    url: `${SITE_URL}${BOOK_PATH}`,
    title: 'The Volcanic Engine',
    description: 'Living on a Firing Planet.',
    images: [{ url: '/og-master.png', width: 1200, height: 630, alt: 'The Volcanic Engine — Maha Strategies' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'The Volcanic Engine',
    description: 'Living on a Firing Planet.',
    images: ['/og-master.png'],
    creator: '@mayonemaha',
  },
}

const bookJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Book',
  '@id': `${SITE_URL}${BOOK_PATH}#book`,
  name: 'The Volcanic Engine',
  alternativeHeadline: 'Living on a Firing Planet',
  description:
    'An open research edition about how volcanism builds continents, participates in long-term climate regulation, creates hazards, and shapes planetary habitability.',
  url: `${SITE_URL}${BOOK_PATH}`,
  author: { '@id': MAYONE_MAHA_RAJAN_ID },
  publisher: { '@id': MAHA_ORGANIZATION_ID },
  bookFormat: 'https://schema.org/EBook',
  isAccessibleForFree: true,
  inLanguage: 'en',
  datePublished: '2026-08-24',
  potentialAction: { '@type': 'ReadAction', target: `${SITE_URL}${BOOK_PATH}/read` },
}

const parts = [
  {
    number: 'I',
    title: 'The Machine',
    subtitle: 'Melt · gas · pressure · eruption',
    chapters: ['The Rock That Flows', 'The Physics of the Cork'],
  },
  {
    number: 'II',
    title: 'The Unreadable Machine',
    subtitle: 'Measurement · inference · warning',
    chapters: ['The Instrument You Cannot Insert', 'The Death of the Cavern', 'Two Warnings'],
  },
  {
    number: 'III',
    title: 'The Planet-Maker',
    subtitle: 'Life · air · ocean · other worlds',
    chapters: [
      'The Vent at the Beginning of Life',
      'Air, Ocean, Continent',
      'The Dead Worlds and the Icy Ones',
      'Is a Living Planet Necessarily a Firing One?',
    ],
  },
  {
    number: 'IV',
    title: 'The Engine Against Us',
    subtitle: 'Calderas · extinctions · volcanic winter',
    chapters: ['The Caldera Problem', 'The Great Dyings', 'Volcanic Winter, and the Temptation to Borrow It'],
  },
  {
    number: 'V',
    title: 'The Human Volcano',
    subtitle: 'Exposure · choice · geothermal energy',
    chapters: ['Who Lives on the Flank', 'Tapping the Furnace'],
  },
]

const chapterPaths: Record<string, string> = {
  'The Rock That Flows': `${BOOK_PATH}/read/the-rock-that-flows`,
  'The Physics of the Cork': `${BOOK_PATH}/read/the-physics-of-the-cork`,
  'The Instrument You Cannot Insert': `${BOOK_PATH}/read/the-instrument-you-cannot-insert`,
  'The Death of the Cavern': `${BOOK_PATH}/read/the-death-of-the-cavern`,
  'Two Warnings': `${BOOK_PATH}/read/two-warnings`,
  'The Vent at the Beginning of Life': `${BOOK_PATH}/read/the-vent-at-the-beginning-of-life`,
  'Air, Ocean, Continent': `${BOOK_PATH}/read/air-ocean-continent`,
  'The Dead Worlds and the Icy Ones': `${BOOK_PATH}/read/the-dead-worlds-and-the-icy-ones`,
  'Is a Living Planet Necessarily a Firing One?': `${BOOK_PATH}/read/is-a-living-planet-necessarily-a-firing-one`,
  'The Caldera Problem': `${BOOK_PATH}/read/the-caldera-problem`,
  'The Great Dyings': `${BOOK_PATH}/read/the-great-dyings`,
  'Volcanic Winter, and the Temptation to Borrow It': `${BOOK_PATH}/read/volcanic-winter`,
  'Who Lives on the Flank': `${BOOK_PATH}/read/who-lives-on-the-flank`,
  'Tapping the Furnace': `${BOOK_PATH}/read/tapping-the-furnace`,
}

export default function TheVolcanicEngineHub() {
  return (
    <main className="evidence-page">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(bookJsonLd).replace(/</g, '\\u003c') }}
      />
      <article className="evidence-container evidence-container--narrow">
        <header className="max-w-3xl border-l border-indigo-500 pl-6 sm:pl-8">
          <p className="evidence-kicker">[ Maha Strategies // Open research edition ]</p>
          <h1 className="evidence-title evidence-title--product mt-5">The Volcanic Engine</h1>
          <p className="evidence-lede mt-5">Living on a Firing Planet</p>
          <p className="evidence-kicker mt-5">Mayone Maha Rajan · 14 chapters · coda · source register</p>
        </header>

        <section className="evidence-section max-w-3xl">
          <p className="text-xl sm:text-2xl text-[var(--text-primary)] font-light leading-relaxed">
            Earth is not a stable world that occasionally erupts. It is an erupting world whose deep heat has helped build the continents, cycle carbon, and keep a habitable surface in motion.
          </p>
          <p className="evidence-copy mt-6">
            The book follows that engine from partial melting and explosive fragmentation through warning systems, planetary climate, mass extinction, settlement on volcanic flanks, and geothermal energy. Its central distinction is between an eruption as a human interruption and volcanism as a planetary process.
          </p>
          <Link href={`${BOOK_PATH}/read`} className="evidence-action evidence-action--primary mt-9 inline-block">
            Read the complete edition ↗
          </Link>
        </section>

        <section className="evidence-section" aria-labelledby="research-status">
          <div className="evidence-card border-l-4 border-l-[var(--status-boundary)]">
            <p className="evidence-kicker text-[var(--status-boundary)]">Research boundary</p>
            <h2 id="research-status" className="evidence-card-title mt-4">The verification register remains visible.</h2>
            <p className="evidence-copy mt-4">
              This is an open research edition, not a claim that every figure is settled. Each chapter preserves its empirical, theoretical, and speculative register, followed by its verification notes. The final section publishes the source register and identifies work still pending rather than silently upgrading it into fact.
            </p>
            <Link href={`${BOOK_PATH}/read/sources-and-further-reading`} className="evidence-link mt-5 inline-block">
              Inspect sources and verification status ↗
            </Link>
          </div>
        </section>

        <section className="evidence-section" aria-labelledby="reader-paths">
          <p className="evidence-kicker">[ Reader paths ]</p>
          <h2 id="reader-paths" className="evidence-section-title mt-4">Start with the mechanism or test a popular claim.</h2>
          <div className="mt-7 grid gap-5 sm:grid-cols-2">
            <article className="evidence-card">
              <p className="evidence-kicker">Plain-English guide</p>
              <h3 className="evidence-card-title mt-4">Why do volcanoes explode?</h3>
              <p className="evidence-copy mt-4">Pressure, dissolved gas, viscosity, and why some magma pours while other magma fragments.</p>
              <Link href={`${BOOK_PATH}/why-volcanoes-explode`} className="evidence-link mt-5 inline-block">Read the guide ↗</Link>
            </article>
            <article className="evidence-card">
              <p className="evidence-kicker">Myth check</p>
              <h3 className="evidence-card-title mt-4">Is Yellowstone overdue?</h3>
              <p className="evidence-copy mt-4">Why two intervals do not make an eruption schedule, and why “not overdue” does not mean “no hazard.”</p>
              <Link href={`${BOOK_PATH}/is-yellowstone-overdue`} className="evidence-link mt-5 inline-block">Read the evidence ↗</Link>
            </article>
          </div>
        </section>

        <section className="evidence-section" aria-labelledby="table-of-contents">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="evidence-kicker">[ Table of contents ]</p>
              <h2 id="table-of-contents" className="evidence-section-title mt-4">From molten rock to a living world.</h2>
            </div>
            <p className="evidence-kicker">Introduction · five movements · coda</p>
          </div>
          <div className="mt-8">
            <BookChapterList parts={parts} availableChapters={chapterPaths} />
          </div>
          <div className="mt-7 flex flex-col gap-3 text-sm">
            <Link href={`${BOOK_PATH}/read/introduction`} className="evidence-link">Read the introduction: The Engine and the Interruption ↗</Link>
            <Link href={`${BOOK_PATH}/read/the-deep-time-horizon`} className="evidence-link">Read the coda: The Deep-Time Horizon ↗</Link>
            <Link href={`${BOOK_PATH}/read/sources-and-further-reading`} className="evidence-link">Read sources and further reading ↗</Link>
          </div>
        </section>
      </article>
    </main>
  )
}
