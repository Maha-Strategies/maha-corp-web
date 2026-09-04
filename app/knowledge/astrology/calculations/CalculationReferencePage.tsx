import Link from 'next/link'

import AuthorityAnswerLinks from '@/app/knowledge/astrology/questions/AuthorityAnswerLinks'
import { SITE_URL } from '@/lib/briefs-data'
import {
  CALCULATION_REFERENCE_PATH,
  CALCULATION_REFERENCE_RELEASE_DATE,
  calculationReferencePath,
  getCalculationReference,
  getCalculationReferenceSource,
  type CalculationReference,
} from '@/lib/celestial-calculation-references'

const statusLabels = {
  'production-contract': 'Implemented in production',
  'validation-contract': 'Validation and provenance contract',
  'comparison-only': 'Documented comparison; not production output',
} as const

export default function CalculationReferencePage({ reference }: { reference: CalculationReference }) {
  const sources = reference.sourceIds.map(getCalculationReferenceSource).filter((source) => source !== undefined)
  const related = reference.relatedSlugs.map(getCalculationReference).filter((entry) => entry !== undefined)
  const path = calculationReferencePath(reference)
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'TechArticle',
    headline: reference.title,
    description: reference.description,
    datePublished: CALCULATION_REFERENCE_RELEASE_DATE,
    dateModified: CALCULATION_REFERENCE_RELEASE_DATE,
    mainEntityOfPage: `${SITE_URL}${path}`,
    articleSection: reference.category,
    author: { '@type': 'Organization', name: 'Maha Celestial', url: SITE_URL },
    publisher: { '@type': 'Organization', name: 'Maha Strategies', url: SITE_URL },
    citation: sources.map((source) => source.url),
  }

  return (
    <main className="min-h-screen bg-[#0a0a0c] px-6 py-16 text-zinc-300 selection:bg-cyan-300 selection:text-black sm:px-12">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />
      <article className="mx-auto max-w-4xl">
        <nav aria-label="Breadcrumb" className="font-mono text-[10px] uppercase tracking-widest text-zinc-600">
          <Link href="/knowledge/astrology" className="hover:text-white">Astrology traditions</Link>
          <span className="px-2">/</span>
          <Link href={CALCULATION_REFERENCE_PATH} className="hover:text-white">Calculation references</Link>
          <span className="px-2">/</span>
          <span className="text-zinc-400">{reference.title}</span>
        </nav>

        <header className="mt-10 border-b border-zinc-800 pb-10">
          <div className="flex flex-wrap items-center gap-3 font-mono text-[9px] uppercase tracking-widest">
            <span className="border border-cyan-700/60 bg-cyan-950/30 px-2 py-1 text-cyan-300">{reference.category}</span>
            <span className={reference.implementationStatus === 'comparison-only' ? 'text-amber-400' : 'text-emerald-400'}>{statusLabels[reference.implementationStatus]}</span>
          </div>
          <h1 className="mt-6 text-4xl font-bold tracking-tight text-white sm:text-6xl">{reference.title}</h1>
          <p className="mt-6 max-w-3xl font-serif text-lg leading-8 text-zinc-300">{reference.description}</p>
          <p className="mt-5 font-mono text-[10px] uppercase tracking-widest text-zinc-600">Calculation contract · released {CALCULATION_REFERENCE_RELEASE_DATE}</p>
        </header>

        <section className="mt-8 border border-cyan-900/60 bg-cyan-950/10 p-6">
          <h2 className="font-mono text-[10px] uppercase tracking-widest text-cyan-300">Definition</h2>
          <p className="mt-3 font-serif text-base leading-8 text-zinc-200">{reference.definition}</p>
        </section>

        <section className="mt-12 border-t border-zinc-800 pt-8">
          <h2 className="text-2xl font-semibold text-white">Calculation procedure</h2>
          <p className="mt-4 font-serif text-base leading-8 text-zinc-400">{reference.procedure}</p>
          <h3 className="mt-7 font-mono text-[10px] uppercase tracking-widest text-zinc-500">Required inputs</h3>
          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {reference.inputs.map((input) => <li key={input} className="border-l border-cyan-800/70 pl-3 text-sm leading-6 text-zinc-300">{input}</li>)}
          </ul>
        </section>

        <section className="mt-12 grid gap-5 sm:grid-cols-2">
          <div className="border border-zinc-800 p-6">
            <h2 className="font-mono text-[10px] uppercase tracking-widest text-emerald-300">Maha convention</h2>
            <p className="mt-3 text-sm leading-7 text-zinc-300">{reference.recordedConvention}</p>
          </div>
          <div className="border border-zinc-800 p-6">
            <h2 className="font-mono text-[10px] uppercase tracking-widest text-amber-300">Uncertainty and edge cases</h2>
            <p className="mt-3 text-sm leading-7 text-zinc-300">{reference.uncertainty}</p>
          </div>
        </section>

        <section className="mt-12 border-l-2 border-rose-500 bg-rose-950/10 p-6">
          <h2 className="font-mono text-[10px] uppercase tracking-widest text-rose-300">What this does not establish</h2>
          <p className="mt-3 text-sm leading-7 text-zinc-200">{reference.doesNotEstablish}</p>
        </section>

        <section className="mt-12 border-t border-zinc-800 pt-8">
          <h2 className="text-2xl font-semibold text-white">Authoritative references</h2>
          <p className="mt-3 text-sm leading-6 text-zinc-500">These sources establish the calculation vocabulary, data product, or transformation convention. They do not establish astrological interpretation.</p>
          <ol className="mt-6 space-y-5">
            {sources.map((source) => (
              <li key={source.id} className="border-l border-zinc-700 pl-4">
                <a href={source.url} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-zinc-100 underline decoration-zinc-700 underline-offset-4 hover:text-white">{source.title}</a>
                <p className="mt-1 font-mono text-[9px] uppercase tracking-widest text-zinc-600">{source.authority} · {source.version}</p>
                <p className="mt-2 text-xs leading-5 text-zinc-500">{source.establishes}</p>
                <p className="mt-1 text-xs leading-5 text-zinc-600"><span className="text-amber-400">Boundary:</span> {source.boundary}</p>
              </li>
            ))}
          </ol>
        </section>

        {related.length > 0 && (
          <section className="mt-12 border border-zinc-800 p-6">
            <h2 className="text-xl font-semibold text-white">Related calculation contracts</h2>
            <div className="mt-5 flex flex-wrap gap-3">
              {related.map((entry) => <Link key={entry.slug} href={calculationReferencePath(entry)} className="border border-zinc-700 px-4 py-3 text-xs text-zinc-300 hover:border-cyan-500 hover:text-cyan-200">{entry.title} →</Link>)}
            </div>
          </section>
        )}
        <AuthorityAnswerLinks authorityId={`calculation:${reference.slug}`} />
      </article>
    </main>
  )
}
