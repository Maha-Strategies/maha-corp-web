import React from 'react';
import Link from 'next/link';

export const metadata = {
  title: 'Maha Strategies | Cybernetic Think Tank & Applied Research',
  description: 'Applied research institute and think tank engineering structural countermeasures against algorithmic capture and metabolic decay.',
};

export default function MahaStrategiesHomepage() {
  return (
    <div className="max-w-5xl w-full mx-auto space-y-24 selection:bg-gray-700 pb-24 pt-12">
      
      {/* HERO SECTION */}
      <header className="space-y-6 border-b border-gray-800 pb-16">
        <div className="font-mono text-xs text-indigo-500 font-semibold tracking-widest uppercase">
          [ CYBERNETIC THINK TANK & APPLIED RESEARCH INSTITUTE ]
        </div>
        <h1 className="font-sans text-5xl sm:text-7xl font-bold tracking-tight text-white leading-none">
          Maha Strategies
        </h1>
        <p className="font-serif text-2xl leading-relaxed text-gray-400 max-w-3xl pt-4">
          Engineering the conditions for human sovereignty. We design the software, policy, and physical architectures required to navigate high-noise environments.
        </p>
      </header>

      {/* THE INSTITUTE (Formerly The Firm) */}
      <section className="space-y-6">
        <h2 className="font-sans text-sm font-semibold tracking-widest uppercase text-white border-l-2 border-indigo-500 pl-4">
          The Institute
        </h2>
        <div className="pl-4 space-y-6 text-gray-300 font-serif text-lg leading-relaxed max-w-3xl">
          <p>
            Maha Strategies operates at the intersection of cognitive science, applied cybernetics, and statecraft. We reject the premise that human executive function must be commodified by centralized hyperscalers.
          </p>
          <p>
            As a think tank and research institute, our mandate is dual-pronged: authoring the legislative and strategic frameworks required to reclaim Biological Capital, while actively engineering the localized software infrastructure (Maha OS) necessary to secure Digital Sovereignty at the edge.
          </p>
        </div>
      </section>

      {/* CORE INFRASTRUCTURE MATRIX */}
      <section className="space-y-8">
        <h2 className="font-sans text-sm font-semibold tracking-widest uppercase text-white border-l-2 border-green-500 pl-4">
          Core Infrastructure
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pl-4">
          
          {/* MAHA OS */}
          <Link href="/os" className="group p-6 border border-gray-800 rounded-lg hover:border-indigo-500 transition-all bg-[#0a0a0c] relative overflow-hidden flex flex-col justify-between">
            <div>
              <div className="font-mono text-xs text-indigo-500 mb-4 tracking-widest uppercase">
                // Engineering
              </div>
              <h3 className="text-xl font-bold text-white mb-2 group-hover:text-indigo-400 transition-colors">
                Maha OS &rarr;
              </h3>
              <p className="font-serif text-sm text-gray-400 leading-relaxed">
                A localized, zero-payload operating environment. Designed to decouple daily compute from macro-grid extraction.
              </p>
            </div>
          </Link>

          {/* POLICY & STATECRAFT */}
          <Link href="/policy" className="group p-6 border border-gray-800 rounded-lg hover:border-indigo-500 transition-all bg-[#0a0a0c] relative overflow-hidden flex flex-col justify-between">
            <div>
              <div className="font-mono text-xs text-indigo-500 mb-4 tracking-widest uppercase">
                // Statecraft
              </div>
              <h3 className="text-xl font-bold text-white mb-2 group-hover:text-indigo-400 transition-colors">
                Policy Directives &rarr;
              </h3>
              <p className="font-serif text-sm text-gray-400 leading-relaxed">
                Legislative architecture and ecological statecraft designed to reclaim Biological Capital and engineer national renewal.
              </p>
            </div>
          </Link>

          {/* INTELLIGENCE */}
          <Link href="/intelligence" className="group p-6 border border-gray-800 rounded-lg hover:border-indigo-500 transition-all bg-[#0a0a0c] relative overflow-hidden flex flex-col justify-between">
            <div>
              <div className="font-mono text-xs text-indigo-500 mb-4 tracking-widest uppercase">
                // Analysis
              </div>
              <h3 className="text-xl font-bold text-white mb-2 group-hover:text-indigo-400 transition-colors">
                Intelligence Briefs &rarr;
              </h3>
              <p className="font-serif text-sm text-gray-400 leading-relaxed">
                High-density research on algorithmic lock-in, hyperscaler storage vulnerabilities, and foundry geopolitics.
              </p>
            </div>
          </Link>

          {/* PROTOCOLS */}
          <Link href="/protocols" className="group p-6 border border-gray-800 rounded-lg hover:border-indigo-500 transition-all bg-[#0a0a0c] relative overflow-hidden flex flex-col justify-between">
            <div>
              <div className="font-mono text-xs text-indigo-500 mb-4 tracking-widest uppercase">
                // Systems
              </div>
              <h3 className="text-xl font-bold text-white mb-2 group-hover:text-indigo-400 transition-colors">
                Protocols &rarr;
              </h3>
              <p className="font-serif text-sm text-gray-400 leading-relaxed">
                Standardized operational procedures for deploying digital firewalls and enforcing hardware sovereignty.
              </p>
            </div>
          </Link>

          {/* DOCTRINE */}
          <Link href="/doctrine" className="group p-6 border border-gray-800 rounded-lg hover:border-indigo-500 transition-all bg-[#0a0a0c] relative overflow-hidden flex flex-col justify-between">
            <div>
              <div className="font-mono text-xs text-indigo-500 mb-4 tracking-widest uppercase">
                // Framework
              </div>
              <h3 className="text-xl font-bold text-white mb-2 group-hover:text-indigo-400 transition-colors">
                Doctrine &rarr;
              </h3>
              <p className="font-serif text-sm text-gray-400 leading-relaxed">
                The philosophical and operational foundations of Thermodynamic Autonomy and Biological Sovereignty.
              </p>
            </div>
          </Link>

          {/* ADVISORY (New) */}
          <Link href="/advisory" className="group p-6 border border-gray-800 rounded-lg hover:border-indigo-500 transition-all bg-[#0a0a0c] relative overflow-hidden flex flex-col justify-between">
            <div>
              <div className="font-mono text-xs text-indigo-500 mb-4 tracking-widest uppercase">
                // Consulting
              </div>
              <h3 className="text-xl font-bold text-white mb-2 group-hover:text-indigo-400 transition-colors">
                Advisory Wing &rarr;
              </h3>
              <p className="font-serif text-sm text-gray-400 leading-relaxed">
                Strategic consulting for municipal entities and enterprise leadership executing the Enclave Strategy.
              </p>
            </div>
          </Link>

        </div>
      </section>

      {/* ACTIVE DEPLOYMENTS */}
      <section className="space-y-6 pt-8 border-t border-gray-800">
        <h2 className="font-sans text-sm font-semibold tracking-widest uppercase text-white border-l-2 border-indigo-500 pl-4">
          Active Deployments
        </h2>
        <ul className="pl-4 space-y-4">
          <li className="flex items-start gap-4">
            <span className="font-mono text-indigo-500 mt-1">01</span>
            <div>
              <h4 className="text-white font-sans font-bold">Maha OS [ Alpha Build ]</h4>
              <p className="text-sm text-gray-400 font-serif mt-1">Closed-loop environment testing in progress. Local-first LLM integration standard.</p>
            </div>
          </li>
          <li className="flex items-start gap-4">
            <span className="font-mono text-indigo-500 mt-1">02</span>
            <div>
              <h4 className="text-white font-sans font-bold">Legislative Architecture 2036</h4>
              <p className="text-sm text-gray-400 font-serif mt-1">Drafting the Five Platform Seeds for municipal and federal adoption.</p>
            </div>
          </li>
          <li className="flex items-start gap-4">
            <span className="font-mono text-indigo-500 mt-1">03</span>
            <div>
              <h4 className="text-white font-sans font-bold">The Node Dispatch</h4>
              <p className="text-sm text-gray-400 font-serif mt-1">Continuous signal broadcast. Archiving systemic vulnerabilities and counter-measures.</p>
            </div>
          </li>
        </ul>
      </section>

    </div>
  );
}