import type { Metadata } from 'next'
import Link from 'next/link'

import { SITE_URL } from '@/lib/briefs-data'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: 'Maha Celestial | Reproducible celestial reports',
  description: 'Reproducible celestial computation, tradition-aware reports, source passages, and cryptographically verifiable Evidence Bundles.',
  alternates: { canonical: '/celestial' },
}

export default function MahaCelestialPage() {
  return (
    <main className="min-h-screen bg-[#07070b] px-6 py-16 text-zinc-300 selection:bg-violet-400 selection:text-black sm:px-12">
      <div className="mx-auto max-w-5xl">
        <nav className="font-mono text-[10px] uppercase tracking-widest text-violet-300" aria-label="Product identity">Maha Celestial</nav>
        <header className="mt-10 border-b border-zinc-800 pb-12">
          <p className="font-mono text-[10px] uppercase tracking-widest text-emerald-300">Calculation certified · traditions named · sources inspectable</p>
          <h1 className="mt-6 max-w-4xl text-5xl font-bold tracking-tight text-white sm:text-7xl">Celestial reports you can inspect, reproduce, and verify.</h1>
          <p className="mt-7 max-w-3xl font-serif text-xl leading-9 text-zinc-400">Maha Celestial certifies how a chart was calculated, which tradition supplied each interpretation, and where the interpretation came from. It does not certify that astrology predicts events.</p>
          <div className="mt-8 flex flex-wrap gap-3 font-mono text-[10px] uppercase tracking-widest">
            <Link href="/celestial/birth" className="border border-violet-500 bg-violet-500 px-5 py-3 text-black hover:bg-violet-300">Create a birth report</Link>
            <Link href="/celestial/verify" className="border border-zinc-700 px-5 py-3 text-zinc-200 hover:border-white">Verify an evidence bundle</Link>
          </div>
        </header>

        <section className="mt-10 grid gap-4 md:grid-cols-3" aria-label="Evidence layers">
          {[
            ['Astronomical facts', 'Resolved UTC instant, observer coordinates, celestial positions, precision, software, and calculation provenance.'],
            ['Declared conventions', 'Zodiac frame, ayanāṁśa, house system, node model, aspect profile, and timing methods remain explicit.'],
            ['Tradition records', 'Every interpretation names one tradition, applicable rule, verbatim source passage, disagreement, and boundary.'],
          ].map(([title, copy]) => <article key={title} className="border border-zinc-800 bg-zinc-950/60 p-5"><h2 className="text-xl font-semibold text-white">{title}</h2><p className="mt-3 text-sm leading-6 text-zinc-500">{copy}</p></article>)}
        </section>

        <section className="mt-8 border border-emerald-800/60 bg-emerald-950/10 p-6">
          <p className="font-mono text-[10px] uppercase tracking-widest text-emerald-300">Evidence Bundle v0.1</p>
          <h2 className="mt-3 text-3xl font-semibold text-white">The report and its audit trail travel together.</h2>
          <p className="mt-4 max-w-3xl text-sm leading-6 text-zinc-400">Every generated birth report now includes a downloadable canonical JSON artifact. A SHA-256 digest detects changes; a configured dedicated Maha Celestial key adds a detached issuer signature; the verifier distinguishes those states rather than treating them as equivalent.</p>
        </section>

        <section className="mt-8 border-l-2 border-rose-500 bg-rose-950/10 p-6">
          <p className="font-mono text-[10px] uppercase tracking-widest text-rose-300">Separate product boundary</p>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-300">Maha Celestial is a distinct interpretive product vertical. It is not part of Maha Strategies&apos; enterprise AI Gateway, security guidance, or technical decision methodology. The products share internal provenance infrastructure, not evidentiary claims.</p>
        </section>
      </div>
    </main>
  )
}

