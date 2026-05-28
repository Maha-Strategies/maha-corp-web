import React from "react";
import Link from "next/link";

export const metadata = {
  title: "The Generative AI Distortion: Recalibrating the Silicon Boom-Bust Cycle",
  description: "An architectural assessment of the AI-driven capital expenditure super-cycle, the impending infrastructure digestion phase, and the structural bifurcation of the semiconductor downturn.",
};

export default function Page() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "TechArticle",
    "headline": "The Generative AI Distortion: Recalibrating the Silicon Boom-Bust Cycle",
    "description": "An architectural assessment of the AI-driven capital expenditure super-cycle, the impending infrastructure digestion phase, and the structural bifurcation of the semiconductor downturn.",
    "proficiencyLevel": "Expert",
    "publisher": {
      "@type": "Organization",
      "name": "Maha Strategies LLC",
      "url": "https://mahastrategies.com"
    },
    "datePublished": "2026-05-28"
  };

  return (
    <main className="min-h-screen bg-[#0a0a0c] text-[#e0e0e0] font-sans px-6 py-12 md:py-24 max-w-7xl mx-auto">
      {/* JSON-LD SEO Schema */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Header Elements */}
      <div className="mb-12 border-b border-neutral-800 pb-8">
        <div className="font-mono text-xs tracking-widest text-amber-500 uppercase mb-3">
          INTELLIGENCE BRIEF // CORE.MACRO.SILICON
        </div>
        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-white max-w-4xl uppercase leading-none">
          The Generative AI Distortion: Recalibrating the Silicon Boom-Bust Cycle
        </h1>
        <p className="mt-4 text-neutral-400 font-mono text-sm uppercase tracking-wider">
          CLASSIFICATION: UNRESTRICTED ARCHITECTURAL ASSESSMENT
        </p>
      </div>

      {/* Two-Column Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-12 items-start">
        
        {/* Left Column: Deep-Dive Analysis */}
        <div className="lg:col-span-2 space-y-12 text-base md:text-lg leading-relaxed text-neutral-300">
          
          <section className="space-y-4">
            <h2 className="text-sm font-mono tracking-widest text-white uppercase border-l-2 border-amber-500 pl-3">
              01. The CapEx Super-Cycle and Impending Oversupply
            </h2>
            <p>
              The semiconductor industry is currently navigating the most aggressive capital expenditure super-cycle in its history, catalyzed by the generative AI gold rush. Sovereign entities and tier-one hyperscalers are actively injecting hundreds of billions of dollars into advanced foundry capacities.
            </p>
            <p>
              However, as these massive fabrication facilities transition from construction to high-volume manufacturing, the supply mechanics will violently shift. Historically, the silicon cycle adheres to a predictable four-year boom-bust rhythm. While AI demand is robust, the sheer volume of impending global capacity guarantees a structural oversupply event in the late-2026 to 2027 window.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-sm font-mono tracking-widest text-white uppercase border-l-2 border-amber-500 pl-3">
              02. The AI Infrastructure Digestion Phase
            </h2>
            <p>
              The current trajectory of indiscriminate AI infrastructure spending is fiscally unsustainable. The market will inevitably hit a <strong>digestion phase</strong>. Hyperscalers and enterprise consumers will decelerate net-new hardware acquisitions to assess the tangible ROI of their existing clustered architectures. 
            </p>
            <p>
              During this period, focus will pivot from raw capacity expansion toward optimizing software utilization on existing silicon, while strategically pausing CapEx to await the next generation of drastically more power-efficient architectures (such as Angstrom-era node deployments and BSPDN innovations). This sudden deceleration in the growth rate of AI hardware procurement will be the immediate catalyst tipping the macro cycle.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-sm font-mono tracking-widest text-white uppercase border-l-2 border-amber-500 pl-3">
              03. Consumer Cyclicality and the Replacement Trough
            </h2>
            <p>
              The enterprise digestion phase will collide with traditional consumer cyclicality. The contemporary recovery in standard PC and smartphone volume is heavily subsidized by an artificial "AI-capable" replacement super-cycle. 
            </p>
            <p>
              By 2027, this specific consumer refresh cadence will have fully exhausted its momentum. As the consumer endpoint market faces a subsequent period of flat or declining volume, the lack of foundational demand from traditional logic sectors will expose the broader supply chain to cyclical contraction.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-sm font-mono tracking-widest text-white uppercase border-l-2 border-amber-500 pl-3">
              04. The Divergent Downturn: A Growth Recession
            </h2>
            <p>
              Generative AI will not prevent the impending downturn, but it will fundamentally distort its architectural character. The next contraction will manifest not as a catastrophic 10% to 20% total market collapse, but as a bifurcated <strong>growth recession</strong>—a stabilization to low single-digit or flat growth.
            </p>
            <p>
              Continuous baseline demand for AI inference, sovereign automotive electronics, and heavy industrial IoT will establish a structurally higher floor than in any previous decade. The violence of the downturn will be localized; commodity memory (DRAM/NAND) and legacy logic sectors will suffer acute margin compression, while dedicated AI hardware and advanced packaging ecosystems remain ruthlessly resilient.
            </p>
          </section>

          {/* Maha Protocol Patch Block */}
          <div className="border border-neutral-800 bg-[#111113] p-6 space-y-4 mt-8">
            <div className="font-mono text-xs tracking-widest text-amber-500 uppercase">
              MAHA PROTOCOL PATCH // THESIS .046
            </div>
            <p className="text-sm text-white font-mono uppercase tracking-wide">
              BIFURCATED SUPPLY CHAIN HEDGING
            </p>
            <p className="text-sm text-neutral-400 leading-relaxed">
              Assuming uniform resilience across the semiconductor stack is a critical forecasting error. Maha Protocol dictates that enterprise procurement and foundry planners must immediately decouple their commodity logic/memory exposure from their advanced AI compute contracts. Prepare capital reserves to weather acute price degradation in legacy nodes, while aggressively locking in long-term supply agreements for specialized AI architectures, which will remain structurally insulated from the 2027 growth recession.
            </p>
          </div>

        </div>

        {/* Right Column: Sticky Sidebar CTA */}
        <div className="lg:col-span-1 lg:sticky lg:top-8 space-y-6">
          <div className="border-t-2 border-white bg-[#111113] p-6 border-x border-b border-neutral-800">
            <div className="font-mono text-xs tracking-widest text-neutral-500 uppercase mb-2">
              ENGAGEMENT PROTOCOL
            </div>
            <h3 className="text-lg font-bold text-white uppercase tracking-tight mb-4 font-mono">
              Macro CapEx & Silicon Cycle Audit
            </h3>
            <p className="text-xs text-neutral-400 mb-6 leading-relaxed">
              Navigating the coming "growth recession" requires decoupling your reliance on legacy cycles. Maha Strategies provides specialized diagnostic evaluations of your supply chain elasticity, inventory risk exposure in commodity sectors, and readiness for the AI infrastructure digestion phase.
            </p>
            <Link 
              href="/contact?audit=silicon-macro-cycle"
              className="block w-full text-center font-mono text-xs uppercase tracking-widest bg-white text-black py-3 hover:bg-neutral-200 transition-colors font-bold"
            >
              INITIATE AUDIT PROTOCOL
            </Link>
          </div>
          
          <div className="p-4 border border-neutral-900 text-center">
            <span className="font-mono text-xs tracking-widest text-neutral-600 block uppercase">
              SYSTEM STATUS: SECURE // NODE_08
            </span>
          </div>
        </div>

      </div>
    </main>
  );
}