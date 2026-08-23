import Link from 'next/link'
import type { Metadata } from 'next'
import { TrackedLink } from '@/components/ConversionTracker'
import EngagementPath from '@/components/EngagementPath'

const SITE_URL = 'https://www.mahastrategies.com'

export const metadata: Metadata = {
  title: 'Rapid Intelligence Brief — Maha Strategies LLC',
  description:
    'A fixed-scope, decision-ready research memo for one defined market, technology, or policy question. Starting at $500, delivered within five business days.',
  alternates: { canonical: '/rapid-intelligence-brief' },
  openGraph: {
    type: 'website',
    url: `${SITE_URL}/rapid-intelligence-brief`,
    title: 'Rapid Intelligence Brief — Maha Strategies',
    description:
      'One defined question. A concise, decision-ready research memo. Starting at $500, delivered within five business days.',
    images: [{ url: '/og-master.png', width: 1200, height: 630, alt: 'Rapid Intelligence Brief — Maha Strategies' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Rapid Intelligence Brief — Maha Strategies',
    description:
      'One defined question. A concise, decision-ready research memo. Starting at $500, delivered within five business days.',
    images: ['/og-master.png'],
  },
}

const included = [
  'A scoped response to one defined market, technology, or policy question.',
  'A concise 2–3 page memo: answer, key evidence, assumptions, and decision implications.',
  'Links to the public or authorized sources used, with material uncertainty made explicit.',
  'Delivery within five business days after the question and scope are confirmed.',
]

const notIncluded = [
  'Primary interviews, confidential diligence, legal advice, investment advice, or engineering sign-off.',
  'Open-ended research programs, ongoing monitoring, or a fully provenance-tagged evidence record.',
]

export default function RapidIntelligenceBriefPage() {
  const serviceJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Service',
    '@id': `${SITE_URL}/rapid-intelligence-brief#service`,
    name: 'Rapid Intelligence Brief',
    description:
      'A fixed-scope, decision-ready research memo for one defined market, technology, or policy question.',
    provider: {
      '@type': 'Organization',
      '@id': `${SITE_URL}/#organization`,
      name: 'Maha Strategies LLC',
      url: SITE_URL,
    },
    areaServed: 'Worldwide',
    offers: {
      '@type': 'Offer',
      price: '500',
      priceCurrency: 'USD',
      availability: 'https://schema.org/InStock',
      url: `${SITE_URL}/rapid-intelligence-brief`,
    },
  }

  return (
    <main className="evidence-page">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(serviceJsonLd) }} />

      <div className="evidence-container">
        <p className="evidence-kicker">[ INTELLIGENCE // RAPID BRIEF ]</p>
        <h1 className="evidence-title evidence-title--product">
          One defined question. A defensible next move.
        </h1>
        <p className="evidence-lede mt-7 max-w-3xl">
          The Rapid Intelligence Brief is for a decision that needs a clear, external view
          before it needs a full research program. Bring one focused question; receive a
          concise memo that separates evidence, assumptions, and implications.
        </p>
        <p className="evidence-kicker mt-7 mb-10">
          Starting at $500 · delivered within five business days · fixed scope
        </p>

        <div className="flex flex-col sm:flex-row gap-4 mb-24">
          <TrackedLink
            href="/contact?service=rapid_intelligence"
            event="cta_rapid_brief_start"
            className="evidence-action evidence-action--primary"
          >
            Request a Rapid Brief ↗
          </TrackedLink>
          <Link
            href="#scope"
            className="evidence-action"
          >
            See the scope ↓
          </Link>
        </div>

        <EngagementPath offer="rapid" className="mb-24" />

        <section
          id="scope"
          className="evidence-section grid grid-cols-1 md:grid-cols-2 gap-12 scroll-mt-24"
        >
          <div>
            <p className="evidence-kicker">[ What you receive ]</p>
            <ul className="mt-6 space-y-4">
              {included.map((item) => (
                <li key={item} className="border-l border-[var(--status-sourced)] pl-4 evidence-copy leading-relaxed">{item}</li>
              ))}
            </ul>
          </div>
          <div>
            <p className="evidence-kicker">[ Right-sized for ]</p>
            <div className="mt-6 space-y-4 evidence-copy leading-relaxed">
              <p>A fast check on a technology, market, supplier, policy, or strategic claim before you allocate more time or capital.</p>
              <p>A decision meeting that needs a compact evidence base and a clear view of what remains uncertain.</p>
              <p>A focused question that is too important for a casual web search, but does not need a 10–15 page Verified Research Brief.</p>
            </div>
          </div>
        </section>

        <section className="evidence-section mb-24">
          <p className="evidence-kicker">[ How it works ]</p>
          <h2 className="evidence-section-title mt-4">Operational steps with explicit handoffs.</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            {[
              ['01', 'State the decision', 'Tell us the question, what decision it informs, and any deadline or constraints.'],
              ['02', 'Confirm the scope', 'We confirm fit, sources, deliverable, price, and timing before research begins.'],
              ['03', 'Receive the memo', 'You receive a concise answer with linked sources, explicit assumptions, and next-step implications.'],
            ].map(([number, title, copy]) => (
              <article key={number} className="evidence-card">
                <p className="evidence-kicker">{number}</p>
                <h3 className="evidence-card-title mt-4">{title}</h3>
                <p className="evidence-card-copy mt-4 leading-relaxed">{copy}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="evidence-section mb-24">
          <p className="evidence-kicker">[ Boundaries ]</p>
          <div className="evidence-card mt-5">
            <p className="evidence-copy leading-relaxed max-w-3xl">
            This is an independent research memo, not a substitute for specialist diligence or regulated professional advice. If a question requires deeper validation, we will recommend the full Verified Research Brief or tell you plainly that it is outside our scope.
          </p>
          </div>
          <ul className="space-y-3">
            {notIncluded.map((item) => (
              <li key={item} className="evidence-copy leading-relaxed border-l-2 border-[var(--status-sourced)] pl-4">{item}</li>
            ))}
          </ul>
        </section>

        <section className="evidence-section">
          <p className="evidence-kicker">[ Start with the question ]</p>
          <h2 className="evidence-section-title mt-4">A smaller brief should still make the uncertainty visible.</h2>
          <p className="evidence-copy mt-4 max-w-2xl mb-8">
            Send the question, the decision it informs, and your deadline. We reply within two business days to confirm whether a Rapid Intelligence Brief is the right fit.
          </p>
          <TrackedLink
            href="/contact"
            event="cta_rapid_brief_bottom"
            className="evidence-action evidence-action--primary"
          >
            Request a Rapid Brief ↗
          </TrackedLink>
        </section>
      </div>
    </main>
  )
}
