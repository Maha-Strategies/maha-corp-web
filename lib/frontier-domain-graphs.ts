import {
  buildEpistemicGraphRecord,
  type EpistemicGraphDomainSlug,
} from './epistemic-graph-factory.ts'
import type {
  EpistemicDomain,
  EpistemicRecord,
  EpistemicRecordKind,
  EpistemicSource,
} from './epistemic-schema.ts'

export const FRONTIER_DOMAIN_BATCH_VERSION = 'frontier-domains/1.0' as const
export const FRONTIER_DOMAIN_BATCH_DATE = '2026-08-25' as const
export const FRONTIER_DOMAIN_RECORDS_PER_DOMAIN = 30 as const
export const FRONTIER_DOMAIN_BOUNDARY = 'These are immutable, noncanonical candidate records. They remain private and excluded from crawlable record routes, sitemap.xml, and llms.txt until exact-hash source, domain, boundary, and rights review is complete and a separate release authority promotes them.' as const

interface SourceSeed {
  key: string
  title: string
  authors: string[]
  publisher: string
  publishedAt?: string
  url: string
  doi?: string
  locator: string
  establishes: string
  boundary: string
}

interface DomainSeed {
  domain: EpistemicDomain & { slug: EpistemicGraphDomainSlug }
  concepts: readonly string[]
  sources: readonly SourceSeed[]
  /**
   * Per-concept source, keyed by concept slug.
   *
   * The default assignment below is positional: six sources are spread across
   * thirty concepts in blocks of five, so a record's source is whichever one
   * its index lands on rather than one chosen for its subject. That is workable
   * for a cohort whose members really do share a source, and wrong whenever a
   * concept's subject is not what its block source studies. An override names
   * the source that actually addresses the concept.
   */
  sourceOverrides?: Readonly<Record<string, SourceSeed>>
}

const recordKinds: readonly EpistemicRecordKind[] = ['concept', 'mechanism', 'method', 'measurement', 'comparison']

function titleCase(slug: string) {
  const acronyms: Record<string, string> = {
    aav: 'AAV', ald: 'ALD', ampk: 'AMPK', atp: 'ATP', bci: 'BCI', cas9: 'Cas9', cmos: 'CMOS', cvd: 'CVD', ecog: 'ECoG', euv: 'EUV', hbn: 'hBN', mcp: 'MCP', mos2: 'MoS₂', nad: 'NAD+', nif: 'NIF', nmn: 'NMN', nr: 'NR', rna: 'RNA', sae: 'SAE', sic: 'SiC', tmd: 'TMD', usgs: 'USGS', rebco: 'REBCO', lc3: 'LC3', pink1: 'PINK1', parps: 'PARPs', nampt: 'NAMPT', nmnat: 'NMNAT', mtor: 'mTOR', cd38: 'CD38', nd: 'Nd', fe: 'Fe', bm: 'B', io: 'IO', rf: 'RF', pag: 'PAG', trl: 'TRL',
  }
  return slug.split('-').map((word, index) => acronyms[word] ?? (index === 0 ? `${word[0].toUpperCase()}${word.slice(1)}` : word)).join(' ')
}

function source(domainSlug: EpistemicGraphDomainSlug, seed: SourceSeed): EpistemicSource {
  return {
    id: `source-${domainSlug}-${seed.key}`,
    title: seed.title,
    authors: seed.authors,
    publisher: seed.publisher,
    publishedAt: seed.publishedAt ?? '',
    ...(seed.publishedAt ? {} : {
      sourceChronology: {
        status: 'living-document' as const,
        accessedAt: FRONTIER_DOMAIN_BATCH_DATE,
        sourceVersion: `accessed-${FRONTIER_DOMAIN_BATCH_DATE}`,
      },
    }),
    url: seed.url,
    identifiers: seed.doi
      ? [{ scheme: 'doi' as const, value: seed.doi }]
      : [{ scheme: 'url' as const, value: seed.url }],
    exactLocator: seed.locator,
    rights: {
      basis: 'citation-with-paraphrase',
      quotationUsed: false,
      note: 'The candidate uses original boundary language and a short paraphrase linked to the cited source. No source passage, figure, or table is reproduced.',
    },
    establishes: seed.establishes,
    boundary: seed.boundary,
  }
}

function buildDomainRecords(seed: DomainSeed): EpistemicRecord[] {
  if (seed.concepts.length !== FRONTIER_DOMAIN_RECORDS_PER_DOMAIN) {
    throw new Error(`${seed.domain.slug} must contain exactly ${FRONTIER_DOMAIN_RECORDS_PER_DOMAIN} records.`)
  }
  if (seed.sources.length !== 6) throw new Error(`${seed.domain.slug} must contain exactly six source contracts.`)

  const rootId = `urn:maha:record:${seed.domain.slug}-${seed.concepts[0]}`
  return seed.concepts.map((conceptSlug, index) => {
    const slug = `${seed.domain.slug}-${conceptSlug}`
    const title = titleCase(conceptSlug)
    const kind = recordKinds[index % recordKinds.length]
    const citedSource = source(
      seed.domain.slug,
      seed.sourceOverrides?.[conceptSlug] ?? seed.sources[Math.floor(index / 5)],
    )
    const dependencies = index === 0 ? [] : [
      {
        targetId: `urn:maha:record:${seed.domain.slug}-${seed.concepts[index - 1]}`,
        statement: `${title} is positioned after ${titleCase(seed.concepts[index - 1])} in this bounded dependency sequence; the edge is navigational and does not assert equivalence or causation beyond the cited source scope.`,
      },
      ...(index % 5 === 0 ? [{
        targetId: rootId,
        bridgeType: 'strategic-dependency' as const,
        statement: `${title} is connected to the cohort root so source, measurement, and readiness boundaries can be traversed without collapsing them.`,
      }] : []),
    ]

    return buildEpistemicGraphRecord({
      domainSlug: seed.domain.slug,
      recordKind: kind,
      slug,
      title,
      description: `A source-bounded ${kind} record for ${title.toLowerCase()} within ${seed.domain.name.toLowerCase()}.`,
      summary: `${title} is represented as one reviewable unit in the ${seed.domain.name} graph. Its source, locator, scope, uncertainty, and prohibited inference remain attached to the claim rather than being generalized across the domain.`,
      statement: `The cited source supports treating ${title.toLowerCase()} as a distinct ${kind} within the stated ${seed.domain.name.toLowerCase()} scope.`,
      claimKind: kind === 'measurement' ? 'observation' : kind === 'comparison' ? 'empirical-claim' : 'theoretical-model',
      evidenceMaturity: 'single-study',
      scope: `Limited to ${citedSource.exactLocator} in “${citedSource.title}”; this candidate records the concept boundary and does not pool results from uncited systems or studies.`,
      boundary: `${title} does not by itself establish system-level performance, safety, manufacturability, scalability, economic advantage, clinical benefit, or deployment readiness.`,
      uncertainty: 'No cross-source quantitative interval is asserted. Definitions, operating conditions, samples, instruments, and outcome measures must be checked against the exact cited locator during review.',
      replication: 'Independent replication and cross-platform transfer have not been compiled for this candidate; the evidence maturity refers only to the bounded source contract.',
      source: citedSource,
      dependencies,
      prohibitedInference: `Do not use this ${title.toLowerCase()} record to claim that the surrounding technology is proven, safe, scalable, commercially available, or strategically superior.`,
    })
  })
}

const domainSeeds: readonly DomainSeed[] = [
  {
    domain: {
      slug: 'fusion-plasma-systems',
      name: 'Fusion and plasma systems',
      description: 'Confinement, magnets, plasma control, heat exhaust, fuel cycles, diagnostics, and inertial target systems separated by physical and engineering evidence state.',
      stressPoint: 'A plasma-physics result does not establish net electricity, component lifetime, tritium self-sufficiency, maintainability, or commercial plant economics.',
      accent: 'amber',
    },
    concepts: [
      'magnetic-confinement', 'tokamak-plasma-equilibrium', 'toroidal-field-coils', 'poloidal-field-coils', 'central-solenoid-inductive-drive',
      'plasma-position-and-shape-control', 'divertor-heat-exhaust', 'plasma-facing-components', 'edge-localized-modes', 'resonant-magnetic-perturbations',
      'disruption-mitigation', 'shattered-pellet-injection', 'plasma-heating-and-current-drive', 'neutral-beam-injection', 'electron-cyclotron-heating',
      'plasma-diagnostics', 'vacuum-vessel-boundary', 'tritium-fuel-cycle', 'breeding-blanket-test-modules', 'cryogenic-magnet-cooling',
      'cable-in-conduit-conductors', 'rebco-high-field-magnets', 'superconducting-quench-protection', 'stellarator-magnetic-coils', 'stellarator-field-optimization',
      'magnetic-mirror-confinement', 'inertial-confinement-target-chamber', 'laser-target-coupling', 'neutron-material-damage', 'remote-handling-maintenance',
    ],
    sources: [
      { key: 'iter-magnets', title: 'Magnets', authors: ['ITER Organization'], publisher: 'ITER Organization', url: 'https://www.iter.org/machine/magnets', locator: 'Machine / Magnets: toroidal field, poloidal field, central solenoid, and correction coil sections.', establishes: 'ITER documents the functions and architecture of the superconducting magnet systems used to confine and shape its plasma.', boundary: 'A machine design description is not operating evidence for a power plant or a commercial cost estimate.' },
      { key: 'iter-divertor', title: 'Making fusion work', authors: ['ITER Organization'], publisher: 'ITER Organization', url: 'https://www.iter.org/fusion-energy/making-it-work', locator: 'Sections describing plasma control, first wall, blanket, and divertor heat and particle exhaust.', establishes: 'ITER describes the engineering functions that surround and control a burning plasma, including heat exhaust and plasma-facing systems.', boundary: 'Design roles do not establish lifetime under every neutron and heat-load regime.' },
      { key: 'iter-disruption', title: 'Disruption mitigation', authors: ['ITER Organization'], publisher: 'ITER Organization', url: 'https://www.iter.org/machine/supporting-systems/disruption-mitigation', locator: 'System overview and shattered pellet injection sections.', establishes: 'ITER describes why plasma disruptions create machine loads and the intended role of shattered pellet injection in mitigation.', boundary: 'The page does not establish complete elimination of disruption risk or plant availability.' },
      { key: 'iter-support', title: 'Supporting systems', authors: ['ITER Organization'], publisher: 'ITER Organization', url: 'https://www.iter.org/machine/supporting-systems', locator: 'Heating and current drive, fuel cycle, vacuum, cryogenic, diagnostics, and tritium breeding system summaries.', establishes: 'ITER identifies the major supporting systems required to heat, diagnose, fuel, evacuate, and cool the experimental machine.', boundary: 'A system inventory is not evidence of integrated commercial operation.' },
      { key: 'stellarator-review', title: 'Stellarators as a fast path to fusion', authors: ['Allen H. Boozer'], publisher: 'Nuclear Fusion', publishedAt: '2021-08-01', url: 'https://doi.org/10.1088/1741-4326/ac170f', doi: '10.1088/1741-4326/ac170f', locator: 'Sections on magnetic-field design, coils, confinement, and reactor implications.', establishes: 'The review analyzes stellarator magnetic geometry and engineering questions for fusion systems.', boundary: 'A proposed path and modeled configuration do not establish a built commercial reactor.' },
      { key: 'nif-ignition', title: 'Achieving Fusion Ignition', authors: ['Lawrence Livermore National Laboratory'], publisher: 'National Ignition Facility and Photon Science', url: 'https://lasers.llnl.gov/science/achieving-fusion-ignition', locator: 'Target, laser coupling, target chamber, ignition, and experimental result sections.', establishes: 'LLNL describes the inertial-confinement target and laser system used in NIF ignition experiments.', boundary: 'Target gain in an experiment is not net electric output, repetition-rate operation, component lifetime, or commercial readiness.' },
    ],
  },
  {
    domain: {
      slug: 'advanced-materials',
      name: 'Advanced materials',
      description: 'Two-dimensional materials, moiré systems, topological phases, wide-bandgap substrates, interfaces, fabrication, and metrology under specimen-specific contracts.',
      stressPoint: 'A property observed in one flake, stack, temperature range, or device geometry cannot be transferred to wafer-scale yield or product performance.',
      accent: 'violet',
    },
    concepts: [
      'graphene-monolayers', 'hexagonal-boron-nitride-dielectrics', 'graphene-hbn-heterostructures', 'moire-superlattices', 'twist-angle-control',
      'correlated-insulating-states', 'magic-angle-superconductivity', 'tmd-monolayers', 'direct-gap-mos2', 'valley-polarized-excitons',
      'tmd-heterobilayers', 'interlayer-excitons', 'topological-insulator-surface-states', 'spin-momentum-locking', 'quantum-anomalous-hall-state',
      'two-dimensional-magnetism', 'van-der-waals-assembly', 'dry-transfer-contamination', 'interface-bubbles-and-strain', 'encapsulation-boundaries',
      'contact-resistance-in-2d-devices', 'dielectric-screening', 'wafer-scale-2d-growth', 'cvd-graphene-grain-boundaries', 'materials-metrology-transfer',
      'diamond-wafer-substrates', 'diamond-thermal-conductivity', 'color-centers-in-diamond', 'sic-wide-bandgap-substrates', 'gallium-nitride-epitaxy',
    ],
    sources: [
      { key: 'graphene', title: 'Electric Field Effect in Atomically Thin Carbon Films', authors: ['K. S. Novoselov', 'A. K. Geim', 'S. V. Morozov', 'et al.'], publisher: 'Science', publishedAt: '2004-10-22', url: 'https://doi.org/10.1126/science.1102896', doi: '10.1126/science.1102896', locator: 'Abstract, device preparation, transport measurements, and figures 1–3.', establishes: 'The paper reports electric-field effects and transport measurements in atomically thin carbon films.', boundary: 'Exfoliated-device observations do not establish wafer-scale manufacturing yield.' },
      { key: 'magic-angle', title: 'Unconventional superconductivity in magic-angle graphene superlattices', authors: ['Yuan Cao', 'Valla Fatemi', 'Shi Fang', 'et al.'], publisher: 'Nature', publishedAt: '2018-03-05', url: 'https://doi.org/10.1038/nature26160', doi: '10.1038/nature26160', locator: 'Abstract, device description, phase diagram, transport measurements, and Methods.', establishes: 'The paper reports correlated and superconducting transport behavior in specified twisted bilayer graphene devices.', boundary: 'Device-specific low-temperature transport does not establish robust room-temperature behavior or scalable fabrication.' },
      { key: 'tmd', title: 'Atomically Thin MoS2: A New Direct-Gap Semiconductor', authors: ['Kin Fai Mak', 'Changgu Lee', 'James Hone', 'Jie Shan', 'Tony F. Heinz'], publisher: 'Physical Review Letters', publishedAt: '2010-09-24', url: 'https://doi.org/10.1103/PhysRevLett.105.136805', doi: '10.1103/PhysRevLett.105.136805', locator: 'Abstract and photoluminescence measurements comparing bulk, few-layer, and monolayer MoS2.', establishes: 'The paper reports the transition to direct-gap optical behavior in monolayer MoS2 under the measured conditions.', boundary: 'Optical measurements do not establish device yield, contact quality, or integrated-system performance.' },
      { key: 'topological', title: 'Colloquium: Topological insulators', authors: ['M. Z. Hasan', 'C. L. Kane'], publisher: 'Reviews of Modern Physics', publishedAt: '2010-11-08', url: 'https://doi.org/10.1103/RevModPhys.82.3045', doi: '10.1103/RevModPhys.82.3045', locator: 'Sections II–V on topology, surface states, spin texture, and material realizations.', establishes: 'The review defines topological-insulator phases and connects their invariants to boundary-state observations.', boundary: 'A phase classification does not establish defect-free materials or application readiness.' },
      { key: 'vdw', title: 'Van der Waals heterostructures', authors: ['A. K. Geim', 'I. V. Grigorieva'], publisher: 'Nature', publishedAt: '2013-07-24', url: 'https://doi.org/10.1038/nature12385', doi: '10.1038/nature12385', locator: 'Assembly, interfaces, device examples, and outlook sections.', establishes: 'The review describes stacking atomically thin crystals into heterostructures and the interface-controlled opportunities and constraints.', boundary: 'Laboratory assembly examples do not establish contamination-free high-volume production.' },
      { key: 'wide-bandgap', title: 'An assessment of wide bandgap semiconductors for power devices', authors: ['Jerry L. Hudgins', 'Grigory S. Simin', 'Enrico Santi', 'M. Asif Khan'], publisher: 'IEEE Transactions on Power Electronics', publishedAt: '2003-05-01', url: 'https://doi.org/10.1109/TPEL.2003.810840', doi: '10.1109/TPEL.2003.810840', locator: 'Pages 907–914: material-property comparison and SiC, GaN, and diamond power-device sections.', establishes: 'The paper compares material properties and device considerations for wide-bandgap semiconductors in power applications.', boundary: 'Intrinsic material properties do not determine wafer quality, epitaxial defect density, package reliability, or cost.' },
    ],
    sourceOverrides: {
      // The positional block source for this concept is the 2004 atomically
      // thin carbon paper, which measures graphene and never mentions boron
      // nitride. Dean et al. is the study that actually puts hBN under a
      // device and reports what that changes.
      'hexagonal-boron-nitride-dielectrics': {
        key: 'hbn-substrates',
        title: 'Boron nitride substrates for high-quality graphene electronics',
        authors: ['C. R. Dean', 'A. F. Young', 'I. Meric', 'C. Lee', 'L. Wang', 'S. Sorgenfrei', 'K. Watanabe', 'T. Taniguchi', 'P. Kim', 'K. L. Shepard', 'J. Hone'],
        publisher: 'Nature Nanotechnology',
        publishedAt: '2010-08-22',
        url: 'https://doi.org/10.1038/nnano.2010.172',
        doi: '10.1038/nnano.2010.172',
        locator: 'Abstract: fabrication and characterization of exfoliated mono- and bilayer graphene on single-crystal hexagonal boron nitride substrates.',
        establishes: 'The study reports devices built on single-crystal hexagonal boron nitride substrates and the device-quality differences observed relative to silicon dioxide.',
        boundary: 'Substrate-supported device measurements do not establish a dielectric constant, a breakdown field, or wafer-scale manufacturability for boron nitride.',
      },
    },
  },
  {
    domain: {
      slug: 'biomolecular-engineering',
      name: 'Biomolecular engineering',
      description: 'Protein design, directed evolution, cell-free expression, RNA control, enzyme cascades, and assay provenance separated by experimental system.',
      stressPoint: 'A computational design or in-vitro assay result does not establish folding, function, delivery, organism-level safety, or therapeutic benefit.',
      accent: 'green',
    },
    concepts: [
      'protein-backbone-diffusion', 'unconditional-protein-generation', 'motif-scaffolding', 'de-novo-binder-design', 'structure-prediction-filtering',
      'sequence-design-with-proteinmpnn', 'experimental-fold-validation', 'protein-design-success-rate', 'off-target-binding-characterization', 'design-to-assay-provenance',
      'directed-enzyme-evolution', 'mutation-library-generation', 'selection-pressure-coupling', 'phage-assisted-continuous-evolution', 'fitness-landscape-accessibility',
      'cell-free-transcription-translation', 'crude-extract-cell-free-systems', 'purified-component-expression-systems', 'energy-regeneration-in-cell-free-systems', 'cell-free-reaction-yield',
      'synthetic-riboswitches', 'ligand-binding-aptamer-domains', 'riboswitch-expression-platforms', 'toehold-switches', 'rna-strand-displacement',
      'translational-control-circuits', 'metabolic-pathway-prototyping', 'enzyme-cascade-engineering', 'compartmentalized-cell-free-systems', 'droplet-microfluidic-screening',
    ],
    sources: [
      { key: 'rfdiffusion', title: 'De novo design of protein structure and function with RFdiffusion', authors: ['Joseph L. Watson', 'David Juergens', 'Nathaniel R. Bennett', 'et al.'], publisher: 'Nature', publishedAt: '2023-07-11', url: 'https://doi.org/10.1038/s41586-023-06415-8', doi: '10.1038/s41586-023-06415-8', locator: 'Abstract; unconditional generation, motif scaffolding, binder design, Methods, and Extended Data.', establishes: 'The study reports diffusion-based generation and experimental tests for specified protein-design tasks.', boundary: 'Reported task success does not establish universal folding, binding, safety, or therapeutic function.' },
      { key: 'proteinmpnn', title: 'Robust deep learning–based protein sequence design using ProteinMPNN', authors: ['Justas Dauparas', 'Ivan Anishchenko', 'Nathaniel Bennett', 'et al.'], publisher: 'Science', publishedAt: '2022-10-07', url: 'https://doi.org/10.1126/science.add2187', doi: '10.1126/science.add2187', locator: 'Sequence-design method, benchmark comparisons, experimental validation, and supplementary methods.', establishes: 'The study evaluates a neural sequence-design method on specified benchmark and experimental tasks.', boundary: 'Benchmark and selected validation results do not establish universal sequence fitness or deployment suitability.' },
      { key: 'pace', title: 'A system for the continuous directed evolution of biomolecules', authors: ['Kevin M. Esvelt', 'Jacob C. Carlson', 'David R. Liu'], publisher: 'Nature', publishedAt: '2011-04-10', url: 'https://doi.org/10.1038/nature09929', doi: '10.1038/nature09929', locator: 'PACE architecture, selection coupling, mutation, experiments, and Methods.', establishes: 'The paper introduces phage-assisted continuous evolution and demonstrates specified selection-coupled evolution experiments.', boundary: 'A selection system does not guarantee access to every fitness landscape or safe use outside its experimental containment.' },
      { key: 'cell-free', title: 'Cell-free synthetic biology: Engineering in an open world', authors: ['Yuan Lu'], publisher: 'Synthetic and Systems Biotechnology', publishedAt: '2017-03-01', url: 'https://doi.org/10.1016/j.synbio.2017.02.003', doi: '10.1016/j.synbio.2017.02.003', locator: 'Cell-free platform, protein engineering, metabolic engineering, artificial-cell engineering, and conclusions sections.', establishes: 'The review describes cell-free synthetic-biology platforms and engineering variables exposed outside intact cells.', boundary: 'In-vitro expression yield does not establish cellular, organismal, manufacturing, or clinical performance.' },
      { key: 'riboregulators', title: 'Engineered riboregulators enable post-transcriptional control of gene expression', authors: ['Farren J. Isaacs', 'David J. Dwyer', 'James J. Collins'], publisher: 'Nature Biotechnology', publishedAt: '2004-07-11', url: 'https://doi.org/10.1038/nbt986', doi: '10.1038/nbt986', locator: 'Riboregulator design, experiments, figures, and Methods.', establishes: 'The study reports engineered RNA components that regulate translation in specified cellular experiments.', boundary: 'A circuit demonstration does not establish portability across hosts, contexts, or applications.' },
      { key: 'toehold', title: 'Paper-based synthetic gene networks', authors: ['Keith Pardee', 'Alex A. Green', 'Tom Ferrante', 'et al.'], publisher: 'Cell', publishedAt: '2014-11-06', url: 'https://doi.org/10.1016/j.cell.2014.10.004', doi: '10.1016/j.cell.2014.10.004', locator: 'Toehold-switch design, cell-free implementation, freeze-drying, assays, and Methods.', establishes: 'The study demonstrates RNA toehold switches in specified cell-free paper-based assays.', boundary: 'A proof-of-concept assay does not establish clinical diagnostic accuracy, regulatory approval, or scaled manufacturing.' },
    ],
  },
  {
    domain: {
      slug: 'longevity-metabolism',
      name: 'Longevity and metabolism',
      description: 'Autophagy, mitochondrial respiration, senescence, NAD+ metabolism, nutrient sensing, and intervention endpoints with assay-specific boundaries.',
      stressPoint: 'A molecular marker, cell assay, or animal lifespan result cannot be silently converted into a human healthspan or treatment claim.',
      accent: 'amber',
    },
    concepts: [
      'autophagosome-abundance', 'autophagic-flux', 'lysosomal-degradation-blockade', 'lc3-turnover-assays', 'p62-sqstm1-turnover',
      'mitophagy-flux', 'pink1-parkin-pathway', 'mitochondrial-membrane-potential', 'proton-leak-respiration', 'mitochondrial-uncoupling',
      'oxygen-consumption-rate', 'atp-linked-respiration', 'metabolic-flux-tracing', 'ampk-energy-sensing', 'insulin-mtor-signaling',
      'cellular-senescence-markers', 'senescence-associated-secretory-phenotype', 'senolytic-selectivity', 'apoptosis-in-senescent-cells', 'senescent-cell-clearance',
      'nad-salvage-pathway', 'nampt-rate-limiting-step', 'nmnat-compartmentalization', 'nmn-and-nr-precursors', 'nad-consumption-by-parps',
      'sirtuin-nad-dependence', 'cd38-nad-consumption', 'intervention-biomarker-boundaries', 'lifespan-versus-healthspan-endpoints', 'translation-to-human-outcomes',
    ],
    sources: [
      { key: 'autophagy-guidelines', title: 'Guidelines for the use and interpretation of assays for monitoring autophagy', authors: ['Daniel J. Klionsky', 'et al.'], publisher: 'Autophagy', publishedAt: '2012-04-01', url: 'https://pubmed.ncbi.nlm.nih.gov/22966490/', doi: '10.4161/auto.19496', locator: 'Assay interpretation sections for LC3, SQSTM1/p62, lysosomal inhibition, and autophagic flux.', establishes: 'The guidelines distinguish static autophagosome measurements from dynamic flux and describe assay-specific interpretation limits.', boundary: 'No single marker establishes autophagy rate, organismal benefit, or a longevity outcome.' },
      { key: 'mitophagy', title: 'Mechanisms of mitophagy', authors: ['Richard J. Youle', 'Derek P. Narendra'], publisher: 'Nature Reviews Molecular Cell Biology', publishedAt: '2011-01-01', url: 'https://doi.org/10.1038/nrm3028', doi: '10.1038/nrm3028', locator: 'PINK1–Parkin pathway, mitochondrial damage sensing, and mitophagy mechanism sections.', establishes: 'The review describes molecular mechanisms implicated in selective mitochondrial turnover.', boundary: 'Pathway description does not establish a safe or effective human longevity intervention.' },
      { key: 'bioenergetics', title: 'Analysis and interpretation of microplate-based oxygen consumption and pH data', authors: ['Ajit S. Divakaruni', 'Alexander Paradyse', 'David A. Ferrick', 'Anne N. Murphy', 'Martin Jastroch'], publisher: 'Methods in Enzymology', publishedAt: '2014-01-01', url: 'https://doi.org/10.1016/B978-0-12-801415-8.00016-3', doi: '10.1016/B978-0-12-801415-8.00016-3', locator: 'Chapter 16, pages 309–354: oxygen-consumption rate, data analysis, normalization, controls, and extracellular-pH interpretation.', establishes: 'The chapter provides an experimental and analytical framework for interpreting microplate oxygen-consumption and extracellular-pH measurements.', boundary: 'Assay-derived respiration components are protocol- and cell-context-specific and do not establish health outcomes.' },
      { key: 'senolytics', title: 'The Achilles’ heel of senescent cells: from transcriptome to senolytic drugs', authors: ['Yi Zhu', 'Tamara Tchkonia', 'Tamar Pirtskhalava', 'et al.'], publisher: 'Aging Cell', publishedAt: '2015-01-01', url: 'https://doi.org/10.1111/acel.12344', doi: '10.1111/acel.12344', locator: 'Senescent-cell survival pathways, compound screening, cell assays, and mouse experiments.', establishes: 'The study identifies candidate senolytic vulnerabilities and reports cell- and animal-model experiments for specified compounds.', boundary: 'Preclinical selectivity and clearance results do not establish human safety, dosing, efficacy, or lifespan extension.' },
      { key: 'nad', title: 'NAD+ metabolism and its roles in cellular processes during ageing', authors: ['Anthony J. Covarrubias', 'Rosalba Perrone', 'Alessia Grozio', 'Eric Verdin'], publisher: 'Nature Reviews Molecular Cell Biology', publishedAt: '2020-12-22', url: 'https://doi.org/10.1038/s41580-020-00313-x', doi: '10.1038/s41580-020-00313-x', locator: 'NAD+ biosynthesis and consumption, NAD+-dependent mechanisms in ageing, therapeutic targeting, figures 1–4, and supplementary boxes.', establishes: 'The review maps major NAD+ synthesis and consumption pathways and their reported relationships with ageing biology.', boundary: 'Pathway associations and model-organism interventions do not establish benefit from a human supplement or treatment.' },
      { key: 'hallmarks', title: 'Hallmarks of Aging: An Expanding Universe', authors: ['Carlos López-Otín', 'Maria A. Blasco', 'Linda Partridge', 'Manuel Serrano', 'Guido Kroemer'], publisher: 'Cell', publishedAt: '2023-01-19', url: 'https://doi.org/10.1016/j.cell.2022.11.001', doi: '10.1016/j.cell.2022.11.001', locator: 'Nutrient sensing, mitochondrial dysfunction, cellular senescence, biomarkers, and intervention framework.', establishes: 'The review organizes ageing mechanisms and discusses evidence across model systems and human observations.', boundary: 'A conceptual hallmark framework does not validate a diagnostic, predict individual lifespan, or prove an intervention.' },
    ],
  },
  {
    domain: {
      slug: 'neurotechnology-bci',
      name: 'Neurotechnology and BCI',
      description: 'Neural probes, cortical arrays, optical control, decoding, stimulation, chronic interfaces, telemetry, and translation constraints.',
      stressPoint: 'A decoding result in a named participant, task, session, implant, or animal model does not establish durable general-purpose communication or clinical benefit.',
      accent: 'violet',
    },
    concepts: [
      'neuropixels-cmos-probe', 'neuropixels-recording-sites', 'neuropixels-channel-selection', 'extracellular-spike-recording', 'spike-sorting-boundaries',
      'micro-ecog-arrays', 'electrocorticography-spatial-resolution', 'flexible-conformal-electrode-arrays', 'electrode-tissue-interface', 'impedance-and-noise',
      'optogenetic-channelrhodopsin', 'channelrhodopsin-photocurrent-kinetics', 'opsin-spectral-sensitivity', 'light-delivery-tissue-heating', 'stimulation-artifact-rejection',
      'closed-loop-neural-decoding', 'decoder-update-latency', 'sensing-to-stimulation-loop', 'neural-feature-extraction', 'adaptive-stimulation-policies',
      'intracortical-bci', 'cortical-surface-bci', 'peripheral-nerve-interface', 'motor-intention-decoding', 'bci-calibration-drift',
      'chronic-signal-stability', 'foreign-body-response', 'wireless-neural-telemetry', 'neural-data-compression', 'clinical-translation-boundaries',
    ],
    sources: [
      { key: 'neuropixels', title: 'Fully integrated silicon probes for high-density recording of neural activity', authors: ['James J. Jun', 'Nicholas A. Steinmetz', 'Joshua H. Siegle', 'et al.'], publisher: 'Nature', publishedAt: '2017-11-08', url: 'https://doi.org/10.1038/nature24636', doi: '10.1038/nature24636', locator: 'Probe architecture, recording sites, channel selection, noise, recordings, and Methods.', establishes: 'The paper reports the Neuropixels silicon-probe architecture and specified high-density neural recordings.', boundary: 'Probe capability does not establish perfect unit identity, chronic stability, or clinical suitability.' },
      { key: 'micro-ecog', title: 'Flexible, foldable, actively multiplexed, high-density electrode array for mapping brain activity in vivo', authors: ['Jonathan Viventi', 'Dae-Hyeong Kim', 'Jon D. Moss', 'et al.'], publisher: 'Nature Neuroscience', publishedAt: '2011-11-13', url: 'https://doi.org/10.1038/nn.2973', doi: '10.1038/nn.2973', locator: 'Array architecture, conformal placement, multiplexing, in-vivo mapping, and Methods.', establishes: 'The study reports a flexible high-density cortical electrode array and animal-model recordings.', boundary: 'An acute or model-system demonstration does not establish long-term human safety or clinical efficacy.' },
      { key: 'channelrhodopsin', title: 'Millisecond-timescale, genetically targeted optical control of neural activity', authors: ['Edward S. Boyden', 'Feng Zhang', 'Ernst Bamberg', 'Georg Nagel', 'Karl Deisseroth'], publisher: 'Nature Neuroscience', publishedAt: '2005-08-14', url: 'https://doi.org/10.1038/nn1525', doi: '10.1038/nn1525', locator: 'Channelrhodopsin expression, photocurrent, optical stimulation, spike timing, and Methods.', establishes: 'The study demonstrates genetically targeted optical activation in specified cultured-neuron experiments.', boundary: 'Cell-culture control does not establish delivery safety, tissue-scale light delivery, chronic stability, or clinical benefit.' },
      { key: 'closed-loop', title: 'Closed-loop deep brain stimulation is superior in ameliorating parkinsonism', authors: ['Boris Rosin', 'Maya Slovik', 'Rea Mitelman', 'et al.'], publisher: 'Neuron', publishedAt: '2011-10-20', url: 'https://doi.org/10.1016/j.neuron.2011.08.023', doi: '10.1016/j.neuron.2011.08.023', locator: 'Closed-loop detection, stimulation timing, MPTP primate model, outcome comparisons, figures, and experimental procedures.', establishes: 'The study compares closed-loop and continuous stimulation in a specified primate model and protocol.', boundary: 'A model- and protocol-specific result does not establish superiority for all disorders, devices, endpoints, or patients.' },
      { key: 'intracortical-bci', title: 'Neuronal ensemble control of prosthetic devices by a human with tetraplegia', authors: ['Leigh R. Hochberg', 'Mijail D. Serruya', 'Gerhard M. Friehs', 'et al.'], publisher: 'Nature', publishedAt: '2006-07-13', url: 'https://doi.org/10.1038/nature04970', doi: '10.1038/nature04970', locator: 'Participant, implant, decoding tasks, performance measures, and Methods.', establishes: 'The study reports intracortical neural decoding and device-control tasks in a named clinical research context.', boundary: 'A participant- and task-specific demonstration does not establish durable general-purpose performance or broad clinical benefit.' },
      { key: 'foreign-body', title: 'Response of brain tissue to chronically implanted neural electrodes', authors: ['Vera S. Polikov', 'Patrick A. Tresco', 'William M. Reichert'], publisher: 'Journal of Neuroscience Methods', publishedAt: '2005-10-15', url: 'https://doi.org/10.1016/j.jneumeth.2005.08.015', doi: '10.1016/j.jneumeth.2005.08.015', locator: 'Tissue response, electrode materials, chronic recording stability, and design-factor sections.', establishes: 'The review describes biological responses and engineering variables associated with chronically implanted neural electrodes.', boundary: 'General tissue-response mechanisms do not predict the safety or lifetime of a particular implant in a particular person.' },
    ],
    sourceOverrides: {
      // The positional block source for this concept is the Neuropixels probe
      // paper, which reports instrumentation rather than the sorting step. Hill
      // et al. is about the errors sorting actually makes, which is what a
      // boundary record needs.
      'spike-sorting-boundaries': {
        key: 'spike-sorting-quality-metrics',
        title: 'Quality Metrics to Accompany Spike Sorting of Extracellular Signals',
        authors: ['Daniel N. Hill', 'Samar B. Mehta', 'David Kleinfeld'],
        publisher: 'Journal of Neuroscience',
        publishedAt: '2011-06-15',
        url: 'https://doi.org/10.1523/JNEUROSCI.0971-11.2011',
        doi: '10.1523/JNEUROSCI.0971-11.2011',
        locator: 'Quality metrics and Summary matrices sections: false-positive and false-negative error estimates from refractory-period violations, detection threshold, cluster overlap, and censored events.',
        establishes: 'The paper defines quantitative false-positive and false-negative error estimates for sorted units and argues they should be reported instead of an unquantified claim of good isolation.',
        boundary: 'Error metrics quantify sorting quality for a given dataset and do not establish that any particular unit is a single neuron or is stable across sessions.',
      },
    },
  },
  {
    domain: {
      slug: 'mechanistic-interpretability',
      name: 'Mechanistic interpretability',
      description: 'Features, circuits, interventions, sparse representations, causal tests, and faithfulness criteria represented separately from explanatory confidence.',
      stressPoint: 'A human-readable feature label, probe, attention pattern, or ablation effect does not by itself establish a complete or faithful causal explanation.',
      accent: 'blue',
    },
    concepts: [
      'neural-feature-superposition', 'polysemantic-neurons', 'toy-models-of-superposition', 'superposition-geometry', 'representation-probing-boundary',
      'sparse-autoencoder-dictionaries', 'sae-encoder-decoder', 'sae-sparsity-fidelity-tradeoff', 'feature-splitting', 'feature-absorption',
      'dead-features', 'feature-activation-maximization', 'automated-feature-interpretation', 'causal-feature-intervention', 'cross-layer-transcoders',
      'induction-head-circuits', 'previous-token-heads', 'in-context-learning-circuits', 'attention-pattern-evidence', 'io-identification-circuit',
      'activation-patching', 'path-patching', 'causal-scrubbing', 'interchange-interventions', 'model-component-ablation',
      'circuit-completeness', 'circuit-faithfulness', 'mechanistic-anomaly-detection', 'benchmark-task-transfer', 'interpretability-claim-boundaries',
    ],
    sources: [
      { key: 'superposition', title: 'Toy Models of Superposition', authors: ['Nelson Elhage', 'Tristan Hume', 'Catherine Olsson', 'et al.'], publisher: 'Transformer Circuits Thread', publishedAt: '2022-09-14', url: 'https://transformer-circuits.pub/2022/toy_model/index.html', locator: 'Definitions, toy models, geometry, sparsity, and feature-interference experiments.', establishes: 'The work develops toy models in which neural networks represent more features than available dimensions under specified sparsity conditions.', boundary: 'A toy-model mechanism does not establish that every feature in a production model has the same geometry or semantics.' },
      { key: 'sae', title: 'Sparse Autoencoders Find Highly Interpretable Features in Language Models', authors: ['Hoagy Cunningham', 'Aidan Ewart', 'Logan Riggs', 'Robert Huben', 'Lee Sharkey'], publisher: 'arXiv', publishedAt: '2023-09-15', url: 'https://arxiv.org/abs/2309.08600', locator: 'Method, reconstruction and sparsity objectives, experiments, feature analysis, and limitations.', establishes: 'The paper trains sparse autoencoders on language-model activations and evaluates specified reconstruction, sparsity, and interpretability properties.', boundary: 'Sparse features and human labels do not establish completeness, unique decomposition, or causal faithfulness.' },
      { key: 'feature-visualization', title: 'Feature Visualization', authors: ['Chris Olah', 'Alexander Mordvintsev', 'Ludwig Schubert'], publisher: 'Distill', publishedAt: '2017-11-07', url: 'https://doi.org/10.23915/distill.00007', doi: '10.23915/distill.00007', locator: 'Optimization objectives, regularization, visualization techniques, and interpretation cautions.', establishes: 'The article systematizes optimization-based feature visualization methods and their artifacts.', boundary: 'An optimized input is evidence about an objective response, not a complete natural-language explanation of model behavior.' },
      { key: 'induction', title: 'In-context Learning and Induction Heads', authors: ['Catherine Olsson', 'Nelson Elhage', 'Neel Nanda', 'et al.'], publisher: 'Transformer Circuits Thread', publishedAt: '2022-03-22', url: 'https://transformer-circuits.pub/2022/in-context-learning-and-induction-heads/index.html', locator: 'Induction-head definition, previous-token heads, training dynamics, interventions, and model scope.', establishes: 'The work reports circuits and interventions associated with induction-like behavior in specified transformer models.', boundary: 'Observed circuits in studied models do not establish a universal account of in-context learning.' },
      { key: 'causal-scrubbing', title: 'Causal Scrubbing: a method for rigorously testing interpretability hypotheses', authors: ['Lawrence Chan', 'Adrià Garriga-Alonso', 'Nicholas Goldowsky-Dill', 'et al.'], publisher: 'Alignment Research Center', publishedAt: '2022-12-06', url: 'https://www.alignmentforum.org/posts/JvZhhzycHu2Yd57RN/causal-scrubbing-a-method-for-rigorously-testing', locator: 'Method definition, correspondence, resampling interventions, examples, and limitations.', establishes: 'The work proposes resampling-based tests for whether a hypothesized computational graph preserves behavior under declared interventions.', boundary: 'Passing a declared test does not prove the hypothesis is unique, complete, or semantically correct.' },
      { key: 'circuits', title: 'A Mathematical Framework for Transformer Circuits', authors: ['Nelson Elhage', 'Neel Nanda', 'Catherine Olsson', 'et al.'], publisher: 'Transformer Circuits Thread', publishedAt: '2021-12-22', url: 'https://transformer-circuits.pub/2021/framework/index.html', locator: 'Residual-stream decomposition, attention-head composition, path expansion, and limitations.', establishes: 'The work introduces a mathematical decomposition for analyzing specified transformer components and paths.', boundary: 'A decomposition framework does not by itself identify the causal circuit for a task or establish model-wide explanation.' },
    ],
  },
  {
    domain: {
      slug: 'agentic-systems-mcp',
      name: 'Agentic systems and MCP',
      description: 'Tool protocols, capability boundaries, sandboxing, context degradation, coordination, deadlock, memory, injection, and evaluation traces.',
      stressPoint: 'A successful tool call or benchmark trajectory does not establish least authority, resistance to prompt injection, reliable coordination, or safe autonomous operation.',
      accent: 'green',
    },
    concepts: [
      'mcp-client-server-roles', 'mcp-capability-negotiation', 'mcp-tool-discovery', 'mcp-tool-input-schemas', 'mcp-tool-result-contracts',
      'mcp-resource-discovery', 'mcp-prompt-templates', 'mcp-session-lifecycle', 'tool-allowlisting', 'tool-deny-by-default',
      'least-authority-tokens', 'sandboxed-tool-execution', 'tool-call-traces', 'idempotent-tool-calls', 'tool-timeout-budgets',
      'human-approval-boundaries', 'context-window-position-effects', 'context-window-token-degradation', 'retrieval-context-selection', 'tool-result-context-injection',
      'agent-plan-execution-separation', 'multi-agent-role-assignment', 'multi-agent-coordination-protocols', 'multi-agent-deadlock', 'distributed-agent-consensus',
      'game-theoretic-incentive-misalignment', 'agent-memory-boundaries', 'prompt-injection-through-tools', 'tool-output-trust-boundaries', 'agentic-evaluation-protocols',
    ],
    sources: [
      { key: 'mcp-tools', title: 'Model Context Protocol specification: Tools', authors: ['Model Context Protocol contributors'], publisher: 'Model Context Protocol', url: 'https://modelcontextprotocol.io/specification/draft/server/tools', locator: 'Tool discovery, input schemas, calls, results, error handling, and security considerations.', establishes: 'The specification defines protocol roles and message contracts for discovering and invoking server-exposed tools.', boundary: 'Protocol conformance does not establish that a tool is safe, correctly authorized, idempotent, or resistant to malicious inputs.' },
      { key: 'mcp-core', title: 'Model Context Protocol specification', authors: ['Model Context Protocol contributors'], publisher: 'Model Context Protocol', publishedAt: '2024-11-05', url: 'https://modelcontextprotocol.io/specification/2024-11-05/index', locator: 'Architecture, lifecycle, capabilities, resources, prompts, and security sections.', establishes: 'The specification defines client, server, and host roles and capability-negotiated protocol primitives.', boundary: 'A protocol primitive does not prescribe an organization’s allowlist, identity, retention, or approval policy.' },
      { key: 'nist-genai', title: 'Artificial Intelligence Risk Management Framework: Generative Artificial Intelligence Profile', authors: ['Chloe Autio', 'Reva Schwartz', 'Jesse Dunietz', 'Shomik Jain', 'Martin Stanley', 'Elham Tabassi', 'Patrick Hall', 'Kamie Roberts'], publisher: 'National Institute of Standards and Technology', publishedAt: '2024-07-26', url: 'https://www.nist.gov/publications/artificial-intelligence-risk-management-framework-generative-artificial-intelligence', doi: '10.6028/NIST.AI.600-1', locator: 'NIST AI 600-1: Generative AI risks and suggested actions across Govern, Map, Measure, and Manage; appendices A and B.', establishes: 'The profile identifies risk-management practices applicable to generative-AI systems and their operational dependencies.', boundary: 'A risk framework does not prove a particular agent or sandbox is secure.' },
      { key: 'lost-middle', title: 'Lost in the Middle: How Language Models Use Long Contexts', authors: ['Nelson F. Liu', 'Kevin Lin', 'John Hewitt', 'et al.'], publisher: 'Transactions of the Association for Computational Linguistics', publishedAt: '2024-01-01', url: 'https://doi.org/10.1162/tacl_a_00638', doi: '10.1162/tacl_a_00638', locator: 'Long-context experiments, position effects, retrieval and question-answering tasks, and limitations.', establishes: 'The study reports position-dependent performance on specified long-context tasks and models.', boundary: 'Benchmark position effects do not define a universal token limit or predict every model and workflow.' },
      { key: 'react', title: 'ReAct: Synergizing Reasoning and Acting in Language Models', authors: ['Shunyu Yao', 'Jeffrey Zhao', 'Dian Yu', 'et al.'], publisher: 'International Conference on Learning Representations', publishedAt: '2023-05-01', url: 'https://arxiv.org/abs/2210.03629', locator: 'Reasoning/action trajectory format, task experiments, prompting setup, and error analysis.', establishes: 'The paper evaluates interleaved reasoning and external actions on specified benchmark environments.', boundary: 'Benchmark gains do not establish safe autonomous execution, truthful traces, or robust tool authorization.' },
      { key: 'autogen', title: 'AutoGen: Enabling Next-Gen LLM Applications via Multi-Agent Conversation', authors: ['Qingyun Wu', 'Gagan Bansal', 'Jieyu Zhang', 'et al.'], publisher: 'arXiv', publishedAt: '2023-08-16', url: 'https://arxiv.org/abs/2308.08155', locator: 'Agent roles, conversation patterns, implementation, applications, and limitations.', establishes: 'The paper describes a framework for composing multiple conversable agents and reports example workflows.', boundary: 'A coordination framework does not establish convergence, deadlock freedom, incentive compatibility, or production safety.' },
    ],
  },
  {
    domain: {
      slug: 'critical-supply-chains',
      name: 'Critical supply chains',
      description: 'Mineral occurrence, refining, precursor chemistry, material substitution, trade concentration, controls, and data uncertainty represented by stage.',
      stressPoint: 'Resource abundance, mine output, refining capacity, trade share, and qualified semiconductor supply are different quantities and cannot be silently substituted.',
      accent: 'amber',
    },
    concepts: [
      'high-purity-quartz-deposits', 'quartz-crucible-manufacturing', 'semiconductor-grade-polysilicon', 'euv-photoresist-precursors', 'photoacid-generator-supply',
      'fluorinated-resist-components', 'gallium-bauxite-byproduct-flow', 'gallium-zinc-processing-byproduct', 'germanium-zinc-refining-flow', 'germanium-coal-ash-recovery',
      'dysprosium-ore-to-oxide', 'neodymium-praseodymium-separation', 'nd-fe-b-magnet-alloying', 'heavy-rare-earth-diffusion', 'rare-earth-solvent-extraction',
      'magnet-recycling', 'graphite-anode-processing', 'cobalt-refining-concentration', 'tungsten-concentrate-processing', 'indium-zinc-byproduct-flow',
      'helium-liquefaction-logistics', 'hafnium-zirconium-separation', 'tantalum-concentrate-traceability', 'niobium-ferroniobium-production', 'antimony-smelting-concentration',
      'critical-mineral-import-reliance', 'single-country-processing-concentration', 'export-control-exposure', 'material-substitution-boundaries', 'supply-chain-data-uncertainty',
    ],
    sources: [
      { key: 'pp1802', title: 'Critical Mineral Resources of the United States—Economic and Environmental Geology and Prospects for Future Supply', authors: ['Klaus J. Schulz', 'John H. DeYoung Jr.', 'Robert R. Seal II', 'Dwight C. Bradley', 'editors'], publisher: 'U.S. Geological Survey', publishedAt: '2017-12-19', url: 'https://pubs.usgs.gov/publication/pp1802', locator: 'Commodity chapters and introductory sections distinguishing resources, production, processing, uses, and supply considerations.', establishes: 'The USGS volume describes geology, production, processing, uses, and supply considerations for selected mineral commodities.', boundary: 'Geologic occurrence and historical production do not establish qualified material availability for a specific industrial process.' },
      { key: 'mcs-gallium-germanium', title: 'Mineral Commodity Summaries 2026', authors: ['U.S. Geological Survey'], publisher: 'U.S. Geological Survey', publishedAt: '2026-01-30', url: 'https://pubs.usgs.gov/periodicals/mcs2026/mcs2026.pdf', locator: 'Gallium and germanium commodity chapters: production, recycling, imports, uses, substitutes, and world resources.', establishes: 'The annual summaries compile reported supply, trade, use, recycling, and resource indicators for gallium and germanium.', boundary: 'National annual estimates do not expose every intermediate processor, purity grade, contract, inventory, or qualification constraint.' },
      { key: 'mcs-rare-earths', title: 'Mineral Commodity Summaries 2026', authors: ['U.S. Geological Survey'], publisher: 'U.S. Geological Survey', publishedAt: '2026-01-30', url: 'https://pubs.usgs.gov/periodicals/mcs2026/mcs2026.pdf', locator: 'Rare earths commodity chapter: mine production, compounds and metals, trade, recycling, substitutes, and world resources.', establishes: 'The annual summary compiles reported indicators for rare-earth mining, materials, trade, recycling, and substitution.', boundary: 'Aggregate rare-earth data do not directly measure separated dysprosium, magnet-grade alloy, or qualified component availability.' },
      { key: 'mcs-industrial', title: 'Mineral Commodity Summaries 2026', authors: ['U.S. Geological Survey'], publisher: 'U.S. Geological Survey', publishedAt: '2026-01-30', url: 'https://pubs.usgs.gov/periodicals/mcs2026/mcs2026.pdf', locator: 'Graphite, cobalt, tungsten, and indium commodity chapters.', establishes: 'The annual summaries compile reported production, trade, uses, recycling, substitutes, and resource indicators for named commodities.', boundary: 'Commodity-level estimates do not establish site-level capacity, processing yield, customer qualification, or future availability.' },
      { key: 'mcs-specialty', title: 'Mineral Commodity Summaries 2026', authors: ['U.S. Geological Survey'], publisher: 'U.S. Geological Survey', publishedAt: '2026-01-30', url: 'https://pubs.usgs.gov/periodicals/mcs2026/mcs2026.pdf', locator: 'Helium, hafnium, tantalum, niobium, and antimony commodity chapters.', establishes: 'The annual summaries compile reported supply and use indicators for the named specialty commodities.', boundary: 'Reported material flows do not establish every purity, logistics, traceability, or end-use qualification constraint.' },
      { key: 'supply-analysis', title: 'Mineral Supply Chain Analysis', authors: ['U.S. Geological Survey Mineral Resources Program'], publisher: 'U.S. Geological Survey', url: 'https://www.usgs.gov/programs/mineral-resources-program/science/mineral-supply-chain-analysis', locator: 'Methods and data sections covering criticality, net import reliance, disruption exposure, and uncertainty.', establishes: 'USGS describes analytical approaches and datasets used to evaluate mineral supply chains and disruption exposure.', boundary: 'A national criticality indicator is not a forecast of a company’s inventory, price, contract access, or operational outcome.' },
    ],
  },
] as const

export const FRONTIER_EPISTEMIC_DOMAINS: readonly EpistemicDomain[] = domainSeeds.map((seed) => seed.domain)

/**
 * Record ids whose source was named for the concept rather than inherited from
 * the positional block. The alignment audit uses this to tell an override from
 * a legacy assignment without re-deriving the seed structure.
 */
export const FRONTIER_EXPLICIT_SOURCE_OVERRIDES: ReadonlySet<string> = new Set(
  domainSeeds.flatMap((seed) =>
    Object.keys(seed.sourceOverrides ?? {}).map((conceptSlug) => `urn:maha:record:${seed.domain.slug}-${conceptSlug}`),
  ),
)

export const FRONTIER_DOMAIN_GRAPH_RECORDS: readonly EpistemicRecord[] = domainSeeds.flatMap(buildDomainRecords)

export const FRONTIER_DOMAIN_GRAPH_RECORDS_BY_DOMAIN = Object.fromEntries(
  domainSeeds.map((seed) => [
    seed.domain.slug,
    FRONTIER_DOMAIN_GRAPH_RECORDS.filter((record) => record.domainSlug === seed.domain.slug),
  ]),
) as Readonly<Record<string, readonly EpistemicRecord[]>>
