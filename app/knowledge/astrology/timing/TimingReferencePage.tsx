import Link from 'next/link'

import { SITE_URL } from '@/lib/briefs-data'
import {
  TIMING_REFERENCE_PATH,
  TIMING_REFERENCE_RELEASE_DATE,
  getTimingReference,
  getTimingReferenceSource,
  timingReferencePath,
  type TimingReference,
} from '@/lib/celestial-timing-references'

const statusLabel = {
  'production-derived': 'Calculated in production reports',
  'method-reference': 'Frozen reference method',
  'source-review-pending': 'Source review pending',
} as const

export default function TimingReferencePage({ reference }: { reference: TimingReference }) {
  const sources = reference.sourceIds.map(getTimingReferenceSource).filter((source) => source !== undefined)
  const related = reference.relatedSlugs.map(getTimingReference).filter((entry) => entry !== undefined)
  const path = timingReferencePath(reference)
  const jsonLd = {
    '@context': 'https://schema.org', '@type': 'TechArticle',
    headline: reference.title, description: reference.description,
    datePublished: TIMING_REFERENCE_RELEASE_DATE, dateModified: TIMING_REFERENCE_RELEASE_DATE,
    mainEntityOfPage: `${SITE_URL}${path}`, articleSection: reference.category,
    author: { '@type': 'Organization', name: 'Maha Celestial', url: SITE_URL },
    publisher: { '@type': 'Organization', name: 'Maha Strategies', url: SITE_URL },
    citation: sources.map((source) => source.url),
  }

  return (
    <main className="min-h-screen bg-[#0a0a0c] px-6 py-16 text-zinc-300 selection:bg-violet-400 selection:text-black sm:px-12">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />
      <article className="mx-auto max-w-4xl">
        <nav aria-label="Breadcrumb" className="font-mono text-[10px] uppercase tracking-widest text-zinc-600">
          <Link href="/knowledge/astrology" className="hover:text-white">Astrology traditions</Link><span className="px-2">/</span>
          <Link href={TIMING_REFERENCE_PATH} className="hover:text-white">Timing references</Link><span className="px-2">/</span>
          <span className="text-zinc-400">{reference.title}</span>
        </nav>

        <header className="mt-10 border-b border-zinc-800 pb-10">
          <div className="flex flex-wrap items-center gap-3 font-mono text-[9px] uppercase tracking-widest">
            <span className="border border-violet-700/60 bg-violet-950/30 px-2 py-1 text-violet-300">{reference.category}</span>
            <span className={reference.implementationStatus === 'source-review-pending' ? 'text-amber-400' : 'text-emerald-400'}>{statusLabel[reference.implementationStatus]}</span>
          </div>
          <h1 className="mt-6 text-4xl font-bold tracking-tight text-white sm:text-6xl">{reference.title}</h1>
          <p className="mt-6 max-w-3xl font-serif text-lg leading-8 text-zinc-300">{reference.description}</p>
          <p className="mt-5 font-mono text-[10px] uppercase tracking-widest text-zinc-600">Timing reference · released {TIMING_REFERENCE_RELEASE_DATE}</p>
        </header>

        <section className="mt-8 border border-violet-900/60 bg-violet-950/10 p-6">
          <h2 className="font-mono text-[10px] uppercase tracking-widest text-violet-300">Event definition</h2>
          <p className="mt-3 font-serif text-base leading-8 text-zinc-200">{reference.definition}</p>
        </section>

        <section className="mt-12 border-t border-zinc-800 pt-8">
          <h2 className="text-2xl font-semibold text-white">Reproducible calculation</h2>
          <p className="mt-4 font-serif text-base leading-8 text-zinc-400">{reference.calculation}</p>
          <h3 className="mt-7 font-mono text-[10px] uppercase tracking-widest text-zinc-500">Required inputs</h3>
          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {reference.requiredInputs.map((input) => <li key={input} className="border-l border-violet-800/70 pl-3 text-sm leading-6 text-zinc-300">{input}</li>)}
          </ul>
        </section>

        <section className="mt-12 grid gap-5 sm:grid-cols-2">
          <div className="border border-zinc-800 p-6"><h2 className="font-mono text-[10px] uppercase tracking-widest text-emerald-300">Maha convention</h2><p className="mt-3 text-sm leading-7 text-zinc-300">{reference.mahaConvention}</p></div>
          <div className="border border-zinc-800 p-6"><h2 className="font-mono text-[10px] uppercase tracking-widest text-amber-300">Uncertainty and edge cases</h2><p className="mt-3 text-sm leading-7 text-zinc-300">{reference.uncertainty}</p></div>
        </section>

        <section className="mt-12 border border-zinc-800 p-6">
          <h2 className="text-xl font-semibold text-white">How reports may use this reference</h2>
          <p className="mt-3 text-sm leading-7 text-zinc-300">{reference.reportUse}</p>
        </section>

        <section className="mt-12 border-l-2 border-rose-500 bg-rose-950/10 p-6">
          <h2 className="font-mono text-[10px] uppercase tracking-widest text-rose-300">What this does not establish</h2>
          <p className="mt-3 text-sm leading-7 text-zinc-200">{reference.doesNotEstablish}</p>
        </section>

        <section className="mt-12 border-t border-zinc-800 pt-8">
          <h2 className="text-2xl font-semibold text-white">Calculation and convention sources</h2>
          <p className="mt-3 text-sm leading-6 text-zinc-500">Sources establish astronomical states or a declared chronology convention. They do not establish predictive meaning.</p>
          <ol className="mt-6 space-y-5">
            {sources.map((source) => <li key={source.id} className="border-l border-zinc-700 pl-4"><a href={source.url} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-zinc-100 underline decoration-zinc-700 underline-offset-4 hover:text-white">{source.title}</a><p className="mt-1 font-mono text-[9px] uppercase tracking-widest text-zinc-600">{source.authority} · {source.version}</p><p className="mt-2 text-xs leading-5 text-zinc-500">{source.establishes}</p><p className="mt-1 text-xs leading-5 text-zinc-600"><span className="text-amber-400">Boundary:</span> {source.boundary}</p></li>)}
          </ol>
        </section>

        {related.length > 0 && <section className="mt-12 border border-zinc-800 p-6"><h2 className="text-xl font-semibold text-white">Related timing references</h2><div className="mt-5 flex flex-wrap gap-3">{related.map((entry) => <Link key={entry.slug} href={timingReferencePath(entry)} className="border border-zinc-700 px-4 py-3 text-xs text-zinc-300 hover:border-violet-500 hover:text-violet-200">{entry.title} →</Link>)}</div></section>}
      </article>
    </main>
  )
}
