import { SITE_URL } from './briefs-data.ts'
import { assertClaimEvidence, requiresBoundary, type ClaimEvidence } from './claim-evidence.ts'

export const KNOWLEDGE_BASE_URL = `${SITE_URL}/knowledge`

export const KNOWLEDGE_KINDS = ['domain', 'process', 'material', 'equipment', 'concept'] as const
export type KnowledgeKind = typeof KNOWLEDGE_KINDS[number]

export const KNOWLEDGE_ROUTE_KINDS = ['domains', 'processes', 'materials', 'equipment', 'concepts'] as const
export type KnowledgeRouteKind = typeof KNOWLEDGE_ROUTE_KINDS[number]

export const SEMICONDUCTOR_STAGES = [
  'design',
  'wafer-preparation',
  'feol',
  'meol',
  'beol',
  'wafer-test',
  'assembly-packaging',
  'final-test-reliability',
] as const
export type SemiconductorStageId = typeof SEMICONDUCTOR_STAGES[number]

export interface KnowledgeSource {
  id: string
  title: string
  publisher: string
  url: string
  year?: number
  sourceType: 'official-technical' | 'official-overview' | 'research-paper' | 'standard'
  accessed: string
}

export interface KnowledgeClaim extends ClaimEvidence {
  id: string
  statement: string
  sourceIds: string[]
  boundary?: string
}

export interface KnowledgeSection {
  heading: string
  paragraphs: string[]
  claimIds?: string[]
}

export interface KnowledgeArticle {
  id: string
  kind: KnowledgeKind
  slug: string
  title: string
  shortTitle: string
  description: string
  definition: string
  domainIds: string[]
  stageIds: SemiconductorStageId[]
  status: 'FOUNDATIONAL' | 'ACTIVE' | 'DEVELOPING'
  datePublished: string
  dateModified: string
  inputs: string[]
  outputs: string[]
  processSteps: string[]
  criticalParameters: string[]
  failureModes: string[]
  metrology: string[]
  equipment: string[]
  materials: string[]
  sections: KnowledgeSection[]
  claims: KnowledgeClaim[]
  sourceIds: string[]
  relatedArticleIds: string[]
  intelligenceSlugs: string[]
}

export const KNOWLEDGE_KIND_META: Record<KnowledgeKind, { label: string; route: KnowledgeRouteKind; description: string }> = {
  domain: { label: 'Domain', route: 'domains', description: 'A system-level map that joins processes, materials, equipment, and decisions.' },
  process: { label: 'Process', route: 'processes', description: 'A manufacturing operation with defined inputs, controls, outputs, and failure modes.' },
  material: { label: 'Material', route: 'materials', description: 'A material family described by function, grade, process exposure, and qualification evidence.' },
  equipment: { label: 'Equipment', route: 'equipment', description: 'A tool class described by process role, control variables, and production constraints.' },
  concept: { label: 'Concept', route: 'concepts', description: 'A cross-cutting technical idea used across multiple processes or product architectures.' },
}

export const SEMICONDUCTOR_STAGE_META: Record<SemiconductorStageId, { order: number; label: string; description: string }> = {
  design: { order: 1, label: 'Design', description: 'Architecture, logic design, verification, physical implementation, and tape-out.' },
  'wafer-preparation': { order: 2, label: 'Wafer preparation', description: 'Crystal growth, slicing, lapping, polishing, cleaning, and incoming-wafer qualification.' },
  feol: { order: 3, label: 'FEOL', description: 'Formation of active devices in and on the semiconductor substrate.' },
  meol: { order: 4, label: 'MEOL', description: 'Contacts and local interconnects that connect transistors to the wiring stack.' },
  beol: { order: 5, label: 'BEOL', description: 'Multilevel metal and dielectric wiring that connects devices into circuits.' },
  'wafer-test': { order: 6, label: 'Wafer test', description: 'Electrical screening, defect learning, wafer sort, thinning, and singulation preparation.' },
  'assembly-packaging': { order: 7, label: 'Assembly & packaging', description: 'Die interconnection, protection, system integration, thermal paths, and package formation.' },
  'final-test-reliability': { order: 8, label: 'Final test & reliability', description: 'Package test, system-level test, qualification, failure analysis, and field feedback.' },
}

export const KNOWLEDGE_SOURCES: KnowledgeSource[] = [
  { id: 'synopsys-chip-design', title: 'Chip Design', publisher: 'Synopsys', url: 'https://www.synopsys.com/implementation-and-signoff.html', sourceType: 'official-technical', accessed: '2026-08-13' },
  { id: 'synopsys-ic-design', title: 'What Is IC Design?', publisher: 'Synopsys', url: 'https://www.synopsys.com/glossary/what-is-ic-design.html', sourceType: 'official-overview', accessed: '2026-08-13' },
  { id: 'synopsys-rtl-design', title: 'What Is Register-Transfer-Level Design?', publisher: 'Synopsys', url: 'https://www.synopsys.com/glossary/what-is-register-transfer-level-design.html', sourceType: 'official-technical', accessed: '2026-08-13' },
  { id: 'synopsys-physical-design', title: 'What Is Physical Design?', publisher: 'Synopsys', url: 'https://www.synopsys.com/glossary/what-is-physical-design.html', sourceType: 'official-technical', accessed: '2026-08-13' },
  { id: 'synopsys-drc', title: 'What Is Design Rule Checking?', publisher: 'Synopsys', url: 'https://www.synopsys.com/glossary/what-is-design-rule-checking.html', sourceType: 'official-technical', accessed: '2026-08-13' },
  { id: 'cadence-conformal', title: 'Conformal Technologies', publisher: 'Cadence', url: 'https://www.cadence.com/en_US/home/tools/digital-design-and-signoff/conformal-technologies.html', sourceType: 'official-technical', accessed: '2026-08-13' },
  { id: 'sumco-wafer-lineup', title: 'Silicon Wafer Product Lineup', publisher: 'SUMCO', url: 'https://www.sumcosi.com/english/products/lineup.html', sourceType: 'official-technical', accessed: '2026-08-13' },
  { id: 'shinetsu-silicon-wafers', title: 'Silicon Wafers', publisher: 'Shin-Etsu Chemical', url: 'https://www.shinetsu.co.jp/en/products/semiconductor-silicon-business/silicon-wafers/', sourceType: 'official-technical', accessed: '2026-08-13' },
  { id: 'axcelis-ion-implant', title: 'Ion Implantation Systems', publisher: 'Axcelis Technologies', url: 'https://investor.axcelis.com/static-files/7e0740ae-0aa6-4369-b46f-af5bdcfb97a3', sourceType: 'official-technical', accessed: '2026-08-13' },
  { id: 'kla-2024-10k', title: 'Annual Report: Process Control and Yield Management', publisher: 'KLA', url: 'https://ir.kla.com/sec-filings/all-sec-filings/content/0000319201-24-000021/klac-20240630.htm', year: 2024, sourceType: 'official-technical', accessed: '2026-08-13' },
  { id: 'kla-2019-10k', title: 'Annual Report: Inspection, Metrology, and Yield Analysis', publisher: 'KLA', url: 'https://ir.kla.com/sec-filings/all-sec-filings/content/0000319201-19-000031/klac10k2019.htm', year: 2019, sourceType: 'official-technical', accessed: '2026-08-13' },
  { id: 'lam-wet-clean', title: 'EOS Wet Clean Products', publisher: 'Lam Research', url: 'https://www.lamresearch.com/product/eos/', sourceType: 'official-technical', accessed: '2026-08-13' },
  { id: 'tel-process-equipment', title: 'Semiconductor Production Equipment', publisher: 'Tokyo Electron', url: 'https://www.tel.com/product/index.html', sourceType: 'official-technical', accessed: '2026-08-13' },
  { id: 'disco-process', title: 'Semiconductor and Wafer Manufacturing Process', publisher: 'DISCO', url: 'https://www-hq.disco.co.jp/eg/introduction/doc/process.pdf', sourceType: 'official-technical', accessed: '2026-08-13' },
  { id: 'disco-thinning-strength', title: 'Silicon Wafer Thinning, the Singulation Process, and Die Strength', publisher: 'DISCO', url: 'https://www-hq.disco.co.jp/eg/solution/technical_review/doc/TR16-03_Silicon%20wafer%20thinning%2C%20the%20singulation%20process%2C%20and%20die%20strength_20160610.pdf', year: 2016, sourceType: 'official-technical', accessed: '2026-08-13' },
  { id: 'advantest-test-briefing', title: 'Technical Briefing: Semiconductor Test', publisher: 'Advantest', url: 'https://www.advantest.com/document/en/investors/ir-library/briefing/E_IR_Tech_Briefing_241128_note.pdf', year: 2024, sourceType: 'official-technical', accessed: '2026-08-13' },
  { id: 'amkor-rdl-pop', title: 'A New RDL-First PoP Fan-Out Wafer-Level Package Process', publisher: 'Amkor Technology', url: 'https://amkor.com/wp-content/uploads/2020/11/A-New-RDL-First-PoP-Fan-Out-Wafer-Level-Package-Process-with-Chip-to-Wafer-Bonding-Technology.pdf', year: 2020, sourceType: 'research-paper', accessed: '2026-08-13' },
  { id: 'jedec-home', title: 'Microelectronics Standards and Publications', publisher: 'JEDEC', url: 'https://www.jedec.org/', sourceType: 'standard', accessed: '2026-08-13' },
  { id: 'samsung-wafer', title: 'Creating the Wafer', publisher: 'Samsung Semiconductor', url: 'https://semiconductor.samsung.com/support/tools-resources/fabrication-process/eight-essential-semiconductor-fabrication-processes-part-1-what-is-a-wafer/', sourceType: 'official-overview', accessed: '2026-08-13' },
  { id: 'samsung-fab', title: 'Fab Glossary: The Birthplace of Semiconductor Chips', publisher: 'Samsung Semiconductor', url: 'https://semiconductor.samsung.com/support/tools-resources/dictionary/semiconductors-101-part-7-all-about-the-fab-the-birthplace-of-semiconductor-chips/', sourceType: 'official-overview', accessed: '2026-08-13' },
  { id: 'tsmc-quality', title: 'Quality and Reliability', publisher: 'TSMC', url: 'https://www.tsmc.com/english/aboutTSMC/quality_and_reliability', sourceType: 'official-technical', accessed: '2026-08-13' },
  { id: 'tsmc-engineering', title: 'Engineering Performance Optimization', publisher: 'TSMC', url: 'https://www.tsmc.com/english/dedicatedFoundry/manufacturing/engineering', sourceType: 'official-technical', accessed: '2026-08-13' },
  { id: 'ase-test', title: 'Test Services', publisher: 'ASE', url: 'https://ase.aseglobal.com/test-services/', sourceType: 'official-technical', accessed: '2026-08-13' },
  { id: 'amkor-test', title: 'IC Semiconductor Test Services', publisher: 'Amkor Technology', url: 'https://amkor.com/test-services/', sourceType: 'official-technical', accessed: '2026-08-13' },
  { id: 'amkor-3d-stack', title: '3D Stacked Die Packaging', publisher: 'Amkor Technology', url: 'https://amkor.com/technology/3d-stacked-die/', sourceType: 'official-technical', accessed: '2026-08-13' },
  { id: 'asml-chip-making', title: 'How microchips are made', publisher: 'ASML', url: 'https://www.asml.com/en/technology/all-about-microchips/how-microchips-are-made', sourceType: 'official-overview', accessed: '2026-08-13' },
  { id: 'intel-semiconductor-101', title: 'What Are Semiconductors?', publisher: 'Intel', url: 'https://newsroom.intel.com/tech101/what-are-semiconductors', sourceType: 'official-overview', accessed: '2026-08-13' },
  { id: 'asml-lithography', title: 'Lithography principles', publisher: 'ASML', url: 'https://www.asml.com/en/technology/lithography-principles', sourceType: 'official-technical', accessed: '2026-08-13' },
  { id: 'asml-rayleigh', title: 'The Rayleigh criterion for resolution', publisher: 'ASML', url: 'https://www.asml.com/en/technology/lithography-principles/rayleigh-criterion', sourceType: 'official-technical', accessed: '2026-08-13' },
  { id: 'applied-deposition', title: 'Create and Deposit Materials', publisher: 'Applied Materials', url: 'https://www.appliedmaterials.com/il/en/semiconductor/semiconductor-capabilities/create.html', sourceType: 'official-technical', accessed: '2026-08-13' },
  { id: 'applied-ald', title: 'Atomic Layer Deposition', publisher: 'Applied Materials', url: 'https://www.appliedmaterials.com/us/en/semiconductor/products/processes/ald.html', sourceType: 'official-technical', accessed: '2026-08-13' },
  { id: 'lam-etch', title: 'Etch Essentials: The Building Blocks of AI Era Microchips', publisher: 'Lam Research', url: 'https://newsroom.lamresearch.com/etch-essentials-semiconductor-manufacturing', year: 2024, sourceType: 'official-technical', accessed: '2026-08-13' },
  { id: 'applied-implant', title: 'Ion Implant', publisher: 'Applied Materials', url: 'https://www.appliedmaterials.com/eu/en/semiconductor/products/modify/implant.html', sourceType: 'official-technical', accessed: '2026-08-13' },
  { id: 'applied-cmp', title: 'Chemical Mechanical Planarization', publisher: 'Applied Materials', url: 'https://www.appliedmaterials.com/il/en/semiconductor/semiconductor-technologies/cmp.html', sourceType: 'official-technical', accessed: '2026-08-13' },
  { id: 'tsmc-3dfabric', title: '3DFabric: 3D Silicon Stacking and Advanced Packaging', publisher: 'TSMC', url: 'https://3dfabric.tsmc.com/english/dedicatedFoundry/technology/3DFabric.htm', sourceType: 'official-technical', accessed: '2026-08-13' },
  { id: 'tsmc-cowos', title: 'CoWoS Advanced Packaging', publisher: 'TSMC', url: 'https://3dfabric.tsmc.com/english/dedicatedFoundry/technology/cowos.htm', sourceType: 'official-technical', accessed: '2026-08-13' },
  { id: 'tsmc-direct-cooling', title: 'Ultra High Power Cooling Solution for 3D-ICs', publisher: 'TSMC Research', url: 'https://research.tsmc.com/english/research/interconnect/off-chip-interconnect/publish-time-1.html', year: 2021, sourceType: 'official-technical', accessed: '2026-08-13' },
  { id: 'dow-elecpure', title: 'DOWANOL ELECPURE PM 1 Glycol Ether', publisher: 'Dow', url: 'https://www.dow.com/en-us/pdp.dowanol-elecpure-pm-1-glycol-ether.531279z.html', sourceType: 'official-technical', accessed: '2026-08-13' },
  { id: 'ppg-copper-study', title: 'Degradation of poly(ethylene glycol–propylene glycol) copolymer and its influences on copper electrodeposition', publisher: 'Journal of Electroanalytical Chemistry', url: 'https://doi.org/10.1016/j.jelechem.2013.12.023', year: 2014, sourceType: 'research-paper', accessed: '2026-08-13' },
]

const sharedDate = '2026-08-13'

export const KNOWLEDGE_ARTICLES: KnowledgeArticle[] = [
  {
    id: 'domain-semiconductor-manufacturing', kind: 'domain', slug: 'semiconductor-manufacturing',
    title: 'How Semiconductors Are Made: The Complete Design-to-Package Process', shortTitle: 'Semiconductor manufacturing',
    description: 'A system map of semiconductor design, wafer fabrication, interconnect formation, test, assembly, packaging, and reliability qualification.',
    definition: 'Semiconductor manufacturing is a linked design and production system that converts an electronic specification into patterned devices, multilayer interconnects, tested die, and qualified packages.',
    domainIds: ['semiconductor-manufacturing'], stageIds: [...SEMICONDUCTOR_STAGES], status: 'FOUNDATIONAL', datePublished: sharedDate, dateModified: sharedDate,
    inputs: ['Product requirements and architecture', 'Verified design data and mask set', 'Semiconductor wafers', 'Process gases, chemicals, films, and metals', 'Package substrates, interconnects, and thermal materials'],
    outputs: ['Fabricated wafers', 'Known-good die candidates', 'Assembled semiconductor packages', 'Electrical, yield, and reliability records'],
    processSteps: ['Define and verify the chip architecture', 'Translate the design into physical layout and masks', 'Prepare and qualify wafers', 'Repeat deposition, lithography, etch, doping, clean, and planarization cycles', 'Form contacts and multilayer interconnects', 'Probe wafers and singulate die', 'Assemble, package, and provide power, signal, and thermal paths', 'Run final test, qualification, and failure analysis'],
    criticalParameters: ['Design-rule compliance', 'Overlay and critical dimension', 'Film thickness and material properties', 'Etch profile and selectivity', 'Dopant dose and activation', 'Defect density and yield', 'Package warpage and interconnect integrity', 'Test coverage and reliability margin'],
    failureModes: ['Design or mask error', 'Particle or pattern defect', 'Film nonuniformity', 'Electrical opens or shorts', 'Parametric yield loss', 'Die damage during thinning or singulation', 'Package-interface fatigue', 'Test escape or latent reliability failure'],
    metrology: ['Optical and electron-beam inspection', 'Critical-dimension and overlay metrology', 'Film thickness and composition measurement', 'Electrical wafer probe', 'Package inspection and system-level test', 'Accelerated reliability testing and failure analysis'],
    equipment: ['EDA compute infrastructure', 'Mask writers and inspection systems', 'Deposition reactors', 'Lithography scanners', 'Etch and clean systems', 'Ion implanters and anneal tools', 'CMP systems', 'Probe, assembly, and final-test equipment'],
    materials: ['Silicon and compound-semiconductor wafers', 'Photoresists and developers', 'Deposition precursors and process gases', 'Dopant species', 'Conductors, barriers, and dielectrics', 'CMP slurries and cleaning chemistries', 'Package substrates, underfills, molds, and thermal materials'],
    sections: [
      { heading: 'The manufacturing loop', paragraphs: ['A chip is built by repeatedly creating a material layer, patterning it, removing or modifying selected regions, measuring the result, and deciding whether the wafer can continue. Front-end device formation and back-end wiring are physically different, but they share the same control logic: each step inherits variation from the previous step and creates constraints for the next.'], claimIds: ['sm-001'] },
      { heading: 'Design and manufacturing are coupled', paragraphs: ['The process begins before a wafer enters a fab. Architecture, libraries, physical-design rules, masks, package assumptions, and test strategy define what the manufacturing flow must achieve. Yield learning then feeds back into design rules and product choices.'], claimIds: ['sm-002'] },
      { heading: 'Packaging is part of system performance', paragraphs: ['Modern packages carry power, signals, memory, mechanical protection, and heat. For multi-die products, package architecture can determine bandwidth, latency, thermal limits, and how much known-good silicon is exposed to an assembly failure.'], claimIds: ['sm-003'] },
    ],
    claims: [
      { id: 'sm-001', statement: 'Integrated circuits are manufactured through repeated layer-by-layer patterning and material-processing steps on a wafer.', provenance: 'combines-sources', empirical: 'established', sourceIds: ['asml-chip-making', 'intel-semiconductor-101'] },
      { id: 'sm-002', statement: 'Lithography transfers reticle patterns into photosensitive material, after which development and etch convert that image into physical wafer structures.', provenance: 'combines-sources', empirical: 'established', sourceIds: ['asml-chip-making', 'asml-lithography'] },
      { id: 'sm-003', statement: 'Advanced packaging combines multiple die and interconnect technologies to optimize system-level performance, power, form factor, and cost.', provenance: 'restates-source', empirical: 'interested-party', sourceIds: ['tsmc-3dfabric'], boundary: 'The optimization framing is TSMC describing the value of its own packaging portfolio, not an independent comparison.' },
    ],
    sourceIds: ['asml-chip-making', 'intel-semiconductor-101', 'tsmc-3dfabric'], relatedArticleIds: ['process-photolithography', 'process-thin-film-deposition', 'process-plasma-etch', 'process-ion-implantation-annealing', 'process-copper-interconnect-cmp', 'process-advanced-packaging'],
    intelligenceSlugs: ['angstrom-era-soc-architecture', 'semiconductor-bifurcation', 'us-foundry-sovereignization'],
  },
  {
    id: 'process-photolithography', kind: 'process', slug: 'photolithography', title: 'Photolithography: How Circuit Patterns Are Printed on a Wafer', shortTitle: 'Photolithography',
    description: 'How coating, alignment, exposure, baking, development, masks, optics, and process control create patterned resist for semiconductor fabrication.',
    definition: 'Photolithography uses light, projection optics, a reticle, and a photosensitive resist to define where later deposition, etch, implant, or clean steps may act on a wafer.',
    domainIds: ['semiconductor-manufacturing'], stageIds: ['feol', 'meol', 'beol'], status: 'FOUNDATIONAL', datePublished: sharedDate, dateModified: sharedDate,
    inputs: ['Clean wafer with the target film stack', 'Photoresist and supporting coat materials', 'Reticle or mask', 'Exposure recipe', 'Developer and rinse chemistry'], outputs: ['Patterned resist', 'Overlay and critical-dimension measurements', 'Wafer disposition for pattern transfer'],
    processSteps: ['Prepare the wafer surface', 'Spin coat resist and control edge bead', 'Bake the resist', 'Align wafer and reticle', 'Expose the field pattern', 'Post-exposure bake where required', 'Develop, rinse, and dry', 'Inspect critical dimension, overlay, and defects'],
    criticalParameters: ['Resist thickness and uniformity', 'Focus and exposure dose', 'Overlay', 'Critical dimension', 'Numerical aperture and wavelength', 'Post-exposure chemistry', 'Defectivity and line-edge roughness'],
    failureModes: ['Particles and pinholes', 'Focus or dose error', 'Overlay error', 'Resist scumming or footing', 'Pattern collapse', 'Line-edge roughness', 'Edge-bead contamination'],
    metrology: ['Overlay metrology', 'Critical-dimension SEM', 'Optical defect inspection', 'Film-thickness measurement', 'Focus-exposure matrix during process development'], equipment: ['Coater/developer track', 'DUV or EUV scanner', 'Reticle inspection', 'Bake plates', 'Optical and electron-beam metrology'], materials: ['Photoresist', 'Developer', 'Bottom or top antireflective coating', 'Edge-bead-removal solvent', 'Rinse chemistry'],
    sections: [
      { heading: 'Projection creates a latent image', paragraphs: ['A scanner projects the reticle pattern through an optical system and focuses it into a photosensitive resist. The wafer stage repeats the exposure across fields while alignment systems manage the relationship between the new layer and structures already present.'], claimIds: ['litho-001', 'litho-002'] },
      { heading: 'Resolution is a system property', paragraphs: ['Printed feature size is not determined by wavelength alone. Numerical aperture, process factor, resist behavior, mask correction, focus, exposure dose, and later pattern-transfer steps determine whether a nominal image becomes a usable device feature.'], claimIds: ['litho-003'] },
    ],
    claims: [
      { id: 'litho-001', statement: 'A lithography scanner projects a reticle pattern through optics onto photosensitive material on a wafer.', provenance: 'restates-source', empirical: 'established', sourceIds: ['asml-lithography'] },
      { id: 'litho-002', statement: 'After exposure, baking and development remove selected resist regions to create openings for later process steps.', provenance: 'restates-source', empirical: 'established', sourceIds: ['asml-chip-making'] },
      { id: 'litho-003', statement: 'The Rayleigh relationship links printable critical dimension to wavelength, numerical aperture, and a process-dependent factor.', provenance: 'restates-source', empirical: 'method-basis', sourceIds: ['asml-rayleigh'], boundary: 'The relationship is a resolution framework, not a complete predictor of production yield or pattern fidelity.' },
    ],
    sourceIds: ['asml-lithography', 'asml-rayleigh', 'asml-chip-making'], relatedArticleIds: ['domain-semiconductor-manufacturing', 'process-plasma-etch', 'material-ppg-derivatives'], intelligenceSlugs: ['angstrom-era-soc-architecture', 'semiconductor-wfe-doping-annealing-landscape'],
  },
  {
    id: 'process-thin-film-deposition', kind: 'process', slug: 'thin-film-deposition', title: 'Thin-Film Deposition: PVD, CVD, ALD, and Selective Growth', shortTitle: 'Thin-film deposition',
    description: 'How semiconductor fabs create conductive, insulating, barrier, liner, and functional films using PVD, CVD, ALD, and related methods.',
    definition: 'Thin-film deposition creates controlled layers of material on a wafer, with the selected method determined by composition, thickness, conformality, temperature budget, throughput, and integration constraints.',
    domainIds: ['semiconductor-manufacturing'], stageIds: ['feol', 'meol', 'beol', 'assembly-packaging'], status: 'FOUNDATIONAL', datePublished: sharedDate, dateModified: sharedDate,
    inputs: ['Prepared wafer surface', 'High-purity target or chemical precursors', 'Carrier and reactant gases', 'Vacuum, plasma, or thermal energy', 'Deposition recipe'], outputs: ['Conductive, dielectric, barrier, liner, seed, or functional film', 'Film-property and thickness records'],
    processSteps: ['Condition and clean the chamber and wafer surface', 'Introduce source material or precursor', 'Activate physical or chemical deposition mechanism', 'Control nucleation and growth', 'Purge or evacuate by-products', 'Measure thickness, composition, stress, and uniformity'],
    criticalParameters: ['Film thickness', 'Within-wafer uniformity', 'Conformality', 'Composition and stoichiometry', 'Resistivity or dielectric properties', 'Film stress', 'Adhesion', 'Thermal budget', 'Particles and contamination'],
    failureModes: ['Nonuniform thickness', 'Poor step coverage', 'Voids or seams', 'Delamination', 'Excess film stress', 'Composition drift', 'Particles', 'Interfacial contamination'],
    metrology: ['Ellipsometry or reflectometry', 'Sheet resistance', 'X-ray methods', 'Cross-sectional microscopy', 'Stress and bow measurement', 'Composition analysis'], equipment: ['PVD sputter system', 'CVD reactor', 'ALD reactor', 'Epitaxy reactor', 'Preclean and surface-treatment chamber'], materials: ['Metal targets', 'Volatile precursors', 'Reactant gases', 'Purge gases', 'Dielectrics', 'Conductive and barrier materials'],
    sections: [
      { heading: 'Choose the method by the required film', paragraphs: ['PVD transfers material from a source target, CVD forms a film from chemical reactions involving volatile precursors, and ALD separates surface reactions into self-limiting cycles. These methods overlap in application but differ in conformality, rate, temperature, material range, and cost.'], claimIds: ['dep-001', 'dep-002'] },
      { heading: 'Three-dimensional structures raise the conformality burden', paragraphs: ['As device structures become deeper and more three-dimensional, line-of-sight coverage becomes insufficient for some films. Conformal deposition must coat sidewalls and recessed surfaces without closing an opening prematurely or creating a seam.'], claimIds: ['dep-003'] },
    ],
    claims: [
      { id: 'dep-001', statement: 'PVD, CVD, and ALD use distinct physical and chemical mechanisms to deposit semiconductor films.', provenance: 'restates-source', empirical: 'established', sourceIds: ['applied-deposition'] },
      { id: 'dep-002', statement: 'Deposited semiconductor materials include conductors, insulators, barriers, and other functional compounds.', provenance: 'restates-source', empirical: 'established', sourceIds: ['applied-deposition'] },
      { id: 'dep-003', statement: 'ALD uses sequential self-limiting surface reactions to achieve atomic-scale thickness control and conformal coverage.', provenance: 'restates-source', empirical: 'established', sourceIds: ['applied-ald'] },
    ],
    sourceIds: ['applied-deposition', 'applied-ald'], relatedArticleIds: ['domain-semiconductor-manufacturing', 'process-photolithography', 'process-plasma-etch', 'process-copper-interconnect-cmp'], intelligenceSlugs: ['angstrom-era-soc-architecture', 'semiconductor-wfe-doping-annealing-landscape'],
  },
  {
    id: 'process-plasma-etch', kind: 'process', slug: 'plasma-etch-and-pattern-transfer', title: 'Plasma Etch and Pattern Transfer: Turning Resist Images Into Structures', shortTitle: 'Plasma etch',
    description: 'How wet, dry, plasma, selective, and atomic-layer etch remove material while controlling depth, profile, selectivity, damage, and residues.',
    definition: 'Etch selectively removes material from exposed wafer regions so that a lithographic pattern becomes a three-dimensional device, contact, or interconnect structure.',
    domainIds: ['semiconductor-manufacturing'], stageIds: ['feol', 'meol', 'beol', 'assembly-packaging'], status: 'FOUNDATIONAL', datePublished: sharedDate, dateModified: sharedDate,
    inputs: ['Patterned mask or resist', 'Film stack', 'Etchant gases or liquids', 'Plasma power and chamber recipe'], outputs: ['Patterned feature with a controlled profile', 'Etch by-products and residue', 'Post-etch inspection record'],
    processSteps: ['Select chemistry and mask', 'Stabilize wafer temperature and chamber condition', 'Generate reactive species and ions for dry etch where applicable', 'Remove exposed material', 'Control endpoint and profile', 'Strip mask or residue', 'Clean and inspect'],
    criticalParameters: ['Etch rate', 'Selectivity', 'Anisotropy', 'Sidewall profile', 'Critical-dimension bias', 'Endpoint', 'Plasma damage', 'Residue and particle level'],
    failureModes: ['Under-etch or over-etch', 'Sidewall bowing or taper', 'Mask erosion', 'Notching or microtrenching', 'Residue redeposition', 'Plasma-induced damage', 'Pattern collapse after wet processing'],
    metrology: ['Cross-sectional SEM or TEM', 'Critical-dimension SEM', 'Optical emission endpoint', 'Defect inspection', 'Electrical damage monitors'], equipment: ['Wet bench', 'Conductor etch system', 'Dielectric etch system', 'Selective etch system', 'Atomic-layer etch-capable chamber', 'Resist strip and clean system'], materials: ['Etchant gases', 'Wet etchants', 'Hard masks', 'Photoresists', 'Passivation-forming chemistries', 'Cleaning chemistries'],
    sections: [
      { heading: 'Wet and dry etch solve different profile problems', paragraphs: ['Wet etch can provide strong chemical selectivity but is often isotropic. Plasma-based dry etch combines reactive chemistry and energetic ions to create more directional material removal, which is critical for many small and high-aspect-ratio structures.'], claimIds: ['etch-001', 'etch-002'] },
      { heading: 'Profile control is as important as removal', paragraphs: ['A successful etch does not merely clear a film. It maintains the intended linewidth, sidewall shape, bottom condition, selectivity to neighboring layers, and electrical integrity while producing removable by-products.'], claimIds: ['etch-003'] },
    ],
    claims: [
      { id: 'etch-001', statement: 'Wet etching uses liquid chemistry and is commonly isotropic, while dry etching uses gases under vacuum and can provide directional profile control.', provenance: 'restates-source', empirical: 'established', sourceIds: ['lam-etch'] },
      { id: 'etch-002', statement: 'Plasma etching combines chemical reactions with ion-assisted physical effects.', provenance: 'restates-source', empirical: 'established', sourceIds: ['lam-etch'] },
      { id: 'etch-003', statement: 'Advanced etch processes are controlled by profile, selectivity, critical dimension, damage, and by-product removal—not etch rate alone.', provenance: 'maha-inference', empirical: 'bounded-inference', sourceIds: ['lam-etch'], boundary: 'The relative importance and acceptable window are specific to the target film stack and device structure.' },
    ],
    sourceIds: ['lam-etch'], relatedArticleIds: ['domain-semiconductor-manufacturing', 'process-photolithography', 'process-thin-film-deposition'], intelligenceSlugs: ['angstrom-era-soc-architecture', 'backside-microchannel-semiconductors'],
  },
  {
    id: 'process-ion-implantation-annealing', kind: 'process', slug: 'ion-implantation-and-annealing', title: 'Ion Implantation and Annealing: How Semiconductor Regions Are Doped', shortTitle: 'Ion implantation & annealing',
    description: 'How ion dose, energy, angle, masking, lattice damage, and thermal activation create electrically active semiconductor regions.',
    definition: 'Ion implantation introduces selected dopant species into a semiconductor, while subsequent thermal processing repairs implantation damage and activates dopants within the required junction geometry.',
    domainIds: ['semiconductor-manufacturing'], stageIds: ['feol'], status: 'FOUNDATIONAL', datePublished: sharedDate, dateModified: sharedDate,
    inputs: ['Patterned wafer', 'Dopant species', 'Beam energy and dose recipe', 'Thermal budget'], outputs: ['Doped semiconductor regions', 'Activated junctions', 'Dose, uniformity, and electrical records'],
    processSteps: ['Mask regions that must not be implanted', 'Generate and select an ion beam', 'Control energy, dose, angle, and wafer motion', 'Implant the target region', 'Clean if required', 'Anneal to repair damage and activate dopants', 'Measure sheet resistance and junction behavior'],
    criticalParameters: ['Species', 'Dose', 'Energy', 'Beam angle', 'Uniformity', 'Channeling', 'Lattice damage', 'Anneal temperature and time', 'Dopant diffusion and activation'],
    failureModes: ['Incorrect dose or depth', 'Channeling', 'Mask leakage', 'Crystal damage', 'Incomplete activation', 'Excess diffusion', 'Across-wafer nonuniformity', 'Contamination'],
    metrology: ['Beam-current and dose monitoring', 'Sheet resistance', 'Secondary-ion mass spectrometry', 'Junction profiling', 'Electrical test structures'], equipment: ['Beamline ion implanter', 'Plasma doping system', 'Rapid thermal anneal system', 'Laser or millisecond anneal system'], materials: ['Dopant source species', 'Implant masks', 'Process and purge gases'],
    sections: [
      { heading: 'Dose and energy define different parts of the result', paragraphs: ['Dose controls how many ions are introduced; energy strongly affects how deeply they penetrate. Beam angle, wafer crystal orientation, mask geometry, and later thermal processing shape the final electrical profile.'], claimIds: ['implant-001'] },
      { heading: 'Annealing completes the electrical process', paragraphs: ['Implantation disrupts the crystal lattice. Thermal processing is used to repair damage and move dopants into electrically active configurations, while limiting unwanted diffusion that would blur a shallow junction.'], claimIds: ['implant-002'] },
    ],
    claims: [
      { id: 'implant-001', statement: 'Ion implantation is a semiconductor doping process, with distinct equipment classes serving different energy and dose regimes.', provenance: 'restates-source', empirical: 'established', sourceIds: ['applied-implant'] },
      { id: 'implant-002', statement: 'A useful implant process must be evaluated together with its activation and thermal budget.', provenance: 'maha-inference', empirical: 'bounded-inference', sourceIds: ['applied-implant'], boundary: 'The source establishes implantation roles; the precise anneal sequence and activation target depend on the device integration flow.' },
    ],
    sourceIds: ['applied-implant'], relatedArticleIds: ['domain-semiconductor-manufacturing', 'process-photolithography', 'process-thin-film-deposition'], intelligenceSlugs: ['semiconductor-wfe-doping-annealing-landscape', 'angstrom-era-soc-architecture'],
  },
  {
    id: 'process-copper-interconnect-cmp', kind: 'process', slug: 'copper-interconnects-and-cmp', title: 'Copper Interconnects and CMP: Building and Flattening the Wiring Stack', shortTitle: 'Copper interconnects & CMP',
    description: 'How dielectric patterning, barriers, seed layers, copper fill, chemical-mechanical planarization, and cleaning form multilayer chip wiring.',
    definition: 'Copper interconnect integration forms conductive lines and vias inside patterned dielectric, then removes excess material and restores planarity so the next wiring level can be built.',
    domainIds: ['semiconductor-manufacturing'], stageIds: ['meol', 'beol'], status: 'FOUNDATIONAL', datePublished: sharedDate, dateModified: sharedDate,
    inputs: ['Patterned dielectric', 'Barrier and liner materials', 'Copper seed and plating electrolyte', 'CMP pad, slurry, and cleaning chemistry'], outputs: ['Planar copper lines and vias embedded in dielectric', 'Thickness, resistance, defect, and planarity records'],
    processSteps: ['Pattern vias and trenches', 'Prepare the surface', 'Deposit barrier, liner, and seed layers', 'Electroplate copper to fill features', 'Anneal where required', 'CMP excess copper and barrier', 'Post-CMP clean and inspect', 'Repeat for additional wiring levels'],
    criticalParameters: ['Barrier continuity', 'Seed coverage', 'Additive concentration and bath age', 'Void-free fill', 'Copper resistivity', 'CMP removal rate and selectivity', 'Dishing and erosion', 'Post-CMP particles and residues'],
    failureModes: ['Void or seam', 'Seed discontinuity', 'Copper overburden variation', 'Dishing or dielectric erosion', 'Scratch', 'Corrosion', 'Residue or particle defect', 'Electrical open, short, or high resistance'],
    metrology: ['Cross-sectional inspection', 'Sheet and line resistance', 'Film thickness', 'Optical defect inspection', 'CMP endpoint and profile measurement', 'Bath analysis'], equipment: ['Barrier and seed deposition cluster', 'Copper electroplating system', 'Anneal system', 'CMP polisher', 'Post-CMP cleaner'], materials: ['Copper electrolyte', 'Suppressor, accelerator, and leveler additives', 'Barrier and liner materials', 'Low-k dielectric', 'CMP slurry', 'Pad and conditioning disk', 'Cleaning chemistry'],
    sections: [
      { heading: 'The wiring is built into patterned dielectric', paragraphs: ['A damascene-style flow patterns the spaces that will become lines and vias, prepares those surfaces, introduces diffusion-control and seed layers, fills the features with copper, and removes excess material. The sequence is repeated to create a multilevel wiring network.'], claimIds: ['cu-001'] },
      { heading: 'CMP enables the next layer', paragraphs: ['CMP combines chemical and mechanical action to remove overburden and planarize the wafer. Planarity is essential because height variation would reduce the process window for later lithography and film formation.'], claimIds: ['cu-002'] },
      { heading: 'Plating additives are controlled process materials', paragraphs: ['Polyether suppressors can participate in copper-fill control, but performance depends on the complete bath and feature geometry. Additive degradation and bath aging can change electrochemical behavior, so replenishment and analytical control are part of the process.'], claimIds: ['cu-003'] },
    ],
    claims: [
      { id: 'cu-001', statement: 'Metal deposition technologies form contacts and interconnects, with barriers, liners, and conductive films serving distinct electrical and reliability roles.', provenance: 'restates-source', empirical: 'established', sourceIds: ['applied-deposition'] },
      { id: 'cu-002', statement: 'CMP removes excess material and restores wafer planarity for subsequent patterning and film formation.', provenance: 'restates-source', empirical: 'established', sourceIds: ['applied-cmp'] },
      { id: 'cu-003', statement: 'PEG–PPG copolymers can function as copper-electrodeposition suppressors, and their degradation can change bath and deposited-film behavior.', provenance: 'restates-source', empirical: 'established', sourceIds: ['ppg-copper-study'] },
    ],
    sourceIds: ['applied-deposition', 'applied-cmp', 'ppg-copper-study'], relatedArticleIds: ['domain-semiconductor-manufacturing', 'process-thin-film-deposition', 'process-plasma-etch', 'material-ppg-derivatives'], intelligenceSlugs: ['ppg-derivatives-semiconductor-applications', 'known-good-die-storage-yield'],
  },
  {
    id: 'process-advanced-packaging', kind: 'process', slug: 'advanced-packaging-and-heterogeneous-integration', title: 'Advanced Packaging and Heterogeneous Integration', shortTitle: 'Advanced packaging',
    description: 'How substrates, RDL, interposers, TSVs, fan-out, chiplets, memory stacks, assembly, test, and thermal design become one system.',
    definition: 'Advanced packaging integrates one or more die, memory components, and interconnect structures into a package whose electrical, thermal, mechanical, and test behavior is co-designed with the silicon.',
    domainIds: ['semiconductor-manufacturing'], stageIds: ['wafer-test', 'assembly-packaging', 'final-test-reliability'], status: 'FOUNDATIONAL', datePublished: sharedDate, dateModified: sharedDate,
    inputs: ['Tested wafers or known-good die', 'Substrate, RDL, or interposer', 'Memory and companion die', 'Bumps, bonding metals, underfill, and mold compounds', 'Thermal and mechanical components'], outputs: ['Assembled multi-die or single-die package', 'Package traceability and test record', 'Qualified system-level interconnect and thermal path'],
    processSteps: ['Define package architecture and test insertion points', 'Prepare, thin, and inspect wafers or die', 'Create RDL, bumps, TSVs, or bonding interfaces', 'Attach or bond die and memory', 'Underfill, mold, or otherwise protect interfaces', 'Attach substrate, balls, lid, or cooling structure', 'Test, inspect, qualify, and correlate failures'],
    criticalParameters: ['Known-good-die confidence', 'Interconnect pitch and alignment', 'Warpage and coplanarity', 'Underfill and mold flow', 'Power and signal integrity', 'Thermal resistance', 'Assembly yield', 'Test coverage and traceability'],
    failureModes: ['Die crack or chipping', 'Bump open or bridge', 'Bond void', 'Underfill void', 'Delamination', 'Warpage', 'Interposer or RDL defect', 'Thermal-interface failure', 'Latent interconnect fatigue'],
    metrology: ['Wafer probe', 'X-ray and scanning acoustic microscopy', 'Optical inspection', 'Electrical package test', 'Warpage measurement', 'Thermal characterization', 'Reliability stressing and failure analysis'], equipment: ['Wafer prober', 'Dicing and thinning tools', 'Bonder', 'Molding and underfill equipment', 'RDL and plating tools', 'Package tester', 'Thermal test platform'], materials: ['Organic substrates and dielectric films', 'Copper RDL and interposer structures', 'Solder or direct-bond metals', 'Underfill and mold compounds', 'Lids, TIMs, and cooling components'],
    sections: [
      { heading: 'The package is an engineered system', paragraphs: ['Advanced packaging connects logic, memory, and specialty die using package-scale or wafer-scale interconnects. Architecture choices change bandwidth, latency, power delivery, thermal paths, form factor, assembly risk, and the value exposed when a later step fails.'], claimIds: ['pkg-001'] },
      { heading: 'Test must be inserted before value accumulates', paragraphs: ['Multi-die assembly compounds value. Wafer probe, known-good-die strategy, interposer screening, intermediate test, and final test should be planned together so that a latent defect is found before it strands more expensive components.'], claimIds: ['pkg-002'] },
    ],
    claims: [
      { id: 'pkg-001', statement: 'TSMC groups SoIC, CoWoS, and InFO as complementary silicon-stacking and advanced-packaging technologies for heterogeneous integration.', provenance: 'restates-source', empirical: 'established', sourceIds: ['tsmc-3dfabric'] },
      { id: 'pkg-002', statement: 'Advanced packaging strategy requires connected design, assembly, test, and materials decisions because package interfaces jointly determine system behavior and yield exposure.', provenance: 'maha-inference', empirical: 'bounded-inference', sourceIds: ['tsmc-3dfabric', 'tsmc-cowos'], boundary: 'The exact test insertion points and commercial risk allocation are product- and supplier-specific.' },
    ],
    sourceIds: ['tsmc-3dfabric', 'tsmc-cowos'], relatedArticleIds: ['domain-semiconductor-manufacturing', 'concept-direct-to-silicon-cooling', 'material-ppg-derivatives'], intelligenceSlugs: ['advanced-packaging-test-cpo-sockets', 'smartphone-ap-fan-out-substrate-thickness', 'smartphone-ap-osat-commercial-risk-allocation', 'known-good-die-storage-yield'],
  },
  {
    id: 'concept-direct-to-silicon-cooling', kind: 'concept', slug: 'direct-to-silicon-liquid-cooling', title: 'Direct-to-Silicon Liquid Cooling: Architecture and Qualification', shortTitle: 'Direct-to-silicon cooling',
    description: 'How backside microchannels, manifolds, seals, coolants, flow control, inspection, and serviceability change AI-chip thermal management.',
    definition: 'Direct-to-silicon cooling places the liquid-cooling structure at or within the silicon-side thermal boundary, shortening the path between heat generation and coolant relative to a conventional package cold plate.',
    domainIds: ['semiconductor-manufacturing', 'ai-infrastructure'], stageIds: ['assembly-packaging', 'final-test-reliability'], status: 'ACTIVE', datePublished: sharedDate, dateModified: sharedDate,
    inputs: ['High-power die or multi-die package', 'Microchannel or silicon cooling structure', 'Manifold and sealing system', 'Qualified coolant loop', 'Monitoring and leak-response design'], outputs: ['Controlled junction temperature and hotspot distribution', 'Pressure-drop and flow record', 'Leak, chemistry, and reliability evidence'],
    processSteps: ['Co-design hotspots and channel geometry', 'Fabricate and clean cooling structures', 'Apply passivation or surface treatment where required', 'Attach and seal the manifold or lid', 'Connect and condition the coolant loop', 'Characterize thermal and hydraulic performance', 'Stress, inspect, and qualify the complete fluidic boundary'],
    criticalParameters: ['Thermal resistance', 'Flow distribution', 'Pressure drop', 'Seal integrity', 'Coolant conductivity and corrosion control', 'Particle level', 'Material compatibility', 'Warpage', 'Pump power and serviceability'],
    failureModes: ['Leakage', 'Channel blockage', 'Corrosion or ion release', 'Seal swelling or delamination', 'Flow maldistribution', 'Dry-out or vapor instability', 'Silicon weakening', 'Undetected degradation in field service'],
    metrology: ['Thermal maps and junction-temperature telemetry', 'Flow and pressure measurement', 'Tracer-gas or pressure-hold leak test', 'Coolant chemistry and particle monitoring', 'Post-stress acoustic, X-ray, and cross-sectional inspection'], equipment: ['Silicon etch and clean tools', 'Bonding or seal dispense equipment', 'Manifold assembly tools', 'Fluid loop and filtration system', 'Thermal and leak-test platform'], materials: ['Silicon or package-integrated cooler', 'Sealant or bond materials', 'Coolant and inhibitor package', 'Passivation coatings', 'Manifold, tubing, filters, and wetted metals or polymers'],
    sections: [
      { heading: 'Thermal-path compression moves the bottleneck', paragraphs: ['Bringing liquid closer to the silicon can reduce package-side thermal resistance. It also moves reliability responsibility into microchannels, bonds, seals, coolants, and field plumbing that may sit immediately beside high-value silicon.'], claimIds: ['dts-001'] },
      { heading: 'Qualification is broader than a thermal result', paragraphs: ['A production decision needs temperature, pressure-drop, pump-power, leakage, coolant-compatibility, contamination, mechanical, and lifetime evidence under the same architecture. A bench demonstration does not establish server-fleet readiness.'], claimIds: ['dts-002'] },
    ],
    claims: [
      { id: 'dts-001', statement: 'TSMC has publicly demonstrated direct silicon water-cooling structures for high-power 3D-IC applications.', provenance: 'restates-source', empirical: 'established', sourceIds: ['tsmc-direct-cooling'] },
      { id: 'dts-002', statement: 'Fleet adoption should be gated by package manufacturability, leak reliability, coolant-loop compatibility, monitoring, and serviceability in addition to thermal performance.', provenance: 'maha-inference', empirical: 'bounded-inference', sourceIds: ['tsmc-direct-cooling'], boundary: 'Public demonstrations establish feasibility, not a universal production architecture or adoption forecast.' },
    ],
    sourceIds: ['tsmc-direct-cooling'], relatedArticleIds: ['process-advanced-packaging', 'domain-semiconductor-manufacturing'], intelligenceSlugs: ['backside-microchannel-semiconductors'],
  },
  {
    id: 'material-ppg-derivatives', kind: 'material', slug: 'ppg-and-polyether-derivatives', title: 'PPG and Polyether Derivatives in Semiconductor Processes', shortTitle: 'PPG & polyether derivatives',
    description: 'How PPG, EO/PO copolymers, propylene-glycol ethers, and functional polyethers differ across plating, lithography, cleaning, and packaging.',
    definition: 'PPG-related semiconductor materials are a family of chemically distinct polyethers and glycol ethers whose process role depends on molecular architecture, functional groups, purity grade, formulation, and whether the material is removed or cured into the product.',
    domainIds: ['semiconductor-manufacturing', 'semiconductor-materials'], stageIds: ['beol', 'assembly-packaging'], status: 'ACTIVE', datePublished: sharedDate, dateModified: sharedDate,
    inputs: ['Specified chemical family and electronic grade', 'Target process formulation', 'Impurity and packaging specification', 'Application-specific qualification plan'], outputs: ['Qualified solvent, bath additive, or resin ingredient', 'Certificate-of-analysis and change-control record', 'Process and reliability correlation'],
    processSteps: ['Identify the exact chemical family', 'Define formulation function and exposure path', 'Specify metals, particles, water, ions, molecular distribution, and extractables as relevant', 'Qualify process performance', 'Verify removal or cured-network behavior', 'Lock supplier, plant, packaging, filtration, and change control'],
    criticalParameters: ['Chemical identity and functionality', 'Molecular-weight distribution', 'Trace metals and ionic species', 'Particles and nonvolatile residue', 'Solvency or adsorption behavior', 'Cure kinetics and outgassing', 'Lot-to-lot stability'],
    failureModes: ['Category substitution between unlike chemicals', 'Bath drift', 'Residue', 'Corrosion', 'Particle defect', 'Incomplete cure', 'Swelling or delamination', 'Uncontrolled supplier change'],
    metrology: ['Chromatography and spectroscopy', 'Trace-metal and ion analysis', 'Particle counting', 'Nonvolatile-residue measurement', 'Electrochemical bath analysis', 'Rheology and cure analysis', 'Package reliability testing'], equipment: ['Chemical purification and filtration', 'Point-of-use dispense', 'Plating bath control', 'Coater/developer track', 'Formulation and cure equipment'], materials: ['PPG homopolymers', 'EO/PO block copolymers', 'Propylene-glycol ethers', 'Amine-terminated polyethers', 'Functionalized polyether resins'],
    sections: [
      { heading: 'Shared feedstock does not mean shared qualification', paragraphs: ['A PPG homopolymer, an EO/PO block copolymer, a propylene-glycol ether solvent, and an amine-terminated polyether have different physical properties and process functions. They should not be merged into one approved-material category.'], claimIds: ['ppg-001'] },
      { heading: 'Two publicly evidenced use families', paragraphs: ['Polyether suppressors have been studied in copper electrodeposition, while electronic-grade propylene-glycol ethers are marketed for photoresist, thinner, and edge-bead-removal applications. Packaging uses require separate formulation-level evidence because reactive ingredients become part of a cured network.'], claimIds: ['ppg-002', 'ppg-003'] },
    ],
    claims: [
      { id: 'ppg-001', statement: 'PPG polymers, EO/PO block copolymers, propylene-glycol ethers, and functional polyethers are distinct material families despite related propylene-oxide chemistry.', provenance: 'maha-inference', empirical: 'method-basis', sourceIds: ['dow-elecpure', 'ppg-copper-study'], boundary: 'The separation is a Maha classification framework for qualification decisions; the cited sources describe individual materials rather than asserting the taxonomy.' },
      { id: 'ppg-002', statement: 'PEG–PPG copolymers have been studied as suppressors in copper electrodeposition.', provenance: 'restates-source', empirical: 'established', sourceIds: ['ppg-copper-study'] },
      { id: 'ppg-003', statement: 'Dow markets an electronic-grade propylene-glycol ether for semiconductor photoresist, thinner, and edge-bead-removal uses.', provenance: 'restates-source', empirical: 'interested-party', sourceIds: ['dow-elecpure'], boundary: 'A supplier product page does not establish qualification at a named fab or in a named product.' },
    ],
    sourceIds: ['dow-elecpure', 'ppg-copper-study'], relatedArticleIds: ['process-photolithography', 'process-copper-interconnect-cmp', 'process-advanced-packaging'], intelligenceSlugs: ['ppg-derivatives-semiconductor-applications'],
  },
  {
    id: 'process-ic-design-tapeout', kind: 'process', slug: 'ic-design-to-tapeout', title: 'IC Design to Tape-Out: Turning a Product Idea Into Manufacturing Data', shortTitle: 'IC design to tape-out',
    description: 'How requirements become architecture, verified logic, physical layout, signoff evidence, and the released database used to make masks.',
    definition: 'The design-to-tape-out flow converts product requirements into a verified physical representation of an integrated circuit that satisfies functional, timing, power, physical, and manufacturing constraints.',
    domainIds: ['semiconductor-manufacturing'], stageIds: ['design'], status: 'FOUNDATIONAL', datePublished: sharedDate, dateModified: sharedDate,
    inputs: ['Product requirements', 'Process design kit', 'IP blocks and standard-cell libraries', 'Package, power, and test assumptions'], outputs: ['Signed-off layout database', 'Manufacturing handoff package', 'Verification and waiver record'],
    processSteps: ['Define requirements and architecture', 'Create and verify logic', 'Synthesize and implement the design', 'Close timing, power, signal integrity, and physical checks', 'Run final signoff', 'Release the tape-out database'],
    criticalParameters: ['Functional coverage', 'Timing margin', 'Power and voltage drop', 'Clock integrity', 'Area', 'Design-rule compliance', 'Layout-versus-schematic agreement'],
    failureModes: ['Ambiguous requirement', 'Unverified corner case', 'Timing violation', 'Power-integrity failure', 'Physical-rule violation', 'Incorrect library or process assumptions'],
    metrology: ['Simulation and formal verification', 'Static timing analysis', 'Power-integrity analysis', 'Design-rule checking', 'Layout-versus-schematic checking'], equipment: ['EDA compute environment', 'Version-control and regression infrastructure', 'Signoff tools'], materials: ['Process design kit data', 'Cell libraries', 'IP models', 'Layout database'],
    sections: [
      { heading: 'Tape-out is a controlled release', paragraphs: ['Tape-out is the point at which the implementation is released for mask preparation. It follows converging verification loops rather than a single linear drawing exercise: functional behavior, timing, power, physical geometry, and manufacturability all need explicit closure.'], claimIds: ['tape-001'] },
      { heading: 'The process design kit binds design to fabrication', paragraphs: ['Models, rules, libraries, and extraction data translate the foundry process into constraints that design tools can analyze. A change in process assumptions can therefore invalidate results even when the logical function is unchanged.'], claimIds: ['tape-002'] },
    ],
    claims: [
      { id: 'tape-001', statement: 'IC design progresses from specification and architecture through logical and physical implementation to verification and manufacturing release.', provenance: 'combines-sources', empirical: 'established', sourceIds: ['synopsys-ic-design', 'synopsys-chip-design'] },
      { id: 'tape-002', statement: 'Physical signoff evaluates whether the layout satisfies process rules and implementation constraints before tape-out.', provenance: 'combines-sources', empirical: 'established', sourceIds: ['synopsys-physical-design', 'synopsys-drc'] },
    ],
    sourceIds: ['synopsys-ic-design', 'synopsys-chip-design', 'synopsys-physical-design', 'synopsys-drc'], relatedArticleIds: ['process-rtl-to-physical-design', 'process-mask-data-reticle-fabrication', 'domain-semiconductor-manufacturing'], intelligenceSlugs: ['angstrom-era-soc-architecture'],
  },
  {
    id: 'process-rtl-to-physical-design', kind: 'process', slug: 'rtl-verification-synthesis-physical-design', title: 'RTL, Verification, Synthesis, and Physical Design', shortTitle: 'RTL to physical design',
    description: 'The core digital implementation flow from behavioral hardware description to placed, routed, extracted, and signed-off geometry.',
    definition: 'RTL-to-physical-design is the sequence that defines clocked behavior, proves intended function, maps logic into a target library, and implements connected cells as manufacturable geometry.',
    domainIds: ['semiconductor-manufacturing'], stageIds: ['design'], status: 'FOUNDATIONAL', datePublished: sharedDate, dateModified: sharedDate,
    inputs: ['Architecture and microarchitecture', 'RTL and verification environment', 'Timing and power constraints', 'Libraries and process design kit'], outputs: ['Verified netlist', 'Placed-and-routed layout', 'Timing, power, and physical signoff reports'],
    processSteps: ['Write RTL', 'Lint and verify behavior', 'Synthesize to gates', 'Plan power, clocks, and floorplan', 'Place cells and route nets', 'Extract parasitics', 'Close signoff'],
    criticalParameters: ['Coverage', 'Clock frequency', 'Setup and hold slack', 'Congestion', 'Power density', 'Voltage drop', 'Signal integrity'],
    failureModes: ['Specification mismatch', 'Coverage gap', 'Constraint error', 'Unroutable congestion', 'Timing failure', 'IR drop or electromigration risk'],
    metrology: ['Coverage reports', 'Equivalence checking', 'Static timing analysis', 'Parasitic extraction', 'Power and physical verification'], equipment: ['RTL simulation and formal tools', 'Synthesis tools', 'Place-and-route tools', 'Signoff analysis tools'], materials: ['RTL source', 'Constraints', 'Libraries', 'Technology files'],
    sections: [
      { heading: 'RTL describes clock-to-clock behavior', paragraphs: ['Register-transfer level design captures how data is transformed and moved between state elements. Verification asks whether this behavior meets the specification before synthesis commits it to a particular cell library.'], claimIds: ['rtl-001'] },
      { heading: 'Physical design creates the geometric implementation', paragraphs: ['Floorplanning, placement, clock construction, and routing turn a netlist into layout. Extraction then feeds the physical effects of wires and devices back into timing, power, and signal-integrity analysis.'], claimIds: ['rtl-002'] },
    ],
    claims: [
      { id: 'rtl-001', statement: 'RTL models synchronous digital behavior in terms of data transfers and operations between registers.', provenance: 'restates-source', empirical: 'established', sourceIds: ['synopsys-rtl-design'] },
      { id: 'rtl-002', statement: 'Physical design transforms a logical netlist into an implemented layout through floorplanning, placement, clocking, routing, and signoff analysis.', provenance: 'restates-source', empirical: 'established', sourceIds: ['synopsys-physical-design'] },
    ],
    sourceIds: ['synopsys-rtl-design', 'synopsys-physical-design'], relatedArticleIds: ['process-ic-design-tapeout', 'process-mask-data-reticle-fabrication'], intelligenceSlugs: ['angstrom-era-soc-architecture'],
  },
  {
    id: 'process-mask-data-reticle-fabrication', kind: 'process', slug: 'mask-data-preparation-and-reticle-fabrication', title: 'Mask Data Preparation and Reticle Fabrication', shortTitle: 'Masks and reticles',
    description: 'How signed-off chip layout is corrected, fractured, written, processed, inspected, repaired, and qualified as a lithography reticle set.',
    definition: 'Mask data preparation converts design layout into writer-ready shapes, while reticle fabrication forms and qualifies the physical master patterns projected by lithography tools.',
    domainIds: ['semiconductor-manufacturing'], stageIds: ['design'], status: 'FOUNDATIONAL', datePublished: sharedDate, dateModified: sharedDate,
    inputs: ['Signed-off layout database', 'Optical and process models', 'Mask blank', 'Layer-specific acceptance criteria'], outputs: ['Qualified reticle set', 'Inspection and repair records', 'Pellicle and release documentation'],
    processSteps: ['Apply resolution-enhancement corrections', 'Fracture geometry into writer shots', 'Write the mask blank', 'Develop and etch the absorber pattern', 'Clean and inspect', 'Repair acceptable defects', 'Mount pellicle and qualify'],
    criticalParameters: ['Critical dimension', 'Registration', 'Pattern fidelity', 'Blank and pattern defects', 'Writer accuracy', 'Contamination'],
    failureModes: ['Data-preparation error', 'Writer defect', 'Critical-dimension error', 'Registration error', 'Unrepaired particle or pattern defect', 'Pellicle contamination'],
    metrology: ['Aerial-image measurement', 'Critical-dimension metrology', 'Registration metrology', 'Actinic or optical inspection', 'Defect review'], equipment: ['Mask data-preparation compute', 'Electron-beam mask writer', 'Mask process track', 'Etcher', 'Reticle inspection and repair tools'], materials: ['Quartz mask blank', 'Absorber film', 'Mask resist', 'Pellicle'],
    sections: [
      { heading: 'The drawn layout is transformed before writing', paragraphs: ['Manufacturing data includes optical and process corrections that intentionally distort mask shapes so the wafer image approaches the intended geometry. Fracturing then converts those shapes into instructions the mask writer can execute.'], claimIds: ['mask-001'] },
      { heading: 'Reticle defects repeat', paragraphs: ['A reticle is reused across many wafer fields. Defects that print can therefore be replicated across many die, which makes inspection, review, cleaning, repair, and controlled release central to mask economics and yield protection.'], claimIds: ['mask-002'] },
    ],
    claims: [
      { id: 'mask-001', statement: 'Lithography uses a reticle as the master pattern projected onto photosensitive material on the wafer.', provenance: 'restates-source', empirical: 'established', sourceIds: ['asml-lithography'] },
      { id: 'mask-002', statement: 'Reticle inspection and metrology protect yield because printable reticle defects can repeat across wafer fields.', provenance: 'combines-sources', empirical: 'established', sourceIds: ['kla-2019-10k', 'kla-2024-10k'] },
    ],
    sourceIds: ['asml-lithography', 'kla-2019-10k', 'kla-2024-10k'], relatedArticleIds: ['process-ic-design-tapeout', 'process-photolithography', 'concept-metrology-defect-inspection'], intelligenceSlugs: ['angstrom-era-soc-architecture'],
  },
  {
    id: 'process-silicon-wafer-preparation', kind: 'process', slug: 'silicon-crystal-growth-and-wafer-preparation', title: 'Silicon Crystal Growth and Wafer Preparation', shortTitle: 'Silicon wafer preparation',
    description: 'How electronic-grade silicon becomes a flat, polished, oriented, and qualified substrate for device fabrication.',
    definition: 'Wafer preparation converts purified silicon into a controlled single-crystal ingot and then into sliced, edge-shaped, lapped, etched, polished, cleaned, and inspected wafers.',
    domainIds: ['semiconductor-manufacturing'], stageIds: ['wafer-preparation'], status: 'FOUNDATIONAL', datePublished: sharedDate, dateModified: sharedDate,
    inputs: ['Electronic-grade polysilicon', 'Dopant specification', 'Seed crystal', 'Crystal-growth atmosphere'], outputs: ['Polished semiconductor wafers', 'Orientation, resistivity, flatness, and defect records'],
    processSteps: ['Melt and dope silicon', 'Pull a single-crystal ingot', 'Shape and orient the ingot', 'Slice wafers', 'Edge, lap, and etch', 'Polish the surface', 'Clean and inspect'],
    criticalParameters: ['Crystal orientation', 'Resistivity', 'Oxygen and carbon', 'Dislocation density', 'Thickness', 'Warp and bow', 'Surface roughness', 'Particles'],
    failureModes: ['Crystal defect', 'Resistivity nonuniformity', 'Saw damage', 'Edge chip', 'Excess warp', 'Polish defect', 'Metal or particle contamination'],
    metrology: ['Crystal and resistivity mapping', 'Geometry measurement', 'Surface inspection', 'Particle counting', 'Defect imaging'], equipment: ['Crystal puller', 'Ingot grinder and orientation tools', 'Wire saw', 'Lapping and etch tools', 'Polisher', 'Cleaner and inspection tools'], materials: ['Electronic-grade silicon', 'Dopants', 'Polishing slurry', 'Etchants and cleaning chemicals'],
    sections: [
      { heading: 'The wafer is an engineered starting material', paragraphs: ['A production wafer carries specifications for crystal orientation, electrical resistivity, geometry, surface condition, and defectivity. Those properties influence later oxidation, implantation, lithography focus, film uniformity, handling, and electrical behavior.'], claimIds: ['wafer-001'] },
      { heading: 'Preparation removes damage while controlling geometry', paragraphs: ['Slicing creates mechanical damage and thickness variation. Edge shaping, lapping, etching, polishing, and cleaning progressively establish the flat, low-defect surface and stable geometry required by wafer-fab tools.'], claimIds: ['wafer-002'] },
    ],
    claims: [
      { id: 'wafer-001', statement: 'Semiconductor wafers are produced from high-purity single-crystal material and provide the substrate on which repeated chip-fabrication steps are performed.', provenance: 'restates-source', empirical: 'established', sourceIds: ['samsung-wafer'] },
      { id: 'wafer-002', statement: 'Wafer manufacturing includes ingot processing, slicing, grinding, and polishing before device fabrication.', provenance: 'combines-sources', empirical: 'established', sourceIds: ['samsung-wafer', 'disco-process'] },
    ],
    sourceIds: ['samsung-wafer', 'disco-process'], relatedArticleIds: ['process-wafer-cleaning-surface-preparation', 'domain-semiconductor-manufacturing'], intelligenceSlugs: ['semiconductor-bifurcation'],
  },
  {
    id: 'process-wafer-cleaning-surface-preparation', kind: 'process', slug: 'wafer-cleaning-and-surface-preparation', title: 'Wafer Cleaning and Surface Preparation', shortTitle: 'Wafer cleaning',
    description: 'How wet, vapor, plasma, and brush cleans remove particles, organics, metals, polymers, oxides, and residues between critical process steps.',
    definition: 'Wafer cleaning selectively removes contamination and process residue while preserving the target surface chemistry, dimensions, films, and device structures.',
    domainIds: ['semiconductor-manufacturing'], stageIds: ['wafer-preparation', 'feol', 'meol', 'beol'], status: 'FOUNDATIONAL', datePublished: sharedDate, dateModified: sharedDate,
    inputs: ['Contaminated or processed wafer', 'Qualified cleaning chemistry', 'Ultrapure water and gases', 'Surface-specific recipe'], outputs: ['Prepared wafer surface', 'Particle, metal, residue, and surface-state evidence'],
    processSteps: ['Characterize the incoming surface', 'Remove bulk residue', 'Apply chemistry for target contaminants', 'Rinse without redeposition', 'Dry without watermarking', 'Inspect and release'],
    criticalParameters: ['Particle removal efficiency', 'Metal and ionic contamination', 'Material loss', 'Surface termination', 'Temperature', 'Megasonic energy', 'Rinse quality and dry behavior'],
    failureModes: ['Residual particle or polymer', 'Cross-contamination', 'Galvanic corrosion', 'Excess film loss', 'Watermark', 'Pattern collapse', 'Backside or bevel contamination'],
    metrology: ['Surface particle inspection', 'Trace-metal analysis', 'Contact-angle or surface-state measurement', 'Film thickness', 'Defect review'], equipment: ['Single-wafer wet cleaner', 'Batch wet bench', 'Brush scrubber', 'Vapor or plasma clean system', 'Spin rinse dryer'], materials: ['Ultrapure water', 'Acids and bases', 'Oxidizers', 'Solvents', 'Surfactants', 'Drying gases'],
    sections: [
      { heading: 'Cleaning is repeated throughout fabrication', paragraphs: ['Deposition, etch, resist strip, CMP, and handling can leave different contaminants. A clean therefore has to be selective to the residue and to the materials that must remain; there is no single universal wafer-clean recipe.'], claimIds: ['clean-001'] },
      { heading: 'Edges and backsides matter', paragraphs: ['Films and particles on the bevel or backside can transfer to chucks, distort thermal contact, or shed into later chambers. Production clean strategies commonly treat these surfaces as part of contamination control rather than as inactive wafer area.'], claimIds: ['clean-002'] },
    ],
    claims: [
      { id: 'clean-001', statement: 'Wafer cleaning is used repeatedly to remove particles, residues, and unwanted films between semiconductor process steps.', provenance: 'combines-sources', empirical: 'established', sourceIds: ['lam-wet-clean', 'tel-process-equipment'] },
      { id: 'clean-002', statement: 'Backside and bevel film removal can prevent contamination and downstream process interference.', provenance: 'restates-source', empirical: 'established', sourceIds: ['lam-wet-clean'] },
    ],
    sourceIds: ['lam-wet-clean', 'tel-process-equipment'], relatedArticleIds: ['process-silicon-wafer-preparation', 'process-photolithography', 'process-plasma-etch', 'process-copper-interconnect-cmp'], intelligenceSlugs: ['ppg-derivatives-semiconductor-applications'],
  },
  {
    id: 'process-thermal-oxidation-diffusion', kind: 'process', slug: 'thermal-oxidation-diffusion-and-furnace-processing', title: 'Thermal Oxidation, Diffusion, and Furnace Processing', shortTitle: 'Thermal processing',
    description: 'How controlled temperature and atmosphere grow oxide, diffuse species, anneal films, drive reactions, and stabilize wafer structures.',
    definition: 'Thermal processing exposes wafers to controlled time-temperature-atmosphere cycles to grow, densify, react, diffuse, activate, or repair materials.',
    domainIds: ['semiconductor-manufacturing'], stageIds: ['feol', 'meol', 'beol'], status: 'FOUNDATIONAL', datePublished: sharedDate, dateModified: sharedDate,
    inputs: ['Prepared wafers', 'Qualified gases or vapor', 'Temperature and ambient recipe', 'Thermal budget'], outputs: ['Grown oxide or thermally modified structure', 'Thickness, uniformity, and electrical records'],
    processSteps: ['Load wafers under contamination control', 'Purge and establish ambient', 'Ramp temperature', 'Hold or pulse the process condition', 'Cool under control', 'Measure film and electrical response'],
    criticalParameters: ['Temperature accuracy', 'Time', 'Gas composition and flow', 'Pressure', 'Ramp rate', 'Within-wafer and wafer-to-wafer uniformity', 'Cumulative thermal budget'],
    failureModes: ['Nonuniform oxide', 'Excess diffusion', 'Contamination', 'Slip or stress defect', 'Film densification error', 'Incomplete activation', 'Particle generation'],
    metrology: ['Ellipsometry', 'Sheet resistance', 'SIMS or dopant profiling', 'Electrical test structures', 'Particle and defect inspection'], equipment: ['Batch diffusion furnace', 'Rapid thermal processor', 'Oxidation furnace', 'Anneal chamber'], materials: ['Oxygen', 'Steam', 'Nitrogen and inert gases', 'Dopant-source chemistry'],
    sections: [
      { heading: 'Thermal budget is cumulative', paragraphs: ['Every high-temperature step can change dopant profiles, stress, interfaces, and existing films. Integration therefore manages the entire thermal history rather than optimizing each furnace recipe in isolation.'], claimIds: ['thermal-001'] },
      { heading: 'Batch and rapid processing trade time against control', paragraphs: ['Batch furnaces provide high wafer throughput and long, stable exposures; rapid thermal tools shorten the exposure and can limit diffusion. The correct choice depends on the reaction, uniformity target, and material stack.'], claimIds: ['thermal-002'] },
    ],
    claims: [
      { id: 'thermal-001', statement: 'Semiconductor thermal processing includes oxidation, diffusion, and other controlled heat treatments used during wafer fabrication.', provenance: 'restates-source', empirical: 'established', sourceIds: ['tel-process-equipment'] },
      { id: 'thermal-002', statement: 'Thermal processing must be managed as part of a cumulative integration budget because later heat can alter structures created earlier.', provenance: 'maha-inference', empirical: 'bounded-inference', sourceIds: ['tel-process-equipment', 'applied-implant'], boundary: 'Exact allowable histories depend on the device, materials, and node.' },
    ],
    sourceIds: ['tel-process-equipment', 'applied-implant'], relatedArticleIds: ['process-ion-implantation-annealing', 'process-thin-film-deposition', 'concept-yield-learning-spc'], intelligenceSlugs: ['semiconductor-wfe-doping-annealing-landscape'],
  },
  {
    id: 'concept-metrology-defect-inspection', kind: 'concept', slug: 'semiconductor-metrology-and-defect-inspection', title: 'Semiconductor Metrology and Defect Inspection', shortTitle: 'Metrology & inspection',
    description: 'How fabs measure dimensions, overlay, films, composition, defects, and electrical behavior without confusing measurement with process control.',
    definition: 'Metrology quantifies specified properties, while inspection searches for anomalies or defects; together they provide the evidence used to control processes, disposition wafers, and learn yield.',
    domainIds: ['semiconductor-manufacturing'], stageIds: ['wafer-preparation', 'feol', 'meol', 'beol', 'wafer-test', 'assembly-packaging'], status: 'FOUNDATIONAL', datePublished: sharedDate, dateModified: sharedDate,
    inputs: ['Wafer, reticle, die, or package', 'Sampling plan', 'Measurement recipe', 'Reference and calibration data'], outputs: ['Measurements and defect maps', 'Statistical signals', 'Disposition and root-cause evidence'],
    processSteps: ['Define the measurand or defect class', 'Calibrate the system', 'Select sites and sampling frequency', 'Acquire data', 'Classify and correlate signals', 'Feed results to process and yield control'],
    criticalParameters: ['Accuracy', 'Precision', 'Repeatability', 'Detection sensitivity', 'Nuisance rate', 'Sampling coverage', 'Throughput', 'Tool matching'],
    failureModes: ['Missed defect', 'False alarm', 'Sampling blind spot', 'Calibration drift', 'Recipe mismatch', 'Misclassification', 'Slow feedback'],
    metrology: ['Optical and electron-beam inspection', 'CD and overlay metrology', 'Film and composition measurement', 'X-ray and acoustic imaging', 'Electrical test'], equipment: ['Optical inspector', 'E-beam inspector or review SEM', 'Ellipsometer', 'Overlay tool', 'X-ray and acoustic microscope'], materials: ['Calibration standards', 'Reference wafers and reticles', 'Defect-review database'],
    sections: [
      { heading: 'Measurement answers a defined question', paragraphs: ['A useful control plan states what property matters, where and how often it is sampled, how uncertainty compares with the process window, and what action follows an excursion. More data is not automatically better control.'], claimIds: ['metro-001'] },
      { heading: 'Inspection and review form a learning loop', paragraphs: ['High-throughput inspection finds candidate anomalies; review and classification determine which signals represent meaningful defect mechanisms. Correlation with process history and electrical yield turns those observations into root-cause evidence.'], claimIds: ['metro-002'] },
    ],
    claims: [
      { id: 'metro-001', statement: 'Semiconductor process control relies on inspection, metrology, and data analysis across reticle, wafer, and packaging operations.', provenance: 'restates-source', empirical: 'established', sourceIds: ['kla-2024-10k'] },
      { id: 'metro-002', statement: 'Inspection and metrology data can be combined with analysis to identify defect sources and support yield improvement.', provenance: 'combines-sources', empirical: 'interested-party', sourceIds: ['kla-2019-10k', 'kla-2024-10k'], boundary: 'A supplier annual report describes the intended benefit of its own inspection products; it does not independently quantify yield gains.' },
    ],
    sourceIds: ['kla-2024-10k', 'kla-2019-10k'], relatedArticleIds: ['concept-yield-learning-spc', 'process-mask-data-reticle-fabrication', 'concept-cleanrooms-fab-utilities'], intelligenceSlugs: ['semiconductor-bifurcation'],
  },
  {
    id: 'concept-yield-learning-spc', kind: 'concept', slug: 'yield-learning-and-statistical-process-control', title: 'Yield Learning and Statistical Process Control', shortTitle: 'Yield learning & SPC',
    description: 'How measurements, defect maps, equipment history, electrical test, and controlled experiments become process corrections and design feedback.',
    definition: 'Yield learning links physical and electrical losses to probable causes, while statistical process control detects meaningful change in production variables before it becomes widespread output loss.',
    domainIds: ['semiconductor-manufacturing'], stageIds: [...SEMICONDUCTOR_STAGES], status: 'FOUNDATIONAL', datePublished: sharedDate, dateModified: sharedDate,
    inputs: ['Process measurements', 'Defect and wafer maps', 'Equipment and material history', 'Electrical test and bin data', 'Designed experiments'], outputs: ['Excursion containment', 'Root-cause hypotheses', 'Corrective action', 'Updated process windows and design guidance'],
    processSteps: ['Establish stable baselines and control limits', 'Detect excursions or yield signatures', 'Trace affected material and equipment', 'Correlate physical and electrical evidence', 'Test root-cause hypotheses', 'Implement and verify corrective action'],
    criticalParameters: ['Data traceability', 'Measurement-system capability', 'Control-limit design', 'Sampling latency', 'False-alarm rate', 'Experiment discipline', 'Feedback speed'],
    failureModes: ['Common-cause variation treated as an excursion', 'Real excursion hidden by sampling', 'Confounded correlation', 'Poor genealogy', 'Unverified corrective action', 'Local optimization that shifts loss downstream'],
    metrology: ['Control charts', 'Pareto and spatial-pattern analysis', 'Defect-to-test correlation', 'Equipment health monitoring', 'Designed experiments'], equipment: ['Manufacturing execution and fault-detection systems', 'Yield-analysis platform', 'Inspection and test databases'], materials: ['Wafer genealogy', 'Recipe and equipment logs', 'Defect images', 'Electrical-test records'],
    sections: [
      { heading: 'SPC detects change; it does not prove cause', paragraphs: ['A control-chart signal indicates that a process may no longer behave like its baseline. Root cause still requires traceability, physical evidence, engineering knowledge, and often a controlled experiment.'], claimIds: ['yield-001'] },
      { heading: 'Yield is a lifecycle feedback signal', paragraphs: ['Loss can originate in design sensitivity, masks, wafer processing, probing, handling, assembly, or test. The most valuable yield systems preserve genealogy across these boundaries so a downstream signature can be traced to upstream conditions.'], claimIds: ['yield-002'] },
    ],
    claims: [
      { id: 'yield-001', statement: 'Inspection and metrology information is analyzed to support process monitoring, root-cause identification, and yield improvement.', provenance: 'combines-sources', empirical: 'interested-party', sourceIds: ['kla-2019-10k', 'kla-2024-10k'], boundary: 'KLA describes the purpose of its own metrology portfolio; independent evidence would be needed to size the yield contribution.' },
      { id: 'yield-002', statement: 'Manufacturing engineering uses integrated process and equipment control to improve capability and sustain production performance.', provenance: 'restates-source', empirical: 'interested-party', sourceIds: ['tsmc-engineering'], boundary: 'TSMC describes the performance of its own manufacturing engineering; the claim is not independently audited.' },
    ],
    sourceIds: ['kla-2019-10k', 'kla-2024-10k', 'tsmc-engineering'], relatedArticleIds: ['concept-metrology-defect-inspection', 'concept-cleanrooms-fab-utilities', 'process-wafer-sort'], intelligenceSlugs: ['known-good-die-storage-yield', 'semiconductor-bifurcation'],
  },
  {
    id: 'concept-cleanrooms-fab-utilities', kind: 'concept', slug: 'cleanrooms-fab-utilities-and-contamination-control', title: 'Cleanrooms, Fab Utilities, and Contamination Control', shortTitle: 'Cleanrooms & fab utilities',
    description: 'Why airflow, ultrapure water, gases, vacuum, chemicals, temperature, vibration, and material discipline are part of the semiconductor process.',
    definition: 'A semiconductor fab is a controlled production environment whose facility systems maintain the cleanliness, chemistry, energy, mechanical stability, and safe material delivery required by process tools.',
    domainIds: ['semiconductor-manufacturing'], stageIds: ['wafer-preparation', 'feol', 'meol', 'beol'], status: 'FOUNDATIONAL', datePublished: sharedDate, dateModified: sharedDate,
    inputs: ['Make-up air and recirculated clean air', 'Ultrapure water', 'Bulk and specialty gases', 'Chemicals', 'Electric power and cooling water'], outputs: ['Controlled tool environment', 'Qualified utility streams', 'Contamination and facility-monitoring records'],
    processSteps: ['Filter and condition air', 'Generate and distribute ultrapure water and gases', 'Deliver chemicals at controlled purity', 'Maintain vacuum, exhaust, and abatement', 'Monitor particles, molecular contamination, vibration, and temperature', 'Trace excursions'],
    criticalParameters: ['Airborne particles', 'Molecular contamination', 'Water resistivity and organics', 'Gas purity', 'Temperature and humidity', 'Vibration', 'Pressure balance', 'Utility uptime'],
    failureModes: ['Particle excursion', 'Trace-metal or organic contamination', 'Water-quality drift', 'Gas cross-connection', 'Pressure upset', 'Vibration-induced tool error', 'Utility interruption'],
    metrology: ['Air and liquid particle counters', 'Chemical and trace-metal analysis', 'Temperature and humidity sensors', 'Vibration monitoring', 'Utility alarm and trend systems'], equipment: ['Air handlers and filters', 'Ultrapure-water plant', 'Gas cabinets and distribution', 'Chemical delivery', 'Vacuum, exhaust, scrubbers, and chillers'], materials: ['Filters', 'High-purity piping', 'Process gases', 'Water-treatment media', 'Cleaning and abatement chemistry'],
    sections: [
      { heading: 'The cleanroom is only one control layer', paragraphs: ['Airborne particles are visible symbols of fab cleanliness, but contamination also arrives through water, gases, chemicals, carriers, tool chambers, people, and wafer backsides. Facility and tool controls have to operate as one system.'], claimIds: ['fab-001'] },
      { heading: 'Utilities influence process results', paragraphs: ['Temperature, vibration, pressure, water chemistry, gas purity, and power stability can shift tool performance. Monitoring utility genealogy alongside wafer history helps distinguish a process excursion from a facility-driven event.'], claimIds: ['fab-002'] },
    ],
    claims: [
      { id: 'fab-001', statement: 'Semiconductor fabrication is performed in highly controlled cleanroom environments to limit contamination during repeated wafer-processing steps.', provenance: 'restates-source', empirical: 'established', sourceIds: ['samsung-fab'] },
      { id: 'fab-002', statement: 'Stable production depends on the integration of process tools, engineering controls, and the fab environment.', provenance: 'maha-inference', empirical: 'bounded-inference', sourceIds: ['samsung-fab', 'tsmc-engineering'], boundary: 'Exact utility specifications and contamination limits vary by technology and factory.' },
    ],
    sourceIds: ['samsung-fab', 'tsmc-engineering'], relatedArticleIds: ['process-wafer-cleaning-surface-preparation', 'concept-metrology-defect-inspection', 'concept-yield-learning-spc'], intelligenceSlugs: ['us-foundry-sovereignization'],
  },
  {
    id: 'process-wafer-sort', kind: 'process', slug: 'wafer-acceptance-test-and-wafer-sort', title: 'Wafer Acceptance Test and Wafer Sort', shortTitle: 'Wafer sort',
    description: 'How process-monitor structures and individual die are electrically probed before assembly, generating parametric evidence and known-good-die candidates.',
    definition: 'Wafer-level electrical test measures process structures and die through temporary probe contact to monitor fabrication, classify die, and avoid packaging clearly failing units.',
    domainIds: ['semiconductor-manufacturing'], stageIds: ['wafer-test'], status: 'FOUNDATIONAL', datePublished: sharedDate, dateModified: sharedDate,
    inputs: ['Completed wafer', 'Test program and limits', 'Probe card and tester interface', 'Wafer map and product genealogy'], outputs: ['Parametric and functional results', 'Die bin map', 'Known-good-die candidates', 'Yield signatures'],
    processSteps: ['Align wafer and probe interface', 'Contact process-monitor or die pads', 'Apply electrical stimuli and measure response', 'Control temperature where required', 'Assign bins and record coordinates', 'Review yield and release wafer'],
    criticalParameters: ['Probe contact resistance', 'Test coverage', 'Limits and guardbands', 'Temperature', 'Parallelism', 'Contact force', 'Retest policy'],
    failureModes: ['False fail from poor contact', 'Test escape', 'Pad damage', 'Coordinate or map error', 'Overly wide or tight limits', 'Thermal instability'],
    metrology: ['Parametric test', 'Scan and built-in self-test', 'Leakage and continuity', 'Yield-map and bin analysis'], equipment: ['Automatic test equipment', 'Wafer prober', 'Probe card', 'Thermal chuck', 'Test-cell handler and data system'], materials: ['Probe needles or MEMS contacts', 'Reference wafers', 'Test programs and limit sets'],
    sections: [
      { heading: 'Wafer test serves both process and product decisions', paragraphs: ['Process-monitor structures reveal whether fabrication met electrical targets; die-level tests classify individual circuits before the wafer is cut. The resulting spatial patterns can also point back to equipment, patterning, or contamination mechanisms.'], claimIds: ['sort-001'] },
      { heading: 'Known-good die is a probability, not an absolute', paragraphs: ['Wafer sort is constrained by contact, time, temperature, coverage, and observability. A passing die is a qualified candidate for assembly under a defined test flow, not proof that every latent defect or later package interaction has been eliminated.'], claimIds: ['sort-002'] },
    ],
    claims: [
      { id: 'sort-001', statement: 'Wafer test evaluates individual die before packaging and uses test content optimized for the wafer stage.', provenance: 'combines-sources', empirical: 'established', sourceIds: ['advantest-test-briefing', 'ase-test'] },
      { id: 'sort-002', statement: 'Wafer-level screening reduces the risk of assembling defective die but cannot replace package and system-level testing.', provenance: 'maha-inference', empirical: 'bounded-inference', sourceIds: ['advantest-test-briefing', 'amkor-test'], boundary: 'Coverage and economic tradeoffs depend on product architecture, test access, and package value.' },
    ],
    sourceIds: ['advantest-test-briefing', 'ase-test', 'amkor-test'], relatedArticleIds: ['concept-yield-learning-spc', 'process-wafer-thinning-dicing', 'process-final-burn-in-system-test'], intelligenceSlugs: ['known-good-die-storage-yield'],
  },
  {
    id: 'process-wafer-thinning-dicing', kind: 'process', slug: 'wafer-thinning-dicing-and-die-handling', title: 'Wafer Thinning, Dicing, and Die Handling', shortTitle: 'Thinning & dicing',
    description: 'How finished wafers are protected, back-ground, stress-relieved, singulated, inspected, picked, and transferred without damaging thin die.',
    definition: 'Wafer thinning and singulation reduce substrate thickness and separate a fabricated wafer into individual die while preserving device surfaces, edge strength, cleanliness, and coordinate identity.',
    domainIds: ['semiconductor-manufacturing'], stageIds: ['wafer-test', 'assembly-packaging'], status: 'FOUNDATIONAL', datePublished: sharedDate, dateModified: sharedDate,
    inputs: ['Tested wafer and wafer map', 'Protective tape or temporary carrier', 'Grinding, polishing, and dicing consumables', 'Target thickness and street plan'], outputs: ['Singulated die', 'Updated die map and inspection record', 'Die prepared for attach or stacking'],
    processSteps: ['Protect the device surface', 'Back-grind to near-final thickness', 'Apply stress relief where required', 'Mount on dicing tape', 'Singulate by blade, laser, or combined flow', 'Clean and inspect', 'Pick and transfer selected die'],
    criticalParameters: ['Final thickness and total-thickness variation', 'Warp', 'Grinding damage', 'Kerf and alignment', 'Chipping and cracking', 'Die strength', 'Tape adhesion', 'Map traceability'],
    failureModes: ['Wafer breakage', 'Subsurface damage', 'Edge chip or microcrack', 'Contamination', 'Die fly-off', 'Pick damage', 'Lost coordinate identity'],
    metrology: ['Thickness and warp measurement', 'Optical edge inspection', 'Die-strength sampling', 'Surface and backside inspection', 'Map reconciliation'], equipment: ['Back grinder', 'Stress-relief polisher or etcher', 'Blade or laser dicer', 'Tape mounter', 'Die sorter and pick-and-place system'], materials: ['Grinding wheel', 'Polishing media or slurry', 'Protective and dicing tape', 'Deionized water'],
    sections: [
      { heading: 'Thinning creates mechanical risk', paragraphs: ['Grinding is productive but leaves a damaged surface layer and saw marks. Stress-relief processes can remove damage and improve die strength, while temporary support and edge-control strategies reduce breakage and handling risk.'], claimIds: ['dice-001'] },
      { heading: 'Singulation method changes the defect signature', paragraphs: ['Blade, laser, stealth, and dicing-before-grinding flows create different thermal, mechanical, particulate, and edge-damage conditions. Method selection depends on wafer stack, die size, thickness, street width, throughput, and downstream reliability.'], claimIds: ['dice-002'] },
    ],
    claims: [
      { id: 'dice-001', statement: 'Back grinding thins semiconductor wafers, while polishing or other stress relief can remove grinding damage and improve die strength.', provenance: 'combines-sources', empirical: 'interested-party', sourceIds: ['disco-thinning-strength', 'disco-process'], boundary: 'DISCO supplies grinding and polishing equipment and is describing the benefit of its own process step.' },
      { id: 'dice-002', statement: 'Semiconductor die can be singulated by blade and laser-based methods, with chipping and microcracking among the controlled risks.', provenance: 'combines-sources', empirical: 'established', sourceIds: ['disco-process', 'disco-thinning-strength'] },
    ],
    sourceIds: ['disco-process', 'disco-thinning-strength'], relatedArticleIds: ['process-wafer-sort', 'process-wire-bond-flip-chip', 'process-advanced-packaging'], intelligenceSlugs: ['known-good-die-storage-yield'],
  },
  {
    id: 'process-package-substrates-rdl', kind: 'process', slug: 'package-substrates-and-redistribution-layers', title: 'Package Substrates and Redistribution Layers', shortTitle: 'Substrates & RDL',
    description: 'How organic substrates, interposers, and redistribution layers fan dense die connections into package-scale power, signal, and board interfaces.',
    definition: 'Package substrates and redistribution layers provide patterned conductors, dielectrics, vias, pads, and mechanical support that transform the die-level interconnect pitch and route signals and power through a package.',
    domainIds: ['semiconductor-manufacturing'], stageIds: ['assembly-packaging'], status: 'FOUNDATIONAL', datePublished: sharedDate, dateModified: sharedDate,
    inputs: ['Package electrical and mechanical design', 'Core or carrier', 'Conductive and dielectric materials', 'Known-good die and assembly rules'], outputs: ['Qualified substrate, interposer, or RDL structure', 'Electrical continuity and dimensional records'],
    processSteps: ['Build or prepare the carrier', 'Form dielectric and via layers', 'Pattern and plate redistribution metal', 'Create pads and surface finish', 'Inspect and electrically test', 'Attach die or singulate the structure'],
    criticalParameters: ['Line and space', 'Via alignment and fill', 'Copper thickness', 'Impedance', 'Warpage', 'Adhesion', 'Surface finish', 'Known-good-site yield'],
    failureModes: ['Open or short', 'Via void', 'Misregistration', 'Dielectric crack', 'Delamination', 'Warpage', 'Pad contamination', 'Substrate site loss'],
    metrology: ['Automated optical inspection', 'X-ray inspection', 'Continuity and impedance test', 'Warpage and coplanarity measurement', 'Cross-section'], equipment: ['Lamination and coating tools', 'Lithography and plating lines', 'Laser or mechanical via tools', 'Inspection and electrical-test systems'], materials: ['Copper', 'Build-up dielectric', 'Organic laminate or silicon interposer', 'Surface-finish metals', 'Solder mask'],
    sections: [
      { heading: 'The package is a geometric transformer', paragraphs: ['Fine die bumps cannot generally connect directly to a board-scale interface. RDL, interposers, and substrates redistribute that pitch while also carrying return paths, power delivery, mechanical loads, and heat.'], claimIds: ['rdl-001'] },
      { heading: 'Known-good sites protect expensive die', paragraphs: ['When die are attached to a prebuilt RDL or substrate, inspection and electrical test of that structure can prevent valuable die from being placed on known-defective sites. That changes the economic value of upstream substrate yield.'], claimIds: ['rdl-002'] },
    ],
    claims: [
      { id: 'rdl-001', statement: 'Advanced packages use redistribution and interconnect structures to integrate multiple components and connect them at package scale.', provenance: 'combines-sources', empirical: 'established', sourceIds: ['tsmc-3dfabric', 'amkor-rdl-pop'] },
      { id: 'rdl-002', statement: 'RDL structures can be inspected before die attach so costly die are placed only on known-good sites.', provenance: 'restates-source', empirical: 'established', sourceIds: ['amkor-rdl-pop'] },
    ],
    sourceIds: ['tsmc-3dfabric', 'amkor-rdl-pop'], relatedArticleIds: ['process-advanced-packaging', 'process-wire-bond-flip-chip', 'process-encapsulation-underfill-molding'], intelligenceSlugs: ['smartphone-ap-advanced-packaging', 'smartphone-package-substrate-manufacturers'],
  },
  {
    id: 'process-wire-bond-flip-chip', kind: 'process', slug: 'wire-bonding-and-flip-chip-interconnect', title: 'Wire Bonding and Flip-Chip Interconnect', shortTitle: 'Wire bond & flip chip',
    description: 'How die are attached and electrically connected by fine wires or area-array bumps, and why each architecture creates different process windows.',
    definition: 'Wire bonding connects die pads to a package with formed wire loops, while flip chip joins a face-down die through an array of bumps or pillars to a substrate, interposer, or redistribution layer.',
    domainIds: ['semiconductor-manufacturing'], stageIds: ['assembly-packaging'], status: 'FOUNDATIONAL', datePublished: sharedDate, dateModified: sharedDate,
    inputs: ['Qualified die and package surface', 'Die-attach material', 'Wire or bump interconnect', 'Bonding recipe and alignment data'], outputs: ['Mechanically attached and electrically connected die', 'Bond quality and traceability records'],
    processSteps: ['Prepare die and receiving surface', 'Attach or align die', 'Form wire bonds or place flip-chip joints', 'Reflow or thermocompression bond where required', 'Clean and inspect', 'Apply underfill when required'],
    criticalParameters: ['Bond force, energy, temperature, and time', 'Alignment', 'Wire-loop geometry', 'Bump height and coplanarity', 'Intermetallic formation', 'Joint resistance', 'Warpage'],
    failureModes: ['Nonstick or lifted bond', 'Wire sweep or short', 'Crater or pad damage', 'Bump open or bridge', 'Non-wet joint', 'Interfacial void', 'Fatigue'],
    metrology: ['Bond pull and shear test', 'Optical inspection', 'X-ray and acoustic imaging', 'Electrical continuity', 'Cross-section'], equipment: ['Die bonder', 'Wire bonder', 'Flip-chip aligner and bonder', 'Reflow oven', 'Plasma cleaner'], materials: ['Gold, copper, or silver wire', 'Copper pillars or solder bumps', 'Die-attach adhesive or solder', 'Flux'],
    sections: [
      { heading: 'Interconnect architecture sets the routing and thermal geometry', paragraphs: ['Wire bonds connect perimeter or accessible pads through free-standing loops. Flip chip uses an area array beneath the die, enabling shorter and denser connections but placing tighter demands on bump uniformity, alignment, warpage, cleaning, and underfill.'], claimIds: ['bond-001'] },
      { heading: 'Bond formation is an interface process', paragraphs: ['Electrical continuity alone does not establish long-term quality. The bond must have suitable intermetallic structure, mechanical strength, cleanliness, and stress behavior through assembly and use conditions.'], claimIds: ['bond-002'] },
    ],
    claims: [
      { id: 'bond-001', statement: 'Production die-stacking flows can combine die attach, wire bonding, and flip-chip assembly within the same package family.', provenance: 'restates-source', empirical: 'established', sourceIds: ['amkor-3d-stack'] },
      { id: 'bond-002', statement: 'The choice between wire bond, flip chip, or a mixed flow changes density, geometry, equipment, and reliability controls.', provenance: 'maha-inference', empirical: 'bounded-inference', sourceIds: ['amkor-3d-stack', 'amkor-rdl-pop'], boundary: 'The best architecture is product- and package-specific.' },
    ],
    sourceIds: ['amkor-3d-stack', 'amkor-rdl-pop'], relatedArticleIds: ['process-package-substrates-rdl', 'process-encapsulation-underfill-molding', 'process-advanced-packaging'], intelligenceSlugs: ['smartphone-ap-advanced-packaging'],
  },
  {
    id: 'process-encapsulation-underfill-molding', kind: 'process', slug: 'underfill-molding-and-package-encapsulation', title: 'Underfill, Molding, and Package Encapsulation', shortTitle: 'Underfill & encapsulation',
    description: 'How polymeric materials fill interconnect gaps, redistribute stress, protect die and wires, and become a permanent part of package reliability.',
    definition: 'Underfill and encapsulation place and cure polymeric material around die, joints, or wire structures to provide mechanical support and environmental protection while controlling thermal and mechanical stress.',
    domainIds: ['semiconductor-manufacturing'], stageIds: ['assembly-packaging'], status: 'FOUNDATIONAL', datePublished: sharedDate, dateModified: sharedDate,
    inputs: ['Interconnected package assembly', 'Qualified underfill or molding compound', 'Dispense, compression, or transfer-mold recipe', 'Cure profile'], outputs: ['Protected package body or filled die gap', 'Void, cure, warpage, and adhesion evidence'],
    processSteps: ['Clean and precondition assembly', 'Dispense or place polymer', 'Drive flow or mold fill', 'Cure under controlled conditions', 'Post-cure and singulate where required', 'Inspect and test'],
    criticalParameters: ['Viscosity and flow', 'Filler size and distribution', 'Void content', 'Cure degree', 'Adhesion', 'Glass-transition behavior', 'Moisture uptake', 'Warpage'],
    failureModes: ['Void', 'Delamination', 'Incomplete fill or cure', 'Wire sweep', 'Die crack', 'Warpage', 'Moisture-driven damage', 'Interfacial fatigue'],
    metrology: ['Acoustic microscopy', 'X-ray inspection', 'Cure and thermal analysis', 'Warpage measurement', 'Cross-section', 'Moisture and adhesion testing'], equipment: ['Underfill dispenser', 'Compression or transfer molding press', 'Cure oven', 'Plasma cleaner', 'Acoustic and X-ray inspection'], materials: ['Capillary or molded underfill', 'Epoxy molding compound', 'Silica filler', 'Adhesion promoters', 'Release films'],
    sections: [
      { heading: 'The polymer becomes structural', paragraphs: ['Underfill shares strain between die, interconnects, and substrate; molding protects the assembly and can establish its external form. Filler, cure, adhesion, moisture, and thermal expansion therefore affect package mechanics as well as manufacturability.'], claimIds: ['mold-001'] },
      { heading: 'Void-free appearance is not the only release criterion', paragraphs: ['A qualified encapsulation process also controls cure state, adhesion, contamination, warpage, stress, and reliability after moisture and temperature exposure. Material substitution requires package-level evidence.'], claimIds: ['mold-002'] },
    ],
    claims: [
      { id: 'mold-001', statement: 'Fan-out and flip-chip package flows can use underfill or molded-underfill material around die-to-RDL interconnects.', provenance: 'restates-source', empirical: 'established', sourceIds: ['amkor-rdl-pop'] },
      { id: 'mold-002', statement: 'Encapsulation material should be qualified as part of the complete package because its flow, cure, adhesion, and stress interact with die and interconnects.', provenance: 'maha-inference', empirical: 'bounded-inference', sourceIds: ['amkor-rdl-pop', 'tsmc-3dfabric'], boundary: 'Material limits depend on package geometry, assembly flow, and use conditions.' },
    ],
    sourceIds: ['amkor-rdl-pop', 'tsmc-3dfabric'], relatedArticleIds: ['process-wire-bond-flip-chip', 'process-package-substrates-rdl', 'concept-package-reliability-failure-analysis'], intelligenceSlugs: ['smartphone-ap-advanced-packaging'],
  },
  {
    id: 'process-final-burn-in-system-test', kind: 'process', slug: 'final-test-burn-in-and-system-level-test', title: 'Final Test, Burn-In, and System-Level Test', shortTitle: 'Final test & burn-in',
    description: 'How packaged devices are screened, characterized, binned, stressed, and exercised in increasingly system-like conditions before shipment.',
    definition: 'Final test measures packaged-device performance and functionality; burn-in applies controlled stress to screen susceptible units; system-level test exercises the device in a representative operating environment.',
    domainIds: ['semiconductor-manufacturing'], stageIds: ['final-test-reliability'], status: 'FOUNDATIONAL', datePublished: sharedDate, dateModified: sharedDate,
    inputs: ['Assembled package', 'Test program and limits', 'Socket, load board, and handler', 'Thermal and stress profile'], outputs: ['Pass/fail and performance bins', 'Screening and traceability record', 'Shipment disposition and yield feedback'],
    processSteps: ['Inspect and establish continuity', 'Run functional and structural patterns', 'Measure parametric and performance limits', 'Test across required temperature', 'Apply burn-in where justified', 'Run system-level scenarios where required', 'Bin and release'],
    criticalParameters: ['Coverage', 'Test time', 'Contact quality', 'Temperature control', 'Power delivery', 'Guardbands', 'Burn-in stress', 'Retest and binning policy'],
    failureModes: ['Test escape', 'False reject', 'Socket or handler damage', 'Thermal mismatch', 'Inadequate stress screen', 'Program revision error', 'Traceability loss'],
    metrology: ['Structural and functional test', 'Parametric measurement', 'High-speed interface test', 'Burn-in monitoring', 'System-level workload test'], equipment: ['Automatic test equipment', 'Handler and thermal system', 'Load board and socket', 'Burn-in oven and board', 'System-level test rack'], materials: ['Sockets and contactors', 'Interface boards', 'Test programs', 'Thermal interface consumables'],
    sections: [
      { heading: 'Test content changes across the lifecycle', paragraphs: ['Wafer test, final test, burn-in, and system-level test observe different failure modes under different interfaces and conditions. Repeating a pattern at two stages can still be useful when packaging or temperature changes the observable behavior.'], claimIds: ['final-001'] },
      { heading: 'Screening is an economic allocation problem', paragraphs: ['More coverage, temperature points, and stress can reduce escape risk but add equipment time and may consume device life. Test flows allocate content to the stage where it produces the strongest risk reduction per unit of cost and time.'], claimIds: ['final-002'] },
    ],
    claims: [
      { id: 'final-001', statement: 'Semiconductor test flows can include wafer test, final package test, burn-in, and system-level test, with content optimized by stage and application.', provenance: 'combines-sources', empirical: 'established', sourceIds: ['advantest-test-briefing', 'ase-test', 'amkor-test'] },
      { id: 'final-002', statement: 'Test coverage and screening intensity are balanced against test time, equipment capacity, product risk, and the value of avoiding field escapes.', provenance: 'maha-inference', empirical: 'bounded-inference', sourceIds: ['advantest-test-briefing', 'amkor-test'], boundary: 'The optimum is specific to product quality goals, architecture, and economics.' },
    ],
    sourceIds: ['advantest-test-briefing', 'ase-test', 'amkor-test'], relatedArticleIds: ['process-wafer-sort', 'concept-package-reliability-failure-analysis', 'process-advanced-packaging'], intelligenceSlugs: ['known-good-die-storage-yield'],
  },
  {
    id: 'concept-package-reliability-failure-analysis', kind: 'concept', slug: 'semiconductor-qualification-reliability-and-failure-analysis', title: 'Semiconductor Qualification, Reliability, and Failure Analysis', shortTitle: 'Reliability & failure analysis',
    description: 'How products are stressed, monitored, statistically interpreted, dissected, and improved before release and after field failures.',
    definition: 'Qualification demonstrates that a defined product and process can meet specified use and stress requirements, while reliability monitoring and failure analysis identify degradation mechanisms and feed corrective action back into design and manufacturing.',
    domainIds: ['semiconductor-manufacturing'], stageIds: ['final-test-reliability'], status: 'FOUNDATIONAL', datePublished: sharedDate, dateModified: sharedDate,
    inputs: ['Qualified product definition', 'Process and material baseline', 'Use-condition mission profile', 'Stress plan and failure criteria', 'Returned or stressed samples'], outputs: ['Qualification decision', 'Reliability model and monitoring plan', 'Root-cause report', 'Corrective and preventive action'],
    processSteps: ['Define mission profile and failure criteria', 'Select accelerating stresses and sample plan', 'Stress and periodically measure devices', 'Analyze distributions and failures', 'Localize and expose the defect', 'Identify physical mechanism', 'Correct and verify'],
    criticalParameters: ['Stress relevance', 'Sample size', 'Acceleration assumptions', 'Censoring and statistics', 'Failure definition', 'Lot and site coverage', 'Root-cause confidence'],
    failureModes: ['Irrelevant acceleration', 'Insufficient sample', 'Mixed failure populations', 'Destructive-analysis artifact', 'Symptom mistaken for cause', 'Corrective action not verified'],
    metrology: ['Electrical characterization', 'Temperature cycling and humidity stress', 'Mechanical and board-level stress', 'X-ray and acoustic imaging', 'Emission and fault localization', 'Cross-section and microscopy'], equipment: ['Environmental stress chambers', 'Reliability test racks', 'X-ray and acoustic microscopes', 'Electrical and optical fault-localization tools', 'Focused-ion-beam and microscopy systems'], materials: ['Qualification samples', 'Reference lots', 'Mounting and sectioning media', 'Traceability and field-return records'],
    sections: [
      { heading: 'Qualification is bounded evidence', paragraphs: ['A qualification result supports a named design, process, material set, site scope, and stress plan. It does not automatically transfer across unreviewed changes, which is why change control and ongoing reliability monitoring matter after initial release.'], claimIds: ['rel-001'] },
      { heading: 'Failure analysis moves from symptom to mechanism', paragraphs: ['The sequence normally narrows from electrical signature and package-level localization to progressively more invasive inspection. Preserving evidence and comparing good and failed units helps prevent an artifact from being mistaken for root cause.'], claimIds: ['rel-002'] },
    ],
    claims: [
      { id: 'rel-001', statement: 'Semiconductor quality systems combine qualification, production monitoring, reliability assessment, and continuous improvement across the product lifecycle.', provenance: 'combines-sources', empirical: 'established', sourceIds: ['tsmc-quality', 'jedec-home'] },
      { id: 'rel-002', statement: 'Failure-analysis conclusions should distinguish observed symptoms, localized physical evidence, inferred mechanisms, and verified corrective action.', provenance: 'restates-source', empirical: 'method-basis', sourceIds: ['tsmc-quality'], boundary: 'Specific analytical sequences depend on the package, device, and failure signature.' },
    ],
    sourceIds: ['tsmc-quality', 'jedec-home'], relatedArticleIds: ['process-final-burn-in-system-test', 'process-encapsulation-underfill-molding', 'process-advanced-packaging'], intelligenceSlugs: ['known-good-die-storage-yield', 'smartphone-ap-advanced-packaging'],
  },
]

const SOURCE_MAP = new Map(KNOWLEDGE_SOURCES.map((source) => [source.id, source]))
const ARTICLE_MAP = new Map(KNOWLEDGE_ARTICLES.map((article) => [article.id, article]))

export function knowledgeArticlePath(article: KnowledgeArticle): string {
  return `/knowledge/${KNOWLEDGE_KIND_META[article.kind].route}/${article.slug}`
}

export function getKnowledgeArticle(id: string): KnowledgeArticle | undefined {
  return ARTICLE_MAP.get(id)
}

export function getKnowledgeSource(id: string): KnowledgeSource | undefined {
  return SOURCE_MAP.get(id)
}

export function getKnowledgeByRoute(kind: string, slug: string): KnowledgeArticle | undefined {
  const expectedKind = (Object.entries(KNOWLEDGE_KIND_META) as [KnowledgeKind, typeof KNOWLEDGE_KIND_META[KnowledgeKind]][])
    .find(([, meta]) => meta.route === kind)?.[0]
  return expectedKind ? KNOWLEDGE_ARTICLES.find((article) => article.kind === expectedKind && article.slug === slug) : undefined
}

export function getKnowledgeRouteParams(): { kind: KnowledgeRouteKind; slug: string }[] {
  return KNOWLEDGE_ARTICLES.map((article) => ({ kind: KNOWLEDGE_KIND_META[article.kind].route, slug: article.slug }))
}

export function getKnowledgeForIntelligenceBrief(slug: string): KnowledgeArticle[] {
  return KNOWLEDGE_ARTICLES.filter((article) => article.intelligenceSlugs.includes(slug))
}

export function assertKnowledgeIntegrity(): void {
  const sourceIds = new Set<string>()
  for (const source of KNOWLEDGE_SOURCES) {
    if (sourceIds.has(source.id)) throw new Error(`Duplicate knowledge source id: ${source.id}`)
    sourceIds.add(source.id)
  }

  const articleIds = new Set<string>()
  const paths = new Set<string>()
  for (const article of KNOWLEDGE_ARTICLES) {
    if (articleIds.has(article.id)) throw new Error(`Duplicate knowledge article id: ${article.id}`)
    articleIds.add(article.id)
    const path = knowledgeArticlePath(article)
    if (paths.has(path)) throw new Error(`Duplicate knowledge route: ${path}`)
    paths.add(path)
  }

  for (const article of KNOWLEDGE_ARTICLES) {
    const claimIds = new Set<string>()
    for (const sourceId of article.sourceIds) if (!sourceIds.has(sourceId)) throw new Error(`${article.id} references missing source ${sourceId}`)
    for (const relatedId of article.relatedArticleIds) if (!articleIds.has(relatedId)) throw new Error(`${article.id} references missing article ${relatedId}`)
    for (const claim of article.claims) {
      if (claimIds.has(claim.id)) throw new Error(`Duplicate claim ${claim.id} in ${article.id}`)
      claimIds.add(claim.id)
      assertClaimEvidence(claim, claim.id)
      if (requiresBoundary(claim) && !claim.boundary) throw new Error(`${claim.id} needs a boundary: ${claim.provenance} / ${claim.empirical} is not readable without one`)
      for (const sourceId of claim.sourceIds) if (!sourceIds.has(sourceId)) throw new Error(`${claim.id} references missing source ${sourceId}`)
    }
    for (const section of article.sections) for (const claimId of section.claimIds ?? []) if (!claimIds.has(claimId)) throw new Error(`${article.id} section references missing claim ${claimId}`)
  }
}

assertKnowledgeIntegrity()
