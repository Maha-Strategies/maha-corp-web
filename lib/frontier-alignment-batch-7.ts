/**
 * Frontier source-alignment Batch 7.
 *
 * This is a bounded re-inspection cohort: thirty-five records were attempted in
 * earlier batches but their declared source content was never opened; five
 * mechanistic-interpretability records receive their first judgement here.
 * The decisions below record internal editorial inspection only. They are not
 * external review, scientific reproduction, or permission to publish.
 */

export const ALIGNMENT_BATCH_7_VERSION = 'maha-frontier-alignment-batch/7.0' as const

export type Batch7Verdict =
  | 'supported'
  | 'partially-supported'
  | 'mismatched'
  | 'inaccessible-source'

export interface Batch7Decision {
  recordId: string
  domainSlug: string
  sourceContractId: string
  priorBatchId: 'batch-3' | 'batch-5' | 'batch-6' | null
  verdict: Batch7Verdict
  sourceContentInspected: boolean
  inspectedContentLocation: string | null
  mismatchBasis?: 'inspected-content-different-subject'
  reason: string
  remediation: string
  origin?: 'independently-curated'
  artifactVersion:
    | 'version-of-record'
    | 'accepted-manuscript'
    | 'repository-copy'
    | 'government-report'
    | 'living-specification'
    | 'not-inspected'
  inspectionDepth: 'abstract-only' | 'specified-sections' | 'full-document' | 'not-inspected'
  versionRelationshipVerified: boolean
  recoveryDisposition: 'open-copy-located' | 'authentication-wall'
}

const location = {
  autogen: 'arXiv:2308.08155v2, §§2.1–2.2 and §§3–4 (complete HTML article inspected)',
  toehold:
    'PMC4243060, abstract, Development of paper-based technology, toehold-switch results, Discussion, and Experimental Procedures',
  mcs: 'USGS Mineral Commodity Summaries 2026, Cobalt pp. 70–71, Graphite pp. 92–93, Indium pp. 98–99, and Tungsten pp. 200–201',
  nif: 'LLNL/NIF “Achieving Fusion Ignition”, What Is Ignition, milestones, Gaining New Understanding, and Setting Energy Records',
  autophagy:
    'PMC3404883, Guidelines §§ “Monitoring autophagy”, “LC3 turnover”, “SQSTM1/p62”, and lysosomal-inhibitor cautions',
  feature:
    'Distill 2017 “Feature Visualization”, Feature Visualization by Optimization, objectives, regularization, diversity, and interpretation cautions',
  ecog: 'PMC3235709, abstract, Electrode array fabrication and testing, in-vivo results, Discussion, and Methods',
} as const

function decision(
  recordId: string,
  domainSlug: string,
  sourceContractId: string,
  priorBatchId: Batch7Decision['priorBatchId'],
  verdict: Batch7Verdict,
  inspectedContentLocation: string | null,
  reason: string,
  remediation: string,
  options: Partial<Pick<Batch7Decision, 'artifactVersion' | 'inspectionDepth' | 'versionRelationshipVerified' | 'recoveryDisposition'>> = {},
): Batch7Decision {
  const inspected = inspectedContentLocation !== null
  return {
    recordId: `urn:maha:record:${recordId}`,
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

export const ALIGNMENT_BATCH_7_DECISIONS: readonly Batch7Decision[] = [
  // Advanced materials: the DOI and metadata resolve, but the IEEE article is
  // closed and OpenAlex reports no repository full text. Metadata is not read.
  ...[
    'advanced-materials-color-centers-in-diamond',
    'advanced-materials-diamond-thermal-conductivity',
    'advanced-materials-diamond-wafer-substrates',
    'advanced-materials-gallium-nitride-epitaxy',
    'advanced-materials-sic-wide-bandgap-substrates',
  ].map((recordId) =>
    decision(
      recordId,
      'advanced-materials',
      'source-advanced-materials-wide-bandgap',
      'batch-6',
      'inaccessible-source',
      null,
      'The declared IEEE article is closed-access. Crossref and the institutional record verify its identity, while OpenAlex reports no open repository copy; no article content was accepted for inspection.',
      'Obtain an authorized copy of Hudgins et al. 2003 and judge each subject from the actual pages 907–914.',
      { artifactVersion: 'not-inspected', inspectionDepth: 'not-inspected', versionRelationshipVerified: false, recoveryDisposition: 'authentication-wall' },
    ),
  ),

  // Agentic systems: arXiv version 2 is the declared work and was read.
  decision('agentic-systems-mcp-agent-memory-boundaries', 'agentic-systems-mcp', 'source-agentic-systems-mcp-autogen', 'batch-6', 'partially-supported', location.autogen,
    'AutoGen states that a conversable agent maintains internal context from sent and received messages, but it does not define persistence, retention, or isolation boundaries for agent memory.',
    'Narrow to conversation-context state or bind a source that specifies memory isolation and retention.',
    { artifactVersion: 'repository-copy', inspectionDepth: 'full-document' }),
  decision('agentic-systems-mcp-agentic-evaluation-protocols', 'agentic-systems-mcp', 'source-agentic-systems-mcp-autogen', 'batch-6', 'partially-supported', location.autogen,
    'The paper reports benchmarks, pilot studies, ablations, and manually crafted tasks, but not a reusable or preregistered agent-evaluation protocol.',
    'Narrow to the paper’s reported evaluations or bind a protocol source with declared tasks, metrics, and controls.',
    { artifactVersion: 'repository-copy', inspectionDepth: 'full-document' }),
  decision('agentic-systems-mcp-game-theoretic-incentive-misalignment', 'agentic-systems-mcp', 'source-agentic-systems-mcp-autogen', 'batch-6', 'mismatched', location.autogen,
    'The full article concerns configurable multi-agent conversation and applications; it supplies no game-theoretic incentive model or incentive-misalignment result.',
    'Bind a source that defines agents, utilities, strategic choices, and the claimed misalignment outcome.',
    { artifactVersion: 'repository-copy', inspectionDepth: 'full-document' }),
  decision('agentic-systems-mcp-prompt-injection-through-tools', 'agentic-systems-mcp', 'source-agentic-systems-mcp-autogen', 'batch-6', 'mismatched', location.autogen,
    'The inspected paper describes tool and code execution but does not study prompt injection through tool inputs or outputs.',
    'Bind an empirical or security-analysis source that tests indirect prompt injection through tools.',
    { artifactVersion: 'repository-copy', inspectionDepth: 'full-document' }),
  decision('agentic-systems-mcp-tool-output-trust-boundaries', 'agentic-systems-mcp', 'source-agentic-systems-mcp-autogen', 'batch-6', 'partially-supported', location.autogen,
    'The OptiGuide example places a safeguard before code execution, but the paper does not define a general trust boundary for arbitrary tool outputs.',
    'Narrow to the demonstrated code-safeguard workflow or bind a general tool-output validation source.',
    { artifactVersion: 'repository-copy', inspectionDepth: 'full-document' }),

  // Biomolecular engineering: the declared Cell article was read through PMC.
  decision('biomolecular-engineering-compartmentalized-cell-free-systems', 'biomolecular-engineering', 'source-biomolecular-engineering-toehold', 'batch-5', 'mismatched', location.toehold,
    'The paper embeds cell-free systems in paper and other porous substrates. It mentions liposome work as prior art but does not demonstrate a compartmentalized cell-free system.',
    'Bind a source that experimentally implements cell-free reactions in droplets, vesicles, or other compartments.',
    { artifactVersion: 'accepted-manuscript', inspectionDepth: 'full-document' }),
  decision('biomolecular-engineering-droplet-microfluidic-screening', 'biomolecular-engineering', 'source-biomolecular-engineering-toehold', 'batch-5', 'mismatched', location.toehold,
    'The article uses paper-disc arrays and contains no droplet-microfluidic screening experiment.',
    'Bind a source that reports droplet generation, sorting, and screening measurements.',
    { artifactVersion: 'repository-copy', inspectionDepth: 'full-document' }),
  decision('biomolecular-engineering-enzyme-cascade-engineering', 'biomolecular-engineering', 'source-biomolecular-engineering-toehold', 'batch-5', 'mismatched', location.toehold,
    'The inspected article demonstrates gene circuits and diagnostics, not engineered multi-enzyme cascades.',
    'Bind a source that constructs and measures an enzyme cascade.',
    { artifactVersion: 'repository-copy', inspectionDepth: 'full-document' }),
  decision('biomolecular-engineering-metabolic-pathway-prototyping', 'biomolecular-engineering', 'source-biomolecular-engineering-toehold', 'batch-5', 'partially-supported', location.toehold,
    'The Discussion proposes extending paper-based reactions to prototyping metabolic pathways, but the study does not demonstrate that application.',
    'Narrow to a proposed use or bind a study that prototypes and measures a metabolic pathway.',
    { artifactVersion: 'repository-copy', inspectionDepth: 'full-document' }),
  decision('biomolecular-engineering-translational-control-circuits', 'biomolecular-engineering', 'source-biomolecular-engineering-toehold', 'batch-5', 'supported', location.toehold,
    'The article constructs and tests toehold switches and other RNA-actuated circuits that regulate translation in cell-free reactions.',
    'None. Keep the mapping and record it as curated rather than positional.',
    { artifactVersion: 'repository-copy', inspectionDepth: 'full-document' }),

  // Critical supply chains: official USGS government report inspected locally.
  decision('critical-supply-chains-cobalt-refining-concentration', 'critical-supply-chains', 'source-critical-supply-chains-mcs-industrial', 'batch-5', 'partially-supported', location.mcs,
    'The cobalt chapter identifies China as the leading refined-cobalt producer and Congo (Kinshasa) as 73% of mined supply, but it does not quantify China’s refining share.',
    'Narrow to the reported qualitative concentration or bind refinery-capacity data with explicit shares.',
    { artifactVersion: 'government-report', inspectionDepth: 'specified-sections' }),
  decision('critical-supply-chains-graphite-anode-processing', 'critical-supply-chains', 'source-critical-supply-chains-mcs-industrial', 'batch-5', 'partially-supported', location.mcs,
    'The graphite chapter reports active-anode material and spherical-purified-graphite trade and facilities, but not the processing sequence or qualification boundary.',
    'Narrow to facility and trade context or bind process-specific anode-production evidence.',
    { artifactVersion: 'government-report', inspectionDepth: 'specified-sections' }),
  decision('critical-supply-chains-indium-zinc-byproduct-flow', 'critical-supply-chains', 'source-critical-supply-chains-mcs-industrial', 'batch-5', 'partially-supported', location.mcs,
    'The indium chapter states that indium is most commonly recovered from zinc-sulfide sphalerite, but does not quantify a zinc-to-indium material flow.',
    'Narrow to byproduct provenance or bind a source with recovery yields and flow quantities.',
    { artifactVersion: 'government-report', inspectionDepth: 'specified-sections' }),
  decision('critical-supply-chains-magnet-recycling', 'critical-supply-chains', 'source-critical-supply-chains-mcs-industrial', 'batch-5', 'mismatched', location.mcs,
    'The four inspected commodity chapters discuss cobalt, graphite, indium, and tungsten recycling or scrap but do not treat permanent-magnet recycling.',
    'Bind a source specific to Nd-Fe-B or other permanent-magnet recovery.',
    { artifactVersion: 'government-report', inspectionDepth: 'specified-sections' }),
  decision('critical-supply-chains-tungsten-concentrate-processing', 'critical-supply-chains', 'source-critical-supply-chains-mcs-industrial', 'batch-5', 'partially-supported', location.mcs,
    'The tungsten chapter states that U.S. companies convert concentrates, APT, oxide, or scrap into powders and chemicals, but it does not describe the processing route.',
    'Narrow to conversion capability or bind a process source with unit operations and yields.',
    { artifactVersion: 'government-report', inspectionDepth: 'specified-sections' }),

  // Fusion: official LLNL living page, inspected as a bounded facility account.
  decision('fusion-plasma-systems-inertial-confinement-target-chamber', 'fusion-plasma-systems', 'source-fusion-plasma-systems-nif-ignition', 'batch-6', 'partially-supported', location.nif,
    'The page places the target and laser delivery in NIF’s Target Chamber, but does not provide a bounded chamber architecture or engineering specification.',
    'Narrow to the experiment location or bind the NIF Target Chamber engineering description.',
    { artifactVersion: 'living-specification', inspectionDepth: 'specified-sections' }),
  decision('fusion-plasma-systems-laser-target-coupling', 'fusion-plasma-systems', 'source-fusion-plasma-systems-nif-ignition', 'batch-6', 'supported', location.nif,
    'The page describes laser beams coupling through a hohlraum to x rays that drive the capsule and reports laser energy delivered to the target alongside fusion yield.',
    'None. Keep the mapping and its facility-specific boundary.',
    { artifactVersion: 'living-specification', inspectionDepth: 'specified-sections' }),
  decision('fusion-plasma-systems-magnetic-mirror-confinement', 'fusion-plasma-systems', 'source-fusion-plasma-systems-nif-ignition', 'batch-6', 'mismatched', location.nif,
    'The page concerns inertial confinement driven by lasers and contains no magnetic-mirror confinement system.',
    'Bind a magnetic-mirror experiment or review.',
    { artifactVersion: 'living-specification', inspectionDepth: 'specified-sections' }),
  decision('fusion-plasma-systems-neutron-material-damage', 'fusion-plasma-systems', 'source-fusion-plasma-systems-nif-ignition', 'batch-6', 'mismatched', location.nif,
    'The inspected sections report neutron yield and diagnostics but do not measure neutron-induced material damage.',
    'Bind irradiation data or a materials-damage study.',
    { artifactVersion: 'living-specification', inspectionDepth: 'specified-sections' }),
  decision('fusion-plasma-systems-remote-handling-maintenance', 'fusion-plasma-systems', 'source-fusion-plasma-systems-nif-ignition', 'batch-6', 'mismatched', location.nif,
    'The inspected page does not describe remote-handling equipment or maintenance operations.',
    'Bind a facility engineering source that specifies remote handling and maintenance.',
    { artifactVersion: 'living-specification', inspectionDepth: 'specified-sections' }),

  // Longevity: open full text directly treats all five assay boundaries.
  decision('longevity-metabolism-autophagosome-abundance', 'longevity-metabolism', 'source-longevity-metabolism-autophagy-guidelines', 'batch-3', 'supported', location.autophagy,
    'The guidelines distinguish static autophagosome abundance from flux and explain why abundance alone is ambiguous.',
    'None. Preserve the explicit “abundance is not flux” boundary.',
    { artifactVersion: 'version-of-record', inspectionDepth: 'specified-sections' }),
  decision('longevity-metabolism-autophagic-flux', 'longevity-metabolism', 'source-longevity-metabolism-autophagy-guidelines', 'batch-3', 'supported', location.autophagy,
    'The guidelines define autophagic flux as the full pathway through lysosomal delivery, breakdown, and product release, and prescribe dynamic measurement.',
    'None. Keep the mapping and assay boundary.',
    { artifactVersion: 'version-of-record', inspectionDepth: 'specified-sections' }),
  decision('longevity-metabolism-lc3-turnover-assays', 'longevity-metabolism', 'source-longevity-metabolism-autophagy-guidelines', 'batch-3', 'supported', location.autophagy,
    'The guidelines describe LC3-II turnover and comparison with and without lysosomal inhibitors as a flux assay.',
    'None. Retain the context-specific cautions.',
    { artifactVersion: 'version-of-record', inspectionDepth: 'specified-sections' }),
  decision('longevity-metabolism-lysosomal-degradation-blockade', 'longevity-metabolism', 'source-longevity-metabolism-autophagy-guidelines', 'batch-3', 'supported', location.autophagy,
    'The guidelines specify protease inhibitors, lysosomal pH neutralizers, and fusion blocks, including their interpretation limits.',
    'None. Preserve inhibitor toxicity and off-target cautions.',
    { artifactVersion: 'version-of-record', inspectionDepth: 'specified-sections' }),
  decision('longevity-metabolism-p62-sqstm1-turnover', 'longevity-metabolism', 'source-longevity-metabolism-autophagy-guidelines', 'batch-3', 'supported', location.autophagy,
    'The guidelines describe SQSTM1/p62 incorporation into autophagosomes, degradation in autolysosomes, and context-dependent turnover assays.',
    'None. Preserve the warning that steady-state p62 can be confounded by synthesis and cell context.',
    { artifactVersion: 'version-of-record', inspectionDepth: 'specified-sections' }),

  // Mechanistic interpretability: first judgements for these five records.
  decision('mechanistic-interpretability-automated-feature-interpretation', 'mechanistic-interpretability', 'source-mechanistic-interpretability-feature-visualization', null, 'mismatched', location.feature,
    'The article automates input optimization to produce visualizations, but human interpretation remains the object; it does not define automated feature interpretation.',
    'Bind a source that evaluates machine-generated feature descriptions or labels.',
    { artifactVersion: 'version-of-record', inspectionDepth: 'full-document' }),
  decision('mechanistic-interpretability-causal-feature-intervention', 'mechanistic-interpretability', 'source-mechanistic-interpretability-feature-visualization', null, 'mismatched', location.feature,
    'Optimizing an input to activate a unit is not a causal intervention on an internal feature, and the article does not claim that equivalence.',
    'Bind an activation-intervention or causal-mediation source.',
    { artifactVersion: 'version-of-record', inspectionDepth: 'full-document' }),
  decision('mechanistic-interpretability-cross-layer-transcoders', 'mechanistic-interpretability', 'source-mechanistic-interpretability-feature-visualization', null, 'mismatched', location.feature,
    'The article predates and does not describe cross-layer transcoders.',
    'Bind the technique-specific source.',
    { artifactVersion: 'version-of-record', inspectionDepth: 'full-document' }),
  decision('mechanistic-interpretability-dead-features', 'mechanistic-interpretability', 'source-mechanistic-interpretability-feature-visualization', null, 'mismatched', location.feature,
    'The article discusses visualization objectives and regularization but does not define dead features in learned dictionaries.',
    'Bind a sparse-autoencoder source that measures inactive or dead features.',
    { artifactVersion: 'version-of-record', inspectionDepth: 'full-document' }),
  decision('mechanistic-interpretability-feature-activation-maximization', 'mechanistic-interpretability', 'source-mechanistic-interpretability-feature-visualization', null, 'supported', location.feature,
    'The article directly defines optimization of an input to maximize a neuron, channel, layer, or class objective and documents regularization and diversity controls.',
    'None. Keep the mapping and its visualization-not-explanation boundary.',
    { artifactVersion: 'version-of-record', inspectionDepth: 'full-document' }),

  // Neurotechnology: PMC full text replaces the failed OSTI retrieval route.
  decision('neurotechnology-bci-electrocorticography-spatial-resolution', 'neurotechnology-bci', 'source-neurotechnology-bci-micro-ecog', 'batch-6', 'supported', location.ecog,
    'The paper reports 500 μm electrode spacing over a 10 × 9 mm area and compares that spatial scale with clinical ECoG.',
    'None. Keep the mapping and reported geometry.',
    { artifactVersion: 'version-of-record', inspectionDepth: 'full-document' }),
  decision('neurotechnology-bci-electrode-tissue-interface', 'neurotechnology-bci', 'source-neurotechnology-bci-micro-ecog', 'batch-6', 'partially-supported', location.ecog,
    'The paper describes non-penetrating electrodes, encapsulation, and placement on cortex, but does not characterize chronic tissue response at the interface.',
    'Narrow to the physical interface design or bind chronic histology and interface-stability evidence.',
    { artifactVersion: 'version-of-record', inspectionDepth: 'full-document' }),
  decision('neurotechnology-bci-flexible-conformal-electrode-arrays', 'neurotechnology-bci', 'source-neurotechnology-bci-micro-ecog', 'batch-6', 'supported', location.ecog,
    'The article fabricates an ultrathin flexible array, quantifies reduced bending stiffness, and demonstrates folding around curved geometry for in-vivo mapping.',
    'None. Keep the mapping and device-specific dimensions.',
    { artifactVersion: 'version-of-record', inspectionDepth: 'full-document' }),
  decision('neurotechnology-bci-impedance-and-noise', 'neurotechnology-bci', 'source-neurotechnology-bci-micro-ecog', 'batch-6', 'partially-supported', location.ecog,
    'The paper reports low multiplexer crosstalk and signal-to-noise advantages, but the inspected text does not establish a general electrode-impedance model.',
    'Narrow to measured crosstalk and recording quality or bind an impedance-characterization source.',
    { artifactVersion: 'version-of-record', inspectionDepth: 'full-document' }),
  decision('neurotechnology-bci-micro-ecog-arrays', 'neurotechnology-bci', 'source-neurotechnology-bci-micro-ecog', 'batch-6', 'supported', location.ecog,
    'The paper directly reports a 360-channel active μECoG array with multiplexed sensors and in-vivo cortical recordings.',
    'None. Keep the mapping and device-specific scope.',
    { artifactVersion: 'version-of-record', inspectionDepth: 'full-document' }),
]

if (ALIGNMENT_BATCH_7_DECISIONS.length !== 40) {
  throw new Error(`Batch 7 must contain exactly 40 decisions; found ${ALIGNMENT_BATCH_7_DECISIONS.length}.`)
}
if (new Set(ALIGNMENT_BATCH_7_DECISIONS.map((entry) => entry.recordId)).size !== 40) {
  throw new Error('Batch 7 record membership is not unique.')
}
const domainCounts = new Map<string, number>()
for (const entry of ALIGNMENT_BATCH_7_DECISIONS) {
  domainCounts.set(entry.domainSlug, (domainCounts.get(entry.domainSlug) ?? 0) + 1)
  if (entry.sourceContentInspected !== (entry.inspectedContentLocation !== null)) {
    throw new Error(`${entry.recordId}: Batch 7 inspection flag and location disagree.`)
  }
  if (entry.verdict === 'inaccessible-source' && entry.sourceContentInspected) {
    throw new Error(`${entry.recordId}: inaccessible Batch 7 source cannot be inspected.`)
  }
}
if (domainCounts.size !== 8 || [...domainCounts.values()].some((count) => count !== 5)) {
  throw new Error('Batch 7 must contain five records in each of eight domains.')
}
