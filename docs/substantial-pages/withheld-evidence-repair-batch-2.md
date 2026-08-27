# Batch 2 withheld records — evidence repair packets

This is AI-assisted internal editorial source-repair work performed by the publisher. It is not external expert review, peer review, consensus, independent reproduction, scientific validation, or commercial certification. A repair packet is a proposal for a fresh internal review; it is not approval, validation, or publication.

Digest: `sha256:f35d10f036562867dc76d249ff6221d4991e65260b04625f4a3d3283ccc1a684`

| Record | Disposition | Revision before | Revision after |
|---|---|---|---|
| agentic-systems-mcp-tool-deny-by-default | `revise-record` | `85adb7771a58aabd` | `bc2f686b2a68541c` |
| fusion-plasma-systems-breeding-blanket-test-modules | `replace-source-pending-review` | `84091c063213ab34` | `b105cd37afb90148` |

## `agentic-systems-mcp-tool-deny-by-default`

### Submitted, unchanged

- kind: `comparison`
- claim: The cited source supports treating tool deny by default as a distinct comparison within the stated agentic systems and mcp scope.
- source: https://modelcontextprotocol.io/specification/2024-11-05/index
- locator: Architecture, lifecycle, capabilities, resources, prompts, and security sections.

### Audit findings

- The submitted claim treats "tool deny by default" as a comparison supported by the specification index, whose own source boundary states that a protocol primitive does not prescribe an organisation’s allowlist, identity, retention, or approval policy.
- The frontier alignment audit recorded this record as supported at inspection depth "abstract-only", reasoning that hosts must obtain explicit user consent before invoking any tool. That reading is partly right and materially incomplete: on the specification index the word "must" appears in lowercase, and the index states in the same section that MCP cannot enforce these security principles at the protocol level.
- The specification declares BCP 14 keywords normative only when they appear in all capitals, so the lowercase "must" on the index is not a protocol requirement.
- Direct inspection of the Tools page for the same version does find normative, capitalised language that names the subject: a human SHOULD always be in the loop with the ability to deny tool invocations.
- The specification also states on that page that the protocol itself does not mandate any specific user interaction model, which forecloses reading deny-by-default as an MCP requirement.
- No comparative evidence between default-deny and default-allow exposure exists in the cited artifact, so the record cannot stand as a comparison.

### Inspected passages

- **Tools page, "User Interaction Model" warning block.** — For trust, safety and security the page states there SHOULD always be a human in the loop with the ability to deny tool invocations, and that applications SHOULD make clear which tools are exposed, indicate invocations, and present confirmation prompts.
  - force: `implementation-recommendation` · normative keyword: `SHOULD` · depth: `specified-sections`
  - version relationship: Version of record for specification version 2024-11-05, the same version already bound by the submitted record.
- **Tools page, "User Interaction Model" opening paragraphs.** — The page states that implementations are free to expose tools through any interface pattern and that the protocol itself does not mandate any specific user interaction model.
  - force: `protocol-requirement` · normative keyword: `none` · depth: `specified-sections`
  - version relationship: Version of record for specification version 2024-11-05.
- **Tools page, "Security Considerations" list.** — Servers MUST validate all tool inputs, implement proper access controls, rate limit tool invocations, and sanitize tool outputs. Clients SHOULD prompt for user confirmation on sensitive operations.
  - force: `protocol-requirement` · normative keyword: `MUST` · depth: `specified-sections`
  - version relationship: Version of record for specification version 2024-11-05.
- **Specification index, "Security and Trust & Safety" section, Key Principles and Implementation Guidelines.** — The index lists tool safety principles in lowercase prose, including that hosts must obtain explicit user consent before invoking any tool, and then states that MCP itself cannot enforce these security principles at the protocol level, with implementor obligations expressed as SHOULD.
  - force: `general-security-principle` · normative keyword: `lowercase-must` · depth: `specified-sections`
  - version relationship: Version of record for specification version 2024-11-05; the artifact currently bound by the submitted record.

### Proposed revision

- kind: `comparison` → `concept`
- claim: The Model Context Protocol specification recommends, as a normative SHOULD for implementors rather than a protocol mandate, that a human remain in the loop with the ability to deny tool invocations, and states that the protocol itself does not mandate any specific user interaction model.
- source: https://modelcontextprotocol.io/specification/2024-11-05/server/tools
- locator: Tools page, version 2024-11-05: the "User Interaction Model" warning block and the "Security Considerations" list.
- explicit unsupported extensions:
  - That MCP requires tools to be denied by default.
  - That any named runtime, client, or host implements a default-deny posture.
  - That a deny-by-default posture measurably reduces incidents.

### Disagreement and uncertainty

- The frontier alignment audit judged this record supported. This repair disagrees in part: the underlying observation is real, but the audit read a lowercase "must" as a requirement and did not record the specification’s own statement that it cannot enforce these principles at the protocol level. Both entries are retained; neither is edited.
- The internal review blocked the record. This repair agrees with that outcome for the submitted claim and proposes a narrower one rather than defending the original.
- Only the 2024-11-05 version was inspected, because that is the version the record binds. Later specification versions add an authorization specification that was deliberately not consulted, since citing it would change the artifact version without a declared version relationship.
- Whether a reader treats "a human in the loop with the ability to deny" as equivalent to "deny by default" is an editorial judgement. The proposed claim therefore states the recommendation rather than the label.

### Prohibited inferences

- Do not present a general least-privilege or zero-trust principle as something the Model Context Protocol mandates.
- Do not read an implementor recommendation as a protocol requirement.
- Do not infer that any deployed host, client, or runtime denies tools by default.
- Do not use this record as evidence that a deny-by-default posture is safer, since the cited artifact reports no comparison.

**Recommended disposition:** `revise-record`

## `fusion-plasma-systems-breeding-blanket-test-modules`

### Submitted, unchanged

- kind: `measurement`
- claim: The cited source supports treating breeding blanket test modules as a distinct measurement within the stated fusion and plasma systems scope.
- source: https://www.iter.org/machine/supporting-systems
- locator: Heating and current drive, fuel cycle, vacuum, cryogenic, diagnostics, and tritium breeding system summaries.

### Audit findings

- The submitted record binds the ITER Supporting Systems index, whose declared locator names heating and current drive, fuel cycle, vacuum, cryogenic, diagnostics and tritium breeding system summaries. It names neither breeding blankets nor test blanket modules.
- The frontier alignment audit recorded this record as supported at inspection depth "abstract-only", reasoning that ITER documents test blanket modules. Direct inspection confirms ITER does document them — but on a different page from the one the record binds.
- The submitted record is typed as a measurement while the bound page is a systems inventory whose own boundary states that a system inventory is not evidence of integrated commercial operation. An inventory supplies no measured quantity.
- The ITER Tritium Breeding page does name test blanket modules directly, in a section headed "ITER Test Blanket Module (TBM) Program", and identifies four member concepts.
- That page states ITER will experiment with tritium production by way of TBMs and that further research will be necessary to demonstrate the feasibility of large-scale tritium production and recycling, which forecloses any demonstrated-performance reading.

### Inspected passages

- **"ITER Test Blanket Module (TBM) Program" section.** — The section names test blanket modules and states that ITER will experiment with tritium production within the vacuum vessel by way of TBMs. Four member concepts are identified: water-cooled lithium-lead, water-cooled ceramics breeder, helium-cooled ceramics breeder, and helium-cooled ceramic pebbles.
  - force: `protocol-requirement` · normative keyword: `none` · depth: `specified-sections`
  - version relationship: Authoritative publisher living page; the version inspected is the one served at the time of this repair. No archival snapshot was pinned.
- **"Tritium breeding" section, closing statement on feasibility.** — The page states that ITER will be the first fusion device to test tritium self-sustainment, and that further research will be necessary to demonstrate the feasibility of large-scale tritium production and recycling.
  - force: `protocol-requirement` · normative keyword: `none` · depth: `specified-sections`
  - version relationship: Authoritative publisher living page, inspected directly.

### Proposed revision

- kind: `measurement` → `concept`
- claim: ITER documents a Test Blanket Module programme under which in-vessel modules will be used to test tritium breeding concepts, and states that further research is necessary to demonstrate the feasibility of large-scale tritium production and recycling.
- source: https://www.iter.org/machine/supporting-systems/tritium-breeding
- locator: ITER "Tritium Breeding" page: the "ITER Test Blanket Module (TBM) Program" section naming the test blanket modules and the four member concepts.
- explicit unsupported extensions:
  - That tritium self-sufficiency has been demonstrated.
  - That any breeding ratio or extraction rate has been measured.
  - That blanket materials are qualified for a power reactor.
  - That a commercial breeding blanket is ready.

### Disagreement and uncertainty

- The frontier alignment audit judged this record supported because ITER documents TBMs. This repair does not dispute that ITER documents them; it disputes that the page the record binds does. Both entries are retained; neither is edited.
- The proposed source is a different ITER page from the submitted one. It is a proposal for review, not a substitution: the submitted binding is reproduced unchanged in this packet.
- The ITER page is a living publisher page with no version identifier or archival snapshot pinned, so a future reader may find different wording. The version relationship is recorded as such rather than claimed to be stable.
- Whether the record is better typed as a concept or a method for the TBM programme is an editorial judgement. Concept is proposed because the programme is described, not performed.
- IAEA and EUROfusion technical literature on breeding blankets was not inspected for this repair. The single ITER page was sufficient to support the narrowed claim, and adding uninspected sources would widen the binding without widening the evidence.

### Prohibited inferences

- Do not infer demonstrated tritium breeding or self-sufficiency from a planned test programme.
- Do not infer any breeding ratio, extraction rate, neutron exposure result, or heat-extraction performance.
- Do not infer materials qualification for a power reactor.
- Do not infer commercial blanket readiness or a delivery timeline.
- Do not transfer results between TBM concepts, which differ in coolant and breeder.

**Recommended disposition:** `replace-source-pending-review`
