import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Maha OS | Sovereign Digital Infrastructure',
  description: 'Reclaim your cognitive baseline. Maha OS is a localized fortress of operations utilizing edge-compute architecture to block algorithmic capture.',
  alternates: { canonical: 'https://www.mahastrategies.com/software' },
}

export default function SoftwarePage() {
  return (
    <div className="min-h-screen bg-[#0a0a0c] text-zinc-300 font-sans p-8 md:p-24 selection:bg-indigo-500 selection:text-white">
      <div className="max-w-3xl mx-auto">
        <Link href="/" className="text-xs text-zinc-500 uppercase tracking-widest hover:text-white mb-8 block">← Back to Root Node</Link>
        
        <h1 className="text-4xl text-white font-light tracking-wide mb-6 leading-tight">
          Maha OS: Sovereign Ecosystem
        </h1>
        
        <div className="prose prose-invert max-w-none font-light tracking-wide leading-relaxed">
          <p className="text-xl text-zinc-400 mb-12">
            Software is the primary medium of human-machine interaction, yet legacy operating systems have degenerated into mechanisms of surveillance, behavioral capture, and cognitive extraction. Maha OS is our direct intervention.
          </p>

          <h2 className="text-2xl text-white font-light mt-12 mb-4">The Threat Landscape</h2>
          <p>
            The modern digital economy operates on a model of cognitive extraction. Legacy platforms weaponize algorithmic feedback loops to induce attentional capture, tracking your behavioral patterns to manipulate your autonomic nervous system. This continuous extraction compromises your biological sovereignty and degrades your cognitive baseline. Cognitive defense software is no longer a luxury; it is a foundational requirement for anyone operating in high-stakes environments.
          </p>

          <h2 className="text-2xl text-white font-light mt-12 mb-4">Edge-Compute Architecture</h2>
          <p>
            Maha OS neutralizes these threats by entirely rethinking the processing pipeline. Built on a strict edge-compute architecture, the system operates locally on your device. We utilize zero-payload processing, meaning your biometric telemetry and cognitive protocols are never transmitted to external servers. By decoupling your operations from vulnerable cloud APIs, Maha OS eliminates the structural dependencies that allow algorithmic manipulation and third-party surveillance.
          </p>

          <h2 className="text-2xl text-white font-light mt-12 mb-4">The Local Fortress</h2>
          <p>
            As the cornerstone of your new sovereign digital infrastructure, Maha OS establishes an impenetrable local fortress. Leveraging ultra-fast, local storage engines like MMKV and SQLite, your data remains strictly partitioned and encrypted on the metal itself. Maha OS treats compute as a private, sovereign utility—ensuring that your data, decisions, and biological systems remain entirely under your command.
          </p>
          {/* RESEARCH COUPLING FRAMEWORK */}
<div className="mt-8 border border-zinc-900 bg-black/40 p-6 font-mono text-xs text-zinc-400">
  <span className="text-white block font-bold mb-1 uppercase tracking-wider">FOUNDATIONAL WHITE-PAPER //</span>
  For a full clinical and technical diagnostic of how algorithmic systems enforce attentional exploitation and why hardware-level circuit breakers are mandatory, inspect our latest research publication.
  <Link href="/research/architecture-of-attention" className="block text-indigo-400 hover:text-indigo-300 mt-3 uppercase tracking-widest no-underline">
    [ ACCESS ARTICLE: THE ARCHITECTURE OF ATTENTION &rarr; ]
  </Link>
</div>
          <div className="mt-12 pt-8 border-t border-zinc-800">
             <p className="text-white font-semibold mb-4 tracking-widest uppercase text-xs">Deploy the Infrastructure</p>
             <p className="text-sm text-zinc-500 mb-6">
               Transition your device from an extraction node to a sovereign fortress.
             </p>
            <a 
              href="https://play.google.com/store/apps/details?id=com.maha.os" 
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block bg-white text-black px-8 py-3 text-xs font-bold uppercase tracking-widest hover:bg-zinc-200 transition-colors"
            >
              Initialize via Google Play
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}