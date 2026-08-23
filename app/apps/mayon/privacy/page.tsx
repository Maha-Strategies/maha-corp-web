import type { Metadata } from 'next'
import Link from 'next/link'

const pageUrl = 'https://www.mahastrategies.com/apps/mayon/privacy'

export const metadata: Metadata = {
  title: 'Mayon Privacy Policy | Maha Strategies',
  description: 'Privacy policy and support information for the Mayon educational mobile app.',
  alternates: { canonical: pageUrl },
}

export default function MayonPrivacyPage() {
  return (
    <main className="evidence-page">
      <article className="evidence-container evidence-container--narrow">
        <Link href="/" className="mb-10 block text-xs uppercase tracking-widest text-[var(--text-muted)] hover:text-[var(--text-primary)]">
          ← Maha Strategies
        </Link>
        <Link href="/apps/mayon" className="mb-6 block text-xs uppercase tracking-widest text-[var(--status-sourced)] hover:text-[var(--status-sourced)]">
          Mayon documentation →
        </Link>
        <p className="text-xs uppercase tracking-[0.22em] text-[var(--status-boundary)]">Educational volcano explorer</p>
        <h1 className="mt-4 text-4xl font-light tracking-wide text-[var(--text-primary)] sm:text-5xl">Mayon Privacy Policy</h1>
        <p className="mt-4 text-sm text-[var(--text-muted)]">Effective date: 25 July 2026</p>

        <div className="prose mt-12 max-w-none leading-relaxed text-[var(--text-secondary)]">
          <p>Mayon is a free educational application from Maha Strategies. It is designed to help people explore Mayon Volcano, its landscape, history, and hazards. It is not a live warning, forecasting, navigation, or emergency-response service.</p>

          <h2>Data the mobile app collects</h2>
          <p>The Mayon mobile app does not require an account and does not collect names, email addresses, precise location, contacts, photos, payments, health data, or identifiers for advertising. It contains no ads, in-app purchases, notifications, or native analytics SDK.</p>
          <p>The app uses an internet connection only to load its educational experience and linked public resources. It does not transmit personal information to Maha Strategies.</p>

          <h2>Website analytics</h2>
          <p>The companion website, mayonrajan.com, uses Vercel Web Analytics to understand aggregate site traffic. Vercel describes this service as anonymous and cookie-free. The native mobile app does not load that web analytics script.</p>

          <h2>External links and safety information</h2>
          <p>Mayon may link to agencies, maps, articles, or social platforms outside Maha Strategies&apos; control. Those services have their own privacy practices. For current alert levels, earthquakes, weather, evacuation instructions, or emergency advice, use PHIVOLCS and local authorities rather than this application.</p>

          <h2>Children</h2>
          <p>Mayon is suitable for general educational use and does not knowingly collect personal information from children.</p>

          <h2>Changes</h2>
          <p>If the app&apos;s data practices materially change, this page will be updated before the relevant release is published.</p>

          <h2>Contact and support</h2>
          <p>For privacy or support questions, contact <a href="mailto:mayone@mahastrategies.com">mayone@mahastrategies.com</a>. This address is not an emergency channel.</p>
        </div>
      </article>
    </main>
  )
}
