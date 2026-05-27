'use client';

import React, { useEffect } from 'react';
import 'katex/dist/katex.min.css';
import { BlockMath } from 'react-katex';

export default function KineticFrictionProtocol() {
  
  // THE TELEMETRY STRIKE
  useEffect(() => {
    const logTelemetry = async () => {
      try {
        await fetch('/api/telemetry', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            endpoint: '/protocols/kinetic-friction',
            agent: navigator.userAgent,
            payload_size: '1024 words',
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
          <p>VECTOR: Kinetic Separation and Anti-Effort Discounting</p>
          <p>STATUS: ACTIVE</p>
        </header>

        {/* TITLE */}
        <h1 className="font-sans text-3xl sm:text-4xl font-bold tracking-tight mb-12 text-white">
          THE IRON ENGINE & THE NECESSITY OF FRICTION
        </h1>

        <article className="prose prose-invert prose-lg font-serif leading-relaxed text-gray-300">
          
          {/* SECTION I */}
          <h2 className="font-sans text-2xl font-semibold text-white mt-12 mb-6">
            I. The Catastrophe of the Frictionless Grid
          </h2>
          <p>
            The governing design philosophy of the modern technology sector is the eradication of friction. Engineers are heavily incentivized to build systems that deliver immediate, unearned rewards—one-click purchasing, infinite auto-playing content, and algorithmic delivery of synthetic dopamine. The promise is a life of optimized ease. The reality is neurobiological atrophy.
          </p>
          <p>
            The human psyche is a dissipative structure that requires kinetic resistance to maintain its structural integrity. Evolution did not design the brain to operate in a vacuum of effort. The HPA (Hypothalamic-Pituitary-Adrenal) axis and the dopaminergic pathways governing motivation are calibrated to fire in response to <em>The Chase</em>. They require a gradient. They require a hunt. 
          </p>
          <p>
            When a digital environment provides the reward without demanding the effort, it bypasses the organism's natural action-reward circuitry. This triggers a state of <strong>Anti-Effort Discounting</strong>: the brain rapidly down-regulates its baseline motivation, leading to systemic lethargy, anhedonia, and a collapse of executive function. A frictionless world does not produce liberated humans; it produces static nodes.
          </p>
          
          {/* SECTION II */}
          <h2 className="font-sans text-2xl font-semibold text-white mt-12 mb-6">
            II. The Physics of Kinetic Separation
          </h2>
          <p>
            To restart a stalled system, we must look to the orbital mechanics of Node 05 (Mars). In the architecture of the solar system, Mars represents the kinetic energy of separation—the force required to push outward from the gravitational comfort of the home orbit. It is the archetype of the Iron Engine. 
          </p>
          <p>
            In the context of human optimization, Kinetic Separation is the deliberate, manufactured introduction of structural friction back into the daily operating environment. We mathematically define the organism's momentum, or <strong>Kinetic Drive</strong>, not by the rewards it consumes, but by the friction it intentionally overcomes:
          </p>

          {/* LATEX MATH ENGINE */}
          <div className="my-10 p-6 bg-black border border-gray-800 rounded-md shadow-inner text-center">
            <BlockMath math="Kinetic\ Drive = \left( \frac{Effort_{exerted}}{Reward_{latency}} \right) \times \mu_{friction}" />
          </div>

          <p>
            Where $\mu_{friction}$ represents the coefficient of deliberate resistance designed into a process. If the latency of the reward is zero (instant gratification) or the friction is zero (effortless consumption), the Kinetic Drive equation collapses. The system loses all forward velocity.
          </p>

          <hr className="border-gray-800 my-12" />

          {/* SECTION III */}
          <h2 className="font-sans text-2xl font-semibold text-white mt-12 mb-6">
            III. Operationalizing the Iron Engine
          </h2>
          <p>
            The Sovereign Node must weaponize friction. Rather than seeking the path of least resistance, the architect must design environments where high-quality cognitive and physical output is the only mechanism for unlocking system rewards. 
          </p>
          
          <ul className="list-disc pl-6 my-6 space-y-3 text-gray-300 marker:text-gray-600">
            <li><strong>Manufactured Delay:</strong> Institutionalize latency between desire and consumption. Implement mandatory cool-down periods (24 to 72 hours) for non-essential digital purchases or algorithmic data ingestion.</li>
            <li><strong>Kinetic Verification:</strong> Tie digital access to biological exertion. Do not permit high-dopamine synthetic inputs (entertainment, social feeds) unless a prerequisite baseline of physical or deep-work friction has been mathematically logged.</li>
            <li><strong>The Separation Protocol:</strong> Routinely execute deliberate, high-friction tasks that offer zero immediate external reward. This re-calibrates the HPA axis, proving to the neurological hardware that the organism remains capable of generating its own kinetic energy.</li>
          </ul>

          <p>
            We must stop apologizing for the difficulty of the work. The resistance is not the obstacle preventing you from reaching the goal; the resistance is the required fuel for the engine. Reclaim the friction, and you reclaim the drive.
          </p>
        </article>

        {/* MAHA OS ANCHOR */}
        <div className="mt-16 p-6 border border-gray-700 bg-gray-900 rounded-lg text-center">
          <p className="font-mono text-sm text-gray-400 mb-4">LOG KINETIC EXERTION</p>
          <a 
            href="https://play.google.com/store/apps/details?id=com.mahastrategies.os" 
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