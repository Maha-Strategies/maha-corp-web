import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Method | Maha Strategies',
  description: 'How Maha Strategies produces decision-ready research: explicit scope, evidence tags, linked sources, and visible uncertainty.',
  alternates: { canonical: '/method' },
}

const tags = [
  ['SOURCED', 'Traceable to an identified source that readers can inspect.'],
  ['VERIFIED', 'Independently checked, recomputed, cross-referenced, or reproduced.'],
  ['ILLUSTRATIVE', 'An estimate or analogy used to clarify reasoning, not to establish a fact.'],
  ['UNVERIFIED', 'A claim that could not be confirmed within scope and is flagged rather than hidden.'],
]

export default function MethodPage() {
  return (
    <main className="evidence-page">
      <div className="evidence-container">
        <p className="evidence-kicker">[ Maha Strategies // Method ]</p>
        <h1 className="evidence-title evidence-title--product mt-4">Research that keeps uncertainty visible.</h1>
        <p className="evidence-lede mt-7">Maha Strategies produces decision-ready research for questions where a fluent answer is not enough. The work is scoped to the decision, not to a generic topic, and the evidence record stays visible in the document.</p>

        <section className="evidence-section">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <article className="evidence-card">
              <p className="evidence-kicker">01 · Scope</p>
              <p className="evidence-copy mt-4">We define the decision, the deadline, and the question before research begins. A narrow answer that changes a decision is more useful than broad coverage.</p>
            </article>
            <article className="evidence-card">
              <p className="evidence-kicker">02 · Evidence</p>
              <p className="evidence-copy mt-4">Substantive claims are connected to evidence, checked where scope permits, and separated from inference and illustration.</p>
            </article>
            <article className="evidence-card">
              <p className="evidence-kicker">03 · Correction</p>
              <p className="evidence-copy mt-4">When a conclusion changes, the correction belongs in the record. Public research is treated as an accountable body of work, not as a permanent marketing claim.</p>
            </article>
          </div>
        </section>

        <section className="evidence-section">
          <p className="evidence-kicker">[ The provenance tags ]</p>
          <div className="mt-7 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {tags.map(([tag, description]) => (
              <article key={tag} className="evidence-card">
                <p className="evidence-kicker">{tag}</p>
                <p className="evidence-copy mt-4">{description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="evidence-section">
          <p className="evidence-kicker">[ Put it to work ]</p>
          <h2 className="evidence-section-title mt-4">Inspect the standard. Then bring the question.</h2>
          <p className="evidence-copy mt-5 max-w-2xl">The Maha Provenance Standard explains the tagging system in detail. The live Auditor lets you test a passage. A Verified Research Brief applies the method to a live decision.</p>
          <div className="mt-7 flex flex-col gap-4 sm:flex-row">
            <Link href="/mps" className="evidence-action evidence-action--secondary">Read MPS/0.1 ↗</Link>
            <Link href="/audit" className="evidence-action evidence-action--secondary">Try the Auditor ↗</Link>
            <Link href="/consulting" className="evidence-action evidence-action--primary">Commission a Brief ↗</Link>
          </div>
        </section>
      </div>
    </main>
  )
}
