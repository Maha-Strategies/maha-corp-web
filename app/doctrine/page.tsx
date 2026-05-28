import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Strategic Doctrine | Maha Strategies',
  description: 'Foundational frameworks and strategic research equipping elite actors to resist narrative capture and defend their cognitive baseline.',
  alternates: { canonical: 'https://www.mahastrategies.com/doctrine' },
}

export default function DoctrinePage() {
  return (
    <div className="min-h-screen bg-[#0a0a0c] text-zinc-300 font-sans p-8 md:p-24 selection:bg-indigo-500 selection:text-white">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-4xl text-white font-light tracking-wide mb-6 leading-tight">
          Intellectual Property & Foundational Doctrine
        </h1>
        
        <div className="prose prose-invert max-w-none font-light tracking-wide leading-relaxed">
          <p>
            Technology is useless if the mind operating it is compromised. As platforms weaponize algorithmic feedback loops, human cognitive agency is under unprecedented assault. 
          </p>
          <p>
            Through our intellectual property division, Maha Strategies publishes foundational frameworks, sovereign blueprints, and strategic research designed to equip elite actors to resist narrative capture.
          </p>

          <h2 className="text-2xl text-white font-light mt-12 mb-4">The Maha Principle</h2>
          <p>
            Our primary doctrine, <em>The Maha Principle: Reclaiming Biological Sovereignty</em>, is an 81,015-word strategic framework designed to reclaim the human biological and cognitive baseline from extractive industrial and technological systems.
          </p>
          <p>
            It establishes the theoretical architecture for Metabolic Sovereignty, Attentional Captivity, and the Nurturing Warrior archetype—the direct philosophy powering Maha OS.
          </p>

          {/* MANUSCRIPT GATEWAY INJECTION */}
          <a 
            href="https://publish.mahastrategies.com/read/introduction" 
            className="group block mt-8 p-6 border-l-4 border-indigo-500 bg-indigo-950/10 hover:bg-indigo-950/20 transition-colors no-underline"
          >
            <p className="font-mono text-xs text-indigo-400 mb-2 uppercase tracking-widest m-0">
              [ MANUSCRIPT VAULT // DECLASSIFIED ]
            </p>
            <h3 className="font-sans text-xl font-bold text-white uppercase m-0 mt-2">
              Read the Introduction
            </h3>
            <p className="font-serif text-sm text-zinc-400 italic mt-2 mb-0">
              Access the raw, unrestricted text on the Agentic Publishing Node.
            </p>
            <div className="mt-4 font-mono text-xs text-zinc-500 group-hover:text-white transition-colors">
              INITIALIZE TERMINAL ↗
            </div>
          </a>

          {/* STRATEGIC ARCHIVES / ESSAY ROUTING */}
          <h2 className="text-2xl text-white font-light mt-16 mb-6">Strategic Archives</h2>
          
          <Link href="/doctrine/replacing-willpower" className="group block p-6 border border-zinc-800 bg-black hover:border-zinc-500 transition-colors rounded-sm no-underline mb-12">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between">
              <div>
                <p className="font-mono text-xs text-indigo-500 mb-2 group-hover:text-indigo-400 transition-colors uppercase tracking-widest">
                  [ INTELLECTUAL PROPERTY // ARCHIVED ]
                </p>
                <h3 className="font-sans text-xl font-bold text-zinc-200 group-hover:text-white transition-colors uppercase m-0">
                  Replacing Willpower with Architecture
                </h3>
                <p className="font-serif text-sm text-zinc-400 italic mt-2 mb-0">
                  Quantizing Generative AI for Edge-Compute Interventions
                </p>
              </div>
              <div className="mt-4 sm:mt-0 font-mono text-sm text-zinc-600 group-hover:text-white transition-colors shrink-0">
                [ READ DOCUMENT ↗ ]
              </div>
            </div>
          </Link>

          <div className="mt-12 pt-8 border-t border-zinc-800">
            <h3 className="text-white text-xs uppercase tracking-widest font-semibold mb-4">Agentic Publishing Node</h3>
            <p className="text-sm text-zinc-500 mb-6">
              Access our AI-powered publishing tools, automated query letter generators, and the raw manuscript vault.
            </p>
            <a 
              href="https://publish.mahastrategies.com" 
              className="inline-block border border-zinc-500 text-zinc-300 px-8 py-3 text-xs font-bold uppercase tracking-widest hover:border-white hover:text-white transition-colors no-underline"
            >
              Initialize Publishing Terminal
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}