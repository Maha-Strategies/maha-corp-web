# Q-BR bridge batch — gap report

Resolver `maha-reference-resolver/1.0` · audit package `maha-bridge-audit/1.0`

This report is generated. Do not edit it by hand.

## Verdicts

| Verdict | Count |
| --- | --- |
| BLOCK | 12 |

## Endpoint resolution (24 references)

| Outcome | Count |
| --- | --- |
| unresolved-record | 23 |
| alias-resolution | 1 |

| ID | Side | Submitted reference | Outcome | Record |
| --- | --- | --- | --- | --- |
| Q-BR-001 | source | `quantum-systems:surface-code-threshold` | unresolved-record | — |
| Q-BR-001 | target | `mathematics:algebraic-coding-theory` | unresolved-record | — |
| Q-BR-002 | source | `quantum-systems:transmon-coherence-limits` | unresolved-record | — |
| Q-BR-002 | target | `semiconductor-manufacturing:thin-film-deposition` | unresolved-record | — |
| Q-BR-003 | source | `quantum-systems:tensor-network-states` | unresolved-record | — |
| Q-BR-003 | target | `mechanistic-interpretability:sparse-autoencoder-superposition` | unresolved-record | — |
| Q-BR-004 | source | `quantum-systems:phase-estimation-hamiltonian` | unresolved-record | — |
| Q-BR-004 | target | `biomolecular-engineering:enzyme-active-site-kinetics` | unresolved-record | — |
| Q-BR-005 | source | `quantum-systems:cryogenic-dilution-attenuation` | unresolved-record | — |
| Q-BR-005 | target | `critical-supply-chains:helium-isotope-refinement` | unresolved-record | — |
| Q-BR-006 | source | `quantum-systems:superconducting-gap-depairing` | unresolved-record | — |
| Q-BR-006 | target | `fusion-plasma:rebco-high-field-magnets` | alias-resolution | `urn:maha:record:fusion-plasma-systems-rebco-high-field-magnets` |
| Q-BR-007 | source | `quantum-systems:majorana-zero-modes` | unresolved-record | — |
| Q-BR-007 | target | `advanced-materials:twisted-bilayer-heterostructures` | unresolved-record | — |
| Q-BR-008 | source | `quantum-systems:syndrome-extraction-cycle` | unresolved-record | — |
| Q-BR-008 | target | `neuromorphic-biocomputing:spiking-fault-tolerance` | unresolved-record | — |
| Q-BR-009 | source | `quantum-systems:spin-qubit-hyperfine-dephasing` | unresolved-record | — |
| Q-BR-009 | target | `semiconductor-manufacturing:silicon-crystal-growth-and-wafer-preparation` | unresolved-record | — |
| Q-BR-010 | source | `quantum-systems:qubo-ising-mapping` | unresolved-record | — |
| Q-BR-010 | target | `fusion-plasma:grad-shafranov-equilibrium-solver` | unresolved-record | — |
| Q-BR-011 | source | `quantum-systems:bb84-entanglement-distribution` | unresolved-record | — |
| Q-BR-011 | target | `agentic-systems:mcp-tool-authorization-enclaves` | unresolved-record | — |
| Q-BR-012 | source | `quantum-systems:3d-cavity-resonator-loss` | unresolved-record | — |
| Q-BR-012 | target | `critical-supply-chains:refractory-tantalum-niobium-refinement` | unresolved-record | — |

## Source verification (24 citations)

| State | Count |
| --- | --- |
| not-independently-verified | 10 |
| verified-correct | 10 |
| verified-with-correction | 3 |
| unverifiable | 1 |

## Blockers

| Code | Bridges affected |
| --- | --- |
| claim-strength-rejected | 7 |
| classification-unmappable | 7 |
| endpoint-unresolved-record | 12 |
| rights-basis-unverified | 4 |
| source-missing-identifier | 5 |
| source-missing-locator | 12 |
| source-unverifiable | 4 |

## Remediable to review

| ID | Remediation required |
| --- | --- |
| Q-BR-001 | create the missing canonical record(s) for the named endpoints; supply exact locators; supply stable identifiers |
| Q-BR-002 | create the missing canonical record(s) for the named endpoints; supply exact locators |
| Q-BR-004 | create the missing canonical record(s) for the named endpoints; supply exact locators; supply stable identifiers; establish a rights basis |
| Q-BR-005 | create the missing canonical record(s) for the named endpoints; supply exact locators; supply stable identifiers; establish a rights basis |
| Q-BR-006 | create the missing canonical record(s) for the named endpoints; supply exact locators |
| Q-BR-007 | create the missing canonical record(s) for the named endpoints; supply exact locators |
| Q-BR-008 | create the missing canonical record(s) for the named endpoints; supply exact locators |
| Q-BR-009 | create the missing canonical record(s) for the named endpoints; supply exact locators |
| Q-BR-012 | create the missing canonical record(s) for the named endpoints; supply exact locators |

## Conceptually invalid

These are not fixed by creating records or supplying locators.

- **Q-BR-003** — The submitted bridge asserts an isomorphism between Schmidt-rank truncation and sparse dictionary learning. The objectives differ (entanglement entropy versus an L1 penalty), so no record or citation repairs the claim.
- **Q-BR-010** — The bridge asserts a QUBO reduction of the Grad-Shafranov PDE that neither cited source supplies. Until a reduction with a stated discretisation and penalty formulation exists, there is nothing to review.
- **Q-BR-011** — The Side B citation could not be located in any authoritative index. A bridge resting on an unlocatable source is not remediable by adding records.

## Namespace inventory

| Domain | Records | Canonical graph | Public projection | Backing module |
| --- | --- | --- | --- | --- |
| advanced-materials | 30 | yes | yes | `lib/epistemic-pilots.ts EPISTEMIC_RECORDS` |
| agentic-systems-mcp | 30 | yes | yes | `lib/epistemic-pilots.ts EPISTEMIC_RECORDS` |
| biomolecular-engineering | 30 | yes | yes | `lib/epistemic-pilots.ts EPISTEMIC_RECORDS` |
| critical-supply-chains | 30 | yes | yes | `lib/epistemic-pilots.ts EPISTEMIC_RECORDS` |
| fusion-plasma-systems | 30 | yes | yes | `lib/epistemic-pilots.ts EPISTEMIC_RECORDS` |
| longevity-metabolism | 30 | yes | yes | `lib/epistemic-pilots.ts EPISTEMIC_RECORDS` |
| mechanistic-interpretability | 30 | yes | yes | `lib/epistemic-pilots.ts EPISTEMIC_RECORDS` |
| neurotechnology-bci | 30 | yes | yes | `lib/epistemic-pilots.ts EPISTEMIC_RECORDS` |
| quantum-systems | 25 | yes | yes | `lib/epistemic-pilots.ts EPISTEMIC_RECORDS` |
| synthetic-biology | 25 | yes | yes | `lib/epistemic-pilots.ts EPISTEMIC_RECORDS` |
| astronomy | 4 | no | no | `lib/epistemic-pilot-corpus.ts EPISTEMIC_PHASE4_PILOT_ENTRIES` |
| mathematics | 4 | no | no | `lib/epistemic-pilot-corpus.ts EPISTEMIC_PHASE4_PILOT_ENTRIES` |
| neuromorphic-biocomputing | 4 | no | no | `lib/epistemic-pilot-corpus.ts EPISTEMIC_PHASE4_PILOT_ENTRIES` |
| religion | 4 | no | no | `lib/epistemic-pilot-corpus.ts EPISTEMIC_PHASE4_PILOT_ENTRIES` |
| semiconductor | 4 | no | no | `lib/epistemic-pilot-corpus.ts EPISTEMIC_PHASE4_PILOT_ENTRIES` |

### Declared aliases

| Alias | Target | Since | Reason |
| --- | --- | --- | --- |
| `fusion-plasma` | `fusion-plasma-systems` | maha-reference-resolver/1.0 | Submitted batches shorten the canonical fusion-plasma-systems domain id. |
| `agentic-systems` | `agentic-systems-mcp` | maha-reference-resolver/1.0 | Submitted batches drop the -mcp suffix from the canonical agentic-systems-mcp domain id. |
| `semiconductor-manufacturing` | `semiconductor` | maha-reference-resolver/1.0 | The Phase-4 pilot corpus uses the domain id "semiconductor". This alias makes the namespace difference explicit; it does not make pilot entries canonical. |

## Source verification ledger (24 citations)

| Key | State | Identifier | Locator |
| --- | --- | --- | --- |
| Q-BR-001A | verified-correct | `doi:10.48550/arXiv.quant-ph/9705052` | — |
| Q-BR-001B | not-independently-verified | — | — |
| Q-BR-002A | verified-correct | `doi:10.1038/s41467-021-22030-5` | — |
| Q-BR-002B | verified-correct | `doi:10.1021/cr900056b` | — |
| Q-BR-003A | verified-correct | `doi:10.1016/j.aop.2010.09.012` | — |
| Q-BR-003B | verified-correct | `https://transformer-circuits.pub/2023/monosemantic-features` | — |
| Q-BR-004A | verified-correct | `doi:10.1073/pnas.1619152114` | — |
| Q-BR-004B | unverifiable | — | — |
| Q-BR-005A | verified-correct | `isbn:9783662032251` | — |
| Q-BR-005B | unverifiable | — | — |
| Q-BR-006A | verified-correct | `isbn:0071147829` | — |
| Q-BR-006B | verified-with-correction | `doi:10.1007/s10894-015-0050-1` | — |
| Q-BR-007A | verified-correct | `doi:10.1103/PhysRevLett.105.077001` | — |
| Q-BR-007B | verified-correct | `doi:10.1038/nature26160` | — |
| Q-BR-008A | verified-correct | `doi:10.1103/PhysRevA.86.032324` | — |
| Q-BR-008B | verified-with-correction | `doi:10.1016/j.cobeha.2016.06.003` | — |
| Q-BR-009A | verified-with-correction | `doi:10.1038/nnano.2014.216` | — |
| Q-BR-009B | verified-correct | `doi:10.1557/mrc.2014.32` | — |
| Q-BR-010A | verified-correct | `doi:10.3389/fphy.2014.00005` | — |
| Q-BR-010B | unverifiable | — | — |
| Q-BR-011A | verified-correct | `doi:10.1016/j.tcs.2014.05.025` | — |
| Q-BR-011B | unverifiable | — | — |
| Q-BR-012A | verified-with-correction | `doi:10.1103/PhysRevApplied.13.034032` | — |
| Q-BR-012B | verified-correct | `isbn:9783527405725` | — |

## Endpoint dispositions (23 unresolved)

| Disposition | Count |
| --- | --- |
| CREATE_FOUNDATIONAL_CANDIDATE | 11 |
| MAP_TO_EXISTING_RECORD_WITH_EXPLICIT_ALIAS | 0 |
| REVISE_REFERENCE | 6 |
| REJECT_REFERENCE | 1 |
| DEFER_INSUFFICIENT_EVIDENCE | 5 |

| Key | Submitted reference | Disposition | In batch |
| --- | --- | --- | --- |
| Q-BR-001A | `quantum-systems:surface-code-threshold` | REVISE_REFERENCE | no |
| Q-BR-001B | `mathematics:algebraic-coding-theory` | DEFER_INSUFFICIENT_EVIDENCE | no |
| Q-BR-002A | `quantum-systems:transmon-coherence-limits` | CREATE_FOUNDATIONAL_CANDIDATE | yes |
| Q-BR-002B | `semiconductor-manufacturing:thin-film-deposition` | DEFER_INSUFFICIENT_EVIDENCE | no |
| Q-BR-003A | `quantum-systems:tensor-network-states` | CREATE_FOUNDATIONAL_CANDIDATE | no |
| Q-BR-003B | `mechanistic-interpretability:sparse-autoencoder-superposition` | REVISE_REFERENCE | no |
| Q-BR-004A | `quantum-systems:phase-estimation-hamiltonian` | CREATE_FOUNDATIONAL_CANDIDATE | yes |
| Q-BR-004B | `biomolecular-engineering:enzyme-active-site-kinetics` | DEFER_INSUFFICIENT_EVIDENCE | no |
| Q-BR-005A | `quantum-systems:cryogenic-dilution-attenuation` | CREATE_FOUNDATIONAL_CANDIDATE | yes |
| Q-BR-005B | `critical-supply-chains:helium-isotope-refinement` | CREATE_FOUNDATIONAL_CANDIDATE | yes |
| Q-BR-006A | `quantum-systems:superconducting-gap-depairing` | CREATE_FOUNDATIONAL_CANDIDATE | yes |
| Q-BR-007A | `quantum-systems:majorana-zero-modes` | CREATE_FOUNDATIONAL_CANDIDATE | yes |
| Q-BR-007B | `advanced-materials:twisted-bilayer-heterostructures` | REVISE_REFERENCE | no |
| Q-BR-008A | `quantum-systems:syndrome-extraction-cycle` | REVISE_REFERENCE | no |
| Q-BR-008B | `neuromorphic-biocomputing:spiking-fault-tolerance` | DEFER_INSUFFICIENT_EVIDENCE | no |
| Q-BR-009A | `quantum-systems:spin-qubit-hyperfine-dephasing` | CREATE_FOUNDATIONAL_CANDIDATE | yes |
| Q-BR-009B | `semiconductor-manufacturing:silicon-crystal-growth-and-wafer-preparation` | DEFER_INSUFFICIENT_EVIDENCE | no |
| Q-BR-010A | `quantum-systems:qubo-ising-mapping` | CREATE_FOUNDATIONAL_CANDIDATE | no |
| Q-BR-010B | `fusion-plasma:grad-shafranov-equilibrium-solver` | REVISE_REFERENCE | no |
| Q-BR-011A | `quantum-systems:bb84-entanglement-distribution` | REJECT_REFERENCE | no |
| Q-BR-011B | `agentic-systems:mcp-tool-authorization-enclaves` | REVISE_REFERENCE | no |
| Q-BR-012A | `quantum-systems:3d-cavity-resonator-loss` | CREATE_FOUNDATIONAL_CANDIDATE | no |
| Q-BR-012B | `critical-supply-chains:refractory-tantalum-niobium-refinement` | CREATE_FOUNDATIONAL_CANDIDATE | no |

## Endpoint candidates created

| Candidate | Domain | Class | Blockers |
| --- | --- | --- | --- |
| Transmon coherence limits | quantum-systems | mechanism | source-missing-locator, single-source-record |
| Quantum phase estimation and its resource dependencies | quantum-systems | mechanism | source-missing-locator, single-source-record |
| Dilution refrigeration below 100 mK | quantum-systems | mechanism | source-missing-locator, single-source-record |
| Helium-3 isotope supply | critical-supply-chains | supply-node | source-missing-locator, single-source-record |
| Superconducting gap, critical field and depairing current | quantum-systems | concept | source-missing-locator, single-source-record |
| Majorana zero modes: proposal and experimental signature | quantum-systems | concept | source-missing-locator, single-source-record |
| Hyperfine dephasing in silicon spin qubits | quantum-systems | mechanism | source-missing-locator |

