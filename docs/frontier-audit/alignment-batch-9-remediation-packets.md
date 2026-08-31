# Frontier source-alignment Batch 9 remediation packets

Batch `maha-frontier-alignment-batch/9.0` · digest `sha256:a52f95bcf94c425d42d9f3bb531b3b3830e83dbe438a6d9d183025977426c977`

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

- Packet: `sha256:187d442e72c250535edf7a23ba5161ac79fa8729ec27d177bef3984dd2d3cb46`
- Replacement: Greshake, K. et al. Not what you've signed up for: Compromising Real-World LLM-Integrated Applications with Indirect Prompt Injection (2023).
- Identifier: `arXiv:2302.12173`
- Locator inspected: arXiv:2302.12173 abstract, attack-vector definition, demonstrated application/API effects, and stated limitations.
- Finding: The inspected abstract defines indirect prompt injection as adversarial instructions embedded in data likely to be retrieved and reports demonstrations that alter application functionality and API calls.
- Limitation: The abstract supports the attack class, not universal exploitability, a complete mitigation, or an MCP-specific empirical result.
- Decision: `blocked-pending-source-override-review`

### agentic-systems-mcp-human-approval-boundaries

- Packet: `sha256:0371d5f28276489496ff20b08aa5dce85d5635b080eee1a3e4f7b990b17a9449`
- Replacement: Model Context Protocol contributors. Model Context Protocol specification: Tools, version 2024-11-05.
- Identifier: `url:https://modelcontextprotocol.io/specification/2024-11-05/server/tools`
- Locator inspected: MCP 2024-11-05 Tools page, “User Interaction Model” and “Security Considerations”.
- Finding: The page recommends a human in the loop with the ability to deny tool invocations and confirmation prompts for operations, while stating that MCP does not mandate a specific interaction model.
- Limitation: This is normative guidance and a protocol boundary, not proof that an implementation enforces approval correctly or that every operation requires the same UI.
- Decision: `blocked-pending-source-override-review`

### fusion-plasma-systems-rebco-high-field-magnets

- Packet: `sha256:99128306b9c4171ed75f71e81a69babcb6649eebbd6cf6a702782d9b583d07d1`
- Replacement: Whyte, D. G. et al. Smaller & Sooner: Exploiting High Magnetic Fields from New Superconductors for a More Attractive Fusion Energy Development Path. Journal of Fusion Energy 35, 41–53 (2016).
- Identifier: `doi:10.1007/s10894-015-0050-1`
- Locator inspected: MIT PSFC/JA-16-17 accepted manuscript, §3 Proposed Initiatives and Elements 4, 8, and 9; complete 8,079-word manuscript searched.
- Finding: The manuscript explicitly names REBCO high-temperature superconductors, high-field magnets, conductor tape, cryogenic cooling, demountable-coil joints, and coil fabrication.
- Limitation: It presents a fusion-development proposal and engineering initiatives, not a completed commercial plant or a version-of-record inspection.
- Decision: `blocked-pending-source-override-review`

### advanced-materials-direct-gap-mos2

- Packet: `sha256:fb94dcf9fe4b24026887a56a9cad68ae1af0d42684c003d38d0a2c7df6e4a3b9`
- Replacement: Mak, K. F. et al. Atomically thin MoS2: A new direct-gap semiconductor. Physical Review Letters 105, 136805 (2010).
- Identifier: `doi:10.1103/PhysRevLett.105.136805`
- Locator inspected: arXiv:1004.0546 abstract, optical-spectroscopy methods and thickness-dependent band-gap findings.
- Finding: Absorption, photoluminescence, and photoconductivity measurements trace a crossover from an indirect bulk gap to a direct gap in the monolayer limit.
- Limitation: The abstract supports the bounded layer-dependent measurement, not manufacturing readiness or every TMD material.
- Decision: `blocked-pending-source-override-review`

### advanced-materials-two-dimensional-magnetism

- Packet: `sha256:de1fa04c2ed1caef97fd11b77a0500690ac7e7007ef5b0607714540934fb195b`
- Replacement: Huang, B. et al. Layer-dependent Ferromagnetism in a van der Waals Crystal down to the Monolayer Limit. Nature 546, 270–273 (2017).
- Identifier: `doi:10.1038/nature22391`
- Locator inspected: arXiv:1703.05892 abstract, MOKE measurement description and layer-dependent magnetic findings.
- Finding: MOKE microscopy is reported to show monolayer CrI3 as an out-of-plane Ising ferromagnet with layer-dependent magnetic behavior.
- Limitation: The result is material- and temperature-specific and does not establish room-temperature 2D magnetism or a device platform.
- Decision: `blocked-pending-source-override-review`

### advanced-materials-graphene-hbn-heterostructures

- Packet: `sha256:e465c4e9bc9cd1e9d1de40a07fe9462ed59d2a5b34098a0309196c941e982514`
- Replacement: Dean, C. R. et al. Boron nitride substrates for high-quality graphene electronics. Nature Nanotechnology 5, 722–726 (2010).
- Identifier: `doi:10.1038/nnano.2010.172`
- Locator inspected: arXiv:1005.4917 abstract, mechanical-transfer fabrication and transport-characterization findings.
- Finding: The abstract reports mono- and bilayer graphene devices transferred onto single-crystal hBN, improved transport characteristics, and controlled assembly of layered materials for more complex heterostructures.
- Limitation: The source supports graphene-on-hBN devices; it does not establish every possible encapsulated or moiré heterostructure.
- Decision: `blocked-pending-source-override-review`

### agentic-systems-mcp-multi-agent-role-assignment

- Packet: `sha256:f2b6a7fecb016aa4105cfbcdbf28d8453c3ca77ebb168191154682c3dcce74bf`
- Replacement: Li, G. et al. CAMEL: Communicative Agents for “Mind” Exploration of Large Language Model Society (2023).
- Identifier: `arXiv:2303.17760`
- Locator inspected: arXiv:2303.17760 abstract, role-playing framework definition and multi-agent cooperation scope.
- Finding: The abstract introduces a role-playing communicative-agent framework using inception prompting to guide agents toward task completion and studies instruction-following cooperation.
- Limitation: The source supports static prompted roles, not dynamic capability-based assignment, deadlock freedom, or production governance.
- Decision: `blocked-pending-source-override-review`

### biomolecular-engineering-droplet-microfluidic-screening

- Packet: `sha256:74ab41202dc30d99c3927b52f6ae9013a28dd65cffb0f99a4f3acdba7d109729`
- Replacement: Agresti, J. J. et al. Ultrahigh-throughput screening in drop-based microfluidics for directed evolution. PNAS 107, 4004–4009 (2010).
- Identifier: `doi:10.1073/pnas.0910781107`
- Locator inspected: PMC2840095 abstract; Results and Discussion, platform architecture and Figure 1; directed-evolution screening results.
- Finding: The study reports picolitre droplets as reaction vessels, fluorescence sorting at thousands per second, and a directed-evolution screen of approximately 100 million enzyme reactions.
- Limitation: Performance and cost comparisons are specific to the reported assay and should not be generalized to all screens.
- Decision: `blocked-pending-source-override-review`

### biomolecular-engineering-synthetic-riboswitches

- Packet: `sha256:5528042fa608afd5941578ccd3085a8db4cba7ab7e62ac37d6432e5bba92bbf4`
- Replacement: Topp, S. et al. Synthetic Riboswitches That Induce Gene Expression in Diverse Bacterial Species. Applied and Environmental Microbiology 76, 7881–7884 (2010).
- Identifier: `doi:10.1128/AEM.01537-10`
- Locator inspected: PMC2988590 abstract; design and in-vivo screening description; Figure 1 and cross-species expression results.
- Finding: The authors report five ligand-inducible synthetic riboswitches and test inducible expression in eight bacterial species.
- Limitation: The result is limited to the tested switches, ligands, hosts, and reporter context; it does not establish universal portability.
- Decision: `blocked-pending-source-override-review`

### biomolecular-engineering-compartmentalized-cell-free-systems

- Packet: `sha256:7da76310d31d7e056f04b9895a126733acb2fb15c299043d2602b54920e64667`
- Replacement: Noireaux, V. & Libchaber, A. A vesicle bioreactor as a step toward an artificial cell assembly. PNAS 101, 17669–17674 (2004).
- Identifier: `doi:10.1073/pnas.0408236101`
- Locator inspected: PMC539773 abstract; vesicle construction and cell-free transcription–translation sections; Summary and Conclusions.
- Finding: An E. coli cell-free expression system is encapsulated in phospholipid vesicles; the study reports transcription–translation, nutrient exchange, and extended expression after internal pore expression.
- Limitation: This is a particular vesicle bioreactor, not evidence of self-reproduction, a complete artificial cell, or general compartment performance.
- Decision: `blocked-pending-source-override-review`

### critical-supply-chains-magnet-recycling

- Packet: `sha256:51b1ef8e5fd89169ce91db62e4c3b4f7a2e68abbfd52ddfa17f5aa331d3e42d3`
- Replacement: Binnemans, K. et al. Recycling of rare earths: a critical review. Journal of Cleaner Production 51, 1–22 (2013).
- Identifier: `doi:10.1016/j.jclepro.2012.12.037`
- Locator inspected: Author-uploaded article, §2 “Recycling of permanent REE magnets”, pp. 4–8, route comparison and limitations table.
- Finding: The inspected section identifies NdFeB magnet composition and discusses direct reuse, hydrometallurgical, pyrometallurgical, and gas-phase recovery routes with route-specific limitations.
- Limitation: This is a 2013 review and does not establish current plant capacity, recovery economics, or qualification of recycled magnets.
- Decision: `blocked-pending-source-override-review`

### critical-supply-chains-tantalum-concentrate-traceability

- Packet: `sha256:7c4a4740cf0e59f5d2bb31e25aeffb92a8f35a972ef3afc9906d6c83d5c847cd`
- Replacement: OECD. Due Diligence Guidance for Responsible Supply Chains of Minerals from Conflict-Affected and High-Risk Areas, Third Edition (2016).
- Identifier: `url:https://mneguidelines.oecd.org/OECD-Due-Diligence-Guidance-Minerals-Edition3.pdf`
- Locator inspected: OECD Guidance 3rd ed., Annex I five-step framework, Step 1.C; Supplement on Tin, Tantalum and Tungsten, upstream chain-of-custody and traceability provisions.
- Finding: The guidance calls for a chain-of-custody or traceability system and specifies information to collect and pass along for minerals including tantalum.
- Limitation: The guidance defines due-diligence practice; it does not certify any shipment, actor, mine, smelter, or implementation.
- Decision: `blocked-pending-source-override-review`

### fusion-plasma-systems-cable-in-conduit-conductors

- Packet: `sha256:67f3a73f19a4c5dd0bf4e182ea219234f5a37d6f927dc4fc741085b85c55b48a`
- Replacement: ITER Organization. ITER Superconducting Magnets: Magnets.
- Identifier: `url:https://www.iter.org/machine/magnets`
- Locator inspected: ITER Machine / Magnets, opening “Superconducting magnets” section and cable-in-conduit conductor definition.
- Finding: ITER states that it uses internally cooled cable-in-conduit conductors with bundled superconducting strands mixed with copper, cabled together, and enclosed in a structural steel jacket.
- Limitation: A living machine-description page does not provide a complete conductor specification, lifetime distribution, or commercial-plant evidence.
- Decision: `blocked-pending-source-override-review`

### fusion-plasma-systems-neutron-material-damage

- Packet: `sha256:0d2847e3fab8d97d6abe8c0016517e15b72a73453d0ff9ae8289c11167b54220`
- Replacement: Gilbert, M. R. et al. Neutron-induced dpa, transmutations, gas production, and helium embrittlement of fusion materials (2013).
- Identifier: `arXiv:1311.5079`
- Locator inspected: arXiv:1311.5079 abstract, DEMO neutron-transport/inventory calculation scope and material-lifetime findings.
- Finding: The abstract reports calculations of displacements per atom, transmutation, gas production, and helium-induced grain-boundary embrittlement in high-flux regions of a conceptual DEMO device.
- Limitation: These are model-based, design-specific estimates, not direct lifetime measurements for every fusion material or component.
- Decision: `blocked-pending-source-override-review`

### longevity-metabolism-ampk-energy-sensing

- Packet: `sha256:02f07bb2ffdbacf40a6dc49edd48cea1411bf8a39e8e2f2efa75ef792ef8e521`
- Replacement: Hardie, D. G., Ross, F. A. & Hawley, S. A. AMPK—a nutrient and energy sensor that maintains energy homeostasis. Nature Reviews Molecular Cell Biology 13, 251–262 (2012).
- Identifier: `doi:10.1038/nrm3311`
- Locator inspected: PMC5726489 abstract and sections on adenine-nucleotide sensing, AMPK activation, and cellular/whole-body energy homeostasis.
- Finding: The review explains how AMPK responds to cellular energy status through adenine-nucleotide regulation and coordinates energy-producing and energy-consuming pathways.
- Limitation: This review supports the mechanism boundary, not a single universal AMPK response across tissues, species, or interventions.
- Decision: `blocked-pending-source-override-review`

### longevity-metabolism-cd38-nad-consumption

- Packet: `sha256:d3b9853d6b481963781f546e9ace9dfb80faf539fc31ed5e75d489a620b73121`
- Replacement: Camacho-Pereira, J. et al. CD38 dictates age-related NAD decline and mitochondrial dysfunction through a SIRT3-dependent mechanism. Cell Metabolism 23, 1127–1139 (2016).
- Identifier: `doi:10.1016/j.cmet.2016.05.006`
- Locator inspected: PMC4911708 Summary; Results on CD38 expression/NADase activity, NAD levels and knockout experiments; Discussion.
- Finding: The study reports increased CD38 expression and activity with age, identifies CD38 as an NAD-degrading enzyme, and tests NAD and mitochondrial outcomes in wild-type and knockout mice.
- Limitation: The causal evidence is primarily in mice and does not establish a human therapy, clinical benefit, or universal ageing mechanism.
- Decision: `blocked-pending-source-override-review`

### mechanistic-interpretability-automated-feature-interpretation

- Packet: `sha256:346b033994a59976bbdb3860c67e6c63b731a20b7e4d98c2e9187214c8f54ed5`
- Replacement: OpenAI. Language models can explain neurons in language models (2023).
- Identifier: `url:https://openai.com/index/language-models-can-explain-neurons-in-language-models/`
- Locator inspected: OpenAI technical publication, overview and three-stage explanation, simulation, and scoring method.
- Finding: The method uses one language model to generate natural-language neuron explanations, simulate activations from those explanations, and score agreement against observed activations.
- Limitation: The page describes imperfect neuron explanations in GPT-2; it does not establish complete model understanding, causal faithfulness, or feature-level generality.
- Decision: `blocked-pending-source-override-review`

### mechanistic-interpretability-path-patching

- Packet: `sha256:4ff7bfcf8ccb7b05af8ed1e574239647427b32144f01016264045fd447a57d9f`
- Replacement: Goldowsky-Dill, N., MacLeod, C., Sato, L. & Arora, A. Localizing Model Behavior with Path Patching (2023).
- Identifier: `arXiv:2304.05969`
- Locator inspected: arXiv:2304.05969 abstract, path-patching definition and reported localization experiments.
- Finding: The abstract introduces path patching as a way to express and quantitatively test hypotheses that model behavior is localized to specified paths.
- Limitation: The abstract supports the technique definition and reported examples, not a universal guarantee of causal localization.
- Decision: `blocked-pending-source-override-review`

### mechanistic-interpretability-dead-features

- Packet: `sha256:84f733e6d9c047784ab79d7d7906f8862b2c9fad923462e64b8415e9b235ce5e`
- Replacement: Bricken, T. et al. Towards Monosemanticity: Decomposing Language Models With Dictionary Learning (2023).
- Identifier: `url:https://transformer-circuits.pub/2023/monosemantic-features/`
- Locator inspected: Towards Monosemanticity, Global Analysis discussion of dead and ultralow-density features; A/1 feature-browser summary.
- Finding: The report defines dead features as learned features active on none of 100 million dataset examples and reports 168 dead features in the A/1 autoencoder.
- Limitation: Dead means inactive on the stated evaluation corpus, not mathematically incapable of activation on every possible input.
- Decision: `blocked-pending-source-override-review`

### neurotechnology-bci-light-delivery-tissue-heating

- Packet: `sha256:3d852799ddaffae69e05d8f691d6bdf98ff0df1b6c3a40241628246dc4d6a50e`
- Replacement: Stujenske, J. M., Spellman, T. & Gordon, J. A. Modeling the spatiotemporal dynamics of light and heat propagation for in vivo optogenetics. Cell Reports 12, 525–534 (2015).
- Identifier: `doi:10.1016/j.celrep.2015.06.036`
- Locator inspected: PMC4512881 Summary; light/heat propagation model; experimental validation and opsin-negative heating controls; Discussion.
- Finding: The paper models temperature change from in-vivo light delivery, compares the model with measured brain temperature, and reports neural effects from heating under specified optical conditions.
- Limitation: Heating depends on wavelength, power, duty cycle, geometry, tissue, and duration; the study does not define one universal safe exposure threshold.
- Decision: `blocked-pending-source-override-review`
