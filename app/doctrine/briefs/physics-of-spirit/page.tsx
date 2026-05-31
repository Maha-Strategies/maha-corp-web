'use client';

import React from 'react';
import Link from 'next/link';

export default function PhysicsOfSpiritBrief() {
  // VECTOR B: SCHEMA.ORG JSON-LD STRUCTURAL METADATA
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: 'The Physics of Spirit',
    description: 'A tactical brief redefining spirit through the lens of thermodynamics, entropy, and biological negentropy.',
    author: {
      '@type': 'Organization',
      name: 'Maha Strategies LLC',
      url: 'https://www.mahastrategies.com'
    },
    publisher: {
      '@type': 'Organization',
      name: 'Maha Strategies LLC',
      logo: {
        '@type': 'ImageObject',
        url: 'https://www.mahastrategies.com/logo.png'
      }
    },
    datePublished: '2026-02-14T00:00:00.000Z',
    dateModified: '2026-05-31T00:00:00.000Z',
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': 'https://www.mahastrategies.com/doctrine/briefs/physics-of-spirit'
    }
  };

  return (
    <main className="min-h-screen bg-[#0a0a0c] text-[#e0e0e0] py-16 px-6 sm:px-12 selection:bg-indigo-500 selection:text-white">
      {/* INJECT SCHEMA ENGINE INTO THE DOM */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div className="max-w-6xl mx-auto">
        
        {/* HEADER */}
        <header className="font-mono text-xs sm:text-sm text-gray-500 mb-12 border-b border-gray-800 pb-4 flex justify-between">
          <span>[ TACTICAL BRIEF // ARCHIVED DISPATCH ]</span>
          <span className="text-indigo-400">STATUS: DEPLOYED</span>
        </header>

        {/* TWO-COLUMN ARCHITECTURE */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12 lg:gap-16">
          
          {/* COLUMN 1: THE INTELLECTUAL PROPERTY */}
          <article className="lg:col-span-2 prose prose-invert prose-lg font-serif leading-relaxed text-gray-300 max-w-none">
            
            <h1 className="font-sans text-3xl sm:text-5xl font-bold tracking-tight mb-4 text-white uppercase not-prose">
              The Physics of Spirit
            </h1>
            
            <p className="font-mono text-sm text-indigo-400 mb-12 uppercase tracking-widest not-prose">
              ORIGIN: FEBRUARY 14, 2026
            </p>

            <h2 className="text-2xl text-white font-sans uppercase tracking-widest border-l-2 border-indigo-500 pl-4 mt-8 mb-6 not-prose">
              Why Connection Is Not Optional
            </h2>
            <p>
              We can now offer a more precise definition of what we mean by spirit — one that does not require metaphysical assumptions to accept.
            </p>
            <p>
              In thermodynamics, entropy is the tendency of the universe toward disorder — the slow dissolution of structure into heat, noise, and chaos. Negentropy is the counterforce: the energy required to build and maintain order against that dissolution.
            </p>
            <p>
              Biology is negentropy made physical. Your mitochondria take the chaos of raw nutrients and organize them into the structured complexity of a living cell.
            </p>

            <h3 className="text-xl text-white font-sans font-bold uppercase tracking-widest mt-12 mb-4">
              Negentropy at the Highest Order
            </h3>
            <p>
              Spirit is negentropy operating at its highest order. It is the specific force required to take the chaos of impulse, fear, and competing desire and organize them into the durable structures of art, justice, memory, and community. 
            </p>
            <p>
              It is what allows a human being to forgive a betrayal, to keep a promise when breaking it would be easier, to build something that will outlast them. These are not sentimental capacities. They are the precise mechanisms by which civilization accumulates rather than dissolves.
            </p>

            <div className="p-6 my-8 border border-gray-800 bg-black/40 not-prose">
              <p className="font-sans font-bold text-lg text-white mb-0">
                The unified chain runs in one direction. 
              </p>
              <p className="font-serif text-gray-400 mt-2">
                Efficient mitochondria generate surplus energy. A clear and directed mind channels that energy without leaking it. The spirit uses that focused surplus to impose durable form onto the world — to build a family, hold a principle, create something that carries meaning beyond the moment. Each layer depends on the one beneath it.
              </p>
            </div>

            <h3 className="text-xl text-white font-sans font-bold uppercase tracking-widest mt-12 mb-4">
              The Downstream Consequence
            </h3>
            <p>
              A strong spirit is not a mystical gift distributed unevenly at birth. It is the downstream consequence of a system that generates enough surplus — biological, cognitive, and relational — to fight entropy at the highest level. 
            </p>
            <p>
              This is why you repair the body (refer to the structural breakdown in <Link href="/doctrine/briefs/soil-gut-brain-axis" className="text-indigo-400 hover:text-indigo-300 underline decoration-indigo-500/30 underline-offset-4 transition-colors">The Soil-Gut-Brain Axis</Link>), guard the attention, and rebuild the community. Not as separate projects, but as a single cascade.
            </p>
            
          </article>

          {/* COLUMN 2: THE CONVERSION SIDEBAR (STICKY) */}
          <aside className="lg:col-span-1">
            <div className="sticky top-12 space-y-8">
              
              {/* VECTOR 1: DOCTRINE HUB */}
              <div className="p-6 border border-gray-800 bg-black">
                <h3 className="font-sans text-sm font-bold text-white uppercase tracking-widest mb-2">The Sovereign Grid</h3>
                <p className="font-serif text-xs text-gray-400 mb-4">
                  Access the full architectural framework, including the 81,015-word manuscript of The Maha Principle.
                </p>
                <Link href="/doctrine" className="block text-center border border-gray-600 bg-gray-900 text-white font-mono text-[10px] tracking-widest py-3 hover:bg-white hover:text-black transition-colors uppercase">
                  Initialize Vault ↗
                </Link>
              </div>

              {/* VECTOR 2: MAHA OS */}
              <div className="p-6 border border-indigo-900/50 bg-indigo-950/10">
                <h3 className="font-sans text-sm font-bold text-indigo-400 uppercase tracking-widest mb-2">Maha OS Alpha</h3>
                <p className="font-serif text-xs text-gray-400 mb-4">
                  Deploy the structural defense grid to your local device. Enforce the Zero-Payload Policy.
                </p>
                <a href="https://play.google.com/store/apps/details?id=com.mahastrategies.os" target="_blank" rel="noopener noreferrer" className="block text-center border border-indigo-500 text-indigo-400 font-mono text-[10px] tracking-widest py-3 hover:bg-indigo-500 hover:text-white transition-colors uppercase">
                  Download Client ↓
                </a>
              </div>

            </div>
          </aside>

        </div>
        
        {/* INTERNAL MESH */}
        <div className="mt-20 pt-8 border-t border-gray-900 text-center">
          <Link href="/doctrine" className="font-mono text-xs text-gray-600 hover:text-white transition-colors uppercase tracking-widest">
            [ ← Return to Doctrine Hub ]
          </Link>
        </div>

      </div>
    </main>
  );
}