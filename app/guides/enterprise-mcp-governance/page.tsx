import type { Metadata } from 'next'
import Link from 'next/link'

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
    datePublished: '2026-08-06', dateModified: '2026-08-06', isAccessibleForFree: true,
    author: { '@id': `${SITE_URL}/about#mayone-maha-rajan` }, publisher: { '@id': `${SITE_URL}/#organization` },
    about: ['Model Context Protocol', 'AI agent governance', 'Tool allowlists', 'Audit logging'],
  }
  return <main className="min-h-screen bg-[#0a0a0c] px-6 py-20 text-zinc-300 sm:py-28">
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd).replace(/</g, '\\u003c') }} />
    <article className="mx-auto max-w-4xl">
      <nav><Link href="/enterprise-mcp-gateway" className="font-mono text-[10px] uppercase tracking-widest text-cyan-200 hover:text-white">← Enterprise MCP Gateway</Link></nav>
      <header className="mt-8 border-b border-zinc-800 pb-12">
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-cyan-300">[ Practical architecture guide ]</p>
        <h1 className="mt-5 text-4xl font-light leading-tight text-white sm:text-6xl">How to govern enterprise MCP servers with tool allowlists and audit logs.</h1>
        <p className="mt-7 max-w-3xl text-xl leading-relaxed text-zinc-400">An MCP gateway should make agent access narrower, observable, and revocable. It should not become a universal secret relay or a second uncontrolled copy of the data passing through it.</p>
        <p className="mt-5 font-mono text-[10px] uppercase tracking-widest text-zinc-600">Published August 6, 2026 · Maha Strategies LLC</p>
      </header>

      <section className="mt-12 border border-cyan-900/50 bg-cyan-950/10 p-7 sm:p-9">
        <h2 className="text-2xl text-white">The short answer</h2>
        <p className="mt-4 leading-relaxed text-zinc-300">Place a tenant-aware policy gateway between agent clients and approved MCP servers. Resolve the upstream from a server registry, authenticate both sides independently, enforce method and tool allowlists before network dispatch, contain upstream failures, and retain only the metadata needed to investigate access and availability.</p>
      </section>

      <section className="mt-14">
        <h2 className="text-3xl font-light text-white">The five controls that matter</h2>
        <ol className="mt-7 space-y-5">{controls.map(([name, copy], index) => <li key={name} className="border-l border-zinc-700 pl-5"><p className="font-mono text-[10px] uppercase tracking-widest text-cyan-300">{String(index + 1).padStart(2, '0')} · {name}</p><p className="mt-2 leading-relaxed text-zinc-400">{copy}</p></li>)}</ol>
      </section>

      <section className="mt-14 border border-zinc-800 p-7 sm:p-9">
        <h2 className="text-2xl text-white">A defensible request path</h2>
        <ol className="mt-6 list-decimal space-y-3 pl-5 text-sm leading-relaxed text-zinc-400">
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

      <section className="mt-14">
        <h2 className="text-3xl font-light text-white">What not to log</h2>
        <p className="mt-5 leading-relaxed text-zinc-400">Tool arguments can contain source documents, customer identifiers, credentials, and regulated data. Full response bodies can be equally sensitive. A default gateway event should therefore identify the tenant, server, credential, MCP method, tool name, outcome, latency, upstream status, and a one-way request hash—not the request body itself.</p>
        <p className="mt-4 leading-relaxed text-zinc-400">Teams that need payload inspection should define it as a separate, explicit data-processing mode with its own retention policy, access controls, and customer approval.</p>
      </section>

      <section className="mt-14 border border-amber-900/50 bg-amber-950/10 p-7 sm:p-9">
        <h2 className="text-2xl text-white">The deployment boundary</h2>
        <p className="mt-4 leading-relaxed text-zinc-400">Application-level SSRF checks are necessary but insufficient for the highest-assurance environments. Combine hostname validation with controlled egress, private connectivity where required, key rotation, incident response, and a tested method for disabling one server without disabling the whole tenant.</p>
      </section>

      <footer className="mt-16 border-t border-zinc-800 pt-8">
        <p className="max-w-3xl text-sm leading-relaxed text-zinc-500">Maha’s implementation exposes the same core controls through its <Link href="/enterprise-mcp-gateway" className="text-cyan-100 underline underline-offset-4">Enterprise MCP Gateway</Link>. Integration teams can inspect the <a href="/mcp-gateway-contract.json" className="text-cyan-100 underline underline-offset-4">machine-readable contract</a> and the <Link href="/docs" className="text-cyan-100 underline underline-offset-4">API reference</Link>.</p>
      </footer>
    </article>
  </main>
}
