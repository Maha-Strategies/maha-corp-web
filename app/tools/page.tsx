import type { Metadata } from 'next'
import Link from 'next/link'

const SITE_URL = 'https://www.mahastrategies.com'

export const metadata: Metadata = {
  title: 'Tools & API | Maha Strategies',
  description: 'Focused self-service utilities from Maha Strategies: decision specification, receipt-to-CSV extraction, and prepaid MPS claim-audit API access.',
  alternates: { canonical: '/tools' },
  openGraph: {
    type: 'website',
    url: `${SITE_URL}/tools`,
    title: 'Tools & API | Maha Strategies',
    description: 'Self-service receipt extraction and scoped MPS claim-audit API access.',
  },
}

const tools = [
  {
    eyebrow: 'Tensor-Network Optimization',
    title: 'Solve bounded QUBO and Ising models on an A10G',
    body: 'Run a verified bounded-bond transfer-tensor heuristic with explicit exact and heuristic boundaries, asynchronous settlement, and published latency evidence.',
    href: '/tensor-opt',
    action: 'View tensor optimization',
    accent: 'cyan',
  },
  {
    eyebrow: 'Geometric Registration',
    title: 'Fit a rigid transform to paired 3D point clouds',
    body: 'Recover a weighted SE(3) rotation and translation with residual, determinant, and orthogonality checks on the production GPU job pipeline.',
    href: '/geometric-optimization',
    action: 'View geometric registration',
    accent: 'emerald',
  },
  {
    eyebrow: 'Architecture Readiness',
    title: 'Turn an AI implementation ambition into a gap register',
    body: 'Inventory data paths, device fleet, model lifecycle, identity and access, outage fallback, and accountability. Export a browser-local implementation sequence.',
    href: '/tools/architecture-readiness-assessment',
    action: 'Assess architecture readiness',
    accent: 'indigo',
  },
  {
    eyebrow: 'AI Boundary Planner',
    title: 'Turn an AI deployment choice into a reviewable record',
    body: 'Compare local, cloud, and hybrid boundaries using stated data, capability, latency, resilience, device, and ownership conditions. Export a browser-local decision record.',
    href: '/tools/ai-boundary-planner',
    action: 'Plan an AI boundary',
    accent: 'indigo',
  },
  {
    eyebrow: 'Constraint Studio',
    title: 'Turn a planning problem into a Constraint Pack',
    body: 'Specify objectives, variables, hard limits, preferences, assumptions, and data gaps. Export a browser-local JSON handoff for human review or future solver work.',
    href: '/tools/constraint-studio',
    action: 'Build a Constraint Pack',
    accent: 'cyan',
  },
  {
    eyebrow: 'Receipt → CSV',
    title: 'Extract a receipt batch into one clean CSV',
    body: 'Upload receipt photos, paste receipt text, or mix both. Try one receipt free before paying for a batch. If no submitted receipt can be parsed, the batch is refunded automatically.',
    href: '/utilities/receipts',
    action: 'Try receipt → CSV',
    accent: 'emerald',
  },
  {
    eyebrow: 'MPS audit API',
    title: 'Run scoped claim-level evidence audits',
    body: 'Purchase prepaid audit invocations and receive a credential that is limited to the MPS audit endpoint. There is no subscription and no access to internal services.',
    href: '/mps/audit-access',
    action: 'Get MPS audit access',
    accent: 'indigo',
  },
  {
    eyebrow: 'MCP bridge',
    title: 'Connect a local agent to documented Maha APIs',
    body: 'Install the local MCP bridge for authenticated MPS audit and book-access APIs. Human approval remains required for checkout.',
    href: '/mcp-bridge',
    action: 'Read MCP bridge guide',
    accent: 'cyan',
  },
] as const

export default function ToolsPage() {
  return (
    <main className="min-h-screen bg-[#0a0a0c] text-zinc-300 selection:bg-indigo-500 selection:text-white">
      <div className="mx-auto max-w-4xl px-6 py-20 sm:py-28">
        <header className="max-w-3xl border-l border-indigo-500 pl-6 sm:pl-8">
          <p className="mb-5 font-mono text-xs uppercase tracking-widest text-indigo-300">[ Maha Strategies // Tools &amp; API ]</p>
          <h1 className="mb-6 text-4xl font-light leading-[1.08] tracking-tight text-white sm:text-5xl md:text-6xl">Focused tools for a defined job.</h1>
          <p className="text-xl font-light leading-relaxed text-zinc-300 sm:text-2xl">
            Use a self-service tool when you need one bounded outcome—not a consulting engagement.
          </p>
          <p className="mt-5 text-base leading-relaxed text-zinc-400 sm:text-lg">
            Each product states its scope, limits, and payment flow before you commit. Consulting and research briefs remain separate services.
          </p>
        </header>

        <section className="mt-20 grid gap-5 md:grid-cols-2" aria-label="Maha Strategies self-service tools">
          {tools.map((tool) => {
            const accent = tool.accent === 'emerald' ? 'text-emerald-300 hover:border-emerald-500' : tool.accent === 'cyan' ? 'text-cyan-200 hover:border-cyan-500' : 'text-indigo-300 hover:border-indigo-400'
            return (
              <article key={tool.href} className={`flex min-h-full flex-col border border-zinc-800 p-6 transition-colors ${accent}`}>
                <p className="mb-4 font-mono text-[10px] uppercase tracking-widest">[ {tool.eyebrow} ]</p>
                <h2 className="text-xl leading-tight text-white">{tool.title}</h2>
                <p className="mt-4 flex-1 text-sm leading-relaxed text-zinc-400">{tool.body}</p>
                <Link href={tool.href} className="mt-7 font-mono text-xs uppercase tracking-widest text-zinc-200 hover:text-white">
                  {tool.action} ↗
                </Link>
              </article>
            )
          })}
        </section>

        <section className="mt-16 border-t border-zinc-800 pt-8">
          <p className="text-sm leading-relaxed text-zinc-400">
            Need a decision-ready research synthesis instead? <Link href="/consulting" className="text-indigo-200 underline underline-offset-4 hover:text-white">Explore Verified Research Briefs</Link> or <Link href="/rapid-intelligence-brief" className="text-indigo-200 underline underline-offset-4 hover:text-white">Rapid Intelligence Briefs</Link>.
          </p>
        </section>
      </div>
    </main>
  )
}
