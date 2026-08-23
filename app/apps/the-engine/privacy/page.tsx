import type { Metadata } from 'next'
import Link from 'next/link'

const pageUrl = 'https://www.mahastrategies.com/apps/the-engine/privacy'

export const metadata: Metadata = {
  title: 'The Dream Engine Privacy Policy | Maha Strategies',
  description: 'Privacy policy for The Dream Engine, the companion app to The Imagined Life.',
  alternates: { canonical: pageUrl },
}

export default function TheDreamEnginePrivacyPage() {
  return (
    <main className="evidence-page">
      <article className="evidence-container evidence-container--narrow">
        <Link href="/" className="mb-10 block text-xs uppercase tracking-widest text-[var(--text-muted)] hover:text-[var(--text-primary)]">
          ← Maha Strategies
        </Link>
        <p className="text-xs uppercase tracking-[0.22em] text-indigo-400">The Imagined Life companion app</p>
        <h1 className="mt-4 text-4xl font-light tracking-wide text-[var(--text-primary)] sm:text-5xl">The Dream Engine Privacy Policy</h1>
        <p className="mt-4 text-sm text-[var(--text-muted)]">Effective date: 22 July 2026</p>

        <div className="prose mt-12 max-w-none leading-relaxed text-[var(--text-secondary)]">
          <p>The Dream Engine does not require an account and does not collect, transmit, sell, or share personal information. It contains no advertising SDK, analytics service, cloud database, or social feature.</p>
          <p>Practice entries, bookmarks, reader settings, and reading position are stored only in the app&apos;s local device storage. The app does not send that material to Maha Strategies. If you choose Share or Export, the destination and any resulting copy are governed by the service you choose. Device backups may also be governed by your device and backup-provider settings.</p>
          <p>Deleting an entry removes it from the app. Uninstalling The Dream Engine removes its local archive from the device. Export any entries you want to retain before uninstalling.</p>
          <p>The app is a reflective practice and is not medical, mental-health, or sleep-treatment advice.</p>
          <h2>Contact</h2>
          <p>For privacy questions, contact <a href="mailto:mayone@mahastrategies.com">mayone@mahastrategies.com</a>.</p>
        </div>
      </article>
    </main>
  )
}
