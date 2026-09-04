import Link from 'next/link'

import AuthorityAnswerLinks from '@/app/knowledge/astrology/questions/AuthorityAnswerLinks'
import { SITE_URL } from '@/lib/briefs-data'
import {
  TROPICAL_SIDEREAL_COMPARISON_PATH,
  TROPICAL_SIDEREAL_COMPARISON_RELEASE_DATE,
  getTropicalSiderealComparison,
  getTropicalSiderealComparisonSource,
  tropicalSiderealComparisonPath,
  type TropicalSiderealComparison,
} from '@/lib/tropical-sidereal-comparisons'

export default function TropicalSiderealComparisonPage({ comparison }: { comparison: TropicalSiderealComparison }) {
  const sources = comparison.sourceIds.map(getTropicalSiderealComparisonSource).filter((source) => source !== undefined)
  const related = comparison.relatedSlugs.map(getTropicalSiderealComparison).filter((entry) => entry !== undefined)
  const path = tropicalSiderealComparisonPath(comparison)
  const jsonLd = {
    '@context': 'https://schema.org', '@type': 'TechArticle', headline: comparison.title,
    description: comparison.description, datePublished: TROPICAL_SIDEREAL_COMPARISON_RELEASE_DATE,
    dateModified: TROPICAL_SIDEREAL_COMPARISON_RELEASE_DATE, mainEntityOfPage: `${SITE_URL}${path}`,
    articleSection: comparison.category,
    author: { '@type': 'Organization', name: 'Maha Celestial', url: SITE_URL },
    publisher: { '@type': 'Organization', name: 'Maha Strategies', url: SITE_URL },
    citation: sources.map((source) => source.url),
  }

  return (
    <main className="min-h-screen bg-[#0a0a0c] px-6 py-16 text-zinc-300 selection:bg-violet-400 selection:text-black sm:px-12">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />
      <article className="mx-auto max-w-5xl">
        <nav aria-label="Breadcrumb" className="font-mono text-[10px] uppercase tracking-widest text-zinc-600"><Link href="/knowledge/astrology/tropical-vs-sidereal" className="hover:text-white">Tropical versus sidereal</Link><span className="px-2">/</span><Link href={TROPICAL_SIDEREAL_COMPARISON_PATH} className="hover:text-white">Comparisons</Link><span className="px-2">/</span><span className="text-zinc-400">{comparison.title}</span></nav>
        <header className="mt-10 border-b border-zinc-800 pb-10"><div className="flex flex-wrap items-center gap-3 font-mono text-[9px] uppercase tracking-widest"><span className="border border-violet-700/60 bg-violet-950/30 px-2 py-1 text-violet-300">{comparison.category}</span><span className="text-amber-300">Disagreement preserved</span><span className="text-rose-300">Parallel unvalidated models</span></div><h1 className="mt-6 text-4xl font-bold tracking-tight text-white sm:text-6xl">{comparison.title}</h1><p className="mt-6 max-w-3xl font-serif text-lg leading-8 text-zinc-300">{comparison.description}</p><p className="mt-5 font-mono text-[10px] uppercase tracking-widest text-zinc-600">Frame comparison · released {TROPICAL_SIDEREAL_COMPARISON_RELEASE_DATE}</p></header>

        <section className="mt-8 border border-cyan-900/60 bg-cyan-950/10 p-6"><h2 className="font-mono text-[10px] uppercase tracking-widest text-cyan-300">Shared fact substrate</h2><p className="mt-3 font-serif text-base leading-8 text-zinc-200">{comparison.sharedFacts}</p><h3 className="mt-6 font-mono text-[9px] uppercase tracking-widest text-zinc-500">Required shared inputs</h3><ul className="mt-4 grid gap-2 sm:grid-cols-2">{comparison.sharedInputs.map((input) => <li key={input} className="border-l border-cyan-800/70 pl-3 text-sm leading-6 text-zinc-300">{input}</li>)}</ul></section>

        <section className="mt-12 grid gap-5 md:grid-cols-2"><div className="border border-cyan-900/60 bg-cyan-950/10 p-6"><h2 className="font-mono text-[10px] uppercase tracking-widest text-cyan-300">Tropical view</h2><p className="mt-3 text-sm leading-7 text-zinc-300">{comparison.tropicalView}</p></div><div className="border border-violet-900/60 bg-violet-950/10 p-6"><h2 className="font-mono text-[10px] uppercase tracking-widest text-violet-300">Lahiri-sidereal view</h2><p className="mt-3 text-sm leading-7 text-zinc-300">{comparison.siderealView}</p></div></section>

        <section className="mt-12 grid gap-5 md:grid-cols-2"><div className="border border-emerald-900/60 p-6"><h2 className="font-mono text-[10px] uppercase tracking-widest text-emerald-300">Where they agree</h2><p className="mt-3 text-sm leading-7 text-zinc-300">{comparison.agreement}</p></div><div className="border border-amber-900/60 bg-amber-950/10 p-6"><h2 className="font-mono text-[10px] uppercase tracking-widest text-amber-300">Where they disagree</h2><p className="mt-3 text-sm leading-7 text-zinc-300">{comparison.disagreement}</p></div></section>

        <section className="mt-12 border border-zinc-800 p-6"><h2 className="text-xl font-semibold text-white">Preservation policy</h2><p className="mt-3 text-sm leading-7 text-zinc-300">{comparison.preservationPolicy}</p></section>
        <section className="mt-8 border-l-2 border-rose-500 bg-rose-950/10 p-6"><h2 className="font-mono text-[10px] uppercase tracking-widest text-rose-300">Prohibited synthesis</h2><p className="mt-3 text-sm leading-7 text-zinc-200">{comparison.prohibitedSynthesis}</p></section>
        <section className="mt-8 border border-violet-900/60 bg-violet-950/10 p-6"><h2 className="font-mono text-[10px] uppercase tracking-widest text-violet-300">What empirical comparison requires</h2><p className="mt-3 text-sm leading-7 text-zinc-200">{comparison.evaluationRequirement}</p></section>

        <section className="mt-12 border-t border-zinc-800 pt-8"><h2 className="text-2xl font-semibold text-white">Method sources</h2><p className="mt-3 text-sm leading-6 text-zinc-500">These sources define calculation and namespace policy. They do not determine which astrology system is true.</p><ol className="mt-6 space-y-5">{sources.map((source) => <li key={source.id} className="border-l border-zinc-700 pl-4"><a href={source.url} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-zinc-100 underline decoration-zinc-700 underline-offset-4 hover:text-white">{source.title}</a><p className="mt-1 font-mono text-[9px] uppercase tracking-widest text-zinc-600">{source.authority}</p><p className="mt-2 text-xs leading-5 text-zinc-500">{source.establishes}</p><p className="mt-1 text-xs leading-5 text-zinc-600"><span className="text-amber-400">Boundary:</span> {source.boundary}</p></li>)}</ol></section>
        {related.length > 0 && <section className="mt-12 border border-zinc-800 p-6"><h2 className="text-xl font-semibold text-white">Related comparisons</h2><div className="mt-5 flex flex-wrap gap-3">{related.map((entry) => <Link key={entry.slug} href={tropicalSiderealComparisonPath(entry)} className="border border-zinc-700 px-4 py-3 text-xs text-zinc-300 hover:border-violet-500 hover:text-violet-200">{entry.title} →</Link>)}</div></section>}
        <AuthorityAnswerLinks authorityId={`comparison:${comparison.slug}`} />
      </article>
    </main>
  )
}
