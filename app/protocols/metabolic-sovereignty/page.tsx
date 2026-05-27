'use client';

import React, { useEffect } from 'react';
import 'katex/dist/katex.min.css';
import { BlockMath } from 'react-katex';

export default function AlgorithmicTranceProtocol() {
  
  // THE TELEMETRY STRIKE
  // Fires silently on component mount to register the hit in Supabase
  useEffect(() => {
    const logTelemetry = async () => {
      try {
        await fetch('/api/telemetry', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            endpoint: '/protocols/metabolic-sovereignty',
            agent: navigator.userAgent,
            payload_size: '1092 words',
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
          <p>VECTOR: Cognitive Extraction and Substrate Defense</p>
          <p>STATUS: ACTIVE</p>
        </header>

        {/* TITLE */}
        <h1 className="font-sans text-3xl sm:text-4xl font-bold tracking-tight mb-12 text-white">
          THE ALGORITHMIC TRANCE & METABOLIC SOVEREIGNTY
        </h1>

        <article className="prose prose-invert prose-lg font-serif leading-relaxed text-gray-300">
          
          {/* SECTION I */}
          <h2 className="font-sans text-2xl font-semibold text-white mt-12 mb-6">
            I. The Mathematics of Attentional Captivity
          </h2>
          <p>
            For decades, the technology sector has categorized distraction as a psychological failing. The prevailing narrative operates on a false premise: if you cannot sustain deep work, your executive function (Node 01: The Sovereign Ego) lacks discipline. However, when observing the intersection of cognitive neuroscience and modern UI architecture, the material reality is much darker. Willpower is a biologically flawed metric for surviving engineered environments.
          </p>
          <p className="font-bold text-white my-6">
            We are not experiencing distraction; we are operating under Attentional Captivity.
          </p>
          <p>
            The platforms we interact with are not passive tools. They are high-frequency extraction engines explicitly designed to compromise the autonomic nervous system. When a user is pulled into an infinite-scroll loop, they cross the threshold into the <strong>Algorithmic Trance</strong>. This is not a metaphor. It is a measurable, physiological collapse of the somatic container, characterized by shallow respiratory rates, an elevated Resting Heart Rate (RHR), and a severe erosion of Decision Velocity—the speed and clarity with which a biological system can execute high-friction choices.
          </p>
          <p>
            To defeat an engineered system, subjective feeling must be abandoned in favor of rigid telemetry. By establishing a local, edge-compute defense grid, we can quantify the precise millisecond cognitive degradation occurs using a Systemic Readiness heuristic:
          </p>

          {/* LATEX MATH ENGINE */}
          <div className="my-10 p-6 bg-black border border-gray-800 rounded-md shadow-inner text-center">
            <BlockMath math="Readiness\ Score = \frac{RHR_{baseline}}{RHR_{current}} \times (1 - V_{interaction})" />
          </div>

          <p>
            When the delta between a user’s rolling baseline RHR and their real-time biometric state drops below the critical threshold (a score &lt; 50), the trance has achieved system override.
          </p>
          <p>
            At this threshold, passive notifications—gentle UI pings reminding the user of their screen time—are structurally useless against neurobiological hijacking. The only mathematical solution is a <strong>Kinetic Intervention</strong>. This requires a hardware-verified physical action to shatter the feedback loop. Instead of offering a suggestion, the software must deploy absolute UI preemption: a forced OS-level lockdown that severs all device navigation until the user completes a parasympathetic reset, such as a 60-second somatic breathing protocol.
          </p>
          <p>
            The future of the digital grid cannot rely on extractive mechanics. The architecture must shift toward <strong>Fiduciary Technology</strong>—systems cryptographically and algorithmically bound to act in the user&apos;s thermodynamic best interest. Anything less is a direct compromise of the human cognitive substrate.
          </p>

          <hr className="border-gray-800 my-12" />

          {/* SECTION II */}
          <h2 className="font-sans text-2xl font-semibold text-white mt-12 mb-6">
            II. Metabolic Purity: The Substrate of Sovereignty
          </h2>
          <p>
            There is a fatal architectural blind spot in the modern developer ecosystem. We obsess over optimizing our software, refactoring code for edge-compute efficiency, and fine-tuning the latency of our APIs, yet we treat our own biological hardware as a zero-cost externality.
          </p>
          <p>
            You cannot build resilient, high-leverage technology if your autonomic nervous system is perpetually destabilized. Deep tech requires deep focus, and deep focus is fundamentally a thermodynamic biological output.
          </p>
          <p>
            We are currently operating under a system of <strong>Metabolic Colonialism</strong>—an extractive economic model where industrial food networks trade hyper-palatable, nutrient-poor compounds for our long-term vitality. The widespread consumption of industrial seed oils and refined sugars does not merely induce physical lethargy; it introduces systemic oxidative stress and inflammation that directly bottlenecks cognitive load capacity.
          </p>
          <p>
            To operate as an <strong>Asymmetric Navigator</strong>—a strategist capable of reading structural signals through the noise of the modern grid—you must establish a baseline of <strong>Metabolic Purity</strong>.
          </p>
          <p>
            This is not a wellness trend; it is a rigid Protocol of Precision. Exercising the Nutritional Veto to eliminate neuro-destabilizing inputs is the absolute prerequisite for <strong>Biological Sovereignty</strong>: the right of an individual to shield their metabolic and cognitive networks from high-frequency entropic decay.
          </p>
          <p>
            When evaluating any input—whether it is an engineered food product or an engineered algorithm—the organism must route the decision through the <strong>Trinity of Verification</strong>:
          </p>

          <ul className="list-disc pl-6 my-6 space-y-3 text-gray-300 marker:text-gray-600">
            <li><strong>The Incentive Check:</strong> Does the creator of this input profit from my dependency on it?</li>
            <li><strong>The Biological Check:</strong> Does this input stabilize or degrade my Systemic Readiness?</li>
            <li><strong>The Source Check (Skin in the Game):</strong> Does the creator consume their own output?</li>
          </ul>

          <p>
            The architects who will define the next decade of technology will not be those who brute-force the most hours on caffeine and processed glucose. They will be the sovereign individuals who recognize that an optimized metabolic baseline is the ultimate hardware for the Orbital Mind.
          </p>
        </article>

        {/* MAHA OS ANCHOR */}
        <div className="mt-16 p-6 border border-gray-700 bg-gray-900 rounded-lg text-center">
          <p className="font-mono text-sm text-gray-400 mb-4">DEPLOY LOCAL KINETIC INTERVENTION</p>
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