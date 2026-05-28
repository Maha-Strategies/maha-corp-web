import React from "react";
import Link from "next/link";

export const metadata = {
  title: "Orbital Silicon: Rad-Hard GaN-on-SiC Architectures for LEO Constellations",
  description: "An architectural assessment of LEO satellite semiconductor requirements, radiation hardening by design (RHBD), and the thermal superiority of GaN-on-SiC substrates.",
};

export default function Page() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "TechArticle",
    "headline": "Orbital Silicon: Rad-Hard GaN-on-SiC Architectures for LEO Constellations",
    "description": "An architectural assessment of LEO satellite semiconductor requirements, radiation hardening by design (RHBD), and the thermal superiority of GaN-on-SiC substrates.",
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
          INTELLIGENCE BRIEF // CORE.AEROSPACE.SILICON
        </div>
        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-white max-w-4xl uppercase leading-none">
          Orbital Silicon: Rad-Hard GaN-on-SiC Architectures for LEO Constellations
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
              01. The Orbital Hostility Nexus
            </h2>
            <p>
              The Low Earth Orbit (LEO) environment is violently hostile to terrestrial electronics. The dual mandate of high-throughput data transmission (critical for constellations like Starlink and OneWeb) and absolute hardware resilience creates a severe engineering bottleneck. In the vacuum of space, convection is nonexistent; thermal energy cannot be passively air-cooled. Furthermore, the orbital perimeter is saturated with cosmic rays and Van Allen belt radiation capable of instantly degrading or destroying conventional unshielded electronics.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-sm font-mono tracking-widest text-white uppercase border-l-2 border-amber-500 pl-3">
              02. The Wide-Bandgap Imperative (GaN)
            </h2>
            <p>
              Legacy Silicon is structurally obsolete for sub-orbital high-throughput communication payloads. The definitive architectural standard is the Monolithic Microwave Integrated Circuit (MMIC) built utilizing Gallium Nitride (GaN).
            </p>
            <p>
              As a wide-bandgap semiconductor, GaN operates at vastly superior radio frequencies and power densities compared to Silicon. More critically, this wide bandgap provides innate atomic-level shielding; it requires significantly higher kinetic energy from external radiation to dislodge an electron and induce lattice damage, granting the architecture a native resistance to cosmic degradation.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-sm font-mono tracking-widest text-white uppercase border-l-2 border-amber-500 pl-3">
              03. Radiation Hardening By Design (RHBD)
            </h2>
            <p>
              Inherent material resistance is insufficient for mission-critical sovereignty. GaN topologies must be augmented with Radiation Hardening by Design (RHBD). This entails deploying specialized sub-circuit layouts, redundant logic gates, and targeted fabrication lithography that physically and logically mitigate Single Event Upsets (SEUs) and Total Ionizing Dose (TID) degradation over the satellite's operational lifespan.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-sm font-mono tracking-widest text-white uppercase border-l-2 border-amber-500 pl-3">
              04. SiC Substrates as Thermal Conduits
            </h2>
            <p>
              The extreme power density of a GaN MMIC operating at high RF frequencies generates immense localized heat. Without atmospheric convection, this heat must be aggressively conducted away from the active junction to prevent thermal runaway.
            </p>
            <p>
              Growing the GaN device on a Silicon Carbide (SiC) wafer is the critical thermal bypass. SiC acts as an ultra-efficient kinetic heat spreader. To meet high-performance orbital standards, the SiC substrate must demonstrate a thermal conductivity rating of 370 to 490 W/m·K. This enables the semiconductor package to reliably sustain operational junction temperatures (Tj) ranging from -55°C to +225°C, routing lethal heat into the satellite's primary radiator bus.
            </p>
          </section>

          {/* Maha Protocol Patch Block */}
          <div className="border border-neutral-800 bg-[#111113] p-6 space-y-4 mt-8">
            <div className="font-mono text-xs tracking-widest text-amber-500 uppercase">
              MAHA PROTOCOL PATCH // THESIS .045
            </div>
            <p className="text-sm text-white font-mono uppercase tracking-wide">
              DEPRECATING SILICON IN ORBITAL COMMUNICATION
            </p>
            <p className="text-sm text-neutral-400 leading-relaxed">
              Sovereign and commercial LEO operators must strictly deprecate traditional Silicon components within their primary RF payloads. Maha Protocol dictates the exclusive integration of Rad-Hard GaN-on-SiC MMICs for all high-frequency transmitter architectures. The capital expenditure required for SiC wafer processing is immediately offset by the eradication of thermal-induced payload failures and the extended orbital lifespan under intense Van Allen radiation.
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
              Aerospace Silicon & Orbital Resilience Audit
            </h3>
            <p className="text-xs text-neutral-400 mb-6 leading-relaxed">
              Sub-optimal thermal management and inadequate radiation shielding in LEO constellations result in catastrophic payload degradation. Maha Strategies provides specialized engineering audits of orbital silicon architectures, verifying RHBD compliances and GaN-on-SiC integration roadmaps.
            </p>
            <Link 
              href="/contact?audit=aerospace-silicon"
              className="block w-full text-center font-mono text-xs uppercase tracking-widest bg-white text-black py-3 hover:bg-neutral-200 transition-colors font-bold"
            >
              INITIATE AUDIT PROTOCOL
            </Link>
          </div>
          
          <div className="p-4 border border-neutral-900 text-center">
            <span className="font-mono text-xs tracking-widest text-neutral-600 block uppercase">
              SYSTEM STATUS: SECURE // NODE_07
            </span>
          </div>
        </div>

      </div>
    </main>
  );
}