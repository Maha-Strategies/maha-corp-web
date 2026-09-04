import type { Metadata } from 'next'
import Link from 'next/link'

import EvidencePreflightForm from './EvidencePreflightForm'
import { EVIDENCE_WORKFLOW_PATH } from '@/lib/evidence-workflow-examples'

const SITE_URL = 'https://www.mahastrategies.com'
const PATH = '/tools/evidence-preflight'
const title = 'Evidence Preflight for Scientific Claims | Maha Strategies'
const description = 'Check up to three scientific claims for source identity format, exact locators, scope, evidence readiness, unsupported inference risk, rights and access limitations.'

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: PATH },
  openGraph: { type: 'website', url: `${SITE_URL}${PATH}`, siteName: 'Maha Strategies', title, description, images: [{ url: '/og-master.png', width: 1200, height: 630, alt: 'Maha Strategies evidence preflight' }] },
  twitter: { card: 'summary_large_image', title, description, images: ['/og-master.png'] },
}

const checks = [
  ['Source identity', 'Normalizes DOI or public HTTPS syntax without pretending the source was resolved or opened.'],
  ['Exact locator', 'Requires a bounded page, section, paragraph, figure, table, equation or equivalent location.'],
  ['Claim scope', 'Flags absolute, universal, certainty and certification language for review.'],
  ['Evidence readiness', 'Separates metadata-only records from user-supplied located excerpts.'],
  ['Inference risk', 'Identifies causal, predictive, fitness and compliance language that is absent from the supplied excerpt.'],
  ['Rights and access', 'Records the caller-declared basis and keeps unknown, restricted or unnamed licences unresolved.'],
] as const

export default function EvidencePreflightPage() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    '@id': `${SITE_URL}${PATH}#application`,
    name: 'Maha Evidence Preflight',
    description,
    url: `${SITE_URL}${PATH}`,
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
    isAccessibleForFree: true,
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD', availability: 'https://schema.org/InStock' },
    featureList: checks.map(([name]) => name),
  }
  return (
    <main className="evidence-page">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />
      <div className="evidence-container">
        <header className="max-w-5xl border-t border-[var(--border-default)] pt-5">
          <p className="evidence-kicker flex flex-wrap justify-between gap-3"><span>Maha Provenance Standard</span><span>Deterministic · no source fetching · up to 3 claims</span></p>
          <h1 className="evidence-title evidence-title--product">Find the evidence gaps before commissioning an audit.</h1>
          <p className="evidence-lede mt-7 max-w-4xl">Submit a bounded claim, its DOI or public URL, a short authorized excerpt and an exact locator. Maha returns a digest-bound structural assessment without asking an AI model to invent or verify facts.</p>
          <div className="mt-9 flex flex-wrap gap-3"><a href="#run-preflight" className="evidence-action evidence-action--primary">Run the free preflight ↓</a><Link href="/evidence-audit" className="evidence-action evidence-action--secondary">Understand a full evidence audit ↗</Link></div>
        </header>

        <section className="evidence-section" aria-labelledby="what-it-checks">
          <p className="evidence-kicker">What the preflight checks</p><h2 id="what-it-checks" className="evidence-section-title mt-4">Six gates before source interpretation begins.</h2>
          <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">{checks.map(([name, body], index) => <article key={name} className="evidence-card"><p className="evidence-kicker">0{index + 1}</p><h3 className="evidence-card-title mt-3 text-lg">{name}</h3><p className="evidence-card-copy mt-3">{body}</p></article>)}</div>
        </section>

        <section className="evidence-section grid gap-7 lg:grid-cols-2" aria-label="Privacy and epistemic boundaries">
          <article className="evidence-inset"><p className="evidence-kicker">Privacy boundary</p><h2 className="evidence-section-title mt-4">Do not submit confidential material.</h2><p className="evidence-copy mt-4 text-sm">Claims and excerpts are processed transiently and returned to your browser. Maha stores only keyed pseudonyms and aggregate request counts needed for replay protection, abuse control and activation measurement—not the text, source identifier, title or locator.</p></article>
          <article className="evidence-inset"><p className="evidence-kicker">Evidence boundary</p><h2 className="evidence-section-title mt-4">Structure is not verification.</h2><p className="evidence-copy mt-4 text-sm">The tool never labels a claim verified. It does not fetch sources, authenticate excerpts, establish rights, detect retractions, compare literature or determine truth. Those require an inspected-source workflow.</p></article>
        </section>

        <EvidencePreflightForm />

        <section className="evidence-section" aria-labelledby="future-offer">
          <div className="border border-[var(--border-default)] bg-[var(--surface-paper)] p-7 sm:p-10">
            <p className="evidence-kicker">Proposed full Evidence Dossier · purchase disabled</p>
            <div className="mt-5 grid gap-7 lg:grid-cols-[1fr_auto] lg:items-end"><div><h2 id="future-offer" className="evidence-section-title">Up to 10 bounded claims · proposed price $250</h2><p className="evidence-copy mt-4 max-w-3xl text-sm">The proposed offer would compile inspected passages, claim-level findings, limitations and provenance into signed JSON-LD and PDF. It will not open for checkout until privacy, delivery, refund and failure drills pass.</p></div><button type="button" disabled aria-disabled="true" className="evidence-action evidence-action--secondary cursor-not-allowed opacity-50">Purchase unavailable</button></div>
          </div>
        </section>

        <section className="evidence-section"><p className="evidence-copy text-sm">Continue with the <Link href={EVIDENCE_WORKFLOW_PATH} className="evidence-link">worked evidence workflows</Link>, read the <Link href="/mps" className="evidence-link">Maha Provenance Standard</Link>, compare the existing <Link href="/audit" className="evidence-link">AI-assisted passage auditor</Link>, or return to <Link href="/tools" className="evidence-link">all self-service tools</Link>.</p></section>
      </div>
    </main>
  )
}
