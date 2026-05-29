import React from "react";
import Link from "next/link";

export const metadata = {
  title: "Power Semiconductor Target Architecture: Metrics, Yields, and Segment Rationale",
  description: "An operational audit analyzing strategic performance indicators, capex intensity targets, and value-capture strategies across discrete IGBTs, EV SiC, and industrial automation segments.",
};

export default function Page() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "TechArticle",
    "headline": "Power Semiconductor Target Architecture: Metrics, Yields, and Segment Rationale",
    "description": "An operational audit analyzing strategic performance indicators, capex intensity targets, and value-capture strategies across discrete IGBTs, EV SiC, and industrial automation segments.",
    "proficiencyLevel": "Expert",
    "publisher": {
      "@type": "Organization",
      "name": "Maha Strategies LLC",
      "url": "https://mahastrategies.com"
    },
    "datePublished": "2026-05-29"
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
          INTELLIGENCE BRIEF // CORE.SILICON.POWER
        </div>
        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-white max-w-4xl uppercase leading-none">
          Power Semiconductor Target Architecture:<br/>Metrics, Yields, and Segment Rationale
        </h1>
        <p className="mt-4 text-neutral-400 font-mono text-sm uppercase tracking-wider">
          CLASSIFICATION: UNRESTRICTED OPERATIONAL AUDIT
        </p>
      </div>

      {/* Two-Column Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-12 items-start">
        
        {/* Left Column: Deep-Dive Analysis */}
        <div className="lg:col-span-2 space-y-12 text-base md:text-lg leading-relaxed text-neutral-300">
          
          <div className="text-neutral-400 italic border-l-2 border-neutral-700 pl-4">
            Setting target parameters within the power semiconductor market requires a strict bifurcation between legacy silicon form-factors and the high-growth wide-bandgap (SiC/GaN) frontier. As leading IDMs transition from component-level sales to integrated sub-systems, financial and operational metrics must adapt to defend margins against commoditization.
          </div>

          <section className="space-y-4">
            <h2 className="text-sm font-mono tracking-widest text-white uppercase border-l-2 border-amber-500 pl-3">
              01. Product Segment Benchmarking & Growth Vectors
            </h2>
            <p>
              Performance metrics in the product landscape are directly tied to the underlying technology lifecycle. The market evaluates growth and pricing power through specialized markers like <strong>Segment Share by Voltage Class</strong> and <strong>Through-Cycle Operating Margin (OPM)</strong>.
            </p>
            <p>
              Legacy topologies, such as <strong>Discrete IGBTs</strong> and <strong>Large IEGTs</strong>, are optimized for asset absorption, targeting stable growth profiles of 4–8% and 5–10% respectively. Conversely, the <strong>Automotive EV Chip</strong> segment operates at an accelerated 20–30% CAGR, evaluated heavily on <strong>Lifetime Design Win Value</strong>. Because power semiconductors dictate the ultimate range and thermal dissipation architecture of electric drivetrains, top-tier IDMs successfully command corporate gross margins of 45–53% and OPMs of 20–30%, heavily insulated by high packaging and processing barriers to entry.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-sm font-mono tracking-widest text-white uppercase border-l-2 border-amber-500 pl-3">
              02. Capital Intensity & The 300mm Silicon Shift
            </h2>
            <p>
              The industry is breaking away from historical capital allocations. Historically, power device fabrication operated at a baseline of 10–13% Capex-to-Sales. To support the massive infrastructure transition from Silicon to Silicon Carbide (SiC), capital intensity has spiked dramatically to <strong>15–25% Capex-to-Sales</strong>, matched by a steady 10–12% R&D intensity dedicated to advanced trench architectures.
            </p>
            <p>
              To maintain cost competitiveness against emerging Chinese market entrants, legacy discrete IGBT manufacturing is migrating aggressively from 200mm to 300mm wafers. This structural migration secures a 20–30% reduction in per-unit die cost, maximizing economies of scale. Concurrently, for critical automotive supply lines, hyperscalers and tier-1 suppliers are underwriting multi-billion dollar vertical integration projects to eliminate geographic supply-chain vulnerabilities.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-sm font-mono tracking-widest text-white uppercase border-l-2 border-amber-500 pl-3">
              03. Customer Verticals: Automotive, Industrial, and Consumer Dynamics
            </h2>
            <p>
              Value-capture strategies are dictated entirely by the end-market application environment, varying sharply across three distinct customer segments:
            </p>
            <ul className="space-y-4 font-mono text-sm text-neutral-400 list-none pl-0 my-6">
              <li className="border border-neutral-800 p-4 bg-[#111113]">
                <strong className="text-white uppercase block mb-1">Automotive (The Premium Tier):</strong> Focused on range extension and zero-defect reliability. Highly sensitive to yield economics, with pricing tied directly to the functional performance gains enabled by SiC transitions.
              </li>
              <li className="border border-neutral-800 p-4 bg-[#111113]">
                <strong className="text-white uppercase block mb-1">Industrial Automation (Systems & Uptime):</strong> Encompasses robotics, green energy grids, and factories. Sustains an 18–25% OPM by shifting away from standalone discrete components toward complex, high-margin system solutions. Driven by absolute energy efficiency targets of 95–99%+, where every 1% optimization mitigates millions in long-term operational expenditure.
              </li>
              <li className="border border-neutral-800 p-4 bg-[#111113]">
                <strong className="text-white uppercase block mb-1">Consumer Electronics (Commoditized Volume):</strong> Cover smartphones, laptops, and white goods. Highly commoditized, squeezing margins to a strict 10–15% OPM. Success is entirely dependent on ultra-short time-to-market windows (&lt;6 months) and relentless unit-cost suppression.
              </li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-sm font-mono tracking-widest text-white uppercase border-l-2 border-amber-500 pl-3">
              04. Structural Pivot to Sub-Systems & Sustainability Metrics
            </h2>
            <p>
              Market leaders (such as Infineon and STMicroelectronics) are executing a core business model transformation. By bundling discrete power switches, gate drivers, and control logic into comprehensive "sub-systems," they insulate their pricing architecture from the deflationary risks of commoditization. 
            </p>
            <p>
              Furthermore, the operational metric matrix is expanding beyond standard fiscal constraints. Leading corporations are increasingly integrating non-financial indicators—such as net CO2 reduction metrics enabled at the client installation level—directly into their core performance dashboards, satisfying stringent sovereign ESG criteria while demonstrating tangible energetic ROI.
            </p>
          </section>

          {/* Matrix Block */}
          <div className="border border-neutral-800 bg-[#111113] p-6 space-y-4 mt-8">
            <div className="font-mono text-xs tracking-widest text-amber-500 uppercase">
              TARGET SPECIFICATION MATRIX // SECTOR BENCHMARKS
            </div>
            <ul className="space-y-3 font-mono text-sm text-neutral-400 list-none pl-0">
              <li className="flex justify-between border-b border-neutral-800 pb-2">
                <span className="text-white">EV CHIPS / SIC CAGR</span>
                <span>20% – 30%</span>
              </li>
              <li className="flex justify-between border-b border-neutral-800 pb-2">
                <span className="text-white">TARGET CORPORATE GROSS MARGIN</span>
                <span>45% – 53%</span>
              </li>
              <li className="flex justify-between border-b border-neutral-800 pb-2">
                <span className="text-white">TRANSITION ADVANCED CAPEX-TO-SALES</span>
                <span>15% – 25%</span>
              </li>
              <li className="flex justify-between border-b border-neutral-800 pb-2">
                <span className="text-white">INDUSTRIAL AUTOMATION TARGET OPM</span>
                <span>18% – 25%</span>
              </li>
            </ul>
          </div>

        </div>

        {/* Right Column: Sticky Sidebar CTA */}
        <div className="lg:col-span-1 lg:sticky lg:top-8 space-y-6">
          <div className="border-t-2 border-white bg-[#111113] p-6 border-x border-b border-neutral-800">
            <div className="font-mono text-xs tracking-widest text-neutral-500 uppercase mb-2">
              ENGAGEMENT PROTOCOL
            </div>
            <h3 className="text-lg font-bold text-white uppercase tracking-tight mb-4 font-mono">
              Semiconductor Business Audit
            </h3>
            <p className="text-xs text-neutral-400 mb-6 leading-relaxed">
              Misaligning capex intensity with node-yield trajectories can lead to severe asset impairment. Maha Strategies audits power semiconductor divisions to structure precise Through-Cycle margin targets and cross-segment capital allocation architectures.
            </p>
            <Link 
              href="/contact?audit=power-semiconductor"
              className="block w-full text-center font-mono text-xs uppercase tracking-widest bg-white text-black py-3 hover:bg-neutral-200 transition-colors font-bold"
            >
              INITIATE TARGET AUDIT
            </Link>
          </div>
          
          <div className="p-4 border border-neutral-900 text-center">
            <span className="font-mono text-xs tracking-widest text-neutral-600 block uppercase">
              SYSTEM STATUS: SECURE // NODE_20
            </span>
          </div>
        </div>

      </div>
    </main>
  );
}