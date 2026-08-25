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
| rights-basis-unverified | 12 |
| source-missing-identifier | 8 |
| source-missing-locator | 12 |
| source-unverifiable | 1 |

## Remediable to review

| ID | Remediation required |
| --- | --- |
| Q-BR-001 | create the missing canonical record(s) for the named endpoints; supply exact locators; supply stable identifiers; establish a rights basis |
| Q-BR-002 | create the missing canonical record(s) for the named endpoints; supply exact locators; establish a rights basis |
| Q-BR-004 | create the missing canonical record(s) for the named endpoints; supply exact locators; supply stable identifiers; establish a rights basis |
| Q-BR-005 | create the missing canonical record(s) for the named endpoints; supply exact locators; supply stable identifiers; establish a rights basis |
| Q-BR-006 | create the missing canonical record(s) for the named endpoints; supply exact locators; supply stable identifiers; establish a rights basis |
| Q-BR-007 | create the missing canonical record(s) for the named endpoints; supply exact locators; establish a rights basis |
| Q-BR-008 | create the missing canonical record(s) for the named endpoints; supply exact locators; establish a rights basis |
| Q-BR-009 | create the missing canonical record(s) for the named endpoints; supply exact locators; establish a rights basis |
| Q-BR-012 | create the missing canonical record(s) for the named endpoints; supply exact locators; supply stable identifiers; establish a rights basis |

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

