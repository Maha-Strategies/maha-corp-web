import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Enterprise MCP Gateway | Maha Strategies',
  description: 'Tenant-scoped MCP server inventory, allowlist policy, and privacy-preserving event records.',
  alternates: { canonical: '/enterprise-mcp-gateway' },
}

const methods = ['initialize', 'ping', 'tools/list', 'resources/list', 'resources/read', 'prompts/list', 'prompts/get', 'tools/call']

export default function EnterpriseMcpGatewayPage() {
  return <main className="min-h-screen bg-[#0a0a0c] px-6 py-20 text-zinc-200 sm:py-28"><div className="mx-auto max-w-4xl">
    <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-cyan-300">[ Maha Strategies // Enterprise infrastructure ]</p>
    <h1 className="mt-5 max-w-3xl text-4xl font-light leading-tight text-white sm:text-6xl">One governed path to your MCP servers.</h1>
    <p className="mt-6 max-w-3xl text-lg leading-relaxed text-zinc-400">The Enterprise MCP Gateway is the shared control layer for a tenant’s approved MCP connections: server inventory, explicit method and tool allowlists, tenant-bound credentials, and an audit record that does not retain request contents.</p>
    <div className="mt-10 grid gap-4 md:grid-cols-3">
      <section className="border border-zinc-800 bg-zinc-950/50 p-5"><p className="font-mono text-[10px] uppercase tracking-widest text-cyan-300">01 // Inventory</p><p className="mt-3 text-sm leading-relaxed text-zinc-400">Register each approved upstream endpoint under one customer tenant. A credential for one tenant cannot reach another tenant’s server.</p></section>
      <section className="border border-zinc-800 bg-zinc-950/50 p-5"><p className="font-mono text-[10px] uppercase tracking-widest text-cyan-300">02 // Policy</p><p className="mt-3 text-sm leading-relaxed text-zinc-400">Allow only the MCP methods and tool names you have explicitly registered. Unlisted calls are blocked before any upstream request is made.</p></section>
      <section className="border border-zinc-800 bg-zinc-950/50 p-5"><p className="font-mono text-[10px] uppercase tracking-widest text-cyan-300">03 // Evidence</p><p className="mt-3 text-sm leading-relaxed text-zinc-400">Record the method, tool name, outcome, upstream status, and a request hash—not the request body, tool arguments, or upstream response.</p></section>
    </div>
    <section className="mt-12 border border-cyan-900 bg-cyan-950/15 p-6"><h2 className="text-xl text-white">First release boundary</h2><p className="mt-3 max-w-3xl text-sm leading-relaxed text-zinc-300">This release proxies JSON MCP messages to registered <strong>public HTTPS upstreams</strong>. It does not store upstream credentials, forward an agent’s bearer token, stream SSE responses, or authorize browser-originated calls. Those restrictions are intentional: private upstream access needs a dedicated OAuth token-exchange layer, not a shortcut that turns the gateway into a secret relay.</p></section>
    <section className="mt-12"><h2 className="text-2xl text-white">Supported policy surface</h2><div className="mt-5 flex flex-wrap gap-2">{methods.map((method) => <code key={method} className="border border-zinc-700 bg-black px-3 py-2 text-xs text-cyan-100">{method}</code>)}</div><p className="mt-5 text-sm leading-relaxed text-zinc-400"><code>tools/call</code> requires a named per-server allowlist. A registered server URL is not permission to invoke every tool it exposes.</p></section>
    <section className="mt-12 border border-zinc-800 bg-zinc-950/50 p-6"><h2 className="text-2xl text-white">Optional Context Pack admission</h2><p className="mt-3 text-sm leading-relaxed text-zinc-400">For named approved tools, a gateway operator can require a registered Context Pack. The call must include <code>contextPackId</code>, <code>contextPackHash</code>, and <code>context</code>. Before forwarding, the gateway verifies the supplied context hashes exactly to a pack registered for the same tenant. It records the pack ID and policy outcome, never the context itself.</p><p className="mt-4 text-xs leading-relaxed text-zinc-500">This is content-admission control, not source verification or a guarantee about the downstream tool’s output.</p></section>
    <section className="mt-12 border-t border-zinc-800 pt-8"><h2 className="text-2xl text-white">Machine-readable contract</h2><p className="mt-3 text-sm leading-relaxed text-zinc-400">Integration teams can use the gateway contract to register a server and make requests through a tenant endpoint. Operator registration remains private and requires a distinct operations credential.</p><div className="mt-5 flex flex-wrap gap-3"><a className="border border-cyan-600 px-4 py-2 font-mono text-xs uppercase tracking-widest text-cyan-100 hover:bg-cyan-950/50" href="/mcp-gateway-contract.json">Read the contract</a><Link className="border border-zinc-700 px-4 py-2 font-mono text-xs uppercase tracking-widest text-zinc-300 hover:border-cyan-500" href="/mcp-bridge">Existing Maha MCP Bridge</Link></div></section>
  </div></main>
}
