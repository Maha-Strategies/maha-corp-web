import type { Metadata } from 'next'

const title = 'Physical-Goods Test Terms | Maha Strategies'
const description = 'Version 1.0 operational terms for bounded, enquiry-only physical-goods tests offered by Maha Strategies through CARP/CABEZON.'

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: '/terms/physical-goods' },
  openGraph: { title, description, type: 'article', url: '/terms/physical-goods' },
}

const quoteRequirements = [
  'The exact product, quantity, available inventory, photographed condition, remaining shelf life, and seller-of-record capacity.',
  'The buyer, recipient, destination, and importer-of-record responsibility where applicable.',
  'The final item price, packing, carrier service, tracking, insurance, duties, taxes, clearance, last-mile allocation, total price, currency, and quote expiry.',
  'The delivery window, risk-of-loss point, inspection period, acceptance method, and remedies for loss, damage, delay, rejection, or non-delivery.',
]

export default function PhysicalGoodsTermsPage() {
  return (
    <main className="evidence-page">
      <div className="evidence-container evidence-container--narrow">
        <header className="border-t border-[var(--border-default)] pt-5">
          <p className="evidence-kicker flex flex-wrap justify-between gap-3"><span>Physical-goods test terms</span><span>Version 1.0 · 27 August 2026</span></p>
          <h1 className="evidence-title evidence-title--product">Enquiry first. Quote second. Money only after the shipment path is explicit.</h1>
          <p className="evidence-lede mt-7">These are operational boundaries for Maha&apos;s bounded physical-goods tests. Current listings are not purchasable and create no reservation, payment, escrow, or delivery obligation.</p>
        </header>

        <section className="evidence-section" aria-labelledby="activation">
          <p className="evidence-kicker text-[var(--status-boundary)]">Activation gate</p>
          <h2 id="activation" className="evidence-section-title mt-4">A listing may become purchasable only through an accepted order-specific quote.</h2>
          <ul className="mt-7 space-y-3 text-sm leading-7 text-[var(--text-secondary)]">{quoteRequirements.map((item) => <li key={item}>• {item}</li>)}</ul>
          <p className="evidence-copy mt-6">If any required field is absent, uncertain, expired, or contradicted by current evidence, the offer remains enquiry-only and fails closed without payment instructions.</p>
        </section>

        <section className="evidence-section" aria-labelledby="evidence-condition">
          <p className="evidence-kicker">Evidence and condition</p>
          <h2 id="evidence-condition" className="evidence-section-title mt-4">The buyer must be able to inspect the unit being quoted.</h2>
          <p className="evidence-copy mt-5">Before accepting a quote, the buyer receives or can inspect dated product images, label and batch details available to Maha, acquisition evidence if available, seal and visible-condition evidence, storage history known to Maha, inventory reconfirmation, and the evidence digests used by the listing. Manufacturer statements are label evidence unless independently verified.</p>
        </section>

        <section className="evidence-section" aria-labelledby="shipping-import">
          <p className="evidence-kicker">Shipping and import</p>
          <h2 id="shipping-import" className="evidence-section-title mt-4">No destination is assumed to be eligible.</h2>
          <p className="evidence-copy mt-5">The quote must name the carrier and service, dispatch origin, tracking, insurance, expected window, customs and food-import checks performed, importer of record, duties and taxes allocation, customs-clearance responsibility, last-mile responsibility, and the point at which risk of loss transfers. The buyer remains responsible for supplying accurate recipient and import information assigned to it in the quote.</p>
        </section>

        <section className="evidence-section" aria-labelledby="acceptance-recovery">
          <p className="evidence-kicker">Acceptance and recovery</p>
          <h2 id="acceptance-recovery" className="evidence-section-title mt-4">The quote must define what happens when delivery does not go normally.</h2>
          <p className="evidence-copy mt-5">Before payment, the parties must agree the inspection and acceptance window, evidence required for a loss or damage claim, whether return is lawful and practical, refund or replacement authority, escrow release condition if escrow is used, dispute route, response windows, and recovery path for an unavailable buyer, seller, carrier, escrower, or administrator. No recovery outcome is implied by discovery metadata alone.</p>
        </section>

        <section className="evidence-section" aria-labelledby="current-boundary">
          <p className="evidence-kicker text-[var(--status-unverified)]">Current boundary</p>
          <h2 id="current-boundary" className="evidence-section-title mt-4">The public tea tests remain non-purchasable.</h2>
          <p className="evidence-copy mt-5">An enquiry does not reserve inventory. Maha may decline a quote after checking stock, lawfulness, carrier availability, total cost, or risk. Any accepted quote must identify its expiry and supersedes conflicting generic language for that order. These operational terms are not legal, customs, tax, food-safety, or import advice.</p>
          <a className="evidence-action evidence-action--secondary mt-7" href="/terms/carp-physical-goods-v1.json">Machine-readable terms ↗</a>
        </section>
      </div>
    </main>
  )
}
