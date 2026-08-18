import type { Metadata } from 'next'
import Link from 'next/link'

import { SITE_URL } from '@/lib/briefs-data'
import {
  TROPICAL_SIDEREAL_COMPARISON_CATEGORIES,
  TROPICAL_SIDEREAL_COMPARISON_PATH,
  TROPICAL_SIDEREAL_COMPARISON_RELEASE_DATE,
  TROPICAL_SIDEREAL_COMPARISONS,
  getTropicalSiderealComparisonsByCategory,
  tropicalSiderealComparisonPath,
} from '@/lib/tropical-sidereal-comparisons'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: 'Tropical–Sidereal Comparisons | Maha Celestial',
  description: 'Twelve bounded comparisons that keep tropical and Lahiri-sidereal facts, techniques, interpretations, disagreements, and evaluation policies separate.',
  alternates: { canonical: TROPICAL_SIDEREAL_COMPARISON_PATH },
  openGraph: {
    type: 'website', title: 'Tropical–Sidereal Comparison Library',
    description: 'Parallel chart frames with shared inputs, explicit disagreements, and no hidden synthesis.',
    url: `${SITE_URL}${TROPICAL_SIDEREAL_COMPARISON_PATH}`, siteName: 'Maha Celestial',
  },
}

export default function TropicalSiderealComparisonIndex() {
  const jsonLd = {
    '@context': 'https://schema.org', '@type': 'CollectionPage', name: 'Tropical–Sidereal Comparison Library',
    description: metadata.description, url: `${SITE_URL}${TROPICAL_SIDEREAL_COMPARISON_PATH}`,
    dateModified: TROPICAL_SIDEREAL_COMPARISON_RELEASE_DATE,
    hasPart: TROPICAL_SIDEREAL_COMPARISONS.map((entry) => ({ '@type': 'TechArticle', name: entry.title, url: `${SITE_URL}${tropicalSiderealComparisonPath(entry)}` })),
  }

  return (
    <main className="min-h-screen bg-[#0a0a0c] px-6 py-16 text-zinc-300 selection:bg-violet-400 selection:text-black sm:px-12">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />
      <div className="mx-auto max-w-6xl">
        <nav aria-label="Breadcrumb" className="font-mono text-[10px] uppercase tracking-widest text-zinc-600"><Link href="/knowledge/astrology" className="hover:text-white">Astrology traditions</Link><span className="px-2">/</span><Link href="/knowledge/astrology/tropical-vs-sidereal" className="hover:text-white">Tropical versus sidereal</Link><span className="px-2">/</span><span className="text-zinc-400">Comparisons</span></nav>
        <header className="mt-10 border-b border-zinc-800 pb-10">
          <p className="font-mono text-[10px] uppercase tracking-widest text-violet-300">{TROPICAL_SIDEREAL_COMPARISONS.length} bounded comparisons · released {TROPICAL_SIDEREAL_COMPARISON_RELEASE_DATE}</p>
          <h1 className="mt-6 max-w-5xl text-4xl font-bold tracking-tight text-white sm:text-6xl">Preserve the disagreement. Test the models separately.</h1>
          <p className="mt-6 max-w-3xl font-serif text-lg leading-8 text-zinc-300">Tropical and sidereal systems can share one celestial substrate while disagreeing about labels, chronology, technique eligibility, and interpretation. This collection records those disagreements without averaging them into an unnamed synthesis.</p>
        </header>

        <section className="mt-10 grid gap-4 md:grid-cols-3">
          <div className="border border-zinc-800 p-5"><p className="font-mono text-[9px] uppercase tracking-widest text-cyan-300">One substrate</p><p className="mt-3 text-sm leading-6 text-zinc-400">One instant, observer, ephemeris, physical state, numerical policy, and provenance bundle feed both derived views.</p></div>
          <div className="border border-zinc-800 p-5"><p className="font-mono text-[9px] uppercase tracking-widest text-violet-300">Two namespaces</p><p className="mt-3 text-sm leading-6 text-zinc-400">Signs, houses, rulers, techniques, rules, forecasts, and scores remain labelled by frame and tradition.</p></div>
          <div className="border border-zinc-800 p-5"><p className="font-mono text-[9px] uppercase tracking-widest text-rose-300">No tie-break by story</p><p className="mt-3 text-sm leading-6 text-zinc-400">A known event, appealing narrative, or favorable chart cannot decide which frame the system reports.</p></div>
        </section>

        {TROPICAL_SIDEREAL_COMPARISON_CATEGORIES.map((category) => {
          const entries = getTropicalSiderealComparisonsByCategory(category)
          return <section key={category} className="mt-14 border-t border-zinc-800 pt-8"><div className="flex flex-wrap items-baseline justify-between gap-3"><h2 className="text-2xl font-semibold text-white">{category}</h2><p className="font-mono text-[9px] uppercase tracking-widest text-zinc-600">{entries.length} comparisons</p></div><div className="mt-6 grid gap-4 md:grid-cols-2">{entries.map((entry) => <Link key={entry.slug} href={tropicalSiderealComparisonPath(entry)} className="group border border-zinc-800 p-5 hover:border-violet-600/60"><div className="flex items-center justify-between gap-3 font-mono text-[9px] uppercase tracking-widest"><span className="text-amber-300">Disagreement preserved</span><span className="text-zinc-700 group-hover:text-violet-400">Open →</span></div><h3 className="mt-3 text-lg font-semibold text-white">{entry.title}</h3><p className="mt-2 text-sm leading-6 text-zinc-400">{entry.description}</p></Link>)}</div></section>
        })}

        <section className="mt-14 flex flex-wrap gap-4 border-t border-zinc-800 pt-10 font-mono text-[10px] uppercase tracking-widest"><Link href="/knowledge/birth" className="border border-violet-700 px-4 py-3 text-violet-200 hover:bg-violet-300 hover:text-black">Calculate both chart frames</Link><Link href="/knowledge/astrology/lahiri-ayanamsa" className="border border-zinc-700 px-4 py-3 hover:border-cyan-400 hover:text-cyan-300">Inspect Lahiri conversion</Link></section>
      </div>
    </main>
  )
}
