import type { Metadata } from 'next'
import Link from 'next/link'

import ApiDocs from './ApiDocs'

export const metadata: Metadata = {
  title: 'MPS API Reference | Maha Strategies',
  description: 'Claim-level provenance audits over an authenticated, prepaid API. Authentication, credits, idempotency, and full endpoint reference.',
  alternates: { canonical: '/docs' },
}

export default function DocsPage() {
  return <main className="min-h-screen bg-[#0a0a0c] text-zinc-200">
    <section className="border-b border-cyan-950 bg-cyan-950/15 px-6 py-6" aria-labelledby="enterprise-mcp-docs">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-widest text-cyan-300">Enterprise MCP Gateway</p>
          <h1 id="enterprise-mcp-docs" className="mt-2 text-xl text-white">Governed MCP proxying is part of the public API.</h1>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-zinc-400">Register tenant-owned upstreams, discover tools, configure SLA controls, and dispatch JSON-RPC calls through one documented gateway.</p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-3 font-mono text-[10px] uppercase tracking-widest">
          <Link href="/enterprise-mcp-gateway" className="border border-cyan-700 px-4 py-2 text-cyan-100 hover:bg-cyan-950/50">Gateway overview ↗</Link>
          <Link href="/guides/enterprise-mcp-governance" className="border border-zinc-700 px-4 py-2 text-zinc-300 hover:border-cyan-600">Governance guide ↗</Link>
        </div>
      </div>
    </section>
    <ApiDocs />
  </main>
}
