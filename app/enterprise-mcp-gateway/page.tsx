import type { Metadata } from 'next'
import Link from 'next/link'

const SITE_URL = 'https://www.mahastrategies.com'
const title = 'Enterprise MCP Gateway | Tool Allowlists and Audit Controls'
const description = 'Govern enterprise MCP servers with tenant isolation, explicit method and tool allowlists, bounded execution, and metadata-only audit records.'

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: '/enterprise-mcp-gateway' },
  openGraph: {
    type: 'website', url: `${SITE_URL}/enterprise-mcp-gateway`, siteName: 'Maha Strategies', title, description,
    images: [{ url: '/og-master.png', width: 1200, height: 630, alt: 'Maha Strategies Enterprise MCP Gateway' }],
  },
  twitter: { card: 'summary_large_image', title, description, images: ['/og-master.png'] },
}

const methods = ['initialize', 'ping', 'tools/list', 'resources/list', 'resources/read', 'prompts/list', 'prompts/get', 'tools/call']

export default function EnterpriseMcpGatewayPage() {
  const softwareJsonLd = {
    '@context': 'https://schema.org', '@type': 'SoftwareApplication',
    '@id': `${SITE_URL}/enterprise-mcp-gateway#software`, name: 'Maha Enterprise MCP Gateway',
    url: `${SITE_URL}/enterprise-mcp-gateway`, applicationCategory: 'BusinessApplication',
    applicationSubCategory: 'AI agent security and governance', operatingSystem: 'Cloud service',
    description, provider: { '@type': 'Organization', '@id': `${SITE_URL}/#organization`, name: 'Maha Strategies LLC', url: SITE_URL },
    featureList: ['Tenant-scoped MCP server inventory', 'Method and tool allowlists', 'Automatic tools/list discovery', 'Rate limits and timeout controls', 'Circuit breakers', 'Metadata-only audit records'],
    softwareHelp: `${SITE_URL}/guides/enterprise-mcp-governance`,
  }
  return <main className="min-h-screen bg-[#0a0a0c] px-6 py-20 text-zinc-200 sm:py-28"><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareJsonLd).replace(/</g, '\\u003c') }} /><div className="mx-auto max-w-4xl">
    <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-cyan-300">[ Maha Strategies // Enterprise infrastructure ]</p>
    <h1 className="mt-5 max-w-3xl text-4xl font-light leading-tight text-white sm:text-6xl">One governed path to your MCP servers.</h1>
    <p className="mt-6 max-w-3xl text-lg leading-relaxed text-zinc-400">The Enterprise MCP Gateway is the shared control layer for a tenant’s approved MCP connections: server inventory, explicit method and tool allowlists, tenant-bound credentials, and an audit record that does not retain request contents.</p>
    <div className="mt-10 grid gap-4 md:grid-cols-3">
      <section className="border border-zinc-800 bg-zinc-950/50 p-5"><p className="font-mono text-[10px] uppercase tracking-widest text-cyan-300">01 // Inventory</p><p className="mt-3 text-sm leading-relaxed text-zinc-400">Register each approved upstream endpoint under one customer tenant. A credential for one tenant cannot reach another tenant’s server.</p></section>
      <section className="border border-zinc-800 bg-zinc-950/50 p-5"><p className="font-mono text-[10px] uppercase tracking-widest text-cyan-300">02 // Policy</p><p className="mt-3 text-sm leading-relaxed text-zinc-400">Allow only the MCP methods and tool names you have explicitly registered. Unlisted calls are blocked before any upstream request is made.</p></section>
      <section className="border border-zinc-800 bg-zinc-950/50 p-5"><p className="font-mono text-[10px] uppercase tracking-widest text-cyan-300">03 // Evidence</p><p className="mt-3 text-sm leading-relaxed text-zinc-400">Record the method, tool name, outcome, upstream status, and a request hash—not the request body, tool arguments, or upstream response.</p></section>
    </div>
    <section className="mt-12 border border-cyan-900 bg-cyan-950/15 p-6"><h2 className="text-xl text-white">Current deployment boundary</h2><p className="mt-3 max-w-3xl text-sm leading-relaxed text-zinc-300">The canonical v1 gateway proxies JSON MCP messages to registered <strong>public HTTPS upstreams</strong>. Bearer and HMAC upstream credentials are encrypted at rest and never returned. The gateway does not yet provide private-network connectivity, upstream OAuth token exchange, SSE streaming, or browser-originated calls.</p></section>
    <section className="mt-12"><h2 className="text-2xl text-white">Supported policy surface</h2><div className="mt-5 flex flex-wrap gap-2">{methods.map((method) => <code key={method} className="border border-zinc-700 bg-black px-3 py-2 text-xs text-cyan-100">{method}</code>)}</div><p className="mt-5 text-sm leading-relaxed text-zinc-400"><code>tools/call</code> requires a named per-server allowlist. A registered server URL is not permission to invoke every tool it exposes.</p></section>
    <section className="mt-12 border border-zinc-800 bg-zinc-950/50 p-6"><h2 className="text-2xl text-white">Discovery and failure containment</h2><p className="mt-3 text-sm leading-relaxed text-zinc-400">Registration performs a bounded <code>tools/list</code> handshake. Operators approve callable tools from that validated inventory, then set tenant-wide request rate, timeout, failure-threshold, and circuit-cooldown controls.</p><p className="mt-4 text-xs leading-relaxed text-zinc-500">Discovery describes the upstream surface; it does not authorize a tool automatically.</p></section>
    <section className="mt-12 border-t border-zinc-800 pt-8"><h2 className="text-2xl text-white">Machine-readable contract</h2><p className="mt-3 text-sm leading-relaxed text-zinc-400">Integration teams can use the gateway contract to register a server and make requests through a tenant endpoint.</p><div className="mt-5 flex flex-wrap gap-3"><a className="border border-cyan-600 px-4 py-2 font-mono text-xs uppercase tracking-widest text-cyan-100 hover:bg-cyan-950/50" href="/mcp-gateway-contract.json">Read the contract</a><Link className="border border-zinc-700 px-4 py-2 font-mono text-xs uppercase tracking-widest text-zinc-300 hover:border-cyan-500" href="/guides/enterprise-mcp-governance">Read the governance guide</Link><Link className="border border-zinc-700 px-4 py-2 font-mono text-xs uppercase tracking-widest text-zinc-300 hover:border-cyan-500" href="/mcp-bridge">Local MCP Bridge</Link></div></section>
  </div></main>
}
