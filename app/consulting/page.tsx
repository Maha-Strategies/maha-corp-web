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
            [span_11](start_span)In the contemporary global landscape, technology is not merely a tool for efficiency; it is the ultimate domain of geopolitical power and operational sovereignty[span_11](end_span). [span_12](start_span)The corporate consulting division of Maha Strategies LLC operates at the intersection of deep tech infrastructure, custom hardware design, and international supply chain resilience[span_12](end_span).
          </p>

          <h2 className="text-2xl text-white font-light mt-12 mb-4">Strategic Advisory for Elite Expert Networks</h2>
          <p>
            [span_13](start_span)We provide specialized, high-impact advisory services to leading global expert networks—including Uzabase, Dialectica, Tegus, and ProSapient[span_13](end_span). [span_14](start_span)We translate complex hardware capabilities into actionable, long-term macroeconomic strategies[span_14](end_span).
          </p>

          <h2 className="text-2xl text-white font-light mt-12 mb-4">Custom Silicon Strategy & Hardware Geopolitics</h2>
          <p>
            [span_15](start_span)True technological independence requires control over the physical layer[span_15](end_span). [span_16](start_span)Our tailored custom silicon strategy services guide enterprise leaders through the lifecycle of bespoke semiconductor design—from initial conceptualization to foundry coordination and geopolitical risk mitigation[span_16](end_span). 
          </p>

          <h2 className="text-2xl text-white font-light mt-12 mb-4">Sovereign Digital Product Engineering</h2>
          <p>
            [span_17](start_span)Beyond hardware, we advise on the architecture of on-device agentic systems[span_17](end_span). [span_18](start_span)By prioritizing on-device agentic systems, we eliminate reliance on vulnerable cloud APIs, ensuring that your enterprise intelligence remains localized, tamper-resistant, and entirely sovereign[span_18](end_span).
          </p>
        </div>
      </div>
    </div>
  )
}