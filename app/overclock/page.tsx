import Link from 'next/link'
import type { Metadata } from 'next'
import { TrackedLink } from '@/components/ConversionTracker'
import OverclockGame from '@/components/OverclockGame'
import { MAHA_ORGANIZATION_ID } from '@/lib/entity'

const SITE_URL = 'https://www.mahastrategies.com'

export const metadata: Metadata = {
  title: 'Overclock | A Risk and Trust Game',
  description:
    'Play Overclock, a five-round risk game about escalating stakes, imperfect information, and when to bank a decision.',
  alternates: { canonical: '/overclock' },
  openGraph: {
    type: 'website',
    url: `${SITE_URL}/overclock`,
    title: 'Overclock | A Risk and Trust Game',
    description: 'A five-round game about escalating risk, imperfect information, and knowing when to bank.',
    images: [{ url: '/og-master.png', width: 1200, height: 630, alt: 'Overclock — Maha Strategies' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Overclock | A Risk and Trust Game',
    description: 'A five-round game about escalating risk, imperfect information, and knowing when to bank.',
    images: ['/og-master.png'],
    creator: '@mayonemaha',
  },
}

const gameJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'VideoGame',
  name: 'Overclock',
  description: 'A browser-based five-round risk game about escalating stakes, imperfect information, and when to bank a decision.',
  url: `${SITE_URL}/overclock`,
  author: { '@id': MAHA_ORGANIZATION_ID },
  publisher: { '@id': MAHA_ORGANIZATION_ID },
  applicationCategory: 'Game',
  operatingSystem: 'Web browser',
  isAccessibleForFree: true,
  inLanguage: 'en',
}

export default function OverclockPage() {
  return (
    <main className="evidence-page">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(gameJsonLd) }} />
      <div className="evidence-container">
        <header className="max-w-3xl border-l border-orange-300 pl-6 sm:pl-8 mb-14">
          <p className="font-mono text-xs text-orange-300 tracking-widest uppercase mb-5">[ Maha Strategies // Interactive prototype ]</p>
          <h1 className="font-mono text-4xl sm:text-5xl md:text-6xl font-bold tracking-[0.12em] text-[var(--text-primary)] leading-[1.05] mb-6">OVER<span className="text-orange-300">CLOCK</span></h1>
          <p className="text-xl sm:text-2xl text-[var(--text-primary)] font-light leading-relaxed">
            A five-round risk game about escalating stakes, imperfect information, and the discipline of knowing when to bank.
          </p>
        </header>

        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start">
          <OverclockGame />

          <aside className="space-y-5 lg:sticky lg:top-10">
            <section className="border border-[var(--border-default)] p-6">
              <p className="font-mono text-xs text-orange-300 tracking-widest uppercase mb-3">[ The premise ]</p>
              <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                The oracle reports the risk before every push. Its fidelity rises when you verify it and falls when you disregard its warning. The game is a systems metaphor, not a clinical assessment.
              </p>
            </section>
            <section className="border border-[var(--border-default)] p-6">
              <p className="font-mono text-xs text-[var(--status-sourced)] tracking-widest uppercase mb-3">[ Related reading ]</p>
              <h2 className="text-lg text-[var(--text-primary)] mb-3">Overclocked: The Physics of Modern Anxiety</h2>
              <p className="text-sm text-[var(--text-secondary)] leading-relaxed mb-5">
                The essay that inspired the prototype’s pressure-and-throttling metaphor.
              </p>
              <TrackedLink href="/doctrine/briefs/overclocked" event="overclock_brief_click" className="font-mono text-xs text-[var(--status-sourced)] hover:text-[var(--text-primary)] tracking-widest uppercase transition-colors">Read the brief ↗</TrackedLink>
            </section>
            <section className="border border-indigo-900/50 bg-indigo-950/20 p-6">
              <p className="font-mono text-xs text-[var(--status-sourced)] tracking-widest uppercase mb-3">[ Maha OS ]</p>
              <p className="text-sm text-[var(--text-secondary)] leading-relaxed mb-5">
                A local-first mobile tool for focus and metabolic awareness.
              </p>
              <TrackedLink href="https://play.google.com/store/apps/details?id=com.mahastrategies.os" event="overclock_maha_os_click" target="_blank" rel="noopener noreferrer" className="font-mono text-xs text-[var(--status-sourced)] hover:text-[var(--text-primary)] tracking-widest uppercase transition-colors">View Maha OS ↗</TrackedLink>
            </section>
          </aside>
        </div>

        <footer className="mt-16 border-t border-[var(--border-default)] pt-8 flex flex-wrap gap-x-7 gap-y-3 font-mono text-xs tracking-widest uppercase">
          <Link href="/doctrine" className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">Explore doctrine ↗</Link>
          <Link href="/" className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">Return to Maha Strategies ↗</Link>
        </footer>
      </div>
    </main>
  )
}
