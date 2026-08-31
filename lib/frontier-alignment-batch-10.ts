/**
 * Frontier source-alignment Batch 10.
 *
 * Twenty records are selected from the sixty-six active, content-confirmed
 * mismatches not covered by Batch 9. Selection favours records that occur in
 * the substantial-page compiler, Evidence Dossier candidate paths, or the
 * Quantum Bridge endpoint plan. Each proposed source was opened and inspected
 * at the exact locator recorded below. Proposals remain private and fail closed:
 * they do not replace an active source, revise a record, clear a blocker, or
 * authorize publication.
 */

export const ALIGNMENT_BATCH_10_VERSION = 'maha-frontier-alignment-batch/10.0' as const

export type Batch10ProductUnlock =
  | 'substantial-page'
  | 'evidence-dossier'
  | 'quantum-bridge'

export type Batch10ArtifactVersion =
  | 'version-of-record'
  | 'preprint'
  | 'repository-copy'
  | 'government-report'
  | 'living-specification'
  | 'patent'

export type Batch10InspectionDepth =
  | 'abstract-only'
  | 'specified-sections'
  | 'full-document'

export interface Batch10Priority {
  productRelevance: 0 | 1 | 2 | 3 | 4
  graphLeverage: 0 | 1 | 2 | 3
  correctionValue: 0 | 1 | 2
  inspectability: 0 | 1
  total: number
  unlocks: readonly Batch10ProductUnlock[]
  rationale: string
}

export interface Batch10ReplacementInspection {
  metadataVerified: true
  metadataNote: string
  artifactVersion: Batch10ArtifactVersion
  inspectionDepth: Batch10InspectionDepth
  contentInspected: true
  exactLocatorInspected: true
  inspectedContentLocation: string
  findings: string
  limitation: string
}

export interface Batch10RemediationPacket {
  packetId: string
  recordId: string
  domainSlug: string
  priority: Batch10Priority
  currentVerdict: 'mismatched'
  replacement: {
    proposedSourceContractId: string
    replacementDecision: 'replacement-supported'
    citation: string
    identifier: string
    url: string
    rationale: string
    rights: {
      basis: 'citation-with-paraphrase'
      quotationUsed: false
      sourceContentCommitted: false
    }
    inspection: Batch10ReplacementInspection
  }
  disposition: 'blocked-pending-source-override-review'
  canonicalMutationAuthorized: false
  promotionEligible: false
  externallyReviewed: false
  independentlyReproduced: false
  whatWouldChangeIfAccepted: string
}

interface PacketInput {
  slug: string
  domainSlug: string
  score: readonly [Batch10Priority['productRelevance'], Batch10Priority['graphLeverage'], Batch10Priority['correctionValue'], Batch10Priority['inspectability']]
  unlocks: readonly Batch10ProductUnlock[]
  priorityRationale: string
  citation: string
  identifier: string
  url: string
  rationale: string
  metadataNote: string
  artifactVersion: Batch10ArtifactVersion
  inspectionDepth: Batch10InspectionDepth
  inspectedContentLocation: string
  findings: string
  limitation: string
}

function packet(input: PacketInput): Batch10RemediationPacket {
  const [productRelevance, graphLeverage, correctionValue, inspectability] = input.score
  return {
    packetId: `urn:maha:remediation:frontier-alignment-batch-10:${input.slug}`,
    recordId: `urn:maha:record:${input.slug}`,
    domainSlug: input.domainSlug,
    priority: {
      productRelevance,
      graphLeverage,
      correctionValue,
      inspectability,
      total: productRelevance + graphLeverage + correctionValue + inspectability,
      unlocks: input.unlocks,
      rationale: input.priorityRationale,
    },
    currentVerdict: 'mismatched',
    replacement: {
      proposedSourceContractId: `source-remediation-batch-10-${input.slug}`,
      replacementDecision: 'replacement-supported',
      citation: input.citation,
      identifier: input.identifier,
      url: input.url,
      rationale: input.rationale,
      rights: {
        basis: 'citation-with-paraphrase',
        quotationUsed: false,
        sourceContentCommitted: false,
      },
      inspection: {
        metadataVerified: true,
        metadataNote: input.metadataNote,
        artifactVersion: input.artifactVersion,
        inspectionDepth: input.inspectionDepth,
        contentInspected: true,
        exactLocatorInspected: true,
        inspectedContentLocation: input.inspectedContentLocation,
        findings: input.findings,
        limitation: input.limitation,
      },
    },
    disposition: 'blocked-pending-source-override-review',
    canonicalMutationAuthorized: false,
    promotionEligible: false,
    externallyReviewed: false,
    independentlyReproduced: false,
    whatWouldChangeIfAccepted: `Acceptance would create a new revision of ${input.slug} whose single claim cites the inspected replacement and exact locator. It would not mutate the existing revision, inherit review, imply reproduction, authorize canonical release, or widen the claim beyond the inspected source.`,
  }
}

const inputs: readonly PacketInput[] = [
  {
    slug: 'advanced-materials-moire-superlattices', domainSlug: 'advanced-materials', score: [4, 3, 2, 1], unlocks: ['substantial-page', 'quantum-bridge'],
    priorityRationale: 'Occurs in the substantial-page selection and two Quantum Bridge endpoint dispositions.',
    citation: 'Bistritzer, R. & MacDonald, A. H. Moiré bands in twisted double-layer graphene. PNAS 108, 12233–12237 (2011).',
    identifier: 'doi:10.1073/pnas.1108174108', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC3145708/',
    rationale: 'The article directly derives moiré Bloch bands for twisted double-layer graphene.',
    metadataNote: 'The PMC version of record identifies both authors, PNAS volume and pages, and DOI.', artifactVersion: 'version-of-record', inspectionDepth: 'full-document',
    inspectedContentLocation: 'Abstract; “Model”; “Discussion”; equations 1–5; figures 1–5.',
    findings: 'The inspected article links relative layer twist to a moiré pattern, a periodic continuum Hamiltonian, moiré Bloch bands, and twist-angle-dependent band flattening.',
    limitation: 'It is a continuum-model study, not a manufacturing method or evidence that every moiré material realizes the same bands.',
  },
  {
    slug: 'advanced-materials-twist-angle-control', domainSlug: 'advanced-materials', score: [4, 3, 2, 1], unlocks: ['substantial-page', 'quantum-bridge'],
    priorityRationale: 'Connects the substantial-page graph to a Quantum Bridge endpoint and a foundational fabrication control.',
    citation: 'Yang, Y. et al. In situ manipulation of van der Waals heterostructures for twistronics. Science Advances 6, eabd3655 (2020).',
    identifier: 'doi:10.1126/sciadv.abd3655', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC7717928/',
    rationale: 'The experiment directly demonstrates dynamic in situ rotation and manipulation of layered heterostructures.',
    metadataNote: 'PMC and the article identify the ten authors, Science Advances article number, and DOI.', artifactVersion: 'version-of-record', inspectionDepth: 'specified-sections',
    inspectedContentLocation: 'Abstract; Introduction paragraphs on twist-angle control; Results, device construction and in situ rotation.',
    findings: 'The article reports a manipulation technique that dynamically rotates 2D layers and fabricates aligned graphene/hBN heterostructures with tunable twist angles.',
    limitation: 'The source establishes an experimental control method, not a comparison between every twist-control technique or scalable manufacturing yield.',
  },
  {
    slug: 'agentic-systems-mcp-least-authority-tokens', domainSlug: 'agentic-systems-mcp', score: [4, 3, 2, 1], unlocks: ['substantial-page', 'quantum-bridge', 'evidence-dossier'],
    priorityRationale: 'Directly supports licensed MCP retrieval and two bridge dispositions.',
    citation: 'Birgisson, A. et al. Macaroons: Cookies with Contextual Caveats for Decentralized Authorization in the Cloud. NDSS (2014).',
    identifier: 'url:https://research.google.com/pubs/archive/41892.pdf', url: 'https://research.google.com/pubs/archive/41892.pdf',
    rationale: 'Macaroons implement attenuable bearer authority through contextual caveats.',
    metadataNote: 'Google Research and the inspected NDSS PDF agree on title, six authors, venue, and year.', artifactVersion: 'version-of-record', inspectionDepth: 'specified-sections',
    inspectedContentLocation: 'Abstract; §I Introduction; §II Motivation and Foundations; figure 1 and caveat construction.',
    findings: 'The paper describes bearer credentials whose caveats restrict objects, actions, context, delegation, and third-party approval.',
    limitation: 'Macaroons are one least-authority credential design; the paper does not prove that every token deployment is least-authority or secure.',
  },
  {
    slug: 'agentic-systems-mcp-sandboxed-tool-execution', domainSlug: 'agentic-systems-mcp', score: [4, 3, 2, 1], unlocks: ['substantial-page', 'quantum-bridge', 'evidence-dossier'],
    priorityRationale: 'Defines a core machine-infrastructure execution boundary and appears twice in bridge planning.',
    citation: 'Tan, Z. et al. MCP-SandboxScan: WASM-based Secure Execution and Runtime Analysis for MCP Tools. arXiv:2601.01241 (2026).',
    identifier: 'arXiv:2601.01241', url: 'https://arxiv.org/abs/2601.01241',
    rationale: 'The paper directly executes untrusted MCP tools inside a WebAssembly/WASI sandbox and audits runtime exposures.',
    metadataNote: 'The arXiv record identifies five authors, title, submission date, and versioned preprint.', artifactVersion: 'preprint', inspectionDepth: 'abstract-only',
    inspectedContentLocation: 'arXiv:2601.01241 abstract, prototype description, three tool case studies, and stated benchmark limits.',
    findings: 'The abstract describes WASM/WASI sandbox execution, external-input-to-output tracing, and observed filesystem-capability violations.',
    limitation: 'Three tool case studies and a micro-benchmark do not establish complete isolation, universal threat coverage, or production readiness.',
  },
  {
    slug: 'biomolecular-engineering-enzyme-cascade-engineering', domainSlug: 'biomolecular-engineering', score: [4, 3, 2, 1], unlocks: ['substantial-page', 'quantum-bridge', 'evidence-dossier'],
    priorityRationale: 'A dossier-suitable quantitative method and an explicit bridge endpoint candidate.',
    citation: 'Hold, C., Billerbeck, S. & Panke, S. Forward design of a complex enzyme cascade reaction. Nature Communications 7, 12971 (2016).',
    identifier: 'doi:10.1038/ncomms12971', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC5052792/',
    rationale: 'The study directly engineers and optimizes an in vitro ten-enzyme cascade.',
    metadataNote: 'PMC identifies the three authors, article number, DOI, and CC BY 4.0 version of record.', artifactVersion: 'version-of-record', inspectionDepth: 'specified-sections',
    inspectedContentLocation: 'Abstract; “Model formulation and parameterization”; “Optimizing a cascade reaction for product concentration”.',
    findings: 'The study combines perturbation experiments, online mass spectrometry, mechanistic rate laws, parameter estimation, and model-based optimization for a ten-enzyme cascade.',
    limitation: 'The result is specific to the constructed in vitro system and does not establish general transfer to all enzyme networks or production scales.',
  },
  {
    slug: 'critical-supply-chains-semiconductor-grade-polysilicon', domainSlug: 'critical-supply-chains', score: [4, 3, 2, 1], unlocks: ['substantial-page', 'quantum-bridge', 'evidence-dossier'],
    priorityRationale: 'A semiconductor feedstock chokepoint tied to both substantial-page and bridge planning.',
    citation: 'Costogue, E. N. et al. Polycrystalline silicon study: low-cost refining technology prospects and semiconductor-grade availability through 1988. JPL-PUB-84-41 (1984).',
    identifier: 'ntrs:19840025142', url: 'https://ntrs.nasa.gov/citations/19840025142',
    rationale: 'The government report directly reviews semiconductor-grade polysilicon supply and Siemens, silane, and fluidized-bed refining routes.',
    metadataNote: 'NASA NTRS identifies five JPL authors, publication date, report numbers, public-use status, and downloadable contractor report.', artifactVersion: 'government-report', inspectionDepth: 'specified-sections',
    inspectedContentLocation: 'Executive summary; §II commercial polysilicon industry; §III DOE silicon refining process research; silane-to-silicon conversion subsection.',
    findings: 'The report distinguishes semiconductor-grade polycrystalline silicon and documents Siemens-process supply plus alternative silane and fluidized-bed process development.',
    limitation: 'It is a 1984 industry and R&D assessment; it does not establish current capacity, present suppliers, or modern qualification economics.',
  },
  {
    slug: 'critical-supply-chains-fluorinated-resist-components', domainSlug: 'critical-supply-chains', score: [4, 2, 2, 1], unlocks: ['substantial-page', 'evidence-dossier'],
    priorityRationale: 'Repairs a semiconductor-materials source defect and supports a dossier-ready lithography topic.',
    citation: 'Thakur, N. et al. Fluorine-Rich Zinc Oxoclusters as Extreme Ultraviolet Photoresists: Chemical Reactions and Lithography Performance. ACS Materials Au 2, 343–355 (2022).',
    identifier: 'doi:10.1021/acsmaterialsau.1c00059', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC9888611/',
    rationale: 'The experimental paper directly studies fluorinated components in an EUV photoresist formulation.',
    metadataNote: 'PMC and the institutional repository identify nine authors, journal, pages, DOI, and final article.', artifactVersion: 'version-of-record', inspectionDepth: 'full-document',
    inspectedContentLocation: 'Abstract; figure 1 and study design; EUV lithography and spectroscopy results; Conclusions.',
    findings: 'The paper measures fluorine-rich zinc oxocluster resists and reports EUV absorption, sensitivity, thin-film behavior, and carbon–fluorine bond chemistry.',
    limitation: 'One zinc-oxocluster family does not define the full commercial supply chain or performance of all fluorinated resist components.',
  },
  {
    slug: 'critical-supply-chains-quartz-crucible-manufacturing', domainSlug: 'critical-supply-chains', score: [4, 2, 2, 1], unlocks: ['substantial-page', 'evidence-dossier'],
    priorityRationale: 'A semiconductor crystal-growth chokepoint and substantial-page candidate with a directly inspectable manufacturing disclosure.',
    citation: 'Kumagai, K. et al. Method for producing quartz glass crucible for use in pulling silicon single crystal. US Patent 7,587,912 (2009).',
    identifier: 'patent:US7587912B2', url: 'https://patents.google.com/patent/US7587912B2/en',
    rationale: 'The patent directly specifies rotating-mold, silica-powder, vacuum, arc-melting, and layered crucible production steps.',
    metadataNote: 'Google Patents serves the published US patent, inventors, assignee, legal chronology, claims, description, and drawings.', artifactVersion: 'patent', inspectionDepth: 'specified-sections',
    inspectedContentLocation: 'Abstract; Background; production-method description; figure 1; independent manufacturing claims.',
    findings: 'The disclosure describes centrifugal forming in a rotating gas-permeable mold, vacuum gas removal, arc melting, and formation of translucent outer and transparent inner quartz-glass layers.',
    limitation: 'A patent discloses a claimed method, not independent evidence of manufacturing yield, commercial adoption, or comparative superiority.',
  },
  {
    slug: 'fusion-plasma-systems-magnetic-mirror-confinement', domainSlug: 'fusion-plasma-systems', score: [4, 2, 2, 1], unlocks: ['substantial-page', 'evidence-dossier'],
    priorityRationale: 'A distinct confinement architecture and a high-value fusion methodology page.',
    citation: 'Coensgen, F. H. & Simonen, T. C. Magnetic Mirror Confinement of High-Energy, High-Density Plasma. UCRL-82790 (1979).',
    identifier: 'osti:5879720', url: 'https://www.osti.gov/servlets/purl/5879720',
    rationale: 'The inspected DOE report directly describes magnetic-mirror experiments, confinement issues, impurities, and the MFTF bridge.',
    metadataNote: 'The LLNL report header identifies both authors, report number, date, and DOE repository artifact.', artifactVersion: 'government-report', inspectionDepth: 'specified-sections',
    inspectedContentLocation: 'Mirror-confinement overview; impurity studies; 2XIIB results; “MFTF Experiments”.',
    findings: 'The report treats magnetic-mirror confinement as an open-field plasma-confinement approach and reports experimental impurity and confinement observations.',
    limitation: 'Historical mirror experiments and planned MFTF work do not establish a modern power-plant design or commercial feasibility.',
  },
  {
    slug: 'fusion-plasma-systems-plasma-position-and-shape-control', domainSlug: 'fusion-plasma-systems', score: [4, 2, 2, 1], unlocks: ['substantial-page', 'evidence-dossier'],
    priorityRationale: 'Already selected for a substantial page and central to governed tokamak control.',
    citation: 'ITER Organization. ITPEA Topical Group on MHD, Disruptions and Control (accessed 2026-08-30).',
    identifier: 'url:https://www.iter.org/scientists/itpea/itpea-topical-group-mhd-disruptions-and-control', url: 'https://www.iter.org/scientists/itpea/itpea-topical-group-mhd-disruptions-and-control',
    rationale: 'The official ITER page explicitly scopes feedback and feedforward control of plasma current, position, and shape.',
    metadataNote: 'The official ITER page identifies the topical group, scope, members, and magnetic-control work program.', artifactVersion: 'living-specification', inspectionDepth: 'specified-sections',
    inspectedContentLocation: '“Plasma magnetic control” scope and bullets on current, position, shape, error fields, simulators, and validation.',
    findings: 'The page identifies plasma current, position, and shape as explicit magnetic-control targets and describes feedforward, feedback, simulation, and experimental validation activities.',
    limitation: 'A topical-group work program does not report one bounded controller experiment, performance interval, or universal control law.',
  },
  {
    slug: 'mechanistic-interpretability-circuit-completeness', domainSlug: 'mechanistic-interpretability', score: [4, 2, 2, 1], unlocks: ['substantial-page', 'evidence-dossier'],
    priorityRationale: 'A key evidentiary criterion for substantial interpretability pages and future model dossiers.',
    citation: 'Wang, K. et al. Interpretability in the Wild: a Circuit for Indirect Object Identification in GPT-2 small. ICLR (2023).',
    identifier: 'arXiv:2211.00593', url: 'https://arxiv.org/abs/2211.00593',
    rationale: 'The paper explicitly defines and evaluates completeness as one criterion for a mechanistic circuit explanation.',
    metadataNote: 'The arXiv record identifies five authors, title, versions, and the ICLR paper.', artifactVersion: 'preprint', inspectionDepth: 'specified-sections',
    inspectedContentLocation: 'Abstract; §3 circuit discovery; §4 faithfulness, completeness, and minimality criteria; limitations.',
    findings: 'The authors evaluate an IOI circuit using quantitative faithfulness, completeness, and minimality criteria while recording remaining explanatory gaps.',
    limitation: 'The criterion is evaluated on GPT-2 small and one behavior; it is not proof that the proposed circuit is complete for all prompts or models.',
  },
  {
    slug: 'advanced-materials-tmd-monolayers', domainSlug: 'advanced-materials', score: [3, 2, 2, 1], unlocks: ['substantial-page', 'evidence-dossier'],
    priorityRationale: 'A foundational 2D-materials record linked to multiple advanced-materials pages.',
    citation: 'Mak, K. F. et al. Atomically thin MoS2: A new direct-gap semiconductor. Physical Review Letters 105, 136805 (2010).',
    identifier: 'doi:10.1103/PhysRevLett.105.136805', url: 'https://arxiv.org/abs/1004.0546',
    rationale: 'The study directly measures one- through six-layer MoS2 and isolates monolayer behavior.',
    metadataNote: 'The arXiv record identifies five authors and the title; the DOI identifies the PRL version of record.', artifactVersion: 'preprint', inspectionDepth: 'abstract-only',
    inspectedContentLocation: 'arXiv:1004.0546 abstract, sample thickness range, spectroscopy methods, and monolayer result.',
    findings: 'Optical spectroscopy across N=1–6 layers demonstrates a thickness-dependent electronic structure and direct-gap monolayer limit.',
    limitation: 'The result is specific to MoS2 and optical measurements; it does not establish a fabrication method for all TMD monolayers.',
  },
  {
    slug: 'advanced-materials-topological-insulator-surface-states', domainSlug: 'advanced-materials', score: [3, 2, 2, 1], unlocks: ['substantial-page', 'evidence-dossier'],
    priorityRationale: 'A foundational quantum-materials record with direct dossier and bridge relevance.',
    citation: 'Hasan, M. Z. & Kane, C. L. Colloquium: Topological insulators. Reviews of Modern Physics 82, 3045–3067 (2010).',
    identifier: 'doi:10.1103/RevModPhys.82.3045', url: 'https://arxiv.org/abs/1002.3895',
    rationale: 'The review directly defines protected edge and surface states and surveys their experimental signatures.',
    metadataNote: 'The arXiv record identifies both authors and the complete colloquium corresponding to the RMP DOI.', artifactVersion: 'preprint', inspectionDepth: 'full-document',
    inspectedContentLocation: 'Abstract; §I Introduction; §II Topological Band Theory; §IV 3D Topological Insulators; §V surface phases.',
    findings: 'The article defines bulk-gapped topological insulators with protected boundary states and reviews direct probes of 3D surface states.',
    limitation: 'This is a colloquium synthesis and the active record is typed as a method; review must decide whether the record class also needs revision.',
  },
  {
    slug: 'advanced-materials-contact-resistance-in-2d-devices', domainSlug: 'advanced-materials', score: [3, 2, 2, 1], unlocks: ['substantial-page', 'evidence-dossier'],
    priorityRationale: 'A device-integration bottleneck with high semiconductor commercial relevance.',
    citation: 'Liu, Y. et al. Recent Progress in Contact Engineering of Field-Effect Transistor Based on Two-Dimensional Materials. Nanomaterials 12, 3845 (2022).',
    identifier: 'doi:10.3390/nano12213845', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC9658022/',
    rationale: 'The review is explicitly organized around contact resistance mechanisms and engineering in 2D FETs.',
    metadataNote: 'PMC identifies the article, authors, journal, DOI, and CC BY version of record.', artifactVersion: 'version-of-record', inspectionDepth: 'full-document',
    inspectedContentLocation: 'Abstract; §1 Introduction; contact-resistance origins; top and edge contacts; equation 8; §5 Conclusions.',
    findings: 'The review treats contact resistance as a dominant 2D-FET limitation and connects it to Fermi-level pinning, interface damage, and top/edge contact structures.',
    limitation: 'A review organizes reported results but does not supply one universal contact-resistance value or validate every proposed contact stack.',
  },
  {
    slug: 'fusion-plasma-systems-electron-cyclotron-heating', domainSlug: 'fusion-plasma-systems', score: [3, 2, 2, 1], unlocks: ['substantial-page', 'evidence-dossier'],
    priorityRationale: 'A major ITER heating system currently bound to an unrelated disruption source.',
    citation: 'ITER Organization. External heating systems (accessed 2026-08-30).',
    identifier: 'url:https://www.iter.org/machine/supporting-systems/external-heating-systems', url: 'https://www.iter.org/machine/supporting-systems/external-heating-systems',
    rationale: 'The official system page directly distinguishes ECRH and its operating mechanism from the other heating systems.',
    metadataNote: 'The official ITER page identifies the current planned heating mix and system-specific sections.', artifactVersion: 'living-specification', inspectionDepth: 'specified-sections',
    inspectedContentLocation: '“High-frequency electromagnetic waves” subsection, ECRH paragraph, gyrotron and launcher description.',
    findings: 'The page describes 170 GHz resonant electron heating, electron-to-ion energy transfer, localized deposition, plasma-shot initiation, and instability suppression roles.',
    limitation: 'The page describes ITER design and planned operation; it is not a comparative experiment proving system performance.',
  },
  {
    slug: 'fusion-plasma-systems-neutral-beam-injection', domainSlug: 'fusion-plasma-systems', score: [3, 2, 2, 1], unlocks: ['substantial-page', 'evidence-dossier'],
    priorityRationale: 'A major ITER heating method currently bound to an unrelated disruption source.',
    citation: 'ITER Organization. External heating systems (accessed 2026-08-30).',
    identifier: 'url:https://www.iter.org/machine/supporting-systems/external-heating-systems', url: 'https://www.iter.org/machine/supporting-systems/external-heating-systems',
    rationale: 'The official system page directly describes neutral-beam generation, neutralization, injection, and plasma heating.',
    metadataNote: 'The official ITER page identifies the current planned heating mix and system-specific sections.', artifactVersion: 'living-specification', inspectionDepth: 'specified-sections',
    inspectedContentLocation: '“Neutral beam injection” subsection, beam source, acceleration grids, neutralizer, plasma-collision mechanism, and test-program boundary.',
    findings: 'The page describes accelerated deuterium ions, neutralization for magnetic-cage penetration, and collisional energy transfer to plasma particles.',
    limitation: 'Design powers and planned operation do not establish realized ITER plasma performance or comparative superiority.',
  },
  {
    slug: 'fusion-plasma-systems-edge-localized-modes', domainSlug: 'fusion-plasma-systems', score: [3, 2, 2, 1], unlocks: ['substantial-page', 'evidence-dossier'],
    priorityRationale: 'Already selected for a substantial page and central to plasma-facing component risk.',
    citation: 'Paz-Soldan, C. et al. Operational Space and Plasma Performance with an RMP-ELM Suppressed Edge. arXiv:2403.03693 (2024).',
    identifier: 'arXiv:2403.03693', url: 'https://arxiv.org/abs/2403.03693',
    rationale: 'The multi-device study directly identifies ELMs, suppression conditions, operating windows, and extrapolation limits.',
    metadataNote: 'The arXiv record identifies the author consortium, title, submission version, and multi-device scope.', artifactVersion: 'preprint', inspectionDepth: 'abstract-only',
    inspectedContentLocation: 'arXiv:2403.03693 abstract, device cohort, RMP-ELM suppression conditions, uncertainty and extrapolation statements.',
    findings: 'The abstract reports RMP-ELM suppression observations across AUG, DIII-D, EAST, and KSTAR and records device-dependent operating windows.',
    limitation: 'This source focuses on a suppression regime; the abstract alone does not define every ELM class, damage mechanism, or control method.',
  },
  {
    slug: 'mechanistic-interpretability-cross-layer-transcoders', domainSlug: 'mechanistic-interpretability', score: [3, 2, 2, 1], unlocks: ['substantial-page', 'evidence-dossier'],
    priorityRationale: 'A current interpretability primitive for machine-readable circuit evidence.',
    citation: 'Ameisen, E. et al. Circuit Tracing: Revealing Computational Graphs in Language Models. Transformer Circuits Thread (2025).',
    identifier: 'url:https://transformer-circuits.pub/2025/attribution-graphs/methods.html', url: 'https://transformer-circuits.pub/2025/attribution-graphs/methods.html',
    rationale: 'The primary research article defines cross-layer transcoders and quantitatively evaluates their replacement and attribution graphs.',
    metadataNote: 'The author-hosted article identifies the full author list, publication date, sections, methods, and no-DOI status.', artifactVersion: 'living-specification', inspectionDepth: 'full-document',
    inspectedContentLocation: '§1 Introduction; §2.1 Architecture; §2.2 replacement model; §3 attribution graphs; §5.1 CLT evaluation; §7 Limitations.',
    findings: 'The article defines features that read at one layer and decode to subsequent MLP layers, then evaluates CLT-based replacement models and attribution graphs.',
    limitation: 'The replacement model contains reconstruction error and the article documents missing mechanisms; CLTs are not complete proofs of model computation.',
  },
  {
    slug: 'mechanistic-interpretability-io-identification-circuit', domainSlug: 'mechanistic-interpretability', score: [3, 2, 2, 1], unlocks: ['substantial-page', 'evidence-dossier'],
    priorityRationale: 'A canonical end-to-end circuit study and a direct substantial-page candidate.',
    citation: 'Wang, K. et al. Interpretability in the Wild: a Circuit for Indirect Object Identification in GPT-2 small. ICLR (2023).',
    identifier: 'arXiv:2211.00593', url: 'https://arxiv.org/abs/2211.00593',
    rationale: 'The study directly discovers and tests an indirect-object-identification circuit in GPT-2 small.',
    metadataNote: 'The arXiv record identifies five authors, title, versions, and the ICLR paper.', artifactVersion: 'preprint', inspectionDepth: 'full-document',
    inspectedContentLocation: 'Abstract; IOI task definition; circuit-discovery sections; 26-head/7-class circuit; causal interventions; quantitative evaluation.',
    findings: 'The paper presents an IOI explanation comprising 26 attention heads in seven classes, discovered and evaluated with causal interventions.',
    limitation: 'The circuit is model-, task-, and prompt-distribution-specific and retains documented gaps in completeness and understanding.',
  },
  {
    slug: 'agentic-systems-mcp-tool-result-context-injection', domainSlug: 'agentic-systems-mcp', score: [3, 2, 2, 1], unlocks: ['substantial-page', 'evidence-dossier'],
    priorityRationale: 'A direct security boundary for evidence retrieval and tool-result ingestion.',
    citation: 'Zhan, Q., Liang, Z., Ying, Z. & Kang, D. InjecAgent: Benchmarking Indirect Prompt Injections in Tool-Integrated Large Language Model Agents. arXiv:2403.02691 (2024).',
    identifier: 'arXiv:2403.02691', url: 'https://arxiv.org/abs/2403.02691',
    rationale: 'The benchmark directly studies malicious instructions embedded in external content consumed by tool-integrated agents.',
    metadataNote: 'The arXiv record identifies four authors, title, versioned preprint, benchmark, and repository.', artifactVersion: 'preprint', inspectionDepth: 'abstract-only',
    inspectedContentLocation: 'arXiv:2403.02691 abstract, 1,054-test-case benchmark description, tool coverage, attack categories, and evaluation result boundary.',
    findings: 'The abstract defines indirect injection through external content and evaluates tool-integrated agents across user and attacker tools.',
    limitation: 'Benchmark results do not prove every MCP tool result is vulnerable or that one mitigation universally prevents injection.',
  },
]

export const ALIGNMENT_BATCH_10_REMEDIATION_PACKETS: readonly Batch10RemediationPacket[] = inputs.map(packet)

function assertBatch10PacketBoundary(packets: readonly Batch10RemediationPacket[]): void {
  if (packets.length !== 20
    || new Set(packets.map((entry) => entry.recordId)).size !== 20
    || new Set(packets.map((entry) => entry.packetId)).size !== 20
    || new Set(packets.map((entry) => entry.replacement.proposedSourceContractId)).size !== 20) {
    throw new Error('Batch 10 must contain twenty unique remediation packets, records, and replacement sources.')
  }

  for (const entry of packets) {
    const expectedScore = entry.priority.productRelevance
      + entry.priority.graphLeverage
      + entry.priority.correctionValue
      + entry.priority.inspectability
    if (entry.priority.total !== expectedScore || entry.priority.total < 8) {
      throw new Error(`${entry.recordId}: Batch 10 priority score is invalid or below the frozen threshold.`)
    }
    if (entry.priority.unlocks.length === 0) {
      throw new Error(`${entry.recordId}: Batch 10 packet has no declared product unlock.`)
    }
    if (!entry.replacement.url.startsWith('https://') || entry.replacement.url.includes('@')) {
      throw new Error(`${entry.recordId}: Batch 10 replacement URL is not credential-free HTTPS.`)
    }
    const inspected = entry.replacement.inspection
    if (!inspected.metadataVerified || !inspected.contentInspected
      || !inspected.exactLocatorInspected || !inspected.inspectedContentLocation
      || !inspected.findings || !inspected.limitation) {
      throw new Error(`${entry.recordId}: Batch 10 replacement lacks inspected metadata, content, or locator.`)
    }
    if (entry.replacement.rights.basis !== 'citation-with-paraphrase'
      || entry.replacement.rights.quotationUsed !== false
      || entry.replacement.rights.sourceContentCommitted !== false) {
      throw new Error(`${entry.recordId}: Batch 10 replacement crossed its citation-only rights boundary.`)
    }
    if (entry.disposition !== 'blocked-pending-source-override-review'
      || entry.canonicalMutationAuthorized !== false
      || entry.promotionEligible !== false
      || entry.externallyReviewed !== false
      || entry.independentlyReproduced !== false) {
      throw new Error(`${entry.recordId}: Batch 10 replacement crossed a governance boundary.`)
    }
  }
}

assertBatch10PacketBoundary(ALIGNMENT_BATCH_10_REMEDIATION_PACKETS)
