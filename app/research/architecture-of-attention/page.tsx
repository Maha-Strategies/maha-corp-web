import React from "react";
import Link from "next/link";
import { Metadata } from "next";
import { MAHA_ORGANIZATION_ID } from '@/lib/entity'

export const metadata: Metadata = {
  title: "The Architecture of Attention // Maha Research",
  description: "Combating Cognitive Atrophy Through Sovereign Edge Compute. A whitepaper on psychographic colonialism, attentional captivity, and the Maha OS defense grid.",
  alternates: { canonical: "https://www.mahastrategies.com/research/architecture-of-attention" },
};

export default function ArchitectureOfAttentionPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "TechArticle",
    "headline": "The Architecture of Attention: Combating Cognitive Atrophy Through Sovereign Edge Compute",
    "description": "An analysis of systemic attentional capture mechanisms and the hardware-level software countermeasures deployed via Maha OS.",
    "proficiencyLevel": "Expert",
    "author": {
      "@type": "Person",
      "name": "Mayone Maha Rajan",
      "jobTitle": "Founder & Cultural Strategist"
    },
    "publisher": { "@id": MAHA_ORGANIZATION_ID },
    "datePublished": "2026-05-29"
  };

  return (
    <main className="min-h-screen bg-[#0a0a0c] text-zinc-300 font-sans p-8 md:p-24 selection:bg-indigo-500 selection:text-white">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div className="max-w-3xl mx-auto">
        {/* Navigation Breadcrumb */}
        <div className="mb-12">
          <Link href="/research" className="font-mono text-xs tracking-widest text-zinc-500 hover:text-white uppercase transition-colors no-underline">
            &larr; BACK TO RESEARCH // NODE_04
          </Link>
        </div>

        {/* Title Block */}
        <header className="border-b border-zinc-800 pb-8 mb-12">
          <div className="font-mono text-xs tracking-widest text-indigo-500 uppercase mb-3">
            WHITE-PAPER // COGNITIVE.ARMOR
          </div>
          <h1 className="text-3xl md:text-5xl font-light tracking-tight text-white mb-6 uppercase leading-tight">
            The Architecture of Attention
          </h1>
          <p className="text-zinc-400 font-mono text-xs uppercase tracking-widest">
            SUBTITLE: Combating Cognitive Atrophy Through Sovereign Edge Compute
          </p>
        </header>

        {/* Abstract Block */}
        <div className="border border-zinc-800 bg-zinc-950/40 p-6 mb-12 font-mono text-xs md:text-sm leading-relaxed text-zinc-400">
          <span className="text-white block font-bold mb-2 uppercase tracking-wider">[ ABSTRACT ]</span>
          The modern digital ecosystem has transitioned from an information network into a system of “Psychographic Colonialism.” By exploiting the human dopamine system through variable reward schedules, algorithmic platforms have induced a widespread “Dopamine Deficit State.” This whitepaper outlines the biological mechanisms of “Attentional Captivity” and proposes a structural, hardware-level solution: the Maha OS cognitive defense grid.
        </div>

        {/* Article Body */}
        <article className="prose prose-invert max-w-none font-light tracking-wide leading-relaxed space-y-12">
          
          <section className="space-y-4">
            <h2 className="text-xl md:text-2xl text-white font-mono tracking-wider uppercase border-l border-indigo-500 pl-4 mt-0">
              I. The Diagnostic Problem: Attentional Captivity
            </h2>
            <p>
              The current crisis of human focus is not a failure of individual willpower; it is the result of an extractive economic model. Attention is a finite biological resource that is currently being strip-mined by algorithmic systems designed to maximize “Time on Device.”
            </p>
            
            <h3 className="text-lg text-zinc-200 uppercase tracking-wide font-medium mt-6">The Voodoo Doll Economy</h3>
            <p>
              Users are no longer the customers of digital platforms; they are the raw material. Algorithms construct high-resolution digital simulations of users—predictive models that map psychological vulnerabilities. By inserting targeted cues, these systems trigger specific behavioral responses, bypassing the prefrontal cortex and effectively privatizing human agency.
            </p>

            <h3 className="text-lg text-zinc-200 uppercase tracking-wide font-medium mt-6">The 23-Minute Penalty and Thermal Throttling</h3>
            <p>
              The human brain is incapable of multitasking; it can only task-switch. Every context switch incurs a tax known as “Attention Residue,” requiring approximately 23 minutes to fully regain deep focus. The modern “Feed” forces the brain to operate at a clock speed it was not designed for, resulting in “Cognitive Overclocking.” 
            </p>
            <p>
              The resulting anxiety is the thermal heat of a processor running at maximum voltage, and the subsequent “brain fog” is a biological thermal-throttling mechanism initiating a shutdown to prevent permanent damage.
            </p>
          </section>

          {/* Section II with Inline Mechanical Visualization */}
          <section className="space-y-4">
            <h2 className="text-xl md:text-2xl text-white font-mono tracking-wider uppercase border-l border-indigo-500 pl-4">
              II. The Biological Mechanism: The Tonic Crash
            </h2>
            <p>
              To understand why users feel chronically exhausted yet hyper-stimulated, we must distinguish between two distinct modes of dopamine transmission within our neural architecture:
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 my-8 not-prose font-mono text-xs">
              <div className="border border-zinc-800 p-5 bg-black">
                <span className="text-indigo-400 block mb-2 font-bold uppercase tracking-wider">▲ Phasic Firing</span>
                <p className="text-zinc-400 leading-relaxed m-0">
                  The sharp, immediate spikes of neural transmission in response to unexpected digital super-stimuli (notifications, variable rewards, infinite feeds). Overloads the neurochemical receptors.
                </p>
              </div>
              <div className="border border-zinc-800 p-5 bg-black">
                <span className="text-zinc-500 block mb-2 font-bold uppercase tracking-wider">▼ Tonic Firing</span>
                <p className="text-zinc-400 leading-relaxed m-0">
                  The steady, baseline background state of dopamine that dictates standard cognitive motivation, emotional equilibrium, and mood stability. Sustains deep baseline agency.
                </p>
              </div>
            </div>

            <p>
              Digital platforms bombard the brain with Phasic Super-Stimuli. In an attempt to maintain homeostasis, the brain downregulates its dopamine receptors. This creates <strong>“The Tonic Crash”</strong>—a chemically induced state of apathy where the brain demands high-intensity digital stimulation but is biologically incapable of finding motivation for low-intensity, real-world rewards.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl md:text-2xl text-white font-mono tracking-wider uppercase border-l border-indigo-500 pl-4">
              III. The Architectural Solution: Maha OS
            </h2>
            <p>
              We are voluntarily transforming the human mind from a powerful <strong>“Edge Processor”</strong> (relying on a strong hippocampus for local memory and navigation) into a <strong>“Thin Client”</strong>—a dumb terminal completely dependent on a cloud server for its cognitive function.
            </p>
            <p>
              To reverse this cognitive atrophy, we cannot rely on subjective self-regulation. We require an architectural intervention. Maha OS serves as this structural defense grid.
            </p>

            <h3 className="text-lg text-zinc-200 uppercase tracking-wide font-medium mt-6">Core Protocols of the Cognitive Defense Grid:</h3>
            <ul className="space-y-3 list-none pl-0 font-mono text-xs md:text-sm text-zinc-400">
              <li className="flex items-start gap-3">
                <span className="text-indigo-500">[01]</span>
                <span><strong>Metabolic & Autonomic Baseline Tracking:</strong> The system monitors physiological indicators of systemic drag, specifically resting heart rate (RHR), heart rate variability (HRV), and decision velocity.</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-indigo-500">[02]</span>
                <span><strong>Hardware-Level Circuit Breakers:</strong> When the system detects the biological markers of dopamine fatigue or severe autonomic dysregulation, Maha OS autonomously initiates a physical intervention—such as dimming the screen—to enforce a parasympathetic reset and break the algorithmic loop.</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-indigo-500">[03]</span>
                <span><strong>Agentic Interoperability (MCP):</strong> Utilizing the Model Context Protocol (MCP), Maha OS acts as a secure, local biological ledger. It allows authorized, sovereign AI agents to read the user’s cognitive state and adjust their output, ensuring that technology serves the user’s biological integrity rather than extracting it.</span>
              </li>
            </ul>
          </section>

          <section className="space-y-4 pt-4 border-t border-zinc-800">
            <h2 className="text-xl text-white font-mono uppercase tracking-wider m-0">
              Conclusion
            </h2>
            <p>
              Attentional Captivity cannot be solved by passive mindfulness; it requires martial discipline and structural boundaries. Maha OS provides the mathematical tether needed to navigate a high-noise environment, transforming the human mind from a vulnerable thin client back into a sovereign, edge-compute processor.
            </p>
          </section>
        </article>

        {/* Action Gateways (Terminal Style Custom Links) */}
        <div className="mt-16 pt-8 border-t border-zinc-800 not-prose font-mono">
          <h4 className="text-xs text-white uppercase tracking-widest mb-6">[ SUBSYSTEM INITIALIZATION PATHWAYS ]</h4>
          <div className="flex flex-col sm:flex-row gap-4">
            <a 
              href="https://play.google.com/store/apps/details?id=com.maha.os" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex-1 text-center border border-zinc-700 bg-zinc-950 p-4 text-xs font-bold text-white uppercase tracking-widest hover:border-indigo-500 hover:text-indigo-400 transition-colors no-underline"
            >
              Initialize Maha OS (Google Play) &rarr;
            </a>
            <a 
              href="https://github.com/mayonerajan/maha-cognitive-gateway" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex-1 text-center border border-zinc-700 bg-zinc-950 p-4 text-xs font-bold text-zinc-400 uppercase tracking-widest hover:border-white hover:text-white transition-colors no-underline"
            >
              Inspect Source (GitHub Core) &rarr;
            </a>
          </div>
        </div>

      </div>
    </main>
  );
}