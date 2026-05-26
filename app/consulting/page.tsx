import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Corporate Consulting | Maha Strategies',
  description: 'Premier AI hardware consulting, custom silicon strategy, and sovereign digital product engineering for global expert networks.',
  alternates: { canonical: 'https://www.mahastrategies.com/consulting' },
}

export default function ConsultingPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0c] text-zinc-300 font-sans p-8 md:p-24 selection:bg-indigo-500 selection:text-white">
      <div className="max-w-3xl mx-auto">
        <Link href="/" className="text-xs text-zinc-500 uppercase tracking-widest hover:text-white mb-8 block">← Back to Root Node</Link>
        
        <h1 className="text-4xl text-white font-light tracking-wide mb-6 leading-tight">
          Architecting Infrastructural Sovereignty
        </h1>
        
        <div className="prose prose-invert max-w-none font-light tracking-wide leading-relaxed">
          <p>
            In the contemporary global landscape, technology is not merely a tool for efficiency; it is the ultimate domain of geopolitical power and operational sovereignty. The corporate consulting division of Maha Strategies LLC operates at the intersection of deep tech infrastructure, custom hardware design, and international supply chain resilience. We do not offer conventional IT advice. We deliver structural foresight and tactical execution for enterprises operating in high-stakes environments.
          </p>

          <h2 className="text-2xl text-white font-light mt-12 mb-4">Strategic Advisory for Elite Expert Networks</h2>
          <p>
            As the leading global authority on next-generation computing architectures, we serve as the premier AI hardware expert network for the world's most sophisticated investment and research institutions. We provide specialized, high-impact advisory services to leading global expert networks—including Uzabase, Dialectica, Tegus, and ProSapient. Our deep industry intelligence empowers analysts, asset managers, and corporate decision-makers to navigate the volatile landscape of global semiconductor supply chains, geopolitical choke points, and emerging export controls. We translate complex hardware capabilities into actionable, long-term macroeconomic strategies.
          </p>

          <h2 className="text-2xl text-white font-light mt-12 mb-4">Custom Silicon Strategy & Hardware Geopolitics</h2>
          <p>
            True technological independence requires control over the physical layer. Our tailored custom silicon strategy services guide enterprise leaders through the lifecycle of bespoke semiconductor design—from initial conceptualization to foundry coordination and geopolitical risk mitigation. We analyze the computational needs of our clients through a rigorous geopolitical lens. In an era of escalating tech-nationalism, securing proprietary ASIC and RISC-V pipelines is not just a technological advantage; it is an existential hedge against platform dependency and supply chain disruption.
          </p>

          <h2 className="text-2xl text-white font-light mt-12 mb-4">Sovereign Digital Product Engineering</h2>
          <p>
            Beyond hardware, we advise on the architecture of on-device agentic systems. Our B2B digital product engineering consulting bridges the gap between hardware constraints and software deployment. We design resilient, decentralized product ecosystems that run local models securely at the edge. By prioritizing on-device agentic systems, we eliminate reliance on vulnerable cloud APIs, ensuring that your enterprise intelligence remains localized, tamper-resistant, and entirely sovereign.
          </p>

          <div className="mt-12 pt-8 border-t border-zinc-800">
             <p className="text-white font-semibold mb-4 tracking-widest uppercase text-xs">Elevate Your Enterprise Architecture</p>
             <p className="text-sm text-zinc-500">
               Maha Strategies LLC provides the clarity required to build, secure, and dominate the digital landscape. Partner with us to transition your organization from a consumer of legacy infrastructure to an architect of your own technological destiny.
             </p>
          </div>
        </div>
      </div>
    </div>
  )
}