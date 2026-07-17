import type { Metadata } from 'next'
import Link from 'next/link'

import AuditAccessCheckout from './AuditAccessCheckout'

export const metadata: Metadata = {
  title: 'Purchase MPS Audit API Access | Maha Strategies',
  description: 'Purchase prepaid, self-service access to the MPS claim-level audit API.',
  alternates: { canonical: '/mps/audit-access' },
}

export default async function AuditAccessPage({ searchParams }: { searchParams: Promise<{ purchase?: string | string[] }> }) {
  const { purchase } = await searchParams
  return <main className="min-h-screen bg-[#0a0a0c] px-6 py-20 text-zinc-300 sm:py-28">
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
      <AuditAccessCheckout purchaseState={typeof purchase === 'string' ? purchase : undefined} />
    </div>
  </main>
}
