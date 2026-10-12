import type { Metadata } from 'next'
import Link from 'next/link'
import { connection } from 'next/server'
import { categorizedProducts } from '@/lib/x402/product-categories'
import { X402_OFFERS, offerPriceUsd } from '@/lib/x402/offers'
import { productSummary } from '@/lib/x402/product-summaries'
import { readProductUsage, productUsageDisplay } from '@/lib/x402/product-usage'
import { bazaarServiceNameForOffer } from '@/lib/x402/bazaar-service-name'
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
  const indexed = X402_OFFERS.filter(o => index.resources.includes('https://www.mahastrategies.com' + o.path)).length
  const qualityKnown = Object.values(index.listings ?? {}).filter(row => row.calls30d !== null).length
  const namesPending = Object.values(index.listings ?? {}).filter(row => row.serviceName === null).length
  return <main className="evidence-page"><div className="evidence-container">
    <SettlementAutoRefresh />
    <header className="max-w-4xl">
      <p className="evidence-kicker">{snapshot.ledger.network} · native USDC · x402 v2</p>
      <h1 className="evidence-title">x402 products and prices</h1>
      <p className="evidence-lede mt-6">Choose a bounded service, inspect its contract, and confirm the exact payment terms before signing.</p>
      <p className="evidence-copy mt-4">{X402_OFFERS.length} declared products: {available} released and {X402_OFFERS.length - available} withheld or preview. Prices below are per request or bounded batch, not per input record. Withheld prices are proposals, not purchase invitations.</p>
      <p className="evidence-copy mt-4">Only a valid 402 challenge confirms that a released route is enabled for payment. Catalogue availability does not confirm Bazaar indexing. Never repay automatically after an uncertain outcome.</p>
      <p className="evidence-copy mt-4">Successful responses, Bazaar paid calls and attributed transfers are separate evidence. Do not add them together. Response meters are best-effort, can include retries, and do not prove unique buyers or complete historical coverage. The compiler uses its dedicated x402 response history, not a sum of overlapping meters. Operator labels are self-reported, not verified customer attribution.</p>
      <p className="evidence-copy mt-3">{usage.available ? `Usage meter: ${usage.firstObservedAt ? `${usage.firstObservedAt} through ${usage.lastObservedAt}` : 'no events recorded'}.` : 'Usage meter unavailable — call counts are unknown, not zero.'} Settlement snapshot: {snapshot.ledger.observedAt} ({snapshot.source === 'bundled_fallback' ? 'dated fallback' : snapshot.stale ? 'refresh overdue' : 'saved scan'}). Refreshes while visible every five minutes.</p>
      <p className="evidence-copy mt-3">Bazaar merchant lookup: {index.checkedAt}. {index.available ? `${indexed} declared product URLs observed${index.complete ? ' in a complete lookup' : ' in an incomplete lookup'}.` : 'Lookup unavailable; indexed count is unknown.'} Presence is observed catalogue membership, not proof of matching metadata, search rank, organic discovery or customer demand.</p>
      <p className="evidence-copy mt-3">{index.available ? `${qualityKnown} observed listings have 30-day call metrics; ${indexed - qualityKnown} have metrics pending or unavailable. ${namesPending} observed listings have a name not yet recorded by Bazaar.` : 'Bazaar activity metrics unavailable.'} Pending metrics are not zero activity. Bazaar metrics can include publisher-funded tests and update on a six-hour schedule. Corrected discovery names and task-specific tags are served now; cached listing metadata may require a later successful payment to update.</p>
      <div className="mt-6 flex flex-wrap gap-4"><Link className="evidence-link" href="/developers/settlement">Live settlement ledger ↗</Link><Link className="evidence-link" href="/api/docs/openapi">API schemas ↗</Link><Link className="evidence-link" href="/developers">Developer hub ↗</Link></div>
    </header>
    <nav aria-label="Product categories" className="my-8 flex flex-wrap gap-3">{categories.filter(c => c.offers.length).map(c => <a key={c.id} href={`#${c.id}`} className="evidence-link">{c.title} ({c.offers.length})</a>)}</nav>
    {categories.filter(c => c.offers.length).map(c => <section key={c.id} id={c.id} aria-labelledby={`${c.id}-title`} className="evidence-section scroll-mt-8">
      <h2 id={`${c.id}-title`} className="evidence-section-title">{c.title}</h2>
      <div className="mt-6 grid gap-4 md:grid-cols-2">{c.offers.map(o => {
        const u = usage.available ? usage.products[o.id] : null
        const display = productUsageDisplay(usage, o.id)
        const coverage = usage.available ? usage.coverage[o.id] : null
        const listing = index.listings?.['https://www.mahastrategies.com' + o.path]
        const s = settled.get(o.id)
        return <article key={o.id} id={o.id} data-offer-id={o.id} className="evidence-card scroll-mt-8">
        <div className="flex flex-wrap items-baseline justify-between gap-3"><h3 className="evidence-card-title">{o.serviceName ?? o.id}</h3><span className="font-mono text-lg">{offerPriceUsd(o).replace('$', '')} USDC</span></div>
        <p className="evidence-kicker mt-3">{o.status === 'available' ? 'Released contract' : o.status === 'preview' ? 'Preview — not payable' : 'Withheld — not payable'}</p>
        <p className="evidence-card-copy mt-2 text-xs">{productIndexLabel(index, o.path)}</p>
        <p className="evidence-card-copy mt-2 text-xs">Discovery name served: {bazaarServiceNameForOffer(o)}{listing && listing.serviceName !== bazaarServiceNameForOffer(o) ? ' · Bazaar name update pending' : ''}</p>
        <p className="evidence-card-copy mt-3">{productSummary(o)}</p>
        <details className="mt-3">
          <summary className="evidence-link cursor-pointer">Details and limitations</summary>
          <p className="evidence-card-copy mt-3">{o.description}</p>
          <ul className="evidence-card-copy mt-3 list-disc space-y-2 pl-5">{o.capabilityBoundaries.map(boundary => <li key={boundary}>{boundary}</li>)}</ul>
        </details>
        <p className="mt-4 break-all font-mono text-xs">{o.method} {o.path}</p>
        <p className="mt-2 font-mono text-xs">Exact amount: {o.amount} USDC base units</p>
        <dl className="mt-4 grid grid-cols-2 gap-3 text-sm" aria-label={`Usage for ${o.serviceName ?? o.id}`}>
          <div><dt>Successful responses recorded</dt><dd className="font-mono text-lg">{display.successful}</dd></div>
          <div><dt>Bazaar paid calls (30 days)</dt><dd className="font-mono text-lg">{listing?.calls30d ?? (listing ? 'Pending' : 'Unknown')}</dd></div>
          <div><dt>Bazaar paying wallets (30 days)</dt><dd className="font-mono">{listing?.payers30d ?? (listing ? 'Pending' : 'Unknown')}</dd></div>
          <div><dt>Unpaid 402 challenges</dt><dd className="font-mono text-lg">{u?.challenges ?? 'Unknown'}</dd></div>
          <div><dt>Declared operator responses</dt><dd className="font-mono">{display.operator}</dd></div>
          <div><dt>Unsuccessful responses recorded</dt><dd className="font-mono">{display.unsuccessful}</dd></div>
        </dl>
        <p className="evidence-card-copy mt-3 text-xs">{coverage?.firstInvocationAt ? `Response records: ${coverage.firstInvocationAt} through ${coverage.lastInvocationAt}.` : 'No response records available for this product; this is not proof of no prior calls.'} {coverage?.invocationSource === 'compiler_meter' ? 'Dedicated compiler history; operator responses were not classified in this meter.' : 'General offer response meter.'} {listing?.lastCalledAt ? `Last Bazaar payment: ${listing.lastCalledAt}.` : 'Last Bazaar payment timestamp unavailable.'}</p>
        <p className="evidence-card-copy mt-3 text-xs">{!s ? 'Attributed transfer count unknown: product absent from this snapshot.' : s.attributionAmbiguous ? 'Settlement count unknown: the price is shared by more than one product.' : `${s.settlements} attributed transfers (${s.externalSettlements} external, ${s.settlements - s.externalSettlements} operator). Price matches are inference, not proof of an API call or delivery.`}</p>
        {!o.availability.payableInProduction && <p className="evidence-card-copy mt-3">{o.availability.blockedBy.join(' · ')}</p>}
        <a className="evidence-link mt-4 inline-block" href={`/api/docs/openapi#${encodeURIComponent(o.path)}`}>Inspect contract in OpenAPI ↗</a>
        {(o.tags.includes('microproduct') || o.tags.includes('demand-20261012')) && <a className="evidence-link mt-4 ml-4 inline-block" href={o.path}>Free example and contract ↗</a>}
        {o.tags.includes('licensed-sections') && <a className="evidence-link mt-4 ml-4 inline-block" href={o.path}>Section catalogue and edition digest ↗</a>}
        <p className="evidence-card-copy mt-3 text-xs">{o.retention.note}</p>
      </article>})}</div>
    </section>)}
    <section className="evidence-section"><h2 className="evidence-section-title">Payment and evidence boundaries</h2><p className="evidence-copy mt-4">Prices exclude any separate network or wallet fees. Physical AI outputs are declared-input simulations, not engineering approval. Finance checks exclude individual contributor information, political contributions, fundraising and legal compliance decisions. Neural metrics do not diagnose or control a headset. Signed payment, chain settlement and delivered results are separate checks.</p></section>
  </div></main>
}
