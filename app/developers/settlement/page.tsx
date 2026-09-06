import type { Metadata } from 'next'

import { MAHA_SITE_URL } from '@/lib/entity'
import type { SettlementLedger } from '@/lib/x402/settlement-ledger'
import ledger from '@/content/x402/settlement-ledger.json' with { type: 'json' }

const title = 'Autonomous Settlement & Verification Ledger | Maha Strategies'
const description =
  'A cumulative, on-chain record of x402 machine settlements into Maha on Base Mainnet. Every figure is derived from the ledger rows and independently verifiable on the block explorer.'

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: '/developers/settlement' },
  openGraph: { type: 'website', url: `${MAHA_SITE_URL}/developers/settlement`, title, description },
}

const record = ledger as unknown as SettlementLedger

/**
 * A cumulative ledger rather than a live ticker, deliberately.
 *
 * A ticker promises velocity. At roughly one settlement every three days it
 * would sit idle most of the time, and an idle ticker reads as a dead product.
 * An accumulating audit trail reads as a registry, which is what this is.
 *
 * Every number on the page comes from the snapshot's derived summary. None is
 * written into the markup, because a headline typed by hand becomes a claim the
 * moment the chain moves past it.
 */
export default function SettlementLedgerPage() {
  const s = record.summary
  const observed = new Date(record.observedAt)
  const cards: { label: string; value: string; note: string }[] = [
    { label: 'Settled protocol', value: record.protocol, note: record.network },
    { label: 'Verified settlements', value: `${s.totalSettlements}`, note: `${s.externalSettlements} external · ${s.canarySettlements} operator canary` },
    { label: 'External agent wallets', value: `${s.externalWallets}`, note: `${s.externalValueUsdc} USDC settled externally` },
    {
      label: 'Returning buyers',
      value: `${s.repeatExternalWallets}`,
      note: s.crossProductWallets > 0
        ? `${s.crossProductWallets} returned for a different product`
        : 'No cross-product repeat recorded',
    },
  ]

  return (
    <main className="mx-auto max-w-5xl px-6 py-16">
      <p className="evidence-kicker">Base Mainnet · HTTP 402 v2</p>
      <h1 className="evidence-section-title mt-3 text-3xl">Autonomous Settlement &amp; Verification Ledger</h1>
      <p className="mt-4 max-w-3xl text-[var(--text-secondary)]">
        Every settlement below is a USDC transfer into the Maha payee at a price this site publishes. The rows are
        the record; the figures above them are computed from the rows, so nothing here can be asserted without also
        being checkable.
      </p>
      <p className="mt-4 font-mono text-xs uppercase tracking-[0.22em] text-[var(--text-tertiary)]">
        Observed {observed.toISOString().slice(0, 16).replace('T', ' ')} UTC · blocks {record.scannedFromBlock}–{record.scannedToBlock}
      </p>

      <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <div key={card.label} className="evidence-card">
            <p className="evidence-kicker">{card.label}</p>
            <p className="mt-2 text-2xl font-semibold">{card.value}</p>
            <p className="mt-1 text-xs text-[var(--text-tertiary)]">{card.note}</p>
          </div>
        ))}
      </section>

      <section className="evidence-card mt-8">
        <h2 className="evidence-section-title text-xl">By product</h2>
        <table className="mt-4 w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border-default)] text-left font-mono text-xs uppercase tracking-[0.18em]">
              <th className="pb-2">Product</th><th className="pb-2">Price</th>
              <th className="pb-2">External</th><th className="pb-2">Total</th>
            </tr>
          </thead>
          <tbody>
            {s.byProduct.map((p) => (
              <tr key={p.id} className="border-b border-[var(--border-subtle)]">
                <td className="py-2">{p.title}</td>
                <td className="py-2 font-mono">{p.priceUsdc} USDC</td>
                <td className="py-2">{p.attributionAmbiguous ? 'unattributable' : p.externalSettlements}</td>
                <td className="py-2">{p.attributionAmbiguous ? '—' : p.settlements}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {s.byProduct.some((p) => p.attributionAmbiguous) ? (
          <p className="mt-3 text-xs text-[var(--text-tertiary)]">
            Two offers publish the same price, so a transfer cannot be attributed to one of them from chain data
            alone. Those rows are reported as unattributable rather than assigned.
          </p>
        ) : null}
      </section>

      <section className="evidence-card mt-8 overflow-x-auto">
        <h2 className="evidence-section-title text-xl">Settlements</h2>
        <table className="mt-4 w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border-default)] text-left font-mono text-xs uppercase tracking-[0.18em]">
              <th className="pb-2">Timestamp (UTC)</th><th className="pb-2">Service</th>
              <th className="pb-2">Payer agent</th><th className="pb-2">Amount</th><th className="pb-2">Proof</th>
            </tr>
          </thead>
          <tbody>
            {record.entries.filter((e) => e.product !== null || e.amountUsdc !== '0').map((entry) => (
              <tr key={entry.transactionHash} className="border-b border-[var(--border-subtle)]">
                <td className="py-2 font-mono text-xs">{entry.timestampUtc?.slice(0, 19).replace('T', ' ') ?? '—'}</td>
                <td className="py-2">{entry.product?.title ?? 'Unattributed amount'}</td>
                <td className="py-2">
                  <span className="font-mono text-xs">{entry.payerDisplay}</span>
                  <span className="ml-2 rounded px-2 py-0.5 text-[10px] uppercase tracking-wider border border-[var(--border-default)]">
                    {entry.payerRole === 'maha-canary-test' ? 'Maha canary test' : 'External machine agent'}
                  </span>
                </td>
                <td className="py-2 font-mono">{entry.amountUsdc} USDC</td>
                <td className="py-2">
                  <a href={entry.explorerUrl} rel="noreferrer noopener" target="_blank" className="underline">
                    Receipt ↗
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="evidence-card mt-8">
        <h2 className="evidence-section-title text-xl">What this establishes, and what it does not</h2>
        <ul className="mt-4 space-y-3 text-sm text-[var(--text-secondary)]">
          {record.boundaries.map((boundary) => <li key={boundary}>{boundary}</li>)}
        </ul>
      </section>
    </main>
  )
}
