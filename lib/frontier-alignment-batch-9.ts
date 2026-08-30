/**
 * Frontier source-alignment Batch 9.
 *
 * Twenty high-value records are selected from the eighty-six active,
 * content-confirmed source mismatches left by Batch 8. Each replacement source
 * was opened by an internal editor and inspected at the locator recorded below.
 * Discovery, inspection, and adoption remain separate: these packets propose
 * an override but never edit a canonical record, clear its existing mismatch,
 * authorize publication, or represent external expert review.
 */

export const ALIGNMENT_BATCH_9_VERSION = 'maha-frontier-alignment-batch/9.0' as const

export type Batch9ArtifactVersion =
  | 'version-of-record'
  | 'accepted-manuscript'
  | 'preprint'
  | 'repository-copy'
  | 'government-report'
  | 'living-specification'

export type Batch9InspectionDepth =
  | 'abstract-only'
  | 'specified-sections'
  | 'full-document'

export interface Batch9Priority {
  productRelevance: 0 | 1 | 2 | 3 | 4
  graphLeverage: 0 | 1 | 2 | 3
  correctionValue: 0 | 1 | 2
  inspectability: 0 | 1
  total: number
  rationale: string
}

export interface Batch9ReplacementInspection {
  metadataVerified: true
  metadataNote: string
  artifactVersion: Batch9ArtifactVersion
  inspectionDepth: Batch9InspectionDepth
  contentInspected: true
  exactLocatorInspected: true
  inspectedContentLocation: string
  findings: string
  limitation: string
}

export interface Batch9RemediationPacket {
  packetId: string
  recordId: string
  domainSlug: string
  priority: Batch9Priority
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
    inspection: Batch9ReplacementInspection
  }
  disposition: 'blocked-pending-source-override-review'
  canonicalMutationAuthorized: false
  promotionEligible: false
  externallyReviewed: false
  independentlyReproduced: false
  whatWouldChangeIfAccepted: string
}

function priority(
  productRelevance: Batch9Priority['productRelevance'],
  graphLeverage: Batch9Priority['graphLeverage'],
  correctionValue: Batch9Priority['correctionValue'],
  inspectability: Batch9Priority['inspectability'],
  rationale: string,
): Batch9Priority {
  return {
    productRelevance,
    graphLeverage,
    correctionValue,
    inspectability,
    total: productRelevance + graphLeverage + correctionValue + inspectability,
    rationale,
  }
}

function packet(
  slug: string,
  domainSlug: string,
  priorityValue: Batch9Priority,
  citation: string,
  identifier: string,
  url: string,
  rationale: string,
  inspection: Batch9ReplacementInspection,
  whatWouldChangeIfAccepted: string,
): Batch9RemediationPacket {
  return {
    packetId: `urn:maha:remediation:frontier-alignment-batch-9:${slug}`,
    recordId: `urn:maha:record:${slug}`,
    domainSlug,
    priority: priorityValue,
    currentVerdict: 'mismatched',
    replacement: {
      proposedSourceContractId: `source-remediation-batch-9-${slug}`,
      replacementDecision: 'replacement-supported',
      citation,
      identifier,
      url,
      rationale,
      rights: {
        basis: 'citation-with-paraphrase',
        quotationUsed: false,
        sourceContentCommitted: false,
      },
      inspection,
    },
    disposition: 'blocked-pending-source-override-review',
    canonicalMutationAuthorized: false,
    promotionEligible: false,
    externallyReviewed: false,
    independentlyReproduced: false,
    whatWouldChangeIfAccepted,
  }
}

const commonChange = (slug: string) =>
  `Acceptance would create a new revision of ${slug} whose single claim cites the inspected replacement and exact locator. It would not mutate the existing revision, imply external review or reproduction, authorize canonical release, or widen the claim beyond the inspected source.`

export const ALIGNMENT_BATCH_9_REMEDIATION_PACKETS: readonly Batch9RemediationPacket[] = [
  packet(
    'agentic-systems-mcp-prompt-injection-through-tools',
    'agentic-systems-mcp',
    priority(4, 3, 2, 1, 'Directly affects the safety boundary of Maha MCP and CABEZON tool execution.'),
    'Greshake, K. et al. Not what you\'ve signed up for: Compromising Real-World LLM-Integrated Applications with Indirect Prompt Injection (2023).',
    'arXiv:2302.12173',
    'https://arxiv.org/abs/2302.12173',
    'The paper directly investigates indirect prompt injection through retrieved data and its effects on application functions and API calls.',
    {
      metadataVerified: true,
      metadataNote: 'The arXiv record identifies the title, six authors, submission date, and versioned preprint.',
      artifactVersion: 'preprint',
      inspectionDepth: 'abstract-only',
      contentInspected: true,
      exactLocatorInspected: true,
      inspectedContentLocation: 'arXiv:2302.12173 abstract, attack-vector definition, demonstrated application/API effects, and stated limitations.',
      findings: 'The inspected abstract defines indirect prompt injection as adversarial instructions embedded in data likely to be retrieved and reports demonstrations that alter application functionality and API calls.',
      limitation: 'The abstract supports the attack class, not universal exploitability, a complete mitigation, or an MCP-specific empirical result.',
    },
    commonChange('agentic-systems-mcp-prompt-injection-through-tools'),
  ),
  packet(
    'agentic-systems-mcp-human-approval-boundaries',
    'agentic-systems-mcp',
    priority(4, 3, 2, 1, 'Defines the human-control boundary used by governed machine requests.'),
    'Model Context Protocol contributors. Model Context Protocol specification: Tools, version 2024-11-05.',
    'url:https://modelcontextprotocol.io/specification/2024-11-05/server/tools',
    'https://modelcontextprotocol.io/specification/2024-11-05/server/tools',
    'The pinned specification version directly describes human denial and confirmation boundaries for tool invocation.',
    {
      metadataVerified: true,
      metadataNote: 'The official MCP documentation labels the served artifact as the 2024-11-05 specification version.',
      artifactVersion: 'living-specification',
      inspectionDepth: 'specified-sections',
      contentInspected: true,
      exactLocatorInspected: true,
      inspectedContentLocation: 'MCP 2024-11-05 Tools page, “User Interaction Model” and “Security Considerations”.',
      findings: 'The page recommends a human in the loop with the ability to deny tool invocations and confirmation prompts for operations, while stating that MCP does not mandate a specific interaction model.',
      limitation: 'This is normative guidance and a protocol boundary, not proof that an implementation enforces approval correctly or that every operation requires the same UI.',
    },
    commonChange('agentic-systems-mcp-human-approval-boundaries'),
  ),
  packet(
    'fusion-plasma-systems-rebco-high-field-magnets',
    'fusion-plasma-systems',
    priority(4, 3, 2, 1, 'Repairs the only structurally resolving Q-BR bridge endpoint and a major fusion chokepoint.'),
    'Whyte, D. G. et al. Smaller & Sooner: Exploiting High Magnetic Fields from New Superconductors for a More Attractive Fusion Energy Development Path. Journal of Fusion Energy 35, 41–53 (2016).',
    'doi:10.1007/s10894-015-0050-1',
    'https://dspace.mit.edu/handle/1721.1/105250',
    'The accepted manuscript directly treats REBCO high-temperature-superconductor tape and high-field fusion magnets.',
    {
      metadataVerified: true,
      metadataNote: 'Crossref and the MIT PSFC accepted manuscript agree on the title, authors, journal, and DOI.',
      artifactVersion: 'accepted-manuscript',
      inspectionDepth: 'full-document',
      contentInspected: true,
      exactLocatorInspected: true,
      inspectedContentLocation: 'MIT PSFC/JA-16-17 accepted manuscript, §3 Proposed Initiatives and Elements 4, 8, and 9; complete 8,079-word manuscript searched.',
      findings: 'The manuscript explicitly names REBCO high-temperature superconductors, high-field magnets, conductor tape, cryogenic cooling, demountable-coil joints, and coil fabrication.',
      limitation: 'It presents a fusion-development proposal and engineering initiatives, not a completed commercial plant or a version-of-record inspection.',
    },
    'Acceptance would create a new revision citing Whyte et al. and could make this endpoint alignment-clear. It would not clear the other Q-BR-006 endpoint or any source, locator, classification, or claim-strength blocker, and would not authorize release.',
  ),
  packet(
    'advanced-materials-direct-gap-mos2',
    'advanced-materials',
    priority(3, 3, 2, 1, 'A foundational 2D-semiconductor result with strong quantum-materials and device relevance.'),
    'Mak, K. F. et al. Atomically thin MoS2: A new direct-gap semiconductor. Physical Review Letters 105, 136805 (2010).',
    'doi:10.1103/PhysRevLett.105.136805',
    'https://arxiv.org/abs/1004.0546',
    'The preprint directly measures the thickness-dependent crossover to a direct gap in monolayer MoS2.',
    {
      metadataVerified: true,
      metadataNote: 'The arXiv record identifies the five authors and title; the published article is registered as Physical Review Letters 105, 136805.',
      artifactVersion: 'preprint',
      inspectionDepth: 'abstract-only',
      contentInspected: true,
      exactLocatorInspected: true,
      inspectedContentLocation: 'arXiv:1004.0546 abstract, optical-spectroscopy methods and thickness-dependent band-gap findings.',
      findings: 'Absorption, photoluminescence, and photoconductivity measurements trace a crossover from an indirect bulk gap to a direct gap in the monolayer limit.',
      limitation: 'The abstract supports the bounded layer-dependent measurement, not manufacturing readiness or every TMD material.',
    },
    commonChange('advanced-materials-direct-gap-mos2'),
  ),
  packet(
    'advanced-materials-two-dimensional-magnetism',
    'advanced-materials',
    priority(3, 3, 2, 1, 'A foundational quantum-materials result relevant to spin, sensing, and device bridges.'),
    'Huang, B. et al. Layer-dependent Ferromagnetism in a van der Waals Crystal down to the Monolayer Limit. Nature 546, 270–273 (2017).',
    'doi:10.1038/nature22391',
    'https://arxiv.org/abs/1703.05892',
    'The preprint directly reports magnetism in atomically thin CrI3, including the monolayer limit.',
    {
      metadataVerified: true,
      metadataNote: 'The arXiv record identifies the title and fourteen authors and links the preprint to the published Nature study.',
      artifactVersion: 'preprint',
      inspectionDepth: 'abstract-only',
      contentInspected: true,
      exactLocatorInspected: true,
      inspectedContentLocation: 'arXiv:1703.05892 abstract, MOKE measurement description and layer-dependent magnetic findings.',
      findings: 'MOKE microscopy is reported to show monolayer CrI3 as an out-of-plane Ising ferromagnet with layer-dependent magnetic behavior.',
      limitation: 'The result is material- and temperature-specific and does not establish room-temperature 2D magnetism or a device platform.',
    },
    commonChange('advanced-materials-two-dimensional-magnetism'),
  ),
  packet(
    'advanced-materials-graphene-hbn-heterostructures',
    'advanced-materials',
    priority(3, 3, 2, 1, 'Repairs a known graphene-versus-hBN positional-source defect and supports cross-material interfaces.'),
    'Dean, C. R. et al. Boron nitride substrates for high-quality graphene electronics. Nature Nanotechnology 5, 722–726 (2010).',
    'doi:10.1038/nnano.2010.172',
    'https://arxiv.org/abs/1005.4917',
    'The preprint directly fabricates graphene devices on hBN and describes controlled assembly of layered heterostructures.',
    {
      metadataVerified: true,
      metadataNote: 'PubMed, arXiv, and the DOI identify the same eleven-author article and publication.',
      artifactVersion: 'preprint',
      inspectionDepth: 'abstract-only',
      contentInspected: true,
      exactLocatorInspected: true,
      inspectedContentLocation: 'arXiv:1005.4917 abstract, mechanical-transfer fabrication and transport-characterization findings.',
      findings: 'The abstract reports mono- and bilayer graphene devices transferred onto single-crystal hBN, improved transport characteristics, and controlled assembly of layered materials for more complex heterostructures.',
      limitation: 'The source supports graphene-on-hBN devices; it does not establish every possible encapsulated or moiré heterostructure.',
    },
    commonChange('advanced-materials-graphene-hbn-heterostructures'),
  ),
  packet(
    'agentic-systems-mcp-multi-agent-role-assignment',
    'agentic-systems-mcp',
    priority(4, 2, 2, 1, 'Directly supports coordination architecture for Maha, CARP, CABEZON, and agent-cvrp.'),
    'Li, G. et al. CAMEL: Communicative Agents for “Mind” Exploration of Large Language Model Society (2023).',
    'arXiv:2303.17760',
    'https://arxiv.org/abs/2303.17760',
    'The paper directly introduces role-playing and inception prompting for cooperative communicative agents.',
    {
      metadataVerified: true,
      metadataNote: 'The arXiv record identifies the five authors, title, and versioned preprint.',
      artifactVersion: 'preprint',
      inspectionDepth: 'abstract-only',
      contentInspected: true,
      exactLocatorInspected: true,
      inspectedContentLocation: 'arXiv:2303.17760 abstract, role-playing framework definition and multi-agent cooperation scope.',
      findings: 'The abstract introduces a role-playing communicative-agent framework using inception prompting to guide agents toward task completion and studies instruction-following cooperation.',
      limitation: 'The source supports static prompted roles, not dynamic capability-based assignment, deadlock freedom, or production governance.',
    },
    commonChange('agentic-systems-mcp-multi-agent-role-assignment'),
  ),
  packet(
    'biomolecular-engineering-droplet-microfluidic-screening',
    'biomolecular-engineering',
    priority(3, 2, 2, 1, 'A high-throughput experimental platform relevant to autonomous biological discovery.'),
    'Agresti, J. J. et al. Ultrahigh-throughput screening in drop-based microfluidics for directed evolution. PNAS 107, 4004–4009 (2010).',
    'doi:10.1073/pnas.0910781107',
    'https://pmc.ncbi.nlm.nih.gov/articles/PMC2840095/',
    'The open article directly constructs and tests a droplet-generation, incubation, and fluorescence-sorting screening platform.',
    {
      metadataVerified: true,
      metadataNote: 'PMC identifies the PNAS article, authors, pagination, DOI, and correction notice.',
      artifactVersion: 'version-of-record',
      inspectionDepth: 'specified-sections',
      contentInspected: true,
      exactLocatorInspected: true,
      inspectedContentLocation: 'PMC2840095 abstract; Results and Discussion, platform architecture and Figure 1; directed-evolution screening results.',
      findings: 'The study reports picolitre droplets as reaction vessels, fluorescence sorting at thousands per second, and a directed-evolution screen of approximately 100 million enzyme reactions.',
      limitation: 'Performance and cost comparisons are specific to the reported assay and should not be generalized to all screens.',
    },
    commonChange('biomolecular-engineering-droplet-microfluidic-screening'),
  ),
  packet(
    'biomolecular-engineering-synthetic-riboswitches',
    'biomolecular-engineering',
    priority(3, 2, 2, 1, 'A reusable control primitive for engineered biological systems.'),
    'Topp, S. et al. Synthetic Riboswitches That Induce Gene Expression in Diverse Bacterial Species. Applied and Environmental Microbiology 76, 7881–7884 (2010).',
    'doi:10.1128/AEM.01537-10',
    'https://pmc.ncbi.nlm.nih.gov/articles/PMC2988590/',
    'The article directly designs and tests ligand-inducible synthetic riboswitches across bacterial species.',
    {
      metadataVerified: true,
      metadataNote: 'PMC identifies the journal article, authors, issue, pages, and DOI.',
      artifactVersion: 'version-of-record',
      inspectionDepth: 'specified-sections',
      contentInspected: true,
      exactLocatorInspected: true,
      inspectedContentLocation: 'PMC2988590 abstract; design and in-vivo screening description; Figure 1 and cross-species expression results.',
      findings: 'The authors report five ligand-inducible synthetic riboswitches and test inducible expression in eight bacterial species.',
      limitation: 'The result is limited to the tested switches, ligands, hosts, and reporter context; it does not establish universal portability.',
    },
    commonChange('biomolecular-engineering-synthetic-riboswitches'),
  ),
  packet(
    'biomolecular-engineering-compartmentalized-cell-free-systems',
    'biomolecular-engineering',
    priority(3, 2, 2, 1, 'Connects cell-free computation with artificial-cell and automated-lab infrastructure.'),
    'Noireaux, V. & Libchaber, A. A vesicle bioreactor as a step toward an artificial cell assembly. PNAS 101, 17669–17674 (2004).',
    'doi:10.1073/pnas.0408236101',
    'https://pmc.ncbi.nlm.nih.gov/articles/PMC539773/',
    'The article directly encapsulates a cell-free expression system in phospholipid vesicles and measures sustained expression.',
    {
      metadataVerified: true,
      metadataNote: 'PMC identifies the PNAS article, two authors, issue, pages, and DOI.',
      artifactVersion: 'version-of-record',
      inspectionDepth: 'specified-sections',
      contentInspected: true,
      exactLocatorInspected: true,
      inspectedContentLocation: 'PMC539773 abstract; vesicle construction and cell-free transcription–translation sections; Summary and Conclusions.',
      findings: 'An E. coli cell-free expression system is encapsulated in phospholipid vesicles; the study reports transcription–translation, nutrient exchange, and extended expression after internal pore expression.',
      limitation: 'This is a particular vesicle bioreactor, not evidence of self-reproduction, a complete artificial cell, or general compartment performance.',
    },
    commonChange('biomolecular-engineering-compartmentalized-cell-free-systems'),
  ),
  packet(
    'critical-supply-chains-magnet-recycling',
    'critical-supply-chains',
    priority(4, 2, 2, 1, 'Permanent-magnet recovery is a strategic bottleneck across robotics, energy, and advanced machines.'),
    'Binnemans, K. et al. Recycling of rare earths: a critical review. Journal of Cleaner Production 51, 1–22 (2013).',
    'doi:10.1016/j.jclepro.2012.12.037',
    'https://www.researchgate.net/publication/253367648_Recycling_of_Rare_Earths_a_Critical_Review',
    'The author-uploaded article devotes a section to permanent rare-earth magnets and compares recovery routes.',
    {
      metadataVerified: true,
      metadataNote: 'The TU Delft catalogue and author-uploaded article agree on the seven authors, journal, volume, pages, and DOI.',
      artifactVersion: 'repository-copy',
      inspectionDepth: 'specified-sections',
      contentInspected: true,
      exactLocatorInspected: true,
      inspectedContentLocation: 'Author-uploaded article, §2 “Recycling of permanent REE magnets”, pp. 4–8, route comparison and limitations table.',
      findings: 'The inspected section identifies NdFeB magnet composition and discusses direct reuse, hydrometallurgical, pyrometallurgical, and gas-phase recovery routes with route-specific limitations.',
      limitation: 'This is a 2013 review and does not establish current plant capacity, recovery economics, or qualification of recycled magnets.',
    },
    commonChange('critical-supply-chains-magnet-recycling'),
  ),
  packet(
    'critical-supply-chains-tantalum-concentrate-traceability',
    'critical-supply-chains',
    priority(4, 2, 2, 1, 'Traceability is a governance primitive for conflict minerals and machine procurement.'),
    'OECD. Due Diligence Guidance for Responsible Supply Chains of Minerals from Conflict-Affected and High-Risk Areas, Third Edition (2016).',
    'url:https://mneguidelines.oecd.org/OECD-Due-Diligence-Guidance-Minerals-Edition3.pdf',
    'https://mneguidelines.oecd.org/OECD-Due-Diligence-Guidance-Minerals-Edition3.pdf',
    'The official guidance includes a tantalum-specific supplement and chain-of-custody or traceability requirements.',
    {
      metadataVerified: true,
      metadataNote: 'The official OECD-hosted PDF identifies the third edition and its Supplement on Tin, Tantalum and Tungsten.',
      artifactVersion: 'government-report',
      inspectionDepth: 'specified-sections',
      contentInspected: true,
      exactLocatorInspected: true,
      inspectedContentLocation: 'OECD Guidance 3rd ed., Annex I five-step framework, Step 1.C; Supplement on Tin, Tantalum and Tungsten, upstream chain-of-custody and traceability provisions.',
      findings: 'The guidance calls for a chain-of-custody or traceability system and specifies information to collect and pass along for minerals including tantalum.',
      limitation: 'The guidance defines due-diligence practice; it does not certify any shipment, actor, mine, smelter, or implementation.',
    },
    commonChange('critical-supply-chains-tantalum-concentrate-traceability'),
  ),
  packet(
    'fusion-plasma-systems-cable-in-conduit-conductors',
    'fusion-plasma-systems',
    priority(3, 3, 2, 1, 'A concrete superconducting-magnet component and exact physical dependency for fusion systems.'),
    'ITER Organization. ITER Superconducting Magnets: Magnets.',
    'url:https://www.iter.org/machine/magnets',
    'https://www.iter.org/machine/magnets',
    'The official machine page directly defines ITER cable-in-conduit conductors and their material construction.',
    {
      metadataVerified: true,
      metadataNote: 'The official ITER Organization page identifies the machine system and current magnet architecture.',
      artifactVersion: 'living-specification',
      inspectionDepth: 'specified-sections',
      contentInspected: true,
      exactLocatorInspected: true,
      inspectedContentLocation: 'ITER Machine / Magnets, opening “Superconducting magnets” section and cable-in-conduit conductor definition.',
      findings: 'ITER states that it uses internally cooled cable-in-conduit conductors with bundled superconducting strands mixed with copper, cabled together, and enclosed in a structural steel jacket.',
      limitation: 'A living machine-description page does not provide a complete conductor specification, lifetime distribution, or commercial-plant evidence.',
    },
    commonChange('fusion-plasma-systems-cable-in-conduit-conductors'),
  ),
  packet(
    'fusion-plasma-systems-neutron-material-damage',
    'fusion-plasma-systems',
    priority(4, 3, 2, 1, 'Neutron damage is a plant-lifetime chokepoint and a cross-domain materials bridge.'),
    'Gilbert, M. R. et al. Neutron-induced dpa, transmutations, gas production, and helium embrittlement of fusion materials (2013).',
    'arXiv:1311.5079',
    'https://arxiv.org/abs/1311.5079',
    'The paper directly calculates displacement damage, transmutation, gas production, and helium embrittlement in fusion materials.',
    {
      metadataVerified: true,
      metadataNote: 'The arXiv record identifies the six authors, title, submission date, and versioned preprint.',
      artifactVersion: 'preprint',
      inspectionDepth: 'abstract-only',
      contentInspected: true,
      exactLocatorInspected: true,
      inspectedContentLocation: 'arXiv:1311.5079 abstract, DEMO neutron-transport/inventory calculation scope and material-lifetime findings.',
      findings: 'The abstract reports calculations of displacements per atom, transmutation, gas production, and helium-induced grain-boundary embrittlement in high-flux regions of a conceptual DEMO device.',
      limitation: 'These are model-based, design-specific estimates, not direct lifetime measurements for every fusion material or component.',
    },
    commonChange('fusion-plasma-systems-neutron-material-damage'),
  ),
  packet(
    'longevity-metabolism-ampk-energy-sensing',
    'longevity-metabolism',
    priority(3, 2, 2, 1, 'A foundational metabolic-control mechanism with broad cross-domain modelling value.'),
    'Hardie, D. G., Ross, F. A. & Hawley, S. A. AMPK—a nutrient and energy sensor that maintains energy homeostasis. Nature Reviews Molecular Cell Biology 13, 251–262 (2012).',
    'doi:10.1038/nrm3311',
    'https://pmc.ncbi.nlm.nih.gov/articles/PMC5726489/',
    'The accepted manuscript directly reviews AMPK nucleotide sensing and energy-homeostasis control.',
    {
      metadataVerified: true,
      metadataNote: 'PMC identifies the accepted manuscript, authors, journal citation, and DOI.',
      artifactVersion: 'accepted-manuscript',
      inspectionDepth: 'specified-sections',
      contentInspected: true,
      exactLocatorInspected: true,
      inspectedContentLocation: 'PMC5726489 abstract and sections on adenine-nucleotide sensing, AMPK activation, and cellular/whole-body energy homeostasis.',
      findings: 'The review explains how AMPK responds to cellular energy status through adenine-nucleotide regulation and coordinates energy-producing and energy-consuming pathways.',
      limitation: 'This review supports the mechanism boundary, not a single universal AMPK response across tissues, species, or interventions.',
    },
    commonChange('longevity-metabolism-ampk-energy-sensing'),
  ),
  packet(
    'longevity-metabolism-cd38-nad-consumption',
    'longevity-metabolism',
    priority(3, 2, 2, 1, 'A directly measured NAD-consumption mechanism linked to ageing metabolism.'),
    'Camacho-Pereira, J. et al. CD38 dictates age-related NAD decline and mitochondrial dysfunction through a SIRT3-dependent mechanism. Cell Metabolism 23, 1127–1139 (2016).',
    'doi:10.1016/j.cmet.2016.05.006',
    'https://pmc.ncbi.nlm.nih.gov/articles/PMC4911708/',
    'The open manuscript directly measures CD38 NADase activity, age-related NAD decline, and associated mitochondrial effects in mice.',
    {
      metadataVerified: true,
      metadataNote: 'PMC identifies the manuscript, journal publication, authors, and DOI.',
      artifactVersion: 'accepted-manuscript',
      inspectionDepth: 'specified-sections',
      contentInspected: true,
      exactLocatorInspected: true,
      inspectedContentLocation: 'PMC4911708 Summary; Results on CD38 expression/NADase activity, NAD levels and knockout experiments; Discussion.',
      findings: 'The study reports increased CD38 expression and activity with age, identifies CD38 as an NAD-degrading enzyme, and tests NAD and mitochondrial outcomes in wild-type and knockout mice.',
      limitation: 'The causal evidence is primarily in mice and does not establish a human therapy, clinical benefit, or universal ageing mechanism.',
    },
    commonChange('longevity-metabolism-cd38-nad-consumption'),
  ),
  packet(
    'mechanistic-interpretability-automated-feature-interpretation',
    'mechanistic-interpretability',
    priority(4, 3, 2, 1, 'A direct machine-evidence capability for scalable model inspection.'),
    'OpenAI. Language models can explain neurons in language models (2023).',
    'url:https://openai.com/index/language-models-can-explain-neurons-in-language-models/',
    'https://openai.com/index/language-models-can-explain-neurons-in-language-models/',
    'The technical publication directly defines an automated explanation-and-scoring process for model neurons.',
    {
      metadataVerified: true,
      metadataNote: 'The official OpenAI publication page identifies the May 9, 2023 technical work, method, dataset, and linked code.',
      artifactVersion: 'living-specification',
      inspectionDepth: 'specified-sections',
      contentInspected: true,
      exactLocatorInspected: true,
      inspectedContentLocation: 'OpenAI technical publication, overview and three-stage explanation, simulation, and scoring method.',
      findings: 'The method uses one language model to generate natural-language neuron explanations, simulate activations from those explanations, and score agreement against observed activations.',
      limitation: 'The page describes imperfect neuron explanations in GPT-2; it does not establish complete model understanding, causal faithfulness, or feature-level generality.',
    },
    commonChange('mechanistic-interpretability-automated-feature-interpretation'),
  ),
  packet(
    'mechanistic-interpretability-path-patching',
    'mechanistic-interpretability',
    priority(4, 3, 2, 1, 'A causal-localization method that can connect model claims to executable tests.'),
    'Goldowsky-Dill, N., MacLeod, C., Sato, L. & Arora, A. Localizing Model Behavior with Path Patching (2023).',
    'arXiv:2304.05969',
    'https://arxiv.org/abs/2304.05969',
    'The paper introduces and evaluates path patching as the named technique.',
    {
      metadataVerified: true,
      metadataNote: 'The arXiv record identifies the four authors, title, and versioned preprint.',
      artifactVersion: 'preprint',
      inspectionDepth: 'abstract-only',
      contentInspected: true,
      exactLocatorInspected: true,
      inspectedContentLocation: 'arXiv:2304.05969 abstract, path-patching definition and reported localization experiments.',
      findings: 'The abstract introduces path patching as a way to express and quantitatively test hypotheses that model behavior is localized to specified paths.',
      limitation: 'The abstract supports the technique definition and reported examples, not a universal guarantee of causal localization.',
    },
    commonChange('mechanistic-interpretability-path-patching'),
  ),
  packet(
    'mechanistic-interpretability-dead-features',
    'mechanistic-interpretability',
    priority(3, 3, 2, 1, 'Dead-feature measurement is a key quality boundary for sparse-autoencoder infrastructure.'),
    'Bricken, T. et al. Towards Monosemanticity: Decomposing Language Models With Dictionary Learning (2023).',
    'url:https://transformer-circuits.pub/2023/monosemantic-features/',
    'https://transformer-circuits.pub/2023/monosemantic-features/',
    'The technical report explicitly defines and counts learned sparse-autoencoder features that never activate on the evaluation dataset.',
    {
      metadataVerified: true,
      metadataNote: 'The Transformer Circuits publication page identifies the report, authors, experiments, and linked feature browsers.',
      artifactVersion: 'living-specification',
      inspectionDepth: 'specified-sections',
      contentInspected: true,
      exactLocatorInspected: true,
      inspectedContentLocation: 'Towards Monosemanticity, Global Analysis discussion of dead and ultralow-density features; A/1 feature-browser summary.',
      findings: 'The report defines dead features as learned features active on none of 100 million dataset examples and reports 168 dead features in the A/1 autoencoder.',
      limitation: 'Dead means inactive on the stated evaluation corpus, not mathematically incapable of activation on every possible input.',
    },
    commonChange('mechanistic-interpretability-dead-features'),
  ),
  packet(
    'neurotechnology-bci-light-delivery-tissue-heating',
    'neurotechnology-bci',
    priority(4, 2, 2, 1, 'A direct safety boundary for optical neural interfaces and closed-loop systems.'),
    'Stujenske, J. M., Spellman, T. & Gordon, J. A. Modeling the spatiotemporal dynamics of light and heat propagation for in vivo optogenetics. Cell Reports 12, 525–534 (2015).',
    'doi:10.1016/j.celrep.2015.06.036',
    'https://pmc.ncbi.nlm.nih.gov/articles/PMC4512881/',
    'The accepted manuscript directly models and experimentally checks light-induced heating in brain tissue during optogenetic stimulation.',
    {
      metadataVerified: true,
      metadataNote: 'PMC identifies the author manuscript, final Cell Reports citation, authors, and DOI.',
      artifactVersion: 'accepted-manuscript',
      inspectionDepth: 'specified-sections',
      contentInspected: true,
      exactLocatorInspected: true,
      inspectedContentLocation: 'PMC4512881 Summary; light/heat propagation model; experimental validation and opsin-negative heating controls; Discussion.',
      findings: 'The paper models temperature change from in-vivo light delivery, compares the model with measured brain temperature, and reports neural effects from heating under specified optical conditions.',
      limitation: 'Heating depends on wavelength, power, duty cycle, geometry, tissue, and duration; the study does not define one universal safe exposure threshold.',
    },
    commonChange('neurotechnology-bci-light-delivery-tissue-heating'),
  ),
] as const
