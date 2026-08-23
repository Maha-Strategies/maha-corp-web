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
    <main className="evidence-page"><div className="evidence-container evidence-container--narrow">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
        <Link href="/mps" className="font-mono text-[11px] uppercase tracking-widest text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)]">← Maha Provenance Standard</Link>
        <div className="mt-10 grid gap-12 lg:grid-cols-[1.2fr_.8fr]">
          <section>
            <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--text-muted)]">[ MPS/0.1 · self-service document review ]</p>
            <h1 className="evidence-title evidence-title--product">Know what your draft is asking readers to trust.</h1>
            <p className="mt-7 max-w-2xl text-lg leading-relaxed text-[var(--text-secondary)]">MPS Preflight turns a short nonfiction draft into a claim-level map before you publish, circulate, or use it in a decision. It is an automated triage—not a certification or substitute for source-by-source human verification.</p>
            <div className="mt-9 border-y border-[var(--border-default)] py-6">
              {included.map((item) => <p key={item} className="mb-4 flex gap-3 text-sm leading-relaxed text-[var(--text-secondary)] last:mb-0"><span className="font-mono text-[var(--text-muted)]">01</span>{item}</p>)}
            </div>
            <div className="mt-8 flex flex-wrap gap-3 font-mono text-[10px] uppercase tracking-widest text-[var(--text-muted)]">
              <span>One-time purchase</span><span>·</span><span>$49 USD</span><span>·</span><span>No account required</span>
            </div>
            <p className="mt-5 text-sm leading-relaxed text-[var(--text-secondary)]">Want to see the format first? <Link href="/mps/preflight/example" className="text-[var(--text-muted)] underline underline-offset-4 hover:text-[var(--text-primary)]">Inspect a transparent sample report</Link>.</p>
            <p className="mt-7 max-w-2xl text-sm leading-relaxed text-[var(--text-muted)]">Need a complete manuscript, source-by-source resolution, or a review that someone can rely on in a high-stakes decision? Start with a <Link href="/contact" className="text-[var(--text-muted)] underline underline-offset-4 hover:text-[var(--text-primary)]">human Evidence Audit inquiry</Link> instead.</p>
          </section>
          <aside className="border-l border-[var(--border-default)] pl-0 lg:pl-10">
            <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--text-muted)]">[ Preflight scope ]</p>
            <dl className="mt-5 grid gap-5 text-sm">
              <div><dt className="font-mono text-[10px] uppercase tracking-widest text-[var(--text-muted)]">Best for</dt><dd className="mt-1 leading-relaxed text-[var(--text-secondary)]">A report section, a policy memo, an article, or a manuscript extract.</dd></div>
              <div><dt className="font-mono text-[10px] uppercase tracking-widest text-[var(--text-muted)]">Not included</dt><dd className="mt-1 leading-relaxed text-[var(--text-secondary)]">Primary-source verification, legal or investment advice, or a public MPS certification.</dd></div>
              <div><dt className="font-mono text-[10px] uppercase tracking-widest text-[var(--text-muted)]">Privacy</dt><dd className="mt-1 leading-relaxed text-[var(--text-secondary)]">The source document is not saved in the ledger. The report retains an input hash and its claim excerpts.</dd></div>
            </dl>
            <PreflightCheckout />
          </aside>
        </div>
      </div>
    </main>
  )
}
