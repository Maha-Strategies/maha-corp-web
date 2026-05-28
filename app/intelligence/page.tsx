import React from 'react';
import Link from 'next/link';

export const metadata = {
  title: 'Intelligence | Maha Strategies LLC',
  description: 'Active market intelligence, structural audits, and proprietary geopolitical analysis.',
};

export default function IntelligenceGrid() {
  return (
    <main className="min-h-screen bg-[#0a0a0c] text-[#e0e0e0] py-16 px-6 sm:px-12 selection:bg-indigo-500 selection:text-white">
      <div className="max-w-4xl mx-auto">
        
        {/* HEADER */}
        <header className="mb-12 border-b border-gray-800 pb-8">
          <h1 className="font-sans text-3xl sm:text-4xl font-bold uppercase tracking-tight text-white mb-2">
            Active Intelligence
          </h1>
          <p className="font-mono text-sm text-gray-500 tracking-widest uppercase">
            [ Flash-Opinions // Structural Audits // Market Signals ]
          </p>
        </header>

        {/* THE GRID */}
        <div className="grid grid-cols-1 gap-6">
          
          {/* SEMICONDUCTOR BRIEF NODE */}
          <Link 
            href="/intelligence/briefs/semiconductor-bifurcation" 
            className="block p-8 border border-zinc-800 bg-black hover:border-indigo-500 transition-colors group"
          >
            <div className="flex justify-between items-start mb-4">
              <p className="font-mono text-[10px] sm:text-xs text-red-400 tracking-widest uppercase">
                STATUS: CRITICAL PRIORITY
              </p>
              <span className="text-gray-600 font-mono text-xs group-hover:text-indigo-400 transition-colors">
                [ READ ↗ ]
              </span>
            </div>
            
            <h2 className="font-sans text-2xl font-bold text-white group-hover:text-indigo-300 transition-colors uppercase tracking-tight mb-2">
              The Bifurcation of Silicon
            </h2>
            
            <p className="font-serif text-gray-400 leading-relaxed max-w-2xl">
              An intelligence brief on the structural shift from open innovation to secure, sovereign semiconductor supply chains in the wake of geopolitical friction.
            </p>
          </Link>
          {/* NODE: PHYSICAL AI BRIEF */}
<Link 
  href="/intelligence/briefs/physical-ai-deployment" 
  className="block p-8 border border-zinc-800 bg-black hover:border-indigo-500 transition-colors group"
>
  <div className="flex justify-between items-start mb-4">
    <p className="font-mono text-[10px] sm:text-xs text-yellow-500 tracking-widest uppercase">
      STATUS: STRUCTURAL SHIFT
    </p>
    <span className="text-gray-600 font-mono text-xs group-hover:text-indigo-400 transition-colors">
      [ READ ↗ ]
    </span>
  </div>
  
  <h2 className="font-sans text-2xl font-bold text-white group-hover:text-indigo-300 transition-colors uppercase tracking-tight mb-2">
    Embodied Intelligence
  </h2>
  
  <p className="font-serif text-gray-400 leading-relaxed max-w-2xl">
    An intelligence brief on the transition to Vision-Language-Action (VLA) models, edge-compute scaling, and the geopolitical moats of localized hardware processing.
  </p>
</Link>
{/* NODE: ALGORITHMIC LOCK-IN BRIEF */}
<Link 
  href="/intelligence/briefs/algorithmic-lock-in" 
  className="block p-8 border border-zinc-800 bg-black hover:border-indigo-500 transition-colors group"
>
  <div className="flex justify-between items-start mb-4">
    <p className="font-mono text-[10px] sm:text-xs text-fuchsia-500 tracking-widest uppercase">
      STATUS: BEHAVIORAL CAPTURE
    </p>
    <span className="text-gray-600 font-mono text-xs group-hover:text-indigo-400 transition-colors">
      [ READ ↗ ]
    </span>
  </div>
  
  <h2 className="font-sans text-2xl font-bold text-white group-hover:text-indigo-300 transition-colors uppercase tracking-tight mb-2">
    Algorithmic Lock-In
  </h2>
  
  <p className="font-serif text-gray-400 leading-relaxed max-w-2xl">
    An intelligence brief on digital native behavioral loops, social currency in mobile gaming ecosystems, and vectors of cognitive capture.
  </p>
</Link>
          
          {/* FUTURE NODES CAN GO HERE */}

        </div>
      </div>
    </main>
  );
}