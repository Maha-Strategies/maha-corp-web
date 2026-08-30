# Frontier source-alignment Batch 9 remediation packets

Batch `maha-frontier-alignment-batch/9.0` · digest `sha256:9a3b1b8da7d60d1d813d1cfc1f8d7bc72e56f0f741036b10d67b936ba4c68eda`

These are internally inspected replacement-source proposals, not source substitutions. Every packet remains blocked pending an explicit source-override review. No canonical record, release, public page, sitemap entry, or publication decision changes in this batch.

| Measure | Count |
| --- | --- |
| replacementSourcesDiscovered | 20 |
| replacementMetadataVerified | 20 |
| replacementContentInspected | 20 |
| replacementLocatorsInspected | 20 |
| blockedPendingReview | 20 |
| canonicalMutationsAuthorized | 0 |
| promotionEligible | 0 |

## Frozen cohort

| Priority | Record | Domain | Artifact | Depth | Status |
| --- | --- | --- | --- | --- | --- |
| 10 | `agentic-systems-mcp-human-approval-boundaries` | agentic-systems-mcp | `living-specification` | `specified-sections` | `blocked-pending-source-override-review` |
| 10 | `agentic-systems-mcp-prompt-injection-through-tools` | agentic-systems-mcp | `preprint` | `abstract-only` | `blocked-pending-source-override-review` |
| 10 | `fusion-plasma-systems-neutron-material-damage` | fusion-plasma-systems | `preprint` | `abstract-only` | `blocked-pending-source-override-review` |
| 10 | `fusion-plasma-systems-rebco-high-field-magnets` | fusion-plasma-systems | `accepted-manuscript` | `full-document` | `blocked-pending-source-override-review` |
| 10 | `mechanistic-interpretability-automated-feature-interpretation` | mechanistic-interpretability | `living-specification` | `specified-sections` | `blocked-pending-source-override-review` |
| 10 | `mechanistic-interpretability-path-patching` | mechanistic-interpretability | `preprint` | `abstract-only` | `blocked-pending-source-override-review` |
| 9 | `advanced-materials-direct-gap-mos2` | advanced-materials | `preprint` | `abstract-only` | `blocked-pending-source-override-review` |
| 9 | `advanced-materials-graphene-hbn-heterostructures` | advanced-materials | `preprint` | `abstract-only` | `blocked-pending-source-override-review` |
| 9 | `advanced-materials-two-dimensional-magnetism` | advanced-materials | `preprint` | `abstract-only` | `blocked-pending-source-override-review` |
| 9 | `agentic-systems-mcp-multi-agent-role-assignment` | agentic-systems-mcp | `preprint` | `abstract-only` | `blocked-pending-source-override-review` |
| 9 | `critical-supply-chains-magnet-recycling` | critical-supply-chains | `repository-copy` | `specified-sections` | `blocked-pending-source-override-review` |
| 9 | `critical-supply-chains-tantalum-concentrate-traceability` | critical-supply-chains | `government-report` | `specified-sections` | `blocked-pending-source-override-review` |
| 9 | `fusion-plasma-systems-cable-in-conduit-conductors` | fusion-plasma-systems | `living-specification` | `specified-sections` | `blocked-pending-source-override-review` |
| 9 | `mechanistic-interpretability-dead-features` | mechanistic-interpretability | `living-specification` | `specified-sections` | `blocked-pending-source-override-review` |
| 9 | `neurotechnology-bci-light-delivery-tissue-heating` | neurotechnology-bci | `accepted-manuscript` | `specified-sections` | `blocked-pending-source-override-review` |
| 8 | `biomolecular-engineering-compartmentalized-cell-free-systems` | biomolecular-engineering | `version-of-record` | `specified-sections` | `blocked-pending-source-override-review` |
| 8 | `biomolecular-engineering-droplet-microfluidic-screening` | biomolecular-engineering | `version-of-record` | `specified-sections` | `blocked-pending-source-override-review` |
| 8 | `biomolecular-engineering-synthetic-riboswitches` | biomolecular-engineering | `version-of-record` | `specified-sections` | `blocked-pending-source-override-review` |
| 8 | `longevity-metabolism-ampk-energy-sensing` | longevity-metabolism | `accepted-manuscript` | `specified-sections` | `blocked-pending-source-override-review` |
| 8 | `longevity-metabolism-cd38-nad-consumption` | longevity-metabolism | `accepted-manuscript` | `specified-sections` | `blocked-pending-source-override-review` |

## Inspected replacement locators

### agentic-systems-mcp-prompt-injection-through-tools

- Packet: `sha256:7e2f180693358ce662d2f0c8cc1ddb3c6e11b2e144dac025efa18348d6355a5a`
- Replacement: Greshake, K. et al. Not what you've signed up for: Compromising Real-World LLM-Integrated Applications with Indirect Prompt Injection (2023).
- Identifier: `arXiv:2302.12173`
- Locator inspected: arXiv:2302.12173 abstract, attack-vector definition, demonstrated application/API effects, and stated limitations.
- Finding: The inspected abstract defines indirect prompt injection as adversarial instructions embedded in data likely to be retrieved and reports demonstrations that alter application functionality and API calls.
- Limitation: The abstract supports the attack class, not universal exploitability, a complete mitigation, or an MCP-specific empirical result.
- Decision: `blocked-pending-source-override-review`

### agentic-systems-mcp-human-approval-boundaries

- Packet: `sha256:a0738137e493fc18becbea7d1cda7aa82fa834945ea037d731a2a4939594e776`
- Replacement: Model Context Protocol contributors. Model Context Protocol specification: Tools, version 2024-11-05.
- Identifier: `url:https://modelcontextprotocol.io/specification/2024-11-05/server/tools`
- Locator inspected: MCP 2024-11-05 Tools page, “User Interaction Model” and “Security Considerations”.
- Finding: The page recommends a human in the loop with the ability to deny tool invocations and confirmation prompts for operations, while stating that MCP does not mandate a specific interaction model.
- Limitation: This is normative guidance and a protocol boundary, not proof that an implementation enforces approval correctly or that every operation requires the same UI.
- Decision: `blocked-pending-source-override-review`

### fusion-plasma-systems-rebco-high-field-magnets

- Packet: `sha256:f721bd367451a4e5c44111e56e2dff4660362f0ba8ce8e53fa1f0c0df711e67a`
- Replacement: Whyte, D. G. et al. Smaller & Sooner: Exploiting High Magnetic Fields from New Superconductors for a More Attractive Fusion Energy Development Path. Journal of Fusion Energy 35, 41–53 (2016).
- Identifier: `doi:10.1007/s10894-015-0050-1`
- Locator inspected: MIT PSFC/JA-16-17 accepted manuscript, §3 Proposed Initiatives and Elements 4, 8, and 9; complete 8,079-word manuscript searched.
- Finding: The manuscript explicitly names REBCO high-temperature superconductors, high-field magnets, conductor tape, cryogenic cooling, demountable-coil joints, and coil fabrication.
- Limitation: It presents a fusion-development proposal and engineering initiatives, not a completed commercial plant or a version-of-record inspection.
- Decision: `blocked-pending-source-override-review`

### advanced-materials-direct-gap-mos2

- Packet: `sha256:bd2d52b2d7f2e9fbf777ee5f4870fa79fade65bf9047a4d45b6c93d73b55aef3`
- Replacement: Mak, K. F. et al. Atomically thin MoS2: A new direct-gap semiconductor. Physical Review Letters 105, 136805 (2010).
- Identifier: `doi:10.1103/PhysRevLett.105.136805`
- Locator inspected: arXiv:1004.0546 abstract, optical-spectroscopy methods and thickness-dependent band-gap findings.
- Finding: Absorption, photoluminescence, and photoconductivity measurements trace a crossover from an indirect bulk gap to a direct gap in the monolayer limit.
- Limitation: The abstract supports the bounded layer-dependent measurement, not manufacturing readiness or every TMD material.
- Decision: `blocked-pending-source-override-review`

### advanced-materials-two-dimensional-magnetism

- Packet: `sha256:f22da6aeee4a37aea372b0b83cf9a570638eac2ceff27e4ed3995cc9d3869a0b`
- Replacement: Huang, B. et al. Layer-dependent Ferromagnetism in a van der Waals Crystal down to the Monolayer Limit. Nature 546, 270–273 (2017).
- Identifier: `doi:10.1038/nature22391`
- Locator inspected: arXiv:1703.05892 abstract, MOKE measurement description and layer-dependent magnetic findings.
- Finding: MOKE microscopy is reported to show monolayer CrI3 as an out-of-plane Ising ferromagnet with layer-dependent magnetic behavior.
- Limitation: The result is material- and temperature-specific and does not establish room-temperature 2D magnetism or a device platform.
- Decision: `blocked-pending-source-override-review`

### advanced-materials-graphene-hbn-heterostructures

- Packet: `sha256:7482f2a353ba197da30383ab55a3a5b3cb8fcd6b13e3d9b3ce9f17e5ad990c60`
- Replacement: Dean, C. R. et al. Boron nitride substrates for high-quality graphene electronics. Nature Nanotechnology 5, 722–726 (2010).
- Identifier: `doi:10.1038/nnano.2010.172`
- Locator inspected: arXiv:1005.4917 abstract, mechanical-transfer fabrication and transport-characterization findings.
- Finding: The abstract reports mono- and bilayer graphene devices transferred onto single-crystal hBN, improved transport characteristics, and controlled assembly of layered materials for more complex heterostructures.
- Limitation: The source supports graphene-on-hBN devices; it does not establish every possible encapsulated or moiré heterostructure.
- Decision: `blocked-pending-source-override-review`

### agentic-systems-mcp-multi-agent-role-assignment

- Packet: `sha256:beea57d890bea6a4fc35be14b3211d206cce48605e417ced4975411fc8cab047`
- Replacement: Li, G. et al. CAMEL: Communicative Agents for “Mind” Exploration of Large Language Model Society (2023).
- Identifier: `arXiv:2303.17760`
- Locator inspected: arXiv:2303.17760 abstract, role-playing framework definition and multi-agent cooperation scope.
- Finding: The abstract introduces a role-playing communicative-agent framework using inception prompting to guide agents toward task completion and studies instruction-following cooperation.
- Limitation: The source supports static prompted roles, not dynamic capability-based assignment, deadlock freedom, or production governance.
- Decision: `blocked-pending-source-override-review`

### biomolecular-engineering-droplet-microfluidic-screening

- Packet: `sha256:4fc44f01612091c0ade072ecfa1ed127c8eb7b9f2e263ed6e38981c34eb01e22`
- Replacement: Agresti, J. J. et al. Ultrahigh-throughput screening in drop-based microfluidics for directed evolution. PNAS 107, 4004–4009 (2010).
- Identifier: `doi:10.1073/pnas.0910781107`
- Locator inspected: PMC2840095 abstract; Results and Discussion, platform architecture and Figure 1; directed-evolution screening results.
- Finding: The study reports picolitre droplets as reaction vessels, fluorescence sorting at thousands per second, and a directed-evolution screen of approximately 100 million enzyme reactions.
- Limitation: Performance and cost comparisons are specific to the reported assay and should not be generalized to all screens.
- Decision: `blocked-pending-source-override-review`

### biomolecular-engineering-synthetic-riboswitches

- Packet: `sha256:c09dfdee63965b84f312296d3d5e9f44f44070b6fc02942a29a4bf04c916dc44`
- Replacement: Topp, S. et al. Synthetic Riboswitches That Induce Gene Expression in Diverse Bacterial Species. Applied and Environmental Microbiology 76, 7881–7884 (2010).
- Identifier: `doi:10.1128/AEM.01537-10`
- Locator inspected: PMC2988590 abstract; design and in-vivo screening description; Figure 1 and cross-species expression results.
- Finding: The authors report five ligand-inducible synthetic riboswitches and test inducible expression in eight bacterial species.
- Limitation: The result is limited to the tested switches, ligands, hosts, and reporter context; it does not establish universal portability.
- Decision: `blocked-pending-source-override-review`

### biomolecular-engineering-compartmentalized-cell-free-systems

- Packet: `sha256:55fdd4506b81ffa520d2ae948b73ac6169790b6de664add63ddb99dd6a4d455f`
- Replacement: Noireaux, V. & Libchaber, A. A vesicle bioreactor as a step toward an artificial cell assembly. PNAS 101, 17669–17674 (2004).
- Identifier: `doi:10.1073/pnas.0408236101`
- Locator inspected: PMC539773 abstract; vesicle construction and cell-free transcription–translation sections; Summary and Conclusions.
- Finding: An E. coli cell-free expression system is encapsulated in phospholipid vesicles; the study reports transcription–translation, nutrient exchange, and extended expression after internal pore expression.
- Limitation: This is a particular vesicle bioreactor, not evidence of self-reproduction, a complete artificial cell, or general compartment performance.
- Decision: `blocked-pending-source-override-review`

### critical-supply-chains-magnet-recycling

- Packet: `sha256:778b7b926507c87c12080645be5c85138e08fa5ccb76ba548651c7db40f0208f`
- Replacement: Binnemans, K. et al. Recycling of rare earths: a critical review. Journal of Cleaner Production 51, 1–22 (2013).
- Identifier: `doi:10.1016/j.jclepro.2012.12.037`
- Locator inspected: Author-uploaded article, §2 “Recycling of permanent REE magnets”, pp. 4–8, route comparison and limitations table.
- Finding: The inspected section identifies NdFeB magnet composition and discusses direct reuse, hydrometallurgical, pyrometallurgical, and gas-phase recovery routes with route-specific limitations.
- Limitation: This is a 2013 review and does not establish current plant capacity, recovery economics, or qualification of recycled magnets.
- Decision: `blocked-pending-source-override-review`

### critical-supply-chains-tantalum-concentrate-traceability

- Packet: `sha256:d9e45b9f4d43c3bcb9bf277981cbf5c8d4d5582b957d021497eccbe7eff7a435`
- Replacement: OECD. Due Diligence Guidance for Responsible Supply Chains of Minerals from Conflict-Affected and High-Risk Areas, Third Edition (2016).
- Identifier: `url:https://mneguidelines.oecd.org/OECD-Due-Diligence-Guidance-Minerals-Edition3.pdf`
- Locator inspected: OECD Guidance 3rd ed., Annex I five-step framework, Step 1.C; Supplement on Tin, Tantalum and Tungsten, upstream chain-of-custody and traceability provisions.
- Finding: The guidance calls for a chain-of-custody or traceability system and specifies information to collect and pass along for minerals including tantalum.
- Limitation: The guidance defines due-diligence practice; it does not certify any shipment, actor, mine, smelter, or implementation.
- Decision: `blocked-pending-source-override-review`

### fusion-plasma-systems-cable-in-conduit-conductors

- Packet: `sha256:d34fee26f3153b3069d3cb60be0a0bb4d0d09a8d996ff0565f5ee5f287955121`
- Replacement: ITER Organization. ITER Superconducting Magnets: Magnets.
- Identifier: `url:https://www.iter.org/machine/magnets`
- Locator inspected: ITER Machine / Magnets, opening “Superconducting magnets” section and cable-in-conduit conductor definition.
- Finding: ITER states that it uses internally cooled cable-in-conduit conductors with bundled superconducting strands mixed with copper, cabled together, and enclosed in a structural steel jacket.
- Limitation: A living machine-description page does not provide a complete conductor specification, lifetime distribution, or commercial-plant evidence.
- Decision: `blocked-pending-source-override-review`

### fusion-plasma-systems-neutron-material-damage

- Packet: `sha256:71ca847946b0ecb00f678339fec08a5128a29e5892a286cb1552a7bbdd081e52`
- Replacement: Gilbert, M. R. et al. Neutron-induced dpa, transmutations, gas production, and helium embrittlement of fusion materials (2013).
- Identifier: `arXiv:1311.5079`
- Locator inspected: arXiv:1311.5079 abstract, DEMO neutron-transport/inventory calculation scope and material-lifetime findings.
- Finding: The abstract reports calculations of displacements per atom, transmutation, gas production, and helium-induced grain-boundary embrittlement in high-flux regions of a conceptual DEMO device.
- Limitation: These are model-based, design-specific estimates, not direct lifetime measurements for every fusion material or component.
- Decision: `blocked-pending-source-override-review`

### longevity-metabolism-ampk-energy-sensing

- Packet: `sha256:256f2aaad07b390947048d9fb7b63e0690c4d7090a83ee84873b5fc3397b11f8`
- Replacement: Hardie, D. G., Ross, F. A. & Hawley, S. A. AMPK—a nutrient and energy sensor that maintains energy homeostasis. Nature Reviews Molecular Cell Biology 13, 251–262 (2012).
- Identifier: `doi:10.1038/nrm3311`
- Locator inspected: PMC5726489 abstract and sections on adenine-nucleotide sensing, AMPK activation, and cellular/whole-body energy homeostasis.
- Finding: The review explains how AMPK responds to cellular energy status through adenine-nucleotide regulation and coordinates energy-producing and energy-consuming pathways.
- Limitation: This review supports the mechanism boundary, not a single universal AMPK response across tissues, species, or interventions.
- Decision: `blocked-pending-source-override-review`

### longevity-metabolism-cd38-nad-consumption

- Packet: `sha256:7d4432411ee9f63705d82d242ffd9ac5f4e830487a9d6cb03a22d7a8c6e7761c`
- Replacement: Camacho-Pereira, J. et al. CD38 dictates age-related NAD decline and mitochondrial dysfunction through a SIRT3-dependent mechanism. Cell Metabolism 23, 1127–1139 (2016).
- Identifier: `doi:10.1016/j.cmet.2016.05.006`
- Locator inspected: PMC4911708 Summary; Results on CD38 expression/NADase activity, NAD levels and knockout experiments; Discussion.
- Finding: The study reports increased CD38 expression and activity with age, identifies CD38 as an NAD-degrading enzyme, and tests NAD and mitochondrial outcomes in wild-type and knockout mice.
- Limitation: The causal evidence is primarily in mice and does not establish a human therapy, clinical benefit, or universal ageing mechanism.
- Decision: `blocked-pending-source-override-review`

### mechanistic-interpretability-automated-feature-interpretation

- Packet: `sha256:35a4ea6f1ff8299e2079a4d402d77c8c920fd866c6b34f5c4ce84b1604227973`
- Replacement: OpenAI. Language models can explain neurons in language models (2023).
- Identifier: `url:https://openai.com/index/language-models-can-explain-neurons-in-language-models/`
- Locator inspected: OpenAI technical publication, overview and three-stage explanation, simulation, and scoring method.
- Finding: The method uses one language model to generate natural-language neuron explanations, simulate activations from those explanations, and score agreement against observed activations.
- Limitation: The page describes imperfect neuron explanations in GPT-2; it does not establish complete model understanding, causal faithfulness, or feature-level generality.
- Decision: `blocked-pending-source-override-review`

### mechanistic-interpretability-path-patching

- Packet: `sha256:13ab52094a6d3fb5924960704d5318250330c69e05c891cc53a89846224d46e4`
- Replacement: Goldowsky-Dill, N., MacLeod, C., Sato, L. & Arora, A. Localizing Model Behavior with Path Patching (2023).
- Identifier: `arXiv:2304.05969`
- Locator inspected: arXiv:2304.05969 abstract, path-patching definition and reported localization experiments.
- Finding: The abstract introduces path patching as a way to express and quantitatively test hypotheses that model behavior is localized to specified paths.
- Limitation: The abstract supports the technique definition and reported examples, not a universal guarantee of causal localization.
- Decision: `blocked-pending-source-override-review`

### mechanistic-interpretability-dead-features

- Packet: `sha256:e3cada55a98dec2162ef163e410e8c3d7d3e62474f52eea834bd7c26a6f8b5a4`
- Replacement: Bricken, T. et al. Towards Monosemanticity: Decomposing Language Models With Dictionary Learning (2023).
- Identifier: `url:https://transformer-circuits.pub/2023/monosemantic-features/`
- Locator inspected: Towards Monosemanticity, Global Analysis discussion of dead and ultralow-density features; A/1 feature-browser summary.
- Finding: The report defines dead features as learned features active on none of 100 million dataset examples and reports 168 dead features in the A/1 autoencoder.
- Limitation: Dead means inactive on the stated evaluation corpus, not mathematically incapable of activation on every possible input.
- Decision: `blocked-pending-source-override-review`

### neurotechnology-bci-light-delivery-tissue-heating

- Packet: `sha256:cbbe4785064ed36ba0f050c21ae98809147ea17d75ae0c3f6c6b9062707aa468`
- Replacement: Stujenske, J. M., Spellman, T. & Gordon, J. A. Modeling the spatiotemporal dynamics of light and heat propagation for in vivo optogenetics. Cell Reports 12, 525–534 (2015).
- Identifier: `doi:10.1016/j.celrep.2015.06.036`
- Locator inspected: PMC4512881 Summary; light/heat propagation model; experimental validation and opsin-negative heating controls; Discussion.
- Finding: The paper models temperature change from in-vivo light delivery, compares the model with measured brain temperature, and reports neural effects from heating under specified optical conditions.
- Limitation: Heating depends on wavelength, power, duty cycle, geometry, tissue, and duration; the study does not define one universal safe exposure threshold.
- Decision: `blocked-pending-source-override-review`

