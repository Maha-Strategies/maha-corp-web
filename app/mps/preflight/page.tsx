import type { Metadata } from 'next'
import Link from 'next/link'

import PreflightCheckout from './PreflightCheckout'

export const metadata: Metadata = {
  title: 'MPS Preflight | Claim-level audit for a document extract',
  description: 'A private, self-service MPS/0.1 claim preflight for nonfiction document extracts. Receive a structured claim map and verification backlog.',
  alternates: { canonical: '/mps/preflight' },
}

const included = [
  'Up to 12,000 characters (about 2,000 words), processed in one or two claim-level passes.',
  'A private MPS/0.1 claim map: VERIFIED, SOURCED, BOUNDARY, ILLUSTRATIVE, and UNVERIFIED.',
  'A prioritised verification backlog and a downloadable machine-readable record.',
]

export default function MpsPreflightPage() {
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: 'MPS Preflight',
    serviceType: 'Automated claim-level provenance review',
    description: 'A private MPS/0.1 claim-level review for a nonfiction document extract of up to about 2,000 words.',
    provider: { '@type': 'Organization', '@id': 'https://www.mahastrategies.com/#organization', name: 'Maha Strategies LLC' },
    offers: { '@type': 'Offer', price: '49', priceCurrency: 'USD', availability: 'https://schema.org/InStock', url: 'https://www.mahastrategies.com/mps/preflight' },
  }

  return (
    <main className="evidence-page">
      <div className="evidence-container evidence-container--narrow">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
        <header className="border-t border-[var(--border-default)] pt-5">
          <p className="evidence-kicker">MPS/0.1 · self-service document review</p>
          <h1 className="evidence-title evidence-title--product">Know what your draft is asking readers to trust.</h1>
          <p className="evidence-lede mt-7">MPS Preflight turns a short nonfiction draft into a claim-level map before you publish, circulate, or use it in a decision.</p>
          <p className="evidence-copy mt-5">It is automated triage—not a certification or substitute for source-by-source human verification.</p>
          <Link href="/mps" className="evidence-link mt-7 inline-block font-mono text-xs uppercase tracking-widest">← Maha Provenance Standard</Link>
        </header>

        <section className="evidence-section grid gap-10 lg:grid-cols-[1.2fr_.8fr]">
          <div>
            <p className="evidence-kicker">Included</p>
            <div className="mt-6 grid gap-3">
              {included.map((item, index) => (
                <article key={item} className="evidence-card flex gap-4">
                  <span className="evidence-kicker pt-1">{String(index + 1).padStart(2, '0')}</span>
                  <p className="evidence-card-copy">{item}</p>
                </article>
              ))}
            </div>
            <p className="evidence-kicker mt-8">One-time purchase · $49 USD · no account required</p>
            <p className="evidence-copy mt-5">Want to see the format first? <Link href="/mps/preflight/example" className="evidence-link">Inspect a transparent sample report</Link>.</p>
            <p className="evidence-copy mt-6">Need a complete manuscript, source-by-source resolution, or a review that someone can rely on in a high-stakes decision? Start with a <Link href="/contact" className="evidence-link">human Evidence Audit inquiry</Link> instead.</p>
          </div>

          <aside className="evidence-card h-fit">
            <p className="evidence-kicker">Preflight scope</p>
            <dl className="mt-6 grid gap-6">
              <div><dt className="evidence-kicker">Best for</dt><dd className="evidence-card-copy mt-2">A report section, a policy memo, an article, or a manuscript extract.</dd></div>
              <div><dt className="evidence-kicker">Not included</dt><dd className="evidence-card-copy mt-2">Primary-source verification, legal or investment advice, or a public MPS certification.</dd></div>
              <div><dt className="evidence-kicker">Privacy</dt><dd className="evidence-card-copy mt-2">The source document is not saved in the ledger. The report retains an input hash and its claim excerpts.</dd></div>
            </dl>
            <PreflightCheckout />
          </aside>
        </section>
      </div>
    </main>
  )
}
