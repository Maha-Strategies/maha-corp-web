import type { Metadata } from 'next'
import Link from 'next/link'

import BirthForm from '@/app/knowledge/birth/BirthForm'
import { ASTROLOGY_PATH, ASTROLOGY_PROHIBITED_USES } from '@/lib/astrology-traditions'
import { BIRTH_REPORT_VERSION } from '@/lib/birth-report'
import { SITE_URL } from '@/lib/briefs-data'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: 'Evidence-bound birth report | Maha Celestial',
  description: 'A reproducible birth chart and timing map with declared conventions, source-bound traditions, withheld rules, and a downloadable Evidence Bundle.',
  alternates: { canonical: '/celestial/birth' },
  robots: { index: true, follow: true },
}

export default function CelestialBirthPage() {
  return (
    <main className="min-h-screen bg-[#07070b] px-6 py-16 text-zinc-300 selection:bg-violet-400 selection:text-black sm:px-12">
      <div className="mx-auto max-w-5xl">
        <nav aria-label="Maha Celestial breadcrumb" className="font-mono text-[10px] uppercase tracking-widest text-zinc-600"><Link href="/celestial" className="text-violet-300 hover:text-white">Maha Celestial</Link><span className="px-2">/</span><span>Birth report</span></nav>
        <header className="mt-10 border-b border-zinc-800 pb-10">
          <p className="font-mono text-[10px] uppercase tracking-widest text-violet-300">{BIRTH_REPORT_VERSION} · Evidence Bundle attached</p>
          <h1 className="mt-6 text-4xl font-bold tracking-tight text-white sm:text-6xl">Evidence-bound birth report</h1>
          <p className="mt-6 max-w-3xl font-serif text-lg leading-8 text-zinc-400">Compute the chart once, inspect each epistemic layer separately, and download the exact facts, conventions, rules, passages, exclusions, and integrity proof behind the result.</p>
        </header>

        <BirthForm />

        <section className="mt-8 border-l-2 border-rose-500 bg-rose-950/10 p-6">
          <h2 className="font-mono text-[10px] uppercase tracking-widest text-rose-300">Certification boundary</h2>
          <div className="mt-3 max-w-3xl space-y-3 text-sm leading-6 text-zinc-300"><p><strong className="text-white">Calculations are reproducible.</strong> The artifact records the resolved instant, observer, software versions, coordinate frame, zodiac conventions, and computed geometry.</p><p><strong className="text-white">Interpretations remain unvalidated tradition.</strong> A valid digest or signature does not turn a historical source claim into empirical evidence.</p></div>
        </section>

        <section className="mt-8 border border-zinc-800 bg-zinc-950/60 p-6">
          <h2 className="font-mono text-[10px] uppercase tracking-widest text-zinc-400">Prohibited uses</h2>
          <ul className="mt-4 grid gap-2 sm:grid-cols-2">{ASTROLOGY_PROHIBITED_USES.map((use) => <li key={use} className="border-l border-rose-900/60 pl-3 text-sm leading-6 text-zinc-400">{use}</li>)}</ul>
        </section>

        <section className="mt-10 flex flex-wrap gap-3 border-t border-zinc-800 pt-8 font-mono text-[10px] uppercase tracking-widest"><Link href="/celestial/verify" className="border border-zinc-700 px-4 py-3 hover:border-white">Verify a bundle</Link><Link href={ASTROLOGY_PATH} className="border border-zinc-700 px-4 py-3 hover:border-white">Inspect traditions and sources</Link></section>
      </div>
    </main>
  )
}

