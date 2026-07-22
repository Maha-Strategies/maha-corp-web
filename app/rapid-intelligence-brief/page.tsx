import Link from 'next/link'
import type { Metadata } from 'next'
import { TrackedLink } from '@/components/ConversionTracker'

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
    <main className="min-h-screen bg-[#0a0a0c] text-zinc-300">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(serviceJsonLd) }} />

      <div className="max-w-4xl mx-auto px-6 py-20 sm:py-28">
        <p className="font-mono text-[10px] text-indigo-400 tracking-widest uppercase mb-4">
          [ INTELLIGENCE // RAPID BRIEF ]
        </p>
        <h1 className="text-4xl sm:text-5xl font-light text-white leading-tight max-w-3xl mb-6">
          One defined question. A defensible next move.
        </h1>
        <p className="text-xl text-zinc-400 font-light leading-relaxed max-w-3xl mb-4">
          The Rapid Intelligence Brief is for a decision that needs a clear, external view
          before it needs a full research program. Bring one focused question; receive a
          concise memo that separates evidence, assumptions, and implications.
        </p>
        <p className="font-mono text-xs text-indigo-300 tracking-widest uppercase mb-10">
          Starting at $500 · delivered within five business days · fixed scope
        </p>

        <div className="flex flex-col sm:flex-row gap-4 mb-24">
          <TrackedLink
            href="/contact?service=rapid_intelligence"
            event="cta_rapid_brief_start"
            className="inline-block bg-white text-black font-mono font-bold text-xs tracking-widest uppercase px-8 py-4 hover:bg-zinc-200 transition-colors no-underline text-center"
          >
            Request a Rapid Brief ↗
          </TrackedLink>
          <Link
            href="#scope"
            className="inline-block border border-zinc-600 text-zinc-200 font-mono font-bold text-xs tracking-widest uppercase px-8 py-4 hover:border-white hover:text-white transition-colors no-underline text-center"
          >
            See the scope ↓
          </Link>
        </div>

        <section id="scope" className="grid grid-cols-1 md:grid-cols-2 gap-12 border-t border-zinc-800 pt-10 mb-24 scroll-mt-24">
          <div>
            <h2 className="text-white font-mono text-sm tracking-widest uppercase mb-6">[ What you receive ]</h2>
            <ul className="space-y-4">
              {included.map((item) => (
                <li key={item} className="border-l border-indigo-500 pl-4 text-zinc-400 leading-relaxed">{item}</li>
              ))}
            </ul>
          </div>
          <div>
            <h2 className="text-white font-mono text-sm tracking-widest uppercase mb-6">[ Right-sized for ]</h2>
            <div className="space-y-4 text-zinc-400 leading-relaxed">
              <p>A fast check on a technology, market, supplier, policy, or strategic claim before you allocate more time or capital.</p>
              <p>A decision meeting that needs a compact evidence base and a clear view of what remains uncertain.</p>
              <p>A focused question that is too important for a casual web search, but does not need a 10–15 page Verified Research Brief.</p>
            </div>
          </div>
        </section>

        <section className="mb-24">
          <h2 className="text-white font-mono text-sm tracking-widest uppercase mb-8">[ How it works ]</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            {[
              ['01', 'State the decision', 'Tell us the question, what decision it informs, and any deadline or constraints.'],
              ['02', 'Confirm the scope', 'We confirm fit, sources, deliverable, price, and timing before research begins.'],
              ['03', 'Receive the memo', 'You receive a concise answer with linked sources, explicit assumptions, and next-step implications.'],
            ].map(([number, title, copy]) => (
              <div key={number} className="border border-zinc-800 p-6">
                <p className="font-mono text-xs text-indigo-400 tracking-widest mb-5">{number}</p>
                <h3 className="text-white text-lg font-light mb-3">{title}</h3>
                <p className="text-sm text-zinc-500 leading-relaxed">{copy}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mb-24 border-t border-zinc-800 pt-10">
          <h2 className="text-white font-mono text-sm tracking-widest uppercase mb-6">[ Boundaries ]</h2>
          <p className="text-zinc-400 leading-relaxed max-w-3xl mb-6">
            This is an independent research memo, not a substitute for specialist diligence or regulated professional advice. If a question requires deeper validation, we will recommend the full Verified Research Brief or tell you plainly that it is outside our scope.
          </p>
          <ul className="space-y-3">
            {notIncluded.map((item) => (
              <li key={item} className="text-sm text-zinc-500 leading-relaxed border-l border-zinc-700 pl-4">{item}</li>
            ))}
          </ul>
        </section>

        <section className="border border-indigo-900/50 bg-indigo-950/20 p-8 sm:p-12 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500" />
          <p className="font-mono text-[10px] text-indigo-400 tracking-widest uppercase mb-4">[ Start with the question ]</p>
          <h2 className="text-2xl sm:text-3xl text-white font-light mb-4">A smaller brief should still make the uncertainty visible.</h2>
          <p className="text-zinc-300 text-lg font-light leading-relaxed max-w-2xl mb-8">
            Send the question, the decision it informs, and your deadline. We reply within two business days to confirm whether a Rapid Intelligence Brief is the right fit.
          </p>
          <TrackedLink
            href="/contact"
            event="cta_rapid_brief_bottom"
            className="inline-block bg-white text-black font-mono font-bold text-xs tracking-widest uppercase px-8 py-4 hover:bg-zinc-200 transition-colors no-underline text-center"
          >
            Request a Rapid Brief ↗
          </TrackedLink>
        </section>
      </div>
    </main>
  )
}
