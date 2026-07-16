import Link from 'next/link'
import type { Metadata } from 'next'

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

const parts = [
  {
    number: 'I',
    title: 'The Dreaming Brain',
    subtitle: 'Established science · The credibility anchor',
    chapters: ['What Happens When You Sleep', 'Why We Dream, and Why No One Yet Knows'],
  },
  {
    number: 'II',
    title: 'The Edge of the Known',
    subtitle: 'Where sleep science meets the inference machine',
    chapters: ['The Hardest Thing to Study', 'Two Engines, One Trick'],
  },
  {
    number: 'III',
    title: 'Extreme States of Simulation',
    subtitle: 'When the dreaming mind reveals its workings',
    chapters: ['The Dreamer at the Controls', 'When the Machinery Fails'],
  },
  {
    number: 'IV',
    title: 'The Speculative Frontier',
    subtitle: 'Open questions, held as open questions',
    chapters: ['Are Dreams Computation?', 'The Quantum Question', 'The Machines That Dream'],
  },
  {
    number: 'V',
    title: 'The Imagined Life',
    subtitle: 'The possible self and the work of making it real',
    chapters: ['The Waking Dream', 'Steering the Simulator', 'Coda: The Future of Dreaming'],
  },
]

export default function TheImaginedLifeHub() {
  return (
    <main className="min-h-screen bg-[#0a0a0c] text-zinc-300 selection:bg-indigo-500 selection:text-white">
      <article className="max-w-4xl mx-auto px-6 py-20 sm:py-28">
        <header className="max-w-3xl border-l border-indigo-500 pl-6 sm:pl-8">
          <p className="font-mono text-[10px] text-indigo-400 tracking-widest uppercase mb-5">
            [ Maha Strategies // Open Edition ]
          </p>
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-light text-white leading-[1.08] tracking-tight mb-5">
            The Imagined Life
          </h1>
          <p className="text-lg sm:text-xl text-zinc-400 font-light leading-relaxed mb-3">
            Living Inside a Dreaming Brain
          </p>
          <p className="font-mono text-[10px] text-zinc-600 tracking-widest uppercase">
            By Mayone Maha Rajan
          </p>
        </header>

        <section className="mt-16 max-w-3xl">
          <p className="text-xl sm:text-2xl text-zinc-200 font-light leading-relaxed mb-6">
            Imagination is not a decoration on the mind. It is the faculty that lets us hold a version of the world that does not yet exist—and, through the actions it changes, begin to make it real.
          </p>
          <p className="text-base sm:text-lg text-zinc-500 leading-relaxed">
            This book begins with the measurable architecture of sleep and dreaming, crosses the uncertain border between brains and generative machines, and ends with the practical question of how to become a deliberate steward of one&apos;s own imagination.
          </p>
        </section>

        <section className="mt-16 border border-indigo-900/50 bg-indigo-950/20 p-7 sm:p-10 relative overflow-hidden">
          <div className="absolute top-0 left-0 h-full w-1 bg-indigo-500" />
          <p className="font-mono text-[10px] text-indigo-400 tracking-widest uppercase mb-4">[ Read now ]</p>
          <h2 className="text-2xl sm:text-3xl font-light text-white mb-4">The faculty of the possible</h2>
          <p className="text-zinc-400 leading-relaxed max-w-2xl mb-7">
            The opening essay: a dream does not make itself real. It changes the dreamer, who changes their actions, which can then change the world.
          </p>
          <Link href="/books/the-imagined-life/the-faculty-of-the-possible" className="inline-block bg-white text-black font-mono font-bold text-xs tracking-widest uppercase px-7 py-4 hover:bg-zinc-200 transition-colors">
            Read the opening essay ↗
          </Link>
        </section>

        <section className="mt-20">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
            <div>
              <p className="font-mono text-[10px] text-indigo-400 tracking-widest uppercase mb-3">[ Table of contents ]</p>
              <h2 className="text-2xl sm:text-3xl font-light text-white">From the sleeping brain to the imagined future.</h2>
            </div>
            <p className="font-mono text-[10px] text-zinc-600 tracking-widest uppercase">Chapters releasing in sequence</p>
          </div>
          <ol className="border-t border-zinc-800">
            {parts.map((part) => (
              <li key={part.number} className="grid grid-cols-[3rem_1fr] gap-4 sm:gap-7 border-b border-zinc-800 py-7">
                <span className="font-mono text-[10px] text-zinc-600 tracking-widest pt-1">{part.number}</span>
                <div>
                  <h3 className="text-lg text-zinc-100 mb-1">{part.title}</h3>
                  <p className="font-mono text-[10px] text-indigo-400 tracking-widest uppercase mb-4">{part.subtitle}</p>
                  <p className="text-sm text-zinc-500 leading-relaxed">{part.chapters.join(' · ')}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="mt-20 border-t border-zinc-800 pt-10 max-w-3xl">
          <p className="font-mono text-[10px] text-indigo-400 tracking-widest uppercase mb-4">[ Method ]</p>
          <p className="text-zinc-400 leading-relaxed">
            The book separates empirical findings from theoretical interpretation and clearly fenced speculation. AI assisted the drafting process; Mayone Maha Rajan is responsible for the argument, editorial decisions, and source verification. Chapters are released after a final claim-and-source review.
          </p>
        </section>
      </article>
    </main>
  )
}
