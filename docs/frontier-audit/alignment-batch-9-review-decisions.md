# Frontier source-alignment Batch 9 internal review

Review `maha-frontier-alignment-batch/9.1` · digest `sha256:3d91420bfa1ff57e72f07ad7f53598fe3e97475d8f92686d3cc5895d07afa463`

This is a separate internal-editorial review pass over the immutable Batch 9 proposals. It is not external review, independent reproduction, canonical adoption, or release authority. Accepted decisions produce private candidate revision and provenance digests only; the active records remain unchanged.

| Measure | Count |
| --- | --- |
| reviewed | 20 |
| accepted | 14 |
| revise | 5 |
| rejected | 1 |
| acceptedCandidateRevisions | 14 |
| canaryCandidateRevisions | 5 |
| canonicalMutationsAuthorized | 0 |
| publicProjectionsAuthorized | 0 |
| releasesAuthorized | 0 |

## Decisions

| Record | Decision | Claim scope | Version relationship | Action |
| --- | --- | --- | --- | --- |
| `advanced-materials-direct-gap-mos2` | `accept` | `supports-exact-bounded-claim` | `verified-related-prepublication-manuscript` | Retain the material, layer-count, and measurement-method limits. |
| `advanced-materials-graphene-hbn-heterostructures` | `accept` | `supports-exact-bounded-claim` | `verified-related-prepublication-manuscript` | Do not widen the record to arbitrary encapsulated, twisted, or moire structures. |
| `advanced-materials-two-dimensional-magnetism` | `accept` | `supports-exact-bounded-claim` | `verified-related-prepublication-manuscript` | Do not generalize to room-temperature magnetism or other materials. |
| `agentic-systems-mcp-human-approval-boundaries` | `accept` | `supports-exact-bounded-claim` | `exact-authoritative-artifact` | Preserve the distinction between SHOULD guidance and protocol-enforced behavior. |
| `agentic-systems-mcp-multi-agent-role-assignment` | `reject` | `does-not-support-claim` | `verified-related-prepublication-manuscript` | Reject this replacement. Either rename the record to prompted role-playing or locate a source that directly studies role assignment. |
| `agentic-systems-mcp-prompt-injection-through-tools` | `accept` | `supports-exact-bounded-claim` | `verified-related-prepublication-manuscript` | Adopt the replacement only with the packet limitation that this is not an MCP-specific exploit result or universal exploitability claim. |
| `biomolecular-engineering-compartmentalized-cell-free-systems` | `revise` | `record-revision-required` | `exact-version-of-record` | Revise recordKind to concept or method and keep the measured-expression result as a subordinate claim. |
| `biomolecular-engineering-droplet-microfluidic-screening` | `revise` | `record-revision-required` | `exact-version-of-record` | Revise recordKind and claim language from comparison to method before adopting the source. |
| `biomolecular-engineering-synthetic-riboswitches` | `accept` | `supports-exact-bounded-claim` | `exact-version-of-record` | Preserve the tested ligand, host, switch, and reporter limits. |
| `critical-supply-chains-magnet-recycling` | `accept` | `supports-exact-bounded-claim` | `verified-repository-copy-of-record` | Retain the 2013 review date and do not infer current capacity, economics, or qualification. |
| `critical-supply-chains-tantalum-concentrate-traceability` | `accept` | `supports-exact-bounded-claim` | `exact-authoritative-artifact` | Do not represent the guidance as certifying a shipment, mine, smelter, or implementation. |
| `fusion-plasma-systems-cable-in-conduit-conductors` | `accept` | `supports-exact-bounded-claim` | `exact-authoritative-artifact` | Record the living-page status and avoid inferring a complete conductor specification or lifetime distribution. |
| `fusion-plasma-systems-neutron-material-damage` | `revise` | `record-revision-required` | `verified-related-prepublication-manuscript` | Revise recordKind and claim language to modelled calculation or estimate before adopting the source. |
| `fusion-plasma-systems-rebco-high-field-magnets` | `accept` | `supports-exact-bounded-claim` | `verified-related-prepublication-manuscript` | Keep commercial-plant performance, readiness, and the remaining Q-BR blockers outside this revision. |
| `longevity-metabolism-ampk-energy-sensing` | `revise` | `record-revision-required` | `verified-related-prepublication-manuscript` | Revise recordKind and evidence maturity to reflect secondary synthesis before adopting the source. |
| `longevity-metabolism-cd38-nad-consumption` | `accept` | `supports-exact-bounded-claim` | `verified-related-prepublication-manuscript` | Keep human therapeutic efficacy and universal ageing claims prohibited. |
| `mechanistic-interpretability-automated-feature-interpretation` | `accept` | `supports-exact-bounded-claim` | `exact-authoritative-artifact` | Preserve the stated limitations: imperfect explanations, correlation rather than mechanism, and no complete model understanding. |
| `mechanistic-interpretability-dead-features` | `accept` | `supports-exact-bounded-claim` | `exact-authoritative-artifact` | State that dead means inactive on the declared evaluation corpus, not impossible to activate on every input. |
| `mechanistic-interpretability-path-patching` | `revise` | `record-revision-required` | `verified-related-prepublication-manuscript` | Revise recordKind to method before adopting the replacement. |
| `neurotechnology-bci-light-delivery-tissue-heating` | `accept` | `supports-exact-bounded-claim` | `verified-related-prepublication-manuscript` | Keep wavelength, power, duty cycle, geometry, tissue, and duration explicit; do not infer one universal safe threshold. |

## Five-record private canary

Canary digest `sha256:41f481e03a8c3a5973803ea3f14f5c3430167383579faa937c68bb3fa8053eed`

| Record | Candidate revision | Provenance | State |
| --- | --- | --- | --- |
| `agentic-systems-mcp-human-approval-boundaries` | `sha256:2111b62d31fd3f59170565d4f1ff08329298319cf52273f15740a1f72315b3fe` | `sha256:5be3210b96b29643dce340832ebc302a52c0dfc46253e22c35a9fc23281f56a3` | `private-candidate-only` |
| `fusion-plasma-systems-rebco-high-field-magnets` | `sha256:f241860ebdb6b2fec87a4c95fc4e1ba34e5dcd09204bfc42b066093498cac089` | `sha256:52e1822281e96e9067054ebc6eda8938d554ddd5f1ef431571c65a25c8092008` | `private-candidate-only` |
| `advanced-materials-direct-gap-mos2` | `sha256:6231e2b6055f890f7ba156ce61a5d8f10523ddb8c608127cb5e2d8b643165d9d` | `sha256:cea30bb96ff36672402d4802720eeb4fe373abc0c7c6e90532ad30ac45c3e840` | `private-candidate-only` |
| `longevity-metabolism-cd38-nad-consumption` | `sha256:b52cc878a94192da65f6d18a0e7b52cd01b6e42d606a9724d0234bda884537f6` | `sha256:e15da00c67693d1d3dc3b0bd2f7c806df1f5ae49e48e602a77626e359c62086a` | `private-candidate-only` |
| `neurotechnology-bci-light-delivery-tissue-heating` | `sha256:b48e1d8a695dc49e68908c869da0d215dd46a3d022556686d07e90ff05c05133` | `sha256:f794d55af7d6728bc70f9b41504ac3e0fdb8dd3c4930ff421246f5520b0fafa8` | `private-candidate-only` |

## Boundaries

- A review decision never edits the active source contract.
- Revise, reject, missing, stale, or tampered decisions fail closed in the candidate compiler.
- Accepted candidates are private source-binding revisions, not canonical records or releases.
- No source content, quotation, credential, database row, public route, sitemap entry, or llms.txt entry is created.
