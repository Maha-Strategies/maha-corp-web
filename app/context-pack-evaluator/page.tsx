import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Context Pack Evaluator | Evidence Retention Measurement',
  description: 'Measure context efficiency while testing whether named evidence survives bounded compilation.',
  alternates: { canonical: '/context-pack-evaluator' },
}

const stages = [
  ['01 · Declare', 'Provide source documents, a task, and a token budget—then name the exact evidence spans that must survive.'],
  ['02 · Compile', 'The deterministic compiler ranks, deduplicates, and bounds context. No model grades the supplied material.'],
  ['03 · Report', 'Receive token and byte metrics, source coverage, duplicate removal, and retained-or-omitted results for every declared span.'],
] as const

export default function ContextPackEvaluatorPage() {
  return (
    <main className="evidence-page">
      <div className="evidence-container evidence-container--narrow">
        <header className="border-t border-[var(--border-default)] pt-5">
          <p className="evidence-kicker flex flex-wrap justify-between gap-3"><span>Context Pack Evaluator</span><span>Declared evidence · deterministic measurement</span></p>
          <h1 className="evidence-title evidence-title--product">Measure the context reduction. Test what evidence survived.</h1>
          <p className="evidence-lede mt-7">Define the passages a workflow must retain, then test a bounded Context Pack against that requirement instead of accepting a compression claim on faith.</p>
          <p className="evidence-copy mt-5">The evaluator makes the scope of a result explicit: task, token budget, sources, required evidence, and what did or did not appear in the compiled pack.</p>
          <div className="mt-9 flex flex-wrap gap-3">
            <a className="evidence-action evidence-action--primary" href="/context-pack-evaluation-schema.json">Read evaluation schema ↗</a>
            <Link className="evidence-action evidence-action--secondary" href="/benchmarks/context-retention">Review published benchmark ↗</Link>
          </div>
        </header>

        <section className="evidence-section" aria-labelledby="method-heading">
          <p className="evidence-kicker">Evaluation method</p>
          <h2 id="method-heading" className="evidence-section-title mt-4">Three things a credible compression result needs.</h2>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {stages.map(([label, body]) => (
              <article key={label} className="evidence-card">
                <p className="evidence-kicker">{label}</p>
                <p className="evidence-card-copy mt-4">{body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="evidence-section evidence-inset" aria-labelledby="meaning-heading">
          <p className="evidence-kicker text-[var(--status-sourced)]">Result boundary</p>
          <h2 id="meaning-heading" className="evidence-section-title mt-4 text-2xl">Retained is a traceability result, not a truth claim.</h2>
          <p className="evidence-copy mt-4 text-sm"><strong>Retained</strong> means the exact required span appears in an included passage from its declared source. <strong>Omitted</strong> means it does not. Neither result establishes factual accuracy, model-answer quality, legal compliance, or downstream hallucination behavior.</p>
        </section>

        <section className="evidence-section" aria-labelledby="assessment-heading">
          <p className="evidence-kicker">Use in an assessment</p>
          <h2 id="assessment-heading" className="evidence-section-title mt-4">Compare a real workflow before adopting new infrastructure.</h2>
          <p className="evidence-copy mt-5">Repeat the evaluation on a representative, sanitized corpus. Publish the task, budget, source count, evidence definition, and measured results. Do not generalize one benchmark into a universal savings or quality promise.</p>
          <div className="mt-7 flex flex-wrap gap-4 font-mono text-xs uppercase tracking-widest">
            <a className="evidence-link" href="/api/docs/openapi">OpenAPI contract ↗</a>
            <a className="evidence-link" href="https://github.com/Maha-Strategies/maha-corp-web/tree/main/.github/actions/maha-context-evidence" target="_blank" rel="noopener noreferrer">GitHub Action ↗</a>
            <Link className="evidence-link" href="/context-compiler">Context Compiler ↗</Link>
            <Link className="evidence-link" href="/consulting/ai-infrastructure">Context Control assessment ↗</Link>
          </div>
        </section>
      </div>
    </main>
  )
}
