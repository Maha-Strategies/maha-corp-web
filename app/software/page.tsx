import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Maha OS | Sovereign Digital Infrastructure',
  description: 'Reclaim your cognitive baseline. Maha OS is a localized fortress of operations designed to block algorithmic capture.',
  alternates: { canonical: 'https://www.mahastrategies.com/software' },
}

export default function SoftwarePage() {
  return (
    <div className="min-h-screen bg-[#0a0a0c] text-zinc-300 font-sans p-8 md:p-24 selection:bg-indigo-500 selection:text-white">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-4xl text-white font-light tracking-wide mb-6 leading-tight">
          Maha OS: Sovereign Ecosystem
        </h1>
        
        <div className="prose prose-invert max-w-none font-light tracking-wide leading-relaxed">
          <p>
            Software is the primary medium of human-machine interaction, yet modern operating systems have degenerated into mechanisms of surveillance, behavioral capture, and cognitive extraction. Maha OS is our direct intervention.
          </p>
          <p>
            As the cornerstone of a new sovereign digital infrastructure, Maha OS is built from the metal up for systemic resilience. It establishes a local fortress of operations, utilizing on-device agentic systems to ensure that your biometric telemetry, cognitive protocols, and system decisions remain strictly under your command.
          </p>
          
          <div className="mt-12 pt-8 border-t border-zinc-800">
            <a 
              href="https://play.google.com/store/apps/details?id=com.maha.os" 
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block bg-white text-black px-8 py-3 text-xs font-bold uppercase tracking-widest hover:bg-zinc-200 transition-colors"
            >
              Deploy via Google Play
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}