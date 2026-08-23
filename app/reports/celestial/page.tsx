import type { Metadata } from 'next'
import Link from 'next/link'

import { SITE_URL } from '@/lib/briefs-data'
import { CELESTIAL_GUIDE_LIST } from '@/lib/celestial-guides'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: 'Celestial reports | Maha Strategies',
  description: 'Choose a reproducible individual, electional, or corporate-event report, with declared methods, source passages, withheld rules, and interpretive boundaries.',
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
  {
    href: '/knowledge/corporate',
    eyebrow: 'Available now · corporate / mundane',
    title: 'Corporate formation event',
    description: 'Record a filing, transaction, deployment, launch, or merger as an evidenced organization event. The report audits time uncertainty and location policy before applying an explicitly named corporate framework.',
    action: 'Build a corporate report',
  },
] as const

export default function CelestialReportsPage() {
  return (
    <main className="evidence-page px-6 py-16 text-[var(--text-secondary)] sm:px-12">
      <div className="mx-auto max-w-5xl">
        <nav aria-label="Breadcrumb" className="font-mono text-[10px] uppercase tracking-widest text-[var(--text-muted)]">
          <Link href="/" className="hover:text-[var(--text-primary)]">Maha Strategies</Link>
          <span className="px-2">/</span>
          <span className="text-[var(--text-secondary)]">Celestial reports</span>
        </nav>

        <header className="mt-10 border-b border-[var(--border-default)] pb-10">
          <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--status-illustrative)]">Reproducible inputs · named traditions · visible provenance</p>
          <h1 className="mt-6 max-w-4xl text-4xl font-bold tracking-tight text-[var(--text-primary)] sm:text-6xl">Choose the report you actually need.</h1>
          <p className="mt-6 max-w-3xl font-serif text-lg leading-8 text-[var(--text-secondary)]">The current reports compute celestial and calendrical facts deterministically, then compile only the rules recorded for a declared tradition. They do not use a language model to invent interpretations.</p>
        </header>

        <section className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3" aria-label="Available reports">
          {reports.map((report) => (
            <article key={report.href} className="flex flex-col border border-[var(--border-default)] bg-[var(--surface-raised)]/60 p-6">
              <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--status-verified)]">{report.eyebrow}</p>
              <h2 className="mt-4 text-2xl font-semibold text-[var(--text-primary)]">{report.title}</h2>
              <p className="mt-3 flex-1 text-sm leading-6 text-[var(--text-secondary)]">{report.description}</p>
              <Link href={report.href} className="mt-7 self-start border border-violet-500 px-5 py-3 font-mono text-[10px] uppercase tracking-widest text-[var(--status-illustrative)] hover:bg-violet-400 hover:text-black">{report.action} →</Link>
            </article>
          ))}
        </section>

        <section className="mt-8 border border-[var(--border-default)] bg-[var(--surface-raised)] p-6">
          <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--status-illustrative)]">Before interpreting a report</p>
          <h2 className="mt-3 text-2xl font-semibold text-[var(--text-primary)]">Inspect the calculation conventions.</h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--text-secondary)]">These method pages explain the timing, zodiac, transit, and organization-event choices visible in report output.</p>
          <div className="mt-5 flex flex-wrap gap-3">
            {CELESTIAL_GUIDE_LIST.map((guide) => <Link key={guide.path} href={guide.path} className="border border-[var(--border-default)] px-3 py-2 text-xs text-[var(--text-secondary)] hover:border-violet-500 hover:text-[var(--text-primary)]">{guide.title}</Link>)}
          </div>
        </section>

        <section className="mt-8 border border-cyan-900/60 bg-[var(--surface-subtle)] p-6">
          <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--status-sourced)]">Phase 2 · calibration in progress</p>
          <h2 className="mt-3 text-2xl font-semibold text-[var(--text-primary)]">Predictive reports are not available yet.</h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--text-secondary)]">The forecasting layer can pre-register and score separate tropical and sidereal models against an ordinary baseline. It has not yet demonstrated predictive skill, so this site does not present a forecast as a validated result.</p>
        </section>

        <section className="mt-8 border-l-2 border-rose-500 bg-rose-950/10 p-6">
          <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--status-unverified)]">Interpretive boundary</p>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--text-secondary)]">Accurate source transcription is not empirical validation. Astrology reports are presented as inspectable cultural and interpretive traditions, not verified prediction or a basis for medical, legal, financial, or other high-stakes decisions.</p>
        </section>
      </div>
    </main>
  )
}
