import type { Metadata } from 'next'
import Link from 'next/link'

import NavigatorAssessment from './NavigatorAssessment'

const SITE_URL = 'https://www.mahastrategies.com'

export const metadata: Metadata = {
  title: 'Maha Navigator | Agent Infrastructure Readiness Brief',
  description: 'Create a bounded, self-reported readiness brief for MCP, A2A, x402, agent-tool, context, audit, and reliability controls.',
  alternates: { canonical: '/navigator' },
  openGraph: {
    type: 'website',
    url: `${SITE_URL}/navigator`,
    title: 'Maha Navigator | Agent Infrastructure Readiness Brief',
    description: 'Map one real agent workload into control gaps and a bounded technical pilot.',
  },
}

export default function NavigatorPage() {
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: 'Maha Navigator',
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
    url: `${SITE_URL}/navigator`,
    description:
      'A consent-based, self-reported agent-infrastructure readiness assessment that produces a control-gap brief and bounded pilot recommendation.',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    provider: { '@type': 'Organization', '@id': `${SITE_URL}/#organization`, name: 'Maha Strategies LLC' },
  }

  return (
    <main className="evidence-page">
      <article className="evidence-container">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, '\u003c') }}
        />

        <Link href="/developers" className="evidence-link text-[var(--text-muted)]">
          ← Developer infrastructure
        </Link>

        <header className="mt-12 max-w-4xl">
          <p className="evidence-kicker">[ Maha Navigator · opt-in technical intake ]</p>
          <h1 className="evidence-title">
            Turn one agent deployment into a reviewable control brief.
          </h1>
          <p className="evidence-copy mt-6">
            Navigator asks about the system you are actually deploying, maps six operating controls, and recommends one
            bounded compatibility or governance pilot. You receive the brief immediately; a human follows up only if
            you request it.
          </p>
        </header>

        <section className="evidence-section">
          <div className="grid gap-4 text-sm md:grid-cols-3">
            <div className="evidence-card">
              <p className="evidence-kicker">Useful immediately</p>
              <p className="evidence-copy mt-2 leading-6">
                A downloadable control-gap register, even if you never engage Maha.
              </p>
            </div>
            <div className="evidence-card">
              <p className="evidence-kicker">Consent bounded</p>
              <p className="evidence-copy mt-2 leading-6">
                Assessment processing and human follow-up are separate choices.
              </p>
            </div>
            <div className="evidence-card">
              <p className="evidence-kicker">No autonomous commitments</p>
              <p className="evidence-copy mt-2 leading-6">
                Navigator cannot send outreach, accept work, price a contract, or authorize payment.
              </p>
            </div>
          </div>
        </section>

        <NavigatorAssessment />
      </article>
    </main>
  )
}
