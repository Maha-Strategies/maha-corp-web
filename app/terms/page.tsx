import type { Metadata } from 'next'
import Link from 'next/link'

const title = 'Terms and Commercial Boundaries | Maha Strategies'
const description = 'Published commercial boundaries for Maha Strategies digital services, physical-goods tests, and enquiry-only CABEZON offers.'

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: '/terms' },
  openGraph: { title, description, type: 'website', url: '/terms' },
}

export default function TermsPage() {
  return (
    <main className="evidence-page">
      <div className="evidence-container evidence-container--narrow">
        <header className="border-t border-[var(--border-default)] pt-5">
          <p className="evidence-kicker flex flex-wrap justify-between gap-3"><span>Commercial terms</span><span>Versioned · bounded · inspectable</span></p>
          <h1 className="evidence-title evidence-title--product">The payment boundary is part of the offer.</h1>
          <p className="evidence-lede mt-7">Maha publishes whether an offering is payable, enquiry-only, or subject to a separate written scope. A discovery record, enquiry, or quote request is not an order.</p>
        </header>

        <section className="evidence-section" aria-labelledby="digital-services">
          <p className="evidence-kicker">Digital services</p>
          <h2 id="digital-services" className="evidence-section-title mt-4">Use the terms attached to the exact service.</h2>
          <p className="evidence-copy mt-5">Machine-payable services publish the resource, price, network, asset, input boundary, retention boundary, and capability limits in their live contract. The fresh HTTP 402 response is authoritative immediately before signing.</p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link href="/pricing" className="evidence-action evidence-action--primary">Review prices and buying modes ↗</Link>
            <Link href="/agent-offers.json" className="evidence-action evidence-action--secondary">Machine-readable offers ↗</Link>
          </div>
        </section>

        <section className="evidence-section" aria-labelledby="physical-goods">
          <p className="evidence-kicker text-[var(--status-boundary)]">Physical-goods tests</p>
          <h2 id="physical-goods" className="evidence-section-title mt-4">No shipment exists until the destination-specific quote is accepted.</h2>
          <p className="evidence-copy mt-5">Maha&apos;s current physical listings are <code>enquiry_only</code>, <code>purchasable: false</code>, and expose no payment, escrow, or delivery instructions. The versioned terms state the evidence, quote, shipping, acceptance, and recovery information required before that can change.</p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link href="/terms/physical-goods" className="evidence-action evidence-action--primary">Read physical-goods terms ↗</Link>
            <a href="/terms/carp-physical-goods-v1.json" className="evidence-action evidence-action--secondary">Read the JSON contract ↗</a>
          </div>
        </section>

        <section className="evidence-section" aria-labelledby="scope-required">
          <p className="evidence-kicker">Human-scoped work</p>
          <h2 id="scope-required" className="evidence-section-title mt-4">A conversation does not authorize delivery or payment.</h2>
          <p className="evidence-copy mt-5">Assessments, research, implementation, and custom work begin only after the parties agree the workflow, deliverables, exclusions, price, acceptance criteria, and timing in writing. Nothing on this page creates a professional, legal, compliance, or performance guarantee.</p>
        </section>
      </div>
    </main>
  )
}
