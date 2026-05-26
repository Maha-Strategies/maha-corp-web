import Link from 'next/link'

export default function CorporateHomepage() {
  return (
    <div className="min-h-screen bg-[#0a0a0c] text-zinc-300 font-sans p-8 md:p-24 selection:bg-indigo-500 selection:text-white">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl md:text-5xl font-light tracking-widest uppercase text-white mb-8">
          Maha Strategies LLC
        </h1>
        
        <div className="prose prose-invert max-w-none font-light tracking-wide leading-relaxed">
          <p className="text-xl text-zinc-400 mb-12">
            In an era defined by cascading dependencies and centralized choke points, the ultimate strategic commodity is autonomy. Maha Strategies LLC exists to secure this autonomy at every layer of the modern stack—from physical silicon to individual consciousness. We call this Systemic Sovereignty.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
            <div className="border-t border-zinc-800 pt-6">
              <h3 className="text-white text-sm tracking-widest uppercase mb-4">I. Infrastructure</h3>
              <p className="text-sm text-zinc-500">
                Through our premier AI hardware consulting and custom silicon division, we advise expert networks, sovereign entities, and digital product engineering teams on navigating the high-friction realities of the global semiconductor supply chain.
              </p>
            </div>
            <div className="border-t border-zinc-800 pt-6">
              <h3 className="text-white text-sm tracking-widest uppercase mb-4">II. Interface</h3>
              <p className="text-sm text-zinc-500">
                Maha OS is our direct intervention. By treating compute as a private, sovereign utility, Maha OS establishes a local fortress of operations, ensuring that your data, decisions, and systems remain strictly under your command.
              </p>
            </div>
            <div className="border-t border-zinc-800 pt-6">
              <h3 className="text-white text-sm tracking-widest uppercase mb-4">III. Intellect</h3>
              <p className="text-sm text-zinc-500">
                Through Agentic Publishing, our intellectual property division, we publish foundational frameworks, sovereign blueprints, and strategic research that equip elite actors to resist narrative capture.
              </p>
            </div>
          </div>

          <h2 className="text-2xl text-white font-light mb-4">The Sovereign Synthesis</h2>
          <p>
            We do not view hardware, software, and intellect as disparate domains. They are the contiguous layers of a single, unified reality. A vulnerability in custom silicon compromises Maha OS; a vulnerability in Maha OS compromises the mind; a compromised mind cannot defend its infrastructure.
          </p>
          <p className="mt-8 font-bold text-white tracking-widest uppercase text-xs">
            We are Maha Strategies LLC. The architecture of independence begins here.
          </p>
        </div>
      </div>
    </div>
  )
}