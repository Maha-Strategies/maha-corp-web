import type { Metadata } from 'next'

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
            Our primary doctrine, <em>The Maha Principle: Architecting Personal and National Renewal</em>, is a 95,000-word strategic framework designed to reclaim the human biological and cognitive baseline from extractive industrial and technological systems.
          </p>
          <p>
            It establishes the theoretical architecture for Metabolic Sovereignty, Attentional Captivity, and the Nurturing Warrior archetype—the direct philosophy powering Maha OS.
          </p>

          <div className="mt-12 pt-8 border-t border-zinc-800">
            <h3 className="text-white text-xs uppercase tracking-widest font-semibold mb-4">Agentic Publishing Node</h3>
            <p className="text-sm text-zinc-500 mb-6">
              Access our AI-powered publishing tools, automated query letter generators, and the raw manuscript vault.
            </p>
            <a 
              href="https://publish.mahastrategies.com" 
              className="inline-block border border-zinc-500 text-zinc-300 px-8 py-3 text-xs font-bold uppercase tracking-widest hover:border-white hover:text-white transition-colors"
            >
              Initialize Publishing Terminal
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}