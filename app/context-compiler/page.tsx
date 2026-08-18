import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Maha Context Compiler | Measured AI Context Efficiency',
  description: 'Compile raw documents into source-linked Context Packs with transparent, model-neutral efficiency measurements.',
  alternates: { canonical: '/context-compiler' },
}

const machineLinks = [
  { href: '/recipes/bazaar-discovery-to-payment', label: 'Run discovery-to-payment' },
  { href: '/benchmarks/context-retention', label: 'Review MCRB-1 benchmark' },
  { href: '/recipes/context-compiler-large-document', label: 'Run the measured workload' },
  { href: '/context-pack-schema.json', label: 'Read request schema', anchor: true },
  { href: '/api/docs/openapi', label: 'OpenAPI contract', anchor: true },
  { href: '/.well-known/maha/offer-selection.json', label: 'Machine-readable offer guide', anchor: true },
  { href: '/enterprise-mcp-gateway', label: 'Enterprise MCP Gateway' },
] as const

export default function ContextCompilerPage() {
  return (
    <main className="evidence-page">
      <div className="evidence-container evidence-container--narrow">
        <header className="border-t border-[var(--border-default)] pt-5">
          <p className="evidence-kicker flex flex-wrap justify-between gap-3"><span>Context Compiler</span><span>Deterministic · source-linked · model-neutral</span></p>
          <h1 className="evidence-title evidence-title--product">Give agents less context. Keep the evidence path.</h1>
          <p className="evidence-lede mt-7">Turn bounded raw documents into a task-specific Context Pack with deduplicated passages, source references, stable hashes, and transparent before-and-after measurements.</p>
          <p className="evidence-copy mt-5">The compiler is deterministic middleware, not a model wrapper. It reduces what reaches the model while preserving an inspectable relationship to the supplied sources.</p>
          <div className="mt-9 flex flex-wrap gap-3"><Link className="evidence-action evidence-action--primary" href="/context-compiler/playground">Try sample documents ↗</Link><Link className="evidence-action evidence-action--secondary" href="/benchmarks/context-retention">See the benchmark ↗</Link></div>
        </header>

        <section className="mt-12 grid gap-4 md:grid-cols-3" aria-label="Context compiler capabilities">
          <Card label="01 · Measure" body="Record original and compiled bytes, model-neutral estimated tokens, reduction percentage, source coverage, and duplicates removed." />
          <Card label="02 · Trace" body="Every included passage points to a source ID, passage position, and content hash. The original document is never stored." />
          <Card label="03 · Constrain" body="Set a context budget and explicit task. Passages that do not fit are excluded visibly rather than silently overflowing the prompt." />
        </section>

        <section className="evidence-section" aria-labelledby="boundaries-heading">
          <div className="border-l-[3px] border-[var(--status-boundary)] bg-[rgba(160,111,20,0.08)] p-6 sm:p-8">
            <p className="evidence-kicker text-[var(--status-boundary)]">Declared boundary</p><h2 id="boundaries-heading" className="evidence-section-title mt-4 text-2xl">What this release does not claim</h2>
            <p className="evidence-copy mt-4 text-sm">It does not promise a fixed percentage reduction, exact provider token counts, complete source coverage, factual verification, or hallucination prevention. Those are workload-specific outcomes to measure. Use <Link href="/mps" className="evidence-link">MPS</Link> when consequential claims need a separate provenance review.</p>
          </div>
        </section>

        <section className="evidence-section" aria-labelledby="machine-integration-heading">
          <p className="evidence-kicker">Machine integration</p><h2 id="machine-integration-heading" className="evidence-section-title mt-4">A bounded contract for human and autonomous buyers.</h2>
          <p className="evidence-copy mt-5">API-key clients or autonomous x402 buyers call the Context Pack API with a task, a token budget, and 1–8 textual sources. The response is returned directly; the service retains only a privacy-safe outcome ledger, not source text or the compiled pack.</p>
          <div className="mt-7 grid gap-3 sm:grid-cols-2">{machineLinks.map((item) => 'anchor' in item ? <a key={item.href} className="evidence-card evidence-kicker text-[var(--text-primary)]" href={item.href}>{item.label} ↗</a> : <Link key={item.href} className="evidence-card evidence-kicker text-[var(--text-primary)]" href={item.href}>{item.label} ↗</Link>)}</div>
        </section>

        <section className="evidence-section" aria-labelledby="guides-heading">
          <p className="evidence-kicker">Implementation guides</p><h2 id="guides-heading" className="evidence-section-title mt-4">Reproduce the method before trusting the result.</h2>
          <div className="mt-7 grid gap-3 sm:grid-cols-2"><GuideLink href="/guides/context-compression-vs-conversation-summarization" title="Compression vs. conversation summarization" /><GuideLink href="/guides/preserve-citations-reducing-llm-context" title="Preserve citations while reducing context" /><GuideLink href="/guides/crewai-context-compression-provenance" title="CrewAI compression with provenance" /><GuideLink href="/benchmarks/context-retention" title="MCRB-1 methodology and raw results" /></div>
        </section>

        <section className="evidence-section" aria-labelledby="system-heading">
          <p className="evidence-kicker">System relationship</p><h2 id="system-heading" className="evidence-section-title mt-4">The portable evidence object between Maha&apos;s controls.</h2>
          <p className="evidence-copy mt-5">MPS can review consequential claims in a Context Pack; the Enterprise MCP Gateway can restrict which tools receive it; and the commercial ledger can measure where compact, source-linked context is actually used.</p>
        </section>
      </div>
    </main>
  )
}

function Card({ label, body }: { label: string; body: string }) {
  return <article className="evidence-card"><p className="evidence-kicker">{label}</p><p className="evidence-card-copy mt-4">{body}</p></article>
}

function GuideLink({ href, title }: { href: string; title: string }) {
  return <Link href={href} className="evidence-card evidence-card-copy text-[var(--text-primary)]">{title} →</Link>
}
