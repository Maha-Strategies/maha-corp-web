import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Research & Doctrine | Maha Strategies',
  description: 'Foundational research, preprints, and structural frameworks on custom silicon strategy, edge architecture, and biological sovereignty.',
  alternates: { canonical: 'https://www.mahastrategies.com/research' },
}

const preprints = [
  {
    title: 'The Sovereign Edge: Biological Sovereignty and the Financial Inevitability of Zero-Payload Architecture',
    slug: 'the-sovereign-edge',
    date: 'April 28, 2026'
  },
  {
    title: 'Structural Fragility in the Global Semiconductor Matrix: Lithographic Chokepoints',
    slug: 'structural-fragility-semiconductor-matrix',
    date: 'April 8, 2026'
  },
  {
    title: 'Decentralized Edge Architecture: Latency Optimization and Hardware Integration',
    slug: 'decentralized-edge-architecture',
    date: 'February 26, 2026'
  },
  {
    title: 'The Thermodynamic Wall of Generative AI: Compute as Metabolism',
    slug: 'thermodynamic-wall-generative-ai',
    date: 'February 26, 2026'
  },
  {
    title: 'Chronobiological Entrainment as a Primary Modality for Endocrine Homeostasis',
    slug: 'chronobiological-entrainment-endocrine-homeostasis',
    href: 'https://research.mahastrategies.com/papers/chronobiological-entrainment',
    external: true,
    date: 'February 26, 2026'
  }
];

export default function ResearchIndex() {
  return (
    <main className="evidence-page">
      <div className="evidence-container evidence-container--narrow">
        <section className="evidence-section">
          <Link href="/" className="evidence-link inline-flex">
            ← Back to root
          </Link>
          <p className="evidence-kicker mt-4">[ Research & Open Science ]</p>
          <h1 className="evidence-title">Research & Open Science</h1>
          <p className="evidence-lede mt-7">
            The theoretical architecture powering Maha Strategies LLC. Manuscripts and syntheses here are foundational doctrine for custom
            silicon strategy, sovereign digital infrastructure, and cognitive defense protocols.
          </p>
        </section>

        <section className="evidence-section">
          <div className="grid gap-4 md:grid-cols-2">
            <article className="evidence-card">
              <p className="evidence-kicker">[ Research node ]</p>
              <p className="evidence-card-title mt-3">Research Syntheses</p>
              <p className="evidence-card-copy mt-3">
                Cross-disciplinary syntheses and systemic sovereignty research are hosted on our dedicated research subdomain. These are openly
                labeled, AI-assisted hypotheses and frameworks — not peer-reviewed conclusions.
              </p>
              <a
                href="https://research.mahastrategies.com"
                target="_blank"
                rel="noopener noreferrer"
                className="evidence-link mt-6 inline-block"
              >
                Access subdomain ↗
              </a>
              <a
                href="https://research.mahastrategies.com/papers/thermodynamic-isomorphism"
                target="_blank"
                rel="noopener noreferrer"
                className="evidence-link mt-3 inline-block"
              >
                Latest publication: Thermodynamic Isomorphism ↗
              </a>
            </article>

            <article className="evidence-card">
              <p className="evidence-kicker">[ Active infrastructure ]</p>
              <p className="evidence-card-title mt-3">Cognitive Defense Grid</p>
              <p className="evidence-card-copy mt-3">
                Integrate the Maha Strategies sovereign baseline directly into your local Claude Desktop instance. Audit cloud infrastructure and
                retrieve protocols for zero-payload architecture in real time.
              </p>
              <Link href="/research/mcp" className="evidence-link mt-6 inline-block">
                Initialize MCP terminal ↗
              </Link>
            </article>
          </div>
        </section>

        <section className="evidence-section">
          <p className="evidence-kicker">[ Archival preprints ]</p>
          <div className="mt-4 space-y-4">
            {preprints.map((paper) => (
              <article key={paper.slug ?? paper.title} className="evidence-card">
                <p className="evidence-kicker">{paper.date}</p>
                <h2 className="evidence-card-title mt-3">
                  {paper.external ? (
                    <a href={paper.href} target="_blank" rel="noopener noreferrer">
                      {paper.title}
                    </a>
                  ) : (
                    <Link href={`/research/${paper.slug}`}>{paper.title}</Link>
                  )}
                </h2>
                {paper.external ? (
                  <a href={paper.href} target="_blank" rel="noopener noreferrer" className="evidence-link mt-3 inline-block">
                    Read on research subdomain ↗
                  </a>
                ) : (
                  <Link href={`/research/${paper.slug}`} className="evidence-link mt-3 inline-block">
                    Read manuscript ↗
                  </Link>
                )}
              </article>
            ))}
          </div>
        </section>
      </div>
    </main>
  )
}
