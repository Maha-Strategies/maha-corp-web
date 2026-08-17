import type { Metadata } from 'next'
import Link from 'next/link'

import { SITE_URL } from '@/lib/briefs-data'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: 'Celestial reports | Maha Strategies',
  description: 'Choose a reproducible birth or electional timing report, with declared methods, source passages, withheld rules, and interpretive boundaries.',
  alternates: { canonical: '/reports/celestial' },
}

const reports = [
  {
    href: '/knowledge/birth',
    eyebrow: 'Available now · natal',
    title: 'Birth pañcāṅga',
    description: 'Enter a local birth date, time, and place. The report resolves the historical time zone and computes the five calendrical limbs before applying separately named traditions.',
    action: 'Start a birth report',
  },
  {
    href: '/knowledge/muhurta',
    eyebrow: 'Available now · electional',
    title: 'Moment report',
    description: 'Inspect what the Jyotiṣa muhūrta corpus says about a chosen moment. Every applied rule includes its source passage, and every withheld rule remains visible.',
    action: 'Inspect a moment',
  },
] as const

export default function CelestialReportsPage() {
  return (
    <main className="min-h-screen bg-[#0a0a0c] px-6 py-16 text-zinc-300 selection:bg-violet-400 selection:text-black sm:px-12">
      <div className="mx-auto max-w-5xl">
        <nav aria-label="Breadcrumb" className="font-mono text-[10px] uppercase tracking-widest text-zinc-600">
          <Link href="/" className="hover:text-white">Maha Strategies</Link>
          <span className="px-2">/</span>
          <span className="text-zinc-400">Celestial reports</span>
        </nav>

        <header className="mt-10 border-b border-zinc-800 pb-10">
          <p className="font-mono text-[10px] uppercase tracking-widest text-violet-300">Reproducible inputs · named traditions · visible provenance</p>
          <h1 className="mt-6 max-w-4xl text-4xl font-bold tracking-tight text-white sm:text-6xl">Choose the report you actually need.</h1>
          <p className="mt-6 max-w-3xl font-serif text-lg leading-8 text-zinc-400">The current reports compute celestial and calendrical facts deterministically, then compile only the rules recorded for a declared tradition. They do not use a language model to invent interpretations.</p>
        </header>

        <section className="mt-8 grid gap-5 md:grid-cols-2" aria-label="Available reports">
          {reports.map((report) => (
            <article key={report.href} className="flex flex-col border border-zinc-800 bg-zinc-950/60 p-6">
              <p className="font-mono text-[10px] uppercase tracking-widest text-emerald-300">{report.eyebrow}</p>
              <h2 className="mt-4 text-2xl font-semibold text-white">{report.title}</h2>
              <p className="mt-3 flex-1 text-sm leading-6 text-zinc-400">{report.description}</p>
              <Link href={report.href} className="mt-7 self-start border border-violet-500 px-5 py-3 font-mono text-[10px] uppercase tracking-widest text-violet-300 hover:bg-violet-400 hover:text-black">{report.action} →</Link>
            </article>
          ))}
        </section>

        <section className="mt-8 border border-cyan-900/60 bg-cyan-950/10 p-6">
          <p className="font-mono text-[10px] uppercase tracking-widest text-cyan-300">Phase 2 · calibration in progress</p>
          <h2 className="mt-3 text-2xl font-semibold text-white">Predictive reports are not available yet.</h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-400">The forecasting layer can pre-register and score separate tropical and sidereal models against an ordinary baseline. It has not yet demonstrated predictive skill, so this site does not present a forecast as a validated result.</p>
        </section>

        <section className="mt-8 border-l-2 border-rose-500 bg-rose-950/10 p-6">
          <p className="font-mono text-[10px] uppercase tracking-widest text-rose-300">Interpretive boundary</p>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-300">Accurate source transcription is not empirical validation. Astrology reports are presented as inspectable cultural and interpretive traditions, not verified prediction or a basis for medical, legal, financial, or other high-stakes decisions.</p>
        </section>
      </div>
    </main>
  )
}
