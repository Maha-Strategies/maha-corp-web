'use client';

import React, { useEffect } from 'react';
import 'katex/dist/katex.min.css';
import { BlockMath } from 'react-katex';

export default function DigitalFirewallProtocol() {
  
  // THE TELEMETRY STRIKE
  useEffect(() => {
    const logTelemetry = async () => {
      try {
        await fetch('/api/telemetry', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            endpoint: '/protocols/digital-firewall',
            agent: navigator.userAgent,
            payload_size: '984 words',
            status: '200 OK'
          }),
        });
      } catch (error) {
        console.error('[TELEMETRY ERROR] Ground Station link failed:', error);
      }
    };

    logTelemetry();
  }, []);

  return (
    <main className="min-h-screen bg-[#0a0a0a] text-[#e0e0e0] py-16 px-6 sm:px-12 selection:bg-gray-700">
      <div className="max-w-3xl mx-auto">
        
        {/* TERMINAL HEADER */}
        <header className="font-mono text-xs sm:text-sm text-gray-500 mb-16 border-b border-gray-800 pb-4">
          <p>[SYSTEM DOCTRINE]</p>
          <p>PROTOCOL: Maha Strategies - Sovereign Node v2.0</p>
          <p>VECTOR: Information Scaffolding & Boundary Enforcement</p>
          <p>STATUS: ACTIVE</p>
        </header>

        {/* TITLE */}
        <h1 className="font-sans text-3xl sm:text-4xl font-bold tracking-tight mb-12 text-white">
          THE SATURNIAN PERIMETER & THE DIGITAL FIREWALL
        </h1>

        <article className="prose prose-invert prose-lg font-serif leading-relaxed text-gray-300">
          
          {/* SECTION I */}
          <h2 className="font-sans text-2xl font-semibold text-white mt-12 mb-6">
            I. The Crisis of Runaway Amplification
          </h2>
          <p>
            No complex thermodynamic system can survive purely on amplification. Whether a star, an economy, or the human psyche, survival requires a precise balance between positive feedback loops (which drive expansion and growth) and negative feedback loops (which impose limits, trigger damping, and prevent the system from overheating).
          </p>
          <p>
            The modern digital infrastructure has abandoned this balance. The algorithmic web is an engine of pure, unregulated amplification. Machine-learning algorithms are designed as deviation-amplifying circuits: they detect a micro-preference and flood the user with a frictionless, infinite stream of synthesized data. 
          </p>
          <p>
            In cybernetics, a system that lacks a damping mechanism enters a state of runaway failure. In astrophysics, a star without gravitational boundary control detonates. In neurobiology, a brain subjected to infinite, frictionless input suffers from structural fragmentation. We mistake access to infinite information for power, when in reality, it is a catastrophic breach of the cognitive hull.
          </p>
          
          {/* SECTION II */}
          <h2 className="font-sans text-2xl font-semibold text-white mt-12 mb-6">
            II. The Saturnian Limit: Architecting the Firewall
          </h2>
          <p>
            The biological organism cannot process infinite synthetic noise. To maintain coherence, the Sovereign Node must construct a <strong>Digital Firewall</strong>. This is not a casual "digital detox"; it is a rigid, structural boundary—the cybernetic brakes applied against a system designed to accelerate you into oblivion.
          </p>
          <p>
            We define the integrity of a sovereign mind not by how much data it can ingest, but by its <strong>Cognitive Yield</strong>. This is the mathematical ratio of intentionally curated signal versus the friction of synthetic noise forced upon the perimeter:
          </p>

          {/* LATEX MATH ENGINE */}
          <div className="my-10 p-6 bg-black border border-gray-800 rounded-md shadow-inner text-center">
            <BlockMath math="Cognitive\ Yield = \frac{\sum (Signal_{curated} \times Intent)}{\sum (Noise_{synthetic} \times Friction)}" />
          </div>

          <p>
            When synthetic noise dominates the denominator, Cognitive Yield drops to zero. The intellect is paralyzed, trapped in a reactionary state of processing irrelevant data. 
          </p>
          <p>
            To restore the architecture, we apply the <strong>Saturnian Limit</strong>. In the solar mechanics of the psyche, Saturn represents the Architect—the physics of boundaries, limits, and time. The Digital Firewall is the manifestation of this archetype. It is the absolute, unapologetic restriction of inbound data streams.
          </p>

          <hr className="border-gray-800 my-12" />

          {/* SECTION III */}
          <h2 className="font-sans text-2xl font-semibold text-white mt-12 mb-6">
            III. Execution of the Perimeter Defense
          </h2>
          <p>
            Constructing the Digital Firewall requires shifting from a passive consumer of algorithmic feeds to an active, hostile filter of inbound information. 
          </p>
          
          <ul className="list-disc pl-6 my-6 space-y-3 text-gray-300 marker:text-gray-600">
            <li><strong>Zero-Payload Feeds:</strong> The Sovereign Node does not scroll. All algorithmic feeds (timelines, recommendations, auto-playing video) must be mathematically zeroed out via browser extensions, DNS blocking, or API-level routing. </li>
            <li><strong>Asynchronous Ingestion:</strong> Information must only be retrieved, never received. Push notifications are a violation of the temporal boundary. The user queries the grid on their own timeline; the grid does not query the user.</li>
            <li><strong>Agentic Isolation:</strong> When interfacing with Large Language Models and synthetic intelligence, interactions must be heavily sandboxed. Pass only the required executable meaning (Zero-Payload Architecture) and reject continuous ambient data collection.</li>
          </ul>

          <p>
            Boundaries are not a limitation on freedom; they are the prerequisite for it. By architecting a ruthless Digital Firewall, you reclaim the bandwidth necessary to execute high-order computation. You cease to be a data point in a hyper-centralized network and become a self-contained, sovereign intelligence.
          </p>
        </article>

        {/* MAHA OS ANCHOR */}
        <div className="mt-16 p-6 border border-gray-700 bg-gray-900 rounded-lg text-center">
          <p className="font-mono text-sm text-gray-400 mb-4">ENFORCE THE BOUNDARY</p>
          <a 
            href="https://play.google.com/store/apps/details?id=com.maha.os" 
            target="_blank" 
            rel="noopener noreferrer"
            className="inline-block px-6 py-3 bg-white text-black font-sans font-bold text-sm tracking-widest hover:bg-gray-200 transition-colors"
          >
            DOWNLOAD MAHA OS: SOVEREIGN ECOSYSTEM
          </a>
        </div>

      </div>
    </main>
  );
}