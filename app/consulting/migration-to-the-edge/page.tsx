import React from "react";
import Link from "next/link";
import { Metadata } from "next";
import { MAHA_ORGANIZATION_ID } from '@/lib/entity'

export const metadata: Metadata = {
  title: "The Migration to the Edge: Mobile Hardware in the GenAI Era | Maha Strategies",
  description:
    "Advisory on the on-device GenAI hardware cycle: NPU baselines, the DRAM squeeze, book-type foldables, and hybrid edge-cloud architecture for the enterprise.",
  alternates: {
    canonical: "https://www.mahastrategies.com/consulting/migration-to-the-edge",
  },
};

export default function MigrationToTheEdgePage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: "The Migration to the Edge: Mobile Hardware in the GenAI Era",
    description:
      "An advisory on the decentralization of the AI inference layer into mobile hardware — NPU baselines, memory constraints, foldable form factors, and hybrid edge-cloud enterprise architecture.",
    author: { '@id': MAHA_ORGANIZATION_ID },
    publisher: { '@id': MAHA_ORGANIZATION_ID },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": "https://www.mahastrategies.com/consulting/migration-to-the-edge",
    },
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
          <Link
            href="/consulting"
            className="font-mono text-xs tracking-widest text-zinc-500 hover:text-white uppercase transition-colors no-underline"
          >
            &larr; BACK TO CONSULTING NODE
          </Link>
        </div>

        {/* Title Block */}
        <header className="border-b border-zinc-800 pb-8 mb-12">
          <div className="font-mono text-xs tracking-widest text-indigo-500 uppercase mb-3">
            STRATEGIC ADVISORY // HARDWARE.GEN_AI
          </div>
          <h1 className="text-3xl md:text-5xl font-light tracking-tight text-white mb-6 uppercase leading-tight">
            The Migration to the Edge
          </h1>
          <p className="text-zinc-400 font-mono text-xs uppercase tracking-widest">
            Mobile Hardware in the GenAI Era
          </p>
        </header>

        {/* Executive Summary */}
        <div className="bg-zinc-950/40 p-6 mb-12 font-mono text-xs md:text-sm leading-relaxed text-zinc-400 border-l-2 border-l-indigo-500">
          <span className="text-white block font-bold mb-2 uppercase tracking-wider">
            [ EXECUTIVE SUMMARY ]
          </span>
          The intelligence layer of the mobile network is beginning to
          decentralize. Driven by demand for low-latency inference and stricter
          data-privacy expectations, a growing share of generative-AI
          computation is moving from the cloud onto the device itself. This is
          not only a software shift; it is reshaping the mobile hardware roadmap
          — and, with it, how enterprise leaders should think about device
          procurement, security architecture, and digital-transformation
          planning.
        </div>

        {/* Article Body */}
        <article className="prose prose-invert max-w-none font-light tracking-wide leading-relaxed space-y-12">
          <section className="space-y-4">
            <h2 className="text-xl md:text-2xl text-white font-mono tracking-wider uppercase border-l border-zinc-700 pl-4 mt-0">
              1. The Limits of Cloud-Only AI
            </h2>
            <p>
              For most of the past decade, mobile AI lived almost entirely in the
              cloud — devices acted as interfaces, sending inputs to remote server
              clusters and waiting for a response. That model carries structural
              costs that are increasingly hard to absorb: network latency,
              data-center power constraints, and the rising expense of scaling
              server-side inference.
            </p>
            <p>
              Privacy and compliance pressures compound the problem. For many
              regulated workloads, routing sensitive corporate or medical data to
              a remote server is a hard constraint rather than a preference. The
              result is a steady pull toward local execution — running capable
              models directly on the device — for the latency-sensitive and
              privacy-sensitive portion of the workload.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl md:text-2xl text-white font-mono tracking-wider uppercase border-l border-zinc-700 pl-4">
              2. The New Hardware Baseline
            </h2>
            <p>
              Running generative AI at the edge changes what matters in a mobile
              chip. The CPU is no longer the constraint; the bottleneck shifts to
              specialized neural silicon and memory bandwidth. Two baselines have
              become central to the 2026 flagship conversation:
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 my-8 not-prose font-mono text-xs">
              <div className="border border-zinc-800 p-5 bg-black">
                <span className="text-indigo-400 block mb-2 font-bold uppercase tracking-wider">
                  ▲ The Ascendancy of the NPU
                </span>
                <p className="text-zinc-400 leading-relaxed m-0">
                  Flagship mobile SoCs are increasingly defined by their Neural
                  Processing Units. To run compact on-device models like Gemini
                  Nano responsively without severe thermal throttling, leading
                  designs now target tens of TOPS of dedicated neural compute —
                  a figure that has climbed quickly across recent flagship
                  generations.
                </p>
              </div>
              <div className="border border-zinc-800 p-5 bg-black">
                <span className="text-zinc-500 block mb-2 font-bold uppercase tracking-wider">
                  ▲ The Memory Squeeze
                </span>
                <p className="text-zinc-400 leading-relaxed m-0">
                  Local models are memory-bound: parameters must be held in fast
                  memory and moved quickly. As a result, higher RAM tiers (16GB
                  of LPDDR5X and beyond) are migrating from premium upsell toward
                  a practical floor for sustained on-device inference — against a
                  backdrop of tightening DRAM supply.
                </p>
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl md:text-2xl text-white font-mono tracking-wider uppercase border-l border-zinc-700 pl-4">
              3. Form Factor: Hardware Built for AI Multitasking
            </h2>
            <p>
              The shape of the device is adapting too. Book-type foldables have
              moved from novelty toward productivity tool, and the market is
              shifting decisively in their favor: Counterpoint Research forecasts
              that book-type devices will reach roughly 65% of global foldable
              shipments in 2026, up from 52% in 2025, driven by higher average
              selling prices and productivity-oriented demand.
            </p>
            <p>
              The strategic value of the form factor is multi-pane work. On-device
              AI is most useful side-by-side with active tasks — a local model
              summarizing or drafting on one pane while a confidential document
              stays open on the other, without that document ever leaving the
              device. In that light, app continuity and dual-pane multitasking
              read less as luxury features and more as enabling conditions for
              edge-AI workflows.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl md:text-2xl text-white font-mono tracking-wider uppercase border-l border-zinc-700 pl-4">
              4. Enterprise Integration
            </h2>
            <p>
              For IT and operations leaders, the practical implication is a move
              away from cloud-by-default toward a hybrid edge-cloud architecture:
              the cloud handles large-scale training and heavy workloads, while
              the edge handles latency- and privacy-sensitive inference. Three
              areas warrant near-term attention:
            </p>

            <ul className="space-y-4 list-none pl-0 font-mono text-xs md:text-sm text-zinc-400 mt-6">
              <li className="p-4 border border-zinc-800 bg-[#111113]">
                <strong className="text-white block mb-1 uppercase tracking-wider">
                  01. Procurement Criteria:
                </strong>
                Device-refresh specs increasingly need to account for NPU
                capability and memory headroom, not just CPU and camera — under-spec'd
                fleets can quietly bottleneck AI-enabled workflows.
              </li>
              <li className="p-4 border border-zinc-800 bg-[#111113]">
                <strong className="text-white block mb-1 uppercase tracking-wider">
                  02. Edge-Aware Security:
                </strong>
                On-device execution and techniques such as federated learning can
                keep sensitive data resident on the hardware, which shifts part of
                the security model toward the device layer rather than the network
                boundary.
              </li>
              <li className="p-4 border border-zinc-800 bg-[#111113]">
                <strong className="text-white block mb-1 uppercase tracking-wider">
                  03. Right-Sized Models:
                </strong>
                Smaller, task-specific models (SLMs) tuned to particular corporate
                functions can run offline with predictable latency, complementing
                larger cloud models rather than replacing them.
              </li>
            </ul>
          </section>

          <section className="space-y-4 pt-4 border-t border-zinc-800">
            <h2 className="text-xl text-white font-mono uppercase tracking-wider m-0">
              Conclusion
            </h2>
            <p>
              The 2026 hardware cycle is less about screens and cameras than about
              where intelligence physically runs. Organizations that plan
              deliberately for the decentralization of the inference layer — in
              procurement, security, and workflow design — stand to gain in speed,
              data control, and resilience as the edge matures.
            </p>
          </section>

          <p className="text-xs text-zinc-600 font-mono pt-6">
            Foldable shipment figures: Counterpoint Research Foldable Smartphone
            Market Forecast (2026). This briefing is general industry analysis,
            not investment advice.
          </p>
        </article>
      </div>
    </main>
  );
}
