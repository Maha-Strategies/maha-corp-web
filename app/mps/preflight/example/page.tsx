import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'MPS Preflight sample report | What a claim map looks like',
  description: 'Inspect a transparent, illustrative MPS Preflight report: claim statuses, review rationale, a verification backlog, and the limits of an automated review.',
  alternates: { canonical: '/mps/preflight/example' },
}

const sampleClaims = [
  {
    id: 'C-01',
    label: 'ILLUSTRATIVE',
    excerpt: 'This fictional memo describes a team considering an on-device AI pilot.',
    rationale: 'This is scenario-setting language. It is not presented as a fact about a real organization and should remain clearly framed as an example.',
    action: 'Keep the scenario label in the published draft.',
  },
  {
    id: 'C-02',
    label: 'SOURCED',
    excerpt: 'The example cites a vendor statement that source text remains on the device.',
    rationale: 'The draft attributes a specific operational statement to a named source. A preflight records the attribution; it does not independently confirm the vendor claim.',
    action: 'Check the current primary documentation and version date.',
  },
  {
    id: 'C-03',
    label: 'UNVERIFIED',
    excerpt: 'The proposed pilot will eliminate privacy risk.',
    rationale: 'The conclusion is absolute, while the sample supplies neither a scope nor evidence that would support it. The claim needs qualification or evidence before publication.',
    action: 'Replace with a bounded claim and document residual risks.',
  },
  {
    id: 'C-04',
    label: 'BOUNDARY',
    excerpt: 'Whether residual risk is acceptable depends on deployment details absent from this example.',
    rationale: 'This marks the point where a claim map must stop. An automated review cannot decide policy, legal, security, or organizational acceptability.',
    action: 'Escalate to the appropriate subject-matter reviewer.',
  },
]

const tagStyles: Record<string, string> = {
  ILLUSTRATIVE: 'evidence-chip--illustrative',
  SOURCED: 'evidence-chip--sourced',
  UNVERIFIED: 'evidence-chip--unverified',
  BOUNDARY: 'evidence-chip--boundary',
}

export default function MpsPreflightExamplePage() {
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: 'MPS Preflight sample report',
    description: 'A transparent, illustrative example of an MPS Preflight claim map and verification backlog.',
    mainEntityOfPage: 'https://www.mahastrategies.com/mps/preflight/example',
    isPartOf: { '@type': 'WebSite', name: 'Maha Strategies', url: 'https://www.mahastrategies.com' },
    publisher: { '@type': 'Organization', '@id': 'https://www.mahastrategies.com/#organization', name: 'Maha Strategies LLC' },
    about: { '@type': 'Thing', name: 'Maha Provenance Standard' },
  }

  return (
    <main className="evidence-page">
      <article className="evidence-container evidence-container--narrow">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
        <header className="border-t border-[var(--border-default)] pt-5">
          <p className="evidence-kicker">Sample deliverable · not a client report</p>
          <h1 className="evidence-title evidence-title--product">What does an MPS Preflight report look like?</h1>
          <p className="evidence-lede mt-7">A private preflight converts a document extract into a claim map and a short, actionable verification backlog.</p>
          <p className="evidence-copy mt-5">This worked example shows the report structure—not an audit of a real text, organization, or source.</p>
          <Link href="/mps/preflight" className="evidence-link mt-7 inline-block font-mono text-xs uppercase tracking-widest">← MPS Preflight</Link>
        </header>

        <section className="evidence-section">
          <div className="evidence-inset">
            <p className="evidence-kicker">Transparency note</p>
            <p className="evidence-copy mt-3">Every excerpt, source, and result below is fictional and written solely to demonstrate the MPS report format. No item is marked VERIFIED: this sample has no primary-source packet, and MPS Preflight is automated triage rather than human or primary-source verification.</p>
          </div>
        </section>

        <section className="evidence-section">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="evidence-kicker">01 · claim map</p>
              <h2 className="evidence-section-title mt-4">Four representative status decisions</h2>
            </div>
            <span className="evidence-kicker">Illustrative input · 4 claims</span>
          </div>
          <div className="mt-6 divide-y divide-[var(--border-default)] border-y border-[var(--border-default)]">
            {sampleClaims.map((claim) => (
              <section key={claim.id} className="py-7">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className="evidence-kicker">{claim.id}</span>
                  <span className={`evidence-chip ${tagStyles[claim.label]}`}>{claim.label}</span>
                </div>
                <blockquote className="mt-4 border-l-2 border-[var(--border-default)] pl-5 font-editorial text-xl leading-relaxed text-[var(--text-primary)]">“{claim.excerpt}”</blockquote>
                <p className="evidence-copy mt-4">{claim.rationale}</p>
                <p className="evidence-kicker mt-4">Next action: <span className="normal-case tracking-normal text-[var(--text-secondary)]">{claim.action}</span></p>
              </section>
            ))}
          </div>
        </section>

        <section className="evidence-section grid gap-4 sm:grid-cols-3">
          <article className="evidence-card"><p className="evidence-kicker">02</p><h2 className="evidence-card-title mt-4">Claim map</h2><p className="evidence-card-copy mt-3">Each extractable claim receives a readable MPS status and a reason.</p></article>
          <article className="evidence-card"><p className="evidence-kicker">03</p><h2 className="evidence-card-title mt-4">Verification backlog</h2><p className="evidence-card-copy mt-3">Prioritized next actions distinguish research work from judgment calls.</p></article>
          <article className="evidence-card"><p className="evidence-kicker">04</p><h2 className="evidence-card-title mt-4">Report record</h2><p className="evidence-card-copy mt-3">The private report includes a downloadable machine-readable record alongside the reading view.</p></article>
        </section>

        <section className="evidence-section">
          <div className="evidence-inset grid gap-8 sm:grid-cols-[1.1fr_.9fr]">
          <div>
            <p className="evidence-kicker">Private MPS Preflight</p>
            <h2 className="evidence-section-title mt-4">Run this on your own draft.</h2>
            <p className="evidence-copy mt-4">For $49, submit up to about 2,000 words and receive a private claim map, verification backlog, and downloadable record. Your source text is processed transiently; the report retains an input hash and its claim excerpts.</p>
            <div className="mt-7 flex flex-wrap gap-4">
              <Link href="/mps/preflight" className="evidence-action evidence-action--primary">Start a private preflight — $49</Link>
              <Link href="/audit" className="evidence-action evidence-action--secondary">Try the free public preflight</Link>
            </div>
          </div>
          <aside className="border-t border-[var(--border-default)] pt-6 sm:border-l sm:border-t-0 sm:pl-8 sm:pt-0">
            <p className="evidence-kicker">Important limit</p>
            <p className="evidence-card-copy mt-3">A preflight does not certify a document, perform primary-source verification, or replace legal, security, investment, medical, or other specialist review. For complete manuscripts or high-stakes decisions, <Link href="/contact" className="evidence-link">request a human Evidence Audit</Link>.</p>
          </aside>
          </div>
        </section>
      </article>
    </main>
  )
}
