import type { Metadata } from 'next'
import Link from 'next/link'
import BookAccessCheckout from './BookAccessCheckout'

export const metadata: Metadata = {
  title: 'Book MCP Access | Maha Strategies',
  description: 'Machine-readable, entitlement-gated access to Maha Strategies open web books through the local MCP bridge.',
  alternates: { canonical: '/books/mcp-access' },
}

const terms = [
  ['Free web edition', 'Each book remains free to read in its public web edition. Buying MCP access does not lock or remove the public text.'],
  ['What the entitlement adds', 'A credential-gated, heading-addressable structured content API for local use through the Maha MCP bridge. This lets an MCP client retrieve named chunks rather than scrape rendered HTML.'],
  ['Purchase boundary', 'A valid client credential and human approval are required to open a Stripe Checkout session. The current price appears in Stripe Checkout before payment is authorized.'],
  ['After payment', 'Stripe’s signed webhook mints the book entitlement. The bridge reads the structured content only after it verifies that entitlement.'],
  ['Refunds and disputes', 'A partial refund preserves access. Access is revoked only after refunds cumulatively reverse the full payment, or Stripe closes a dispute as lost.'],
]

export default async function BookMcpAccessPage({ searchParams }: { searchParams: Promise<{ purchase?: string | string[] }> }) {
  const { purchase } = await searchParams
  return <main className="evidence-page">
    <div className="evidence-container evidence-container--narrow">
      <Link href="/books" className="font-mono text-[11px] uppercase tracking-widest text-[var(--text-muted)] hover:text-[var(--text-primary)]">← Books & essays</Link>
      <p className="mt-12 font-mono text-[10px] uppercase tracking-widest text-[var(--status-verified)]">[ Book as an endpoint ]</p>
      <h1 className="mt-5 text-4xl font-light leading-tight tracking-tight text-[var(--text-primary)] sm:text-6xl">The web edition is free. The endpoint is for your tools.</h1>
      <p className="mt-7 max-w-2xl text-lg leading-relaxed text-[var(--text-secondary)]">Maha Strategies books can be read freely on the web. The separate entitlement is for structured, machine-readable access through a local MCP bridge—useful when an authorized agent needs exact, heading-addressable passages in its working context.</p>
      <dl className="mt-12 divide-y divide-zinc-800 border-y border-[var(--border-default)]">
        {terms.map(([term, explanation]) => <div key={term} className="grid gap-2 py-6 sm:grid-cols-[11rem_1fr]">
          <dt className="font-mono text-[10px] uppercase tracking-widest text-[var(--text-muted)]">{term}</dt>
          <dd className="text-sm leading-relaxed text-[var(--text-secondary)]">{explanation}</dd>
        </div>)}
      </dl>
      <div className="mt-10 border border-emerald-900/60 bg-[var(--surface-verified)] p-6 text-sm leading-relaxed text-[var(--text-secondary)]">
        <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--status-verified)]">[ Local bridge ]</p>
        <p className="mt-3">Install <code>@mahastrategies/maha-mcp-bridge</code>, authenticate with your own credential, then use the documented book entitlement and content endpoints. The bridge never receives a merchant secret or authority to make a charge.</p>
        <Link href="/docs" className="mt-5 inline-block font-mono text-xs uppercase tracking-widest text-[var(--status-verified)] underline underline-offset-4 hover:text-[var(--text-primary)]">Read the API reference ↗</Link>
      </div>
      <BookAccessCheckout purchaseState={typeof purchase === 'string' ? purchase : undefined} />
    </div>
  </main>
}
