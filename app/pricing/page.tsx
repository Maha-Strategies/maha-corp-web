import type { Metadata } from 'next'
import Link from 'next/link'

import {
  ASSESSMENT_SCOPE,
  ASSESSMENT_TIERS,
  FOUNDING_PARTNER,
  POSITIONING,
} from '@/lib/commercial/context-control-assessment-offer'

const title = 'Context Control Assessment Pricing | Maha Strategies'
const description = 'A fixed-scope, reproducible assessment for one context-control or governed AI workflow, with public evidence, explicit limits, and a written recommendation.'

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: '/pricing' },
  openGraph: {
    title,
    description,
    type: 'website',
    url: '/pricing',
  },
}

const exclusions = [
  'No production deployment. The assessment measures; it does not install.',
  'No performance or savings guarantee. Nothing is promised before measurement.',
  'No certification or compliance opinion of any kind.',
  'No open-ended discovery, data migration, or custom implementation work.',
] as const

export default function PricingPage() {
  const serviceJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: 'Maha Context-Control Evidence Assessment',
    description,
    provider: {
      '@type': 'Organization',
      name: 'Maha Strategies LLC',
      url: 'https://www.mahastrategies.com',
    },
    offers: ASSESSMENT_TIERS.map((tier) => ({
      '@type': 'Offer',
      name: tier.name,
      price: tier.price.replace(/[$,]/g, ''),
      priceCurrency: 'USD',
      availability: 'https://schema.org/InStock',
      url: 'https://www.mahastrategies.com/pricing',
    })),
  }

  return (
    <main className="evidence-page">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(serviceJsonLd).replace(/</g, '\\u003c') }}
      />
      <div className="evidence-container evidence-container--narrow">
        <header className="border-t border-[var(--border-default)] pt-5">
          <p className="evidence-kicker flex flex-wrap justify-between gap-3">
            <span>Context-control evidence assessment</span>
            <span>Fixed scope · inspectable method</span>
          </p>
          <h1 className="evidence-title evidence-title--product">Measure one consequential AI workflow before you commit to a larger change.</h1>
          <p className="evidence-lede mt-7">
            Maha runs a bounded, reproducible assessment of context control or governed agent actions and returns evidence a technical, risk, or procurement reviewer can inspect.
          </p>
          <p className="evidence-copy mt-5">
            This is a decision package: a frozen workload, comparable paths, explicit boundaries, and a written recommendation to proceed, revise, or stop. It is not an implementation promise or a certification badge.
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            <a className="evidence-action evidence-action--primary" href="mailto:mayone@mahastrategies.com?subject=Context%20Control%20Evidence%20Assessment">
              Request a bounded assessment ↗
            </a>
            <Link className="evidence-action evidence-action--secondary" href="/developers">
              Review developer infrastructure ↗
            </Link>
          </div>
        </header>

        <section className="evidence-section" aria-labelledby="assessment-options">
          <p className="evidence-kicker">Assessment options</p>
          <h2 id="assessment-options" className="evidence-section-title mt-4">A fixed fee for a bounded decision.</h2>
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            {ASSESSMENT_TIERS.map((tier) => (
              <article key={tier.id} className="evidence-card flex min-h-full flex-col">
                <p className="evidence-card-title">{tier.name}</p>
                <p className="mt-4 font-mono text-3xl font-semibold text-[var(--text-primary)]">{tier.price}</p>
                <p className="evidence-card-copy mt-4 flex-1">{tier.summary}</p>
              </article>
            ))}
          </div>
          <div className="mt-6 border-l-[3px] border-[var(--status-boundary)] bg-[rgba(160,111,20,0.08)] p-6">
            <p className="evidence-kicker text-[var(--status-boundary)]">Founding design partner · {FOUNDING_PARTNER.price}</p>
            <p className="evidence-card-copy mt-3">Available to {FOUNDING_PARTNER.limit}, {FOUNDING_PARTNER.requirement}.</p>
            <p className="mt-3 text-xs leading-6 text-[var(--text-muted)]">{FOUNDING_PARTNER.notADiscount}</p>
          </div>
        </section>

        <section className="evidence-section" aria-labelledby="scope">
          <p className="evidence-kicker">What the assessment produces</p>
          <h2 id="scope" className="evidence-section-title mt-4">A method a reviewer can challenge, reproduce, or decline.</h2>
          <ul className="mt-7 space-y-3 text-sm leading-7 text-[var(--text-secondary)]">
            {ASSESSMENT_SCOPE.map((item) => <li key={item}>• {item}</li>)}
          </ul>
        </section>

        <section className="evidence-section" aria-labelledby="positioning">
          <p className="evidence-kicker">What to judge Maha on</p>
          <h2 id="positioning" className="evidence-section-title mt-4">Controls that remain inspectable after the demo.</h2>
          <ul className="mt-7 space-y-3 text-sm leading-7 text-[var(--text-secondary)]">
            {POSITIONING.map((item) => <li key={item}>• {item}</li>)}
          </ul>
          <p className="mt-5 max-w-3xl text-xs leading-6 text-[var(--text-muted)]">
            No retention-superiority claim is made here. The public evidence package includes a dense baseline that scores higher on evidence retention than Maha&apos;s production scorer on the frozen MCRB-1 cohort.
          </p>
        </section>

        <section className="evidence-section" aria-labelledby="limits">
          <p className="evidence-kicker">Explicit limits</p>
          <h2 id="limits" className="evidence-section-title mt-4">The assessment narrows uncertainty; it does not erase it.</h2>
          <ul className="mt-7 space-y-3 text-sm leading-7 text-[var(--text-secondary)]">
            {exclusions.map((item) => <li key={item}>• {item}</li>)}
          </ul>
          <div className="mt-8 flex flex-wrap gap-3">
            <a className="evidence-action evidence-action--primary" href="mailto:mayone@mahastrategies.com?subject=Context%20Control%20Evidence%20Assessment">
              Discuss one workflow ↗
            </a>
            <a className="evidence-action evidence-action--secondary" href="/assessments/context-control-evidence-assessment-sample.pdf" target="_blank" rel="noreferrer">
              Read the sample assessment ↗
            </a>
            <a className="evidence-action evidence-action--secondary" href="/security/context-control-security-boundary.pdf" target="_blank" rel="noreferrer">
              Read the security boundary ↗
            </a>
          </div>
        </section>
      </div>
    </main>
  )
}
