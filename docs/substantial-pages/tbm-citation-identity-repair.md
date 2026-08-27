# Breeding blanket test modules — citation identity repair

Source identity was re-verified against the served document. ITER publishes restrictive terms of use, and this record therefore reproduces no ITER text, figure, or diagram: it states facts with attribution and a link. This is internal editorial work and asserts no legal, regulatory, scientific, or commercial clearance.

Digest: `sha256:06f549d5d2714db594b851abfd9665c13b5d12fb93fa3ba10dfddd18a01238b5`

## Revisions

- Superseded (revise-again): `sha256:3eb362d91f332ac755d9793f8e43d781e445bbe64827d24521af037288e54723`
- Current: `sha256:23fd7c8075e836e7729ae0b5325ae1e2b9789836168b329b2dd3dce1d8eff96c`

## Source identity before and after

| Field | Before | After |
|---|---|---|
| `title` | Supporting systems | Tritium breeding |
| `url` | https://www.iter.org/machine/supporting-systems/tritium-breeding | https://www.iter.org/machine/supporting-systems/tritium-breeding |
| `stableIdentifier` | https://www.iter.org/machine/supporting-systems | https://www.iter.org/machine/supporting-systems/tritium-breeding |
| `publisher` | ITER Organization | ITER Organization |
| `publishedAt` | — | 2023-06-19 |
| `modifiedAt` | — | 2025-01-30 |
| `exactLocator` | ITER "Tritium Breeding" page: the "ITER Test Blanket Module (TBM) Program" section naming the test blanket modules and the four member concepts. | ITER Tritium breeding page, section headed "ITER Test Blanket Module (TBM) Program", which names the test blanket modules and the four ITER Member concepts. |
| `rightsBasis` | citation-with-paraphrase | citation-with-paraphrase |
| `metadataProvenance` | Carried over from the superseded supporting-systems binding without re-verification. | Re-opened directly. The document declares rel="canonical" https://www.iter.org/machine/supporting-systems/tritium-breeding, og:title "Tritium breeding", og:site_name "ITER - the way to new energy", article:published_time 2023-06-19 and article:modified_time 2025-01-30. The section heading "ITER Test Blanket Module (TBM) Program" was confirmed present in the served markup. No JSON-LD is published on the page. ITER publishes terms of use at https://www.iter.org/terms-use permitting download and copying provided content is not amended, limiting use to personal non-commercial purposes, prohibiting derivative works and redistribution, and requiring that ITER copyright be acknowledged. This record reproduces no ITER text, figure, or diagram. |
| `versionRelationshipVerified` | false | true |
| `archivalSnapshotPinned` | false | false |

## Citation identity gate

| Check | Before | After |
|---|---|---|
| `identifier-resolves-to-cited-document` | **fail** | pass |
| `title-names-the-cited-document` | **fail** | pass |
| `locator-names-the-claimed-subject` | pass | pass |
| `publisher-declared` | pass | pass |
| `rights-basis-declared` | pass | pass |
| `version-position-established-or-disclosed` | pass | pass |
| `archival-snapshot-disclosed` | pass | pass |

## Ten-dimension rereview of the new revision

| Dimension | Verdict | Rationale | Disagreement or uncertainty |
|---|---|---|---|
| `source-fidelity` | **approve** | The defect that produced the previous revise verdict is gone. The stable identifier, the cited url and the declared canonical URL are now one string, https://www.iter.org/machine/supporting-systems/tritium-breeding, and the source title "Tritium breeding" is the document's own og:title rather than the superseded page's name. Resolving the identifier now lands a reader on the document the claim rests on. Both URLs were re-opened for this repair and confirmed to serve different documents, which is what made the previous binding unusable. | The document's HTML title element reads "Tritium Breeding | ITER is First Fusion Device to Test", which appends a site tagline. The og:title was preferred as the document title proper and the full title element is recorded in metadata provenance rather than discarded. |
| `locator-fidelity` | **approve** | The locator names the section headed "ITER Test Blanket Module (TBM) Program", and that exact string was confirmed present in the served markup for this repair, capital P included. The section names the test blanket modules and the four ITER Member concepts. Unlike the previous revision the locator is now reachable, because the identifier resolves to the document that contains it. | The page also uses lowercase "Test Blanket Module (TBM) program" in its og:description. The heading form was chosen for the locator because a locator should name a heading a reader can find. |
| `claim-boundedness` | **approve** | The claim is carried forward unchanged from the audited revision, and re-checked against the re-opened document. It states that ITER documents a programme under which modules will be used to test breeding concepts, and carries ITER's own statement that further research is necessary to demonstrate feasibility. Both halves appear in the document's own og:description verbatim, so the paraphrase tracks the source rather than drifting from it. | None. The claim was not the defect and was deliberately not reopened beyond re-verification. |
| `domain-fidelity` | **approve** | The record remains a fusion and plasma systems record about one experimental machine's planned programme. The corrected identity does not widen it: the Tritium breeding page is an ITER machine page, so the domain of the source and the domain of the record agree more closely than they did when the binding named a general supporting-systems inventory. | None. |
| `title-and-slug-accuracy` | **approve** | The record title "Breeding blanket test modules" and its slug are unchanged and still name exactly what the cited section names. The correction in this revision was to the source title, not the record title, and those are separate fields: the record now names its subject and its source correctly and separately. | The record title still names the modules while the claim is about the programme. That gap was noted at the previous review, is unchanged here, and is closed by the scope sentence rather than by the title. |
| `record-class-suitability` | **approve** | Concept remains correct and the corrected identity does not disturb it. The cited section reports no measured quantity, so measurement stays unavailable, and it describes a programme ITER will run rather than a procedure a reader performs, so method would overstate. Nothing in the re-opened document supplies a measurement that would justify reclassifying. | Method remains a reasonable alternative reading, as recorded at the previous review. The re-inspection produced no new reason to prefer it. |
| `uncertainty-adequacy` | **approve** | This dimension improved materially. The previous review recorded that the page carried no publication date, version number or last-updated stamp. Re-opening the document directly showed that reading was wrong: it declares article:published_time 2023-06-19 and article:modified_time 2025-01-30 alongside a canonical URL. The version position is therefore established from the artifact, and versionRelationshipVerified moves to true on evidence rather than on assumption. | archivalSnapshotPinned stays false. A declared modification date bounds drift but does not prevent it, and no capture was pinned, so a reader after 2025-01-30 may find different wording. Correcting the earlier finding also means the earlier review's uncertainty note was inaccurate, and that correction is recorded rather than quietly replaced. |
| `prohibited-inference-coverage` | **approve** | All three prohibitions carry forward unchanged, including the one that names this record's failure mode: do not read a planned test programme as demonstrated tritium breeding, measured performance, completed materials qualification, or commercial blanket readiness. Re-inspection confirmed the document asserts none of those, so the prohibitions still match what the source withholds. | None. |
| `rights-basis` | **approve** | ITER's published terms of use were read for this repair. They permit downloading and copying provided content is not amended, limit use to personal and non-commercial purposes, prohibit derivative works and redistribution, and require that ITER copyright be acknowledged. Those terms are now recorded verbatim in the source's metadata provenance rather than left unstated. The declared basis remains citation-with-paraphrase because the rights vocabulary is a closed union and contains no member expressing attribution without reproduction; inventing one was attempted and correctly rejected by the type system. | Two things are unresolved and are surfaced rather than settled. First, ITER restricts use to personal non-commercial purposes and forbids derivative works, while this record is published by a commercial organisation; whether factual reporting with attribution falls outside those restrictions is a legal question internal editorial review does not resolve and does not claim to. Second, the rights vocabulary itself has a gap: citation-with-paraphrase is the closest accurate member but overstates what this record does, since it reproduces nothing. A schema-level addition would describe it better. |
| `public-wording-safety` | **approve** | The public-facing wording is unchanged and still cannot be read as a fusion milestone. What changed is that a reader following the citation now reaches the document that supports it, which is itself a public-safety property: a citation that resolves to the wrong page invites a reader to conclude the claim is unsupported, or to attribute it to a page that does not make it. | The record still states no date for TBM operation, which is accurate to the cited section but leaves timing open to a reader who assumes imminence. |

**State: `internally-approved-ready-for-release-preflight`**

## Lineage

| Revision | Label | Source title | Stable identifier | Standing decision |
|---|---|---|---|---|
| `84091c063213ab34` | submitted | Supporting systems | https://www.iter.org/machine/supporting-systems | Withheld by internal review with blockers locator-does-not-name-claimed-subject and measurement-kind-without-measured-quantity. Retained unedited. |
| `b105cd37afb90148` | first repair proposal | Supporting systems | https://www.iter.org/machine/supporting-systems | Superseded within PR #241 by the audited revision; not separately decided. |
| `3eb362d91f332ac7` | audited repair (revise-again) | Supporting systems | https://www.iter.org/machine/supporting-systems | Internal rereview returned revise-again: nine approvals and one revise on source-fidelity. That decision is immutable and remains visible. |
| `23fd7c8075e836e7` | citation-identity repair | Tritium breeding | https://www.iter.org/machine/supporting-systems/tritium-breeding | Subject to the fresh chain recorded alongside this lineage. No decision is inherited. |

- **submitted** (`84091c063213ab34`) — The bound locator named heating, fuel cycle, vacuum, cryogenic, diagnostics and tritium breeding summaries. It named neither blankets nor test modules, and the record was typed as a measurement over a systems inventory.
- **first repair proposal** (`b105cd37afb90148`) — Rebound to the ITER Tritium breeding page at the TBM Program section and re-typed from measurement to concept, which repaired the subject-coverage defect.
- **audited repair (revise-again)** (`3eb362d91f332ac7`) — Description, boundaries and prohibited inferences were completed for the concept kind. The source identity was not: title and identifier still named the superseded document.
- **citation-identity repair** (`23fd7c8075e836e7`) — Source identity corrected end to end from the re-opened document: title, stable identifier, publisher, publication and modification dates, locator wording, rights basis and metadata provenance. The bounded claim, concept kind, boundaries and prohibited inferences are unchanged.

## Release-readiness preflight

Internally approved: **yes**. Canonical release created: **no**. Release authority used: **no**. In frozen 20-record cohort: **no**.

Propose a later, separate two-record repaired-revision canary containing Human denial control for tool invocations and Breeding blanket test modules. That canary is not created or dispatched here, and neither record joins the frozen 20-record remainder cohort.
