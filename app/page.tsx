import Link from 'next/link'

export function ProtocolAnchorGrid() {
  const protocols = [
    {
      id: "01",
      title: "Metabolic Sovereignty",
      subtitle: "The Algorithmic Trance & Biological Substrates",
      href: "/protocols/metabolic-sovereignty",
      status: "ACTIVE"
    },
    {
      id: "02",
      title: "The Digital Firewall",
      subtitle: "The Saturnian Perimeter & Cognitive Defense",
      href: "/protocols/digital-firewall",
      status: "ACTIVE"
    },
    {
      id: "03",
      title: "Kinetic Friction",
      subtitle: "The Iron Engine & Engineered Resistance",
      href: "/protocols/kinetic-friction",
      status: "ACTIVE"
    },
    {
      id: "04",
      title: "Hardware Sovereignty",
      subtitle: "Edge-Compute Intelligence & Local Silicon",
      href: "/protocols/hardware-sovereignty",
      status: "ACTIVE"
    },
    {
      id: "05",
      title: "Architecting Renewal",
      subtitle: "The Sovereign Ecosystem Apex Node",
      href: "/protocols/architecting-renewal",
      status: "STABLE",
      isApex: true
    }
  ];

  return (
    <section className="w-full py-20 border-t border-gray-950 bg-[#0a0a0c] text-white">
      <div className="max-w-4xl mx-auto px-6 font-mono">
        
        {/* SECTION ROUTING LABEL */}
        <div className="text-xs text-gray-600 tracking-widest uppercase mb-12 flex justify-between items-center">
          <span>[ LINKING_MATRIX // LIVE_ROUTING ]</span>
          <span>SYSTEMIC_DEFAULTS: ENFORCED</span>
        </div>

        <h2 className="font-sans text-2xl font-bold tracking-tight text-gray-200 mb-8 uppercase">
          Core Systemic Doctrines
        </h2>

        {/* THE ANCHOR PIPE MATRIX */}
        <div className="grid grid-cols-1 gap-4">
          {protocols.map((protocol) => (
            <Link 
              key={protocol.id} 
              href={protocol.href}
              className={`group block p-6 border transition-all duration-200 ${
                protocol.isApex 
                  ? "border-indigo-950 bg-indigo-950/10 hover:border-indigo-500" 
                  : "border-gray-900 bg-black/40 hover:border-gray-600"
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs ${protocol.isApex ? "text-indigo-400" : "text-gray-500"}`}>
                      NODE_{protocol.id}
                    </span>
                    <span className="text-[10px] bg-gray-900 px-1.5 py-0.5 text-gray-400 border border-gray-800 tracking-tighter">
                      {protocol.status}
                    </span>
                  </div>
                  <h3 className="font-sans text-xl font-bold text-gray-100 group-hover:text-white transition-colors">
                    {protocol.title}
                  </h3>
                  <p className="text-xs text-gray-400 font-serif italic">
                    {protocol.subtitle}
                  </p>
                </div>
                
                <div className="text-xs text-gray-500 group-hover:text-white font-mono transition-colors self-end sm:self-center">
                  [ DEPLOY_LINK ↗ ]
                </div>
              </div>
            </Link>
          ))}
        </div>
        
      </div>
    </section>
  );
}

export default function CorporateHomepage() {
  return (
    <div className="min-h-screen bg-[#0a0a0c] text-zinc-300 font-sans p-8 md:p-24 md:pb-0 selection:bg-indigo-500 selection:text-white">
      <div className="max-w-4xl mx-auto">
        
        <h1 className="text-4xl md:text-5xl font-light tracking-widest uppercase text-white mb-6">
          Maha Strategies LLC
        </h1>

        {/* THE MANIFESTO APEX LINK */}
        <div className="mb-12 not-prose">
          <Link href="/manifesto" className="text-indigo-400 font-mono text-xs uppercase tracking-widest hover:text-white transition-colors">
            [ Read the Core Doctrine: The Maha Principle Manifesto ↗ ]
          </Link>
        </div>
        
        <div className="prose prose-invert max-w-none font-light tracking-wide leading-relaxed">
          <p className="text-xl text-zinc-400 mb-12">
            In an era defined by cascading dependencies and centralized choke points, the ultimate strategic commodity is autonomy. Maha Strategies LLC exists to secure this autonomy at every layer of the modern stack—from physical silicon to individual consciousness. We call this Systemic Sovereignty.
          </p>
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
          <p className="mt-8 mb-16 font-bold text-white tracking-widest uppercase text-xs">
            We are Maha Strategies LLC. The architecture of independence begins here.
          </p>

          {/* THE TOP-OF-FUNNEL GATEWAY INJECTION */}
          <div className="mb-24 border border-indigo-900/50 bg-indigo-950/20 p-8 sm:p-12 relative overflow-hidden not-prose">
            <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500"></div>
            <h2 className="text-white font-mono text-sm tracking-widest uppercase mb-4 mt-0">
              [ PROTOCOL 001 // INITIALIZATION ]
            </h2>
            <p className="text-zinc-300 text-lg mb-8 font-light">
              The modern industrial environment is not designed to support your life; it is designed to harvest your attention and your biology for profit. Secure your perimeter. 
            </p>
            <Link
              href="/start"
              className="inline-block bg-white text-black font-mono font-bold text-xs tracking-widest uppercase px-8 py-4 hover:bg-zinc-200 transition-colors no-underline"
            >
              Enter The Stronghold (Start Here) ↗
            </Link>
          </div>
        </div>
      </div>

      {/* THE INTEGRATION: This is where the grid renders */}
      <ProtocolAnchorGrid />
      
    </div>
  )
}