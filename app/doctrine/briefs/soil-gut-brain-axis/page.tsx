'use client';

import React from 'react';
import Link from 'next/link';

export default function SoilGutBrainBrief() {
  // VECTOR B: SCHEMA.ORG JSON-LD STRUCTURAL METADATA
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: 'The Soil-Gut-Brain Axis',
    description: 'A tactical brief on biological sovereignty, the microbiome, and the consequences of industrialized agriculture.',
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
    datePublished: '2026-01-29T00:00:00.000Z',
    dateModified: '2026-05-28T00:00:00.000Z',
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': 'https://www.mahastrategies.com/doctrine/briefs/soil-gut-brain-axis'
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
              The Soil-Gut-Brain Axis
            </h1>
            
            <p className="font-mono text-sm text-indigo-400 mb-12 uppercase tracking-widest not-prose">
              ORIGIN: JANUARY 29, 2026
            </p>

            <h2 className="text-2xl text-white font-sans uppercase tracking-widest border-l-2 border-indigo-500 pl-4 mt-8 mb-6 not-prose">
              Where the Sickness Starts
            </h2>
            <p>
              The deterioration of the body did not begin in a factory. It began in the ground.
            </p>
            <p>
              For most of human agricultural history, farming was a partnership with biological processes — organic matter decomposed, soil communities of bacteria and fungi thrived, and plants grown in that ecosystem absorbed a dense spectrum of minerals. In the twentieth century, we replaced that partnership with industrial chemistry. We stopped treating soil as a living system and started treating it as an inert medium to be saturated with synthetic inputs.
            </p>

            <h3 className="text-xl text-white font-sans font-bold uppercase tracking-widest mt-12 mb-4">
              The Death of the Soil
            </h3>
            <p>
              The primary herbicide in modern industrial agriculture is glyphosate, the active ingredient in Roundup. Its mechanism targets a metabolic pathway found in plants and bacteria — the shikimate pathway — used to synthesize essential amino acids.
            </p>
            <p>
              The standard industry defense is that this pathway does not exist in human cells, and therefore glyphosate poses no direct threat to human biology. This defense is technically accurate and strategically incomplete. Human cells do not use the shikimate pathway. Human gut bacteria do.
            </p>
            <p>
              The microbiome — the community of roughly 38 trillion bacteria living in your intestinal tract — relies extensively on this pathway. Animal studies and emerging human data suggest that chronic low-level glyphosate exposure may affect the composition and function of gut microbial communities, though the full clinical significance at typical human dietary exposure levels remains an active area of research. What is documented — though the specific causal mechanisms remain under active investigation — is the broader correlation: the industrial food supply has coincided with a measurable decline in gut microbiome diversity across Western populations, and that decline tracks with the rise of inflammatory and metabolic disease.
            </p>
            <p>
              Simultaneously, the obsession with yield has produced what researchers call nutrient dilution. Synthetic fertilizers — nitrogen, phosphorus, potassium — force rapid, water-heavy crop growth that does not require the plant to develop an extensive root system or draw trace minerals from deep soil. A study published in the Journal of the American College of Nutrition, analyzing USDA nutritional data from 1950 to 1999, found measurable declines in protein, calcium, iron, and key vitamins across 43 garden crops — with some mineral densities down by more than 30% over that period.
            </p>
            
            <div className="p-6 my-8 border border-gray-800 bg-black/40 not-prose">
              <p className="font-sans font-bold text-lg text-white mb-0">
                We are eating caloric ghosts. 
              </p>
              <p className="font-serif text-gray-400 mt-2">
                The volume of food is present. The nutritional information it carries is not. We are overfed and undernourished — drowning in calories, gasping for nutrients.
              </p>
            </div>
            
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