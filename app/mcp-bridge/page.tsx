import type { Metadata } from 'next'
import Link from 'next/link'

import { mcpBridgeManifest } from '@/lib/mcp-bridge'

export const metadata: Metadata = {
  title: 'Maha MCP Bridge | Local, Approval-Bound API Access',
  description: 'A local stdio bridge for documented, authenticated Maha APIs. Credentials remain local and checkout stays human-approved.',
  alternates: { canonical: '/mcp-bridge' },
}

const boundaries = [
  ['Local transport', 'The bridge runs as a local stdio process. It is not the hosted Enterprise MCP Gateway or a general-purpose remote proxy.'],
  ['Scoped access', 'A credential can access only the documented MPS audit and book entitlement/content APIs allowed by its active scope.'],
  ['No payment authority', 'The bridge does not receive a merchant secret, sign a payment, or autonomously complete checkout.'],
] as const

export default function McpBridgePage() {
  return (
    <main className="evidence-page">
      <div className="evidence-container evidence-container--narrow">
        <header className="border-t border-[var(--border-default)] pt-5">
          <p className="evidence-kicker flex flex-wrap justify-between gap-3"><span>Local MCP Bridge</span><span>Stdio · approval-bound · scoped APIs</span></p>
          <h1 className="evidence-title evidence-title--product">Put a narrow, inspectable bridge between a local agent and a paid API.</h1>
          <p className="evidence-lede mt-7">Version {mcpBridgeManifest.bridge.version} gives an MCP client a local path to authenticated Maha MPS audit and book-access APIs—without turning the client into an unbounded payment or infrastructure operator.</p>
          <div className="mt-9 flex flex-wrap gap-3">
            <Link href="/api/docs/openapi" className="evidence-action evidence-action--primary">Read the API contract ↗</Link>
            <a href="/api/mcp-bridge/manifest" className="evidence-action evidence-action--secondary">Read bridge manifest ↗</a>
          </div>
        </header>

        <section className="evidence-section" aria-labelledby="install-heading">
          <p className="evidence-kicker">Install command</p>
          <h2 id="install-heading" className="evidence-section-title mt-4">A local process, not a hidden service dependency.</h2>
          <pre className="evidence-code mt-7 overflow-x-auto p-5 text-sm leading-7"><code>{mcpBridgeManifest.bridge.install}</code></pre>
          <p className="evidence-copy mt-5 text-sm">Configure the credential in your local MCP client according to the published manifest. Do not put a credential in a prompt, a public repository, or an agent instruction.</p>
        </section>

        <section className="evidence-section" aria-labelledby="control-heading">
          <p className="evidence-kicker">Control boundary</p>
          <h2 id="control-heading" className="evidence-section-title mt-4">Useful access without delegated authority.</h2>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {boundaries.map(([title, body]) => (
              <article key={title} className="evidence-card">
                <h3 className="evidence-card-title">{title}</h3>
                <p className="evidence-card-copy mt-3">{body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="evidence-section evidence-inset" aria-labelledby="separate-service-heading">
          <p className="evidence-kicker text-[var(--status-boundary)]">Separate service</p>
          <h2 id="separate-service-heading" className="evidence-section-title mt-4 text-2xl">The bridge is not the Cognitive Gateway.</h2>
          <p className="evidence-copy mt-4 text-sm">The hosted Cognitive Gateway serves Maha OS, publishing, and research workflows. Its token and tools are separate from this local bridge. If you need a governed path to tenant-owned MCP servers, use the Enterprise MCP Gateway instead.</p>
          <div className="mt-6 flex flex-wrap gap-4 font-mono text-xs uppercase tracking-widest">
            <Link className="evidence-link" href="/enterprise-mcp-gateway">Enterprise MCP Gateway ↗</Link>
            <Link className="evidence-link" href="/research/mcp">Cognitive Gateway documentation ↗</Link>
          </div>
        </section>
      </div>
    </main>
  )
}
