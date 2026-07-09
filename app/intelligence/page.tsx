import React from 'react';
import Link from 'next/link';

export const metadata = {
  title: 'Intelligence | Maha Strategies LLC',
  description: 'Active market intelligence, structural audits, and proprietary geopolitical analysis.',
};

// --- DATA MODEL ---
type Indicator = { color: string; label: string };

interface BriefData {
  title: string;
  category: string;
  status: string;
  description: string;
  href: string;
  group: 'MACRO & SYSTEMS' | 'HARDWARE & INFRASTRUCTURE' | 'INTELLIGENCE & CYBERNETICS';
  indicators?: Indicator[];
}

const BRIEFS: BriefData[] = [
  // --- MACRO & SYSTEMS ---
  {
    group: 'MACRO & SYSTEMS',
    category: 'MACRO.GEOPOLITICS',
    status: 'VOLATILE',
    title: 'U.S. Foundry Sovereignization: The Intel IDM 2.0 Friction Point',
    description: 'An architectural audit of the U.S. semiconductor supply chain shift, analyzing the divergence between strategic national security mandates and financial stakeholder realities regarding Intel’s foundry business.',
    href: '/intelligence/briefs/us-foundry-sovereignization',
  },
  {
    group: 'MACRO & SYSTEMS',
    category: 'MACRO.IP_STRATEGY',
    status: 'STRUCTURAL SHIFT',
    title: 'Strategic IP Architecture: Escaping the 50:50 Joint Ownership Trap',
    description: 'An operational audit of how hyperscalers structure intellectual property rights in joint research to maximize Freedom to Operate (FTO) and commercial integration over nominal shared ownership.',
    href: '/intelligence/briefs/strategic-ip-architecture',
  },
  {
    group: 'MACRO & SYSTEMS',
    category: 'MACRO.GEOPOLITICS',
    status: 'CRITICAL',
    title: 'The Bifurcation of Silicon',
    description: 'An intelligence brief on the structural shift from open innovation to secure, sovereign semiconductor supply chains in the wake of geopolitical friction.',
    href: '/intelligence/briefs/semiconductor-bifurcation',
  },
  {
    group: 'MACRO & SYSTEMS',
    category: 'MACRO.SILICON',
    status: 'VOLATILE',
    title: 'The Generative AI Distortion: Recalibrating the Silicon Boom-Bust Cycle',
    description: 'An architectural evaluation of the incoming CapEx super-cycle oversupply, the enterprise infrastructure digestion phase, and the resulting bifurcated "growth recession".',
    href: '/intelligence/briefs/generative-ai-silicon-cycle-recalibration',
  },
  {
    group: 'MACRO & SYSTEMS',
    category: 'MACRO.AI_ECONOMICS',
    status: 'ACTIVE',
    title: 'AI Software Cost Trajectory 2040: Labor Substitution and Price Collapse',
    description: 'A macroeconomic forecast detailing the anticipated 30-50% CAGR decline in AI software costs by 2040, tracking the shift toward open-source foundations.',
    href: '/intelligence/briefs/ai-software-cost-trajectory-2040',
  },
  {
    group: 'MACRO & SYSTEMS',
    category: 'WFE.MARKETSTRUCTURE',
    status: 'TRANSITIONING',
    title: 'Semiconductor WFE Architecture: Geopolitical Bifurcation and Thermal Budget Physics',
    description: 'An exhaustive quantitative re-mapping of global ion implantation and advanced laser annealing market shares, evaluating 2024 baselines against 2035 localization trends.',
    href: '/intelligence/briefs/semiconductor-wfe-doping-annealing-landscape',
  },
  {
    group: 'MACRO & SYSTEMS',
    category: 'MACRO.SUPPLY_CHAIN',
    status: 'ACTIVE',
    title: 'Tolerance to Price Increases for Semiconductor Package Substrates',
    description: 'An analysis of price increase tolerance thresholds for semiconductor package substrates and PCBs from the perspective of package manufacturers and end OEMs.',
    href: '/intelligence/briefs/semiconductor-substrate-price-tolerance',
  },
  {
    group: 'MACRO & SYSTEMS',
    category: 'MACRO.GEOPOLITICS',
    status: 'ACTIVE',
    title: 'Manufacturing Power Semiconductors in SEA as a China-Risk Hedge',
    description: 'Assessing Southeast Asia\'s realistic role in power semiconductor sourcing, evaluating geopolitical risk reduction, OSAT flexibility, and constraints in process control.',
    href: '/intelligence/briefs/sea-semiconductor-manufacturing-hedge',
  },
  {
    group: 'MACRO & SYSTEMS',
    category: 'MACRO.GAMING',
    status: 'ACTIVE',
    title: 'SEA Gaming Expansion: Hardware Substrates and F2P Monetization',
    description: 'An operational audit of Southeast Asia’s gaming ecosystem, assessing the structural dominance of PC/Mobile cross-platform architecture, hardware constraints, and hyper-localized monetization vectors.',
    href: '/intelligence/briefs/sea-gaming-market-expansion',
  },

  // --- HARDWARE & INFRASTRUCTURE ---
  {
    group: 'HARDWARE & INFRASTRUCTURE',
    category: 'SILICON.NODES',
    status: 'ACTIVE',
    title: 'Angstrom-Era SoC Architecture: The 2nm Transition and Edge AI',
    description: 'An architectural assessment of sub-3nm node migration, Backside Power Delivery Networks, CFET stacking, and the sovereign imperative for Angstrom-era fabrication.',
    href: '/intelligence/briefs/angstrom-era-soc-architecture',
  },
  {
    group: 'HARDWARE & INFRASTRUCTURE',
    category: 'SILICON.NODES',
    status: 'ACTIVE',
    title: 'Angstrom Foundry Diversification: The Non-TSMC Migration',
    description: 'An intelligence brief on ASIC vendor and CSP strategies for dual-sourcing 2nm and 1.Xnm silicon across Samsung, Intel, and Rapidus to mitigate geopolitical and capacity risks.',
    href: '/intelligence/briefs/angstrom-foundry-diversification',
  },
  {
    group: 'HARDWARE & INFRASTRUCTURE',
    category: 'HARDWARE.LOGISTICS',
    status: 'TRANSITIONING',
    title: 'Hyperscaler Storage Disposition: The End of the Shredding Era',
    description: 'An operational audit of cloud service provider data disposal policies, mapping the technological and legal transition from physical HDD shredding to cryptographic sanitization and circular asset recovery.',
    href: '/intelligence/briefs/hyperscaler-storage-disposition',
  },
  {
    group: 'HARDWARE & INFRASTRUCTURE',
    category: 'SILICON.PHOTONICS',
    status: 'ACTIVE',
    title: 'Electro-Photonic Co-Integration: The Package-to-Package Bottleneck',
    description: 'An operational audit of the manufacturing and economic barriers preventing high-volume package-to-package optical interconnects, focusing on alignment yield, thermal degradation, and testability.',
    href: '/intelligence/briefs/electro-photonic-co-integration',
  },
  {
    group: 'HARDWARE & INFRASTRUCTURE',
    category: 'CORPORATE.VENTURE',
    status: 'ACTIVE',
    title: 'Best Practices for Upstream Semiconductor CVCs',
    description: 'Research on the investment processes, organizational structures, execution setups, and evaluation systems of CVCs managed by semiconductor materials, components, and equipment manufacturers.',
    href: '/intelligence/briefs/upstream-semiconductor-cvc-best-practices',
  },
  {
    group: 'HARDWARE & INFRASTRUCTURE',
    category: 'HARDWARE.TESTING',
    status: 'ACTIVE',
    title: 'AI Semiconductor SLT Practices and Test Sockets',
    description: 'An evaluation of system-level test (SLT) practices for AI semiconductors, detailing test times, mass production realities, and key buying factors for test sockets.',
    href: '/intelligence/briefs/ai-semiconductor-slt-practices',
  },
  {
    group: 'HARDWARE & INFRASTRUCTURE',
    category: 'POWER.STRATEGY',
    status: 'ACTIVE',
    title: 'Power Semiconductor Architecture: Strategic Target Calibration Across Nodes',
    description: 'An operational evaluation of capital deployment matrices, corporate margin optimization targets, and systemic sub-system transitions within global IGBT, IEGT, and SiC pipelines.',
    href: '/intelligence/briefs/power-semiconductor-target-setting-metrics',
  },
  {
    group: 'HARDWARE & INFRASTRUCTURE',
    category: 'SILICON.POWER',
    status: 'ACTIVE',
    title: 'Power Semiconductor Target Architecture: Metrics, Yields, and Segment Rationale',
    description: 'An operational audit analyzing strategic performance indicators, capex intensity targets, and value-capture strategies across discrete IGBTs, EV SiC, and industrial automation segments.',
    href: '/intelligence/briefs/power-semiconductor-target-architecture',
  },
  {
    group: 'HARDWARE & INFRASTRUCTURE',
    category: 'HARDWARE.THERMAL',
    status: 'CRITICAL',
    title: 'Monolithic Backside Microfluidics: Bypassing the Silicon Thermal Wall',
    description: 'An architectural evaluation of sub-node thermal management limitations, DRIE defectivity vectors, and the strategic pivot toward monolithic buried channel processing.',
    href: '/intelligence/briefs/backside-microchannel-semiconductors',
  },
  {
    group: 'HARDWARE & INFRASTRUCTURE',
    category: 'HARDWARE.LOGISTICS',
    status: 'COMPLIANCE',
    title: 'Known Good Die Preservation: Mitigating Post-Dicing Degradation Vectors',
    description: 'An architectural evaluation of surplus bare die storage methodologies, adhesive-induced mechanical micro-cracking, and environmental degradation mitigation systems.',
    href: '/intelligence/briefs/known-good-die-storage-yield',
  },
  {
    group: 'HARDWARE & INFRASTRUCTURE',
    category: 'HARDWARE.MATERIALS',
    status: 'ACTIVE',
    title: 'High-Purity Alumina Architecture: Synthesis Vectors and Sub-Nanometer Yields',
    description: 'An architectural assessment of 5N/6N HPA manufacturing, bauxite-independent hydrometallurgy, and high-margin deployment across advanced logic fabs and energy storage arrays.',
    href: '/intelligence/briefs/high-purity-alumina-manufacturing-architecture',
  },
  {
    group: 'HARDWARE & INFRASTRUCTURE',
    category: 'HARDWARE.MATERIALS',
    status: 'ACTIVE',
    title: 'Ultra-Thin Shock-Absorbing Adhesives: Sub-100μm Market Dynamics',
    description: 'An architectural market assessment of sub-100μm shock-absorbing adhesive layers for premium smartphones, detailing how thin-film chemistry enables 5G antennas and larger batteries.',
    href: '/intelligence/briefs/ultra-thin-shock-absorbing-adhesives',
  },
  {
    group: 'HARDWARE & INFRASTRUCTURE',
    category: 'AEROSPACE.SILICON',
    status: 'CRITICAL',
    title: 'Orbital Silicon: Rad-Hard GaN-on-SiC Architectures for LEO Constellations',
    description: 'An architectural evaluation of semiconductor vulnerability in orbit, detailing the thermal and rad-hard imperatives for deploying GaN-on-SiC logic in high-throughput satellite payloads.',
    href: '/intelligence/briefs/rad-hard-gan-sic-leo-satellites',
  },
  {
    group: 'HARDWARE & INFRASTRUCTURE',
    category: 'SILICON.SUPPLY_CHAIN',
    status: 'ACTIVE',
    title: 'STM Customer Matrix: Legacy Semiconductor Distribution',
    description: 'An operational audit of STMicroelectronics\' commercial distribution structure, analyzing revenue concentration across Apple, Automotive Tier-1s, and Aerospace.',
    href: '/intelligence/briefs/stm-legacy-distribution',
  },
  {
    group: 'HARDWARE & INFRASTRUCTURE',
    category: 'AUTOMATION.ROBOTICS',
    status: 'ACTIVE',
    title: 'Arc Welding Robotics: Component Margin Architecture',
    description: 'An operational audit analyzing the value-capture mechanics, margin compressions, and hardware-to-service profit blending across industrial welding robot portfolios.',
    href: '/intelligence/briefs/arc-welding-robotics-margins',
  },
  {
    group: 'HARDWARE & INFRASTRUCTURE',
    category: 'AEROSPACE.SILICON',
    status: 'EMERGING',
    title: 'Orbital Diamond: GaN-on-Diamond SWaP-C Economics in LEO Constellations',
    description: 'An architectural evaluation of GaN-on-Diamond deployment in LEO constellations, mapping component cost premiums against system-level thermal and power storage savings.',
    href: '/intelligence/briefs/gan-on-diamond-leo-economics',
  },
  {
    group: 'HARDWARE & INFRASTRUCTURE',
    category: 'SILICON.NODES',
    status: 'CRITICAL',
    title: 'Rapidus 2nm Mass-Production Yield Probability',
    description: 'A quantitative and qualitative assessment of Rapidus achieving steady-state High-Volume Manufacturing (HVM) on 2nm GAA/nanosheet architecture by 2030.',
    href: '/intelligence/briefs/rapidus-2nm-yield-probability',
  },

  // --- INTELLIGENCE & CYBERNETICS ---
  {
    group: 'INTELLIGENCE & CYBERNETICS',
    category: 'AI.EMBODIED',
    status: 'STRUCTURAL SHIFT',
    title: 'Embodied Intelligence',
    description: 'An intelligence brief on the transition to Vision-Language-Action (VLA) models, edge-compute scaling, and the geopolitical moats of localized hardware processing.',
    href: '/intelligence/briefs/physical-ai-deployment',
  },
  {
    group: 'INTELLIGENCE & CYBERNETICS',
    category: 'AI.OPTIMIZATION',
    status: 'ACTIVE',
    title: 'Tensor Network Compression: Assessing CompactifAI and Quantum-Inspired LLM Optimization',
    description: 'An architectural and IP evaluation of Multiverse Computing\'s tensor network decomposition frameworks, highlighting structural advantages over SOTA quantization and steep IP imitation difficulty.',
    href: '/intelligence/briefs/tensor-network-ai-compression',
  },
  {
    group: 'INTELLIGENCE & CYBERNETICS',
    category: 'NEURO.BEHAVIORAL',
    status: 'BEHAVIORAL CAPTURE',
    title: 'Algorithmic Lock-In',
    description: 'An intelligence brief on digital native behavioral loops, social currency in mobile gaming ecosystems, and vectors of cognitive capture.',
    href: '/intelligence/briefs/algorithmic-lock-in',
  },
  {
    group: 'INTELLIGENCE & CYBERNETICS',
    category: 'NEURO.SOCIETY',
    status: 'EMERGING',
    title: 'Neurotechnology Outlook: Decoding and Non-Medical Neurofeedback',
    description: 'An operational framework mapping the timeline of consumer brain-computer interfaces, segmented by physical hurdles, the economic pivot to True Attention Metrics, and resulting lifestyle shifts.',
    href: '/intelligence/briefs/neurotechnology-non-medical-outlook',
    indicators: [
      { color: 'bg-rose-500', label: 'Hurdles' },
      { color: 'bg-emerald-500', label: 'Value Shifts' },
      { color: 'bg-cyan-500', label: 'Societal Impacts' },
    ],
  },
];

// --- COMPONENTS ---
const BriefCard = ({ data }: { data: BriefData }) => (
  <Link 
    href={data.href} 
    className="group flex flex-col border border-neutral-800 bg-[#0a0a0c] p-6 hover:border-neutral-500 transition-all duration-200 h-full"
  >
    <div className="flex items-center justify-between mb-4">
      <span className="font-mono text-xs tracking-widest text-amber-500 uppercase">
        {data.category}
      </span>
      <span className="font-mono text-[10px] sm:text-xs tracking-widest bg-neutral-900 text-neutral-400 px-2 py-0.5 border border-neutral-800 uppercase group-hover:border-neutral-600">
        STATUS: {data.status}
      </span>
    </div>
    
    <h3 className="text-xl font-bold text-white uppercase tracking-tight group-hover:text-amber-500 transition-colors mb-3">
      {data.title}
    </h3>
    
    <p className="text-sm text-neutral-400 line-clamp-3 leading-relaxed mb-6">
      {data.description}
    </p>
    
    <div className="mt-auto">
      {data.indicators && (
        <div className="flex flex-wrap gap-2 mb-4">
          {data.indicators.map((ind, i) => (
            <span key={i} className={`w-2 h-2 rounded-full ${ind.color}`} title={ind.label}></span>
          ))}
        </div>
      )}
      <div className="flex items-center gap-2 text-xs font-mono tracking-widest text-white uppercase">
        ACCESS DATA DEEP-DIVE <span className="group-hover:translate-x-1 transition-transform">→</span>
      </div>
    </div>
  </Link>
);

export default function IntelligenceGrid() {
  const groups = ['MACRO & SYSTEMS', 'HARDWARE & INFRASTRUCTURE', 'INTELLIGENCE & CYBERNETICS'] as const;

  return (
    <main className="min-h-screen bg-[#0a0a0c] text-[#e0e0e0] py-16 px-6 sm:px-12 selection:bg-amber-500 selection:text-black">
      <div className="max-w-7xl mx-auto">
        
        {/* HEADER */}
        <header className="mb-16 border-b border-neutral-800 pb-8 max-w-4xl">
          <h1 className="font-sans text-4xl sm:text-5xl font-extrabold uppercase tracking-tight text-white mb-4">
            Active Intelligence
          </h1>
          <p className="font-mono text-sm text-neutral-500 tracking-widest uppercase">
            [ Flash-Opinions // Structural Audits // Market Signals ]
          </p>
        </header>

        {/* CATEGORIZED GRID */}
        <div className="space-y-20">
          {groups.map((groupTitle) => (
            <section key={groupTitle}>
              <div className="flex items-center gap-4 mb-8">
                <h2 className="font-mono text-sm sm:text-base tracking-widest text-white uppercase">
                  {groupTitle}
                </h2>
                <div className="flex-grow h-[1px] bg-neutral-800"></div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {BRIEFS.filter(b => b.group === groupTitle).map((brief, idx) => (
                  <BriefCard key={idx} data={brief} />
                ))}
              </div>
            </section>
          ))}
        </div>

      </div>
    </main>
  );
}