import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Method | Maha Strategies',
  description: 'How Maha Strategies produces decision-ready research: explicit scope, evidence tags, linked sources, and visible uncertainty.',
  alternates: { canonical: '/method' },
}

const tags = [
  ['SOURCED', 'Traceable to an identified source that readers can inspect.'],
  ['VERIFIED', 'Independently checked, recomputed, cross-referenced, or reproduced.'],
  ['ILLUSTRATIVE', 'An estimate or analogy used to clarify reasoning, not to establish a fact.'],
  ['UNVERIFIED', 'A claim that could not be confirmed within scope and is flagged rather than hidden.'],
]

export default function MethodPage() {
  return (
    <main className="min-h-screen bg-[#0a0a0c] text-zinc-300">
      <div className="max-w-4xl mx-auto px-6 py-20 sm:py-28">
        <p className="font-mono text-[10px] text-indigo-400 tracking-widest uppercase mb-4">[ Maha Strategies // Method ]</p>
        <h1 className="text-4xl sm:text-5xl font-light text-white leading-tight mb-6">Research that keeps uncertainty visible.</h1>
        <p className="text-xl text-zinc-400 font-light leading-relaxed max-w-3xl mb-16">Maha Strategies produces decision-ready research for questions where a fluent answer is not enough. The work is scoped to the decision, not to a generic topic, and the evidence record stays visible in the document.</p>

        <section className="grid grid-cols-1 md:grid-cols-3 gap-8 border-t border-zinc-800 pt-10 mb-20">
          <div><p className="font-mono text-[10px] text-indigo-400 tracking-widest uppercase mb-3">01 // Scope</p><p className="text-sm text-zinc-500 leading-relaxed">We define the decision, the deadline, and the question before research begins. A narrow answer that changes a decision is more useful than broad coverage.</p></div>
          <div><p className="font-mono text-[10px] text-indigo-400 tracking-widest uppercase mb-3">02 // Evidence</p><p className="text-sm text-zinc-500 leading-relaxed">Substantive claims are connected to evidence, checked where scope permits, and separated from inference and illustration.</p></div>
          <div><p className="font-mono text-[10px] text-indigo-400 tracking-widest uppercase mb-3">03 // Correction</p><p className="text-sm text-zinc-500 leading-relaxed">When a conclusion changes, the correction belongs in the record. Public research is treated as an accountable body of work, not as a permanent marketing claim.</p></div>
        </section>

        <section className="mb-20">
          <p className="font-mono text-[10px] text-indigo-400 tracking-widest uppercase mb-6">[ The provenance tags ]</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {tags.map(([tag, description]) => <div key={tag} className="border border-zinc-800 p-5"><p className="font-mono text-[10px] text-white tracking-widest mb-3">{tag}</p><p className="text-sm text-zinc-500 leading-relaxed">{description}</p></div>)}
          </div>
        </section>

        <section className="border border-indigo-900/50 bg-indigo-950/20 p-8 sm:p-10 relative overflow-hidden">
          <div className="absolute top-0 left-0 h-full w-1 bg-indigo-500" />
          <p className="font-mono text-[10px] text-indigo-400 tracking-widest uppercase mb-4">[ Put it to work ]</p>
          <h2 className="text-2xl text-white font-light mb-4">Inspect the standard. Then bring the question.</h2>
          <p className="text-zinc-400 leading-relaxed max-w-2xl mb-7">The Maha Provenance Standard explains the tagging system in detail. The live Auditor lets you test a passage. A Verified Research Brief applies the method to a live decision.</p>
          <div className="flex flex-col sm:flex-row gap-4">
            <Link href="/mps" className="inline-block border border-zinc-600 text-zinc-200 font-mono font-bold text-xs tracking-widest uppercase px-6 py-3 hover:border-white hover:text-white transition-colors text-center">Read MPS/0.1 ↗</Link>
            <Link href="/audit" className="inline-block border border-zinc-600 text-zinc-200 font-mono font-bold text-xs tracking-widest uppercase px-6 py-3 hover:border-white hover:text-white transition-colors text-center">Try the Auditor ↗</Link>
            <Link href="/consulting" className="inline-block bg-white text-black font-mono font-bold text-xs tracking-widest uppercase px-6 py-3 hover:bg-zinc-200 transition-colors text-center">Commission a Brief ↗</Link>
          </div>
        </section>
      </div>
    </main>
  )
}
