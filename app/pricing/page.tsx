import type { Metadata } from 'next'
import Link from 'next/link'

import {
  ASSESSMENT_SCOPE,
  ASSESSMENT_TIERS,
  FOUNDING_PARTNER,
  POSITIONING,
} from '@/lib/commercial/context-control-assessment-offer'
import { API_CREDIT_PACKS } from '@/lib/api-credit-billing'
import { offerPriceUsd, payableOffers } from '@/lib/x402/offers'

const title = 'Pricing and Purchase Options | Maha Strategies'
const description = 'Compare Maha Strategies self-service products, developer credits, machine-payable APIs, scoped assessments, research services, and enquiry-only agent-commerce pilots.'

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: '/pricing' },
  openGraph: { title, description, type: 'website', url: '/pricing' },
}

const developerPlans = [
  { name: 'Builder', price: '$20 / month', detail: '10,000 monthly API credits. Monthly credits reset each billing cycle.' },
  { name: 'Scale', price: '$100 / month', detail: '60,000 monthly API credits. Monthly credits reset each billing cycle.' },
] as const

const apiCreditPacks = [
  { name: 'Starter', credits: API_CREDIT_PACKS.starter.credits },
  { name: 'Pro', credits: API_CREDIT_PACKS.pro.credits },
  { name: 'Enterprise', credits: API_CREDIT_PACKS.enterprise.credits },
] as const

const selfServiceOffers = [
  {
    name: 'MPS Preflight', price: '$49 one time', label: 'Provenance · self service',
    detail: 'A private claim map, verification backlog, and machine-readable record for one nonfiction extract of up to 12,000 characters.',
    href: '/mps/preflight', action: 'Run the preflight',
  },
  {
    name: 'MPS Prepaid Audit API Access', price: 'Price shown at checkout', label: 'Provenance · prepaid credits',
    detail: 'A scoped credential and fixed pack of claim-level audit invocations. The purchase page reports whether checkout is currently enabled.',
    href: '/mps/audit-access', action: 'Check audit access',
  },
  {
    name: 'Receipt → CSV batch', price: 'Free demo · batch price at checkout', label: 'Utility · one-time checkout',
    detail: 'Test one receipt for free, then process up to 20 pasted or photographed receipts in one paid batch with automatic refund when none parse.',
    href: '/utilities/receipts', action: 'Try the utility',
  },
  {
    name: 'Book MCP access', price: 'Web editions free · MCP price at checkout', label: 'Knowledge · per-book entitlement',
    detail: 'Public books remain free to read. A paid entitlement adds heading-addressable structured content for a local MCP client.',
    href: '/books/mcp-access', action: 'Review MCP access',
  },
  {
    name: 'Maha OS', price: 'App-store pricing', label: 'Software · external app stores',
    detail: 'The local-first mobile app is acquired through Apple or Google. The applicable app-store terms and payment controls govern the purchase.',
    href: '/software', action: 'Open Maha OS',
  },
] as const

const scopedOffers = [
  {
    name: 'Rapid Intelligence Brief', price: 'Starting at $500',
    detail: 'A bounded research brief targeted for delivery within five business days after a human confirms fit, sources, deliverable, price, and timing.',
    href: '/rapid-intelligence-brief', action: 'Scope a rapid brief',
  },
  {
    name: 'Verified Research Brief', price: '$2,500',
    detail: 'A deeper research engagement targeted for ten business days after the question and evidence boundary are narrowed with a human.',
    href: '/consulting', action: 'Discuss verified research',
  },
  {
    name: 'Custom implementation', price: 'Priced after scope',
    detail: 'Gateway middleware, MCP/A2A integration, governed workflow state graphs, or other implementation work is quoted separately after one bounded workflow and acceptance criteria are agreed.',
    href: '/contact?service=general', action: 'Describe the workflow',
  },
] as const

const enquiryOnlyOffers = [
  {
    name: 'Samley Cinnamon Tea — pallet RFQ', reference: 'maha:samley-cinnamon-tea:rfq-v1',
    detail: 'Prospective B2B export pilot. Supplier confirmation, destination terms, freight, duties, and a final quote are required before any order can exist.',
  },
  {
    name: 'Bogawantalawa Legend Black Tea — one-box test', reference: 'maha:bogawantalawa-legend-black-tea:retail-test-v1',
    detail: 'One sealed retail unit held by Maha. Destination eligibility, package-condition acceptance, shipping, duties, and a final total must be confirmed first.',
  },
] as const

const exclusions = [
  'No production deployment. The assessment measures; it does not install.',
  'No performance or savings guarantee. Nothing is promised before measurement.',
  'No certification or compliance opinion of any kind.',
  'No open-ended discovery, data migration, or custom implementation work.',
] as const

const modeStyles = {
  verified: {
    border: 'border-[var(--status-verified)]',
    text: 'text-[var(--status-verified)]',
  },
  sourced: {
    border: 'border-[var(--status-sourced)]',
    text: 'text-[var(--status-sourced)]',
  },
  illustrative: {
    border: 'border-[var(--status-illustrative)]',
    text: 'text-[var(--status-illustrative)]',
  },
  boundary: {
    border: 'border-[var(--status-boundary)]',
    text: 'text-[var(--status-boundary)]',
  },
} as const

export default function PricingPage() {
  const fixedPriceOffers = [
    ...ASSESSMENT_TIERS.map((tier) => ({ name: tier.name, price: tier.price.replace(/[$,]/g, '') })),
    { name: 'MPS Preflight', price: '49' },
    { name: 'Verified Research Brief', price: '2500' },
  ]
  const serviceJsonLd = {
    '@context': 'https://schema.org', '@type': 'CollectionPage',
    name: 'Maha Strategies pricing and purchase options', description,
    url: 'https://www.mahastrategies.com/pricing',
    mainEntity: {
      '@type': 'ItemList',
      itemListElement: fixedPriceOffers.map((offer, index) => ({
        '@type': 'ListItem', position: index + 1,
        item: {
          '@type': 'Service', name: offer.name,
          provider: { '@type': 'Organization', name: 'Maha Strategies LLC', url: 'https://www.mahastrategies.com' },
          offers: { '@type': 'Offer', price: offer.price, priceCurrency: 'USD', url: 'https://www.mahastrategies.com/pricing' },
        },
      })),
    },
  }

  return (
    <main className="evidence-page">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(serviceJsonLd).replace(/</g, '\\u003c') }} />
      <div className="evidence-container evidence-container--narrow">
        <header className="border-t border-[var(--border-default)] pt-5">
          <p className="evidence-kicker flex flex-wrap justify-between gap-3"><span>Pricing and purchase options</span><span>Self service · metered · scoped</span></p>
          <h1 className="evidence-title evidence-title--product">Start with the smallest commercial step that answers your question.</h1>
          <p className="evidence-lede mt-7">Buy a bounded provenance product, fund a developer workflow, call a machine-payable API, or scope one consequential assessment without treating every need as an enterprise engagement.</p>
          <p className="evidence-copy mt-5">Each option below states its acquisition mode. “Price at checkout” means the configured price is disclosed before payment. “Enquiry only” means there is no purchase, payment, or escrow path yet.</p>
          <div className="mt-9 flex flex-wrap gap-3">
            <Link className="evidence-action evidence-action--primary" href="#self-service">See self-service options ↓</Link>
            <Link className="evidence-action evidence-action--secondary" href="#assessment-options">Compare assessments ↓</Link>
            <Link className="evidence-action evidence-action--secondary" href="/agent-offers.json">Machine-readable offers ↗</Link>
          </div>
        </header>

        <section className="evidence-section" aria-labelledby="buying-modes">
          <p className="evidence-kicker">Choose by buying mode</p>
          <h2 id="buying-modes" className="evidence-section-title mt-4">The payment boundary is part of the product.</h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <ModeCard status="verified" title="Self service" detail="A human reviews a fixed price or Stripe Checkout before payment." />
            <ModeCard status="sourced" title="Developer credits" detail="Subscriptions or top-ups fund supported APIs after an API key is connected." />
            <ModeCard status="illustrative" title="Machine payable" detail="Only published x402 routes may accept an autonomous USDC payment." />
            <ModeCard status="boundary" title="Human scoped" detail="Research, assessments, implementation, and RFQs require a defined scope first." />
          </div>
        </section>

        <section id="self-service" className="evidence-section scroll-mt-24" aria-labelledby="self-service-options">
          <p className="evidence-kicker">Start without a sales call</p>
          <h2 id="self-service-options" className="evidence-section-title mt-4">Self-service products and one-time checkouts.</h2>
          <div className="mt-8 grid gap-4 md:grid-cols-2">{selfServiceOffers.map((offer) => <OfferCard key={offer.name} {...offer} />)}</div>
        </section>

        <section className="evidence-section" aria-labelledby="developer-credits">
          <p className="evidence-kicker">Build credits and subscriptions</p>
          <h2 id="developer-credits" className="evidence-section-title mt-4">Fund API use at the scale you actually need.</h2>
          <p className="evidence-copy mt-5">Connect a Maha API key in the developer dashboard. Subscription credits reset monthly; purchased top-up credits roll over.</p>
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            {developerPlans.map((plan) => <article key={plan.name} className="evidence-card"><p className="evidence-kicker">Monthly developer plan</p><h3 className="evidence-card-title mt-3">{plan.name}</h3><p className="mt-4 font-mono text-2xl font-semibold text-[var(--text-primary)]">{plan.price}</p><p className="evidence-card-copy mt-4">{plan.detail}</p></article>)}
          </div>
          <div className="evidence-inset mt-4">
            <p className="evidence-kicker">Rollover top-up packs</p>
            <div className="mt-5 grid gap-4 sm:grid-cols-3">
              {apiCreditPacks.map((pack) => <div key={pack.name}><p className="font-mono text-sm font-semibold text-[var(--text-primary)]">{pack.name}</p><p className="mt-2 text-sm text-[var(--text-secondary)]">{pack.credits.toLocaleString('en-US')} credits</p><p className="mt-1 text-xs text-[var(--text-muted)]">Price shown at Stripe Checkout</p></div>)}
            </div>
            <p className="mt-6 text-xs leading-6 text-[var(--text-muted)]">Optional automatic top-up charges $10 for 5,000 rollover credits only after the account owner explicitly enables it and the balance falls below 1,000.</p>
            <Link href="/dashboard" className="evidence-action evidence-action--primary mt-6">Open the credit dashboard ↗</Link>
          </div>
        </section>

        <section className="evidence-section" aria-labelledby="metered-apis">
          <p className="evidence-kicker">Machine-payable APIs</p>
          <h2 id="metered-apis" className="evidence-section-title mt-4">Exact prices for the routes payable now.</h2>
          <p className="evidence-copy mt-5">These are the only x402 contracts this page presents as payable. The live HTTP 402 challenge remains authoritative before a wallet signs.</p>
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            {payableOffers().map((offer) => <article key={offer.id} className="evidence-card flex min-h-full flex-col"><p className="evidence-kicker">x402 · Base · USDC</p><h3 className="evidence-card-title mt-3">{offer.serviceName}</h3><p className="mt-4 font-mono text-2xl font-semibold text-[var(--text-primary)]">{offerPriceUsd(offer)} / call</p><p className="evidence-card-copy mt-4 flex-1">{offer.description}</p><p className="mt-5 break-all font-mono text-[10px] text-[var(--text-muted)]">POST {offer.path}</p></article>)}
          </div>
          <div className="mt-6 flex flex-wrap gap-3"><Link href="/developers" className="evidence-action evidence-action--primary">Review developer infrastructure ↗</Link><Link href="/api/docs/openapi" className="evidence-action evidence-action--secondary">Read OpenAPI ↗</Link></div>
        </section>

        <section id="assessment-options" className="evidence-section scroll-mt-24" aria-labelledby="assessment-heading">
          <p className="evidence-kicker">Context-control assessment options</p>
          <h2 id="assessment-heading" className="evidence-section-title mt-4">A fixed fee for a bounded decision.</h2>
          <p className="evidence-copy mt-5">Maha freezes one workload in context control or governed agent actions and compares inspectable paths before recommending that you proceed, revise, or stop. The assessment does not include implementation.</p>
          <div className="mt-8 grid gap-4 md:grid-cols-2">{ASSESSMENT_TIERS.map((tier) => <article key={tier.id} className="evidence-card flex min-h-full flex-col"><p className="evidence-card-title">{tier.name}</p><p className="mt-4 font-mono text-3xl font-semibold text-[var(--text-primary)]">{tier.price}</p><p className="evidence-card-copy mt-4 flex-1">{tier.summary}</p></article>)}</div>
          <div className="mt-6 border-l-[3px] border-[var(--status-boundary)] bg-[rgba(160,111,20,0.08)] p-6"><p className="evidence-kicker text-[var(--status-boundary)]">Founding design partner · {FOUNDING_PARTNER.price}</p><p className="evidence-card-copy mt-3">Available to {FOUNDING_PARTNER.limit}, {FOUNDING_PARTNER.requirement}.</p><p className="mt-3 text-xs leading-6 text-[var(--text-muted)]">{FOUNDING_PARTNER.notADiscount}</p></div>
          <a className="evidence-action evidence-action--primary mt-7" href="mailto:mayone@mahastrategies.com?subject=Context%20Control%20Evidence%20Assessment">Request a bounded assessment ↗</a>
        </section>

        <section className="evidence-section" aria-labelledby="research-and-build">
          <p className="evidence-kicker">Research and implementation</p>
          <h2 id="research-and-build" className="evidence-section-title mt-4">Human-scoped work with a written boundary.</h2>
          <div className="mt-8 grid gap-4 md:grid-cols-3">{scopedOffers.map((offer) => <OfferCard key={offer.name} label="Human scope required" {...offer} />)}</div>
        </section>

        <section className="evidence-section" aria-labelledby="enquiry-only">
          <p className="evidence-kicker text-[var(--status-boundary)]">Enquiry only · not purchasable</p>
          <h2 id="enquiry-only" className="evidence-section-title mt-4">CABEZON pilots that cannot accept payment yet.</h2>
          <p className="evidence-copy mt-5">Both listings explicitly publish <code>purchasable: false</code>, <code>price: null</code>, and no settlement instructions. An enquiry may lead to a separate destination-specific quote; it is not an order.</p>
          <div className="mt-8 grid gap-4 md:grid-cols-2">{enquiryOnlyOffers.map((offer) => <article key={offer.reference} className="evidence-card"><p className="evidence-kicker text-[var(--status-boundary)]">No payment path</p><h3 className="evidence-card-title mt-3">{offer.name}</h3><p className="evidence-card-copy mt-4">{offer.detail}</p><p className="mt-5 break-all font-mono text-[10px] text-[var(--text-muted)]">{offer.reference}</p></article>)}</div>
          <Link href="/contact?service=general" className="evidence-action evidence-action--secondary mt-7">Make an enquiry ↗</Link>
        </section>

        <section className="evidence-section" aria-labelledby="assessment-method">
          <p className="evidence-kicker">Assessment method and limits</p>
          <h2 id="assessment-method" className="evidence-section-title mt-4">The higher-priced work remains reproducible and bounded.</h2>
          <div className="mt-8 grid gap-10 md:grid-cols-2">
            <div><p className="evidence-kicker">What it produces</p><ul className="mt-5 space-y-3 text-sm leading-7 text-[var(--text-secondary)]">{ASSESSMENT_SCOPE.map((item) => <li key={item}>• {item}</li>)}</ul></div>
            <div><p className="evidence-kicker">Explicit limits</p><ul className="mt-5 space-y-3 text-sm leading-7 text-[var(--text-secondary)]">{exclusions.map((item) => <li key={item}>• {item}</li>)}</ul></div>
          </div>
          <p className="evidence-kicker mt-10">What to judge Maha on</p>
          <ul className="mt-5 space-y-3 text-sm leading-7 text-[var(--text-secondary)]">{POSITIONING.map((item) => <li key={item}>• {item}</li>)}</ul>
          <p className="mt-5 max-w-3xl text-xs leading-6 text-[var(--text-muted)]">No retention-superiority claim is made here. The public evidence package includes a dense baseline that scores higher on evidence retention than Maha&apos;s production scorer on the frozen MCRB-1 cohort.</p>
          <div className="mt-8 flex flex-wrap gap-3"><a className="evidence-action evidence-action--secondary" href="/assessments/context-control-evidence-assessment-sample.pdf" target="_blank" rel="noreferrer">Read the sample assessment ↗</a><a className="evidence-action evidence-action--secondary" href="/security/context-control-security-boundary.pdf" target="_blank" rel="noreferrer">Read the security boundary ↗</a></div>
        </section>
      </div>
    </main>
  )
}

function ModeCard({ status, title, detail }: { status: 'verified' | 'sourced' | 'illustrative' | 'boundary'; title: string; detail: string }) {
  const style = modeStyles[status]
  return <article className={`evidence-card border-l-[3px] ${style.border}`}><p className={`evidence-kicker ${style.text}`}>{title}</p><p className="evidence-card-copy mt-3 text-xs">{detail}</p></article>
}

function OfferCard({ name, price, label, detail, href, action }: { name: string; price: string; label: string; detail: string; href: string; action: string }) {
  return <article className="evidence-card flex min-h-full flex-col"><p className="evidence-kicker">{label}</p><h3 className="evidence-card-title mt-3">{name}</h3><p className="mt-4 font-mono text-xl font-semibold text-[var(--text-primary)]">{price}</p><p className="evidence-card-copy mt-4 flex-1">{detail}</p><Link href={href} className="evidence-link mt-6 inline-block font-mono text-[10px] uppercase tracking-widest">{action} ↗</Link></article>
}
