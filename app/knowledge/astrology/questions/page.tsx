import type { Metadata } from 'next'
import Link from 'next/link'

import {
  ASTROLOGY_ANSWER_CATEGORIES,
  ASTROLOGY_ANSWER_GRAPH_DATE,
  ASTROLOGY_ANSWER_GRAPH_PATH,
  ASTROLOGY_ANSWER_GRAPH_REGISTRY_PATH,
  ASTROLOGY_ANSWER_GRAPH_VERSION,
  ASTROLOGY_ANSWER_PUBLIC_REGISTRY,
  ASTROLOGY_ANSWER_REGISTRY_DIGEST,
  ASTROLOGY_ANSWERS,
  astrologyAnswerPath,
} from '@/lib/astrology-answer-graph'
import { ASTROLOGY_PATH } from '@/lib/astrology-traditions'
import { ASTROLOGY_WORKFLOW_PATH, ASTROLOGY_WORKFLOW_PROTOCOLS } from '@/lib/astrology-workflow-protocols'
import { SITE_URL } from '@/lib/briefs-data'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: 'Astrology Questions: Calculation, Tradition, Timing, and Evidence',
  description: 'Thirty-six bounded answers that route astrology questions to calculation, timing, tradition, comparison, and organization-event authority contracts.',
  alternates: { canonical: ASTROLOGY_ANSWER_GRAPH_PATH },
  openGraph: {
    type: 'website',
    title: 'Astrology questions with explicit evidence boundaries',
    description: 'A deterministic answer graph that keeps celestial calculation, interpretive tradition, and empirical validation separate.',
    url: `${SITE_URL}${ASTROLOGY_ANSWER_GRAPH_PATH}`,
    siteName: 'Maha Strategies',
  },
}

export default function AstrologyQuestionsPage() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'Astrology questions with explicit evidence boundaries',
    description: metadata.description,
    url: `${SITE_URL}${ASTROLOGY_ANSWER_GRAPH_PATH}`,
    datePublished: ASTROLOGY_ANSWER_GRAPH_DATE,
    dateModified: ASTROLOGY_ANSWER_GRAPH_DATE,
    isPartOf: `${SITE_URL}${ASTROLOGY_PATH}`,
    about: ['astrology calculations', 'astrology traditions', 'celestial timing', 'evidence boundaries'],
    hasPart: ASTROLOGY_ANSWERS.map((answer) => ({ '@type': 'TechArticle', name: answer.question, url: `${SITE_URL}${astrologyAnswerPath(answer)}` })),
  }

  return (
    <main className="min-h-screen bg-[#0a0a0c] px-6 py-16 text-zinc-300 selection:bg-violet-300 selection:text-black sm:px-12">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />
      <div className="mx-auto max-w-6xl">
        <nav aria-label="Breadcrumb" className="font-mono text-[10px] uppercase tracking-widest text-zinc-600">
          <Link href="/knowledge" className="hover:text-white">Knowledge</Link><span className="px-2">/</span>
          <Link href={ASTROLOGY_PATH} className="hover:text-white">Astrology</Link><span className="px-2">/</span>
          <span className="text-zinc-400">Questions</span>
        </nav>

        <header className="mt-10 border-b border-zinc-800 pb-10">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-violet-300">Answer graph · {ASTROLOGY_ANSWER_GRAPH_VERSION}</p>
          <h1 className="mt-6 max-w-5xl text-4xl font-semibold tracking-tight text-white sm:text-6xl">Ask the method before asking for meaning.</h1>
          <p className="mt-6 max-w-4xl font-serif text-lg leading-8 text-zinc-300">Thirty-six practical questions connect calculation, timing, coordinate frames, traditions, and organization-event methods without collapsing them into one authority. These pages route to existing public contracts; they add no new predictive claim.</p>
        </header>

        <section className="mt-10 grid gap-4 md:grid-cols-3">
          <div className="border border-violet-900/60 bg-violet-950/10 p-5"><p className="font-mono text-[9px] uppercase tracking-widest text-violet-300">{ASTROLOGY_ANSWERS.length} bounded topics</p><p className="mt-3 text-sm leading-6 text-zinc-400">Each combines at least two authority families, preventing a duplicate paraphrase of one existing page.</p></div>
          <div className="border border-cyan-900/60 bg-cyan-950/10 p-5"><p className="font-mono text-[9px] uppercase tracking-widest text-cyan-300">{ASTROLOGY_ANSWER_PUBLIC_REGISTRY.counts.boundedQuestions} query forms</p><p className="mt-3 text-sm leading-6 text-zinc-400">Natural-language variants resolve to one stable answer identity and its declared authority paths.</p></div>
          <div className="border border-rose-900/60 bg-rose-950/10 p-5"><p className="font-mono text-[9px] uppercase tracking-widest text-rose-300">No prediction surface</p><p className="mt-3 text-sm leading-6 text-zinc-400">Calculation reproducibility, historical documentation, and empirical validation remain separate claims.</p></div>
        </section>

        <section className="mt-12 border-l-2 border-rose-500 bg-rose-950/10 p-6">
          <h2 className="font-mono text-[10px] uppercase tracking-widest text-rose-300">Answer boundary</h2>
          <p className="mt-3 max-w-4xl text-sm leading-7 text-zinc-300">This graph explains methods and records what named traditions hold. It does not provide a personalized reading, medical advice, legal advice, investment advice, or evidence that an astrological interpretation predicts an outcome.</p>
        </section>

        <Link href={ASTROLOGY_WORKFLOW_PATH} className="mt-8 block border border-cyan-800/70 bg-cyan-950/10 p-6 hover:border-cyan-500"><p className="font-mono text-[9px] uppercase tracking-widest text-cyan-300">From answer to operation · {ASTROLOGY_WORKFLOW_PROTOCOLS.length} protocols</p><h2 className="mt-3 text-xl font-semibold text-white">Use a worked workflow when explanation is not enough</h2><p className="mt-2 max-w-4xl text-sm leading-7 text-zinc-400">The protocol layer adds inputs, ordered execution, outputs, refusal conditions, completion tests, and deterministic receipts without repeating these explanatory answers.</p></Link>

        {ASTROLOGY_ANSWER_CATEGORIES.map((category) => {
          const answers = ASTROLOGY_ANSWERS.filter((answer) => answer.category === category)
          return <section key={category} className="mt-16"><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">Question family</p><h2 className="mt-3 text-3xl font-semibold text-white">{category}</h2></div><p className="font-mono text-[10px] uppercase tracking-widest text-zinc-600">{answers.length} answers</p></div><div className="mt-7 grid gap-5 md:grid-cols-2">{answers.map((answer) => <Link key={answer.slug} href={astrologyAnswerPath(answer)} className="group border border-zinc-800 p-6 hover:border-violet-500/60"><div className="flex flex-wrap items-center justify-between gap-3"><p className="font-mono text-[9px] uppercase tracking-widest text-violet-300">{answer.frame.replaceAll('-', ' ')}</p><p className="font-mono text-[9px] uppercase tracking-widest text-zinc-600">{answer.authorityIds.length} authority paths</p></div><h3 className="mt-3 text-xl font-semibold text-white group-hover:text-violet-200">{answer.question}</h3><p className="mt-3 text-sm leading-6 text-zinc-500">{answer.directAnswer}</p><p className="mt-5 font-mono text-[9px] uppercase tracking-widest text-zinc-600 group-hover:text-violet-300">Open bounded answer →</p></Link>)}</div></section>
        })}

        <section className="mt-16 border border-zinc-800 p-6">
          <div className="grid gap-6 sm:grid-cols-3"><div><p className="font-mono text-[9px] uppercase tracking-widest text-zinc-600">Topics</p><p className="mt-2 text-2xl font-semibold text-white">{ASTROLOGY_ANSWERS.length}</p></div><div><p className="font-mono text-[9px] uppercase tracking-widest text-zinc-600">Authority links</p><p className="mt-2 text-2xl font-semibold text-white">{ASTROLOGY_ANSWER_PUBLIC_REGISTRY.counts.authorityLinks}</p></div><div><p className="font-mono text-[9px] uppercase tracking-widest text-zinc-600">Registry digest</p><p className="mt-2 break-all font-mono text-xs text-zinc-400">{ASTROLOGY_ANSWER_REGISTRY_DIGEST}</p></div></div>
          <a href={ASTROLOGY_ANSWER_GRAPH_REGISTRY_PATH} className="mt-6 inline-block border border-violet-700 px-4 py-3 font-mono text-[10px] uppercase tracking-widest text-violet-300 hover:bg-violet-300 hover:text-black">Open machine-readable registry →</a>
        </section>
      </div>
    </main>
  )
}
