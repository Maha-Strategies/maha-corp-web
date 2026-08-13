import { SITE_URL } from './briefs-data.ts'

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

export type KnowledgeEvidenceStatus =
  | 'source-supported'
  | 'method-basis'
  | 'bounded-inference'
  | 'open-question'

export interface KnowledgeSource {
  id: string
  title: string
  publisher: string
  url: string
  year?: number
  sourceType: 'official-technical' | 'official-overview' | 'research-paper' | 'standard'
  accessed: string
}

export interface KnowledgeClaim {
  id: string
  statement: string
  status: KnowledgeEvidenceStatus
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
      { id: 'sm-001', statement: 'Integrated circuits are manufactured through repeated layer-by-layer patterning and material-processing steps on a wafer.', status: 'source-supported', sourceIds: ['asml-chip-making', 'intel-semiconductor-101'] },
      { id: 'sm-002', statement: 'Lithography transfers reticle patterns into photosensitive material, after which development and etch convert that image into physical wafer structures.', status: 'source-supported', sourceIds: ['asml-chip-making', 'asml-lithography'] },
      { id: 'sm-003', statement: 'Advanced packaging combines multiple die and interconnect technologies to optimize system-level performance, power, form factor, and cost.', status: 'source-supported', sourceIds: ['tsmc-3dfabric'] },
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
      { id: 'litho-001', statement: 'A lithography scanner projects a reticle pattern through optics onto photosensitive material on a wafer.', status: 'source-supported', sourceIds: ['asml-lithography'] },
      { id: 'litho-002', statement: 'After exposure, baking and development remove selected resist regions to create openings for later process steps.', status: 'source-supported', sourceIds: ['asml-chip-making'] },
      { id: 'litho-003', statement: 'The Rayleigh relationship links printable critical dimension to wavelength, numerical aperture, and a process-dependent factor.', status: 'method-basis', sourceIds: ['asml-rayleigh'], boundary: 'The relationship is a resolution framework, not a complete predictor of production yield or pattern fidelity.' },
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
      { id: 'dep-001', statement: 'PVD, CVD, and ALD use distinct physical and chemical mechanisms to deposit semiconductor films.', status: 'source-supported', sourceIds: ['applied-deposition'] },
      { id: 'dep-002', statement: 'Deposited semiconductor materials include conductors, insulators, barriers, and other functional compounds.', status: 'source-supported', sourceIds: ['applied-deposition'] },
      { id: 'dep-003', statement: 'ALD uses sequential self-limiting surface reactions to achieve atomic-scale thickness control and conformal coverage.', status: 'source-supported', sourceIds: ['applied-ald'] },
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
      { id: 'etch-001', statement: 'Wet etching uses liquid chemistry and is commonly isotropic, while dry etching uses gases under vacuum and can provide directional profile control.', status: 'source-supported', sourceIds: ['lam-etch'] },
      { id: 'etch-002', statement: 'Plasma etching combines chemical reactions with ion-assisted physical effects.', status: 'source-supported', sourceIds: ['lam-etch'] },
      { id: 'etch-003', statement: 'Advanced etch processes are controlled by profile, selectivity, critical dimension, damage, and by-product removal—not etch rate alone.', status: 'bounded-inference', sourceIds: ['lam-etch'], boundary: 'The relative importance and acceptable window are specific to the target film stack and device structure.' },
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
      { id: 'implant-001', statement: 'Ion implantation is a semiconductor doping process, with distinct equipment classes serving different energy and dose regimes.', status: 'source-supported', sourceIds: ['applied-implant'] },
      { id: 'implant-002', statement: 'A useful implant process must be evaluated together with its activation and thermal budget.', status: 'bounded-inference', sourceIds: ['applied-implant'], boundary: 'The source establishes implantation roles; the precise anneal sequence and activation target depend on the device integration flow.' },
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
      { id: 'cu-001', statement: 'Metal deposition technologies form contacts and interconnects, with barriers, liners, and conductive films serving distinct electrical and reliability roles.', status: 'source-supported', sourceIds: ['applied-deposition'] },
      { id: 'cu-002', statement: 'CMP removes excess material and restores wafer planarity for subsequent patterning and film formation.', status: 'source-supported', sourceIds: ['applied-cmp'] },
      { id: 'cu-003', statement: 'PEG–PPG copolymers can function as copper-electrodeposition suppressors, and their degradation can change bath and deposited-film behavior.', status: 'source-supported', sourceIds: ['ppg-copper-study'] },
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
      { id: 'pkg-001', statement: 'TSMC groups SoIC, CoWoS, and InFO as complementary silicon-stacking and advanced-packaging technologies for heterogeneous integration.', status: 'source-supported', sourceIds: ['tsmc-3dfabric'] },
      { id: 'pkg-002', statement: 'Advanced packaging strategy requires connected design, assembly, test, and materials decisions because package interfaces jointly determine system behavior and yield exposure.', status: 'bounded-inference', sourceIds: ['tsmc-3dfabric', 'tsmc-cowos'], boundary: 'The exact test insertion points and commercial risk allocation are product- and supplier-specific.' },
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
      { id: 'dts-001', statement: 'TSMC has publicly demonstrated direct silicon water-cooling structures for high-power 3D-IC applications.', status: 'source-supported', sourceIds: ['tsmc-direct-cooling'] },
      { id: 'dts-002', statement: 'Fleet adoption should be gated by package manufacturability, leak reliability, coolant-loop compatibility, monitoring, and serviceability in addition to thermal performance.', status: 'bounded-inference', sourceIds: ['tsmc-direct-cooling'], boundary: 'Public demonstrations establish feasibility, not a universal production architecture or adoption forecast.' },
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
      { id: 'ppg-001', statement: 'PPG polymers, EO/PO block copolymers, propylene-glycol ethers, and functional polyethers are distinct material families despite related propylene-oxide chemistry.', status: 'method-basis', sourceIds: ['dow-elecpure', 'ppg-copper-study'] },
      { id: 'ppg-002', statement: 'PEG–PPG copolymers have been studied as suppressors in copper electrodeposition.', status: 'source-supported', sourceIds: ['ppg-copper-study'] },
      { id: 'ppg-003', statement: 'Dow markets an electronic-grade propylene-glycol ether for semiconductor photoresist, thinner, and edge-bead-removal uses.', status: 'source-supported', sourceIds: ['dow-elecpure'], boundary: 'A supplier product page does not establish qualification at a named fab or in a named product.' },
    ],
    sourceIds: ['dow-elecpure', 'ppg-copper-study'], relatedArticleIds: ['process-photolithography', 'process-copper-interconnect-cmp', 'process-advanced-packaging'], intelligenceSlugs: ['ppg-derivatives-semiconductor-applications'],
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
      for (const sourceId of claim.sourceIds) if (!sourceIds.has(sourceId)) throw new Error(`${claim.id} references missing source ${sourceId}`)
    }
    for (const section of article.sections) for (const claimId of section.claimIds ?? []) if (!claimIds.has(claimId)) throw new Error(`${article.id} section references missing claim ${claimId}`)
  }
}

assertKnowledgeIntegrity()
