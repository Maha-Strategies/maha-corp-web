import type { Metadata } from 'next'
import Link from 'next/link'

import { CodeBlock, EvidenceGuide } from '@/app/guides/_components/EvidenceGuide'

const path = '/guides/mcp-gateway-vs-direct-server'
const title = 'MCP Gateway vs. Direct MCP Server Connections'
const description = 'A control-by-control comparison of direct MCP connections and a tenant-aware gateway, grounded in Maha’s runnable allowlist, rate-limit, circuit-breaker, and audit implementation.'

export const metadata: Metadata = { title, description, alternates: { canonical: path }, openGraph: { type: 'article', url: `https://www.mahastrategies.com${path}`, title, description }, twitter: { card: 'summary_large_image', title, description } }

export default function McpGatewayVsDirectPage() {
  return <EvidenceGuide path={path} eyebrow="Enterprise MCP architecture" title={title} summary={description} about={['Model Context Protocol', 'MCP gateway', 'AI agent security', 'Tool governance']} backHref="/enterprise-mcp-gateway" backLabel="Enterprise MCP Gateway">
    <section className="mt-12 border border-cyan-900/50 bg-cyan-950/10 p-7 sm:p-9"><h2 className="text-2xl text-white">The short answer</h2><p className="mt-4 leading-7 text-zinc-300">Connect directly when one trusted operator controls one agent and one server, and the server already provides the authentication, policy, telemetry, and containment you need. Add a gateway when multiple agents, teams, credentials, or upstreams require one enforceable tenant boundary and one revocation point.</p></section>

    <section className="mt-14 overflow-x-auto"><h2 className="text-3xl font-light text-white">Control comparison</h2><table className="mt-6 min-w-full border border-zinc-800 text-left text-sm"><thead className="bg-zinc-950 font-mono text-[10px] uppercase tracking-widest text-zinc-400"><tr><th className="p-4">Control</th><th className="p-4">Direct connection</th><th className="p-4">Tenant gateway</th></tr></thead><tbody className="text-zinc-300"><Row control="Destination" direct="Client chooses or stores the upstream." gateway="Server ID resolves to a tenant-owned HTTPS registry record." /><Row control="Tool authorization" direct="Depends on each server or client." gateway="Method and tool allowlists run before dispatch." /><Row control="Credentials" direct="Every client manages upstream secrets." gateway="Gateway injects an encrypted per-server credential." /><Row control="Failure containment" direct="Per-client behavior." gateway="Tenant rate limit, timeout, failure threshold, and cooldown." /><Row control="Audit evidence" direct="Distributed across clients and servers." gateway="One metadata-only event path with request hash." /></tbody></table></section>

    <section className="mt-14"><h2 className="text-3xl font-light text-white">A policy that fails closed</h2><CodeBlock>{`const server = await maha.mcp.registerServer({
  name: "Production risk tools",
  baseUrl: "https://mcp.example.com/rpc",
  authType: "bearer",
  secret: process.env.UPSTREAM_MCP_TOKEN,
  allowedMethods: ["initialize", "ping", "tools/list", "tools/call"],
  allowedToolNames: [],
})

const discovered = await maha.mcp.discoverTools(server.serverId)
await maha.mcp.updateServerPolicy(server.serverId, {
  allowedMethods: ["initialize", "ping", "tools/list", "tools/call"],
  allowedToolNames: discovered.discovery.tools
    .filter(tool => tool.name === "calculateRiskScore")
    .map(tool => tool.name),
})`}</CodeBlock><p className="mt-5 text-sm leading-7 text-zinc-500">Discovery does not authorize a tool. The operator selects names from the validated <code>tools/list</code> inventory, and <code>tools/call</code> is denied when the requested name is absent.</p></section>

    <section className="mt-14 grid gap-5 md:grid-cols-2"><article className="border border-zinc-800 p-7"><h2 className="text-2xl text-white">What Maha’s gateway bounds</h2><ul className="mt-5 space-y-3 text-sm leading-7 text-zinc-400"><li>64 KB inbound JSON-RPC body</li><li>1 MB upstream response</li><li>Public HTTPS DNS destinations only</li><li>1–600 tenant requests per minute</li><li>1–30 second upstream timeout</li><li>1–10 failures before circuit opening</li></ul></article><article className="border border-amber-900/60 bg-amber-950/10 p-7"><h2 className="text-2xl text-white">What it does not replace</h2><ul className="mt-5 space-y-3 text-sm leading-7 text-zinc-400"><li>Controlled network egress for high-assurance SSRF defense</li><li>Private connectivity or upstream OAuth exchange</li><li>Payload-level data-loss prevention</li><li>SSE streaming support</li><li>Security controls inside the upstream tool itself</li></ul></article></section>

    <section className="mt-14"><h2 className="text-3xl font-light text-white">Audit without copying the payload</h2><p className="mt-5 leading-7 text-zinc-400">The event record keeps tenant, server, credential, MCP method, tool name, outcome, upstream status, request hash, optional Context Pack ID, and time. It intentionally excludes tool arguments and upstream response bodies. This supports access review and incident reconstruction without turning the gateway into a second repository of customer data.</p><div className="mt-6 flex flex-wrap gap-4"><Link href="/guides/enterprise-mcp-governance" className="text-cyan-100 underline underline-offset-4">Implement allowlists and audit logs</Link><a href="/mcp-gateway-contract.json" className="text-cyan-100 underline underline-offset-4">Inspect the machine contract</a></div></section>
  </EvidenceGuide>
}

function Row({ control, direct, gateway }: { control: string; direct: string; gateway: string }) { return <tr className="border-t border-zinc-800"><th className="p-4 font-medium text-white">{control}</th><td className="p-4">{direct}</td><td className="p-4">{gateway}</td></tr> }
