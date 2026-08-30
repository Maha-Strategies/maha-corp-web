/**
 * Frontier source-alignment Batch 11.
 *
 * Twenty records selected from the 110 unresolved or mismatched records that
 * Batches 9 and 10 did not cover and that do not overlap the twenty-six
 * candidates accepted in the private source-activation work. Selection favours
 * records that gate a Quantum Bridge endpoint, a substantial-page pilot
 * contract, a publication batch, or a source-recovery packet.
 *
 * Every packet below records what was actually done. Ten records were bound to
 * an independently discovered source that was opened and read at the locator
 * given. Two were narrowed rather than rebound, because the inspected source
 * carries part of the record's subject and not the whole of it. Eight failed
 * closed: no subject-matched, inspectable source was established, and for those
 * the packet proposes nothing at all.
 *
 * Rights are decided per source rather than by blanket rule. A short passage is
 * committed only where the source is a US Government work or carries CC BY 4.0.
 * Where the source is readable but not openly licensed - an arXiv
 * nonexclusive-distrib deposit, a PMC author manuscript - the packet records the
 * locator and a paraphrase and commits no source text.
 *
 * Nothing here is canonical. No packet replaces an active source, revises a
 * record, clears a blocker, or authorizes publication.
 */

export const ALIGNMENT_BATCH_11_VERSION = 'maha-frontier-alignment-batch/11.0' as const

/** What the inspection established about the record's named subject. */
export type Batch11Verdict = 'supported' | 'partially-supported' | 'unresolved-fail-closed'

/**
 * How much of the source was actually read.
 *
 * Recorded because a binding established from an abstract cannot carry a
 * quantitative claim, and conflating that with a read section would overstate
 * what the packet supports.
 */
export type Batch11InspectionDepth =
  | 'none-or-identity-only'
  | 'abstract-and-identity'
  | 'full-text-section'
  | 'full-text'
  | 'full-text-two-pages'
  | 'full-page'

/** The reuse position for the inspected copy, decided per source. */
export type Batch11RightsBasis =
  | 'public-domain-us-government'
  | 'cc-by-4.0'
  | 'citation-only-no-reuse-licence'
  | 'none-no-source-bound'

export interface Batch11Source {
  title: string
  authors: readonly string[]
  year: number | null
  container: string | null
  identifier: string | null
  inspectedCopy: string
}

export interface Batch11Inspection {
  depth: Batch11InspectionDepth
  /** How the inspected copy was tied to the identifier it claims. */
  identityVerification: string
  /** Preprint, author manuscript or version of record, and what that costs the locator. */
  versionRelationship: string
  rightsBasis: Batch11RightsBasis
  rightsNote: string
  /** Exact place inspected. Never a whole-document reference. */
  locator: string
  /**
   * Committed only where the licence permits it. Null is not an absence of
   * evidence: the locator still names exactly where the finding sits.
   */
  committedPassage: string | null
  finding: string
  residualUncertainty: string
}

export interface Batch11Packet {
  packetId: string
  recordId: string
  verdict: Batch11Verdict
  /** Null for every fail-closed packet, by construction. */
  source: Batch11Source | null
  inspection: Batch11Inspection | null
  /** Present only where the record is narrowed instead of rebound. */
  narrowedSubject: string | null
  /** Present only on a fail-closed packet: why, and what would resolve it. */
  failClosed: { reason: string; whatWouldResolveIt: string } | null
  disposition: 'blocked-pending-source-override-review' | 'unresolved-no-proposal'
  canonicalMutationAuthorized: false
  promotionEligible: false
  externallyReviewed: false
  independentlyReproduced: false
}

export const ALIGNMENT_BATCH_11_PACKETS: readonly Batch11Packet[] = [
  {
    packetId: 'urn:maha:remediation:frontier-alignment-batch-11:fusion-plasma-systems-tokamak-plasma-equilibrium',
    recordId: 'urn:maha:record:fusion-plasma-systems-tokamak-plasma-equilibrium',
    verdict: 'supported',
    source: {
      title: 'Magnetic-Confinement Fusion—Plasma Theory: Tokamak Magnetohydrodynamic Equilibrium and Stability',
      authors: ['Lao, Lang L.', 'Liu, Y. Q.', 'Turnbull, Alan D.'],
      year: 2021,
      container: 'Encyclopedia of Nuclear Energy',
      identifier: 'doi:10.1016/b978-0-12-819725-7.00230-0',
      inspectedCopy: 'https://www.osti.gov/servlets/purl/1963025',
    },
    inspection: {
      depth: 'full-text',
      identityVerification: 'OSTI biblio record 1963025 returns the same title, the three named authors, publication date 2021-06-23 and DOI 10.1016/b978-0-12-819725-7.00230-0. The fetched PDF title page carries the identical title and the same three authors at General Atomics, so the copy inspected is the document the identifier names.',
      versionRelationship: 'accepted-manuscript-of-record-of-version. The inspected PDF is the DOE-deposited accepted manuscript; the version of record is the Elsevier book chapter behind the DOI. Pagination differs, so the locator below is stated by section heading rather than by publisher page.',
      rightsBasis: 'citation-only-no-reuse-licence',
      rightsNote: 'US DOE public-access deposit via OSTI.GOV. The OSTI record states no explicit licence, so this is recorded as public-access availability of the accepted manuscript, not as an open licence, and no redistribution right is asserted.',
      locator: 'Section \'Physics principles of toroidal equilibrium and stability\', subsection \'Axisymmetric 2D Grad-Shafranov equilibrium\', equations (35)-(36).',
      committedPassage: null,
      finding: 'The record names tokamak plasma equilibrium. The source derives the Grad-Shafranov equation as the axisymmetric equilibrium condition from force balance, which is the physics result the record names, rather than the coil hardware the previous positional-legacy source described.',
      residualUncertainty: 'The locator cites the accepted manuscript\'s section structure. Anyone checking the Elsevier version of record must locate the same subsection by heading, since manuscript and published pagination differ.',
    },
    narrowedSubject: null,
    failClosed: null,
    disposition: 'blocked-pending-source-override-review',
    canonicalMutationAuthorized: false,
    promotionEligible: false,
    externallyReviewed: false,
    independentlyReproduced: false,
  },
  {
    packetId: 'urn:maha:remediation:frontier-alignment-batch-11:critical-supply-chains-helium-liquefaction-logistics',
    recordId: 'urn:maha:record:critical-supply-chains-helium-liquefaction-logistics',
    verdict: 'unresolved-fail-closed',
    source: null,
    inspection: null,
    narrowedSubject: null,
    failClosed: {
      reason: 'No subject-matched, inspectable source for a bounded helium liquefaction-and-transport chain was located within this batch\'s search effort. USGS Mineral Commodity Summaries covers helium as a commodity but, as the prior inspection recorded, not a liquefaction-logistics chain.',
      whatWouldResolveIt: 'A cryogenic-engineering or industrial-gas logistics source that treats liquefaction plant, ISO-container transport and boil-off management as one chain. Candidate classes: IIR/Cryogenics review literature, or a DOE/BLM helium programme technical report.',
    },
    disposition: 'unresolved-no-proposal',
    canonicalMutationAuthorized: false,
    promotionEligible: false,
    externallyReviewed: false,
    independentlyReproduced: false,
  },
  {
    packetId: 'urn:maha:remediation:frontier-alignment-batch-11:agentic-systems-mcp-tool-allowlisting',
    recordId: 'urn:maha:record:agentic-systems-mcp-tool-allowlisting',
    verdict: 'partially-supported',
    source: {
      title: 'Model Context Protocol specification, revision 2026-07-28: Tools; Security Best Practices',
      authors: ['Model Context Protocol contributors'],
      year: null,
      container: null,
      identifier: null,
      inspectedCopy: 'https://modelcontextprotocol.io/specification/2026-07-28/server/tools',
    },
    inspection: {
      depth: 'full-text-two-pages',
      identityVerification: 'Both pages are served under the /specification/2026-07-28/ path of the protocol\'s canonical documentation host and carry that revision in their internal cross-links, so the revision inspected is the one named.',
      versionRelationship: 'Revision 2026-07-28 supersedes the 2024-11-05 revision the record\'s prior source cited. The prior citation named the specification generically with year 2024; this inspection pins an exact later revision.',
      rightsBasis: 'citation-only-no-reuse-licence',
      rightsNote: 'Published specification text on the protocol\'s public documentation site, quoted for identification. No licence grant is asserted beyond fair quotation of a short passage.',
      locator: 'Tools, section \'Capabilities\', sentence beginning \'The set MAY vary by the authorization presented on the request\'; and Tools, section \'User Interaction Model\', warning beginning \'For trust & safety and security, there SHOULD always be a human in the loop\'.',
      committedPassage: null,
      finding: 'NOT ESTABLISHED. A full read of both pages found the word allowlist used exactly twice, and neither instance is a tool allowlist: \'SHOULD use allowlist-based validation rather than blocklist-based approaches\' appears under OAuth Authorization URL Validation and governs URL schemes, and \'Allowlists for trusted domains (for protected servers)\' appears under CIMD Trust Policies and governs client-ID domains. No per-tool permitted-set mechanism is specified.',
      residualUncertainty: 'Only two pages of the revision were read in full. A tool allowlist mechanism could in principle be specified on another page of the same revision; this inspection does not exhaust the specification. The record is therefore proposed for narrowing rather than judged unsupportable.',
    },
    narrowedSubject: 'Scope-limited tool exposure and human-in-the-loop denial, which is the policy an allowlist would implement but is not an allowlist mechanism.',
    failClosed: null,
    disposition: 'blocked-pending-source-override-review',
    canonicalMutationAuthorized: false,
    promotionEligible: false,
    externallyReviewed: false,
    independentlyReproduced: false,
  },
  {
    packetId: 'urn:maha:remediation:frontier-alignment-batch-11:critical-supply-chains-high-purity-quartz-deposits',
    recordId: 'urn:maha:record:critical-supply-chains-high-purity-quartz-deposits',
    verdict: 'partially-supported',
    source: {
      title: 'Silica Statistics and Information',
      authors: ['U.S. Geological Survey, National Minerals Information Center'],
      year: null,
      container: null,
      identifier: null,
      inspectedCopy: 'https://www.usgs.gov/centers/national-minerals-information-center/silica-statistics-and-information',
    },
    inspection: {
      depth: 'full-page',
      identityVerification: 'The page is served from the USGS National Minerals Information Center path on the usgs.gov domain and identifies itself as USGS Silica Statistics and Information.',
      versionRelationship: 'A continuously maintained commodity page, not a dated edition. No version identifier is available, so this binding cannot be pinned to a fixed revision. The dated Mineral Commodity Summaries quartz chapters would provide that, but the 2025 PDF returned HTTP 403 and was not read.',
      rightsBasis: 'public-domain-us-government',
      rightsNote: 'USGS content is a US Government work in the public domain, as stated on the page. Quotation and reuse are unrestricted.',
      locator: 'Page body, high-purity quartz definition.',
      committedPassage: 'High-purity quartz contains less than 100 parts per million of total impurities, equivalent to at least 99.99% silica.',
      finding: 'PARTIAL. The page establishes the definition of high-purity quartz by impurity threshold and confirms US production, which the prior source could not. It does NOT provide a deposit or resource assessment: the only deposit-level content located was an image caption reading \'high-purity quartz mine in North Carolina\', which is not an assessment.',
      residualUncertainty: 'The dated USGS Mineral Commodity Summaries quartz chapter is the source that would carry a deposit and resource assessment. Its 2025 PDF was blocked (HTTP 403) from this environment and remains uninspected, so the record is narrowed rather than resolved.',
    },
    narrowedSubject: 'The high-purity quartz purity specification and the existence of US production, not a deposit or resource assessment.',
    failClosed: null,
    disposition: 'blocked-pending-source-override-review',
    canonicalMutationAuthorized: false,
    promotionEligible: false,
    externallyReviewed: false,
    independentlyReproduced: false,
  },
  {
    packetId: 'urn:maha:remediation:frontier-alignment-batch-11:advanced-materials-color-centers-in-diamond',
    recordId: 'urn:maha:record:advanced-materials-color-centers-in-diamond',
    verdict: 'supported',
    source: {
      title: 'The nitrogen-vacancy colour centre in diamond',
      authors: ['Doherty, Marcus W.', 'Manson, Neil B.', 'Delaney, Paul', 'et al.'],
      year: 2013,
      container: 'Physics Reports 528, 1 (2013)',
      identifier: 'doi:10.1016/j.physrep.2013.02.001',
      inspectedCopy: 'https://arxiv.org/abs/1302.3288',
    },
    inspection: {
      depth: 'abstract-and-identity',
      identityVerification: 'The arXiv record carries the journal reference Physics Reports 528, 1 (2013) and DOI 10.1016/j.physrep.2013.02.001 alongside the title and authors, so the preprint and the version of record are linked by the publisher identifier rather than by title match alone.',
      versionRelationship: 'arXiv v1 is the author copy of the Physics Reports review. Elsevier holds the version of record; pagination differs, so any locator into the arXiv copy is stated by section rather than journal page.',
      rightsBasis: 'citation-only-no-reuse-licence',
      rightsNote: 'arXiv nonexclusive-distrib 1.0, which permits arXiv distribution only and is not an open reuse licence. Quoted for identification; no redistribution right asserted.',
      locator: 'Abstract, opening sentence.',
      committedPassage: null,
      finding: 'The record names colour centres in diamond. This is a dedicated review of the nitrogen-vacancy colour centre in diamond, replacing a power-device assessment that never treated colour centres and whose text could not be read at all.',
      residualUncertainty: 'INSPECTION DEPTH IS ABSTRACT-LEVEL ONLY. Identity and subject are established, but no body section was read, so this packet supports the record\'s subject binding and does not establish any specific quantitative claim. A deeper locator is required before this record can carry a numeric claim.',
    },
    narrowedSubject: null,
    failClosed: null,
    disposition: 'blocked-pending-source-override-review',
    canonicalMutationAuthorized: false,
    promotionEligible: false,
    externallyReviewed: false,
    independentlyReproduced: false,
  },
  {
    packetId: 'urn:maha:remediation:frontier-alignment-batch-11:biomolecular-engineering-structure-prediction-filtering',
    recordId: 'urn:maha:record:biomolecular-engineering-structure-prediction-filtering',
    verdict: 'supported',
    source: {
      title: 'Broadly applicable and accurate protein design by integrating structure prediction networks and diffusion generative models',
      authors: ['Watson, Joseph L.', 'Juergens, David', 'Bennett, Nathaniel R.', 'et al.'],
      year: 2022,
      container: null,
      identifier: 'doi:10.1101/2022.12.09.519842',
      inspectedCopy: 'https://www.biorxiv.org/content/10.1101/2022.12.09.519842v2.full',
    },
    inspection: {
      depth: 'full-text-section',
      identityVerification: 'The fetched page reports the three lead authors Watson, Juergens and Bennett, matching the authorship of the work the record cites.',
      versionRelationship: 'IMPORTANT: the inspected preprint carries a DIFFERENT TITLE from the version of record. The record cites \'De novo design of protein structure and function with RFdiffusion\' (Nature 620:1089-1100, 2023, doi:10.1038/s41586-023-06415-8). The inspected copy is the bioRxiv v2 preprint titled \'Broadly applicable and accurate protein design by integrating structure prediction networks and diffusion generative models\'. Same work, retitled on publication. The locator below is therefore a locator into the PREPRINT and must not be presented as a locator into the Nature article, whose section structure and pagination differ.',
      rightsBasis: 'citation-only-no-reuse-licence',
      rightsNote: 'bioRxiv preprint. No licence statement was found in the fetched text, so no reuse licence is asserted; the passage is quoted for identification only. The Nature version of record was not used because nature.com redirected to an authentication endpoint, which was not followed.',
      locator: 'Preprint v2, section \'Unconditional protein monomer generation\'.',
      committedPassage: null,
      finding: 'The record names structure-prediction filtering. The passage states an explicit acceptance test in which generated designs are re-predicted with AlphaFold2 and retained only against numeric pAE and backbone-RMSD thresholds. This is the separate prediction-based filtering stage the prior inspection could not establish from the abstract alone.',
      residualUncertainty: 'Established for the preprint only. Whether the Nature version states the same thresholds in the same terms was not verified, because the publisher copy was behind an authentication redirect.',
    },
    narrowedSubject: null,
    failClosed: null,
    disposition: 'blocked-pending-source-override-review',
    canonicalMutationAuthorized: false,
    promotionEligible: false,
    externallyReviewed: false,
    independentlyReproduced: false,
  },
  {
    packetId: 'urn:maha:remediation:frontier-alignment-batch-11:mechanistic-interpretability-representation-probing-boundary',
    recordId: 'urn:maha:record:mechanistic-interpretability-representation-probing-boundary',
    verdict: 'supported',
    source: {
      title: 'Designing and Interpreting Probes with Control Tasks',
      authors: ['Hewitt, John', 'Liang, Percy'],
      year: 2019,
      container: null,
      identifier: 'arXiv:1909.03368v1',
      inspectedCopy: 'https://arxiv.org/html/1909.03368v1',
    },
    inspection: {
      depth: 'full-text-section',
      identityVerification: 'The arXiv abstract page and the HTML full text both report the same title and the two authors Hewitt and Liang under identifier 1909.03368v1.',
      versionRelationship: 'v1 is the only arXiv version and corresponds to the EMNLP 2019 paper. The locator is into the arXiv HTML rendering; the ACL Anthology version of record has different pagination and was not inspected.',
      rightsBasis: 'citation-only-no-reuse-licence',
      rightsNote: 'arXiv nonexclusive-distrib 1.0. This permits arXiv to distribute the work; it is NOT an open reuse licence such as CC BY. The passage is quoted for identification only and no redistribution right is asserted.',
      locator: 'Section 1 \'Introduction\', caption to Figure 2.',
      committedPassage: null,
      finding: 'The record names the representation probing boundary. This source states the boundary directly: probe accuracy alone does not distinguish a property encoded in the representation from a property the probe itself learned, and it introduces control tasks and selectivity as the method for telling those apart. The prior source, Toy Models of Superposition, was inspected and contains no probing methodology, so it could not carry this subject.',
      residualUncertainty: 'The locator sits in a figure caption inside the Introduction rather than in a numbered methods section. A reader checking the ACL Anthology version must locate the same Figure 2 caption, since pagination differs.',
    },
    narrowedSubject: null,
    failClosed: null,
    disposition: 'blocked-pending-source-override-review',
    canonicalMutationAuthorized: false,
    promotionEligible: false,
    externallyReviewed: false,
    independentlyReproduced: false,
  },
  {
    packetId: 'urn:maha:remediation:frontier-alignment-batch-11:critical-supply-chains-dysprosium-ore-to-oxide',
    recordId: 'urn:maha:record:critical-supply-chains-dysprosium-ore-to-oxide',
    verdict: 'unresolved-fail-closed',
    source: null,
    inspection: null,
    narrowedSubject: null,
    failClosed: {
      reason: 'No inspectable source specifying the dysprosium ore-to-oxide separation route was located within this batch\'s search effort. Commodity summaries give production and trade, not the named transformation.',
      whatWouldResolveIt: 'A rare-earth separation-process source treating solvent extraction from ore concentrate through to separated Dy2O3. Candidate classes: USGS or DOE Critical Materials Institute process reports, or an open hydrometallurgy review.',
    },
    disposition: 'unresolved-no-proposal',
    canonicalMutationAuthorized: false,
    promotionEligible: false,
    externallyReviewed: false,
    independentlyReproduced: false,
  },
  {
    packetId: 'urn:maha:remediation:frontier-alignment-batch-11:mechanistic-interpretability-activation-patching',
    recordId: 'urn:maha:record:mechanistic-interpretability-activation-patching',
    verdict: 'supported',
    source: {
      title: 'Towards Best Practices of Activation Patching in Language Models: Metrics and Methods',
      authors: ['Zhang, Fred', 'Nanda, Neel'],
      year: 2023,
      container: null,
      identifier: 'arXiv:2309.16042v2',
      inspectedCopy: 'https://arxiv.org/html/2309.16042v2',
    },
    inspection: {
      depth: 'full-text-section',
      identityVerification: 'The arXiv abstract page and the HTML full text both report the same title and the two authors Zhang and Nanda under identifier 2309.16042v2, so the text inspected is the document the identifier names.',
      versionRelationship: 'v2, submitted 2023-09-27 and last revised 2024-01-17, is the version accepted at ICLR 2024. The locator below is into v2; v1 was not inspected and its section numbering is not assumed to match.',
      rightsBasis: 'cc-by-4.0',
      rightsNote: 'CC BY 4.0 as stated on the arXiv abstract page. Quotation and redistribution are permitted with attribution.',
      locator: 'Section 2.1 \'Activation patching\', numbered list of the three forward passes, step 3.',
      committedPassage: 'run the model on X_corrupt with a specific model component\'s activation restored from the cached value of the clean run',
      finding: 'The record names activation patching. This source is the technique-specific treatment: it names the technique in its title, defines it in Section 2.1 as the standard causal-tracing intervention, and specifies the clean/corrupted/restore procedure. The prior source, Causal Scrubbing, applies activation-resampling interventions but does not specify the general technique, which is why the prior binding was only partially supporting.',
      residualUncertainty: 'None material for the named subject. The paper\'s own contribution is a methodological critique of patching metrics; the record is bound to its specification of the technique, not to its recommendations.',
    },
    narrowedSubject: null,
    failClosed: null,
    disposition: 'blocked-pending-source-override-review',
    canonicalMutationAuthorized: false,
    promotionEligible: false,
    externallyReviewed: false,
    independentlyReproduced: false,
  },
  {
    packetId: 'urn:maha:remediation:frontier-alignment-batch-11:neurotechnology-bci-adaptive-stimulation-policies',
    recordId: 'urn:maha:record:neurotechnology-bci-adaptive-stimulation-policies',
    verdict: 'unresolved-fail-closed',
    source: null,
    inspection: null,
    narrowedSubject: null,
    failClosed: {
      reason: 'Not attempted to completion within this batch. The prior binding demonstrates one adaptive closed-loop rule but not a policy framework, and no comparative-policy source was inspected here.',
      whatWouldResolveIt: 'A source comparing adaptive DBS control policies (for example threshold-crossing versus proportional versus reinforcement-learned controllers) rather than demonstrating a single rule.',
    },
    disposition: 'unresolved-no-proposal',
    canonicalMutationAuthorized: false,
    promotionEligible: false,
    externallyReviewed: false,
    independentlyReproduced: false,
  },
  {
    packetId: 'urn:maha:remediation:frontier-alignment-batch-11:critical-supply-chains-euv-photoresist-precursors',
    recordId: 'urn:maha:record:critical-supply-chains-euv-photoresist-precursors',
    verdict: 'unresolved-fail-closed',
    source: null,
    inspection: null,
    narrowedSubject: null,
    failClosed: {
      reason: 'No inspectable source treating EUV photoresist precursor materials or their supply was located within this batch\'s search effort.',
      whatWouldResolveIt: 'A resist-chemistry or semiconductor-materials supply source treating EUV resist platforms and their precursor inputs. Candidate classes: SPIE Advanced Lithography proceedings where openly available, or an imec/consortium technical publication.',
    },
    disposition: 'unresolved-no-proposal',
    canonicalMutationAuthorized: false,
    promotionEligible: false,
    externallyReviewed: false,
    independentlyReproduced: false,
  },
  {
    packetId: 'urn:maha:remediation:frontier-alignment-batch-11:critical-supply-chains-photoacid-generator-supply',
    recordId: 'urn:maha:record:critical-supply-chains-photoacid-generator-supply',
    verdict: 'unresolved-fail-closed',
    source: null,
    inspection: null,
    narrowedSubject: null,
    failClosed: {
      reason: 'No inspectable source treating photoacid generator chemistry together with its supply position was located within this batch\'s search effort.',
      whatWouldResolveIt: 'A photoresist-chemistry source treating PAG classes and their sourcing. Candidate classes: an open polymer-chemistry review of chemically amplified resists, plus a separate supply-side source if the two cannot be carried by one document.',
    },
    disposition: 'unresolved-no-proposal',
    canonicalMutationAuthorized: false,
    promotionEligible: false,
    externallyReviewed: false,
    independentlyReproduced: false,
  },
  {
    packetId: 'urn:maha:remediation:frontier-alignment-batch-11:longevity-metabolism-mitophagy-flux',
    recordId: 'urn:maha:record:longevity-metabolism-mitophagy-flux',
    verdict: 'supported',
    source: {
      title: 'Complementary Approaches to Interrogate Mitophagy Flux in Pancreatic Beta-Cells',
      authors: ['Levi-D\'Ancona, Elena', 'et al.'],
      year: 2023,
      container: 'Journal of Visualized Experiments',
      identifier: 'doi:10.3791/65789',
      inspectedCopy: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC10597842/',
    },
    inspection: {
      depth: 'full-text-section',
      identityVerification: 'The PMC record returns the same title, first author, journal, year, DOI 10.3791/65789 and PMCID PMC10597842, so the copy inspected is the document the identifier names.',
      versionRelationship: 'PMC author manuscript deposited under NIHPA. The publisher version of record is the JoVE article behind the DOI; section structure is shared but pagination is not, so the locator is stated by section heading.',
      rightsBasis: 'citation-only-no-reuse-licence',
      rightsNote: 'PMC author manuscript under NIHPA deposit terms. Publicly readable; no open reuse licence is stated, so the formula is cited for identification and no redistribution right is asserted.',
      locator: 'Section \'Representative Results\', mitophagy flux ratio definition.',
      committedPassage: null,
      finding: 'The record names mitophagy flux. This source operationalises flux as a measured ratio of induced to basal mitophagy-positive cell fractions, which is the flux measurement the prior source could not establish; the earlier inspection found the word flux zero times at the level read.',
      residualUncertainty: 'The formula is specific to a flow-cytometry protocol in pancreatic beta-cells. It establishes that mitophagy flux is an operationalised measured quantity, not that this particular ratio is the general definition across tissues or reporters.',
    },
    narrowedSubject: null,
    failClosed: null,
    disposition: 'blocked-pending-source-override-review',
    canonicalMutationAuthorized: false,
    promotionEligible: false,
    externallyReviewed: false,
    independentlyReproduced: false,
  },
  {
    packetId: 'urn:maha:remediation:frontier-alignment-batch-11:advanced-materials-diamond-thermal-conductivity',
    recordId: 'urn:maha:record:advanced-materials-diamond-thermal-conductivity',
    verdict: 'unresolved-fail-closed',
    source: null,
    inspection: null,
    narrowedSubject: null,
    failClosed: {
      reason: 'Not attempted to completion within this batch. The prior source, Hudgins et al. 2003, remains behind an IEEE paywall with no authorized open copy located, so its content is still unread.',
      whatWouldResolveIt: 'An open source reporting measured diamond thermal conductivity with stated sample type and measurement method. Candidate classes: an open thermal-transport review, or a metrology paper reporting single-crystal CVD diamond conductivity.',
    },
    disposition: 'unresolved-no-proposal',
    canonicalMutationAuthorized: false,
    promotionEligible: false,
    externallyReviewed: false,
    independentlyReproduced: false,
  },
  {
    packetId: 'urn:maha:remediation:frontier-alignment-batch-11:advanced-materials-diamond-wafer-substrates',
    recordId: 'urn:maha:record:advanced-materials-diamond-wafer-substrates',
    verdict: 'unresolved-fail-closed',
    source: null,
    inspection: null,
    narrowedSubject: null,
    failClosed: {
      reason: 'Not attempted to completion within this batch. The prior source remains paywalled and unread.',
      whatWouldResolveIt: 'An open source on heteroepitaxial diamond wafer growth and available wafer diameters. Candidate classes: an open crystal-growth review, or a published report on Ir/MgO heteroepitaxial diamond wafers.',
    },
    disposition: 'unresolved-no-proposal',
    canonicalMutationAuthorized: false,
    promotionEligible: false,
    externallyReviewed: false,
    independentlyReproduced: false,
  },
  {
    packetId: 'urn:maha:remediation:frontier-alignment-batch-11:advanced-materials-gallium-nitride-epitaxy',
    recordId: 'urn:maha:record:advanced-materials-gallium-nitride-epitaxy',
    verdict: 'supported',
    source: {
      title: 'Gallium Nitride for Space Photovoltaics: Properties, Synthesis Methods, Device Architectures and Emerging Market Perspectives',
      authors: ['Drabczyk, Anna', 'et al.'],
      year: 2025,
      container: 'Micromachines (Basel) 16, 1421',
      identifier: 'doi:10.3390/mi16121421',
      inspectedCopy: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC12735247/',
    },
    inspection: {
      depth: 'full-text-section',
      identityVerification: 'The PMC record returns the same title, first author Drabczyk, journal Micromachines, year 2025, DOI 10.3390/mi16121421 and PMCID PMC12735247.',
      versionRelationship: 'MDPI publishes the version of record open access and PMC carries the published article rather than an author manuscript, so the inspected copy is the version of record.',
      rightsBasis: 'cc-by-4.0',
      rightsNote: 'CC BY 4.0, quoted from the article: \'This article is an open access article distributed under the terms and conditions of the Creative Commons Attribution (CC BY) license\'. Reuse with attribution is permitted.',
      locator: 'Section 4.1 \'Influence of Substrate Type and Quality\'.',
      committedPassage: 'The large lattice mismatch (~13-16%) and the difference in thermal-expansion coefficients generate significant tensile stress during cooldown from MOCVD growth temperatures.',
      finding: 'The record names gallium nitride epitaxy. The cited section treats heteroepitaxial MOCVD growth of GaN and the substrate mismatch that governs it, replacing a power-device assessment whose text was never readable.',
      residualUncertainty: 'The source is a review oriented to space photovoltaics. Its epitaxy treatment is a section within that scope rather than a dedicated epitaxial-growth review, so it supports the subject binding but is not the strongest possible source for GaN epitaxy specifically.',
    },
    narrowedSubject: null,
    failClosed: null,
    disposition: 'blocked-pending-source-override-review',
    canonicalMutationAuthorized: false,
    promotionEligible: false,
    externallyReviewed: false,
    independentlyReproduced: false,
  },
  {
    packetId: 'urn:maha:remediation:frontier-alignment-batch-11:advanced-materials-sic-wide-bandgap-substrates',
    recordId: 'urn:maha:record:advanced-materials-sic-wide-bandgap-substrates',
    verdict: 'supported',
    source: {
      title: 'Impact of Mechanical Stress and Nitrogen Doping on the Defect Distribution in the Initial Stage of the 4H-SiC PVT Growth Process',
      authors: ['Steiner, Johannes', 'et al.'],
      year: 2022,
      container: 'Materials (Basel) 15, 1897',
      identifier: 'doi:10.3390/ma15051897',
      inspectedCopy: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC8911631/',
    },
    inspection: {
      depth: 'full-text-section',
      identityVerification: 'The PMC record returns the same title, first author Steiner, journal Materials, year 2022, DOI 10.3390/ma15051897 and PMCID PMC8911631.',
      versionRelationship: 'MDPI publishes the version of record open access and PMC carries the same published article rather than an author manuscript, so the inspected copy and the version of record are the same text.',
      rightsBasis: 'cc-by-4.0',
      rightsNote: 'CC BY 4.0, quoted from the article\'s own statement: \'This article is an open access article distributed under the terms and conditions of the Creative Commons Attribution (CC BY) license.\' Reuse with attribution is permitted.',
      locator: 'Section \'Introduction\'.',
      committedPassage: 'SiC is grown using the physical vapor transport (PVT) method, where a high-quality single-crystalline seed is required for achieving sufficient crystal quality.',
      finding: 'The record names SiC wide-bandgap substrates. This source treats bulk 4H-SiC crystal growth by physical vapour transport, which is the process producing substrate material, and the defect distribution that governs substrate quality. It replaces a power-device assessment whose text was never readable.',
      residualUncertainty: 'The source treats the initial stage of PVT growth specifically. It establishes the substrate growth process and its defect concerns, not a general survey of commercial substrate specifications.',
    },
    narrowedSubject: null,
    failClosed: null,
    disposition: 'blocked-pending-source-override-review',
    canonicalMutationAuthorized: false,
    promotionEligible: false,
    externallyReviewed: false,
    independentlyReproduced: false,
  },
  {
    packetId: 'urn:maha:remediation:frontier-alignment-batch-11:advanced-materials-cvd-graphene-grain-boundaries',
    recordId: 'urn:maha:record:advanced-materials-cvd-graphene-grain-boundaries',
    verdict: 'supported',
    source: {
      title: 'Charge Transport in Polycrystalline Graphene: Challenges and Opportunities',
      authors: ['Cummings, Aron W.', 'Duong, Dinh Loc', 'Nguyen, Van Luan', 'et al.'],
      year: 2014,
      container: 'Advanced Materials 26, 5079-5094 (2014)',
      identifier: 'doi:10.1002/adma.201401389',
      inspectedCopy: 'https://arxiv.org/abs/1507.06272',
    },
    inspection: {
      depth: 'abstract-and-identity',
      identityVerification: 'The arXiv record carries the journal reference Adv. Mater. 26, 5079-5094 (2014) and DOI 10.1002/adma.201401389 alongside title and authors, linking preprint to version of record by publisher identifier.',
      versionRelationship: 'The arXiv posting is dated 2015 while the journal article is dated 2014, so this is an author copy deposited after publication rather than a preprint preceding it. Wiley holds the version of record; pagination differs and no journal page locator is asserted.',
      rightsBasis: 'citation-only-no-reuse-licence',
      rightsNote: 'arXiv nonexclusive-distrib 1.0, which permits arXiv distribution only and is not an open reuse licence. Quoted for identification; no redistribution right asserted.',
      locator: 'Abstract.',
      committedPassage: null,
      finding: 'The record names CVD graphene grain boundaries. This source states the CVD-to-polycrystalline-grain-boundary relation directly and reviews transport across those boundaries. The prior source, the Van der Waals heterostructures review, was full-text searched during earlier recovery and contained neither \'CVD\' nor \'grain boundar\', so it could not carry this subject.',
      residualUncertainty: 'INSPECTION DEPTH IS ABSTRACT-LEVEL ONLY. The subject binding is established; no body section was read, so this packet supports the binding and not any specific transport result.',
    },
    narrowedSubject: null,
    failClosed: null,
    disposition: 'blocked-pending-source-override-review',
    canonicalMutationAuthorized: false,
    promotionEligible: false,
    externallyReviewed: false,
    independentlyReproduced: false,
  },
  {
    packetId: 'urn:maha:remediation:frontier-alignment-batch-11:advanced-materials-dielectric-screening',
    recordId: 'urn:maha:record:advanced-materials-dielectric-screening',
    verdict: 'supported',
    source: {
      title: 'Dielectric screening in two-dimensional insulators: Implications for excitonic and impurity states in graphane',
      authors: ['Cudazzo, Pierluigi', 'Tokatly, Ilya V.', 'Rubio, Angel'],
      year: 2011,
      container: 'Physical Review B 84, 085406',
      identifier: 'doi:10.1103/PhysRevB.84.085406',
      inspectedCopy: 'https://arxiv.org/abs/1104.3346',
    },
    inspection: {
      depth: 'abstract-and-identity',
      identityVerification: 'The arXiv record carries the journal DOI 10.1103/PhysRevB.84.085406 alongside the title and the three authors, linking preprint and version of record by publisher identifier rather than by title alone.',
      versionRelationship: 'arXiv v1 is the author copy of the Physical Review B article. APS holds the version of record; pagination differs, so no journal page locator is asserted.',
      rightsBasis: 'citation-only-no-reuse-licence',
      rightsNote: 'arXiv nonexclusive-distrib 1.0, which permits arXiv distribution only and is not an open reuse licence. Quoted for identification; no redistribution right asserted.',
      locator: 'Abstract.',
      committedPassage: null,
      finding: 'The record names dielectric screening. This source treats dielectric screening in two-dimensional insulators directly and states its distinguishing non-local form. The prior source, the Van der Waals heterostructures review, was full-text searched during earlier recovery and contained no occurrence of screening at all, so it could not carry this subject.',
      residualUncertainty: 'INSPECTION DEPTH IS ABSTRACT-LEVEL ONLY. The subject binding is established; no body section was read, so this packet supports the binding and not any specific quantitative screening result.',
    },
    narrowedSubject: null,
    failClosed: null,
    disposition: 'blocked-pending-source-override-review',
    canonicalMutationAuthorized: false,
    promotionEligible: false,
    externallyReviewed: false,
    independentlyReproduced: false,
  },
  {
    packetId: 'urn:maha:remediation:frontier-alignment-batch-11:advanced-materials-dry-transfer-contamination',
    recordId: 'urn:maha:record:advanced-materials-dry-transfer-contamination',
    verdict: 'unresolved-fail-closed',
    source: null,
    inspection: null,
    narrowedSubject: null,
    failClosed: {
      reason: 'Attempted and failed closed. The strongest candidate, Pizzocchero et al., Nature Communications 2016 (ncomms11894), redirected to an authentication endpoint which was not followed, so no text was read. No substitute was inspected.',
      whatWouldResolveIt: 'An openly accessible source treating interface contamination in dry-transfer assembly of van der Waals heterostructures. Candidate classes: an arXiv author copy of the same work, or an open review of heterostructure assembly and interface cleanliness.',
    },
    disposition: 'unresolved-no-proposal',
    canonicalMutationAuthorized: false,
    promotionEligible: false,
    externallyReviewed: false,
    independentlyReproduced: false,
  },
]

/** Counts derived from the packets, never asserted independently of them. */
export function batch11Totals() {
  const packets = ALIGNMENT_BATCH_11_PACKETS
  const by = (verdict: Batch11Verdict) => packets.filter((p) => p.verdict === verdict).length
  return {
    attempted: packets.length,
    supported: by('supported'),
    partiallySupported: by('partially-supported'),
    unresolvedFailClosed: by('unresolved-fail-closed'),
    sourcesBound: packets.filter((p) => p.source !== null).length,
    passagesCommitted: packets.filter((p) => p.inspection?.committedPassage != null).length,
    promotionEligible: packets.filter((p) => p.promotionEligible).length,
  }
}
