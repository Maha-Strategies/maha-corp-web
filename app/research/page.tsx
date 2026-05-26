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
    date: 'February 26, 2026'
  }
];

export default function ResearchIndex() {
  return (
    <div className="min-h-screen bg-[#0a0a0c] text-zinc-300 font-sans p-8 md:p-24 selection:bg-indigo-500 selection:text-white">
      <div className="max-w-4xl mx-auto">
        <Link href="/" className="text-xs text-zinc-500 uppercase tracking-widest hover:text-white mb-8 block">← Back to Root Node</Link>
        
        <h1 className="text-4xl text-white font-light tracking-wide mb-6 leading-tight">
          Research & Open Science
        </h1>
        
        <div className="prose prose-invert max-w-none font-light tracking-wide leading-relaxed mb-16">
          <p className="text-xl text-zinc-400">
            The theoretical architecture powering Maha Strategies LLC. The manuscripts archived here serve as the foundational doctrine for our custom silicon strategy, sovereign digital infrastructure, and cognitive defense protocols. 
          </p>
        </div>

        <div className="space-y-8">
          {preprints.map((paper, index) => (
            <div key={index} className="border-t border-zinc-800 pt-8 group">
              <p className="text-xs text-zinc-500 tracking-widest uppercase mb-3">{paper.date}</p>
              <h2 className="text-2xl text-white font-light mb-4 group-hover:text-indigo-400 transition-colors">
                <Link href={`/research/${paper.slug}`}>
                  {paper.title}
                </Link>
              </h2>
              <Link 
                href={`/research/${paper.slug}`}
                className="text-sm font-semibold tracking-widest uppercase text-zinc-400 hover:text-white transition-colors"
              >
                Read Manuscript →
              </Link>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}