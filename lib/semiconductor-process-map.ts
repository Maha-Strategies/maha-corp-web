import type { SemiconductorStageId } from './knowledge-data.ts'

export type ProcessMapCategory =
  | 'design'
  | 'mask'
  | 'substrate'
  | 'pattern'
  | 'film'
  | 'modify'
  | 'interconnect'
  | 'test'
  | 'assembly'
  | 'quality'

export interface SemiconductorMapStep {
  id: string
  label: string
  description: string
  category: ProcessMapCategory
  articleId?: string
  repeat?: boolean
}

export interface SemiconductorMapPhase {
  id: string
  order: number
  label: string
  objective: string
  stageIds: SemiconductorStageId[]
  inputs: string[]
  outputs: string[]
  steps: SemiconductorMapStep[]
  releaseGate: string
  sourceIds: string[]
  feedbackTo?: string[]
}

export interface CrossCuttingControl {
  label: string
  description: string
  appliesTo: string
}

export const SEMICONDUCTOR_PROCESS_MAP_PATH = '/knowledge/maps/semiconductor-manufacturing-process-map'
export const SEMICONDUCTOR_PROCESS_MAP_DATE = '2026-08-13'

export const SEMICONDUCTOR_PROCESS_PHASES: SemiconductorMapPhase[] = [
  {
    id: 'product-definition', order: 1, label: 'Product definition & architecture',
    objective: 'Translate a market or system requirement into a feasible silicon, package, software, cost, and test architecture.',
    stageIds: ['design'],
    inputs: ['Workloads and use cases', 'Power, performance, area, cost, schedule, safety, and security requirements', 'Process-node and supply options'],
    outputs: ['Product requirements', 'System and chip architecture', 'Make/buy/IP plan', 'Initial package, test, and manufacturing assumptions'],
    steps: [
      { id: 'requirements', label: 'Requirements capture', description: 'Define functions, interfaces, operating conditions, lifetime, regulatory obligations, and economic targets.', category: 'design', articleId: 'process-ic-design-tapeout' },
      { id: 'workload-modeling', label: 'Workload modeling', description: 'Model representative software, data movement, latency, throughput, memory, and power behavior.', category: 'design' },
      { id: 'architecture-exploration', label: 'Architecture exploration', description: 'Compare compute, memory, interconnect, accelerator, analog, RF, and chiplet partitions.', category: 'design' },
      { id: 'technology-selection', label: 'Technology selection', description: 'Select process nodes, device options, memories, IP, package class, and thermal approach.', category: 'design' },
      { id: 'ppa-cost-model', label: 'PPA, yield & cost model', description: 'Establish power-performance-area budgets and connect die size, expected yield, package, and test cost.', category: 'design' },
      { id: 'verification-test-plan', label: 'Verification & test strategy', description: 'Define pre-silicon verification, DFT, manufacturing test, qualification, and observability before implementation.', category: 'test' },
    ],
    releaseGate: 'Architecture review confirms feasible requirements, interfaces, budgets, technology availability, and verification coverage.',
    sourceIds: ['synopsys-chip-design'], feedbackTo: ['product-definition'],
  },
  {
    id: 'design-implementation', order: 2, label: 'Circuit design, verification & tape-out',
    objective: 'Convert the architecture into a verified, physically manufacturable layout and production test content.',
    stageIds: ['design'],
    inputs: ['Approved architecture', 'Process design kit', 'Standard cells, memories, analog/RF blocks, and licensed IP', 'Package and test constraints'],
    outputs: ['Signed-off layout database', 'Manufacturing test patterns', 'Mask data', 'Bring-up and characterization plan'],
    steps: [
      { id: 'microarchitecture', label: 'Microarchitecture', description: 'Define pipelines, state machines, data paths, clocking, power domains, memories, and interfaces.', category: 'design' },
      { id: 'rtl-custom-design', label: 'RTL & custom circuit design', description: 'Implement digital logic and design custom analog, RF, memory, I/O, and physical IP.', category: 'design', articleId: 'process-rtl-to-physical-design' },
      { id: 'functional-verification', label: 'Functional verification', description: 'Use simulation, formal methods, emulation, prototypes, coverage, and hardware/software co-verification.', category: 'design', articleId: 'process-rtl-to-physical-design', repeat: true },
      { id: 'dft-atpg', label: 'DFT & ATPG', description: 'Insert scan, memory self-test, boundary test, debug, and other structures; generate production patterns.', category: 'test' },
      { id: 'logic-synthesis', label: 'Logic synthesis', description: 'Map RTL into technology cells under timing, power, area, test, and physical constraints.', category: 'design', articleId: 'process-rtl-to-physical-design' },
      { id: 'floorplan-power', label: 'Floorplan & power network', description: 'Place major blocks, I/O, macros, clock and power structures, and package connection assumptions.', category: 'design' },
      { id: 'place-route', label: 'Place, clock & route', description: 'Place cells, build clock networks, route signals, and optimize congestion, timing, power, and integrity.', category: 'design', articleId: 'process-rtl-to-physical-design', repeat: true },
      { id: 'extraction-signoff', label: 'Extraction & signoff analysis', description: 'Close timing, power, IR drop, electromigration, signal integrity, thermal, and variation requirements.', category: 'quality', articleId: 'process-rtl-to-physical-design', repeat: true },
      { id: 'physical-verification', label: 'Physical verification', description: 'Run design-rule, layout-versus-schematic, electrical-rule, density, antenna, and manufacturability checks.', category: 'quality', articleId: 'process-ic-design-tapeout', repeat: true },
      { id: 'tapeout', label: 'Tape-out', description: 'Freeze the released layout, checksums, revisions, test content, and manufacturing handoff package.', category: 'design', articleId: 'process-ic-design-tapeout' },
    ],
    releaseGate: 'All signoff views, physical checks, IP revisions, waivers, test coverage, and tape-out configuration are approved.',
    sourceIds: ['synopsys-chip-design'], feedbackTo: ['product-definition', 'design-implementation'],
  },
  {
    id: 'mask-data', order: 3, label: 'Mask data preparation & reticle fabrication',
    objective: 'Turn signed-off layout polygons into inspected reticles that can print each process layer.',
    stageIds: ['design'],
    inputs: ['Released layout database', 'Layer map and process bias rules', 'Scanner and illumination assumptions'],
    outputs: ['Qualified reticle set', 'Inspection and repair records', 'Pellicle and mask logistics record'],
    steps: [
      { id: 'data-prep', label: 'Mask data preparation', description: 'Fracture layout, apply process bias, dummy features, optical/proximity corrections, and computational patterning.', category: 'mask', articleId: 'process-mask-data-reticle-fabrication' },
      { id: 'mask-write', label: 'Mask writing', description: 'Expose the reticle blank with an electron-beam writer and tightly controlled data path.', category: 'mask', articleId: 'process-mask-data-reticle-fabrication' },
      { id: 'mask-process', label: 'Develop, etch & clean', description: 'Develop the mask resist, transfer the pattern into absorber material, strip, and clean.', category: 'mask' },
      { id: 'mask-metrology', label: 'CD & registration metrology', description: 'Measure feature size, placement, uniformity, and pattern fidelity.', category: 'quality' },
      { id: 'mask-inspection', label: 'Inspection & repair', description: 'Find printable defects, repair where allowed, and reinspect repaired regions.', category: 'quality', articleId: 'process-mask-data-reticle-fabrication', repeat: true },
      { id: 'pellicle-release', label: 'Pellicle, qualification & release', description: 'Protect the patterned surface where applicable and release the reticle into controlled fab logistics.', category: 'mask' },
    ],
    releaseGate: 'Reticle critical dimensions, registration, defect disposition, revision identity, and scanner compatibility are accepted.',
    sourceIds: ['asml-chip-making', 'asml-lithography'], feedbackTo: ['design-implementation', 'mask-data'],
  },
  {
    id: 'wafer-preparation', order: 4, label: 'Starting wafer manufacture & incoming qualification',
    objective: 'Produce a clean, flat, crystallographically controlled substrate suitable for device fabrication.',
    stageIds: ['wafer-preparation'],
    inputs: ['Electronic-grade silicon or compound-semiconductor feedstock', 'Dopant specification', 'Crystal and wafer geometry specification'],
    outputs: ['Qualified bare or epitaxial wafers', 'Crystal, surface, contamination, and geometry records'],
    steps: [
      { id: 'polysilicon-purification', label: 'Feedstock purification', description: 'Produce electronic-grade semiconductor feedstock with controlled impurities.', category: 'substrate' },
      { id: 'crystal-growth', label: 'Single-crystal growth', description: 'Grow an oriented ingot while controlling dopant, resistivity, oxygen, defects, and diameter.', category: 'substrate', articleId: 'process-silicon-wafer-preparation' },
      { id: 'ingot-conditioning', label: 'Ingot conditioning', description: 'Crop, grind, orient, and mark the crystal before wafering.', category: 'substrate' },
      { id: 'wafer-slicing', label: 'Wafer slicing', description: 'Slice the ingot into wafers with controlled thickness and kerf damage.', category: 'substrate', articleId: 'process-silicon-wafer-preparation' },
      { id: 'edge-lap-etch', label: 'Edge, lap & damage removal', description: 'Shape edges, flatten surfaces, and remove mechanically damaged material.', category: 'substrate' },
      { id: 'wafer-polish', label: 'Chemical-mechanical polish', description: 'Create the low-roughness, high-flatness device surface.', category: 'substrate', articleId: 'process-silicon-wafer-preparation' },
      { id: 'wafer-clean', label: 'Final clean', description: 'Remove particles, metals, organics, and native residues to the incoming specification.', category: 'substrate', articleId: 'process-wafer-cleaning-surface-preparation' },
      { id: 'epi-option', label: 'Epitaxy or engineered substrate', description: 'Optionally grow a controlled epitaxial layer or create SOI and other engineered starting structures.', category: 'film', articleId: 'process-thin-film-deposition' },
      { id: 'incoming-wafer', label: 'Incoming qualification', description: 'Verify flatness, thickness, resistivity, crystal defects, surface condition, particles, and traceability.', category: 'quality' },
    ],
    releaseGate: 'Starting wafer meets geometry, crystal, electrical, surface, defect, contamination, and traceability specifications.',
    sourceIds: ['samsung-wafer'], feedbackTo: ['wafer-preparation'],
  },
  {
    id: 'feol', order: 5, label: 'FEOL — transistor formation',
    objective: 'Create electrically isolated, controlled transistor structures in and on the wafer substrate.',
    stageIds: ['feol'],
    inputs: ['Qualified starting wafer', 'Reticles', 'Process gases, precursors, resists, wet chemicals, dopants, and films'],
    outputs: ['Wafer with completed active devices', 'Inline physical and electrical process-control data'],
    steps: [
      { id: 'initial-clean', label: 'Surface clean & preparation', description: 'Condition the wafer surface and remove contamination before each sensitive module.', category: 'modify', articleId: 'process-wafer-cleaning-surface-preparation', repeat: true },
      { id: 'well-formation', label: 'Wells & channel engineering', description: 'Pattern and introduce dopants that establish body regions, thresholds, isolation, and punch-through control.', category: 'modify', articleId: 'process-ion-implantation-annealing' },
      { id: 'isolation', label: 'Device isolation', description: 'Pattern, etch, fill, and planarize isolation structures between active regions.', category: 'pattern', articleId: 'process-plasma-etch' },
      { id: 'channel-materials', label: 'Channel and epitaxial structures', description: 'Grow or deposit channel, stressor, sacrificial, or selective epitaxial materials where required.', category: 'film', articleId: 'process-thin-film-deposition' },
      { id: 'gate-stack', label: 'Gate dielectric & electrode stack', description: 'Form interfacial layers, high-k dielectric, work-function metals, and gate conductors.', category: 'film', articleId: 'process-thin-film-deposition' },
      { id: 'gate-patterning', label: 'Gate patterning', description: 'Print and transfer the gate or replacement-gate geometry with critical profile control.', category: 'pattern', articleId: 'process-photolithography' },
      { id: 'spacers', label: 'Spacer formation', description: 'Deposit and anisotropically etch sidewall spacers that control later implants and source/drain geometry.', category: 'pattern', articleId: 'process-plasma-etch' },
      { id: 'source-drain', label: 'Source/drain formation', description: 'Introduce extensions and deep junctions or grow raised source/drain structures.', category: 'modify', articleId: 'process-ion-implantation-annealing' },
      { id: 'activation-anneal', label: 'Activation & thermal processing', description: 'Repair lattice damage, activate dopants, form interfaces, and manage diffusion within the thermal budget.', category: 'modify', articleId: 'process-thermal-oxidation-diffusion' },
      { id: 'silicide', label: 'Contact resistance reduction', description: 'Form low-resistance semiconductor/metal compounds on exposed contact regions where the integration uses them.', category: 'film' },
      { id: 'feol-control', label: 'Inline metrology & electrical monitors', description: 'Measure CDs, overlay, profiles, films, defects, sheet resistance, and device test structures after critical modules.', category: 'quality', articleId: 'concept-metrology-defect-inspection', repeat: true },
    ],
    releaseGate: 'Transistor geometry, electrical parameters, defectivity, reliability monitors, and excursion dispositions meet the device-module specification.',
    sourceIds: ['asml-chip-making', 'asml-lithography', 'applied-deposition', 'applied-ald', 'lam-etch', 'applied-implant'], feedbackTo: ['mask-data', 'feol'],
  },
  {
    id: 'meol', order: 6, label: 'MEOL — contacts & local interconnect',
    objective: 'Connect transistor terminals to a dense, low-resistance local wiring system.',
    stageIds: ['meol'],
    inputs: ['Completed transistor wafer', 'Contact masks', 'Dielectrics, liners, barriers, and conductive fill materials'],
    outputs: ['Completed contacts and local interconnect', 'Contact-resistance, profile, defect, and continuity data'],
    steps: [
      { id: 'ild0', label: 'Contact dielectric deposition', description: 'Deposit and cure the dielectric that isolates devices from local wiring.', category: 'film', articleId: 'process-thin-film-deposition' },
      { id: 'contact-litho', label: 'Contact lithography', description: 'Define contact openings to gates and source/drain regions.', category: 'pattern', articleId: 'process-photolithography' },
      { id: 'contact-etch', label: 'Contact etch & clean', description: 'Etch high-aspect-ratio openings, stop at the target interface, and remove residues without excess damage.', category: 'pattern', articleId: 'process-plasma-etch' },
      { id: 'contact-liner', label: 'Interface, liner & barrier', description: 'Prepare exposed surfaces and deposit adhesion, diffusion-control, or nucleation layers.', category: 'film', articleId: 'process-thin-film-deposition' },
      { id: 'contact-fill', label: 'Contact fill', description: 'Fill contacts with tungsten, cobalt, ruthenium, or another integration-specific conductor.', category: 'interconnect' },
      { id: 'contact-cmp', label: 'Planarization & clean', description: 'Remove overburden, restore planarity, and clean particles and residues.', category: 'interconnect', articleId: 'process-copper-interconnect-cmp' },
      { id: 'local-interconnect', label: 'Local interconnect formation', description: 'Pattern and form the first dense connections between devices and the global metal stack.', category: 'interconnect' },
      { id: 'meol-control', label: 'Contact metrology & electrical control', description: 'Monitor contact dimensions, voids, resistance distributions, opens, shorts, and contamination.', category: 'quality', repeat: true },
    ],
    releaseGate: 'Contact resistance, continuity, defectivity, topography, and reliability structures meet release limits.',
    sourceIds: ['applied-deposition', 'lam-etch', 'applied-cmp'], feedbackTo: ['feol', 'meol'],
  },
  {
    id: 'beol', order: 7, label: 'BEOL — multilayer interconnect',
    objective: 'Build the repeated dielectric, via, and metal hierarchy that connects devices into a working circuit.',
    stageIds: ['beol'],
    inputs: ['Contacted wafer', 'Interconnect reticles', 'Low-k dielectrics, hard masks, liners, barriers, metals, plating chemistry, and CMP consumables'],
    outputs: ['Completed multilayer wiring stack', 'Top-level pads or bond structures', 'Interconnect electrical and defect data'],
    steps: [
      { id: 'low-k-deposition', label: 'Interlayer dielectric', description: 'Deposit, cure, and condition the dielectric for the next wiring level.', category: 'film', articleId: 'process-thin-film-deposition', repeat: true },
      { id: 'hardmask-stack', label: 'Hard-mask stack', description: 'Build cap, stop, hard-mask, antireflective, and patterning layers as required.', category: 'film', articleId: 'process-thin-film-deposition', repeat: true },
      { id: 'via-trench-litho', label: 'Via/trench lithography', description: 'Print single- or multi-patterned openings for vias and lines.', category: 'pattern', articleId: 'process-photolithography', repeat: true },
      { id: 'via-trench-etch', label: 'Via/trench etch', description: 'Transfer line and via geometry through dielectric stacks with profile and stop-layer control.', category: 'pattern', articleId: 'process-plasma-etch', repeat: true },
      { id: 'post-etch-clean', label: 'Post-etch clean', description: 'Remove polymers, residues, and exposed-interface contamination before metallization.', category: 'modify', articleId: 'process-wafer-cleaning-surface-preparation', repeat: true },
      { id: 'barrier-liner-seed', label: 'Barrier, liner & seed', description: 'Prepare interfaces and deposit layers that enable fill, adhesion, nucleation, and diffusion control.', category: 'film', articleId: 'process-thin-film-deposition', repeat: true },
      { id: 'metal-fill', label: 'Metal fill', description: 'Fill patterned features using copper plating, CVD, PVD, ALD, reflow, or another node-specific scheme.', category: 'interconnect', articleId: 'process-copper-interconnect-cmp', repeat: true },
      { id: 'metal-anneal', label: 'Metal anneal', description: 'Stabilize grain structure, interfaces, stress, or electrical properties where required.', category: 'modify', repeat: true },
      { id: 'metal-cmp', label: 'CMP & post-CMP clean', description: 'Remove overburden, control dishing and erosion, restore planarity, and clean the surface.', category: 'interconnect', articleId: 'process-copper-interconnect-cmp', repeat: true },
      { id: 'interconnect-repeat', label: 'Repeat wiring levels', description: 'Repeat the dielectric-to-CMP module for local, intermediate, global, and thick top-metal levels.', category: 'interconnect', articleId: 'process-copper-interconnect-cmp', repeat: true },
      { id: 'passivation-pad', label: 'Passivation & pad opening', description: 'Protect the completed wafer and expose pads or prepare top-level redistribution and bump interfaces.', category: 'film' },
      { id: 'beol-control', label: 'Inline inspection & electrical control', description: 'Track overlay, profiles, film properties, defects, resistance, capacitance, opens, shorts, and reliability monitors.', category: 'quality', repeat: true },
    ],
    releaseGate: 'All metal levels meet resistance, capacitance, continuity, defect, electromigration, dielectric, planarity, and outgoing-wafer criteria.',
    sourceIds: ['applied-deposition', 'lam-etch', 'applied-cmp', 'ppg-copper-study'], feedbackTo: ['mask-data', 'meol', 'beol'],
  },
  {
    id: 'wafer-sort', order: 8, label: 'Wafer acceptance, probe & die preparation',
    objective: 'Measure wafer and die performance, preserve traceability, and prepare selected die for assembly.',
    stageIds: ['wafer-test'],
    inputs: ['Completed wafer', 'Test programs, probe cards, limits, and product configuration', 'Assembly route and wafer map requirements'],
    outputs: ['Wafer-acceptance disposition', 'Die-level bin map and known-good-die candidates', 'Thinned, bumped, diced, or framed die/wafer'],
    steps: [
      { id: 'wat', label: 'Wafer acceptance test', description: 'Measure process-control structures and electrical parameters that characterize the completed wafer process.', category: 'test', articleId: 'process-wafer-sort' },
      { id: 'wafer-inspection', label: 'Outgoing wafer inspection', description: 'Inspect edge, backside, surface, passivation, pads, and gross defects before or around probe.', category: 'quality' },
      { id: 'probe-program', label: 'Probe correlation & release', description: 'Correlate tester, probe card, temperature, limits, and reference material before production testing.', category: 'test' },
      { id: 'wafer-sort', label: 'Wafer probe / sort', description: 'Contact each die, execute structural and functional tests, assign bins, and preserve the wafer map.', category: 'test', articleId: 'process-wafer-sort' },
      { id: 'yield-analysis', label: 'Yield analysis & disposition', description: 'Separate systematic from random loss, contain excursions, and decide wafer, lot, or die disposition.', category: 'quality', articleId: 'concept-yield-learning-spc', repeat: true },
      { id: 'bumping-rdl-option', label: 'Bumping or wafer-level RDL', description: 'Optionally form redistribution and die/package interconnect structures before singulation.', category: 'assembly', articleId: 'process-package-substrates-rdl' },
      { id: 'backgrind', label: 'Backgrind & thinning', description: 'Thin the wafer to package requirements while controlling stress, damage, contamination, and handling.', category: 'assembly', articleId: 'process-wafer-thinning-dicing' },
      { id: 'dicing', label: 'Dicing or stealth singulation', description: 'Separate die, inspect them, and maintain identity between wafer coordinates and physical units.', category: 'assembly', articleId: 'process-wafer-thinning-dicing' },
    ],
    releaseGate: 'Accepted die meet bin, traceability, physical-integrity, contamination, thickness, and assembly-input requirements.',
    sourceIds: ['tsmc-quality', 'ase-test', 'amkor-test'], feedbackTo: ['design-implementation', 'feol', 'meol', 'beol', 'wafer-sort'],
  },
  {
    id: 'assembly-packaging', order: 9, label: 'Assembly & packaging',
    objective: 'Create reliable electrical, thermal, and mechanical connections between selected die and the external system.',
    stageIds: ['assembly-packaging'],
    inputs: ['Accepted die or wafers', 'Package substrate, leadframe, interposer, RDL, or carrier', 'Interconnect, encapsulation, and thermal materials'],
    outputs: ['Marked and traceable packaged devices', 'Assembly inspection and process-control data'],
    steps: [
      { id: 'incoming-kitting', label: 'Incoming inspection & kitting', description: 'Verify die maps, substrates, materials, revisions, moisture status, shelf life, and traceability.', category: 'quality' },
      { id: 'die-attach-bond', label: 'Die placement & bonding', description: 'Attach die by adhesive, solder, thermocompression, hybrid bond, or another architecture-specific method.', category: 'assembly', articleId: 'process-advanced-packaging' },
      { id: 'chiplet-memory', label: 'Companion die & memory integration', description: 'Place and connect chiplets, HBM, bridges, interposers, passives, or optical components where used.', category: 'assembly', articleId: 'process-advanced-packaging' },
      { id: 'wire-flip-hybrid', label: 'Electrical interconnect', description: 'Create wire bonds, flip-chip joints, microbumps, copper bonds, TSV/RDL paths, or leadframe connections.', category: 'assembly', articleId: 'process-wire-bond-flip-chip' },
      { id: 'underfill-mold', label: 'Underfill, mold & cure', description: 'Reinforce or encapsulate sensitive structures while controlling voids, stress, flow, and contamination.', category: 'assembly', articleId: 'process-encapsulation-underfill-molding' },
      { id: 'substrate-attach', label: 'Substrate or board-side termination', description: 'Attach balls, leads, columns, lands, or other external connections and finish exposed surfaces.', category: 'assembly' },
      { id: 'lid-tim-cooling', label: 'Lid, TIM & cooling interface', description: 'Build the heat path using lids, heat spreaders, TIMs, cold plates, or direct liquid structures.', category: 'assembly', articleId: 'concept-direct-to-silicon-cooling' },
      { id: 'package-singulation', label: 'Package singulation & finish', description: 'Separate molded strips or panels, mark units, clean, and prepare them for electrical test.', category: 'assembly' },
      { id: 'assembly-inspection', label: 'Assembly inspection', description: 'Use optical, X-ray, acoustic, coplanarity, warpage, and traceability checks at risk-appropriate insertions.', category: 'quality', repeat: true },
      { id: 'intermediate-test', label: 'Intermediate test', description: 'Test between value-adding assembly steps when the architecture and economics justify early screening.', category: 'test', repeat: true },
    ],
    releaseGate: 'Package passes workmanship, connectivity, warpage, delamination, void, thermal-interface, marking, and traceability criteria.',
    sourceIds: ['tsmc-3dfabric', 'tsmc-cowos', 'amkor-3d-stack', 'amkor-test'], feedbackTo: ['design-implementation', 'wafer-sort', 'assembly-packaging'],
  },
  {
    id: 'final-test-reliability', order: 10, label: 'Final test, qualification & production feedback',
    objective: 'Demonstrate shipped-unit function and establish that the product, package, and manufacturing flow meet intended-use reliability requirements.',
    stageIds: ['final-test-reliability'],
    inputs: ['Assembled units', 'Test programs, load boards, sockets, handlers, and system fixtures', 'Qualification plan and mission profile'],
    outputs: ['Shippable tested units', 'Characterization and qualification evidence', 'Yield, failure-analysis, and field-learning feedback'],
    steps: [
      { id: 'final-ate', label: 'Final ATE test', description: 'Test digital, memory, analog, RF, mixed-signal, power, and interface functions across specified conditions.', category: 'test', articleId: 'process-final-burn-in-system-test' },
      { id: 'speed-power-binning', label: 'Parametric binning', description: 'Classify units by functional, speed, power, leakage, voltage, or application-specific limits.', category: 'test' },
      { id: 'burn-in-screen', label: 'Burn-in or stress screen', description: 'Apply product-specific stress where justified to detect early-life or latent defects.', category: 'test', articleId: 'process-final-burn-in-system-test' },
      { id: 'slt', label: 'System-level test', description: 'Exercise selected units or production populations in a closer-to-use hardware and software environment.', category: 'test', articleId: 'process-final-burn-in-system-test' },
      { id: 'qualification', label: 'Product & package qualification', description: 'Run environmental, mechanical, electrical, package, and lifetime stresses against the intended mission profile.', category: 'quality', articleId: 'concept-package-reliability-failure-analysis' },
      { id: 'failure-analysis', label: 'Failure analysis', description: 'Localize, expose, identify, and verify root causes using electrical, physical, chemical, and materials methods.', category: 'quality', articleId: 'concept-package-reliability-failure-analysis', repeat: true },
      { id: 'corrective-action', label: 'Corrective action & requalification', description: 'Contain affected material, correct the cause, verify effectiveness, and requalify when required.', category: 'quality', repeat: true },
      { id: 'outgoing-quality', label: 'Outgoing quality & packing', description: 'Complete visual and sampling gates, bake or dry-pack as required, label, serialize, and release.', category: 'quality' },
      { id: 'field-monitoring', label: 'Field returns & lifecycle monitoring', description: 'Connect customer returns, telemetry, reliability monitors, and lot genealogy to design and process learning.', category: 'quality', repeat: true },
    ],
    releaseGate: 'Released units meet test limits, qualification requirements, outgoing quality controls, traceability, and change-management obligations.',
    sourceIds: ['tsmc-quality', 'ase-test', 'amkor-test'], feedbackTo: ['product-definition', 'design-implementation', 'wafer-sort', 'assembly-packaging', 'final-test-reliability'],
  },
]

export const SEMICONDUCTOR_CROSS_CUTTING_CONTROLS: CrossCuttingControl[] = [
  { label: 'Contamination control', description: 'Control particles, metals, ions, organics, moisture, electrostatic discharge, and cross-contamination through facilities, carriers, garments, cleans, and material specifications.', appliesTo: 'Wafer preparation through final packing' },
  { label: 'Advanced process control', description: 'Use recipe control, run-to-run adjustment, fault detection, tool matching, chamber qualification, statistical control, and excursion containment.', appliesTo: 'Every production operation' },
  { label: 'Metrology & inspection', description: 'Measure geometry, overlay, film properties, composition, defects, electrical parameters, package interfaces, and reliability indicators at risk-appropriate points.', appliesTo: 'Every release gate' },
  { label: 'Yield learning', description: 'Correlate spatial signatures, tool history, materials, process context, test bins, physical analysis, and design structures to identify root causes.', appliesTo: 'Design through field returns' },
  { label: 'Traceability & change control', description: 'Preserve revision, lot, wafer, die, tool, recipe, material, operator, test, assembly, and shipment genealogy; qualify intentional changes.', appliesTo: 'Supply receipt through shipped unit' },
  { label: 'Reliability engineering', description: 'Translate the mission profile into design rules, monitors, screens, accelerated stresses, models, qualification, and field surveillance.', appliesTo: 'Architecture through lifecycle monitoring' },
  { label: 'Facilities & EHS', description: 'Provide controlled power, gases, vacuum, ultrapure water, exhaust, abatement, chemical delivery, fire protection, and worker/environment safeguards.', appliesTo: 'All factories and laboratories' },
  { label: 'Cybersecurity & data integrity', description: 'Protect design IP, mask data, recipes, equipment interfaces, test content, genealogy, and release decisions from loss or manipulation.', appliesTo: 'Digital thread across all phases' },
]

export function getProcessMapStepCount(): number {
  return SEMICONDUCTOR_PROCESS_PHASES.reduce((total, phase) => total + phase.steps.length, 0)
}

export function assertSemiconductorProcessMapIntegrity(): void {
  const phaseIds = new Set<string>()
  const stepIds = new Set<string>()
  for (const phase of SEMICONDUCTOR_PROCESS_PHASES) {
    if (phaseIds.has(phase.id)) throw new Error(`Duplicate semiconductor process-map phase: ${phase.id}`)
    phaseIds.add(phase.id)
    if (phase.steps.length === 0) throw new Error(`Semiconductor process-map phase has no steps: ${phase.id}`)
    for (const step of phase.steps) {
      if (stepIds.has(step.id)) throw new Error(`Duplicate semiconductor process-map step: ${step.id}`)
      stepIds.add(step.id)
    }
  }
  for (const phase of SEMICONDUCTOR_PROCESS_PHASES) {
    for (const feedbackId of phase.feedbackTo ?? []) if (!phaseIds.has(feedbackId)) throw new Error(`${phase.id} has missing feedback target ${feedbackId}`)
  }
}

assertSemiconductorProcessMapIntegrity()
