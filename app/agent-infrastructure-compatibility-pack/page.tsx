import type { Metadata } from 'next'

import { COMPATIBILITY_PACK_CONTRACT, COMPATIBILITY_PACK_SAMPLE_REPORT } from '@/lib/agent-infrastructure-compatibility-pack'

export const metadata: Metadata = {
  title: 'Agent Infrastructure Compatibility Pack | Maha Strategies',
  description: 'A fixed-price, evidence-backed compatibility assessment for one A2A agent, one MCP server and their policy and payment boundary.',
  alternates: { canonical: '/agent-infrastructure-compatibility-pack' },
  openGraph: { title: 'Agent Infrastructure Compatibility Pack', description: 'One A2A agent. One MCP server. One bounded compatibility report.', url: '/agent-infrastructure-compatibility-pack', type: 'website' },
}

const contractUrl = '/api/discovery/agent-infrastructure-compatibility-pack'

export default function AgentInfrastructureCompatibilityPackPage() {
  const sample = COMPATIBILITY_PACK_SAMPLE_REPORT
  const jsonLd = {
    '@context': 'https://schema.org', '@type': 'Service', name: COMPATIBILITY_PACK_CONTRACT.name,
    description: COMPATIBILITY_PACK_CONTRACT.description, provider: { '@type': 'Organization', name: 'Maha Strategies LLC' },
    offers: { '@type': 'Offer', price: '49.00', priceCurrency: 'USD', availability: 'https://schema.org/PreOrder', url: 'https://www.mahastrategies.com/agent-infrastructure-compatibility-pack' },
  }
  return <main className="min-h-screen bg-[#09090b] px-6 py-20 text-zinc-200 sm:py-28"><div className="mx-auto max-w-5xl">
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-cyan-300">[ machine product // contract v{COMPATIBILITY_PACK_CONTRACT.version} ]</p>
    <h1 className="mt-5 max-w-4xl text-4xl font-light leading-tight text-white sm:text-6xl">One agent. One tool server. One compatibility verdict you can inspect.</h1>
    <p className="mt-6 max-w-3xl text-lg leading-relaxed text-zinc-400">The Agent Infrastructure Compatibility Pack exercises one A2A agent and one MCP server against caller-declared tool, task and payment policy. It returns source-linked, hashed findings—not a generic market report or a certification badge.</p>
    <div className="mt-8 flex flex-wrap gap-3"><a className="border border-cyan-500 px-4 py-2 font-mono text-xs uppercase tracking-widest text-cyan-100" href={contractUrl}>Machine contract</a><a className="border border-zinc-700 px-4 py-2 font-mono text-xs uppercase tracking-widest text-zinc-300" href={`${contractUrl}/sample`}>Sample JSON report</a></div>

    <section className="mt-12 grid gap-4 md:grid-cols-3"><Card label="Fixed price" value="49.00 USDC" text="Base Mainnet, 49,000,000 base units. The live challenge will be authoritative once payment is promoted." /><Card label="Bounded scope" value="1 A2A + 1 MCP" text="One declared non-mutating skill and tool. JSON-RPC only. No open-ended scanning." /><Card label="Current status" value="Contract published" text="Payment remains withheld until durable delivery and automatic refund recovery pass Production E2E." /></section>

    <section className="mt-14"><h2 className="text-2xl text-white">What the report answers</h2><div className="mt-5 grid gap-4 sm:grid-cols-2"><Card label="Identity & protocol" value="Discovery bound" text="Agent Card, RPC URL, tools/list inventory, declared methods and schema evidence are captured with timestamps and hashes." /><Card label="Policy" value="Allowlist enforced" text="The selected skill, tool, methods, timeout and per-call/task payment ceilings are evaluated without silently broadening policy." /><Card label="Payment" value="Challenge inspected" text="Network, asset, payee and amount are compared with policy. Maha never holds the buyer key or settles an upstream payment." /><Card label="Auditability" value="Evidence attached" text="Every finding carries a bounded observation, source URL, observed time and SHA-256 digest." /></div></section>

    <section className="mt-14 border border-zinc-800 bg-zinc-950/70 p-6"><h2 className="text-2xl text-white">Sample decision: {sample.decision.replaceAll('_', ' ')}</h2><p className="mt-3 text-sm text-zinc-400">{sample.summary.passed} passed · {sample.summary.failed} failed · {sample.summary.notChecked} not checked · highest severity {sample.summary.highestSeverity}</p><div className="mt-5 space-y-3">{sample.checks.map((check) => <article key={check.id} className="border-l-2 border-cyan-800 pl-4"><p className="font-mono text-[10px] uppercase tracking-widest text-cyan-300">{check.layer} // {check.status}</p><p className="mt-1 text-sm text-zinc-300">{check.summary}</p></article>)}</div></section>

    <section className="mt-14 grid gap-8 md:grid-cols-2"><div><h2 className="text-2xl text-white">Failure and refund behavior</h2><ul className="mt-4 space-y-3 text-sm leading-relaxed text-zinc-400"><li><strong className="text-zinc-200">No charge:</strong> invalid schema, unsafe target, unreachable preflight target, or unsupported authentication.</li><li><strong className="text-zinc-200">Report, no refund:</strong> incompatibility, policy rejection, target timeout/error, or payment terms outside policy. Those are the findings purchased.</li><li><strong className="text-zinc-200">Full automatic refund:</strong> Maha fails after settlement, cannot confirm durable report storage, or misses the delivery target.</li><li><strong className="text-zinc-200">No duplicate charge:</strong> retries bind clientRequestId to the input hash and return the original report.</li></ul></div><div><h2 className="text-2xl text-white">Limitations</h2><ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-relaxed text-zinc-400">{COMPATIBILITY_PACK_CONTRACT.limitations.map((item) => <li key={item}>{item}</li>)}</ul></div></section>
  </div></main>
}

function Card({ label, value, text }: { label: string; value: string; text: string }) { return <article className="border border-zinc-800 bg-zinc-950/50 p-5"><p className="font-mono text-[10px] uppercase tracking-widest text-cyan-300">{label}</p><p className="mt-2 text-lg text-white">{value}</p><p className="mt-3 text-sm leading-relaxed text-zinc-400">{text}</p></article> }
