import type { Metadata } from 'next'
import Link from 'next/link'

import contextRetention from '@/benchmarks/mcrb-1/results.json'
import contextRecipe from '@/content/recipes/context-compiler-large-document-result.json'

const SITE_URL = 'https://www.mahastrategies.com'
const title = 'Developer Infrastructure for Governed AI Systems | Maha Strategies'
const description = 'Production APIs for enterprise MCP governance, bounded context compilation, evidence evaluation, GPU optimization, and MPS preflight—with TypeScript and Python SDKs.'

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: '/developers' },
  openGraph: {
    type: 'website',
    url: `${SITE_URL}/developers`,
    siteName: 'Maha Strategies',
    title,
    description,
    images: [{ url: '/og-master.png', width: 1200, height: 630, alt: 'Maha Strategies developer infrastructure' }],
  },
  twitter: { card: 'summary_large_image', title, description, images: ['/og-master.png'] },
}

const capabilities = [
  {
    label: 'Agent governance',
    title: 'Enterprise MCP Gateway',
    body: 'Register tenant-owned MCP upstreams, discover tools, enforce method and tool allowlists, bound execution, and retain metadata-only audit evidence.',
    href: '/enterprise-mcp-gateway',
    action: 'Explore MCP gateway controls',
  },
  {
    label: 'Context engineering',
    title: 'Context Compiler',
    body: 'Rank and deduplicate task-relevant passages into a declared context budget while preserving source IDs, passage hashes, and measurable coverage.',
    href: '/context-compiler',
    action: 'Review the context compiler',
  },
  {
    label: 'Evaluation',
    title: 'Context Pack Evaluator',
    body: 'Declare evidence that must survive compilation, then measure exact retention alongside token, byte, coverage, and duplicate-removal metrics.',
    href: '/context-pack-evaluator',
    action: 'Evaluate evidence retention',
  },
  {
    label: 'GPU optimization',
    title: 'Bounded optimization APIs',
    body: 'Run accurately bounded tensor-network QUBO/Ising heuristics and weighted SE(3) rigid registration through the asynchronous GPU job pipeline.',
    href: '/tensor-opt',
    secondaryHref: '/geometric-optimization',
    action: 'Inspect tensor optimization',
    secondaryAction: 'Inspect geometric registration',
  },
  {
    label: 'Evidence assurance',
    title: 'MPS Preflight',
    body: 'Screen AI-assisted documents before review and produce an explicit record of claims, evidence status, uncertainty, and remaining verification work.',
    href: '/mps/preflight',
    action: 'Run an MPS preflight',
  },
] as const

const integrations = [
  {
    title: 'TypeScript SDK',
    body: 'Zero-dependency client for Node.js, Bun, Deno, browsers, and Edge runtimes.',
    href: 'https://www.npmjs.com/package/@mahastrategies/sdk',
    action: 'Install @mahastrategies/sdk',
    external: true,
  },
  {
    title: 'Python SDK',
    body: 'Python client with optional LangChain and CrewAI adapters.',
    href: 'https://pypi.org/project/maha-sdk/',
    action: 'Install maha-sdk',
    external: true,
  },
  {
    title: 'OpenAPI 3.1',
    body: 'Machine-readable endpoint, schema, authentication, and error contracts.',
    href: '/api/docs/openapi',
    action: 'Open the API contract',
    external: false,
  },
  {
    title: 'MCP bridge',
    body: 'Connect local agents to documented Maha APIs with explicit human approval for checkout.',
    href: '/mcp-bridge',
    action: 'Read the MCP bridge guide',
    external: false,
  },
  {
    title: 'x402 Observatory',
    body: 'Open factual checks for x402 v2 protocol and Bazaar discovery correctness, without subjective trust scoring.',
    href: '/x402-observatory',
    action: 'Inspect public conformance',
    external: false,
  },
  {
    title: 'x402 Buyer Policy',
    body: 'Open pre-signing budgets, allowlists, approvals, replay controls, and settlement verification for autonomous buyers.',
    href: '/x402-buyer-policy',
    action: 'Apply buyer payment controls',
    external: false,
  },
  {
    title: 'Compatibility Pack contract',
    body: 'Exact schemas, fixed price, sample evidence report, limitations, and refund behavior for the bounded A2A + MCP machine product.',
    href: '/agent-infrastructure-compatibility-pack',
    action: 'Inspect the published contract',
    external: false,
  },
] as const

export default function DevelopersPage() {
  const contextBm25 = contextRetention.results.find((result) => result.method === 'maha_bm25')!
  const itemListJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    '@id': `${SITE_URL}/developers#page`,
    name: title,
    description,
    url: `${SITE_URL}/developers`,
    isPartOf: { '@id': `${SITE_URL}/#website` },
    about: capabilities.map((capability) => ({
      '@type': 'SoftwareApplication',
      name: capability.title,
      url: `${SITE_URL}${capability.href}`,
      applicationCategory: 'DeveloperApplication',
    })),
  }

  return (
    <main className="min-h-screen bg-[#070a0d] text-zinc-300 selection:bg-cyan-500 selection:text-black">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd).replace(/</g, '\\u003c') }} />

      <div className="mx-auto max-w-6xl px-6 py-20 sm:py-28">
        <header className="max-w-4xl border-l border-cyan-500 pl-6 sm:pl-8">
          <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-cyan-300">[ Maha Strategies // Developer infrastructure ]</p>
          <h1 className="mt-5 text-4xl font-light leading-[1.06] tracking-tight text-white sm:text-6xl md:text-7xl">Build governed AI systems on an inspectable control layer.</h1>
          <p className="mt-7 max-w-3xl text-lg font-light leading-8 text-zinc-300 sm:text-xl">One entry point for Maha&apos;s production APIs, SDKs, operational boundaries, benchmarks, and security model.</p>
          <p className="mt-5 max-w-3xl leading-7 text-zinc-400">Use only the capability your workflow needs: govern agent tools, compile bounded context, evaluate evidence retention, run GPU optimization jobs, or preflight consequential documents.</p>
          <div className="mt-8 flex flex-wrap gap-3 font-mono text-xs uppercase tracking-widest">
            <Link href="/docs" className="bg-white px-5 py-3 font-bold text-black hover:bg-zinc-200">Read API documentation ↗</Link>
            <Link href="/dashboard" className="border border-cyan-700 px-5 py-3 text-cyan-100 hover:bg-cyan-950/40">Open developer dashboard ↗</Link>
          </div>
        </header>

        <section className="mt-20" aria-labelledby="production-capabilities">
          <div className="max-w-3xl">
            <p className="font-mono text-[10px] uppercase tracking-widest text-cyan-300">[ Production capability map ]</p>
            <h2 id="production-capabilities" className="mt-4 text-3xl font-light text-white sm:text-4xl">Choose the control your workflow is missing.</h2>
          </div>
          <div className="mt-9 grid gap-5 md:grid-cols-2">
            {capabilities.map((capability) => (
              <article key={capability.href} className="flex min-h-full flex-col border border-zinc-800 bg-zinc-950/45 p-6 transition-colors hover:border-cyan-800">
                <p className="font-mono text-[10px] uppercase tracking-widest text-cyan-300">{capability.label}</p>
                <h3 className="mt-3 text-xl text-white">{capability.title}</h3>
                <p className="mt-4 flex-1 text-sm leading-7 text-zinc-400">{capability.body}</p>
                <div className="mt-7 flex flex-col gap-3 font-mono text-xs uppercase tracking-widest">
                  <Link href={capability.href} className="text-zinc-200 underline decoration-zinc-700 underline-offset-4 hover:text-white">{capability.action} ↗</Link>
                  {'secondaryHref' in capability ? <Link href={capability.secondaryHref} className="text-zinc-400 underline decoration-zinc-800 underline-offset-4 hover:text-white">{capability.secondaryAction} ↗</Link> : null}
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-20 border-t border-zinc-800 pt-12" aria-labelledby="sdk-integrations">
          <p className="font-mono text-[10px] uppercase tracking-widest text-indigo-300">[ SDKs and integration contracts ]</p>
          <h2 id="sdk-integrations" className="mt-4 text-3xl font-light text-white">Integrate without adopting another runtime.</h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {integrations.map((integration) => (
              <article key={integration.href} className="border border-zinc-800 p-5">
                <h3 className="text-lg text-white">{integration.title}</h3>
                <p className="mt-3 min-h-20 text-sm leading-6 text-zinc-400">{integration.body}</p>
                {integration.external ? (
                  <a href={integration.href} target="_blank" rel="noopener noreferrer" className="mt-5 inline-block font-mono text-[10px] uppercase tracking-widest text-indigo-200 hover:text-white">{integration.action} ↗</a>
                ) : (
                  <Link href={integration.href} className="mt-5 inline-block font-mono text-[10px] uppercase tracking-widest text-indigo-200 hover:text-white">{integration.action} ↗</Link>
                )}
              </article>
            ))}
          </div>
        </section>

        <section id="benchmarks" className="mt-20 border border-zinc-800 bg-black/25 p-7 sm:p-10" aria-labelledby="benchmark-evidence">
          <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr]">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-widest text-emerald-300">[ Published operational evidence ]</p>
              <h2 id="benchmark-evidence" className="mt-4 text-3xl font-light text-white">Benchmarks state the boundary, not just the number.</h2>
              <p className="mt-5 text-sm leading-7 text-zinc-400">The reported GPU measurements are seven-run warm solver baselines on an NVIDIA A10G. They do not include HTTP latency or container cold starts, and heuristic results do not claim global optimality.</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Benchmark label="Tensor-network QUBO / Ising" value="80.840 ms" detail="Warm p95 at 256 variables and bond dimension 256; reviewed promotion threshold ≤150 ms." href="/tensor-opt" />
              <Benchmark label="Weighted SE(3) registration" value="108.604 ms" detail="Warm p95 at 16,384 paired points; reviewed promotion threshold ≤200 ms." href="/geometric-optimization" />
              <Benchmark label="MCRB-1 evidence retention" value={`${contextBm25.completeEvidenceSetPercent}%`} detail={`Complete human evidence-set retention at ${contextBm25.meanReductionPercent}% mean token reduction across ${contextRetention.dataset.cases} independently annotated QASPER questions.`} href="/benchmarks/context-retention" />
              <Benchmark label="Context compiler recipe" value={`${contextRecipe.result.reductionPercent}%`} detail="Executable four-chapter workload with 100% source participation and economics stated against the $0.001 x402 fee." href="/recipes/context-compiler-large-document" />
            </div>
          </div>
        </section>

        <section id="security" className="mt-20 border-t border-zinc-800 pt-12" aria-labelledby="security-model">
          <div className="grid gap-10 lg:grid-cols-2">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-widest text-cyan-300">[ Security and data boundary ]</p>
              <h2 id="security-model" className="mt-4 text-3xl font-light text-white">Minimize what crosses and what remains.</h2>
              <p className="mt-5 max-w-xl text-sm leading-7 text-zinc-400">Security claims are capability-specific. Review the API contract and deployment boundary before sending production, regulated, personal, or confidential data.</p>
            </div>
            <ul className="space-y-4 text-sm leading-7 text-zinc-300">
              <li className="border-l border-cyan-800 pl-4"><strong className="text-white">Tenant isolation:</strong> API credentials resolve to tenant-scoped resources; one tenant cannot enumerate another tenant&apos;s MCP servers.</li>
              <li className="border-l border-cyan-800 pl-4"><strong className="text-white">Bounded execution:</strong> request sizes, methods, tools, rates, timeouts, failure thresholds, and circuit cooldowns are server-validated.</li>
              <li className="border-l border-cyan-800 pl-4"><strong className="text-white">Credential handling:</strong> supported MCP upstream secrets are encrypted at rest and are never returned by listing or discovery APIs.</li>
              <li className="border-l border-cyan-800 pl-4"><strong className="text-white">Data minimization:</strong> context compilation returns source text and the compiled pack transiently; the gateway audit record excludes tool arguments and upstream response bodies.</li>
            </ul>
          </div>
          <div className="mt-8 flex flex-wrap gap-4 font-mono text-xs uppercase tracking-widest">
            <Link href="/guides/enterprise-mcp-governance" className="text-cyan-100 underline underline-offset-4 hover:text-white">Read the gateway security boundary ↗</Link>
            <Link href="/docs" className="text-zinc-400 underline underline-offset-4 hover:text-white">Inspect endpoint contracts ↗</Link>
          </div>
        </section>

        <section className="mt-20 border-t border-zinc-800 pt-12" aria-labelledby="implementation-guides">
          <p className="font-mono text-[10px] uppercase tracking-widest text-cyan-300">[ Evidence-grounded guides ]</p>
          <h2 id="implementation-guides" className="mt-4 text-3xl font-light text-white">Start from measured behavior and runnable controls.</h2>
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            <Guide href="/guides/context-compression-vs-conversation-summarization" title="Context compression vs. conversation summarization" detail="Choose by evidence and state-preservation requirements." />
            <Guide href="/guides/preserve-citations-reducing-llm-context" title="Preserve citations while reducing LLM context" detail="Validate source and passage identities after selection." />
            <Guide href="/guides/crewai-context-compression-provenance" title="CrewAI context compression with provenance" detail="Use the published Python adapter in a bounded research agent." />
            <Guide href="/guides/mcp-gateway-vs-direct-server" title="MCP gateway vs. direct server connections" detail="Compare destination, policy, credential, containment, and audit controls." />
          </div>
        </section>
      </div>
    </main>
  )
}

function Benchmark({ label, value, detail, href }: { label: string; value: string; detail: string; href: string }) {
  return (
    <article className="border border-zinc-800 p-5">
      <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">{label}</p>
      <p className="mt-3 font-mono text-2xl text-emerald-200">{value}</p>
      <p className="mt-3 text-xs leading-6 text-zinc-400">{detail}</p>
      <Link href={href} className="mt-5 inline-block font-mono text-[10px] uppercase tracking-widest text-zinc-300 hover:text-white">Review scope and limits ↗</Link>
    </article>
  )
}

function Guide({ href, title, detail }: { href: string; title: string; detail: string }) {
  return <Link href={href} className="border border-zinc-800 p-5 hover:border-cyan-700"><span className="text-lg text-white">{title}</span><span className="mt-2 block text-sm leading-6 text-zinc-400">{detail}</span></Link>
}
