import Link from 'next/link'
import type { Metadata } from 'next'

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

const chapters = [
  ['01', 'The Learning Machine', 'How language models learn, and why the mirror is not merely a metaphor.'],
  ['02', 'The Thermodynamics of Thought', 'The physical bill of computation: heat, energy, architecture, and scale.'],
  ['03', 'Computation Versus Understanding', 'What fluent machine output can—and cannot—tell us about understanding.'],
  ['04', 'The Data Problem', 'Bias, contamination, and what happens when the mirror reflects itself.'],
  ['05', 'The Alignment Problem, Honestly', 'Why telling a machine what we value begins with knowing what we value.'],
  ['06', 'Inside the Black Box', 'Why AI can be capable, useful, and still difficult to trust.'],
  ['07', 'The Centaur', 'The case for human–machine combination over replacement.'],
  ['08', 'Cognitive Offloading and Atrophy', 'When assistance amplifies human capacity—and when it substitutes for it.'],
  ['09', 'The Economics of Synthetic Abundance', 'What remains scarce when competent output becomes cheap.'],
  ['10', 'The Substrate Question', 'The material limits and possible futures of machine intelligence.'],
  ['11', 'The Parent and the Child', 'Why the machine’s inheritance makes responsibility a human question.'],
]

export default function TheSyntheticSelfHub() {
  return (
    <main className="min-h-screen bg-[#0a0a0c] text-zinc-300 selection:bg-indigo-500 selection:text-white">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(bookJsonLd) }} />
      <article className="max-w-4xl mx-auto px-6 py-20 sm:py-28">
        <header className="max-w-3xl border-l border-indigo-500 pl-6 sm:pl-8">
          <p className="font-mono text-[10px] text-indigo-400 tracking-widest uppercase mb-5">
            [ Maha Strategies // Open Edition ]
          </p>
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-light text-white leading-[1.08] tracking-tight mb-5">
            The Synthetic Self
          </h1>
          <p className="text-lg sm:text-xl text-zinc-400 font-light leading-relaxed mb-3">
            Engineering the Soul of the Machine
          </p>
          <p className="font-mono text-[10px] text-zinc-600 tracking-widest uppercase">
            By Mayone Maha Rajan
          </p>
        </header>

        <section className="mt-16 max-w-3xl">
          <p className="text-xl sm:text-2xl text-zinc-200 font-light leading-relaxed mb-6">
            A large language model is not a mind that arrived from elsewhere. It is a compression of the human record—built from what we wrote, and therefore destined to reflect it back.
          </p>
          <p className="text-base sm:text-lg text-zinc-500 leading-relaxed">
            This book follows that idea from the machinery of training through energy, hallucination, alignment, work, and responsibility. It is written for curious non-specialists who want the mechanism without the mythology—and the human consequences without the slogans.
          </p>
        </section>

        <section className="mt-16 border border-indigo-900/50 bg-indigo-950/20 p-7 sm:p-10 relative overflow-hidden">
          <div className="absolute top-0 left-0 h-full w-1 bg-indigo-500" />
          <p className="font-mono text-[10px] text-indigo-400 tracking-widest uppercase mb-4">[ Read now ]</p>
          <h2 className="text-2xl sm:text-3xl font-light text-white mb-4">Chapter 1: The Learning Machine</h2>
          <p className="text-zinc-400 leading-relaxed max-w-2xl mb-7">
            How a language model is trained, what that mechanism does and does not explain, and why the book calls it a mirror of the human record.
          </p>
          <Link href="/books/the-synthetic-self/the-learning-machine" className="inline-block bg-white text-black font-mono font-bold text-xs tracking-widest uppercase px-7 py-4 hover:bg-zinc-200 transition-colors">
            Read Chapter 1 ↗
          </Link>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:gap-6">
            <Link href="/books/the-synthetic-self/how-large-language-models-learn" className="font-mono text-[10px] text-indigo-300 hover:text-white tracking-widest uppercase transition-colors">How do large language models learn? ↗</Link>
            <Link href="/books/the-synthetic-self/ai-is-a-mirror" className="font-mono text-[10px] text-zinc-400 hover:text-white tracking-widest uppercase transition-colors">Read the opening essay ↗</Link>
          </div>
        </section>

        <section className="mt-20">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
            <div>
              <p className="font-mono text-[10px] text-indigo-400 tracking-widest uppercase mb-3">[ Table of contents ]</p>
              <h2 className="text-2xl sm:text-3xl font-light text-white">A single idea, followed all the way down.</h2>
            </div>
            <p className="font-mono text-[10px] text-zinc-600 tracking-widest uppercase">Chapters releasing in sequence</p>
          </div>
          <ol className="border-t border-zinc-800">
            {chapters.map(([number, title, description]) => (
              <li key={number} className="grid grid-cols-[3rem_1fr] gap-4 sm:gap-7 border-b border-zinc-800 py-6">
                <span className="font-mono text-[10px] text-zinc-600 tracking-widest pt-1">{number}</span>
                <div>
                  <h3 className="text-lg text-zinc-100 mb-2">{title}</h3>
                  <p className="text-sm text-zinc-500 leading-relaxed">{description}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="mt-20 border-t border-zinc-800 pt-10 max-w-3xl">
          <p className="font-mono text-[10px] text-indigo-400 tracking-widest uppercase mb-4">[ Method ]</p>
          <p className="text-zinc-400 leading-relaxed">
            The web edition distinguishes established findings, sourced figures, interpretation, and frontier speculation. AI assisted the drafting process; Mayone Maha Rajan is responsible for the book’s argument, editorial decisions, and source verification. Chapters are released after a final claim-and-source review.
          </p>
        </section>
      </article>
    </main>
  )
}
