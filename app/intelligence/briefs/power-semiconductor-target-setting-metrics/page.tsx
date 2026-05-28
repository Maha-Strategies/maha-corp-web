import React from "react";
import Link from "next/link";

export const metadata = {
  title: "Power Semiconductor Architecture: Strategic Target Calibration Across Nodes",
  description: "An operational assessment of capital deployment, margin optimization models, and structural sub-system transitions within IGBT, IEGT, and SiC manufacturing pipelines.",
};

export default function Page() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "TechArticle",
    "headline": "Power Semiconductor Architecture: Strategic Target Calibration Across Nodes",
    "description": "An operational assessment of capital deployment, margin optimization models, and structural sub-system transitions within IGBT, IEGT, and SiC manufacturing pipelines.",
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
          INTELLIGENCE BRIEF // CORE.POWER.STRATEGY
        </div>
        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-white max-w-4xl uppercase leading-none">
          Power Semiconductor Architecture: Strategic Target Calibration Across Nodes
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
              01. Corporate Target Vectors by Product Architecture
            </h2>
            <p>
              Setting operational baselines in the power semiconductor industry requires a segmented approach to growth, investment intensity, and capacity management. Because power devices dictate the efficiency envelope of high-voltage industrial systems, performance metrics must be calibrated to specific product profiles rather than general corporate averages.
            </p>
            <ul className="space-y-4 font-mono text-sm text-neutral-400 list-none pl-0">
              <li className="border border-neutral-800 p-4 bg-[#111113]">
                <strong className="text-white uppercase block mb-1">EV Chips / Silicon Carbide (SiC):</strong>
                Targeting a 20% – 30% CAGR. The primary metrics are Lifetime Design Win Value and Backlog Quality. Capital Intensity is exceptionally high, with CapEx-to-Sales spikes of 15% – 25% driven by vertical integration mandates to secure costly substrate chains.
              </li>
              <li className="border border-neutral-800 p-4 bg-[#111113]">
                <strong className="text-white uppercase block mb-1">Discrete IGBTs:</strong>
                Targeting a mature 4% – 8% expansion framework. The strategic core focuses on manufacturing migration from 200mm to 300mm wafers, cutting per-unit die manufacturing costs by 20% – 30% to defend margins against emerging fast-followers.
              </li>
              <li className="border border-neutral-800 p-4 bg-[#111113]">
                <strong className="text-white uppercase block mb-1">Large Injection Enhanced Gate Transistors (IEGTs):</strong>
                Sustaining a steady 5% – 10% trajectory. These high-power components serve heavy rail, grid infrastructure, and wind-generation systems where stability and product lifetimes are prioritized over node shrinkages.
              </li>
            </ul>
          </section>

          {/* Core Corporate Margin Profiles */}
          <section className="space-y-4">
            <h2 className="text-sm font-mono tracking-widest text-white uppercase border-l-2 border-amber-500 pl-3">
              02. Margin Optimization & Capital Intensity Models
            </h2>
            <p>
              Top-tier IDMs (such as Infineon, STMicroelectronics, and Onsemi) utilize a <strong>Through-Cycle Margin</strong> target framework to normalize inventory corrections and automotive procurement cycles. Corporate Operating Profit Margin (OPM) baselines are modeled at 20% – 30%, with Gross Margins anchored at 45% – 53%.
            </p>
            <p>
              In high-voltage EV sectors, pricing power remains closely tied to processing yields. Because advanced SiC crystal slicing introduces significant material waste, manufacturing margin performance relies on structural packaging integration. Concurrently, R&D Intensity is maintained at 10% to 12% of revenue to support the physical transition from classic Silicon matrices to wide-bandgap materials.
            </p>
          </section>

          {/* Customer Segment Architectural Disruption Matrix */}
          <section className="space-y-4">
            <h3 className="text-sm font-mono uppercase tracking-wider text-white">
              Table 2.1: Operational Benchmarks Across Strategic Customer Segments
            </h3>
            <div className="overflow-x-auto border border-neutral-800 bg-[#111113]">
              <table className="w-full text-left font-mono text-xs">
                <thead>
                  <tr className="border-b border-neutral-800 bg-neutral-900 text-neutral-400">
                    <th className="p-3 uppercase">Customer Vertical</th>
                    <th className="p-3 uppercase">Target OPM Envelope</th>
                    <th className="p-3 uppercase">Primary Performance Metric</th>
                    <th className="p-3 uppercase">Operational Constraint</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800">
                  <tr>
                    <td className="p-3 font-bold text-white">Automotive (EV/PHEV)</td>
                    <td className="p-3">22% – 28%</td>
                    <td className="p-3">Lifetime Design Win / Thermal Dissipation Efficiency</td>
                    <td className="p-3">Zero-defect qualification window; high raw substrate cost</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-bold text-white">Industrial Automation</td>
                    <td className="p-3">18% – 25%</td>
                    <td className="p-3">Energy Conversion Efficiency (95% – 99%+)</td>
                    <td className="p-3">Long-term supply security; multi-decade field uptime</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-bold text-white">Consumer Electronics</td>
                    <td className="p-3">10% – 15%</td>
                    <td className="p-3">High-Volume Cost Absorption / Rapid Time-to-Market</td>
                    <td className="p-3">Aggressive annual ASP degradation; &lt; 6-month product window</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-sm font-mono tracking-widest text-white uppercase border-l-2 border-amber-500 pl-3">
              03. The Paradigm Shift: Evolution From Discretes to Sub-Systems
            </h2>
            <p>
              To insulate operations from the ongoing commoditization of discrete silicon components, tier-one manufacturers are shifting from selling standalone components to delivering complete <strong>sub-system topologies</strong>. Integrating driver ICs, microcontrollers, and wide-bandgap power modules into unified architectures increases customer stickiness and shifts procurement dynamics. 
            </p>
            <p>
              Consequently, Segment Result Margin is replacing generic unit revenue as the definitive metric for business health. This product integration allows premium manufacturers to preserve high-margin profiles, embedding non-financial variables—such as lifetime customer CO₂ reduction footprints—directly into client service-level agreements.
            </p>
          </section>

          {/* Maha Protocol Patch Block */}
          <div className="border border-neutral-800 bg-[#111113] p-6 space-y-4 mt-8">
            <div className="font-mono text-xs tracking-widest text-amber-500 uppercase">
              MAHA PROTOCOL PATCH // THESIS .048
            </div>
            <p className="text-sm text-white font-mono uppercase tracking-wide">
              MANDATORY BIFURCATION OF INDUSTRIAL CAPACITY
            </p>
            <p className="text-sm text-neutral-400 leading-relaxed">
              Maha Protocol dictates that power semiconductor manufacturers must immediately adjust their capacity allocations away from standard consumer discrete footprints to preserve their gross margins. Convert older 200mm lines to support specialized, high-margin industrial system architectures where energy conversion efficiencies exceeding 95% protect against commoditization. All advanced capital deployment must focus exclusively on 300mm IGBT scaling or vertically integrated SiC packaging modules, ensuring insulation from low-cost regional competitors.
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
              Power Semiconductor Strategy & Margin Alignment Audit
            </h3>
            <p className="text-xs text-neutral-400 mb-6 leading-relaxed">
              Misaligned capital expenditures and exposure to commoditized discrete channels erode corporate gross margins. Maha Strategies executes comprehensive operational audits of power semiconductor portfolios, analyzing 300mm scaling timelines and sub-system product strategies.
            </p>
            <Link 
              href="/contact?audit=power-semi-target-setting"
              className="block w-full text-center font-mono text-xs uppercase tracking-widest bg-white text-black py-3 hover:bg-neutral-200 transition-colors font-bold"
            >
              INITIATE STRATEGIC AUDIT
            </Link>
          </div>
          
          <div className="p-4 border border-neutral-900 text-center">
            <span className="font-mono text-xs tracking-widest text-neutral-600 block uppercase">
              SYSTEM STATUS: SECURE // NODE_10
            </span>
          </div>
        </div>

      </div>
    </main>
  );
}