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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16">
          
          {/* ACADEMIC SUBDOMAIN BLOCK */}
          <div className="p-8 border border-emerald-900/50 bg-emerald-950/10 flex flex-col justify-between">
            <div>
              <p className="text-xs text-emerald-400 tracking-widest uppercase mb-2 font-mono">
                [ ACADEMIC NODE ONLINE ]
              </p>
              <h2 className="text-2xl text-white font-light mb-3">
                Formal Publications
              </h2>
              <p className="text-sm text-zinc-400 mb-6">
                Our peer-reviewed protocols and rigorous systemic sovereignty research are actively hosted on our dedicated academic subdomain.
              </p>
            </div>
            
            <div className="space-y-4">
              <a 
                href="https://research.mahastrategies.com" 
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block border border-emerald-500 text-emerald-400 font-mono text-[10px] tracking-widest py-3 px-6 hover:bg-emerald-500 hover:text-white transition-colors uppercase w-full text-center"
              >
                Access Subdomain ↗
              </a>
              
              <div className="border-t border-emerald-900/50 pt-4 mt-4">
                <p className="text-[10px] text-zinc-500 font-mono tracking-widest uppercase mb-2">
                  LATEST PUBLICATION
                </p>
                <a 
                  href="https://research.mahastrategies.com/papers/thermodynamic-isomorphism"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group block"
                >
                  <h3 className="text-sm text-emerald-100 font-semibold group-hover:text-emerald-400 transition-colors">
                    Thermodynamic Isomorphism
                  </h3>
                  <span className="text-[10px] text-emerald-600/70 group-hover:text-emerald-400 font-mono transition-colors mt-1 block truncate">
                    Read Paper ↗
                  </span>
                </a>
              </div>
            </div>
          </div>

          {/* MCP INTEGRATION BLOCK */}
          <div className="p-8 border border-indigo-900/50 bg-indigo-950/10 flex flex-col justify-between">
            <div>
              <p className="text-xs text-indigo-400 tracking-widest uppercase mb-2 font-mono">
                [ ACTIVE INFRASTRUCTURE ]
              </p>
              <h2 className="text-2xl text-white font-light mb-3">
                Cognitive Defense Grid
              </h2>
              <p className="text-sm text-zinc-400 mb-6">
                Integrate the Maha Strategies sovereign baseline directly into your local Claude Desktop instance. Audit cloud infrastructure and retrieve protocols for Zero-Payload architecture in real-time.
              </p>
            </div>
            <div>
              <Link 
                href="/research/mcp" 
                className="inline-block border border-indigo-500 text-indigo-400 font-mono text-[10px] tracking-widest py-3 px-6 hover:bg-indigo-500 hover:text-white transition-colors uppercase w-full text-center"
              >
                Initialize Terminal (MCP) ↗
              </Link>
            </div>
          </div>
          
        </div>

        {/* PREPRINTS LIST */}
        <div className="space-y-8">
          <h2 className="text-xs text-zinc-500 tracking-widest uppercase font-mono border-b border-zinc-800 pb-4">
            [ ARCHIVAL PREPRINTS ]
          </h2>
          {preprints.map((paper, index) => (
            <div key={index} className="pt-4 group">
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