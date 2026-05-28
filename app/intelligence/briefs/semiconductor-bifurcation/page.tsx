'use client';

import React from 'react';
import Link from 'next/link';

export default function SemiconductorBifurcationBrief() {
  // SCHEMA ENGINE: INTELLIGENCE REPORT
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: 'The Bifurcation of Silicon: Geopolitics and Open Innovation',
    description: 'An intelligence brief on the structural shift from open innovation to secure, sovereign semiconductor supply chains.',
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
      '@id': 'https://www.mahastrategies.com/intelligence/briefs/semiconductor-bifurcation'
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
          <span className="text-red-400">STATUS: CRITICAL PRIORITY</span>
        </header>

        {/* TWO-COLUMN ARCHITECTURE */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12 lg:gap-16">
          
          {/* COLUMN 1: THE INTELLECTUAL PROPERTY */}
          <article className="lg:col-span-2 prose prose-invert prose-lg font-serif leading-relaxed text-gray-300 max-w-none">
            
            <h1 className="font-sans text-3xl sm:text-5xl font-bold tracking-tight mb-4 text-white uppercase not-prose">
              The Bifurcation of Silicon
            </h1>
            
            <p className="font-mono text-sm text-indigo-400 mb-12 uppercase tracking-widest not-prose">
              GEOPOLITICS // OPEN INNOVATION // SUPPLY CHAIN
            </p>

            <h2 className="text-2xl text-white font-sans uppercase tracking-widest border-l-2 border-indigo-500 pl-4 mt-8 mb-6 not-prose">
              The Death of Borderless Tech
            </h2>
            <p>
              The semiconductor industry is navigating one of the most profound structural shifts in its entire history. Silicon is no longer classified as a commercial commodity; it is the foundational substrate for national security, artificial intelligence, and military superiority. 
            </p>
            <p>
              Consequently, the traditional, borderless concept of "open innovation" has been severely disrupted. Semiconductor design firms can no longer rely on frictionless global collaboration. They must pivot from a radically open model to a strategy of secure, sovereign innovation.
            </p>

            <h3 className="text-xl text-white font-sans font-bold uppercase tracking-widest mt-12 mb-4">
              The Parallel Ecosystems
            </h3>
            <p>
              Rising geopolitical friction, driven primarily by US-China tensions, has fundamentally altered the global tech landscape. Governments are no longer passive observers; they are actively intervening in innovation networks through stringent export controls, entity lists, and tariffs.
            </p>
            <p>
              We are witnessing the forced bifurcation of the semiconductor ecosystem through technological decoupling. Parallel supply chains are emerging: one centered around the United States and its strategic allies, and an entirely separate, closed-loop domestic ecosystem within China. 
            </p>

            <h3 className="text-xl text-white font-sans font-bold uppercase tracking-widest mt-12 mb-4">
              The Dual-Use Vulnerability
            </h3>
            <p>
              Collaborating with Chinese entities today carries profound regulatory and reputational risks. The primary vulnerability is dual-use diversion—the risk that collaborative R&D intended for civilian infrastructure could be diverted to military applications. Partnering with a seemingly benign tech firm or university can become an existential corporate liability overnight if they, or one of their subsidiaries, are added to a restricted entity list.
            </p>
            <p>
              To navigate this environment, semiconductor design companies must adopt a highly nuanced, risk-aware approach to open innovation. Decision-making must be ruthlessly segmented by the strategic sensitivity of the technology.
            </p>

            {/* THE PROTOCOL PATCH BLOCK */}
            <div className="p-6 my-8 border border-gray-800 bg-black/40 not-prose">
              <h4 className="font-sans font-bold text-sm text-red-400 mb-2 uppercase tracking-widest">
                Maha Protocol Patch: The Defense Posture
              </h4>
              <p className="font-serif text-gray-400 mt-2">
                The new playbook requires shifting R&D vectors to allied hubs, leveraging government consortia, and implementing strict talent vetting. Engineering teams must deploy a cross-functional R&D steering committee—integrating legal, trade compliance, and supply chain leaders—to vet every open innovation initiative. 
              </p>
              <p className="font-serif text-white mt-4 font-bold">
                You must balance the collaborative benefits of open innovation with the defensive posture of a defense contractor.
              </p>
            </div>
            
          </article>

          {/* COLUMN 2: THE CONVERSION SIDEBAR (STICKY) */}
          <aside className="lg:col-span-1">
            <div className="sticky top-12 space-y-8">
              
              {/* VECTOR 1: ENTERPRISE AUDIT (THE NEW CTA) */}
              <div className="p-6 border border-gray-800 bg-black">
                <h3 className="font-sans text-sm font-bold text-white uppercase tracking-widest mb-2">Hardware Procurement Audit</h3>
                <p className="font-serif text-xs text-gray-400 mb-4">
                  Deploy a systemic audit of your supply chain to identify dual-use vulnerabilities and geopolitical exposure. 
                </p>
                <Link href="/consulting" className="block text-center border border-gray-600 bg-gray-900 text-white font-mono text-[10px] tracking-widest py-3 hover:bg-white hover:text-black transition-colors uppercase">
                  Initiate Audit ↗
                </Link>
              </div>

              {/* VECTOR 2: MAHA OS */}
              <div className="p-6 border border-indigo-900/50 bg-indigo-950/10">
                <h3 className="font-sans text-sm font-bold text-indigo-400 uppercase tracking-widest mb-2">Maha OS Alpha</h3>
                <p className="font-serif text-xs text-gray-400 mb-4">
                  Enforce the Zero-Payload Policy on local device hardware.
                </p>
                <a href="https://play.google.com/store/apps/details?id=com.maha.os" target="_blank" rel="noopener noreferrer" className="block text-center border border-indigo-500 text-indigo-400 font-mono text-[10px] tracking-widest py-3 hover:bg-indigo-500 hover:text-white transition-colors uppercase">
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