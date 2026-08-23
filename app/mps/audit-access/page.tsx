import type { Metadata } from 'next'
import Link from 'next/link'

import AuditAccessCheckout from './AuditAccessCheckout'
import { mpsAuditServiceJsonLd } from '@/lib/agentic-commerce'
import { creditPackAvailable } from '@/lib/mps-credits'

export const metadata: Metadata = {
  title: 'Purchase MPS Audit API Access | Maha Strategies',
  description: 'Purchase prepaid, self-service access to the MPS claim-level audit API.',
  alternates: { canonical: '/mps/audit-access' },
}

export default async function AuditAccessPage({ searchParams }: { searchParams: Promise<{ purchase?: string | string[] }> }) {
  const { purchase } = await searchParams
  const available = creditPackAvailable()
  return <main className="evidence-page">
    {/* Structured data advertises a purchasable service to agents and search
        engines. Do not publish an offer that cannot currently be accepted. */}
    {available && <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(mpsAuditServiceJsonLd).replace(/</g, '\\u003c') }}
    />}
    <div className="evidence-container evidence-container--narrow">
      <header className="border-t border-[var(--border-default)] pt-5">
        <p className="evidence-kicker">MPS/0.1 · prepaid API access</p>
        <h1 className="evidence-title evidence-title--product">Claim-level audits, when your workflow needs them.</h1>
        <p className="evidence-lede mt-7">Purchase a fixed pack of audit invocations and receive a credential scoped only to the MPS audit endpoint.</p>
        <p className="evidence-copy mt-5">No subscription and no access to internal services.</p>
        <Link href="/mps" className="evidence-link mt-7 inline-block font-mono text-xs uppercase tracking-widest">← Maha Provenance Standard</Link>
      </header>

      <section className="evidence-section">
        <div className="grid gap-4 sm:grid-cols-3">
          <article className="evidence-card"><p className="evidence-kicker">Scope</p><p className="evidence-card-copy mt-3">MPS audit API only</p></article>
          <article className="evidence-card"><p className="evidence-kicker">Billing</p><p className="evidence-card-copy mt-3">Prepaid credits</p></article>
          <article className="evidence-card"><p className="evidence-kicker">Failures</p><p className="evidence-card-copy mt-3">Credit returned automatically</p></article>
        </div>
        <p className="evidence-kicker mt-7">Machine-readable terms: <a className="evidence-link normal-case tracking-normal" href="/agent-offers.json">commercial manifest</a> · <a className="evidence-link normal-case tracking-normal" href="/llm-context/agentic-commerce.md">agent context</a> · <a className="evidence-link normal-case tracking-normal" href="/api/docs/openapi">OpenAPI</a></p>
      </section>

      <section className="evidence-section">
        {available
          ? <AuditAccessCheckout purchaseState={typeof purchase === 'string' ? purchase : undefined} />
          : <div className="evidence-inset">
              <p className="evidence-kicker text-[var(--status-boundary)]">Purchasing temporarily closed</p>
              <p className="evidence-copy mt-4">Prepaid audit access is not open for purchase right now. Nothing has been charged and no credential has been issued.</p>
              <p className="evidence-copy mt-4">The free bounded preflight at <Link href="/audit" className="evidence-link">/audit</Link> remains available, and <Link href="/contact" className="evidence-link">contact</Link> reaches a human who can arrange access directly.</p>
            </div>}
      </section>
    </div>
  </main>
}
