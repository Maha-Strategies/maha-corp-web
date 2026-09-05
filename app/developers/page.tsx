import type { Metadata } from 'next'
import Link from 'next/link'
import type { ReactNode } from 'react'

import contextRetention from '@/benchmarks/mcrb-1/results.json'
import contextRecipe from '@/content/recipes/context-compiler-large-document-result.json'
import { clearingGuidesForLane } from '@/lib/epistemic-clearing-batch-one'

const SITE_URL = 'https://www.mahastrategies.com'
const title = 'Developer Infrastructure for Governed AI Systems | Maha Strategies'
const description = 'Production APIs for enterprise MCP governance, bounded context compilation, evidence evaluation, GPU optimization, and MPS preflight—with TypeScript and Python SDKs.'

export const metadata: Metadata = {
  title, description, alternates: { canonical: '/developers' },
  openGraph: { type: 'website', url: `${SITE_URL}/developers`, siteName: 'Maha Strategies', title, description, images: [{ url: '/og-master.png', width: 1200, height: 630, alt: 'Maha Strategies developer infrastructure' }] },
  twitter: { card: 'summary_large_image', title, description, images: ['/og-master.png'] },
}

const capabilities = [
  { label: 'Agent governance', title: 'Enterprise MCP Gateway', body: 'Register tenant-owned MCP upstreams, discover tools, enforce method and tool allowlists, bound execution, and retain metadata-only audit evidence.', href: '/enterprise-mcp-gateway', action: 'Explore MCP gateway controls' },
  { label: 'Context engineering', title: 'Context Compiler', body: 'Rank and deduplicate task-relevant passages into a declared context budget while preserving source IDs, passage hashes, and measurable coverage.', href: '/context-compiler', action: 'Review the context compiler' },
  { label: 'Evaluation', title: 'Context Pack Evaluator', body: 'Declare evidence that must survive compilation, then measure exact retention alongside token, byte, coverage, and duplicate-removal metrics.', href: '/context-pack-evaluator', action: 'Evaluate evidence retention' },
  { label: 'GPU optimization', title: 'Bounded optimization APIs', body: 'Run accurately bounded tensor-network QUBO/Ising heuristics and weighted SE(3) rigid registration through the asynchronous GPU job pipeline.', href: '/tensor-opt', secondaryHref: '/geometric-optimization', action: 'Inspect tensor optimization', secondaryAction: 'Inspect geometric registration' },
  { label: 'Evidence assurance', title: 'MPS Preflight', body: 'Screen AI-assisted documents before review and produce an explicit record of claims, evidence status, uncertainty, and remaining verification work.', href: '/mps/preflight', action: 'Run an MPS preflight' },
] as const

const integrations = [
  { title: 'TypeScript SDK', body: 'Zero-dependency client for Node.js, Bun, Deno, browsers, and Edge runtimes.', href: 'https://www.npmjs.com/package/@mahastrategies/sdk', action: 'Install @mahastrategies/sdk', external: true },
  { title: 'Python SDK', body: 'Python client with optional LangChain and CrewAI adapters.', href: 'https://pypi.org/project/maha-sdk/', action: 'Install maha-sdk', external: true },
  { title: 'OpenAPI 3.1', body: 'Machine-readable endpoint, schema, authentication, and error contracts.', href: '/api/docs/openapi', action: 'Open the API contract', external: false },
  { title: 'MCP bridge', body: 'Connect local agents to documented Maha APIs with explicit human approval for checkout.', href: '/mcp-bridge', action: 'Read the MCP bridge guide', external: false },
  { title: 'x402 Observatory', body: 'Open factual checks for x402 v2 protocol and Bazaar discovery correctness, without subjective trust scoring.', href: '/x402-observatory', action: 'Inspect public conformance', external: false },
  { title: 'x402 Buyer Policy', body: 'Open pre-signing budgets, allowlists, approvals, replay controls, and settlement verification for autonomous buyers.', href: '/x402-buyer-policy', action: 'Apply buyer payment controls', external: false },
  { title: 'Compatibility Pack contract', body: 'Exact schemas, fixed price, sample evidence report, limitations, and refund behavior for the bounded A2A + MCP machine product.', href: '/agent-infrastructure-compatibility-pack', action: 'Inspect the published contract', external: false },
] as const

const machineClearingGuides = clearingGuidesForLane('machine-integrations').slice(0, 4)

export default function DevelopersPage() {
  const contextBm25 = contextRetention.results.find((result) => result.method === 'maha_bm25')!
  const itemListJsonLd = {
    '@context': 'https://schema.org', '@type': 'CollectionPage', '@id': `${SITE_URL}/developers#page`, name: title, description, url: `${SITE_URL}/developers`, isPartOf: { '@id': `${SITE_URL}/#website` },
    about: capabilities.map((capability) => ({ '@type': 'SoftwareApplication', name: capability.title, url: `${SITE_URL}${capability.href}`, applicationCategory: 'DeveloperApplication' })),
  }

  return (
    <main className="evidence-page">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd).replace(/</g, '\\u003c') }} />
      <div className="evidence-container">
        <header className="max-w-5xl border-t border-[var(--border-default)] pt-5">
          <p className="evidence-kicker flex flex-wrap justify-between gap-3"><span>Developer infrastructure</span><span>Inspectable controls · production APIs</span></p>
          <h1 className="evidence-title">Build governed AI systems on an inspectable control layer.</h1>
          <p className="evidence-lede mt-7">One entry point for Maha&apos;s production APIs, SDKs, operational boundaries, benchmarks, and security model.</p>
          <p className="evidence-copy mt-5">Use only the capability your workflow needs: govern agent tools, compile bounded context, evaluate evidence retention, run bounded optimization jobs, or preflight consequential documents.</p>
          <div className="mt-9 flex flex-wrap gap-3"><Link href="/docs" className="evidence-action evidence-action--primary">Read API documentation ↗</Link><Link href="/dashboard" className="evidence-action evidence-action--secondary">Open developer dashboard ↗</Link><Link href="/demo" className="evidence-action evidence-action--secondary">Watch the system demonstration ↗</Link></div>
        </header>

        <section className="evidence-section" aria-labelledby="production-capabilities">
          <p className="evidence-kicker">Production capability map</p><h2 id="production-capabilities" className="evidence-section-title mt-4 max-w-3xl">Choose the control your workflow is missing.</h2>
          <div className="mt-9 grid gap-5 md:grid-cols-2">
            {capabilities.map((capability) => <article key={capability.href} className="evidence-card flex min-h-full flex-col"><p className="evidence-kicker">{capability.label}</p><h3 className="evidence-card-title mt-3">{capability.title}</h3><p className="evidence-card-copy mt-4 flex-1">{capability.body}</p><div className="mt-7 flex flex-col gap-3 font-mono text-xs uppercase tracking-widest"><Link href={capability.href} className="evidence-link">{capability.action} ↗</Link>{'secondaryHref' in capability ? <Link href={capability.secondaryHref} className="evidence-link">{capability.secondaryAction} ↗</Link> : null}</div></article>)}
          </div>
        </section>

        <section className="evidence-section" aria-labelledby="sdk-integrations">
          <p className="evidence-kicker">SDKs and integration contracts</p><h2 id="sdk-integrations" className="evidence-section-title mt-4">Integrate without adopting another runtime.</h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {integrations.map((integration) => <article key={integration.href} className="evidence-card"><h3 className="evidence-card-title text-lg">{integration.title}</h3><p className="evidence-card-copy mt-3 min-h-20">{integration.body}</p>{integration.external ? <a href={integration.href} target="_blank" rel="noopener noreferrer" className="evidence-link mt-5 inline-block font-mono text-[10px] uppercase tracking-widest">{integration.action} ↗</a> : <Link href={integration.href} className="evidence-link mt-5 inline-block font-mono text-[10px] uppercase tracking-widest">{integration.action} ↗</Link>}</article>)}
          </div>
        </section>

        <section className="evidence-section" aria-labelledby="machine-clearing-guides">
          <p className="evidence-kicker">Bounded machine decisions</p>
          <h2 id="machine-clearing-guides" className="evidence-section-title mt-4">Carry identity, entitlement, quota, and evidence boundaries into each request.</h2>
          <p className="evidence-copy mt-5 max-w-4xl">These operational guides connect Maha&apos;s implemented contracts to conceptual lenses from the books. The book links frame the problem; they are never treated as evidence that a machine control exists or works.</p>
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            {machineClearingGuides.map((guide) => <Guide key={guide.path} href={guide.path} title={guide.title} detail={guide.question} />)}
          </div>
        </section>

        <section id="benchmarks" className="evidence-section" aria-labelledby="benchmark-evidence">
          <div className="evidence-inset grid gap-10 lg:grid-cols-[0.8fr_1.2fr]">
            <div><p className="evidence-kicker">Published operational evidence</p><h2 id="benchmark-evidence" className="evidence-section-title mt-4">Benchmarks state the boundary, not just the number.</h2><p className="evidence-copy mt-5 text-sm">GPU measurements are seven-run warm solver baselines on an NVIDIA A10G. They exclude HTTP latency and container cold starts, and heuristic results do not claim global optimality.</p></div>
            <div className="grid gap-4 sm:grid-cols-2"><Benchmark label="Tensor-network QUBO / Ising" value="80.840 ms" detail="Warm p95 at 256 variables and bond dimension 256; reviewed promotion threshold ≤150 ms." href="/tensor-opt" /><Benchmark label="Weighted SE(3) registration" value="108.604 ms" detail="Warm p95 at 16,384 paired points; reviewed promotion threshold ≤200 ms." href="/geometric-optimization" /><Benchmark label="MCRB-1 evidence retention" value={`${contextBm25.completeEvidenceSetPercent}%`} detail={`Complete human evidence-set retention at ${contextBm25.meanReductionPercent}% mean token reduction across ${contextRetention.dataset.cases} independently annotated QASPER questions.`} href="/benchmarks/context-retention" /><Benchmark label="Context compiler recipe" value={`${contextRecipe.result.reductionPercent}%`} detail="Executable four-chapter workload with 100% source participation and economics stated against the $0.001 x402 fee." href="/recipes/context-compiler-large-document" /></div>
          </div>
        </section>

        <section id="security" className="evidence-section" aria-labelledby="security-model">
          <div className="grid gap-10 lg:grid-cols-2"><div><p className="evidence-kicker">Security and data boundary</p><h2 id="security-model" className="evidence-section-title mt-4">Minimize what crosses and what remains.</h2><p className="evidence-copy mt-5 text-sm">Security claims are capability-specific. Review the API contract and deployment boundary before sending production, regulated, personal, or confidential data.</p></div><ul className="space-y-4 text-sm leading-7 text-[var(--text-secondary)]"><Boundary name="Tenant isolation">API credentials resolve to tenant-scoped resources; one tenant cannot enumerate another tenant&apos;s MCP servers.</Boundary><Boundary name="Bounded execution">Request sizes, methods, tools, rates, timeouts, failure thresholds, and circuit cooldowns are server-validated.</Boundary><Boundary name="Credential handling">Supported MCP upstream secrets are encrypted at rest and never returned by listing or discovery APIs.</Boundary><Boundary name="Data minimization">Context compilation is transient; gateway audit records exclude tool arguments and upstream response bodies.</Boundary></ul></div>
          <div className="mt-8 flex flex-wrap gap-4 font-mono text-xs uppercase tracking-widest"><Link href="/guides/enterprise-mcp-governance" className="evidence-link">Gateway security boundary ↗</Link><Link href="/docs" className="evidence-link">Endpoint contracts ↗</Link></div>
        </section>

        <section className="evidence-section" aria-labelledby="implementation-guides"><p className="evidence-kicker">Evidence-grounded guides</p><h2 id="implementation-guides" className="evidence-section-title mt-4">Start from measured behavior and runnable controls.</h2><div className="mt-8 grid gap-4 md:grid-cols-2"><Guide href="/guides/context-compression-vs-conversation-summarization" title="Context compression vs. conversation summarization" detail="Choose by evidence and state-preservation requirements." /><Guide href="/guides/preserve-citations-reducing-llm-context" title="Preserve citations while reducing LLM context" detail="Validate source and passage identities after selection." /><Guide href="/guides/crewai-context-compression-provenance" title="CrewAI context compression with provenance" detail="Use the published Python adapter in a bounded research agent." /><Guide href="/guides/mcp-gateway-vs-direct-server" title="MCP gateway vs. direct server connections" detail="Compare destination, policy, credential, containment, and audit controls." /></div></section>
      </div>
    </main>
  )
}

function Benchmark({ label, value, detail, href }: { label: string; value: string; detail: string; href: string }) {
  return <article className="border border-[var(--border-default)] bg-[var(--surface-paper)] p-5"><p className="evidence-kicker">{label}</p><p className="mt-3 font-mono text-2xl text-[var(--status-verified)]">{value}</p><p className="evidence-card-copy mt-3 text-xs">{detail}</p><Link href={href} className="evidence-link mt-5 inline-block font-mono text-[10px] uppercase tracking-widest">Review scope and limits ↗</Link></article>
}

function Boundary({ name, children }: { name: string; children: ReactNode }) {
  return <li className="border-l-2 border-[var(--status-sourced)] pl-4"><strong className="text-[var(--text-primary)]">{name}:</strong> {children}</li>
}

function Guide({ href, title, detail }: { href: string; title: string; detail: string }) {
  return <Link href={href} className="evidence-card"><span className="evidence-card-title text-lg">{title}</span><span className="evidence-card-copy mt-2 block">{detail}</span></Link>
}
