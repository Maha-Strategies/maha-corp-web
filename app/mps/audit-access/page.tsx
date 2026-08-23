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
      <Link href="/mps" className="font-mono text-[11px] uppercase tracking-widest text-[var(--text-muted)] hover:text-[var(--text-primary)]">← Maha Provenance Standard</Link>
      <p className="mt-12 font-mono text-[10px] uppercase tracking-widest text-[var(--text-muted)]">[ MPS/0.1 · prepaid API access ]</p>
      <h1 className="mt-5 text-4xl font-light leading-tight tracking-tight text-[var(--text-primary)] sm:text-6xl">Claim-level audits, when your workflow needs them.</h1>
      <p className="mt-7 max-w-2xl text-lg leading-relaxed text-[var(--text-secondary)]">Purchase a fixed pack of audit invocations and receive a credential scoped only to the MPS audit endpoint. No subscription and no access to internal services.</p>
      <div className="mt-9 grid gap-4 border-y border-[var(--border-default)] py-7 text-sm leading-relaxed sm:grid-cols-3">
        <p><span className="block font-mono text-[10px] uppercase tracking-widest text-[var(--text-muted)]">Scope</span>MPS audit API only</p>
        <p><span className="block font-mono text-[10px] uppercase tracking-widest text-[var(--text-muted)]">Billing</span>Prepaid credits</p>
        <p><span className="block font-mono text-[10px] uppercase tracking-widest text-[var(--text-muted)]">Failures</span>Credit returned automatically</p>
      </div>
      <p className="mt-5 text-xs leading-relaxed text-[var(--text-muted)]">Machine-readable terms: <a className="text-[var(--text-secondary)] underline underline-offset-4 hover:text-[var(--text-primary)]" href="/agent-offers.json">commercial manifest</a> · <a className="text-[var(--text-secondary)] underline underline-offset-4 hover:text-[var(--text-primary)]" href="/llm-context/agentic-commerce.md">agent context</a> · <a className="text-[var(--text-secondary)] underline underline-offset-4 hover:text-[var(--text-primary)]" href="/api/docs/openapi">OpenAPI</a></p>
      {available
        ? <AuditAccessCheckout purchaseState={typeof purchase === 'string' ? purchase : undefined} />
        : <div className="mt-10 border border-[var(--border-default)] bg-[var(--surface-raised)]/60 p-6">
            <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--status-boundary)]">[ purchasing temporarily closed ]</p>
            <p className="mt-4 text-sm leading-relaxed text-[var(--text-secondary)]">Prepaid audit access is not open for purchase right now. Nothing has been charged and no credential has been issued.</p>
            <p className="mt-4 text-sm leading-relaxed text-[var(--text-secondary)]">The free bounded preflight at <Link href="/audit" className="text-[var(--text-secondary)] underline underline-offset-4 hover:text-[var(--text-primary)]">/audit</Link> remains available, and <Link href="/contact" className="text-[var(--text-secondary)] underline underline-offset-4 hover:text-[var(--text-primary)]">contact</Link> reaches a human who can arrange access directly.</p>
          </div>}
    </div>
  </main>
}
