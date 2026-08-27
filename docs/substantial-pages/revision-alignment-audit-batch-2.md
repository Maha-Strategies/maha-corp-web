# Batch 2 withheld records — proposed-revision alignment audit

This is an independent internal editorial alignment audit of a proposed revision. It is not the internal review decision and it is not a release: an audit that reaches alignment-clear produces a reviewer packet for a separate review pass, performed by a separate operation.

Digest: `sha256:ec8e949d630838dcb6e12948694d9a21439f4deca5185d8c083c23ebd6c3d30b`

| Record | Outcome | Superseded | Proposed | Audited |
|---|---|---|---|---|
| agentic-systems-mcp-tool-deny-by-default | `alignment-clear-ready-for-internal-rereview` | `85adb7771a58aabd` | `bc2f686b2a68541c` | `bc3682ef4b4613b4` |
| fusion-plasma-systems-breeding-blanket-test-modules | `alignment-clear-ready-for-internal-rereview` | `84091c063213ab34` | `b105cd37afb90148` | `3eb362d91f332ac7` |

## `agentic-systems-mcp-tool-deny-by-default`

Audited canonical path: `/knowledge/agentic-systems-mcp/concepts/agentic-systems-mcp-human-denial-control-for-tool-invocations`

Correction applied by this audit: `{"title":"Human denial control for tool invocations","slug":"agentic-systems-mcp-human-denial-control-for-tool-invocations","description":"A source-bounded concept record for the human denial control the Model Context Protocol recommends for tool invocations, within agentic systems and MCP.","boundaries":["A recommended human denial control does not by itself establish system-level performance, safety, manufacturability, scalability, economic advantage, clinical benefit, or deployment readiness.","A source-bounded concept record does not establish manufacturing yield, economic advantage, safety, clinical benefit, or commercial readiness unless those outcomes are measured in a separately scoped record."],"prohibitedInferences":["Do not use this human denial control record to claim that the surrounding technology is proven, safe, scalable, commercially available, or strategically superior.","Do not transfer a reported result across hardware, organisms, protocols, datasets, operating conditions, or outcome definitions without a declared comparison contract.","Do not read a recommended human ability to deny an invocation as a requirement that tools be denied unless explicitly permitted."]}`

| Dimension | Verdict | Finding |
|---|---|---|
| `source-identity` | satisfied | The proposal binds the Tools page of the Model Context Protocol specification, version 2024-11-05. That is the same specification and the same version the superseded record bound, so this is a locator correction within one artifact rather than a change of source identity. The page was re-fetched for this audit and served the same content. |
| `exact-locator-fidelity` | satisfied | The locator names the "User Interaction Model" warning block and the "Security Considerations" list. Both headings exist verbatim on the inspected page, and both contain the language the claim relies on. |
| `claim-to-passage-alignment` | satisfied | The claim asserts a normative SHOULD addressed to implementors and an express non-mandate. The page states "there SHOULD always be a human in the loop with the ability to deny tool invocations" with SHOULD capitalised, and "the protocol itself does not mandate any specific user interaction model". The claim asserts neither more nor less. |
| `rights-basis` | satisfied | citation-with-paraphrase against a publicly served specification page. The record retains original paraphrase and reproduces no block of specification text, schema, or diagram. |
| `scope-and-uncertainty` | satisfied | Scope is bound to two named sections of one specification version. The uncertainty that matters is recorded: later specification versions add an authorization specification that was deliberately not consulted, because citing it would change the artifact version without a declared version relationship. |
| `prohibited-inferences` | satisfied | The prohibitions close the three readings the evidence cannot carry: a general least-privilege principle presented as an MCP mandate, an implementor recommendation read as a protocol requirement, and an inference that any deployed runtime denies tools by default. |
| `record-classification` | corrected | PR #241 moved the record from comparison to concept. This audit confirms concept: the artifact defines a recommended control and reports no comparison between exposure postures, so neither comparison nor measurement is available. |
| `title-to-claim-consistency` | corrected | The submitted title "Tool deny by default" overstates the source. The phrases "deny by default", "default-deny", "denied by default" and "allowlist" appear nowhere on the inspected page. What the page supports is a human ability to deny an invocation — a control that must be available, not a posture that must be the default. The audited title is "Human denial control for tool invocations" with a matching slug, so the record name no longer asserts more than the locator carries. |

**Outcome: `alignment-clear-ready-for-internal-rereview`**

## `fusion-plasma-systems-breeding-blanket-test-modules`

Audited canonical path: `/knowledge/fusion-plasma-systems/concepts/fusion-plasma-systems-breeding-blanket-test-modules`

Correction applied by this audit: `{"description":"A source-bounded concept record for the ITER Test Blanket Module programme within fusion and plasma systems.","boundaries":["A documented test programme does not by itself establish system-level performance, safety, manufacturability, scalability, economic advantage, clinical benefit, or deployment readiness.","A source-bounded concept record does not establish manufacturing yield, economic advantage, safety, clinical benefit, or commercial readiness unless those outcomes are measured in a separately scoped record."],"prohibitedInferences":["Do not use this test blanket module programme record to claim that the surrounding technology is proven, safe, scalable, commercially available, or strategically superior.","Do not transfer a reported result across hardware, organisms, protocols, datasets, operating conditions, or outcome definitions without a declared comparison contract.","Do not read a planned test programme as demonstrated tritium breeding, measured performance, completed materials qualification, or commercial blanket readiness."]}`

| Dimension | Verdict | Finding |
|---|---|---|
| `source-identity` | corrected | The proposal replaces the ITER Supporting Systems index with the ITER Tritium Breeding page. This is a genuine change of source identity, not a locator correction, and it is why the PR #241 disposition was replace-source-pending-review. The replacement page was re-fetched for this audit and named the subject directly. |
| `exact-locator-fidelity` | satisfied | The locator names the "ITER Test Blanket Module (TBM) Program" section. That heading exists verbatim on the inspected page, and the section names test blanket modules and four member concepts. The superseded locator named neither blankets nor test modules, which was the original defect. |
| `claim-to-passage-alignment` | satisfied | The claim asserts a documented programme under which modules will be used to test breeding, plus the stated need for further research. The page states "ITER will experiment with tritium production within the vacuum vessel by way of test blanket modules (TBMs)" and "Further research will be necessary to demonstrate the feasibility of large-scale tritium production and recycling". The claim tracks both sentences and adds nothing. |
| `rights-basis` | satisfied | citation-with-paraphrase against an authoritative publisher page. No figure, diagram, or block of ITER text is reproduced. |
| `scope-and-uncertainty` | corrected | Scope is bound to the single named TBM Program section. The audit re-checked the version position and confirmed the page carries no publication date, no version number and no last-updated stamp, and no archival snapshot was pinned. That limitation is recorded on the audit rather than left implicit, so a future reader is told the wording may have moved. |
| `prohibited-inferences` | satisfied | The prohibitions separate the claims the task requires kept apart: tritium breeding, heat extraction, neutron exposure, materials qualification, module geometry, programme scope and commercial readiness. Demonstrated breeding, any breeding ratio, qualification and commercial readiness are each explicitly closed, and transfer between TBM concepts is forbidden because they differ in coolant and breeder. |
| `record-classification` | corrected | PR #241 moved the record from measurement to concept, and this audit confirms concept is correct. A measurement would require a measured quantity and the page reports none. A method would imply a procedure the record instructs someone to follow; the page describes a programme that will be run, not a method to apply. Concept records the bounded existence and scope of the TBM programme, which is exactly what the section supports. |
| `title-to-claim-consistency` | satisfied | The title "Breeding blanket test modules" names precisely what the inspected section names. It asserts no performance, no completion and no readiness, so unlike the MCP record the title needs no correction. |

**Outcome: `alignment-clear-ready-for-internal-rereview`**

## Reviewer packets

2 packet(s) generated, **0 review decisions recorded**. The internal rereview is a separate operation and was deliberately not performed here.
