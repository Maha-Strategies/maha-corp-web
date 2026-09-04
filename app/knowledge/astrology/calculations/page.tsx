import type { Metadata } from 'next'
import Link from 'next/link'

import { SITE_URL } from '@/lib/briefs-data'
import {
  CALCULATION_REFERENCE_CATEGORIES,
  CALCULATION_REFERENCE_PATH,
  CALCULATION_REFERENCE_RELEASE_DATE,
  CALCULATION_REFERENCES,
  calculationReferencePath,
  getCalculationReferencesByCategory,
} from '@/lib/celestial-calculation-references'
import { ASTROLOGY_WORKFLOW_PATH } from '@/lib/astrology-workflow-protocols'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: 'Celestial Calculation and Convention References | Maha Celestial',
  description: 'Forty-two reproducible references for time, ephemerides, coordinate frames, zodiac conversions, houses, Pañcāṅga limbs, aspects, uncertainty, and provenance.',
  alternates: { canonical: CALCULATION_REFERENCE_PATH },
  openGraph: { type: 'website', title: 'Celestial Calculation and Convention References', description: 'Auditable calculation contracts with explicit conventions, uncertainty, sources, and interpretive boundaries.', url: `${SITE_URL}${CALCULATION_REFERENCE_PATH}`, siteName: 'Maha Celestial' },
}

export default function CalculationReferencesIndex() {
  const jsonLd = {
    '@context': 'https://schema.org', '@type': 'CollectionPage',
    name: 'Celestial Calculation and Convention References',
    description: metadata.description,
    url: `${SITE_URL}${CALCULATION_REFERENCE_PATH}`,
    dateModified: CALCULATION_REFERENCE_RELEASE_DATE,
    hasPart: CALCULATION_REFERENCES.map((entry) => ({ '@type': 'TechArticle', name: entry.title, url: `${SITE_URL}${calculationReferencePath(entry)}` })),
  }

  return (
    <main className="min-h-screen bg-[#0a0a0c] px-6 py-16 text-zinc-300 selection:bg-cyan-300 selection:text-black sm:px-12">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />
      <div className="mx-auto max-w-6xl">
        <nav aria-label="Breadcrumb" className="font-mono text-[10px] uppercase tracking-widest text-zinc-600">
          <Link href="/knowledge/astrology" className="hover:text-white">Astrology traditions</Link>
          <span className="px-2">/</span>
          <span className="text-zinc-400">Calculation references</span>
        </nav>

        <header className="mt-10 border-b border-zinc-800 pb-10">
          <p className="font-mono text-[10px] uppercase tracking-widest text-cyan-300">{CALCULATION_REFERENCES.length} calculation contracts · released {CALCULATION_REFERENCE_RELEASE_DATE}</p>
          <h1 className="mt-6 max-w-5xl text-4xl font-bold tracking-tight text-white sm:text-6xl">Celestial calculations, with every convention exposed</h1>
          <p className="mt-6 max-w-3xl font-serif text-lg leading-8 text-zinc-300">This library defines what each number means, how Maha calculates it, which inputs and versions reproduce it, how uncertainty affects boundaries, and where astronomical geometry ends. It is a calculation authority layer—not an automated interpretation matrix.</p>
        </header>

        <section className="mt-10 grid gap-4 md:grid-cols-3">
          <div className="border border-zinc-800 p-5"><p className="font-mono text-[9px] uppercase tracking-widest text-cyan-300">Continuous value first</p><p className="mt-3 text-sm leading-6 text-zinc-400">Longitude, time, separation, and uncertainty remain primary. Sign, house, tithi, or aspect labels are derived classifications.</p></div>
          <div className="border border-zinc-800 p-5"><p className="font-mono text-[9px] uppercase tracking-widest text-emerald-300">Versioned method</p><p className="mt-3 text-sm leading-6 text-zinc-400">Every result needs its ephemeris, frame, timescale, coordinate origin, software version, and convention choices.</p></div>
          <div className="border border-zinc-800 p-5"><p className="font-mono text-[9px] uppercase tracking-widest text-rose-300">No validity laundering</p><p className="mt-3 text-sm leading-6 text-zinc-400">An accurate calculation can support reproducibility without establishing that an astrological interpretation predicts reality.</p></div>
        </section>

        {CALCULATION_REFERENCE_CATEGORIES.map((category) => {
          const entries = getCalculationReferencesByCategory(category)
          return (
            <section key={category} className="mt-14 border-t border-zinc-800 pt-8">
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <h2 className="text-2xl font-semibold text-white">{category}</h2>
                <p className="font-mono text-[9px] uppercase tracking-widest text-zinc-600">{entries.length} references</p>
              </div>
              <div className="mt-6 grid gap-4 md:grid-cols-2">
                {entries.map((entry) => (
                  <Link key={entry.slug} href={calculationReferencePath(entry)} className="group border border-zinc-800 p-5 hover:border-cyan-600/60">
                    <div className="flex items-center justify-between gap-3 font-mono text-[9px] uppercase tracking-widest">
                      <span className={entry.implementationStatus === 'comparison-only' ? 'text-amber-400' : 'text-emerald-400'}>{entry.implementationStatus.replaceAll('-', ' ')}</span>
                      <span className="text-zinc-700 group-hover:text-cyan-400">Open →</span>
                    </div>
                    <h3 className="mt-3 text-lg font-semibold text-white">{entry.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-zinc-400">{entry.description}</p>
                  </Link>
                ))}
              </div>
            </section>
          )
        })}

        <section className="mt-14 flex flex-wrap gap-4 border-t border-zinc-800 pt-10 font-mono text-[10px] uppercase tracking-widest">
          <Link href={ASTROLOGY_WORKFLOW_PATH} className="border border-violet-700 px-4 py-3 text-violet-200 hover:bg-violet-300 hover:text-black">Worked protocols and receipts</Link>
          <Link href="/knowledge/celestial" className="border border-zinc-700 px-4 py-3 text-zinc-200 hover:border-cyan-400 hover:text-cyan-300">Celestial fact schema</Link>
          <Link href="/knowledge/astrology/tropical-vs-sidereal" className="border border-zinc-700 px-4 py-3 text-zinc-200 hover:border-cyan-400 hover:text-cyan-300">Compare zodiac frames</Link>
          <Link href="/reports/celestial" className="border border-cyan-700 px-4 py-3 text-cyan-200 hover:bg-cyan-300 hover:text-black">Calculate a report</Link>
        </section>
      </div>
    </main>
  )
}
