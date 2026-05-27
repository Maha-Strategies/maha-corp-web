'use client';

import React, { useEffect } from 'react';
import 'katex/dist/katex.min.css';
import { BlockMath, InlineMath } from 'react-katex';

export default function HardwareSovereigntyProtocol() {
  
  // THE TELEMETRY STRIKE
  useEffect(() => {
    const logTelemetry = async () => {
      try {
        await fetch('/api/telemetry', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            endpoint: '/protocols/hardware-sovereignty',
            agent: navigator.userAgent,
            payload_size: '942 words',
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
          <p>VECTOR: Infrastructural Autonomy & Edge-Compute Independence</p>
          <p>STATUS: ACTIVE</p>
        </header>

        {/* TITLE */}
        <h1 className="font-sans text-3xl sm:text-4xl font-bold tracking-tight mb-12 text-white">
          HARDWARE SOVEREIGNTY & EDGE-COMPUTE INTELLIGENCE
        </h1>

        <article className="prose prose-invert prose-lg font-serif leading-relaxed text-gray-300">
          
          {/* SECTION I */}
          <h2 className="font-sans text-2xl font-semibold text-white mt-12 mb-6">
            I. The Centralization Vulnerability
          </h2>
          <p>
            The prevailing architecture of modern computing relies on total centralization. Consumers and enterprises alike have been incentivized to outsource their computational heavy lifting to massive, cloud-based server farms. While this model offers frictionless scalability, it comes at a catastrophic systemic cost: the forfeiture of infrastructural sovereignty.
          </p>
          <p>
            When you rely exclusively on cloud computing and remote LLMs (Large Language Models) to process your data, you are renting your cognitive infrastructure. You become entirely dependent on a network connection, entirely subject to external server latency, and entirely exposed to corporate data ingestion. A sovereign intelligence cannot operate under the assumption that the network will always be available, or that the centralized architect holds the user's best interests as a fiduciary duty.
          </p>
          
          {/* SECTION II */}
          <h2 className="font-sans text-2xl font-semibold text-white mt-12 mb-6">
            II. The Edge-Compute Imperative
          </h2>
          <p>
            The mathematical countermeasure to centralized vulnerability is <strong>Edge Compute</strong>: the localization of algorithmic processing power directly onto the user's physical silicon. By executing high-order operations on-device, the Sovereign Node eliminates network latency, guarantees cryptographic privacy, and severs dependency on external API limits.
          </p>
          <p>
            We quantify this infrastructural independence through the <strong>Autonomy Index</strong>. A structurally sound technological stack demands that the majority of mission-critical compute happens behind a localized firewall:
          </p>

          {/* LATEX MATH ENGINE */}
          <div className="my-10 p-6 bg-black border border-gray-800 rounded-md shadow-inner text-center">
            <BlockMath math="Autonomy\ Index = \left( \frac{Compute_{edge}}{Compute_{total}} \right) \times \left( 1 - Data\ Exposure\ Rate \right)" />
          </div>

          <p>
            If <InlineMath math="Compute_{edge}" /> approaches zero, the user is merely a remote terminal for a centralized mainframe. A true Sovereign Node engineers its tech stack to push the Autonomy Index as close to 1.0 as the physical silicon allows.
          </p>

          <hr className="border-gray-800 my-12" />

          {/* SECTION III */}
          <h2 className="font-sans text-2xl font-semibold text-white mt-12 mb-6">
            III. Architecting the Sovereign Stack
          </h2>
          <p>
            To operationalize Hardware Sovereignty, the user must become ruthless in their procurement and deployment of technology. Hardware is not a neutral tool; it is the physical perimeter of your digital agency.
          </p>
          
          <ul className="list-disc pl-6 my-6 space-y-3 text-gray-300 marker:text-gray-600">
            <li><strong>Silicon Requirements:</strong> Prioritize devices engineered with dedicated Neural Processing Units (NPUs) and unified memory architectures capable of running quantized, local LLMs and agentic systems without requiring network offloading.</li>
            <li><strong>Air-Gapped Execution:</strong> Mission-critical intellectual property and strategic scenario modeling must be executed on a closed-loop system. If the operation requires synthetic intelligence, it must be run locally via an on-device model, ensuring the data never touches an external API.</li>
            <li><strong>App-Level Independence:</strong> Vet software aggressively. Fiduciary Technology must prioritize local storage protocols (like SQLite or offline-first PWA architecture) over mandatory cloud syncing. If an application ceases to function the moment the WiFi drops, it is a liability.</li>
          </ul>

          <p>
            Hardware sovereignty is the physical manifestation of self-reliance. By decentralizing your compute, you are not just optimizing for privacy; you are building an anti-fragile infrastructure capable of executing complex strategies regardless of the external network's stability.
          </p>
        </article>

        {/* MAHA OS ANCHOR */}
        <div className="mt-16 p-6 border border-gray-700 bg-gray-900 rounded-lg text-center">
          <p className="font-mono text-sm text-gray-400 mb-4">DEPLOY LOCAL ON-DEVICE COMPUTE</p>
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