import Link from 'next/link';

export default function ProtocolsIndex() {
  return (
    <main className="min-h-screen bg-[#0a0a0a] text-[#e0e0e0] py-24 px-6 sm:px-12 selection:bg-gray-700">
      <div className="max-w-4xl mx-auto">
        
        <header className="mb-16 border-b border-gray-800 pb-8">
          <h1 className="font-sans text-4xl sm:text-5xl font-bold tracking-tight text-white mb-4">
            SYSTEM DOCTRINES
          </h1>
          <p className="font-mono text-sm text-gray-500 uppercase tracking-widest">
            Maha Strategies // Operational Frameworks
          </p>
        </header>

        <div className="space-y-6">
          {/* ARTICLE LINK 05 */}
           <Link href="/protocols/architecting-renewal" className="group block p-6 border border-indigo-900/50 bg-black hover:border-indigo-500 transition-colors rounded-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between">
              <div>
                <p className="font-mono text-xs text-indigo-500 mb-2 group-hover:text-indigo-400 transition-colors">APEX NODE // DEPLOYED</p>
                <h2 className="font-sans text-xl font-bold text-gray-200 group-hover:text-white transition-colors">
                  The Sovereign Ecosystem: Architecting Renewal
                </h2>
              </div>
              <div className="mt-4 sm:mt-0 font-mono text-sm text-indigo-500 group-hover:text-indigo-400 transition-colors">
                [ READ PROTOCOL ]
              </div>
            </div>
          </Link>
          {/* ARTICLE LINK 01 */}
          <Link href="/protocols/metabolic-sovereignty" className="group block p-6 border border-gray-800 bg-black hover:border-gray-500 transition-colors rounded-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between">
              <div>
                <p className="font-mono text-xs text-gray-500 mb-2 group-hover:text-gray-400 transition-colors">NODE v2.0 // DEPLOYED</p>
                <h2 className="font-sans text-xl font-bold text-gray-200 group-hover:text-white transition-colors">
                  The Algorithmic Trance & Metabolic Sovereignty
                </h2>
              </div>
              <div className="mt-4 sm:mt-0 font-mono text-sm text-gray-600 group-hover:text-white transition-colors">
                [ READ PROTOCOL ]
              </div>
            </div>
          </Link>
                  {/* ARTICLE LINK 02 */}
                  <Link href="/protocols/digital-firewall" className="group block p-6 border border-gray-800 bg-black hover:border-gray-500 transition-colors rounded-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between">
              <div>
                <p className="font-mono text-xs text-gray-500 mb-2 group-hover:text-gray-400 transition-colors">NODE v2.0 // DEPLOYED</p>
                <h2 className="font-sans text-xl font-bold text-gray-200 group-hover:text-white transition-colors">
                  The Saturnian Perimeter & The Digital Firewall
                </h2>
              </div>
              <div className="mt-4 sm:mt-0 font-mono text-sm text-gray-600 group-hover:text-white transition-colors">
                [ READ PROTOCOL ]
              </div>
            </div>
          </Link>
                    {/* ARTICLE LINK 03 */}
                    <Link href="/protocols/kinetic-friction" className="group block p-6 border border-gray-800 bg-black hover:border-gray-500 transition-colors rounded-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between">
              <div>
                <p className="font-mono text-xs text-gray-500 mb-2 group-hover:text-gray-400 transition-colors">NODE v2.0 // DEPLOYED</p>
                <h2 className="font-sans text-xl font-bold text-gray-200 group-hover:text-white transition-colors">
                  The Iron Engine & The Necessity of Friction
                </h2>
              </div>
              <div className="mt-4 sm:mt-0 font-mono text-sm text-gray-600 group-hover:text-white transition-colors">
                [ READ PROTOCOL ]
              </div>
            </div>
          </Link>
                    {/* ARTICLE LINK 04 */}
                    <Link href="/protocols/hardware-sovereignty" className="group block p-6 border border-gray-800 bg-black hover:border-gray-500 transition-colors rounded-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between">
              <div>
                <p className="font-mono text-xs text-gray-500 mb-2 group-hover:text-gray-400 transition-colors">NODE v2.0 // DEPLOYED</p>
                <h2 className="font-sans text-xl font-bold text-gray-200 group-hover:text-white transition-colors">
                  Hardware Sovereignty & Edge-Compute Intelligence
                </h2>
              </div>
              <div className="mt-4 sm:mt-0 font-mono text-sm text-gray-600 group-hover:text-white transition-colors">
                [ READ PROTOCOL ]
              </div>
            </div>
          </Link>
          {/* Future articles will be added here as new <Link> blocks */}
        </div>

      </div>
    </main>
  );
}