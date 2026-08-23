import type { Metadata } from 'next'
import Link from 'next/link'
import { CodeBlock } from '@/app/guides/_components/EvidenceGuide'

const SITE_URL = 'https://www.mahastrategies.com'
const PAGE_URL = `${SITE_URL}/guides/enterprise-mcp-governance`
const title = 'How to Govern Enterprise MCP Servers with Tool Allowlists and Audit Logs'
const description = 'A practical architecture for inventorying MCP servers, limiting methods and tools, containing failures, and retaining useful audit evidence without logging sensitive tool arguments.'

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: '/guides/enterprise-mcp-governance' },
  openGraph: { type: 'article', url: PAGE_URL, title, description, publishedTime: '2026-08-06T00:00:00.000Z', images: [{ url: '/og-master.png', width: 1200, height: 630, alt: 'Enterprise MCP governance architecture' }] },
  twitter: { card: 'summary_large_image', title, description, images: ['/og-master.png'] },
}

const controls = [
  ['Inventory', 'Give every approved upstream a tenant-owned server ID. Never let callers supply an arbitrary destination URL at request time.'],
  ['Authentication', 'Bind the caller credential and server record to the same tenant. Keep upstream credentials encrypted and outside responses, logs, and discovery documents.'],
  ['Policy', 'Allow MCP methods explicitly. For tools/call, require the tool name to appear on a per-server allowlist before forwarding anything upstream.'],
  ['Containment', 'Bound body size, response size, duration, redirects, and request rate. Open a circuit when repeated transport failures indicate an unhealthy upstream.'],
  ['Evidence', 'Record server ID, method, tool name, outcome, latency, and cryptographic request hash. Avoid retaining arguments or upstream response bodies by default.'],
] as const

export default function EnterpriseMcpGovernanceGuide() {
  const articleJsonLd = {
    '@context': 'https://schema.org', '@type': 'TechArticle', '@id': `${PAGE_URL}#article`,
    headline: title, description, url: PAGE_URL, mainEntityOfPage: PAGE_URL,
    datePublished: '2026-08-06', dateModified: '2026-08-08', isAccessibleForFree: true,
    author: { '@id': `${SITE_URL}/about#mayone-maha-rajan` }, publisher: { '@id': `${SITE_URL}/#organization` },
    about: ['Model Context Protocol', 'AI agent governance', 'Tool allowlists', 'Audit logging'],
  }
  return <main className="evidence-page">
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd).replace(/</g, '\\u003c') }} />
    <div className="evidence-container evidence-container--narrow">
    <article>
      <nav><Link href="/enterprise-mcp-gateway" className="evidence-kicker evidence-link">← Enterprise MCP Gateway</Link></nav>
      <header className="mt-8 border-t border-[var(--border-default)] pt-5">
        <p className="evidence-kicker">Practical architecture guide</p>
        <h1 className="evidence-title evidence-title--product">How to govern enterprise MCP servers with tool allowlists and audit logs.</h1>
        <p className="evidence-lede mt-7">An MCP gateway should make agent access narrower, observable, and revocable. It should not become a universal secret relay or a second uncontrolled copy of the data passing through it.</p>
        <p className="evidence-kicker mt-7 border-t border-[var(--border-subtle)] pt-5">Published August 6, 2026 · Maha Strategies LLC</p>
      </header>

      <section className="evidence-section evidence-inset">
        <h2 className="evidence-card-title">The short answer</h2>
        <p className="mt-4 leading-relaxed text-[var(--text-secondary)]">Place a tenant-aware policy gateway between agent clients and approved MCP servers. Resolve the upstream from a server registry, authenticate both sides independently, enforce method and tool allowlists before network dispatch, contain upstream failures, and retain only the metadata needed to investigate access and availability.</p>
      </section>

      <section className="evidence-section">
        <h2 className="evidence-section-title">The five controls that matter</h2>
        <ol className="mt-7 space-y-5">{controls.map(([name, copy], index) => <li key={name} className="border-l border-[var(--border-default)] pl-5"><p className="font-mono text-[10px] uppercase tracking-widest text-[var(--text-muted)]">{String(index + 1).padStart(2, '0')} · {name}</p><p className="mt-2 leading-relaxed text-[var(--text-secondary)]">{copy}</p></li>)}</ol>
      </section>

      <section className="evidence-section border border-[var(--border-default)] p-7 sm:p-9">
        <h2 className="evidence-card-title">A defensible request path</h2>
        <ol className="mt-6 list-decimal space-y-3 pl-5 text-sm leading-relaxed text-[var(--text-secondary)]">
          <li>Authenticate the agent credential and resolve its tenant.</li>
          <li>Load the server record using both tenant ID and server ID.</li>
          <li>Validate the JSON-RPC envelope and bounded request size.</li>
          <li>Reject methods and tool names outside the approved policy.</li>
          <li>Consume the tenant rate limit and check the server circuit state.</li>
          <li>Resolve the upstream hostname again and reject non-public destinations.</li>
          <li>Inject only the upstream credential configured for that server.</li>
          <li>Forward with strict timeout, redirect, and response-size limits.</li>
          <li>Record the metadata-only outcome and update circuit health.</li>
        </ol>
      </section>

      <section className="evidence-section">
        <h2 className="evidence-section-title">Apply an explicit tool policy</h2>
        <p className="mt-5 leading-relaxed text-[var(--text-secondary)]">Run bounded <code>tools/list</code> discovery first, then approve a subset by exact name. Discovery describes what exists; it does not grant permission.</p>
        <CodeBlock>{`const discovered = await maha.mcp.discoverTools(serverId)
const approved = discovered.discovery.tools
  .filter(tool => ["calculateRiskScore", "readPolicy"].includes(tool.name))
  .map(tool => tool.name)

await maha.mcp.updateServerPolicy(serverId, {
  allowedMethods: ["initialize", "ping", "tools/list", "tools/call"],
  allowedToolNames: approved,
})`}</CodeBlock>
      </section>

      <section className="evidence-section">
        <h2 className="evidence-section-title">MCP audit logging for AI agents: what not to retain</h2>
        <p className="mt-5 leading-relaxed text-[var(--text-secondary)]">Tool arguments can contain source documents, customer identifiers, credentials, and regulated data. Full response bodies can be equally sensitive. A default gateway event should therefore identify the tenant, server, credential, MCP method, tool name, outcome, latency, upstream status, and a one-way request hash—not the request body itself.</p>
        <p className="mt-4 leading-relaxed text-[var(--text-secondary)]">Teams that need payload inspection should define it as a separate, explicit data-processing mode with its own retention policy, access controls, and customer approval.</p>
      </section>

      <section className="evidence-section evidence-inset" style={{ borderLeftColor: 'var(--status-boundary)' }}>
        <h2 className="evidence-card-title">The deployment boundary</h2>
        <p className="mt-4 leading-relaxed text-[var(--text-secondary)]">Application-level SSRF checks are necessary but insufficient for the highest-assurance environments. Combine hostname validation with controlled egress, private connectivity where required, key rotation, incident response, and a tested method for disabling one server without disabling the whole tenant.</p>
      </section>

      <footer className="mt-16 border-t border-[var(--border-default)] pt-8">
        <p className="max-w-3xl text-sm leading-relaxed text-[var(--text-muted)]">Maha’s implementation exposes the same core controls through its <Link href="/enterprise-mcp-gateway" className="text-[var(--text-primary)] underline underline-offset-4">Enterprise MCP Gateway</Link>. Compare it with <Link href="/guides/mcp-gateway-vs-direct-server" className="text-[var(--text-primary)] underline underline-offset-4">direct MCP server connections</Link>, inspect the <a href="/mcp-gateway-contract.json" className="text-[var(--text-primary)] underline underline-offset-4">machine-readable contract</a>, or open the <Link href="/docs" className="text-[var(--text-primary)] underline underline-offset-4">API reference</Link>.</p>
      </footer>
    </article>
    </div>
  </main>
}
