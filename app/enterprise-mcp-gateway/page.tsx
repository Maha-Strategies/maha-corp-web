import type { Metadata } from 'next'
import Link from 'next/link'
import { EVIDENCE_WORKFLOW_PATH } from '@/lib/evidence-workflow-examples'

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
  return (
    <main className="evidence-page">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareJsonLd).replace(/</g, '\\u003c') }} />
      <div className="evidence-container evidence-container--narrow">
        <header className="border-t border-[var(--border-default)] pt-5">
          <p className="evidence-kicker flex flex-wrap justify-between gap-3">
            <span>Maha Strategies</span><span>Enterprise infrastructure</span>
          </p>
          <h1 className="evidence-title evidence-title--product">One governed path to your MCP servers.</h1>
          <p className="evidence-lede mt-7">The Enterprise MCP Gateway is the shared control layer for a tenant&rsquo;s approved MCP connections: server inventory, explicit method and tool allowlists, tenant-bound credentials, and an audit record that does not retain request contents.</p>
        </header>

        <section className="evidence-section" aria-labelledby="controls-heading">
          <p className="evidence-kicker">Three controls</p>
          <h2 id="controls-heading" className="evidence-section-title mt-4">Inventory, policy, evidence.</h2>
          <div className="mt-9 grid gap-4 md:grid-cols-3">
            {[
              ['01', 'Inventory', 'Register each approved upstream endpoint under one customer tenant. A credential for one tenant cannot reach another tenant’s server.'],
              ['02', 'Policy', 'Allow only the MCP methods and tool names you have explicitly registered. Unlisted calls are blocked before any upstream request is made.'],
              ['03', 'Evidence', 'Record the method, tool name, outcome, upstream status, and a request hash—not the request body, tool arguments, or upstream response.'],
            ].map(([number, heading, copy]) => (
              <article key={number} className="evidence-card flex flex-col">
                <p className="evidence-kicker">{number} — {heading}</p>
                <p className="evidence-card-copy mt-4">{copy}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="evidence-section" aria-labelledby="boundary-heading">
          <div className="evidence-inset" style={{ borderLeftColor: 'var(--status-boundary)' }}>
            <p className="evidence-kicker">Known limits</p>
            <h2 id="boundary-heading" className="evidence-section-title mt-4">Current deployment boundary</h2>
            <p className="evidence-copy mt-5">The canonical v1 gateway proxies JSON MCP messages to registered <strong>public HTTPS upstreams</strong>. Bearer and HMAC upstream credentials are encrypted at rest and never returned. The gateway does not yet provide private-network connectivity, upstream OAuth token exchange, SSE streaming, or browser-originated calls.</p>
          </div>
        </section>

        <section className="evidence-section" aria-labelledby="surface-heading">
          <p className="evidence-kicker">Allowlist</p>
          <h2 id="surface-heading" className="evidence-section-title mt-4">Supported policy surface</h2>
          <div className="mt-7 flex flex-wrap gap-2">
            {methods.map((method) => <code key={method} className="evidence-chip">{method}</code>)}
          </div>
          <p className="evidence-copy mt-5"><code className="font-mono text-sm">tools/call</code> requires a named per-server allowlist. A registered server URL is not permission to invoke every tool it exposes.</p>
        </section>

        <section className="evidence-section" aria-labelledby="discovery-heading">
          <p className="evidence-kicker">Containment</p>
          <h2 id="discovery-heading" className="evidence-section-title mt-4">Discovery and failure containment</h2>
          <p className="evidence-copy mt-5">Registration performs a bounded <code className="font-mono text-sm">tools/list</code> handshake. Operators approve callable tools from that validated inventory, then set tenant-wide request rate, timeout, failure-threshold, and circuit-cooldown controls.</p>
          <p className="evidence-kicker mt-5">Discovery describes the upstream surface; it does not authorize a tool automatically.</p>
        </section>

        <section className="evidence-section" aria-labelledby="contract-heading">
          <p className="evidence-kicker">Machine-readable</p>
          <h2 id="contract-heading" className="evidence-section-title mt-4">Contract and architecture guides</h2>
          <p className="evidence-copy mt-5">Integration teams can use the gateway contract to register a server and make requests through a tenant endpoint, then review the exact control boundary before routing production tools.</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <a className="evidence-action evidence-action--primary" href="/mcp-gateway-contract.json">Read the contract ↗</a>
            <Link className="evidence-action evidence-action--secondary" href="/guides/mcp-gateway-vs-direct-server">Gateway vs. direct MCP ↗</Link>
            <Link className="evidence-action evidence-action--secondary" href="/guides/enterprise-mcp-governance">Tool allowlists and audit logs ↗</Link>
            <Link className="evidence-action evidence-action--secondary" href="/mcp-bridge">Local MCP Bridge ↗</Link>
            <Link className="evidence-action evidence-action--secondary" href={EVIDENCE_WORKFLOW_PATH}>Licensed evidence workflows ↗</Link>
          </div>
        </section>
      </div>
    </main>
  )
}
