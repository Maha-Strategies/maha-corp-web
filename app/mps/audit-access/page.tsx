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
  return <main className="min-h-screen bg-[#0a0a0c] px-6 py-20 text-zinc-300 sm:py-28">
    {/* Structured data advertises a purchasable service to agents and search
        engines. Do not publish an offer that cannot currently be accepted. */}
    {available && <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(mpsAuditServiceJsonLd).replace(/</g, '\\u003c') }}
    />}
    <div className="mx-auto max-w-3xl">
      <Link href="/mps" className="font-mono text-[11px] uppercase tracking-widest text-zinc-500 hover:text-white">← Maha Provenance Standard</Link>
      <p className="mt-12 font-mono text-[10px] uppercase tracking-widest text-indigo-300">[ MPS/0.1 · prepaid API access ]</p>
      <h1 className="mt-5 text-4xl font-light leading-tight tracking-tight text-white sm:text-6xl">Claim-level audits, when your workflow needs them.</h1>
      <p className="mt-7 max-w-2xl text-lg leading-relaxed text-zinc-400">Purchase a fixed pack of audit invocations and receive a credential scoped only to the MPS audit endpoint. No subscription and no access to internal services.</p>
      <div className="mt-9 grid gap-4 border-y border-zinc-800 py-7 text-sm leading-relaxed sm:grid-cols-3">
        <p><span className="block font-mono text-[10px] uppercase tracking-widest text-zinc-500">Scope</span>MPS audit API only</p>
        <p><span className="block font-mono text-[10px] uppercase tracking-widest text-zinc-500">Billing</span>Prepaid credits</p>
        <p><span className="block font-mono text-[10px] uppercase tracking-widest text-zinc-500">Failures</span>Credit returned automatically</p>
      </div>
      <p className="mt-5 text-xs leading-relaxed text-zinc-500">Machine-readable terms: <a className="text-zinc-300 underline underline-offset-4 hover:text-white" href="/agent-offers.json">commercial manifest</a> · <a className="text-zinc-300 underline underline-offset-4 hover:text-white" href="/llm-context/agentic-commerce.md">agent context</a> · <a className="text-zinc-300 underline underline-offset-4 hover:text-white" href="/api/docs/openapi">OpenAPI</a></p>
      {available
        ? <AuditAccessCheckout purchaseState={typeof purchase === 'string' ? purchase : undefined} />
        : <div className="mt-10 border border-zinc-800 bg-zinc-950/60 p-6">
            <p className="font-mono text-[10px] uppercase tracking-widest text-amber-300">[ purchasing temporarily closed ]</p>
            <p className="mt-4 text-sm leading-relaxed text-zinc-400">Prepaid audit access is not open for purchase right now. Nothing has been charged and no credential has been issued.</p>
            <p className="mt-4 text-sm leading-relaxed text-zinc-400">The free bounded preflight at <Link href="/audit" className="text-zinc-200 underline underline-offset-4 hover:text-white">/audit</Link> remains available, and <Link href="/contact" className="text-zinc-200 underline underline-offset-4 hover:text-white">contact</Link> reaches a human who can arrange access directly.</p>
          </div>}
    </div>
  </main>
}
