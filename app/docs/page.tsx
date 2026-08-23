import type { Metadata } from 'next'
import Link from 'next/link'

import ApiDocs from './ApiDocs'

export const metadata: Metadata = {
  title: 'Maha API Reference | Governed AI Infrastructure',
  description: 'Machine-readable contracts for governed MCP access, bounded context compilation, evidence evaluation, authentication, credits, and idempotency.',
  alternates: { canonical: '/docs' },
}

export default function DocsPage() {
  return <main className="evidence-page">
    <section className="border-b border-[var(--border-default)] bg-[var(--surface-raised)] px-6 py-6" aria-labelledby="enterprise-mcp-docs">
      <div className="mx-auto flex max-w-[var(--measure-shell)] flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="evidence-kicker">Maha API reference</p>
          <h1 id="enterprise-mcp-docs" className="mt-2 font-editorial text-2xl font-medium tracking-tight text-[var(--text-primary)]">Governed MCP proxying is part of the public API.</h1>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-[var(--text-secondary)]">Register tenant-owned upstreams, discover tools, configure bounded controls, and dispatch JSON-RPC calls through one documented gateway.</p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-3 font-mono text-[10px] uppercase tracking-widest">
          <Link href="/developers" className="evidence-action evidence-action--primary">Developer hub ↗</Link>
          <Link href="/enterprise-mcp-gateway" className="evidence-action evidence-action--secondary">Gateway overview ↗</Link>
          <Link href="/guides/enterprise-mcp-governance" className="evidence-action evidence-action--secondary">Governance guide ↗</Link>
        </div>
      </div>
    </section>
    <ApiDocs />
  </main>
}
