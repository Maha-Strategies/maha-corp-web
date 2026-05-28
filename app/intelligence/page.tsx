import React from 'react';
import Link from 'next/link';

export const metadata = {
  title: 'Intelligence | Maha Strategies LLC',
  description: 'Active market intelligence, structural audits, and proprietary geopolitical analysis.',
};

export default function IntelligenceGrid() {
  return (
    <main className="min-h-screen bg-[#0a0a0c] text-[#e0e0e0] py-16 px-6 sm:px-12 selection:bg-indigo-500 selection:text-white">
      <div className="max-w-4xl mx-auto">
        
        {/* HEADER */}
        <header className="mb-12 border-b border-gray-800 pb-8">
          <h1 className="font-sans text-3xl sm:text-4xl font-bold uppercase tracking-tight text-white mb-2">
            Active Intelligence
          </h1>
          <p className="font-mono text-sm text-gray-500 tracking-widest uppercase">
            [ Flash-Opinions // Structural Audits // Market Signals ]
          </p>
        </header>

        {/* THE GRID */}
        <div className="grid grid-cols-1 gap-6">
          
          {/* SEMICONDUCTOR BRIEF NODE */}
          <Link 
            href="/intelligence/briefs/semiconductor-bifurcation" 
            className="block p-8 border border-zinc-800 bg-black hover:border-indigo-500 transition-colors group"
          >
            <div className="flex justify-between items-start mb-4">
              <p className="font-mono text-[10px] sm:text-xs text-red-400 tracking-widest uppercase">
                STATUS: CRITICAL PRIORITY
              </p>
              <span className="text-gray-600 font-mono text-xs group-hover:text-indigo-400 transition-colors">
                [ READ ↗ ]
              </span>
            </div>
            
            <h2 className="font-sans text-2xl font-bold text-white group-hover:text-indigo-300 transition-colors uppercase tracking-tight mb-2">
              The Bifurcation of Silicon
            </h2>
            
            <p className="font-serif text-gray-400 leading-relaxed max-w-2xl">
              An intelligence brief on the structural shift from open innovation to secure, sovereign semiconductor supply chains in the wake of geopolitical friction.
            </p>
          </Link>
          {/* NODE: PHYSICAL AI BRIEF */}
<Link 
  href="/intelligence/briefs/physical-ai-deployment" 
  className="block p-8 border border-zinc-800 bg-black hover:border-indigo-500 transition-colors group"
>
  <div className="flex justify-between items-start mb-4">
    <p className="font-mono text-[10px] sm:text-xs text-yellow-500 tracking-widest uppercase">
      STATUS: STRUCTURAL SHIFT
    </p>
    <span className="text-gray-600 font-mono text-xs group-hover:text-indigo-400 transition-colors">
      [ READ ↗ ]
    </span>
  </div>
  
  <h2 className="font-sans text-2xl font-bold text-white group-hover:text-indigo-300 transition-colors uppercase tracking-tight mb-2">
    Embodied Intelligence
  </h2>
  
  <p className="font-serif text-gray-400 leading-relaxed max-w-2xl">
    An intelligence brief on the transition to Vision-Language-Action (VLA) models, edge-compute scaling, and the geopolitical moats of localized hardware processing.
  </p>
</Link>
{/* NODE: ALGORITHMIC LOCK-IN BRIEF */}
<Link 
  href="/intelligence/briefs/algorithmic-lock-in" 
  className="block p-8 border border-zinc-800 bg-black hover:border-indigo-500 transition-colors group"
>
  <div className="flex justify-between items-start mb-4">
    <p className="font-mono text-[10px] sm:text-xs text-fuchsia-500 tracking-widest uppercase">
      STATUS: BEHAVIORAL CAPTURE
    </p>
    <span className="text-gray-600 font-mono text-xs group-hover:text-indigo-400 transition-colors">
      [ READ ↗ ]
    </span>
  </div>
  
  <h2 className="font-sans text-2xl font-bold text-white group-hover:text-indigo-300 transition-colors uppercase tracking-tight mb-2">
    Algorithmic Lock-In
  </h2>
  
  <p className="font-serif text-gray-400 leading-relaxed max-w-2xl">
    An intelligence brief on digital native behavioral loops, social currency in mobile gaming ecosystems, and vectors of cognitive capture.
  </p>
</Link>
<Link 
  href="/intelligence/briefs/backside-microchannel-semiconductors" 
  className="group block border border-neutral-800 bg-[#0a0a0c] p-6 hover:border-neutral-500 transition-all duration-200"
>
  <div className="flex items-center justify-between mb-4">
    <span className="font-mono text-xs tracking-widest text-amber-500 uppercase">
      HARDWARE.THERMAL
    </span>
    <span className="font-mono text-xs tracking-widest bg-neutral-900 text-neutral-400 px-2 py-0.5 border border-neutral-800 uppercase group-hover:border-neutral-600">
      STATUS: CRITICAL
    </span>
  </div>
  <h3 className="text-xl font-bold text-white uppercase tracking-tight group-hover:text-amber-500 transition-colors mb-2">
    Monolithic Backside Microfluidics: Bypassing the Silicon Thermal Wall
  </h3>
  <p className="text-sm text-neutral-400 line-clamp-3 leading-relaxed">
    An architectural evaluation of sub-node thermal management limitations, DRIE defectivity vectors, and the strategic pivot toward monolithic buried channel processing.
  </p>
  <div className="mt-6 flex items-center gap-2 text-xs font-mono tracking-widest text-white uppercase">
    ACCESS DATA DEEP-DIVE <span className="group-hover:translate-x-1 transition-transform">→</span>
  </div>
</Link>
<Link 
  href="/intelligence/briefs/known-good-die-storage-yield" 
  className="group block border border-neutral-800 bg-[#0a0a0c] p-6 hover:border-neutral-500 transition-all duration-200"
>
  <div className="flex items-center justify-between mb-4">
    <span className="font-mono text-xs tracking-widest text-amber-500 uppercase">
      HARDWARE.LOGISTICS
    </span>
    <span className="font-mono text-xs tracking-widest bg-neutral-900 text-neutral-400 px-2 py-0.5 border border-neutral-800 uppercase group-hover:border-neutral-600">
      STATUS: COMPLIANCE
    </span>
  </div>
  <h3 className="text-xl font-bold text-white uppercase tracking-tight group-hover:text-amber-500 transition-colors mb-2">
    Known Good Die Preservation: Mitigating Post-Dicing Degradation Vectors
  </h3>
  <p className="text-sm text-neutral-400 line-clamp-3 leading-relaxed">
    An architectural evaluation of surplus bare die storage methodologies, adhesive-induced mechanical micro-cracking, and environmental degradation mitigation systems.
  </p>
  <div className="mt-6 flex items-center gap-2 text-xs font-mono tracking-widest text-white uppercase">
    ACCESS DATA DEEP-DIVE <span className="group-hover:translate-x-1 transition-transform">→</span>
  </div>
</Link>   
<Link 
  href="/intelligence/briefs/high-purity-alumina-manufacturing-architecture" 
  className="group block border border-neutral-800 bg-[#0a0a0c] p-6 hover:border-neutral-500 transition-all duration-200"
>
  <div className="flex items-center justify-between mb-4">
    <span className="font-mono text-xs tracking-widest text-amber-500 uppercase">
      HARDWARE.MATERIALS
    </span>
    <span className="font-mono text-xs tracking-widest bg-neutral-900 text-neutral-400 px-2 py-0.5 border border-neutral-800 uppercase group-hover:border-neutral-600">
      STATUS: ACTIVE
    </span>
  </div>
  <h3 className="text-xl font-bold text-white uppercase tracking-tight group-hover:text-amber-500 transition-colors mb-2">
    High-Purity Alumina Architecture: Synthesis Vectors and Sub-Nanometer Yields
  </h3>
  <p className="text-sm text-neutral-400 line-clamp-3 leading-relaxed">
    An architectural assessment of 5N/6N HPA manufacturing, bauxite-independent hydrometallurgy, and high-margin deployment across advanced logic fabs and energy storage arrays.
  </p>
  <div className="mt-6 flex items-center gap-2 text-xs font-mono tracking-widest text-white uppercase">
    ACCESS DATA DEEP-DIVE <span className="group-hover:translate-x-1 transition-transform">→</span>
  </div>
</Link>
<Link 
  href="/intelligence/briefs/angstrom-era-soc-architecture" 
  className="group block border border-neutral-800 bg-[#0a0a0c] p-6 hover:border-neutral-500 transition-all duration-200"
>
  <div className="flex items-center justify-between mb-4">
    <span className="font-mono text-xs tracking-widest text-amber-500 uppercase">
      SILICON.NODES
    </span>
    <span className="font-mono text-xs tracking-widest bg-neutral-900 text-neutral-400 px-2 py-0.5 border border-neutral-800 uppercase group-hover:border-neutral-600">
      STATUS: ACTIVE
    </span>
  </div>
  <h3 className="text-xl font-bold text-white uppercase tracking-tight group-hover:text-amber-500 transition-colors mb-2">
    Angstrom-Era SoC Architecture: The 2nm Transition and Edge AI
  </h3>
  <p className="text-sm text-neutral-400 line-clamp-3 leading-relaxed">
    An architectural assessment of sub-3nm node migration, Backside Power Delivery Networks, CFET stacking, and the sovereign imperative for Angstrom-era fabrication policies.
  </p>
  <div className="mt-6 flex items-center gap-2 text-xs font-mono tracking-widest text-white uppercase">
    ACCESS DATA DEEP-DIVE <span className="group-hover:translate-x-1 transition-transform">→</span>
  </div>
</Link>
<Link 
  href="/intelligence/briefs/rad-hard-gan-sic-leo-satellites" 
  className="group block border border-neutral-800 bg-[#0a0a0c] p-6 hover:border-neutral-500 transition-all duration-200"
>
  <div className="flex items-center justify-between mb-4">
    <span className="font-mono text-xs tracking-widest text-amber-500 uppercase">
      AEROSPACE.SILICON
    </span>
    <span className="font-mono text-xs tracking-widest bg-neutral-900 text-neutral-400 px-2 py-0.5 border border-neutral-800 uppercase group-hover:border-neutral-600">
      STATUS: CRITICAL
    </span>
  </div>
  <h3 className="text-xl font-bold text-white uppercase tracking-tight group-hover:text-amber-500 transition-colors mb-2">
    Orbital Silicon: Rad-Hard GaN-on-SiC Architectures for LEO Constellations
  </h3>
  <p className="text-sm text-neutral-400 line-clamp-3 leading-relaxed">
    An architectural evaluation of semiconductor vulnerability in orbit, detailing the thermal and rad-hard imperatives for deploying GaN-on-SiC logic in high-throughput satellite payloads.
  </p>
  <div className="mt-6 flex items-center gap-2 text-xs font-mono tracking-widest text-white uppercase">
    ACCESS DATA DEEP-DIVE <span className="group-hover:translate-x-1 transition-transform">→</span>
  </div>
</Link>
<Link 
  href="/intelligence/briefs/generative-ai-silicon-cycle-recalibration" 
  className="group block border border-neutral-800 bg-[#0a0a0c] p-6 hover:border-neutral-500 transition-all duration-200"
>
  <div className="flex items-center justify-between mb-4">
    <span className="font-mono text-xs tracking-widest text-amber-500 uppercase">
      MACRO.SILICON
    </span>
    <span className="font-mono text-xs tracking-widest bg-neutral-900 text-neutral-400 px-2 py-0.5 border border-neutral-800 uppercase group-hover:border-neutral-600">
      STATUS: VOLATILE
    </span>
  </div>
  <h3 className="text-xl font-bold text-white uppercase tracking-tight group-hover:text-amber-500 transition-colors mb-2">
    The Generative AI Distortion: Recalibrating the Silicon Boom-Bust Cycle
  </h3>
  <p className="text-sm text-neutral-400 line-clamp-3 leading-relaxed">
    An architectural evaluation of the incoming CapEx super-cycle oversupply, the enterprise infrastructure digestion phase, and the resulting bifurcated "growth recession" in semiconductor markets.
  </p>
  <div className="mt-6 flex items-center gap-2 text-xs font-mono tracking-widest text-white uppercase">
    ACCESS DATA DEEP-DIVE <span className="group-hover:translate-x-1 transition-transform">→</span>
  </div>
</Link>
<Link 
  href="/intelligence/briefs/semiconductor-wfe-doping-annealing-landscape" 
  className="group block border border-neutral-800 bg-[#0a0a0c] p-6 hover:border-neutral-500 transition-all duration-200"
>
  <div className="flex items-center justify-between mb-4">
    <span className="font-mono text-xs tracking-widest text-amber-500 uppercase">
      WFE.MARKETSTRUCTURE
    </span>
    <span className="font-mono text-xs tracking-widest bg-neutral-900 text-neutral-400 px-2 py-0.5 border border-neutral-800 uppercase group-hover:border-neutral-600">
      STATUS: TRANSITIONING
    </span>
  </div>
  <h3 className="text-xl font-bold text-white uppercase tracking-tight group-hover:text-amber-500 transition-colors mb-2">
    Semiconductor WFE Architecture: Geopolitical Bifurcation and Thermal Budget Physics
  </h3>
  <p className="text-sm text-neutral-400 line-clamp-3 leading-relaxed">
    An exhaustive quantitative re-mapping of global ion implantation and advanced laser annealing market shares, evaluating the 2024 baseline against structural 2035 sovereign localization trends.
  </p>
  <div className="mt-6 flex items-center gap-2 text-xs font-mono tracking-widest text-white uppercase">
    ACCESS DATA DEEP-DIVE <span className="group-hover:translate-x-1 transition-transform">→</span>
  </div>
</Link>
<Link 
  href="/intelligence/briefs/power-semiconductor-target-setting-metrics" 
  className="group block border border-neutral-800 bg-[#0a0a0c] p-6 hover:border-neutral-500 transition-all duration-200"
>
  <div className="flex items-center justify-between mb-4">
    <span className="font-mono text-xs tracking-widest text-amber-500 uppercase">
      POWER.STRATEGY
    </span>
    <span className="font-mono text-xs tracking-widest bg-neutral-900 text-neutral-400 px-2 py-0.5 border border-neutral-800 uppercase group-hover:border-neutral-600">
      STATUS: ACTIVE
    </span>
  </div>
  <h3 className="text-xl font-bold text-white uppercase tracking-tight group-hover:text-amber-500 transition-colors mb-2">
    Power Semiconductor Architecture: Strategic Target Calibration Across Nodes
  </h3>
  <p className="text-sm text-neutral-400 line-clamp-3 leading-relaxed">
    An operational evaluation of capital deployment matrices, corporate margin optimization targets, and systemic sub-system transitions within global IGBT, IEGT, and SiC manufacturing pipelines.
  </p>
  <div className="mt-6 flex items-center gap-2 text-xs font-mono tracking-widest text-white uppercase">
    ACCESS DATA DEEP-DIVE <span className="group-hover:translate-x-1 transition-transform">→</span>
  </div>
</Link>
<Link 
  href="/intelligence/briefs/tensor-network-ai-compression" 
  className="group block border border-neutral-800 bg-[#0a0a0c] p-6 hover:border-neutral-500 transition-all duration-200"
>
  <div className="flex items-center justify-between mb-4">
    <span className="font-mono text-xs tracking-widest text-amber-500 uppercase">
      AI.OPTIMIZATION
    </span>
    <span className="font-mono text-xs tracking-widest bg-neutral-900 text-neutral-400 px-2 py-0.5 border border-neutral-800 uppercase group-hover:border-neutral-600">
      STATUS: ACTIVE
    </span>
  </div>
  <h3 className="text-xl font-bold text-white uppercase tracking-tight group-hover:text-amber-500 transition-colors mb-2">
    Tensor Network Compression: Assessing CompactifAI and Quantum-Inspired LLM Optimization
  </h3>
  <p className="text-sm text-neutral-400 line-clamp-3 leading-relaxed">
    An architectural and IP evaluation of Multiverse Computing's tensor network decomposition frameworks, highlighting structural advantages over SOTA quantization and the steep &gt;60% IP imitation difficulty.
  </p>
  <div className="mt-6 flex items-center gap-2 text-xs font-mono tracking-widest text-white uppercase">
    ACCESS DATA DEEP-DIVE <span className="group-hover:translate-x-1 transition-transform">→</span>
  </div>
</Link>
<Link 
  href="/intelligence/briefs/neurotechnology-non-medical-outlook" 
  className="group block border border-neutral-800 bg-[#0a0a0c] p-6 hover:border-neutral-500 transition-all duration-200 flex flex-col justify-between"
>
  <div>
    <div className="flex items-center justify-between mb-4">
      <span className="font-mono text-xs tracking-widest text-amber-500 uppercase">
        NEURO.SOCIETY
      </span>
      <span className="font-mono text-xs tracking-widest bg-neutral-900 text-neutral-400 px-2 py-0.5 border border-neutral-800 uppercase group-hover:border-neutral-600">
        STATUS: EMERGING
      </span>
    </div>
    <h3 className="text-xl font-bold text-white uppercase tracking-tight group-hover:text-amber-500 transition-colors mb-2">
      Neurotechnology Outlook: Decoding and Non-Medical Neurofeedback
    </h3>
    <p className="text-sm text-neutral-400 line-clamp-3 leading-relaxed mb-4">
      An operational framework mapping the timeline of consumer brain-computer interfaces, segmented by physical hurdles, the economic pivot to True Attention Metrics, and resulting lifestyle shifts.
    </p>
  </div>
  
  {/* Color-Coded Indicators for Grid Card */}
  <div className="flex flex-wrap gap-2 mt-2">
    <span className="w-2 h-2 rounded-full bg-rose-500" title="Hurdles"></span>
    <span className="w-2 h-2 rounded-full bg-emerald-500" title="Value Shifts"></span>
    <span className="w-2 h-2 rounded-full bg-cyan-500" title="Societal Impacts"></span>
  </div>

  <div className="mt-6 flex items-center gap-2 text-xs font-mono tracking-widest text-white uppercase">
    ACCESS DATA DEEP-DIVE <span className="group-hover:translate-x-1 transition-transform">→</span>
  </div>
</Link>
<Link 
  href="/intelligence/briefs/ultra-thin-shock-absorbing-adhesives" 
  className="group block border border-neutral-800 bg-[#0a0a0c] p-6 hover:border-neutral-500 transition-all duration-200"
>
  <div className="flex items-center justify-between mb-4">
    <span className="font-mono text-xs tracking-widest text-amber-500 uppercase">
      HARDWARE.MATERIALS
    </span>
    <span className="font-mono text-xs tracking-widest bg-neutral-900 text-neutral-400 px-2 py-0.5 border border-neutral-800 uppercase group-hover:border-neutral-600">
      STATUS: ACTIVE
    </span>
  </div>
  <h3 className="text-xl font-bold text-white uppercase tracking-tight group-hover:text-amber-500 transition-colors mb-2">
    Ultra-Thin Shock-Absorbing Adhesives: Sub-100μm Market Dynamics
  </h3>
  <p className="text-sm text-neutral-400 line-clamp-3 leading-relaxed">
    An architectural market assessment of sub-100μm shock-absorbing adhesive layers for premium smartphones, detailing how thin-film chemistry enables 5G antennas, larger batteries, and thermal dissipation.
  </p>
  <div className="mt-6 flex items-center gap-2 text-xs font-mono tracking-widest text-white uppercase">
    ACCESS DATA DEEP-DIVE <span className="group-hover:translate-x-1 transition-transform">→</span>
  </div>
</Link>
<Link 
  href="/intelligence/briefs/ai-software-cost-trajectory-2040" 
  className="group block border border-neutral-800 bg-[#0a0a0c] p-6 hover:border-neutral-500 transition-all duration-200"
>
  <div className="flex items-center justify-between mb-4">
    <span className="font-mono text-xs tracking-widest text-amber-500 uppercase">
      MACRO.AI_ECONOMICS
    </span>
    <span className="font-mono text-xs tracking-widest bg-neutral-900 text-neutral-400 px-2 py-0.5 border border-neutral-800 uppercase group-hover:border-neutral-600">
      STATUS: ACTIVE
    </span>
  </div>
  <h3 className="text-xl font-bold text-white uppercase tracking-tight group-hover:text-amber-500 transition-colors mb-2">
    AI Software Cost Trajectory 2040: Labor Substitution and Price Collapse
  </h3>
  <p className="text-sm text-neutral-400 line-clamp-3 leading-relaxed">
    A macroeconomic forecast detailing the anticipated 30-50% CAGR decline in AI software costs by 2040, tracking the shift toward open-source foundations and on-device agentic architectures.
  </p>
  <div className="mt-6 flex items-center gap-2 text-xs font-mono tracking-widest text-white uppercase">
    ACCESS DATA DEEP-DIVE <span className="group-hover:translate-x-1 transition-transform">→</span>
  </div>
</Link>
          {/* FUTURE NODES CAN GO HERE */}

        </div>
      </div>
    </main>
  );
}