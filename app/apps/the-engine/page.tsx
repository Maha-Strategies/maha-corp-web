import type { Metadata } from 'next'
import Link from 'next/link'
import { MAHA_ORGANIZATION_ID } from '@/lib/entity'
import { APP_STORE_LINKS } from '@/lib/app-store-links'

const pageUrl = 'https://www.mahastrategies.com/apps/the-engine'
const { ios: appStoreUrl, android: googlePlayUrl } = APP_STORE_LINKS.dreamEngine

export const metadata: Metadata = {
  title: 'The Dream Engine | Read, Practice, Archive',
  description: 'The Dream Engine brings The Imagined Life together with a private practice for attention, reflection, and ordinary action.',
  alternates: { canonical: pageUrl },
  openGraph: {
    title: 'The Dream Engine | Read, Practice, Archive',
    description: 'A private practice for attention, reflection, and ordinary action.',
    url: pageUrl,
    type: 'website',
  },
}

const appJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'MobileApplication',
  name: 'The Dream Engine',
  applicationCategory: 'LifestyleApplication',
  operatingSystem: 'iOS, Android',
  url: pageUrl,
  installUrl: [appStoreUrl, googlePlayUrl],
  publisher: { '@id': MAHA_ORGANIZATION_ID },
  description: 'A companion app to The Imagined Life, combining the complete book with a private practice for attention, reflection, and action.',
}

export default function TheDreamEnginePage() {
  return (
    <main className="evidence-page">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(appJsonLd).replace(/</g, '\\u003c') }} />
      <article className="evidence-container evidence-container--narrow">
        <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--status-boundary)]">[ The Imagined Life · companion app ]</p>
        <h1 className="mt-5 max-w-4xl text-4xl font-light leading-tight tracking-tight text-[var(--text-primary)] sm:text-6xl">Read the book.<br /><span className="text-[var(--status-boundary)]">Then use its small instrument.</span></h1>
        <p className="mt-7 max-w-3xl text-xl leading-relaxed text-[var(--text-secondary)]">The Dream Engine brings the complete text of <em>The Imagined Life: Living Inside a Dreaming Brain</em> together with a deliberately modest, private practice for attention, reflection, and action.</p>

        <section className="mt-12 flex flex-wrap gap-4" aria-label="The Dream Engine links">
          <a href={appStoreUrl} target="_blank" rel="noreferrer" className="border border-white bg-white px-5 py-3 text-sm font-medium text-black transition hover:bg-zinc-200">Download on the App Store ↗</a>
          <a href={googlePlayUrl} target="_blank" rel="noreferrer" className="border border-amber-300 bg-amber-200 px-5 py-3 text-sm font-medium text-black transition hover:bg-amber-100">Get it on Google Play ↗</a>
          <Link href="/apps/the-engine/privacy" className="border border-[var(--border-strong)] px-5 py-3 text-sm text-[var(--text-primary)] transition hover:border-amber-300 hover:text-[var(--status-boundary)]">Read the privacy policy</Link>
        </section>
        <p className="mt-5 text-sm text-[var(--text-muted)]">Now available on the App Store and Google Play.</p>

        <section className="evidence-status-surface evidence-status-surface--illustrative mt-14 p-7 sm:p-9">
          <p className="evidence-status-label">Illustrative</p>
          <p className="mt-3 max-w-3xl text-2xl font-light leading-relaxed text-[var(--text-primary)]">“Imagination is not magic. It changes the dreamer, and the dreamer changes what happens next.”</p>
        </section>

        <section className="mt-16">
          <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--status-boundary)]">[ A private practice ]</p>
          <h2 className="mt-4 text-3xl font-light text-[var(--text-primary)]">Three moves. No mystical shortcuts.</h2>
          <p className="mt-5 max-w-2xl leading-relaxed text-[var(--text-secondary)]">The practice is designed to be small enough to return to: hold something near attention, notice what remains, and choose one ordinary next action.</p>
          <div className="mt-8 grid gap-px overflow-hidden border border-[var(--border-default)] bg-zinc-800 md:grid-cols-3">
            <div className="bg-[var(--surface-raised)] p-7"><p className="font-mono text-xs text-[var(--status-boundary)]">01</p><h3 className="mt-3 text-xl text-[var(--text-primary)]">Seed</h3><p className="mt-3 text-sm leading-relaxed text-[var(--text-secondary)]">Choose a question, image, conversation, fear, or unfinished problem to carry near attention.</p></div>
            <div className="bg-[var(--surface-raised)] p-7"><p className="font-mono text-xs text-[var(--status-boundary)]">02</p><h3 className="mt-3 text-xl text-[var(--text-primary)]">Trace</h3><p className="mt-3 text-sm leading-relaxed text-[var(--text-secondary)]">Record fragments from the night before the day explains them away. A feeling counts. Nothing counts, too.</p></div>
            <div className="bg-[var(--surface-raised)] p-7"><p className="font-mono text-xs text-[var(--status-boundary)]">03</p><h3 className="mt-3 text-xl text-[var(--text-primary)]">Action</h3><p className="mt-3 text-sm leading-relaxed text-[var(--text-secondary)]">Ask what one concrete action makes the imagined thing slightly more actual, then do the work after.</p></div>
          </div>
        </section>

        <section className="mt-16 grid gap-10 border-t border-[var(--border-default)] pt-10 md:grid-cols-2">
          <div>
            <h2 className="text-2xl text-[var(--text-primary)]">Your archive belongs to you</h2>
            <p className="mt-5 leading-relaxed text-[var(--text-secondary)]">There are no ads, social feeds, or dream-decoding claims. Entries, bookmarks, reader settings, and reading position stay in local device storage. You choose whether to export your work.</p>
            <Link href="/apps/the-engine/privacy" className="mt-5 inline-block text-[var(--status-boundary)] underline">Privacy details</Link>
          </div>
          <div>
            <h2 className="text-2xl text-[var(--text-primary)]">A book about the dreaming brain</h2>
            <p className="mt-5 leading-relaxed text-[var(--text-secondary)]">The Dream Engine is the companion to <em>The Imagined Life</em>: a space to read, practice, and keep a private record of the questions that continue after the page ends.</p>
            <Link href="/books/the-imagined-life" className="mt-5 inline-block text-[var(--status-boundary)] underline">Read about The Imagined Life</Link>
          </div>
        </section>
      </article>
    </main>
  )
}
