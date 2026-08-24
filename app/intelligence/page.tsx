import React from 'react';
import Link from 'next/link';
import { TrackedLink } from '@/components/ConversionTracker';
import styles from './intelligence-cyber-light.module.css';
import { semanticForStatus, type IntelligenceSemantic } from './status-semantics';

export const metadata = {
  title: 'Intelligence | Maha Strategies LLC',
  description: 'Active market intelligence, structural audits, and proprietary geopolitical analysis.',
};

// --- DATA MODEL ---
type Indicator = { semantic: IntelligenceSemantic; label: string };

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
    title: 'Intel IDM 2.0: U.S. Foundry Strategy, Modernization, and Economics',
    description: 'How foundry modernization, economics, external-customer trust, CHIPS Act incentives, and domestic sourcing policy shape U.S. semiconductor manufacturing.',
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
    title: 'Angstrom Era Semiconductors: 2nm SoC Architecture and Edge AI',
    description: 'What the Angstrom Era means for 2nm SoC architecture, GAA transistors, backside power, High-NA EUV, and edge-AI trade-offs.',
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
    title: 'Designing a CVC for Upstream Semiconductor Companies',
    description: 'A decision framework for corporate venture activity by semiconductor materials, components, consumables, and equipment companies: strategic value, founder trust, and industrial learning.',
    href: '/intelligence/briefs/upstream-semiconductor-cvc-best-practices',
  },
  {
    group: 'HARDWARE & INFRASTRUCTURE',
    category: 'SEMICONDUCTOR.UTILITIES',
    status: 'ACTIVE',
    title: 'European Compressor Suppliers for Semiconductor Utility Systems',
    description: 'A supplier-screening framework for European compressor and package providers considered for semiconductor air-separation and clean-dry-air utility systems.',
    href: '/intelligence/briefs/european-compressor-suppliers-semiconductor-utilities',
  },
  {
    group: 'HARDWARE & INFRASTRUCTURE',
    category: 'SEMICONDUCTOR.MATERIALS',
    status: 'PRELIMINARY',
    title: 'PPG Derivatives in Semiconductor Manufacturing',
    description: 'A process, purity, and qualification framework for PPG, EO/PO block copolymers, glycol ethers, and reactive polyethers used in semiconductor manufacturing and advanced packaging.',
    href: '/intelligence/briefs/ppg-derivatives-semiconductor-applications',
  },
  {
    group: 'HARDWARE & INFRASTRUCTURE',
    category: 'ADVANCED.PACKAGING',
    status: 'ACTIVE',
    title: 'Smartphone AP Packaging: Architecture, Supplier, and Reliability Decisions',
    description: 'A decision framework for fan-out, flip-chip, supplier-route, and reliability decisions for smartphone application processors.',
    href: '/intelligence/briefs/smartphone-ap-fan-out-substrate-thickness',
  },
  {
    group: 'HARDWARE & INFRASTRUCTURE',
    category: 'ADVANCED.PACKAGING',
    status: 'ACTIVE',
    title: 'Commercial Architecture for Smartphone AP OSAT Engagements',
    description: 'A decision framework for capacity, materials, assembly, test, yield, quality, and high-value die risk in smartphone AP packaging programmes.',
    href: '/intelligence/briefs/smartphone-ap-osat-commercial-risk-allocation',
  },
  {
    group: 'HARDWARE & INFRASTRUCTURE',
    category: 'CONSUMER.ECOSYSTEMS',
    status: 'ACTIVE',
    title: 'Smartphone OEM Peripheral Mix: A Five-Year Scenario Framework',
    description: 'A normalized framework for assessing how tablets, PCs, wearables, smart glasses, and adjacent hardware may change within smartphone manufacturers’ non-phone portfolios.',
    href: '/intelligence/briefs/smartphone-oem-peripheral-sales-mix',
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
    title: 'Direct-to-Silicon Liquid Cooling for AI Chips',
    description: 'A materials and reliability framework for backside microfluidics, sealing, coolants, manifolds, and high-volume qualification of direct-to-silicon AI-chip cooling.',
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
    title: 'STMicroelectronics Distribution Strategy: Customer and Channel Analysis',
    description: 'Customer concentration and channel exposure across Apple, automotive Tier-1s, industrial, and aerospace markets.',
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
  {
    group: 'HARDWARE & INFRASTRUCTURE',
    category: 'STORAGE.ARCHITECTURE',
    status: 'PRELIMINARY',
    title: 'Tape Storage and the Nearline HDD Demand Boundary',
    description: 'An input-based assessment of tape substitution in deep archive tiers, nearline HDD demand, and the role of AI-era data staging.',
    href: '/intelligence/briefs/tape-storage-nearline-hdd-demand',
  },
  {
    group: 'HARDWARE & INFRASTRUCTURE',
    category: 'HARDWARE.TESTING',
    status: 'PRELIMINARY',
    title: 'Advanced Packaging Test and CPO Socket Requirements',
    description: 'An assessment of RDL-interposer screening and the opto-electrical socket requirements created by co-packaged optics.',
    href: '/intelligence/briefs/advanced-packaging-test-cpo-sockets',
  },
  {
    group: 'HARDWARE & INFRASTRUCTURE',
    category: 'POWER.PACKAGING',
    status: 'PRELIMINARY',
    title: 'NTC Thermistors for Embedded Power Semiconductor Modules',
    description: 'A technical requirement assessment for NTC thermistors as power modules move toward embedded-die packaging and sintered interconnects.',
    href: '/intelligence/briefs/ntc-thermistors-embedded-power-modules',
  },
  {
    group: 'HARDWARE & INFRASTRUCTURE',
    category: 'AUTOMATION.CABLES',
    status: 'PRELIMINARY',
    title: 'China FA Cable Competitive Landscape',
    description: 'A preliminary assessment of high-flex, heat-resistant, and ultra-thin factory-automation cable competition in China.',
    href: '/intelligence/briefs/china-fa-cable-competitive-landscape',
  },
  {
    group: 'HARDWARE & INFRASTRUCTURE',
    category: 'SILICON.INFRASTRUCTURE',
    status: 'PRELIMINARY',
    title: 'U.S. Semiconductor Cleanroom Construction Market',
    description: 'An input-based sizing framework for controlled semiconductor environments, support spaces, and adjacent supply-chain facilities.',
    href: '/intelligence/briefs/us-semiconductor-cleanroom-construction',
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
    category: 'AUTOMOTIVE.SOFTWARE',
    status: 'PRELIMINARY',
    title: 'Hardware-Assisted Verification Systems: Automotive Market Framework',
    description: 'A market framework for hardware-assisted verification, cloud-based virtual verification, and hardware-in-the-loop constraints in automotive software.',
    href: '/intelligence/briefs/automotive-cloud-virtual-verification',
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
      { semantic: 'unverified', label: 'Hurdles' },
      { semantic: 'verified', label: 'Value Shifts' },
      { semantic: 'sourced', label: 'Societal Impacts' },
    ],
  },
];

// --- COMPONENTS ---
const CHIP: Record<IntelligenceSemantic, string> = {
  verified: styles.chipVerified,
  sourced: styles.chipSourced,
  boundary: styles.chipBoundary,
  illustrative: styles.chipIllustrative,
  unverified: styles.chipUnverified,
};

const DOT: Record<IntelligenceSemantic, string> = {
  verified: styles.indicatorVerified,
  sourced: styles.indicatorSourced,
  boundary: styles.indicatorBoundary,
  illustrative: styles.indicatorIllustrative,
  unverified: styles.indicatorUnverified,
};

const BriefCard = ({ data }: { data: BriefData }) => (
  <Link href={data.href} className={styles.card}>
    <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
      <span className={styles.category}>{data.category}</span>
      <span className={`${styles.chip} ${CHIP[semanticForStatus(data.status)]}`}>
        STATUS: {data.status}
      </span>
    </div>

    <h3 className={`${styles.cardTitle} mb-3`}>{data.title}</h3>

    <p className={`${styles.cardBody} line-clamp-3 mb-6`}>{data.description}</p>

    <div className="mt-auto">
      {data.indicators && (
        <div className="mb-4 flex flex-wrap gap-2">
          {data.indicators.map((ind, i) => (
            <span key={i} className={`${styles.indicator} ${DOT[ind.semantic]}`} title={ind.label}></span>
          ))}
        </div>
      )}
      <div className={styles.cardAction}>
        ACCESS DATA DEEP-DIVE <span className={styles.cardArrow}>&rarr;</span>
      </div>
    </div>
  </Link>
);

export default function IntelligenceGrid() {
  const groups = ['MACRO & SYSTEMS', 'HARDWARE & INFRASTRUCTURE', 'INTELLIGENCE & CYBERNETICS'] as const;

  return (
    <main className={styles.page}>
      <div className={styles.shell}>

        {/* HEADER */}
        <header className={styles.header}>
          <h1 className={`${styles.title} mb-4`}>Active Intelligence</h1>
          <p className={styles.metaMuted}>
            [ Flash-Opinions // Structural Audits // Market Signals ]
          </p>
          <div className="mt-8">
            <TrackedLink
              href="/rapid-intelligence-brief"
              event="cta_intelligence_rapid_brief"
              className={`${styles.action} ${styles.actionInline}`}
            >
              Need a focused answer in five days? Rapid Intelligence Brief &#8599;
            </TrackedLink>
          </div>
        </header>

        {/* CATEGORIZED GRID */}
        <div className="space-y-20">
          {groups.map((groupTitle) => (
            <section key={groupTitle}>
              <div className="mb-8 flex items-center gap-4">
                <h2 className={styles.groupHeading}>{groupTitle}</h2>
                <div className={styles.rule}></div>
              </div>

              <div className="grid grid-cols-[minmax(0,1fr)] gap-6 md:grid-cols-2 lg:grid-cols-3">
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
