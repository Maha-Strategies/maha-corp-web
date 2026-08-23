import type { Metadata } from 'next'
import Link from 'next/link'
import { MAHA_ORGANIZATION_ID } from '@/lib/entity'
import { APP_STORE_LINKS } from '@/lib/app-store-links'

const pageUrl = 'https://www.mahastrategies.com/apps/maha-os'
const { ios: appStoreUrl, android: googlePlayUrl } = APP_STORE_LINKS.mahaOs

export const metadata: Metadata = {
  title: 'Maha OS | A Local-First App for Focus and Awareness',
  description: 'Maha OS is a local-first mobile app for focus and metabolic awareness, designed to minimize non-essential off-device telemetry. Available on iOS and Android.',
  alternates: { canonical: pageUrl },
  openGraph: {
    title: 'Maha OS | A Local-First App for Focus and Awareness',
    description: 'A more intentional relationship with your device, built on a local-first foundation.',
    url: pageUrl,
    type: 'website',
  },
}

const appJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'MobileApplication',
  name: 'Maha OS',
  applicationCategory: 'HealthApplication',
  operatingSystem: 'iOS, Android',
  url: pageUrl,
  installUrl: [appStoreUrl, googlePlayUrl],
  publisher: { '@id': MAHA_ORGANIZATION_ID },
  description: 'A local-first mobile app for focus and metabolic awareness, designed to minimize non-essential off-device telemetry.',
}

export default function MahaOsPage() {
  return (
    <main className="evidence-page">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(appJsonLd).replace(/</g, '\\u003c') }} />
      <article className="evidence-container evidence-container--narrow">
        <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--status-sourced)]">[ Local-first mobile app · iOS and Android ]</p>
        <h1 className="mt-5 max-w-4xl text-4xl font-light leading-tight tracking-tight text-[var(--text-primary)] sm:text-6xl">Your device should work for you.<br /><span className="text-[var(--status-sourced)]">Not study you for someone else.</span></h1>
        <p className="mt-7 max-w-3xl text-xl leading-relaxed text-[var(--text-secondary)]">Maha OS is a local-first companion for focus and metabolic awareness, built around a simple conviction: your information and attention should remain under your control by default.</p>

        <section className="mt-12 flex flex-wrap gap-4" aria-label="Maha OS downloads">
          <a href={appStoreUrl} target="_blank" rel="noreferrer" className="border border-white bg-white px-5 py-3 text-sm font-medium text-black transition hover:bg-zinc-200">Download on the App Store ↗</a>
          <a href={googlePlayUrl} target="_blank" rel="noreferrer" className="border border-indigo-500 bg-indigo-950/30 px-5 py-3 text-sm text-indigo-100 transition hover:bg-indigo-900/40">Get it on Google Play ↗</a>
        </section>

        <section className="mt-14 grid gap-px overflow-hidden border border-[var(--border-default)] bg-zinc-800 sm:grid-cols-3">
          <div className="bg-[var(--surface-raised)] p-7"><p className="font-mono text-[10px] uppercase tracking-widest text-[var(--status-sourced)]">Local first</p><p className="mt-3 text-lg text-[var(--text-primary)]">Keep the essential work on your device.</p><p className="mt-3 text-sm leading-relaxed text-[var(--text-secondary)]">The design minimizes dependence on cloud APIs and non-essential off-device telemetry.</p></div>
          <div className="bg-[var(--surface-raised)] p-7"><p className="font-mono text-[10px] uppercase tracking-widest text-[var(--status-sourced)]">Intentional</p><p className="mt-3 text-lg text-[var(--text-primary)]">Create room for attention.</p><p className="mt-3 text-sm leading-relaxed text-[var(--text-secondary)]">A practical alternative to products optimized around constant behavioral capture.</p></div>
          <div className="bg-[var(--surface-raised)] p-7"><p className="font-mono text-[10px] uppercase tracking-widest text-[var(--status-sourced)]">Your data</p><p className="mt-3 text-lg text-[var(--text-primary)]">Treat storage as a private utility.</p><p className="mt-3 text-sm leading-relaxed text-[var(--text-secondary)]">Local storage and encryption at rest support a more user-controlled foundation.</p></div>
        </section>

        <section className="mt-16 grid gap-10 md:grid-cols-2">
          <div>
            <h2 className="text-2xl text-[var(--text-primary)]">A different default</h2>
            <p className="mt-5 leading-relaxed text-[var(--text-secondary)]">Most digital services are designed around collection, targeting, and engagement loops. Maha OS begins with local processing and storage instead—reducing the surface area for unnecessary third-party tracking and keeping personal context closer to the person it belongs to.</p>
          </div>
          <div>
            <h2 className="text-2xl text-[var(--text-primary)]">Designed for awareness, not diagnosis</h2>
            <p className="mt-5 leading-relaxed text-[var(--text-secondary)]">Maha OS supports focus and metabolic awareness. It is not a medical device, diagnostic service, emergency tool, or substitute for professional care. Use it as a personal practice, alongside the guidance appropriate to your circumstances.</p>
          </div>
        </section>

        <section className="mt-16 border-t border-[var(--border-default)] pt-10">
          <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--status-sourced)]">[ Learn more ]</p>
          <h2 className="mt-4 text-2xl text-[var(--text-primary)]">The thinking behind the product</h2>
          <p className="mt-5 max-w-3xl leading-relaxed text-[var(--text-secondary)]">Maha OS is part of a wider local-first approach to digital infrastructure. Explore the decision framework for on-device versus cloud AI, or read the product overview for the architecture and store links.</p>
          <div className="mt-6 flex flex-wrap gap-5 text-sm">
            <Link href="/software" className="text-[var(--status-sourced)] underline">Maha OS product overview</Link>
            <Link href="/on-device-ai-vs-cloud" className="text-[var(--status-sourced)] underline">On-device AI decision guide</Link>
            <Link href="/research/architecture-of-attention" className="text-[var(--status-sourced)] underline">Architecture of attention</Link>
          </div>
        </section>
      </article>
    </main>
  )
}
