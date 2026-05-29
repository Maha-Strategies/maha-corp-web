import React from "react";
import Link from "next/link";

export const metadata = {
  title: "STM Customer Matrix: Legacy Semiconductor Distribution | Intelligence",
  description: "An operational audit of STMicroelectronics' commercial distribution structure, analyzing revenue concentration across Apple, Automotive Tier-1s, and Aerospace.",
};

export default function Page() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "TechArticle",
    "headline": "STM Customer Matrix: Legacy Semiconductor Distribution",
    "description": "An operational audit of STMicroelectronics' commercial distribution structure, analyzing revenue concentration across Apple, Automotive Tier-1s, and Aerospace.",
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
          INTELLIGENCE BRIEF // CORE.SILICON.SUPPLY_CHAIN
        </div>
        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-white max-w-4xl uppercase leading-none">
          STM Customer Matrix: Legacy Semiconductor Distribution
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
            Analyzing the commercial distribution of legacy semiconductors (power devices, MCUs, analog) at STMicroelectronics (STM) reveals a highly concentrated, uneven revenue architecture. While STM generates 40-50% of its total revenue from the broader Automotive and Industrial sectors, a granular look at direct OEM/Tier-1 purchasing exposes severe asymmetric dependencies.
          </div>

          <section className="space-y-4">
            <h2 className="text-sm font-mono tracking-widest text-white uppercase border-l-2 border-amber-500 pl-3">
              01. The 40% Baseline & The Apple Anomaly
            </h2>
            <p>
              The identified cohort of major customers—Apple, Bosch, Continental, Denso, HP, Mobileye, Samsung, SpaceX, Tesla, and Schaeffler—accounts for approximately <strong>35% to 45% of STM's total corporate sales</strong>. (STM explicitly reports that its absolute Top 10 clients generally constitute half of all revenue).
            </p>
            <p>
              However, analyzing this cohort strictly by traditional industry segments (Information Devices vs. Automotive vs. Industrial) creates a mathematical distortion. <strong>Apple is historically STM’s largest single customer, accounting for 12% to 13% of total net revenues.</strong> Because Apple represents roughly one-third of this entire targeted cohort, it cannot be grouped evenly with Samsung or HP; it must be treated as its own anomalous "Super-Segment" driving massive, continuous volume in custom Optical Sensing, Power Management ICs, and MEMS.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-sm font-mono tracking-widest text-white uppercase border-l-2 border-amber-500 pl-3">
              02. The Automotive Core: High-Volume Fragmentation
            </h2>
            <p>
              While the Information Device category is skewed by a single apex predator, the Automotive segment acts as the stable, high-volume core of STM's legacy business. However, distribution within this group is highly uneven.
            </p>
            <p>
              Revenue distribution forms a distinct hierarchy: <strong>Tesla, Bosch, and Continental</strong> constitute the "Big Three," driving the heaviest unit volume and revenue value. Below them sits a middle tier composed of <strong>Denso and Mobileye</strong>, serving as key strategic partners but at medium-to-low relative shares. Finally, players like <strong>Schaeffler</strong> (formerly Vitesco) act as major powertrain specialists but command a significantly smaller direct purchase volume than a tier-one generalist like Bosch.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-sm font-mono tracking-widest text-white uppercase border-l-2 border-amber-500 pl-3">
              03. Aerospace & Niche Validation (SpaceX)
            </h2>
            <p>
              Within the Industrial/Aerospace machinery group, <strong>SpaceX</strong> operates as a prestige, "Flagship" customer. Their financial contribution to STM’s total revenue is statistically negligible—likely representing less than 1% of the listed cohort.
            </p>
            <p>
              SpaceX is categorized as a <em>Low Volume / High Value</em> client. They purchase small quantities of highly expensive, radiation-hardened legacy devices. Their inclusion in the customer matrix is less about revenue dependency and more about engineering validation; servicing SpaceX proves the absolute upper limit of STM's manufacturing quality to the rest of the market.
            </p>
          </section>

          {/* Matrix Block */}
          <div className="border border-neutral-800 bg-[#111113] p-6 space-y-4 mt-8">
            <div className="font-mono text-xs tracking-widest text-amber-500 uppercase">
              REVENUE DISTRIBUTION MATRIX // TARGET COHORT
            </div>
            <ul className="space-y-3 font-mono text-sm text-neutral-400 list-none pl-0">
              <li className="flex justify-between border-b border-neutral-800 pb-2">
                <span className="text-white">APPLE (Super-Segment)</span>
                <span>~12-13% (Total Corporate Revenue)</span>
              </li>
              <li className="flex justify-between border-b border-neutral-800 pb-2">
                <span className="text-white">AUTOMOTIVE "BIG THREE"</span>
                <span>Bosch, Continental, Tesla</span>
              </li>
              <li className="flex justify-between border-b border-neutral-800 pb-2">
                <span className="text-white">AUTOMOTIVE MID-TIER</span>
                <span>Denso, Mobileye, Schaeffler</span>
              </li>
              <li className="flex justify-between border-b border-neutral-800 pb-2">
                <span className="text-white">AEROSPACE VALIDATION</span>
                <span>SpaceX (&lt;1% Volume / High ASP)</span>
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
              Supply Chain & Distribution Audit
            </h3>
            <p className="text-xs text-neutral-400 mb-6 leading-relaxed">
              Misinterpreting legacy semiconductor revenue distribution leads to catastrophic supply chain forecasting. Maha Strategies audits OEM purchasing structures to identify hidden dependencies within Tier-1 and Hyperscaler networks.
            </p>
            <Link 
              href="/contact?audit=supply-chain-distribution"
              className="block w-full text-center font-mono text-xs uppercase tracking-widest bg-white text-black py-3 hover:bg-neutral-200 transition-colors font-bold"
            >
              INITIATE LOGISTICS AUDIT
            </Link>
          </div>
          
          <div className="p-4 border border-neutral-900 text-center">
            <span className="font-mono text-xs tracking-widest text-neutral-600 block uppercase">
              SYSTEM STATUS: SECURE // NODE_21
            </span>
          </div>
        </div>

      </div>
    </main>
  );
}