import type { Metadata } from 'next'
import Link from 'next/link'

import {
  ASSESSMENT_SCOPE,
  ASSESSMENT_TIERS,
  FOUNDING_PARTNER,
  POSITIONING,
} from '@/lib/commercial/context-control-assessment-offer'

const title = 'Context-Control Evidence Assessment | Maha Strategies'
const description = 'A fixed-fee, bounded measurement of one context pipeline. Your workload is frozen and digest-recorded, three paths are compared on tokens, cost, evidence retention, citations, latency and failure behaviour, and the result is a written proceed, revise, or stop recommendation.'

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: '/context-control' },
  openGraph: { title, description, type: 'website', url: '/context-control' },
}

/**
 * Restated rather than imported from ASSESSMENT_EXCLUSIONS, which carries a
 * denial naming the gateway vendor. That denial belongs on the integration
 * page, where the vendor is actually named; repeating it on the general offer
 * would introduce the association it exists to deny. Same reasoning as
 * `/pricing`, whose exclusions are restated the same way.
 */
const exclusions = [
  'No production deployment. The assessment measures; it does not install.',
  'No performance or savings guarantee. Nothing is promised before measurement.',
  'No certification or compliance opinion of any kind.',
  'No open-ended discovery, data migration, or custom implementation work.',
] as const

/**
 * The gate, as the buyer experiences it. `REQUIRED_PUBLIC_ARTIFACTS` is the
 * operator-side list of paths that must exist before a price may be shown;
 * this is the same four documents with the reason a prospect would open each.
 * At the list fee a prospect is buying a method, so the method is readable
 * before the ask, not after it. No price literal here: the figures live in the
 * offer module, and a stale one in a comment is how they drift.
 */
const evidencePackage = [
  {
    href: '/assessments/context-control-evidence-assessment-sample.pdf',
    name: 'Sample assessment',
    detail: 'A complete worked deliverable in the format you would receive, so the output is known before the engagement starts.',
  },
  {
    href: '/security/context-control-security-boundary.pdf',
    name: 'Security boundary',
    detail: 'What is handled, what is retained, and what never leaves your side. Read this before preparing a workload.',
  },
  {
    href: '/benchmarks/wso2/live-evaluation-evidence.json',
    name: 'Live gateway evaluation',
    detail: 'A full run on a synthetic 20-workload corpus: per-workload rows, aggregates, cost assumptions, and its own stated limitations.',
  },
  {
    href: '/benchmarks/mcrb-1/dense/results.json',
    name: 'MCRB-1 dense baseline',
    detail: 'The retrieval baseline measured against the frozen cohort — including where it scores higher than Maha does.',
  },
] as const

const method = [
  { step: '01', name: 'Freeze', detail: 'You supply one sanitized workload. Configuration and inputs are digest-recorded before anything runs, so the scoring target cannot move once results are visible.' },
  { step: '02', name: 'Compare', detail: 'Three paths are run against that frozen workload: your current baseline, your gateway-native compression, and Maha.' },
  { step: '03', name: 'Decide', detail: 'You receive sanitized per-workload findings and a written recommendation to proceed, revise, or stop. Stop is a real outcome.' },
] as const

export default function ContextControlPage() {
  const serviceJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: 'Context-Control Evidence Assessment',
    serviceType: 'Context pipeline measurement and evaluation',
    description,
    provider: { '@type': 'Organization', name: 'Maha Strategies LLC', url: 'https://www.mahastrategies.com' },
    url: 'https://www.mahastrategies.com/context-control',
    offers: ASSESSMENT_TIERS.map((tier) => ({
      '@type': 'Offer',
      name: tier.name,
      description: tier.summary,
      price: tier.price.replace(/[$,]/g, ''),
      priceCurrency: 'USD',
      url: 'https://www.mahastrategies.com/context-control',
    })),
  }

  return (
    <main className="evidence-page">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(serviceJsonLd).replace(/</g, '\\u003c') }} />
      <div className="evidence-container evidence-container--narrow">
        <header className="border-t border-[var(--border-default)] pt-5">
          <p className="evidence-kicker flex flex-wrap justify-between gap-3"><span>Context-control evidence assessment</span><span>Fixed fee · frozen scope · reproducible</span></p>
          <h1 className="evidence-title evidence-title--product">Measure the context pipeline before you commit to it.</h1>
          <p className="evidence-lede mt-7">One workload, frozen and digest-recorded. Three paths compared on tokens, cost, evidence retention, citations, latency and failure behaviour. A written recommendation to proceed, revise, or stop.</p>
          <p className="evidence-copy mt-5">Context compression is easy to adopt on a demo and expensive to unwind in production. This is a bounded engagement that answers whether it is worth doing on <em>your</em> workload, at a fixed fee, before anything is installed.</p>
          <div className="mt-9 flex flex-wrap gap-3">
            <a className="evidence-action evidence-action--primary" href="mailto:mayone@mahastrategies.com?subject=Context%20Control%20Evidence%20Assessment">Request a bounded assessment ↗</a>
            <Link className="evidence-action evidence-action--secondary" href="#evidence">Read the method first ↓</Link>
            <Link className="evidence-action evidence-action--secondary" href="#tiers">See the fees ↓</Link>
          </div>
        </header>

        <section className="mt-12 grid gap-4 md:grid-cols-3" aria-label="How the assessment runs">
          {method.map((item) => (
            <article key={item.step} className="evidence-card flex min-h-full flex-col">
              <p className="evidence-kicker">{item.step} · {item.name}</p>
              <p className="evidence-card-copy mt-4 flex-1">{item.detail}</p>
            </article>
          ))}
        </section>

        <section id="evidence" className="evidence-section scroll-mt-24" aria-labelledby="evidence-heading">
          <p className="evidence-kicker">Read the method before you pay for it</p>
          <h2 id="evidence-heading" className="evidence-section-title mt-4">The whole method is public.</h2>
          <p className="evidence-copy mt-5">A five-figure fee for measurement work is only honest if the prospect can read the method first. These four documents are published in full, they include their own limitations, and none of them requires a conversation to obtain.</p>
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            {evidencePackage.map((artifact) => (
              <article key={artifact.href} className="evidence-card flex min-h-full flex-col">
                <h3 className="evidence-card-title">{artifact.name}</h3>
                <p className="evidence-card-copy mt-4 flex-1">{artifact.detail}</p>
                <a className="evidence-link mt-6 inline-block font-mono text-[10px] uppercase tracking-widest" href={artifact.href} target="_blank" rel="noreferrer">Open ↗</a>
              </article>
            ))}
          </div>
          <p className="mt-6 text-xs leading-6 text-[var(--text-muted)]">Every figure in those artifacts is bounded by the run that produced it. The gateway evaluation is a single execution against a synthetic corpus and does not establish performance on any customer workload — the artifact says so itself, and that sentence is the reason this assessment exists.</p>
        </section>

        <section id="tiers" className="evidence-section scroll-mt-24" aria-labelledby="tiers-heading">
          <p className="evidence-kicker">Fees</p>
          <h2 id="tiers-heading" className="evidence-section-title mt-4">A fixed fee for a bounded decision.</h2>
          <p className="evidence-copy mt-5">The fee is agreed before the workload is frozen and does not move with the result. An assessment that recommends stopping costs the same as one that recommends proceeding.</p>
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            {ASSESSMENT_TIERS.map((tier) => (
              <article key={tier.id} className="evidence-card flex min-h-full flex-col">
                <p className="evidence-card-title">{tier.name}</p>
                <p className="mt-4 font-mono text-3xl font-semibold text-[var(--text-primary)]">{tier.price}</p>
                <p className="evidence-card-copy mt-4 flex-1">{tier.summary}</p>
              </article>
            ))}
          </div>
          <div className="mt-4 border-l-[3px] border-[var(--status-boundary)] bg-[rgba(160,111,20,0.08)] p-6">
            <p className="evidence-kicker text-[var(--status-boundary)]">Founding design partner · {FOUNDING_PARTNER.price}</p>
            <p className="evidence-card-copy mt-3">Available to {FOUNDING_PARTNER.limit}, {FOUNDING_PARTNER.requirement}.</p>
            <p className="mt-3 text-xs leading-6 text-[var(--text-muted)]">{FOUNDING_PARTNER.notADiscount}</p>
          </div>
        </section>

        <section className="evidence-section" aria-labelledby="scope-heading">
          <p className="evidence-kicker">Scope and limits</p>
          <h2 id="scope-heading" className="evidence-section-title mt-4">What is measured, and what is refused.</h2>
          <div className="mt-8 grid gap-10 md:grid-cols-2">
            <div>
              <p className="evidence-kicker">What it produces</p>
              <ul className="mt-5 space-y-3 text-sm leading-7 text-[var(--text-secondary)]">{ASSESSMENT_SCOPE.map((item) => <li key={item}>• {item}</li>)}</ul>
            </div>
            <div>
              <p className="evidence-kicker">Explicit limits</p>
              <ul className="mt-5 space-y-3 text-sm leading-7 text-[var(--text-secondary)]">{exclusions.map((item) => <li key={item}>• {item}</li>)}</ul>
            </div>
          </div>
          <p className="mt-8 max-w-3xl text-xs leading-6 text-[var(--text-muted)]">No production credentials and no personal data are accepted. The workload you supply must be sanitized before it is sent, and the security boundary document states exactly what is handled and retained.</p>
        </section>

        <section className="evidence-section" aria-labelledby="judge-heading">
          <p className="evidence-kicker">What to judge Maha on</p>
          <h2 id="judge-heading" className="evidence-section-title mt-4">Determinism and evidence, not a headline number.</h2>
          <ul className="mt-8 space-y-3 text-sm leading-7 text-[var(--text-secondary)]">{POSITIONING.map((item) => <li key={item}>• {item}</li>)}</ul>
          <p className="mt-8 max-w-3xl text-xs leading-6 text-[var(--text-muted)]">No retention-superiority claim is made here. The public evidence package includes a dense baseline that scores higher on evidence retention than Maha&apos;s production scorer on the frozen MCRB-1 cohort. It is linked above rather than omitted, because a positioning line contradicted by your own published artifact is worse than no positioning line.</p>
        </section>

        <section className="evidence-section" aria-labelledby="start-heading">
          <p className="evidence-kicker">How to start</p>
          <h2 id="start-heading" className="evidence-section-title mt-4">One email, then a frozen scope.</h2>
          <p className="evidence-copy mt-5">Describe the workload and the decision you are trying to make. If the assessment is not the right instrument, that is said before a fee is quoted — the scoping conversation is not itself billable.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a className="evidence-action evidence-action--primary" href="mailto:mayone@mahastrategies.com?subject=Context%20Control%20Evidence%20Assessment">Request a bounded assessment ↗</a>
            <Link className="evidence-action evidence-action--secondary" href="/context-compiler">Review the compiler ↗</Link>
            <Link className="evidence-action evidence-action--secondary" href="/pricing">Compare every option ↗</Link>
          </div>
        </section>
      </div>
    </main>
  )
}
