import type { Metadata } from 'next'
import Link from 'next/link'
import { connection } from 'next/server'
import { categorizedProducts } from '@/lib/x402/product-categories'
import { X402_OFFERS, offerPriceUsd } from '@/lib/x402/offers'
import { productSummary } from '@/lib/x402/product-summaries'
import { readProductUsage } from '@/lib/x402/product-usage'
import { readProductIndex, productIndexLabel } from '@/lib/x402/product-index'
import { readPublicSettlementLedger } from '@/lib/x402/settlement-live-store'
import { SettlementAutoRefresh } from '../settlement/auto-refresh'

export const metadata: Metadata = {
  title: 'x402 Products and Prices | Maha Strategies',
  description: 'All Maha x402 product contracts, categorized with exact USDC prices, availability, examples and boundaries.',
  alternates: { canonical: '/developers/x402-products' },
}

export default async function X402ProductsPage() {
  await connection()
  const [usage, snapshot, index] = await Promise.all([
    readProductUsage(X402_OFFERS.map(o => o.id)), readPublicSettlementLedger(), readProductIndex(),
  ])
  const settled = new Map(snapshot.ledger.summary.byProduct.map(p => [p.id, p]))
  const categories = categorizedProducts()
  const available = X402_OFFERS.filter(o => o.status === 'available').length
  return <main className="evidence-page"><div className="evidence-container">
    <SettlementAutoRefresh />
    <header className="max-w-4xl">
      <p className="evidence-kicker">Base Mainnet · USDC · x402 v2</p>
      <h1 className="evidence-title">x402 products and prices</h1>
      <p className="evidence-lede mt-6">Choose a bounded service, inspect its contract, and confirm the exact payment terms before signing.</p>
      <p className="evidence-copy mt-4">{X402_OFFERS.length} declared products: {available} released and {X402_OFFERS.length - available} withheld or preview. Prices below are per request or bounded batch, not per input record. Withheld prices are proposals, not purchase invitations.</p>
      <p className="evidence-copy mt-4">Only a valid 402 challenge confirms that a released route is enabled for payment. Catalogue availability does not confirm Bazaar indexing. Never repay automatically after an uncertain outcome.</p>
      <p className="evidence-copy mt-4">Usage counts are recorded successful route invocations, not unique buyers or purchases. Retries can count again; free examples and unpaid 402 challenges are not successful calls. Metering is best-effort and historical coverage may be incomplete. Declared operator traffic is self-reported, not verified customer attribution.</p>
      <p className="evidence-copy mt-3">{usage.available ? `Usage meter: ${usage.firstObservedAt ? `${usage.firstObservedAt} through ${usage.lastObservedAt}` : 'no events recorded'}.` : 'Usage meter unavailable — call counts are unknown, not zero.'} Settlement snapshot: {snapshot.ledger.observedAt} ({snapshot.source === 'bundled_fallback' ? 'dated fallback' : snapshot.stale ? 'refresh overdue' : 'saved scan'}). Refreshes while visible every five minutes.</p>
      <p className="evidence-copy mt-3">Bazaar merchant lookup: {index.checkedAt}. Presence is observed catalogue membership, not proof of matching metadata, search rank, organic discovery or customer demand.</p>
      <div className="mt-6 flex flex-wrap gap-4"><Link className="evidence-link" href="/developers/settlement">Live settlement ledger ↗</Link><Link className="evidence-link" href="/api/docs/openapi">API schemas ↗</Link><Link className="evidence-link" href="/developers">Developer hub ↗</Link></div>
    </header>
    <nav aria-label="Product categories" className="my-8 flex flex-wrap gap-3">{categories.filter(c => c.offers.length).map(c => <a key={c.id} href={`#${c.id}`} className="evidence-link">{c.title} ({c.offers.length})</a>)}</nav>
    {categories.filter(c => c.offers.length).map(c => <section key={c.id} id={c.id} aria-labelledby={`${c.id}-title`} className="evidence-section scroll-mt-8">
      <h2 id={`${c.id}-title`} className="evidence-section-title">{c.title}</h2>
      <div className="mt-6 grid gap-4 md:grid-cols-2">{c.offers.map(o => {
        const u = usage.available ? usage.products[o.id] : null
        const s = settled.get(o.id)
        return <article key={o.id} className="evidence-card">
        <div className="flex flex-wrap items-baseline justify-between gap-3"><h3 className="evidence-card-title">{o.serviceName ?? o.id}</h3><span className="font-mono text-lg">{offerPriceUsd(o).replace('$', '')} USDC</span></div>
        <p className="evidence-kicker mt-3">{o.status === 'available' ? 'Released contract' : o.status === 'preview' ? 'Preview — not payable' : 'Withheld — not payable'}</p>
        <p className="evidence-card-copy mt-2 text-xs">{productIndexLabel(index, o.path)}</p>
        <p className="evidence-card-copy mt-3">{productSummary(o)}</p>
        <details className="mt-3">
          <summary className="evidence-link cursor-pointer">Details and limitations</summary>
          <p className="evidence-card-copy mt-3">{o.description}</p>
          <ul className="evidence-card-copy mt-3 list-disc space-y-2 pl-5">{o.capabilityBoundaries.map(boundary => <li key={boundary}>{boundary}</li>)}</ul>
        </details>
        <p className="mt-4 break-all font-mono text-xs">{o.method} {o.path}</p>
        <p className="mt-2 font-mono text-xs">Exact amount: {o.amount} USDC base units</p>
        <dl className="mt-4 grid grid-cols-2 gap-3 text-sm" aria-label={`Usage for ${o.serviceName ?? o.id}`}>
          <div><dt>Recorded successful calls</dt><dd className="font-mono text-lg">{u?.successfulCalls ?? 'Unknown'}</dd></div>
          <div><dt>Unpaid 402 challenges</dt><dd className="font-mono text-lg">{u?.challenges ?? 'Unknown'}</dd></div>
          <div><dt>Declared operator calls</dt><dd className="font-mono">{u?.declaredOperatorCalls ?? 'Unknown'}</dd></div>
          <div><dt>Recorded unsuccessful calls</dt><dd className="font-mono">{u?.unsuccessfulCalls ?? 'Unknown'}</dd></div>
        </dl>
        <p className="evidence-card-copy mt-3 text-xs">{s?.attributionAmbiguous ? 'Settlement count unknown: the price is shared by more than one product.' : `${s?.settlements ?? 0} attributed transfers (${s?.externalSettlements ?? 0} external, ${(s?.settlements ?? 0) - (s?.externalSettlements ?? 0)} operator). Price matches are inference, not proof of an API call or delivery.`}</p>
        {!o.availability.payableInProduction && <p className="evidence-card-copy mt-3">{o.availability.blockedBy.join(' · ')}</p>}
        <a className="evidence-link mt-4 inline-block" href={`/api/docs/openapi#${encodeURIComponent(o.path)}`}>Inspect contract in OpenAPI ↗</a>
        {o.tags.includes('microproduct') && <a className="evidence-link mt-4 ml-4 inline-block" href={o.path}>Free example and contract ↗</a>}
        {o.tags.includes('licensed-sections') && <a className="evidence-link mt-4 ml-4 inline-block" href={o.path}>Section catalogue and edition digest ↗</a>}
        <p className="evidence-card-copy mt-3 text-xs">{o.retention.note}</p>
      </article>})}</div>
    </section>)}
    <section className="evidence-section"><h2 className="evidence-section-title">Payment and evidence boundaries</h2><p className="evidence-copy mt-4">Prices exclude any separate network or wallet fees. Physical AI outputs are declared-input simulations, not engineering approval. Finance checks exclude individual contributor information, political contributions, fundraising and legal compliance decisions. Neural metrics do not diagnose or control a headset. Signed payment, chain settlement and delivered results are separate checks.</p></section>
  </div></main>
}
