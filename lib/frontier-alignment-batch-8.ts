/**
 * Frontier source-alignment Batch 8.
 *
 * This completion cohort re-evaluates every frontier record whose active
 * judgement still lacked content inspection after Batch 7. Source discovery
 * and source inspection stay separate: locating metadata or an access route is
 * not inspection. Five records remain inaccessible because no authorized copy
 * of the declared IEEE article was found. All other judgements are internal
 * editorial readings, not external review or independent reproduction.
 */

export const ALIGNMENT_BATCH_8_VERSION = 'maha-frontier-alignment-batch/8.0' as const

export type Batch8Verdict =
  | 'supported'
  | 'partially-supported'
  | 'mismatched'
  | 'insufficient-evidence'
  | 'inaccessible-source'

export type Batch8ArtifactVersion =
  | 'version-of-record'
  | 'accepted-manuscript'
  | 'repository-copy'
  | 'government-report'
  | 'not-inspected'

export type Batch8InspectionDepth =
  | 'abstract-only'
  | 'specified-sections'
  | 'full-document'
  | 'not-inspected'

export interface Batch8SourceDiscovery {
  sourceContractId: string
  status: 'open-copy-located' | 'public-abstract-only' | 'closed-no-authorized-copy'
  artifactUrl: string
  channel: 'publisher' | 'government-host' | 'institutional-repository' | 'author-host' | 'bibliographic-index'
  artifactVersion: Batch8ArtifactVersion
  versionRelationshipVerified: boolean
  contentInspectionAuthorized: boolean
  contentCommitted: false
  note: string
}

export interface Batch8Decision {
  recordId: string
  domainSlug: string
  sourceContractId: string
  priorBatchId: 'batch-3' | 'batch-4' | 'batch-5' | 'batch-6' | 'batch-7' | null
  verdict: Batch8Verdict
  sourceContentInspected: boolean
  inspectedContentLocation: string | null
  mismatchBasis?: 'inspected-content-different-subject'
  reason: string
  remediation: string
  origin?: 'independently-curated'
  artifactVersion: Batch8ArtifactVersion
  inspectionDepth: Batch8InspectionDepth
  versionRelationshipVerified: boolean
  recoveryDisposition: 'open-copy-located' | 'authentication-wall'
}

export const ALIGNMENT_BATCH_8_SOURCE_DISCOVERIES: readonly Batch8SourceDiscovery[] = [
  {
    sourceContractId: 'source-advanced-materials-wide-bandgap',
    status: 'closed-no-authorized-copy',
    artifactUrl: 'https://scholarcommons.sc.edu/elct_facpub/163/',
    channel: 'institutional-repository',
    artifactVersion: 'not-inspected',
    versionRelationshipVerified: false,
    contentInspectionAuthorized: false,
    contentCommitted: false,
    note: 'The institutional record and DOI identify the IEEE article, but no inspectable authorized copy was located.',
  },
  {
    sourceContractId: 'source-biomolecular-engineering-pace',
    status: 'open-copy-located',
    artifactUrl: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC3084352/',
    channel: 'institutional-repository',
    artifactVersion: 'accepted-manuscript',
    versionRelationshipVerified: true,
    contentInspectionAuthorized: true,
    contentCommitted: false,
    note: 'NIH author manuscript NIHMS272507 matches DOI 10.1038/nature09929 and was inspected in full.',
  },
  {
    sourceContractId: 'source-biomolecular-engineering-riboregulators',
    status: 'open-copy-located',
    artifactUrl: 'https://www.bio.davidson.edu/Courses/Synthetic/papers/RNA_Regulation.pdf',
    channel: 'institutional-repository',
    artifactVersion: 'repository-copy',
    versionRelationshipVerified: true,
    contentInspectionAuthorized: true,
    contentCommitted: false,
    note: 'The repository PDF carries the declared Nature Biotechnology article, DOI, pagination, figures, and Methods.',
  },
  {
    sourceContractId: 'source-critical-supply-chains-mcs-gallium-germanium',
    status: 'open-copy-located',
    artifactUrl: 'https://pubs.usgs.gov/periodicals/mcs2026/mcs2026.pdf',
    channel: 'government-host',
    artifactVersion: 'government-report',
    versionRelationshipVerified: true,
    contentInspectionAuthorized: true,
    contentCommitted: false,
    note: 'Official USGS Mineral Commodity Summaries 2026 report; gallium and germanium chapters inspected.',
  },
  {
    sourceContractId: 'source-critical-supply-chains-mcs-specialty',
    status: 'open-copy-located',
    artifactUrl: 'https://pubs.usgs.gov/periodicals/mcs2026/mcs2026.pdf',
    channel: 'government-host',
    artifactVersion: 'government-report',
    versionRelationshipVerified: true,
    contentInspectionAuthorized: true,
    contentCommitted: false,
    note: 'Official USGS report; antimony, helium, niobium, tantalum, and zirconium/hafnium chapters inspected.',
  },
  {
    sourceContractId: 'source-critical-supply-chains-pp1802',
    status: 'open-copy-located',
    artifactUrl: 'https://pubs.usgs.gov/pp/1802/pp1802_entirebook.pdf',
    channel: 'government-host',
    artifactVersion: 'government-report',
    versionRelationshipVerified: true,
    contentInspectionAuthorized: true,
    contentCommitted: false,
    note: 'Official 148 MB USGS book was downloaded and searched as a complete document; no source text is committed.',
  },
  {
    sourceContractId: 'source-longevity-metabolism-bioenergetics',
    status: 'open-copy-located',
    artifactUrl: 'https://www.researchgate.net/publication/268796960_Analysis_and_Interpretation_of_Microplate-Based_Oxygen_Consumption_and_pH_Data',
    channel: 'author-host',
    artifactVersion: 'repository-copy',
    versionRelationshipVerified: true,
    contentInspectionAuthorized: true,
    contentCommitted: false,
    note: 'Author-uploaded Chapter 16 matches the declared DOI and was read through the complete rendered full text.',
  },
  {
    sourceContractId: 'source-longevity-metabolism-hallmarks',
    status: 'open-copy-located',
    artifactUrl: 'https://discovery.ucl.ac.uk/id/eprint/10207541/',
    channel: 'institutional-repository',
    artifactVersion: 'accepted-manuscript',
    versionRelationshipVerified: true,
    contentInspectionAuthorized: true,
    contentCommitted: false,
    note: 'UCL identifies the PDF as the accepted manuscript for DOI 10.1016/j.cell.2022.11.001.',
  },
  {
    sourceContractId: 'source-neurotechnology-bci-channelrhodopsin',
    status: 'open-copy-located',
    artifactUrl: 'https://edboyden.org/05.09.boyden.pdf',
    channel: 'author-host',
    artifactVersion: 'version-of-record',
    versionRelationshipVerified: true,
    contentInspectionAuthorized: true,
    contentCommitted: false,
    note: 'Author-hosted journal-layout PDF matches DOI 10.1038/nn1525 and was inspected in full.',
  },
  {
    sourceContractId: 'source-neurotechnology-bci-closed-loop',
    status: 'public-abstract-only',
    artifactUrl: 'https://pubmed.ncbi.nlm.nih.gov/22017994/',
    channel: 'bibliographic-index',
    artifactVersion: 'version-of-record',
    versionRelationshipVerified: true,
    contentInspectionAuthorized: true,
    contentCommitted: false,
    note: 'PubMed exposes the indexed abstract and identity; no full article was accepted for inspection.',
  },
  {
    sourceContractId: 'source-neurotechnology-bci-foreign-body',
    status: 'public-abstract-only',
    artifactUrl: 'https://pubmed.ncbi.nlm.nih.gov/16198003/',
    channel: 'bibliographic-index',
    artifactVersion: 'version-of-record',
    versionRelationshipVerified: true,
    contentInspectionAuthorized: true,
    contentCommitted: false,
    note: 'PubMed exposes the indexed abstract and identity; no full article was accepted for inspection.',
  },
  {
    sourceContractId: 'source-neurotechnology-bci-intracortical-bci',
    status: 'open-copy-located',
    artifactUrl: 'https://www.cs.miami.edu/home/odelia/teaching/compneuro2021/syllabus/2006donhogueNature.pdf',
    channel: 'institutional-repository',
    artifactVersion: 'repository-copy',
    versionRelationshipVerified: true,
    contentInspectionAuthorized: true,
    contentCommitted: false,
    note: 'Repository copy carries the complete Nature article, DOI, pagination, figures, and Methods.',
  },
] as const

const locations = {
  pace: 'PMC3084352 / NIHMS272507, PACE architecture, selection coupling, mutagenesis, T7 RNA-polymerase experiments, and Methods (full manuscript)',
  riboregulators: 'Isaacs et al. 2004 repository PDF, pp. 841–847, design, cis repression, trans activation, figures, and Methods (full article)',
  mcsGalliumGermanium: 'USGS Mineral Commodity Summaries 2026, Gallium pp. 82–83 and Germanium pp. 88–89',
  mcsSpecialty: 'USGS Mineral Commodity Summaries 2026, Antimony pp. 42–43, Helium pp. 96–97, Niobium pp. 134–135, Tantalum pp. 186–187, and Zirconium/Hafnium pp. 214–215',
  pp1802: 'USGS Professional Paper 1802 entire book, complete-text search plus commodity table of contents and the high-purity-quartz occurrence at printed p. E16',
  bioenergetics: 'Divakaruni et al. 2014, Chapter 16 §§2.1–2.3 and §3, pp. 311–347 (complete author-uploaded chapter inspected)',
  hallmarks: 'López-Otín et al. accepted manuscript, nutrient sensing, mitochondrial dysfunction, senescence, biomarkers, clinical trials, and concluding intervention sections',
  channelrhodopsin: 'Boyden et al. 2005 author-hosted article, pp. 1263–1268, photocurrent, spectrum, pulse kinetics, controls, discussion, and Methods',
  closedLoop: 'PubMed PMID 22017994, complete indexed abstract only',
  foreignBody: 'PubMed PMID 16198003, complete indexed abstract only',
  intracortical: 'Hochberg et al. 2006 repository copy, pp. 164–171, participant, array, decoding, daily filter building, performance, Discussion, and Methods',
} as const

function decision(
  slug: string,
  domainSlug: string,
  sourceContractId: string,
  priorBatchId: Batch8Decision['priorBatchId'],
  verdict: Batch8Verdict,
  inspectedContentLocation: string | null,
  reason: string,
  remediation: string,
  options: Partial<Pick<Batch8Decision, 'artifactVersion' | 'inspectionDepth' | 'versionRelationshipVerified' | 'recoveryDisposition'>> = {},
): Batch8Decision {
  const inspected = inspectedContentLocation !== null
  return {
    recordId: `urn:maha:record:${slug}`,
    domainSlug,
    sourceContractId,
    priorBatchId,
    verdict,
    sourceContentInspected: inspected,
    inspectedContentLocation,
    ...(verdict === 'mismatched' ? { mismatchBasis: 'inspected-content-different-subject' as const } : {}),
    reason,
    remediation,
    ...(verdict === 'supported' ? { origin: 'independently-curated' as const } : {}),
    artifactVersion: options.artifactVersion ?? (inspected ? 'repository-copy' : 'not-inspected'),
    inspectionDepth: options.inspectionDepth ?? (inspected ? 'specified-sections' : 'not-inspected'),
    versionRelationshipVerified: options.versionRelationshipVerified ?? inspected,
    recoveryDisposition: options.recoveryDisposition ?? (inspected ? 'open-copy-located' : 'authentication-wall'),
  }
}

const inaccessibleWideBandgap = [
  'advanced-materials-color-centers-in-diamond',
  'advanced-materials-diamond-thermal-conductivity',
  'advanced-materials-diamond-wafer-substrates',
  'advanced-materials-gallium-nitride-epitaxy',
  'advanced-materials-sic-wide-bandgap-substrates',
].map((slug) => decision(
  slug,
  'advanced-materials',
  'source-advanced-materials-wide-bandgap',
  'batch-7',
  'inaccessible-source',
  null,
  'The DOI and institutional metadata resolve, but the IEEE article remains closed and no authorized repository or author copy was located. Its content was not read.',
  'Obtain an authorized copy of Hudgins et al. 2003 and judge the named subject from the actual article pages.',
  { artifactVersion: 'not-inspected', inspectionDepth: 'not-inspected', versionRelationshipVerified: false, recoveryDisposition: 'authentication-wall' },
))

export const ALIGNMENT_BATCH_8_DECISIONS: readonly Batch8Decision[] = [
  ...inaccessibleWideBandgap,

  decision('biomolecular-engineering-directed-enzyme-evolution', 'biomolecular-engineering', 'source-biomolecular-engineering-pace', 'batch-6', 'supported', locations.pace,
    'PACE continuously evolves T7 RNA polymerase activities and specificity, directly demonstrating directed evolution of an enzyme.', 'None. Preserve the PACE-specific experimental boundary.', { artifactVersion: 'accepted-manuscript', inspectionDepth: 'full-document' }),
  decision('biomolecular-engineering-mutation-library-generation', 'biomolecular-engineering', 'source-biomolecular-engineering-pace', 'batch-6', 'partially-supported', locations.pace,
    'The mutagenesis plasmid raises mutation rate and produces diverse mutations during continuous evolution, but the paper does not construct or characterize a discrete mutation library.', 'Narrow to in-process mutagenesis or bind a source that generates and measures an explicit mutation library.', { artifactVersion: 'accepted-manuscript', inspectionDepth: 'full-document' }),
  decision('biomolecular-engineering-selection-pressure-coupling', 'biomolecular-engineering', 'source-biomolecular-engineering-pace', 'batch-6', 'supported', locations.pace,
    'The paper explicitly couples desired target activity to gene-III production and therefore to selection-phage infectivity.', 'None. Preserve the activity-to-infectivity coupling boundary.', { artifactVersion: 'accepted-manuscript', inspectionDepth: 'full-document' }),
  decision('biomolecular-engineering-phage-assisted-continuous-evolution', 'biomolecular-engineering', 'source-biomolecular-engineering-pace', 'batch-6', 'supported', locations.pace,
    'The article defines, builds, and experimentally demonstrates phage-assisted continuous evolution.', 'None. Keep this as a technique-specific record.', { artifactVersion: 'accepted-manuscript', inspectionDepth: 'full-document' }),
  decision('biomolecular-engineering-fitness-landscape-accessibility', 'biomolecular-engineering', 'source-biomolecular-engineering-pace', 'batch-6', 'partially-supported', locations.pace,
    'The authors state that enhanced mutagenesis can traverse single-mutation fitness valleys, but do not map or generally measure fitness-landscape accessibility.', 'Narrow to the demonstrated single-mutation-valley claim or bind a landscape-mapping study.', { artifactVersion: 'accepted-manuscript', inspectionDepth: 'full-document' }),

  decision('biomolecular-engineering-synthetic-riboswitches', 'biomolecular-engineering', 'source-biomolecular-engineering-riboregulators', null, 'mismatched', locations.riboregulators,
    'The article constructs a cis-repressed RNA plus a trans-activating RNA. Riboswitches appear only as related prior work; the demonstrated system is not a ligand-responsive riboswitch.', 'Bind a source that constructs and measures synthetic ligand-responsive riboswitches.', { inspectionDepth: 'full-document' }),
  decision('biomolecular-engineering-ligand-binding-aptamer-domains', 'biomolecular-engineering', 'source-biomolecular-engineering-riboregulators', null, 'mismatched', locations.riboregulators,
    'The complete article does not construct or measure a ligand-binding aptamer domain; activation is driven by complementary RNA.', 'Bind an aptamer-domain or aptazyme source.', { inspectionDepth: 'full-document' }),
  decision('biomolecular-engineering-riboswitch-expression-platforms', 'biomolecular-engineering', 'source-biomolecular-engineering-riboregulators', null, 'mismatched', locations.riboregulators,
    'The demonstrated cis/trans riboregulator is not organized as a ligand-sensing riboswitch expression platform.', 'Bind a source that explicitly separates riboswitch sensor and expression-platform domains.', { inspectionDepth: 'full-document' }),
  decision('biomolecular-engineering-toehold-switches', 'biomolecular-engineering', 'source-biomolecular-engineering-riboregulators', null, 'mismatched', locations.riboregulators,
    'The 2004 paper predates and does not define the later toehold-switch architecture; it demonstrates a different cis/trans RNA regulator.', 'Bind the technique-defining toehold-switch paper.', { inspectionDepth: 'full-document' }),
  decision('biomolecular-engineering-rna-strand-displacement', 'biomolecular-engineering', 'source-biomolecular-engineering-riboregulators', null, 'partially-supported', locations.riboregulators,
    'A trans-activating RNA binds the cis-repressed RNA and alters its stem-loop, but the paper does not formulate a general strand-displacement mechanism or circuit formalism.', 'Narrow to trans-RNA-mediated structural activation or bind a strand-displacement source.', { inspectionDepth: 'full-document' }),

  decision('critical-supply-chains-fluorinated-resist-components', 'critical-supply-chains', 'source-critical-supply-chains-mcs-gallium-germanium', 'batch-4', 'mismatched', locations.mcsGalliumGermanium,
    'The gallium and germanium chapters concern mineral production, recovery, trade, and end uses; they do not address fluorinated photoresist components.', 'Bind a fluorochemical or resist-material supply source.', { artifactVersion: 'government-report' }),
  decision('critical-supply-chains-gallium-bauxite-byproduct-flow', 'critical-supply-chains', 'source-critical-supply-chains-mcs-gallium-germanium', 'batch-4', 'supported', locations.mcsGalliumGermanium,
    'USGS states that primary gallium is recovered predominantly as a byproduct of processing bauxite ores.', 'None. Preserve the qualitative byproduct boundary; the chapter does not quantify a complete material flow.', { artifactVersion: 'government-report' }),
  decision('critical-supply-chains-gallium-zinc-processing-byproduct', 'critical-supply-chains', 'source-critical-supply-chains-mcs-gallium-germanium', 'batch-4', 'supported', locations.mcsGalliumGermanium,
    'USGS states that gallium may also be recovered as a byproduct of processing zinc ores.', 'None. Do not infer recovery yield or market share.', { artifactVersion: 'government-report' }),
  decision('critical-supply-chains-germanium-zinc-refining-flow', 'critical-supply-chains', 'source-critical-supply-chains-mcs-gallium-germanium', 'batch-4', 'supported', locations.mcsGalliumGermanium,
    'The germanium chapter traces germanium-bearing zinc concentrates to Canadian refining and describes prior recovery at a Tennessee zinc smelter.', 'None. Keep the facility- and year-specific boundary.', { artifactVersion: 'government-report' }),
  decision('critical-supply-chains-germanium-coal-ash-recovery', 'critical-supply-chains', 'source-critical-supply-chains-mcs-gallium-germanium', 'batch-4', 'partially-supported', locations.mcsGalliumGermanium,
    'The chapter identifies germanium resources associated with lignite coal deposits but does not describe or quantify coal-ash recovery.', 'Narrow to coal-associated resources or bind a coal-ash recovery source.', { artifactVersion: 'government-report' }),

  decision('critical-supply-chains-antimony-smelting-concentration', 'critical-supply-chains', 'source-critical-supply-chains-mcs-specialty', null, 'partially-supported', locations.mcsSpecialty,
    'USGS reports primary and secondary smelter output plus import-source concentration, but does not calculate a smelting-concentration metric.', 'Narrow to reported production/import concentration or add a declared concentration calculation.', { artifactVersion: 'government-report' }),
  decision('critical-supply-chains-helium-liquefaction-logistics', 'critical-supply-chains', 'source-critical-supply-chains-mcs-specialty', null, 'partially-supported', locations.mcsSpecialty,
    'The chapter reports production plants, Grade-A helium, underground storage, imports, and boil-off recovery, but not a bounded liquefaction-logistics chain.', 'Narrow to production and storage infrastructure or bind a liquefaction and transport source.', { artifactVersion: 'government-report' }),
  decision('critical-supply-chains-hafnium-zirconium-separation', 'critical-supply-chains', 'source-critical-supply-chains-mcs-specialty', null, 'partially-supported', locations.mcsSpecialty,
    'USGS reports zirconium and hafnium metal production from zirconium chemical intermediates, but does not describe the separation process.', 'Narrow to co-production context or bind a process source for hafnium-zirconium separation.', { artifactVersion: 'government-report' }),
  decision('critical-supply-chains-niobium-ferroniobium-production', 'critical-supply-chains', 'source-critical-supply-chains-mcs-specialty', null, 'supported', locations.mcsSpecialty,
    'The niobium chapter reports production from imported feedstocks, ferroniobium consumption, import shares, and producer-country output.', 'None. Preserve the commodity-summary boundary rather than implying a unit-process model.', { artifactVersion: 'government-report' }),
  decision('critical-supply-chains-tantalum-concentrate-traceability', 'critical-supply-chains', 'source-critical-supply-chains-mcs-specialty', null, 'mismatched', locations.mcsSpecialty,
    'The tantalum chapter reports aggregate import sources and trade, but provides no chain-of-custody, provenance, or concentrate-traceability method.', 'Bind a due-diligence or mineral chain-of-custody standard.', { artifactVersion: 'government-report' }),

  decision('critical-supply-chains-high-purity-quartz-deposits', 'critical-supply-chains', 'source-critical-supply-chains-pp1802', 'batch-6', 'partially-supported', locations.pp1802,
    'The full book mentions high-purity quartz once as a commercially important mineral associated with zoned granitic pegmatites; it does not provide a quartz deposit or supply assessment.', 'Narrow to the single geological co-occurrence statement or bind a dedicated high-purity-quartz resource source.', { artifactVersion: 'government-report', inspectionDepth: 'full-document' }),
  decision('critical-supply-chains-quartz-crucible-manufacturing', 'critical-supply-chains', 'source-critical-supply-chains-pp1802', 'batch-6', 'mismatched', locations.pp1802,
    'A complete-text search of the official book found no quartz-crucible manufacturing treatment.', 'Bind a crucible manufacturing and qualification source.', { artifactVersion: 'government-report', inspectionDepth: 'full-document' }),
  decision('critical-supply-chains-semiconductor-grade-polysilicon', 'critical-supply-chains', 'source-critical-supply-chains-pp1802', 'batch-6', 'mismatched', locations.pp1802,
    'The official book covers 23 critical mineral commodities and contains no polysilicon or semiconductor-grade-silicon process treatment.', 'Bind a semiconductor polysilicon production and purity source.', { artifactVersion: 'government-report', inspectionDepth: 'full-document' }),
  decision('critical-supply-chains-euv-photoresist-precursors', 'critical-supply-chains', 'source-critical-supply-chains-pp1802', 'batch-6', 'mismatched', locations.pp1802,
    'A complete-text search found no EUV photoresist or photoresist-precursor treatment.', 'Bind a resist-material or semiconductor-chemical supply source.', { artifactVersion: 'government-report', inspectionDepth: 'full-document' }),
  decision('critical-supply-chains-photoacid-generator-supply', 'critical-supply-chains', 'source-critical-supply-chains-pp1802', 'batch-6', 'mismatched', locations.pp1802,
    'A complete-text search found no photoacid-generator supply treatment.', 'Bind a photoacid-generator chemistry and supply-chain source.', { artifactVersion: 'government-report', inspectionDepth: 'full-document' }),

  decision('longevity-metabolism-oxygen-consumption-rate', 'longevity-metabolism', 'source-longevity-metabolism-bioenergetics', null, 'supported', locations.bioenergetics,
    'Chapter 16 defines oxygen-consumption rate, partitions its components, and specifies analysis and normalization limits.', 'None. Preserve the assay- and normalization-specific boundary.', { inspectionDepth: 'full-document' }),
  decision('longevity-metabolism-atp-linked-respiration', 'longevity-metabolism', 'source-longevity-metabolism-bioenergetics', null, 'supported', locations.bioenergetics,
    'Section 2.1.2 defines ATP-linked respiration and explains its oligomycin-sensitive approximation and controlling processes.', 'None. Preserve the stated approximation and error caveats.', { inspectionDepth: 'full-document' }),
  decision('longevity-metabolism-metabolic-flux-tracing', 'longevity-metabolism', 'source-longevity-metabolism-bioenergetics', null, 'mismatched', locations.bioenergetics,
    'The chapter measures extracellular oxygen consumption and acidification rates; it does not perform isotope or metabolite-tracer flux analysis.', 'Bind an isotope-tracing or metabolic-flux-analysis source.', { inspectionDepth: 'full-document' }),
  decision('longevity-metabolism-ampk-energy-sensing', 'longevity-metabolism', 'source-longevity-metabolism-bioenergetics', null, 'mismatched', locations.bioenergetics,
    'The complete chapter is an extracellular-flux assay guide and does not define or measure AMPK energy sensing.', 'Bind an AMPK mechanism or measurement source.', { inspectionDepth: 'full-document' }),
  decision('longevity-metabolism-insulin-mtor-signaling', 'longevity-metabolism', 'source-longevity-metabolism-bioenergetics', null, 'mismatched', locations.bioenergetics,
    'The complete chapter does not analyze insulin–mTOR signaling; related search-page recommendations are not part of the cited chapter.', 'Bind an insulin–mTOR signaling source.', { inspectionDepth: 'full-document' }),

  decision('longevity-metabolism-sirtuin-nad-dependence', 'longevity-metabolism', 'source-longevity-metabolism-hallmarks', 'batch-6', 'supported', locations.hallmarks,
    'The accepted manuscript identifies SIRT1 and SIRT3 as NAD-responsive nutrient-scarcity sensors and SIRT6 as an NAD+ sensor.', 'None. Keep the review-level mechanistic boundary.', { artifactVersion: 'accepted-manuscript', inspectionDepth: 'full-document' }),
  decision('longevity-metabolism-cd38-nad-consumption', 'longevity-metabolism', 'source-longevity-metabolism-hallmarks', 'batch-6', 'mismatched', locations.hallmarks,
    'The complete accepted manuscript does not treat CD38 or CD38-mediated NAD+ consumption.', 'Bind a source that directly measures or reviews CD38 as an NAD-consuming enzyme.', { artifactVersion: 'accepted-manuscript', inspectionDepth: 'full-document' }),
  decision('longevity-metabolism-intervention-biomarker-boundaries', 'longevity-metabolism', 'source-longevity-metabolism-hallmarks', 'batch-6', 'partially-supported', locations.hallmarks,
    'The review discusses aging biomarkers and intervention evidence, but does not provide a formal validation boundary connecting a biomarker to intervention efficacy.', 'Narrow to the review’s examples or bind a biomarker-validation framework.', { artifactVersion: 'accepted-manuscript', inspectionDepth: 'full-document' }),
  decision('longevity-metabolism-lifespan-versus-healthspan-endpoints', 'longevity-metabolism', 'source-longevity-metabolism-hallmarks', 'batch-6', 'supported', locations.hallmarks,
    'The review repeatedly reports healthspan and lifespan as distinct outcomes across model-organism and intervention evidence.', 'None. Preserve species and intervention context for each endpoint.', { artifactVersion: 'accepted-manuscript', inspectionDepth: 'full-document' }),
  decision('longevity-metabolism-translation-to-human-outcomes', 'longevity-metabolism', 'source-longevity-metabolism-hallmarks', 'batch-6', 'supported', locations.hallmarks,
    'The concluding sections explicitly distinguish model-organism progress, initial clinical trials, human-healthspan strategies, and unresolved translation questions.', 'None. Preserve the review’s uncertainty and do not infer human lifespan extension.', { artifactVersion: 'accepted-manuscript', inspectionDepth: 'full-document' }),

  decision('neurotechnology-bci-optogenetic-channelrhodopsin', 'neurotechnology-bci', 'source-neurotechnology-bci-channelrhodopsin', 'batch-4', 'supported', locations.channelrhodopsin,
    'The paper adapts Channelrhodopsin-2 for genetically targeted optical control of mammalian neurons.', 'None. Preserve the cultured-neuron experimental boundary.', { artifactVersion: 'version-of-record', inspectionDepth: 'full-document' }),
  decision('neurotechnology-bci-channelrhodopsin-photocurrent-kinetics', 'neurotechnology-bci', 'source-neurotechnology-bci-channelrhodopsin', 'batch-4', 'supported', locations.channelrhodopsin,
    'The article measures ChR2 photocurrent rise, sustained-light inactivation, recovery, and pulse-driven spike timing.', 'None. Keep the reported illumination and cell-culture conditions.', { artifactVersion: 'version-of-record', inspectionDepth: 'full-document' }),
  decision('neurotechnology-bci-opsin-spectral-sensitivity', 'neurotechnology-bci', 'source-neurotechnology-bci-channelrhodopsin', 'batch-4', 'supported', locations.channelrhodopsin,
    'The paper compares blue/GFP-band illumination with 490–510 nm YFP-band light and reports a smaller current under the latter.', 'None. Do not generalize the two-filter comparison into a complete action spectrum.', { artifactVersion: 'version-of-record', inspectionDepth: 'full-document' }),
  decision('neurotechnology-bci-light-delivery-tissue-heating', 'neurotechnology-bci', 'source-neurotechnology-bci-channelrhodopsin', 'batch-4', 'mismatched', locations.channelrhodopsin,
    'The full article reports light power and cultured-neuron controls but contains no tissue-heating measurement.', 'Bind an in-vivo optical thermal-model or thermometry source.', { artifactVersion: 'version-of-record', inspectionDepth: 'full-document' }),
  decision('neurotechnology-bci-stimulation-artifact-rejection', 'neurotechnology-bci', 'source-neurotechnology-bci-channelrhodopsin', 'batch-4', 'mismatched', locations.channelrhodopsin,
    'The full article does not define or test a stimulation-artifact rejection method.', 'Bind a simultaneous optical-stimulation and recording artifact source.', { artifactVersion: 'version-of-record', inspectionDepth: 'full-document' }),

  decision('neurotechnology-bci-closed-loop-neural-decoding', 'neurotechnology-bci', 'source-neurotechnology-bci-closed-loop', null, 'partially-supported', locations.closedLoop,
    'The abstract describes neural-activity-triggered closed-loop stimulation, but does not establish a general neural-decoding architecture.', 'Narrow to spike-triggered closed-loop stimulation or inspect the full article before widening.', { artifactVersion: 'version-of-record', inspectionDepth: 'abstract-only' }),
  decision('neurotechnology-bci-decoder-update-latency', 'neurotechnology-bci', 'source-neurotechnology-bci-closed-loop', null, 'insufficient-evidence', locations.closedLoop,
    'The inspected abstract does not report decoder-update latency, and the full article was not available for inspection; absence from an abstract is not proof of mismatch.', 'Inspect the experimental procedures or bind a latency-specific source.', { artifactVersion: 'version-of-record', inspectionDepth: 'abstract-only' }),
  decision('neurotechnology-bci-sensing-to-stimulation-loop', 'neurotechnology-bci', 'source-neurotechnology-bci-closed-loop', null, 'supported', locations.closedLoop,
    'The abstract directly describes a closed-loop strategy in which ongoing neural activity triggers stimulation in an MPTP primate model.', 'None. Keep the primate-model and trigger-rule boundary.', { artifactVersion: 'version-of-record', inspectionDepth: 'abstract-only' }),
  decision('neurotechnology-bci-neural-feature-extraction', 'neurotechnology-bci', 'source-neurotechnology-bci-closed-loop', null, 'partially-supported', locations.closedLoop,
    'The abstract identifies ongoing neural activity as the feedback signal, but does not specify a reusable feature-extraction pipeline.', 'Narrow to the reported trigger signal or inspect the full methods.', { artifactVersion: 'version-of-record', inspectionDepth: 'abstract-only' }),

  decision('neurotechnology-bci-intracortical-bci', 'neurotechnology-bci', 'source-neurotechnology-bci-intracortical-bci', 'batch-6', 'supported', locations.intracortical,
    'The study implants a 96-microelectrode array in primary motor cortex and uses intracortical ensemble activity to control external devices.', 'None. Preserve the small pilot-trial and participant-specific boundary.', { inspectionDepth: 'full-document' }),
  decision('neurotechnology-bci-cortical-surface-bci', 'neurotechnology-bci', 'source-neurotechnology-bci-intracortical-bci', 'batch-6', 'mismatched', locations.intracortical,
    'The demonstrated interface is intracortical; ECoG appears only in discussion of alternative BCI approaches.', 'Bind an ECoG or cortical-surface BCI study.', { inspectionDepth: 'full-document' }),
  decision('neurotechnology-bci-peripheral-nerve-interface', 'neurotechnology-bci', 'source-neurotechnology-bci-intracortical-bci', 'batch-6', 'mismatched', locations.intracortical,
    'The study records from intracortical motor cortex and does not implement a peripheral-nerve interface.', 'Bind a peripheral-nerve recording or stimulation source.', { inspectionDepth: 'full-document' }),
  decision('neurotechnology-bci-motor-intention-decoding', 'neurotechnology-bci', 'source-neurotechnology-bci-intracortical-bci', 'batch-6', 'supported', locations.intracortical,
    'The article creates decoders that translate intended hand-motion ensemble activity into cursor and prosthetic control.', 'None. Preserve the reported tasks, participants, and decoder construction.', { inspectionDepth: 'full-document' }),
  decision('neurotechnology-bci-bci-calibration-drift', 'neurotechnology-bci', 'source-neurotechnology-bci-intracortical-bci', 'batch-6', 'partially-supported', locations.intracortical,
    'The discussion reports changing recorded populations across days, daily filter creation, and resulting variability and instability, but does not quantify a calibration-drift model.', 'Narrow to across-day ensemble instability and daily filter rebuilding or bind a calibration-drift study.', { inspectionDepth: 'full-document' }),

  decision('neurotechnology-bci-chronic-signal-stability', 'neurotechnology-bci', 'source-neurotechnology-bci-foreign-body', 'batch-5', 'supported', locations.foreignBody,
    'The abstract states that chronic arrays often fail to function reliably and identifies tissue reaction as a major failure mode.', 'None. Keep the review-level and chronic-setting boundary.', { artifactVersion: 'version-of-record', inspectionDepth: 'abstract-only' }),
  decision('neurotechnology-bci-foreign-body-response', 'neurotechnology-bci', 'source-neurotechnology-bci-foreign-body', 'batch-5', 'supported', locations.foreignBody,
    'The abstract directly reviews acute and chronic brain-tissue reactions against implanted electrode systems.', 'None. Preserve the review scope.', { artifactVersion: 'version-of-record', inspectionDepth: 'abstract-only' }),
  decision('neurotechnology-bci-wireless-neural-telemetry', 'neurotechnology-bci', 'source-neurotechnology-bci-foreign-body', 'batch-5', 'insufficient-evidence', locations.foreignBody,
    'The inspected abstract does not address wireless telemetry, but the full review was not available; abstract absence is not a full-document mismatch finding.', 'Inspect the full review or bind a wireless neural-telemetry source.', { artifactVersion: 'version-of-record', inspectionDepth: 'abstract-only' }),
  decision('neurotechnology-bci-neural-data-compression', 'neurotechnology-bci', 'source-neurotechnology-bci-foreign-body', 'batch-5', 'insufficient-evidence', locations.foreignBody,
    'The inspected abstract does not address neural-data compression, but the full review was not available; abstract absence is not a full-document mismatch finding.', 'Inspect the full review or bind a neural-data-compression source.', { artifactVersion: 'version-of-record', inspectionDepth: 'abstract-only' }),
  decision('neurotechnology-bci-clinical-translation-boundaries', 'neurotechnology-bci', 'source-neurotechnology-bci-foreign-body', 'batch-5', 'partially-supported', locations.foreignBody,
    'The abstract contrasts acute performance with unreliable clinically relevant chronic operation, but does not define a complete translation framework.', 'Narrow to chronic reliability and biocompatibility constraints or inspect the full review.', { artifactVersion: 'version-of-record', inspectionDepth: 'abstract-only' }),
] as const
