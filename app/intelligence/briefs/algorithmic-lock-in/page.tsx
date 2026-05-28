'use client';

import React from 'react';
import Link from 'next/link';

export default function AlgorithmicLockInBrief() {
  // SCHEMA ENGINE: INTELLIGENCE REPORT
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: 'Algorithmic Lock-In: The Mobile Attention Economy',
    description: 'An intelligence brief on digital native behavioral loops, social currency in mobile gaming, and cognitive capture.',
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
    datePublished: new Date().toISOString(),
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': 'https://www.mahastrategies.com/intelligence/briefs/algorithmic-lock-in'
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
          <span>[ INTELLIGENCE BRIEF // ACTIVE AUDIT ]</span>
          <span className="text-fuchsia-500">STATUS: BEHAVIORAL CAPTURE</span>
        </header>

        {/* TWO-COLUMN ARCHITECTURE */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12 lg:gap-16">
          
          {/* COLUMN 1: THE INTELLECTUAL PROPERTY */}
          <article className="lg:col-span-2 prose prose-invert prose-lg font-serif leading-relaxed text-gray-300 max-w-none">
            
            <h1 className="font-sans text-3xl sm:text-5xl font-bold tracking-tight mb-4 text-white uppercase not-prose">
              Algorithmic Lock-In
            </h1>
            
            <p className="font-mono text-sm text-indigo-400 mb-12 uppercase tracking-widest not-prose">
              COGNITIVE CAPTURE // SOCIAL CURRENCY // GAMIFICATION
            </p>

            <h2 className="text-2xl text-white font-sans uppercase tracking-widest border-l-2 border-indigo-500 pl-4 mt-8 mb-6 not-prose">
              The Mobile Baseline
            </h2>
            <p>
              In urban centers across Asia, mobile devices have not merely leapfrogged traditional consoles; they have become the primary structural architecture for youth social hierarchies. Teenagers in these regions are absolute digital natives, resulting in some of the highest smartphone integration rates globally. 
            </p>
            <p>
              Gaming is no longer a peripheral entertainment activity—it is the primary social currency. The social lives of digital natives are heavily integrated into their mobile ecosystems. The dominant genres (Multiplayer Online Battle Arenas, Battle Royales, Hero Collector RPGs) are characterized by aggressive social connectivity, bite-sized pacing, and highly competitive free-to-play models.
            </p>

            <h3 className="text-xl text-white font-sans font-bold uppercase tracking-widest mt-12 mb-4">
              Status and Gacha Mechanics
            </h3>
            <p>
              The massive visibility of mobile e-sports has transformed top-tier players into cultural icons. Consequently, teenagers install these applications because they are aspirational and strictly tied to real-world status. Lack of participation in the dominant algorithmic loop results in immediate social exclusion.
            </p>
            <p>
              This environment drastically alters the perception of "card games" and digital collection. The concept of a "card" is heavily conditioned by character collection and RPG progression loops. Teenagers are highly accustomed to drawing "cards" to unlock assets in dopamine-heavy gacha systems. In contrast, pure deck-building mechanics are often perceived as possessing an unfavorable, steep learning curve compared to immediate algorithmic gratification. 
            </p>
            <p>
              While physical trading card culture is experiencing explosive, localized growth driven by the tangible appeal of collection and trading, the digital frontier remains dominated by rapid, hyper-optimized behavioral capture loops.
            </p>

            {/* THE PROTOCOL PATCH BLOCK */}
            <div className="p-6 my-8 border border-gray-800 bg-black/40 not-prose">
              <h4 className="font-sans font-bold text-sm text-fuchsia-500 mb-2 uppercase tracking-widest">
                Maha Protocol Patch: The Cognitive Circuit Breaker
              </h4>
              <p className="font-serif text-gray-400 mt-2">
                The gamification vectors deployed against digital natives are the exact same mechanics used to extract attention from enterprise workforces. Without systemic intervention, algorithmic capture dictates behavioral output.
              </p>
              <p className="font-serif text-white mt-4 font-bold">
                Attentional sovereignty requires a rigid digital firewall. You cannot out-willpower a multi-billion dollar behavioral algorithm.
              </p>
            </div>
            
          </article>

          {/* COLUMN 2: THE CONVERSION SIDEBAR (STICKY) */}
          <aside className="lg:col-span-1">
            <div className="sticky top-12 space-y-8">
              
              {/* VECTOR 1: ENTERPRISE AUDIT (THE NEW CTA) */}
              <div className="p-6 border border-gray-800 bg-black">
                <h3 className="font-sans text-sm font-bold text-white uppercase tracking-widest mb-2">Cognitive Defense Audit</h3>
                <p className="font-serif text-xs text-gray-400 mb-4">
                  Audit your organization's attentional baseline. Identify vectors of algorithmic capture and deploy systemic friction to restore deep-work capacity.
                </p>
                <Link href="/consulting" className="block text-center border border-gray-600 bg-gray-900 text-white font-mono text-[10px] tracking-widest py-3 hover:bg-white hover:text-black transition-colors uppercase">
                  Initiate Audit ↗
                </Link>
              </div>

              {/* VECTOR 2: MAHA OS */}
              <div className="p-6 border border-indigo-900/50 bg-indigo-950/10">
                <h3 className="font-sans text-sm font-bold text-indigo-400 uppercase tracking-widest mb-2">Maha OS Alpha</h3>
                <p className="font-serif text-xs text-gray-400 mb-4">
                  Deploy a systemic Cognitive Circuit Breaker directly on the device layer to prevent doomscrolling.
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
          <Link href="/intelligence" className="font-mono text-xs text-gray-600 hover:text-white transition-colors uppercase tracking-widest">
            [ ← Return to Intelligence Grid ]
          </Link>
        </div>

      </div>
    </main>
  );
}