/**
 * Nanotechnology: evidence and evaluation.
 *
 * Maha publishes explanation and evaluation method here. It does not
 * manufacture, synthesise, characterise or certify nanomaterials, and nothing
 * on these pages is a safety assessment, a product approval or advice about a
 * medical product.
 *
 * Every source below was opened and read at the locator recorded with it.
 * Where a paragraph is Maha's own proposal rather than a sourced finding, the
 * article says so in its own words; `sources: []` marks an article whose
 * substantive content is method rather than a claim about the world.
 *
 * Semiconductor process coverage stays at /knowledge/suppliers and the
 * semiconductor process map. This section deliberately does not restate
 * lithography, etch or deposition; it links to them.
 */

export const NANO_PATH = '/knowledge/nanotechnology'
export const NANO_RELEASE_DATE = '2026-09-19'
export const NANO_VERSION = 'nanotechnology-knowledge/0.1'

export type NanoSource = {
  title: string
  url: string
  /** Where in the source the claim was read. */
  locator: string
  /** The date the page or section was opened and read. */
  inspected: string
  /** What that passage establishes, in Maha's words. */
  claim: string
  /** What it does not establish. */
  boundary: string
  rights: string
}

export const NANO_SOURCES = {
  nni: {
    title: 'National Nanotechnology Initiative — About Nanotechnology',
    url: 'https://www.nano.gov/about-nanotechnology',
    locator: 'About Nanotechnology, opening paragraph; “How small is nano?”',
    inspected: '2026-09-19',
    claim: 'The NNI describes nanotechnology as understanding and control of matter at dimensions of approximately 1 to 100 nanometres, and states that matter can show physical, chemical and biological properties at that scale that differ from bulk material, single atoms and molecules.',
    boundary: 'A programme definition and orientation page. It does not establish any particular material’s properties, performance or safety.',
    rights: 'Original paraphrase and link only; no government text reproduced beyond short attributed wording.',
  },
  niosh: {
    title: 'NIOSH — Approaches to Safe Nanotechnology: Managing the Health and Safety Concerns Associated with Engineered Nanomaterials (DHHS/NIOSH 2009-125)',
    url: 'https://www.cdc.gov/niosh/docs/2009-125/pdfs/2009-125.pdf',
    locator: '§4.1 Nano-objects and §4.2 Ultrafine Particles, p. 8; §8.3.5 Respirators, pp. 43–44',
    inspected: '2026-09-20',
    claim: 'NIOSH reports the ISO/TS 27687:2008 definition of a nano-object as material with one, two or three external dimensions in the range of approximately 1–100 nm, with nanoplate, nanofibre (nanotube hollow, nanorod solid) and nanoparticle as the subcategories by how many dimensions are nanoscale; it distinguishes engineered nanoparticles from incidental ultrafine particles while noting it is unclear whether that source-based distinction is justified for safety purposes; and it states that there are currently no specific exposure limits in the United States for airborne exposures to engineered nanomaterials, that limits for larger particles of similar composition may not be health-protective at the nanoscale, and that nanoparticles may be more biologically reactive than larger particles of similar chemical composition.',
    boundary: 'Guidance for managing workplace risk, not a toxicological finding about any specific material and not a regulation. The absence of an exposure limit is neither permission nor evidence of safety, and reading this does not substitute for qualified occupational-health practice.',
    rights: 'Public-domain federal document; paraphrased with short attributed wording and linked, not reproduced.',
  },
  epa: {
    title: 'EPA — Control of Nanoscale Materials under the Toxic Substances Control Act',
    url: 'https://www.epa.gov/reviewing-new-chemicals-under-toxic-substances-control-act-tsca/control-nanoscale-materials-under',
    locator: 'Nanoscale Materials; Regulatory Approach; Information gathering rule; Reporting under the rule',
    inspected: '2026-09-19',
    claim: 'EPA treats many nanoscale materials as chemical substances under TSCA, notes that the same substance at the nanoscale may behave differently, and describes a regulatory approach that includes an information-gathering reporting rule and premanufacture notification for new nanoscale materials.',
    boundary: 'Reporting or review under TSCA is a regulatory process, not a finding that a material is safe, effective or approved for a use.',
    rights: 'Original paraphrase and link only.',
  },
  fda: {
    title: 'FDA — Nanotechnology Guidance Documents',
    url: 'https://www.fda.gov/science-research/nanotechnology-programs-fda/nanotechnology-guidance-documents',
    locator: 'List of guidance documents, including “Considering Whether an FDA-Regulated Product Involves the Application of Nanotechnology”, “Safety of Nanomaterials in Cosmetic Products”, and “Drug Products, Including Biological Products, that Contain Nanomaterials” — each listed as final guidance',
    inspected: '2026-09-20',
    claim: 'FDA publishes product-category guidance on whether a regulated product involves nanotechnology and on nanomaterials in cosmetics and drug products, rather than a single approval pathway for “nanotechnology”.',
    boundary: 'Guidance describes FDA’s current thinking for sponsors. It is not a product approval, a clinical finding, or a statement that any marketed nanomaterial product is safe or effective.',
    rights: 'Original paraphrase and link only; guidance documents are not reproduced here.',
  },
  corona: {
    title: 'Akhter et al. — Impact of Protein Corona on the Biological Identity of Nanomedicine: Understanding the Fate of Nanomaterials in the Biological Milieu (Biomedicines, 2021)',
    url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC8533425/',
    locator: 'Introduction; “Types of Coronas and the Biological Identity of NPs”; “Impact on the Physico-Chemical Characteristics”; “Drug Targeting and Cellular Uptake in the Biological Milieu”',
    inspected: '2026-09-20',
    claim: 'Nanoparticles entering a biological medium rapidly adsorb proteins, forming a corona that the cell encounters instead of the engineered surface — a biological identity distinct from the synthetic one. Composition depends on particle size, shape, surface charge and surface chemistry as well as the medium, and adsorption is time-dependent, abundant proteins arriving first and being displaced by higher-affinity ones. The review distinguishes a tightly bound hard corona, whose exchange time exceeds cellular uptake, from a loosely bound soft corona that exchanges freely, and reports that ligand-functionalised particles can have their targeting function cloaked by the corona and lose targeting potential.',
    boundary: 'A review of reported findings, largely in serum and cell-culture systems. It does not establish the corona composition for any particular product, nor predict a clinical outcome, and it is not evidence that any nanomedicine is safe or effective.',
    rights: 'Open-access review; paraphrased and linked, with short attributed wording only.',
  },
  confinement: {
    title: 'Ferreira et al. — Size-dependent bandgap and particle size distribution of colloidal semiconductor nanocrystals',
    url: 'https://arxiv.org/abs/1710.01376',
    locator: 'Abstract; §1 Introduction',
    inspected: '2026-09-20',
    claim: 'The authors propose an analytical expression for the size-dependent bandgap of colloidal semiconductor nanocrystals within a finite-depth square-well effective-mass approximation, intended to hold in the strong-confinement regime where the conventional effective-mass model fails, and use it to recover a particle size distribution from optical absorbance and photoluminescence spectra, validated against microscopy.',
    boundary: 'A model fitted and validated for the authors’ own CdTe system. It does not certify any instrument or supplier, and an optically inferred size distribution remains a model-dependent inference, not a direct measurement.',
    rights: 'Paraphrase and link to the open preprint; no figures or text reproduced.',
  },
  sensing: {
    title: 'Liu et al. — Advancements and Strategies for Selectivity Enhancement in Chemiresistive Gas Sensors (Nanomaterials, 2025)',
    url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC12430070/',
    locator: '§1 Introduction; §2 Gas Sensing Mechanism; §3.1.2 Defects Generation',
    inspected: '2026-09-20',
    claim: 'Chemiresistive sensing works through non-specific surface chemistry — for n-type semiconductors, adsorbed oxygen species and redox reactions with the analyte — so different gases can act on the same sites, and the review states such sensors struggle to detect target gases selectively in mixtures because of cross-sensitivity. It reports that excessive defects can increase noise, cause baseline drift and reduce carrier mobility, that humidity is a persistent interferent, and that a standardised approach for assessing selectivity is lacking, leaving response-ratio indicators poorly comparable between studies.',
    boundary: 'A review of the chemiresistive literature. It gives no performance figure for any commercial sensor and certifies no device, and the absence of a standard selectivity method is a statement about the field, not about a particular product’s quality.',
    rights: 'Open-access review; paraphrased and linked, with short attributed wording only.',
  },
  storage: {
    title: 'Lin, Liu, Ai and Liang — Aligning academia and industry for unified battery performance metrics (Nature Communications, 2018)',
    url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC6288112/',
    locator: 'Introduction; “All performance metrics matter”; “The way forward”',
    inspected: '2026-09-20',
    claim: 'The authors argue that exceptional performance reported in academic work is increasingly inaccessible to practical applications because it is measured under conditions that do not make sense for practical use. They identify mass loading (academic electrodes often under 2 mg/cm² against 5–10 mg/cm² in industry), Coulombic efficiency (their Table 1 gives 99.96% as the level required for cycling stability to 500 cycles for commercialisation), voltage window, electrolyte amount — excess electrolyte in the laboratory masking poor efficiency — and cycle number as metrics that must accompany a capacity claim, and recommend reporting the active-material/conductive-additive/binder ratios, areal mass loading, voltage window and ambient temperature.',
    boundary: 'A perspective on reporting practice, not a measurement of any cell or material. It sets no standard, certifies no laboratory, and its thresholds are the authors’ argument about commercial relevance rather than a regulatory requirement.',
    rights: 'Open-access article; paraphrased and linked, with short attributed wording only.',
  },
  uncertainty: {
    title: 'NIST Technical Note 1297 — Guidelines for Evaluating and Expressing Uncertainty',
    url: 'https://www.nist.gov/pml/nist-technical-note-1297/nist-tn-1297-2-classification-components-uncertainty',
    locator: '§2 Classification of components of uncertainty; §3 Type A; §4 Type B; §7 Reporting uncertainty',
    inspected: '2026-09-19',
    claim: 'Uncertainty components are classified by how they are evaluated — Type A by statistical analysis of repeated observations, Type B by other means — and a reported result is expected to carry the basis of its uncertainty rather than a bare number.',
    boundary: 'A general metrology guideline. It supplies no particle-size uncertainty budget and certifies no instrument or laboratory.',
    rights: 'Original paraphrase and link only.',
  },
} as const

export type NanoSourceId = keyof typeof NANO_SOURCES

export type NanoArticle = {
  slug: string
  title: string
  /** The direct opening answer. */
  answer: string
  /** Mechanism or method. */
  explanation: string
  /** One concrete example. */
  example: string
  /** What the evidence establishes. */
  establishes: string
  /** What it does not establish. */
  boundary: string
  /** Evaluation questions or practical checks a reader can run. */
  checks: string[]
  sources: NanoSourceId[]
  related: string[]
  /** Cross-section links, as path plus reason. */
  crossLinks?: { path: string; label: string }[]
}

export const NANO_ARTICLES: NanoArticle[] = [
  {
    slug: 'what-nanoscale-means',
    title: 'What “nanoscale” means, and why the 1–100 nm range is a convention',
    answer:
      'The nanoscale is conventionally about 1 to 100 nanometres. That range is an agreed boundary for programmes and regulation, not a physical threshold where new behaviour switches on.',
    explanation:
      'The NNI describes nanotechnology as understanding and control of matter at roughly 1–100 nm, where matter can behave differently from the same substance in bulk. NIOSH reports the same range from ISO/TS 27687:2008, which defines a nano-object by how many of its external dimensions fall in it. EPA treats many such materials as ordinary chemical substances under TSCA that may nevertheless behave differently at that scale. The three agree on the number and differ in purpose: describing a research field, scoping worker protection, and deciding what has to be reported. A material at 120 nm is not exempt from the physics; it is outside a definition.',
    example:
      'A pigment supplier states that its particles are “nano-free” because the median diameter is 180 nm. A median says nothing about the tail of the distribution. The question worth asking is what fraction of particles falls below 100 nm and by which measurement method, not whether one summary number clears the line.',
    establishes:
      'That 1–100 nm is the working range used by the US nanotechnology programme, the ISO terminology NIOSH reports for worker protection, and the chemical regulator, each for its own purpose.',
    boundary:
      'No definition establishes that a material in that range is hazardous, novel or useful. Size ranges scope a conversation; they do not predict behaviour.',
    checks: [
      'Ask which dimension is being described: a diameter, a layer thickness, a pore size or a feature pitch.',
      'Ask for the size distribution and the measurement method, not only a median or a nominal value.',
      'Ask whether the material was engineered to that size or simply happens to contain a fraction of it.',
    ],
    sources: ['nni', 'niosh', 'epa'],
    related: ['surface-area-to-volume', 'characterisation-what-each-method-sees', 'regulatory-status-is-not-safety'],
  },
  {
    slug: 'surface-area-to-volume',
    title: 'Why the same material behaves differently when it is small',
    answer:
      'As a particle shrinks, the fraction of its atoms sitting at the surface rises steeply. Surface atoms are where dissolution, catalysis, adsorption and aggregation happen, so the same chemistry can behave differently at a smaller size.',
    explanation:
      'For a sphere of diameter d, area scales with d² and volume with d³, so specific surface area scales as 1/d. Dividing the diameter by ten multiplies surface area per unit mass by ten. That is arithmetic, and it is the honest part of the “nano is different” claim: more accessible surface per gram means more sites for reaction, more contact area with a biological or environmental medium, and stronger attractive forces relative to particle weight. The part that arithmetic cannot supply is what happens at those sites. Surface chemistry, coatings, the medium, and whether particles stay dispersed or clump together all intervene between geometry and outcome.',
    example:
      'The executable example in this section computes specific surface area for idealised spheres, cubes, rods and platelets with declared density and units. A 10 nm sphere of density 4 g/cm³ has about 150 m²/g; the same material at 100 nm has about 15 m². Both figures describe perfect geometry, not a real powder with its roughness, porosity and aggregates.',
    establishes:
      'That the increase in specific surface area with decreasing size is a geometric consequence, computable from shape, size and density alone.',
    boundary:
      'Geometry predicts area, not reactivity, dissolution rate, toxicity or performance. A material may have a large computed area and be inert, or a modest area and be highly reactive because of its surface chemistry.',
    checks: [
      'Recompute the quoted specific surface area from the stated size, shape and density, and see whether it is even geometrically possible.',
      'Ask whether a measured area (for example by gas adsorption) is reported alongside the geometric estimate, and how much they differ.',
      'Ask whether the material is aggregated in the medium of use; aggregation reduces accessible area without changing the primary particle size.',
    ],
    sources: ['nni'],
    related: ['surface-area-example', 'structure-property-claims', 'batch-to-batch-variability'],
  },
  {
    slug: 'nanomaterial-classes',
    title: 'Nanomaterial classes describe shape, not behaviour',
    answer:
      'Grouping materials as particles, tubes, sheets or dots organises a conversation about geometry and synthesis. It does not let you transfer a property, a hazard or a performance result from one member of the group to another.',
    explanation:
      'The standard cut is dimensionality, and NIOSH reports it from ISO/TS 27687:2008: a nanoplate has one external dimension at the nanoscale, a nanofibre two — a nanotube being a hollow nanofibre and a nanorod a solid one — and a nanoparticle all three. That maps onto the familiar vocabulary of sheets, tubes and wires, and dots. Dimensionality predicts some things well — how a material disperses, how it packs, how anisotropic its electrical or mechanical response can be. It predicts chemistry poorly. Two carbon nanotube samples can share a class label and differ in length distribution, residual catalyst metal, defect density and surface functionalisation, and those differences drive both performance and biological interaction. Maha’s position is that a class label belongs in the description of a sample, never in its evidence.',
    example:
      'A supplier’s datasheet lists “multi-walled carbon nanotubes, >95% purity”. Purity with respect to what — amorphous carbon, catalyst residue, or both? Two samples that both satisfy that line can differ by an order of magnitude in residual iron, which is exactly the variable an oxidation-catalysis or toxicology reviewer needs.',
    establishes:
      'That the same nominal class covers materials with materially different composition, and that class membership is a description rather than a measurement.',
    boundary:
      'This is an organising scheme, not a taxonomy endorsed by a standards body, and it does not tell you which class suits an application.',
    checks: [
      'Ask which attributes were measured on the specific batch, not the class: dimensions, distribution, purity basis, functional groups.',
      'Ask what the impurity limit refers to and how it was determined.',
      'When a result is transferred between two materials in the same class, ask what makes them equivalent for that particular mechanism.',
    ],
    sources: ['nni', 'niosh'],
    related: ['structure-property-claims', 'batch-to-batch-variability', 'vendor-claim-checks'],
  },
  {
    slug: 'top-down-and-bottom-up',
    title: 'Top-down patterning and bottom-up synthesis answer different questions',
    answer:
      'Top-down methods carve structure out of a larger material; bottom-up methods grow it from molecular precursors. The choice sets what you can control, what varies, and what evidence you need.',
    explanation:
      'Top-down routes — lithography, etch, milling — inherit the flatness and registration of a substrate, so they give placement and repeatability, at the cost of equipment and area. Bottom-up routes — solution synthesis, vapour growth, self-assembly — give access to shapes and sizes that patterning cannot reach cheaply, at the cost of distributions: every batch produces a population, not a single object. The practical consequence is what a reviewer should expect to see. A patterned device is characterised by geometry and yield across a wafer. A synthesised material is characterised by a distribution, a batch identity and the conditions that produced it. Maha covers semiconductor patterning separately; this section links there rather than restating it.',
    example:
      'Two routes to a 30 nm feature: define it lithographically on a wafer, or synthesise 30 nm particles and deposit them. The first is judged by critical-dimension uniformity and defect density; the second by size distribution, aggregation state and coverage. Comparing them on one number is a category error.',
    establishes:
      'That the evidence expected of a nanostructured object depends on how it was made, because the two families of routes fail in different ways.',
    boundary:
      'This page does not describe any specific process recipe, tool or yield, and it is not process-engineering guidance.',
    checks: [
      'Ask whether the reported dimension is a designed target, a measured mean, or a single micrograph.',
      'For synthesised material, ask for the batch identity and the distribution width, not only the mode.',
      'For patterned structures, ask across how much area the dimension was verified.',
    ],
    sources: ['nni'],
    related: ['batch-to-batch-variability', 'scale-up-constraints', 'characterisation-what-each-method-sees'],
    crossLinks: [
      { path: '/knowledge/suppliers', label: 'Semiconductor process and supplier map, for top-down patterning' },
    ],
  },
  {
    slug: 'characterisation-what-each-method-sees',
    title: 'Every characterisation method measures its own quantity',
    answer:
      'Electron microscopy, light scattering and gas adsorption do not measure “the size” of a material. Each measures a different physical quantity, under different assumptions, and the numbers are not interchangeable.',
    explanation:
      'Imaging counts individual objects and shows shape, but it samples a tiny population and requires a dried, often coated, specimen — a state that may not exist in the medium of use. Dynamic light scattering reports a hydrodynamic size in suspension, weighted so that a small number of large aggregates can dominate the result. Gas adsorption reports accessible surface area of a dry powder, including roughness and porosity that an idealised geometric estimate ignores. None of these is wrong; each answers its own question. Maha’s proposed reporting rule is simple: name the method beside every number, and never let a value measured one way silently satisfy a specification written for another.',
    example:
      'A dispersion is described as “20 nm”. Microscopy of the dried sample supports 20 nm primary particles; light scattering in the buffer reports 140 nm. Both can be true at once if the particles aggregate in that buffer, and the second number is the one that matters for what the dispersion will do.',
    establishes:
      'That a size or area number is meaningful only with its method, its specimen preparation and its weighting.',
    boundary:
      'This is an orientation to method differences, not a protocol, an instrument recommendation or a validated comparison between techniques.',
    checks: [
      'For every reported number, ask: which method, which specimen state, which weighting, how many objects.',
      'Ask whether the value was measured in the medium where the material will be used.',
      'When two methods disagree, treat the disagreement as information about the sample rather than as an error to be averaged away.',
    ],
    sources: ['uncertainty'],
    related: ['reporting-size-with-uncertainty', 'batch-to-batch-variability', 'surface-area-to-volume'],
  },
  {
    slug: 'reporting-size-with-uncertainty',
    title: 'Report a nanomaterial size the way a measurement is reported',
    answer:
      'A single number is not a size. Report the measurand, the method, the distribution and an uncertainty with its basis, or the result cannot be compared with anyone else’s.',
    explanation:
      'NIST TN 1297 classifies uncertainty components by how they are evaluated — Type A from statistical analysis of repeated observations, Type B by other means, such as instrument specifications or prior data — and expects a reported result to carry that basis. Applied to nanomaterials, that means a stated diameter should say what was measured (a projected area diameter from images, a hydrodynamic diameter from scattering), over how many objects or runs, and with what contributions to the stated spread. Distribution width is not uncertainty: a wide, well-measured distribution is a property of the sample, while uncertainty describes how well the measurement pinned it down. Both belong in the record, separately.',
    example:
      'Two reports state “32 nm”. One is a mean over 500 imaged particles with the standard deviation of the population and a stated magnification calibration; the other is a single scattering run’s intensity-weighted mean. Only the first supports a comparison with a specification written on a number-weighted basis.',
    establishes:
      'That the reporting structure for a nanomaterial measurement is the ordinary metrological one, and that its components have defined meanings.',
    boundary:
      'No uncertainty budget for any instrument or material is supplied here, and nothing on this page calibrates or certifies a measurement.',
    checks: [
      'Separate the width of the population from the uncertainty of the estimate; ask for both.',
      'Ask which uncertainty components were evaluated statistically and which came from specifications.',
      'Ask how the calibration of the instrument was established and when.',
    ],
    sources: ['uncertainty'],
    related: ['characterisation-what-each-method-sees', 'batch-to-batch-variability'],
    crossLinks: [
      { path: '/knowledge/robotics/measurement-uncertainty', label: 'The same reporting discipline applied to robot measurements' },
    ],
  },
  {
    slug: 'batch-to-batch-variability',
    title: 'One batch is one batch',
    answer:
      'A result obtained on a single synthesised batch describes that batch. Reproducibility claims need either several independent batches or an explicit statement that they were not tested.',
    explanation:
      'Bottom-up synthesis produces populations whose distribution depends on conditions that are hard to hold constant: precursor lot, mixing, temperature history, cleaning, storage age. A property that depends on surface state — catalytic rate, dispersion stability, biological interaction — can move with those variables while the nominal description stays identical. Maha’s proposed record keeps batch identity attached to every measurement and every downstream result, so that a later disagreement can be localised rather than argued. If a study used one batch, that is a fact about its scope, not a criticism; asserting general behaviour from it is the error.',
    example:
      'A coating shows a 30% durability improvement with particles from batch A. Batch B, nominally identical, shows 8%. Without batch identity in the original record there is no way to tell whether the difference is synthesis, ageing, dispersion or the durability test itself.',
    establishes:
      'That batch identity is part of the evidence, and that an unreplicated batch bounds the claim that can be made from it.',
    boundary:
      'This page proposes record-keeping. It does not establish how many batches are sufficient for any particular claim, which depends on the mechanism and the decision.',
    checks: [
      'Ask how many independent batches were tested, and whether the same batch was reused across the comparisons.',
      'Ask for the age and storage condition of the material at the time of measurement.',
      'Ask whether the same operator, instrument and day produced all the compared results.',
    ],
    sources: [],
    related: ['structure-property-claims', 'scale-up-constraints', 'reporting-size-with-uncertainty'],
    crossLinks: [
      { path: '/knowledge/robotics/dataset-lineage', label: 'Lineage records for the robotics equivalent of this problem' },
    ],
  },
  {
    slug: 'structure-property-claims',
    title: 'Structure–property claims need the mechanism, not the correlation',
    answer:
      'A correlation between a structural parameter and a performance number supports a structure–property claim only when the mechanism that connects them is stated and the confounders are excluded.',
    explanation:
      'Structure–property reasoning is the useful core of the field: crystallite size, facet, defect density, surface ligand and porosity all change what a material does. The failure mode is that these variables move together during synthesis. Making particles smaller usually also changes their surface chemistry, their aggregation and their ligand coverage, so a plot of performance against diameter may be reporting the ligand, not the diameter. Maha’s proposal is to write the mechanism first, name which variable the experiment isolates, and say plainly which other variables moved with it.',
    example:
      'A catalytic rate rises as particle size falls across a synthesis series. If the smaller particles were also made with a different surfactant, the series cannot separate size from surface coverage. A post-synthesis ligand exchange applied to both ends of the series is the kind of control that would.',
    establishes:
      'That a structure–property claim is an argument about a mechanism, and that the design of the sample series determines whether it holds.',
    boundary:
      'No specific structure–property relationship is asserted here, and this page is not a substitute for domain expertise in a given material system.',
    checks: [
      'Ask which single variable the series isolates and what held the others fixed.',
      'Ask whether an intervention (exchange, anneal, wash) was used to test the proposed mechanism directly.',
      'Ask whether the property was measured on the same batch that was structurally characterised.',
    ],
    sources: [],
    related: ['batch-to-batch-variability', 'nanomaterial-classes', 'vendor-claim-checks'],
  },
  {
    slug: 'scale-up-constraints',
    title: 'What changes between a gram and a kilogram',
    answer:
      'Scale-up is not the same synthesis performed for longer. Mixing, heat transfer, addition rate and cleaning all change with vessel size, and they are the variables that set the distribution.',
    explanation:
      'At laboratory scale, a reaction mixture is close to uniform and reaches temperature quickly. In a larger vessel, gradients appear: parts of the mixture nucleate under different conditions than others, which broadens distributions and can change phase or shape. Downstream steps scale badly too — washing, solvent exchange and drying are where aggregation is often introduced, and a dried, agglomerated powder may never redisperse to the size that was measured before drying. Maha’s proposed position for a reviewer is that a pilot result is evidence about a process at that scale, and that the burden of showing equivalence sits with whoever claims the larger batch is the same material.',
    example:
      'A 2 g synthesis gives a narrow distribution. The 500 g run, same recipe and stoichiometry, gives a bimodal distribution because addition took thirty minutes rather than thirty seconds. Nothing in the recipe changed; the condition that set the nucleation burst did.',
    establishes:
      'That process scale is a material variable, and that equivalence between scales is a claim requiring its own measurement.',
    boundary:
      'This is not process design guidance, and Maha operates no synthesis or pilot facility. Costs, yields and equipment choices are outside this page.',
    checks: [
      'Ask at what scale each reported result was produced, and whether the compared materials came from the same scale.',
      'Ask what changed in mixing, addition rate and drying between scales.',
      'Ask whether post-drying redispersion was measured, not assumed.',
    ],
    sources: [],
    related: ['batch-to-batch-variability', 'top-down-and-bottom-up', 'vendor-claim-checks'],
  },
  {
    slug: 'exposure-and-safety-evidence',
    title: 'What an exposure or safety study does and does not settle',
    answer:
      'A toxicology or exposure result applies to the material, the dose, the route and the model it used. Extending it to a different particle, coating, medium or exposure route is a new claim.',
    explanation:
      'NIOSH states that there are currently no specific exposure limits in the United States for airborne exposures to engineered nanomaterials, that limits for larger particles of similar chemical composition may not be health-protective at the nanoscale — its own example is that the OSHA permissible exposure limit for graphite may not be a safe limit for carbon nanotubes — and that nanoparticles may be more biologically reactive than larger particles of similar composition. EPA meanwhile treats many nanoscale materials as chemical substances under TSCA, with reporting and premanufacture review that gather information rather than pronounce safety. Between those facts sits the practical reality: the same chemistry at a different size, coating or aggregation state can deposit differently, dissolve differently and clear differently, so “the bulk material is well characterised” is not an answer. Maha’s role here is to separate what a study measured from what a product description implies, not to assess any material.',
    example:
      'An inhalation study on an uncoated powder reports a no-observed-adverse-effect level. A supplier cites it for a polymer-embedded version of the same chemistry. The embedded form may never become airborne in use — which is a reason to expect lower exposure, and not evidence about the hazard of the particles themselves if they are released during sanding or disposal.',
    establishes:
      'That US airborne exposure limits specific to engineered nanomaterials do not currently exist, that limits set for larger particles of the same chemistry may not be protective at the nanoscale, and that the frameworks in place gather evidence rather than certify safety.',
    boundary:
      'Nothing here is a hazard assessment, an exposure limit, a control-banding recommendation or medical advice. Maha runs no toxicology and certifies nothing.',
    checks: [
      'Ask which exact material, including coating and aggregation state, was tested, and how it compares with the one in use.',
      'Ask which exposure route was studied and whether it matches the realistic route in the workplace or product.',
      'Ask whether release during use, maintenance, abrasion or disposal was measured, not only the intact product.',
    ],
    sources: ['niosh', 'epa'],
    related: ['regulatory-status-is-not-safety', 'nanomaterial-classes'],
  },
  {
    slug: 'regulatory-status-is-not-safety',
    title: 'Regulatory status is not a safety finding, and medical claims have their own bar',
    answer:
      'Being reportable under TSCA, listed in an inventory, or addressed by an FDA guidance describes a process a product is in. None of them is a statement that a material is safe or effective.',
    explanation:
      'EPA’s approach to nanoscale materials includes an information-gathering rule and premanufacture notification, both of which are mechanisms for the agency to receive and review information. FDA publishes guidance on whether a regulated product involves nanotechnology and on nanomaterials in cosmetics and in drug products, which tells sponsors what the agency expects to see — again, a process. For medical applications the distinction that matters most to a reader is the one between a laboratory finding, a clinical result in people, and an approved product. Maha keeps those three separate and does not bridge them. We give no treatment advice and make no claim about any therapy.',
    example:
      'A press release says a nanoparticle formulation is “FDA-compliant” after a premarket submission. Compliance with a submission requirement is not authorisation, and an in-vitro or animal result cited beside it is not clinical evidence.',
    establishes:
      'That regulatory mechanisms for nanoscale materials are information and review processes, described on the agencies’ own pages.',
    boundary:
      'This page does not interpret any specific regulatory status, does not give legal advice and does not evaluate any medical product. Approval questions belong to the relevant agency and to qualified counsel.',
    checks: [
      'Ask precisely which status is being claimed: reported, notified, reviewed, cleared, approved — and for which product and use.',
      'For a medical claim, ask whether the evidence is in vitro, in animals, in a clinical trial, or in an approved label.',
      'Ask whether the cited regulatory document is guidance, a rule, or a decision about this product.',
    ],
    sources: ['epa', 'fda'],
    related: ['exposure-and-safety-evidence', 'vendor-claim-checks'],
  },
  {
    slug: 'vendor-claim-checks',
    title: 'Reading a nanomaterial datasheet or demonstration claim',
    answer:
      'Read a vendor claim for what was measured, on which batch, by which method, against which control. A performance number without those four is a description, not evidence.',
    explanation:
      'Datasheets and demonstration videos compress a distribution into a headline. The recurring gaps are consistent enough to check quickly: a nominal size with no method or distribution; a purity figure with no basis; a performance improvement with no stated baseline or control; a laboratory result presented beside an application photograph that was not produced under the same conditions. Maha proposes treating the datasheet as a set of claims to be traced to measurements, and recording which ones could not be traced. That record is more useful than a verdict, because it tells a buyer exactly what to ask for next.',
    example:
      'A coating additive claims “3× abrasion resistance”. Three times what: an uncoated substrate, a competitor, or the same coating without the additive? Under which abrasion standard, at what loading, and was the additive dispersed by a method a customer can reproduce?',
    establishes:
      'Nothing about any vendor. This is a reading method Maha proposes, and its output is a list of open questions.',
    boundary:
      'Maha does not test, endorse, rank or certify suppliers or materials, and no supplier appears in this section.',
    checks: [
      'For each headline number: what was measured, on which batch, by which method, against which control?',
      'Ask whether the demonstration conditions match the intended use conditions, including medium, loading and duration.',
      'Ask for the measurement report rather than the datasheet summary, and note when it is unavailable.',
    ],
    sources: [],
    related: ['nanomaterial-classes', 'structure-property-claims', 'scale-up-constraints'],
  },
  {
    slug: 'surface-area-example',
    title: 'A runnable surface-area-to-volume calculation, and what it cannot tell you',
    answer:
      'This section ships a small deterministic calculator for idealised shapes. It shows the geometry clearly and refuses to imply anything about reactivity, toxicity or performance.',
    explanation:
      'The example takes a shape, a characteristic dimension with units, and a density, and returns surface area, volume, surface-area-to-volume ratio and specific surface area per gram, with the unit conversions carried explicitly and a dimensional check on every result. It supports spheres, cubes, cylindrical rods and platelets, so a reader can see how anisotropy changes the ratio at constant volume. It also ships counterexamples: a zero or negative dimension is refused, an unsupported unit is refused, and a density of zero is refused rather than silently producing infinity.',
    example:
      'A 10 nm sphere at 4.0 g/cm³ returns 1.5 × 10² m²/g; the same material as a 2 nm-thick platelet returns a much larger figure at the same volume. Both are exact consequences of the assumed geometry, and neither is a measurement of a real powder.',
    establishes:
      'That the geometric part of a specific-surface-area claim can be checked in seconds, and that a quoted value inconsistent with the stated size, shape and density is wrong on arithmetic alone.',
    boundary:
      'Idealised, non-porous, perfectly monodisperse, non-aggregated geometry. Real powders have roughness, porosity, distributions and aggregates, so a measured area will differ — often by a lot. The calculator says nothing about reactivity, dissolution, exposure or hazard.',
    checks: [
      'Run the calculator against a datasheet value and see whether the geometry supports it.',
      'Compare the geometric estimate with a measured adsorption area and ask what the difference implies about porosity or aggregation.',
      'Try the refused inputs to see the failure behaviour before trusting the accepted ones.',
    ],
    sources: [],
    related: ['surface-area-to-volume', 'characterisation-what-each-method-sees'],
  },
  {
    slug: 'surface-functionalisation',
    title: 'What a coating changes, and why the surface is usually the variable that moved',
    answer:
      'A ligand or coating changes what the outside of a particle is, which is what solvents, cells and other particles actually meet. In a biological medium the engineered surface is quickly covered by adsorbed proteins, so the particle acquires a second identity the designer did not specify.',
    explanation:
      'Functionalisation is normally introduced as a way to control dispersion, stability and targeting, and it does all of those things. But the review by Akhter and colleagues describes what happens next in a biological medium: proteins adsorb rapidly and form a corona, and the cell encounters that corona rather than the surface that was designed. The composition depends on size, shape, surface charge and surface chemistry as well as the medium, and it evolves in time — abundant proteins arrive first and are displaced by higher-affinity ones. The review separates a tightly bound hard corona, whose exchange time exceeds the cellular uptake it competes with, from a loosely bound soft corona that exchanges freely. The consequence it reports for engineered targeting is blunt: the functional characteristics of ligated particles can be cloaked, and they may lose their targeting potential. Maha’s point for a reader comparing two samples is narrower and applies outside biology too — when a coating changes, the surface chemistry, the effective size and the aggregation behaviour usually change with it, so a comparison that varies coating alongside size has varied at least two things.',
    example:
      'Two batches of the same core material are compared, one bare and one ligand-functionalised, and the functionalised batch performs better in a cell assay. That result is consistent with the ligand working as intended, and equally consistent with a different corona forming, a different effective hydrodynamic size, and a different aggregation state. Nothing in the comparison separates them.',
    establishes:
      'That the engineered surface is not necessarily the surface that acts, that corona composition is governed by properties the designer does control, and that a targeting ligand can be functionally hidden by what adsorbs on top of it.',
    boundary:
      'A review of reported findings, mostly in serum and cell-culture systems. It does not tell you the corona for any particular product, does not predict a clinical result, and is not evidence that any nanomedicine works or is safe. Outside biology the corona mechanism does not apply, though the confounding of coating with size and aggregation still does.',
    checks: [
      'Ask whether the coating was the only thing that changed between the samples being compared, and how that was established.',
      'Ask what medium the particles were measured in, and whether size was measured in that medium or in a clean solvent.',
      'For a targeting claim, ask what evidence exists that the ligand is still exposed and functional after exposure to the biological medium.',
      'Treat “functionalised” as a description of an intended synthesis step, not as a measurement of the surface that resulted.',
    ],
    sources: ['corona'],
    related: ['structure-property-claims', 'batch-to-batch-variability', 'characterisation-what-each-method-sees'],
    crossLinks: [
      { path: '/knowledge/nanotechnology/regulatory-status-is-not-safety', label: 'Why a regulatory filing about such a product is not a safety finding' },
    ],
  },
  {
    slug: 'quantum-confinement',
    title: 'Quantum confinement: a real size effect, and what an optical size measurement assumes',
    answer:
      'Confinement is one of the few places where making a semiconductor smaller changes a property for a well-understood physical reason rather than by changing surface area. The band gap widens as the crystal shrinks, which is why a size change shows up as a colour change.',
    explanation:
      'When a semiconductor crystal becomes comparable to or smaller than the natural extent of its electron–hole pair, the available energy levels are set partly by the size of the box rather than by the bulk material alone, and the gap between them widens as the box shrinks. Ferreira and colleagues give an analytical expression for that size-dependent gap within a finite-depth square-well effective-mass approximation, written to remain usable in the strong-confinement regime where the conventional effective-mass treatment fails. The part worth carrying into evaluation is what they do with it: because the relationship runs both ways, they invert it to recover a particle size distribution from absorbance and photoluminescence spectra, checked against microscopy. That is a genuine measurement route, and it is also a model-dependent one. An optically inferred size rests on the expression chosen, on the assumed shape, and on the assumption that the optical response comes from the particles you think it does.',
    example:
      'A supplier quotes a quantum dot diameter derived from the absorption peak. The number may be sound, but it is an inference through a confinement model, not a direct observation of a particle. A microscopy distribution on the same sample would be a different kind of evidence, and the two can legitimately disagree where the model is strained.',
    establishes:
      'That the size dependence of the band gap is a real, modelled physical effect rather than a marketing gloss, and that an optical size can be derived from it with stated assumptions and validated against microscopy.',
    boundary:
      'The model was fitted and validated for the authors’ own CdTe system. It certifies no instrument and no supplier, and it does not extend to arbitrary materials, shapes or aggregation states. Confinement explains an optical shift; it says nothing about reactivity, stability or safety.',
    checks: [
      'Ask whether a quoted size was measured directly or inferred from a spectrum, and which expression was used.',
      'Ask whether the inferred distribution was ever checked against a direct imaging method on the same sample.',
      'Be suspicious of a confinement explanation applied to a material or size range where the crystal is far larger than the relevant excitonic scale.',
      'Separate the claim “the colour shifted” from the claim “we know the size”, which requires the model in between.',
    ],
    sources: ['confinement'],
    related: ['characterisation-what-each-method-sees', 'reporting-size-with-uncertainty', 'structure-property-claims'],
  },
  {
    slug: 'nano-sensing',
    title: 'Nanomaterial sensors: high sensitivity is the easy half, selectivity is the hard half',
    answer:
      'A large, reactive surface makes a nanomaterial an excellent transducer, which is why sensitivity figures are easy to produce. The same non-specific surface chemistry is why the response is rarely specific to one analyte.',
    explanation:
      'A chemiresistive sensor reports a change in electrical resistance when something adsorbs on its surface. The review of selectivity in these devices describes the mechanism for n-type semiconductors as adsorbed oxygen species undergoing redox reactions with the gas, which makes the limitation structural rather than incidental: different gases act on the same sites, so the device measures “something adsorbed and transferred charge”, not “this analyte is present”. The review states plainly that such sensors struggle to detect target gases selectively in mixtures because of cross-sensitivity. It also reports that excessive defect engineering — often the route to higher sensitivity — can increase noise, cause baseline drift and reduce carrier mobility, and that humidity remains a persistent interferent. The finding a reader should carry away is the one about the literature itself: a standardised approach for assessing selectivity is lacking, so response-ratio indicators are poorly comparable between studies. This section covers the transduction and the evidence question. Event-driven and neuromorphic sensing, where the interesting part is how the signal is encoded and computed rather than how the surface responds, belongs to the neuromorphic section.',
    example:
      'A device is reported with a detection limit in the parts-per-billion range for a target gas. The figure may be exactly right in dry air against that gas alone, and tell you very little about a humid room containing several reducing gases — a condition the review says there is no standard way to test.',
    establishes:
      'That the sensitivity of a nanomaterial sensor and its selectivity come from the same mechanism and trade against each other, and that cross-study selectivity comparisons rest on no agreed method.',
    boundary:
      'A review of the chemiresistive literature. It reports no performance figure for any commercial sensor, certifies no device, and the absence of a standard method is a statement about the field rather than a criticism of any particular product.',
    checks: [
      'Ask what else was in the gas stream during the reported measurement, and at what humidity.',
      'Ask how selectivity was quantified, and against which interferents — then ask whether another paper’s number was computed the same way.',
      'Ask for baseline drift over the intended deployment period, not just a response curve.',
      'Treat a detection limit measured against a single analyte in dry air as a ceiling, not an operating specification.',
    ],
    sources: ['sensing'],
    related: ['structure-property-claims', 'vendor-claim-checks', 'batch-to-batch-variability'],
    crossLinks: [
      { path: '/knowledge/neuromorphic-biocomputing', label: 'Neuromorphic and biocomputing: event-driven sensing and in-memory computation' },
    ],
  },
  {
    slug: 'energy-storage-claims',
    title: 'Reading an energy-storage claim: the numbers that must travel with a capacity',
    answer:
      'A capacity or energy-density figure means nothing on its own. It is a measurement made under conditions, and the conditions are what decide whether it has any bearing on a practical cell.',
    explanation:
      'Lin, Liu, Ai and Liang argue that the exceptional performance reported in academic work is increasingly inaccessible to practical applications, because it is measured under conditions that do not make sense for practical use. They name what has to be reported alongside a capacity. Mass loading comes first: academic electrodes are often under 2 mg/cm² where industry needs 5–10 mg/cm², and a thin electrode flatters almost every other number. Coulombic efficiency is the second — their Table 1 gives 99.96% as the efficiency required for cycling stability to 500 cycles for commercialisation, which turns a figure that looks like a rounding detail into the thing that decides cycle life. Electrolyte amount matters because an excess of it in the laboratory masks poor efficiency. Voltage window and cycle number complete the set. Their recommendation is a reporting list: the ratios among active material, conductive additive and binder, the areal mass loading, the voltage window and the ambient temperature. Maha adds no threshold of its own and measures no cell; what this page offers is the question set.',
    example:
      'A material is announced with a capacity several times that of a conventional electrode. If the electrode was thin, the electrolyte plentiful, the window wide and the test short, every one of those choices pushed the number up, and none of them is disclosed in the headline.',
    establishes:
      'That an energy-storage claim is only interpretable with its measurement conditions attached, and that specific reporting items — mass loading, Coulombic efficiency, electrolyte amount, voltage window, cycle number — have been identified in the literature as the ones that decide practical relevance.',
    boundary:
      'A perspective on reporting practice, not a measurement of any cell or material, and not a standard. Its thresholds are the authors’ argument about commercial relevance, not a regulatory requirement, and nothing here evaluates any product or predicts how any cell will perform.',
    checks: [
      'Ask for areal mass loading in mg/cm², and compare it with the 5–10 mg/cm² the authors associate with industrial practice.',
      'Ask for Coulombic efficiency to enough decimal places to be meaningful, and for the cycle count it was sustained over.',
      'Ask how much electrolyte was used relative to the active material.',
      'Ask for the voltage window and the temperature, and check whether a comparison across papers holds them equal.',
      'Treat a capacity quoted without any of these as an unfinished measurement rather than a result.',
    ],
    sources: ['storage'],
    related: ['scale-up-constraints', 'vendor-claim-checks', 'structure-property-claims'],
  },
]

export type CandidateStatus = 'implemented' | 'evidence-ready' | 'revise' | 'blocked' | 'duplicative'

export type NanoCandidate = {
  slug: string
  question: string
  audience: string
  contribution: string
  status: CandidateStatus
  /** Why a candidate is not implemented, or which route already owns it. */
  note?: string
  /** Search demand is unknown unless a local Search Console export says otherwise. */
  demand: 'unknown'
}

/**
 * The candidate map. A planning ceiling of 24, not a publication quota: the
 * seventeen implemented articles are the ones whose sources were actually read.
 */
export const NANO_CANDIDATES: NanoCandidate[] = [
  { slug: 'what-nanoscale-means', question: 'What does nanoscale actually mean?', audience: 'Newcomer, procurement, journalist', contribution: 'Reconciles three official definitions and explains why the boundary is a convention', status: 'implemented', demand: 'unknown' },
  { slug: 'surface-area-to-volume', question: 'Why does the same material behave differently when small?', audience: 'Developer, student', contribution: 'Separates the arithmetic from the chemistry', status: 'implemented', demand: 'unknown' },
  { slug: 'nanomaterial-classes', question: 'How are nanomaterials grouped, and what does a class tell me?', audience: 'Buyer, reviewer', contribution: 'Treats class as description rather than evidence', status: 'implemented', demand: 'unknown' },
  { slug: 'top-down-and-bottom-up', question: 'How are nanostructures made?', audience: 'Developer, reviewer', contribution: 'Links routes to the evidence each one owes; defers patterning to the semiconductor map', status: 'implemented', demand: 'unknown' },
  { slug: 'characterisation-what-each-method-sees', question: 'Why do two instruments report different sizes?', audience: 'Reviewer, buyer', contribution: 'Method-specific measurands and why numbers are not interchangeable', status: 'implemented', demand: 'unknown' },
  { slug: 'reporting-size-with-uncertainty', question: 'How should a size be reported?', audience: 'Researcher, reviewer', contribution: 'Applies TN 1297 structure to particle metrology, separating distribution width from uncertainty', status: 'implemented', demand: 'unknown' },
  { slug: 'batch-to-batch-variability', question: 'Does one batch generalise?', audience: 'Reviewer, buyer', contribution: 'Batch identity as part of the evidence record', status: 'implemented', demand: 'unknown' },
  { slug: 'structure-property-claims', question: 'When does a structure–property claim hold?', audience: 'Researcher', contribution: 'Confounded synthesis series and the controls that separate variables', status: 'implemented', demand: 'unknown' },
  { slug: 'scale-up-constraints', question: 'Why does scale-up change the material?', audience: 'Developer, investor', contribution: 'Names the process variables that set distributions', status: 'implemented', demand: 'unknown' },
  { slug: 'exposure-and-safety-evidence', question: 'What does a safety study establish?', audience: 'Employer, reviewer', contribution: 'Scope boundaries of exposure evidence, sourced to NIOSH and EPA framing', status: 'implemented', demand: 'unknown' },
  { slug: 'regulatory-status-is-not-safety', question: 'Does regulatory status mean it is safe or approved?', audience: 'Buyer, journalist', contribution: 'Separates process from finding; keeps medical claims in their own tier', status: 'implemented', demand: 'unknown' },
  { slug: 'vendor-claim-checks', question: 'How do I read a datasheet claim?', audience: 'Buyer', contribution: 'A traceability reading method with an open-questions output', status: 'implemented', demand: 'unknown' },
  { slug: 'surface-area-example', question: 'Can I check a surface-area claim myself?', audience: 'Developer, student', contribution: 'Runnable, unit-aware calculator with refusals and counterexamples', status: 'implemented', demand: 'unknown' },
  { slug: 'electron-microscopy-artifacts', question: 'What artefacts does electron microscopy introduce?', audience: 'Researcher', contribution: 'Beam damage, drying and coating artefacts as an evidence problem', status: 'blocked', note: 'Needs a microscopy standards or instrument-documentation source read at section depth; none inspected yet.', demand: 'unknown' },
  { slug: 'light-scattering-weighting', question: 'Why does DLS over-report large particles?', audience: 'Reviewer', contribution: 'Intensity weighting and its consequences for specification compliance', status: 'blocked', note: 'Requires an ISO 22412-class source; the standard is paywalled and was not read.', demand: 'unknown' },
  { slug: 'surface-functionalisation', question: 'What does a coating change?', audience: 'Developer', contribution: 'Ligands and coatings as the variable that usually moves with size; the protein corona as a second, unspecified identity', status: 'implemented', demand: 'unknown' },
  { slug: 'quantum-confinement', question: 'Why does colour change with dot size?', audience: 'Student', contribution: 'Confinement as a genuine size-dependent physical effect, and what an optically inferred size assumes', status: 'implemented', demand: 'unknown' },
  { slug: 'nano-in-electronics', question: 'Where do nanomaterials appear in electronics?', audience: 'Developer', contribution: 'Applications framing', status: 'duplicative', note: 'Owned by /knowledge/suppliers and the semiconductor process map; link instead of restating.', demand: 'unknown' },
  { slug: 'memristive-devices', question: 'How do nanoscale memory devices compute?', audience: 'Developer', contribution: 'Device physics for in-memory computing', status: 'duplicative', note: 'Owned by /knowledge/neuromorphic-biocomputing (in-memory and memristive computing).', demand: 'unknown' },
  { slug: 'nano-sensing', question: 'How do nanomaterial sensors work?', audience: 'Developer', contribution: 'Transduction and the selectivity trade-off; ownership split settled — surface transduction here, event-driven encoding in /knowledge/neuromorphic-biocomputing', status: 'implemented', demand: 'unknown' },
  { slug: 'energy-storage-claims', question: 'How do I read a battery or supercapacitor claim?', audience: 'Buyer, reviewer', contribution: 'The reporting items that must accompany a capacity figure', status: 'implemented', demand: 'unknown' },
  { slug: 'environmental-fate', question: 'What happens to these materials in the environment?', audience: 'Employer, policy reader', contribution: 'Fate and transformation as separate from hazard', status: 'blocked', note: 'Needs an OECD or EPA fate document read at section depth; OECD pages refused automated access.', demand: 'unknown' },
  { slug: 'standards-landscape', question: 'Which standards apply?', audience: 'Reviewer', contribution: 'What ISO/ASTM nanotechnology standards cover', status: 'blocked', note: 'Core vocabulary and method standards are paywalled; citing them unread would breach the evidence rule.', demand: 'unknown' },
  { slug: 'medical-nanomaterials', question: 'What about medical uses?', audience: 'General reader', contribution: 'Laboratory versus clinical versus approved', status: 'duplicative', note: 'Folded into /knowledge/nanotechnology/regulatory-status-is-not-safety rather than given its own route, to avoid implying clinical coverage Maha does not have.', demand: 'unknown' },
]
