import type { Metadata } from 'next'
import Link from 'next/link'

import { SITE_URL } from '@/lib/briefs-data'
import {
  CELESTIAL_AUTHORITY_SOURCES,
  CELESTIAL_FACT_PATH,
  CELESTIAL_FACT_RELEASE_DATE,
  CELESTIAL_FACT_SCHEMA_PATH,
  CELESTIAL_FACT_SCHEMA_VERSION,
} from '@/lib/celestial-facts'
import { ASTRONOMY_ARTICLES, ASTRONOMY_KNOWLEDGE_PATH } from '@/lib/astronomy-knowledge'

export const metadata: Metadata = {
  title: 'Celestial Fact Layer | Maha Knowledge',
  description: 'A source-governed contract for reproducible celestial time, observer, ephemeris, reference-frame, coordinate, correction, and provenance records.',
  alternates: { canonical: CELESTIAL_FACT_PATH },
  openGraph: {
    title: 'Celestial Fact Layer | Maha Knowledge',
    description: 'Coordinates before conclusions: a pristine factual substrate for future astronomy and interpretive systems.',
    url: `${SITE_URL}${CELESTIAL_FACT_PATH}`,
    siteName: 'Maha Strategies',
    images: [{ url: '/og-master.png', width: 1200, height: 630, alt: 'Maha Strategies Celestial Fact Layer' }],
  },
}

const pipeline = [
  ['01', 'Resolve civil time', 'Preserve the entered local time, IANA zone, database release, selected UTC offset, daylight-saving fold decision, and resolved UTC instant.'],
  ['02', 'Fix the observer', 'Record WGS 84 latitude and longitude, elevation reference, units, and location uncertainty. A city name is not a computational location.'],
  ['03', 'Name the ephemeris', 'Retain the authority, service or kernel release, object identifier, observing center, exact request parameters, retrieval time, and raw-response digest.'],
  ['04', 'Declare the reference', 'State origin, frame, epoch, equinox, time scale, coordinate representation, position type, and every applied or omitted correction.'],
  ['05', 'Freeze the fact', 'Store values with units, precision and uncertainty; preserve limitations; canonicalize the bundle so an independent system can reproduce and compare it.'],
] as const

const requiredGroups = [
  ['Time identity', 'UTC instant · ephemeris time scale · civil-time provenance · leap-second source · Earth-orientation source'],
  ['Observer identity', 'Latitude · longitude · horizontal CRS · elevation · elevation reference · horizontal and vertical uncertainty'],
  ['Target identity', 'Human-readable name plus an authority identifier such as a JPL/NAIF object code'],
  ['Reference contract', 'Origin · frame · epoch · equinox · representation · geometric/astrometric/apparent position type'],
  ['Corrections', 'Light time · stellar aberration · gravitational deflection · atmospheric refraction'],
  ['Provenance', 'Provider source · request URL and parameters · response SHA-256 · retrieval timestamp · software version · limitations'],
] as const

const excluded = [
  'No physical explanation, object biography, cosmology, or stellar evolution is stored inside a fact bundle; those belong to the separate Astronomy layer.',
  'No zodiac, house, aspect, dignity, rulership, ayanamsa, or interpretive rule is part of this schema.',
  'No generated celestial position is published unless it preserves an authoritative provider response and reproducible calculation contract.',
  'No accuracy is inferred from decimal places. Precision, uncertainty, provider limitations, and transformation choices remain separate fields.',
] as const

export default function CelestialFactLayerPage() {
  const jsonLd = {
    '@context': 'https://schema.org', '@type': 'Dataset',
    name: 'Maha Celestial Fact Layer', description: metadata.description,
    url: `${SITE_URL}${CELESTIAL_FACT_PATH}`, datePublished: CELESTIAL_FACT_RELEASE_DATE, dateModified: CELESTIAL_FACT_RELEASE_DATE,
    version: CELESTIAL_FACT_SCHEMA_VERSION,
    creator: { '@type': 'Organization', name: 'Maha Strategies', url: SITE_URL },
    isBasedOn: CELESTIAL_AUTHORITY_SOURCES.map((source) => source.url),
    distribution: { '@type': 'DataDownload', encodingFormat: 'application/schema+json', contentUrl: `${SITE_URL}${CELESTIAL_FACT_SCHEMA_PATH}` },
  }

  return (
    <main className="min-h-screen bg-[#08090c] text-zinc-300 selection:bg-sky-300 selection:text-black">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />

      <section className="relative overflow-hidden border-b border-sky-950 px-6 py-20 sm:px-12">
        <div className="absolute inset-0 opacity-40 [background-image:radial-gradient(circle_at_18%_24%,rgba(56,189,248,0.16),transparent_26%),radial-gradient(circle_at_80%_10%,rgba(129,140,248,0.12),transparent_22%)]" />
        <div className="relative mx-auto max-w-6xl">
          <nav className="font-mono text-[10px] uppercase tracking-widest text-zinc-600"><Link href="/knowledge" className="hover:text-white">Knowledge</Link><span className="px-2">/</span><span className="text-sky-300">Celestial facts</span></nav>
          <div className="mt-10 grid gap-12 lg:grid-cols-[1.5fr_0.8fr] lg:items-end">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.24em] text-sky-300">[ Source layer // {CELESTIAL_FACT_SCHEMA_VERSION} ]</p>
              <h1 className="mt-6 max-w-4xl text-5xl font-semibold tracking-tight text-white sm:text-7xl">Coordinates before conclusions.</h1>
              <p className="mt-7 max-w-3xl font-serif text-lg leading-8 text-zinc-400">The Celestial Fact Layer records what was calculated, for which instant and observer, in which frame, using which authority and corrections. It is deliberately incapable of explaining the universe or interpreting a chart.</p>
              <div className="mt-8 flex flex-wrap gap-3">
                <a href={CELESTIAL_FACT_SCHEMA_PATH} className="border border-sky-400 bg-sky-400 px-5 py-3 font-mono text-[10px] font-bold uppercase tracking-widest text-black hover:bg-white">Open machine-readable schema →</a>
                <a href="#sources" className="border border-zinc-700 px-5 py-3 font-mono text-[10px] uppercase tracking-widest text-zinc-300 hover:border-sky-500 hover:text-sky-200">Inspect source authorities ↓</a>
              </div>
            </div>
            <div className="border border-sky-900/60 bg-sky-950/10 p-6 font-mono text-xs leading-7 text-zinc-500">
              <p className="text-sky-200">Layer status: foundational</p>
              <p>{CELESTIAL_AUTHORITY_SOURCES.length} registered authority contracts</p>
              <p>UTC, TAI, TT, TDB and UT1 preserved</p>
              <p>Topocentric and origin-aware records</p>
              <p>Interpretation fields: prohibited</p>
              <p className="mt-4 border-t border-zinc-800 pt-4 text-emerald-300">Astronomy knowledge layer: live and separate</p>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-zinc-900 px-6 py-16 sm:px-12">
        <div className="mx-auto max-w-6xl">
          <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">Reproducibility pipeline</p>
          <div className="mt-7 grid gap-px border border-zinc-800 bg-zinc-800 lg:grid-cols-5">
            {pipeline.map(([number, title, detail]) => <article key={number} className="bg-[#08090c] p-5"><p className="font-mono text-xs text-sky-300">{number}</p><h2 className="mt-4 font-semibold text-white">{title}</h2><p className="mt-3 text-sm leading-6 text-zinc-500">{detail}</p></article>)}
          </div>
        </div>
      </section>

      <section className="px-6 py-16 sm:px-12">
        <div className="mx-auto grid max-w-6xl gap-14 lg:grid-cols-[1fr_1fr]">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-widest text-sky-300">Record contract</p>
            <h2 className="mt-3 text-3xl font-semibold text-white">Nothing important is implicit.</h2>
            <div className="mt-7 space-y-3">
              {requiredGroups.map(([title, detail]) => <article key={title} className="border border-zinc-800 bg-zinc-950/50 p-5"><h3 className="font-mono text-[10px] uppercase tracking-widest text-zinc-300">{title}</h3><p className="mt-3 text-sm leading-6 text-zinc-500">{detail}</p></article>)}
            </div>
          </div>
          <div>
            <p className="font-mono text-[10px] uppercase tracking-widest text-amber-300">Hard boundary</p>
            <h2 className="mt-3 text-3xl font-semibold text-white">What this release refuses to do.</h2>
            <div className="mt-7 border border-amber-900/50 bg-amber-950/10 p-6">
              <ul className="space-y-5 text-sm leading-6 text-zinc-400">{excluded.map((item) => <li key={item} className="border-l border-amber-700/60 pl-4">{item}</li>)}</ul>
            </div>
            <div className="mt-6 border border-zinc-800 p-6">
              <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">Future compatibility</p>
              <p className="mt-3 text-sm leading-6 text-zinc-400">Astronomy and any later interpretive tradition may reference an immutable fact bundle. Neither layer may rewrite its time resolution, observer, coordinate frame, correction choices, or provider provenance.</p>
              <Link href={ASTRONOMY_KNOWLEDGE_PATH} className="mt-5 inline-block font-mono text-[10px] uppercase tracking-widest text-sky-300 hover:text-white">Explore {ASTRONOMY_ARTICLES.length} Astronomy explainers →</Link>
            </div>
          </div>
        </div>
      </section>

      <section id="sources" className="border-t border-zinc-900 px-6 py-16 sm:px-12">
        <div className="mx-auto max-w-6xl">
          <p className="font-mono text-[10px] uppercase tracking-widest text-sky-300">Authority registry</p>
          <div className="mt-3 flex flex-wrap items-end justify-between gap-4"><h2 className="text-3xl font-semibold text-white">Every source has a job—and a boundary.</h2><span className="font-mono text-[10px] uppercase tracking-widest text-zinc-600">Verified {CELESTIAL_FACT_RELEASE_DATE}</span></div>
          <div className="mt-7 grid gap-4 md:grid-cols-2">
            {CELESTIAL_AUTHORITY_SOURCES.map((source) => <article key={source.id} className="border border-zinc-800 bg-zinc-950/50 p-6"><div className="flex flex-wrap justify-between gap-3 font-mono text-[9px] uppercase tracking-widest"><span className="text-sky-300">{source.role.replaceAll('-', ' ')}</span><span className="text-zinc-600">{source.version}</span></div><h3 className="mt-4 text-lg font-semibold text-white"><a href={source.url} target="_blank" rel="noopener noreferrer" className="hover:text-sky-200">{source.authority} · {source.title} ↗</a></h3><p className="mt-4 text-sm leading-6 text-zinc-400">{source.establishes}</p><p className="mt-4 border-l border-amber-700/60 pl-3 text-xs leading-5 text-zinc-500"><span className="text-amber-300">Boundary:</span> {source.boundary}</p></article>)}
          </div>
        </div>
      </section>
    </main>
  )
}
