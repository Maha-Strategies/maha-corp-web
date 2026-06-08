import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Corporate Consulting | Maha Strategies',
  description:
    'Advisory on AI hardware, custom silicon strategy, and on-device agentic systems — at the intersection of computing architecture and supply-chain geopolitics.',
  alternates: { canonical: 'https://www.mahastrategies.com/consulting' },
}

export default function ConsultingPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0c] text-zinc-300 font-sans p-8 md:p-24 selection:bg-indigo-500 selection:text-white">
      <div className="max-w-3xl mx-auto">
        <Link
          href="/"
          className="text-xs text-zinc-500 uppercase tracking-widest hover:text-white mb-8 block"
        >
          ← Back to Root Node
        </Link>

        <h1 className="text-4xl text-white font-light tracking-wide mb-6 leading-tight">
          Architecting Infrastructural Sovereignty
        </h1>

        <div className="prose prose-invert max-w-none font-light tracking-wide leading-relaxed">
          <p>
            Technology is no longer just a tool for efficiency — it has become a
            domain of operational and geopolitical leverage. The consulting
            practice at Maha Strategies LLC works at the intersection of deep-tech
            infrastructure, hardware strategy, and supply-chain resilience. This
            is not conventional IT advice. It is structural foresight and
            execution support for organizations operating in high-stakes
            technical environments.
          </p>

          <h2 className="text-2xl text-white font-light mt-12 mb-4">
            Advisory for Analysts &amp; Expert Networks
          </h2>
          <p>
            Maha Strategies is available for engagements through the major expert
            networks — Uzabase, Dialectica, Tegus, ProSapient, and others —
            providing analyst-facing perspective on next-generation computing
            architectures. The aim is to help analysts, asset managers, and
            corporate decision-makers reason clearly about semiconductor supply
            chains, geopolitical choke points, and emerging export controls, and
            to translate hardware-level developments into the macroeconomic
            questions that actually drive decisions.
          </p>

          <h2 className="text-2xl text-white font-light mt-12 mb-4">
            Custom Silicon Strategy &amp; Hardware Geopolitics
          </h2>
          <p>
            Technological independence ultimately rests on the physical layer.
            Our custom-silicon strategy work helps enterprise leaders think
            through the arc of bespoke semiconductor decisions — from initial
            conceptualization to foundry coordination and geopolitical risk — and
            examines computational needs through a geopolitical lens. As
            tech-nationalism intensifies, control over proprietary ASIC and
            RISC-V pipelines becomes a meaningful hedge against platform
            dependency and supply-chain disruption.
          </p>

          <h2 className="text-2xl text-white font-light mt-12 mb-4">
            On-Device Agentic Systems
          </h2>
          <p>
            Beyond hardware, we advise on the architecture of on-device agentic
            systems. This B2B product-engineering work bridges hardware
            constraints and software deployment: resilient, decentralized
            ecosystems that run local models securely at the edge. Prioritizing
            on-device execution reduces reliance on vulnerable cloud APIs and
            keeps enterprise intelligence localized and tamper-resistant.
          </p>

          <div className="mt-16 mb-8">
            <div className="font-mono text-xs tracking-widest text-indigo-500 uppercase mb-4">
              [ FEATURED STRATEGIC ADVISORY ]
            </div>
            <Link
              href="/consulting/migration-to-the-edge"
              className="group block p-6 md:p-8 border border-zinc-800 bg-[#111113] hover:border-zinc-500 transition-colors no-underline"
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                  <h3 className="text-xl font-bold text-zinc-200 group-hover:text-white transition-colors m-0 uppercase tracking-wide">
                    The Migration to the Edge
                  </h3>
                  <p className="font-mono text-xs text-zinc-500 mt-2 m-0 group-hover:text-zinc-400 transition-colors uppercase">
                    Mobile Hardware &amp; The GenAI Replacement Cycle
                  </p>
                </div>
                <div className="font-mono text-xs text-zinc-500 group-hover:text-indigo-400 transition-colors whitespace-nowrap tracking-widest">
                  ACCESS BRIEF &rarr;
                </div>
              </div>
            </Link>
          </div>

          <div className="mt-12 pt-8 border-t border-zinc-800">
            <p className="text-white font-semibold mb-4 tracking-widest uppercase text-xs">
              Work With Maha Strategies
            </p>
            <p className="text-sm text-zinc-500">
              Maha Strategies LLC offers clarity for organizations navigating the
              hardware, silicon, and edge-AI landscape — helping teams move from
              consumers of legacy infrastructure toward ownership of their own
              technical direction.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
