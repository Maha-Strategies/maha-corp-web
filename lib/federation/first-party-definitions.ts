/**
 * First-party canonical definitions.
 *
 * Twenty-nine definitions added in map v3 reached Tranche 18 blocked on source
 * inspection. They fall into three groups, and the split is the substance of
 * this file.
 *
 * Fifteen are this organisation's own operational concepts — runtime witness
 * receipts, evidence dossiers, canonical release — for which no external
 * authority exists because nobody outside Maha uses the terms. Those are
 * written here.
 *
 * Two are deferred. conflicting-literature and source-recovery name real
 * operational practices that nothing in this codebase implements: no check
 * compares two sources against each other, and no field records that an
 * alternative route to a source was sought. Defining them would describe
 * intent as though it were behaviour, so they are listed as deferred rather
 * than written.
 *
 * Twelve are refused. causal-inference, interpolation, numerical-stability and
 * nine more are established concepts with real authorities — DLMF, IEEE 754,
 * the SI Brochure, the IAU. A Maha definition for interpolation would
 * manufacture authority where a standard already exists, which is worse than
 * leaving the page blocked.
 *
 * What a first-party definition is worth, stated once and carried on every
 * entry: it establishes what this organisation means by a term and what its
 * implementation does. It does not establish that the concept is standard,
 * that anyone else uses it, or that the implementation is correct. That is a
 * weaker claim than an external source supports, and it is the honest one.
 *
 * Every definition cites the implementation it describes, and says in
 * supportsDefinitionBecause why that locator bears this definition rather than
 * merely relating to it. That field is a judgement, not a check. An automated
 * test can confirm a file exists and a symbol is declared in it; it cannot
 * confirm the code means what the definition says. Two definitions in the
 * first draft of this file passed such a test while citing code that did not
 * support them, which is why the field exists.
 */

export type FirstPartyDefinition = {
  conceptId: string
  term: string
  /** What the term means here, in one or two sentences. */
  definition: string
  /** What citing this definition licenses a page to say. */
  establishes: string
  /** What it does not license, however carefully the page is written. */
  doesNotEstablish: string
  groundedIn: {
    /** file — Symbol, where Symbol is declared in that file. */
    locator: string
    /** What is in the code. */
    shows: string
    /** Why that code bears this definition. A judgement, not a check. */
    supportsDefinitionBecause: string
  }
  /** An established term this one collides with and must not be read as. */
  notToBeConfusedWith?: string
}

/** The basis every entry here carries. Never independent, never external. */
export const FIRST_PARTY_BASIS = {
  basis: 'first-party-documentation',
  independence: 'authored-by-the-organisation-being-described',
  boundary:
    'A first-party definition establishes what this organisation means by a term and what its implementation does. ' +
    'It does not establish that the concept is standard, that anyone else uses it, or that the implementation is ' +
    'correct. A page citing it may say what Maha means; it may not say what the field holds.',
} as const

/** Concepts that must not be defined here, and why. */
export const EXTERNAL_AUTHORITY_REQUIRED: readonly { conceptId: string; authority: string }[] = [
  { conceptId: 'urn:maha:concept:computation:causal-inference', authority: 'Statistical and epidemiological literature' },
  { conceptId: 'urn:maha:concept:computation:cryptographic-commitments', authority: 'NIST cryptographic publications and the primary literature' },
  { conceptId: 'urn:maha:concept:computation:deterministic-arithmetic', authority: 'IEEE 754' },
  { conceptId: 'urn:maha:concept:computation:dimensional-analysis', authority: 'The SI Brochure (BIPM)' },
  { conceptId: 'urn:maha:concept:computation:formal-verification', authority: 'Formal methods literature and tool specifications' },
  { conceptId: 'urn:maha:concept:computation:interpolation', authority: 'NIST DLMF' },
  { conceptId: 'urn:maha:concept:computation:interval-bounds', authority: 'IEEE 1788 interval arithmetic' },
  { conceptId: 'urn:maha:concept:computation:numerical-integration', authority: 'NIST DLMF' },
  { conceptId: 'urn:maha:concept:computation:numerical-stability', authority: 'Numerical analysis literature' },
  { conceptId: 'urn:maha:concept:computation:optimization', authority: 'Optimisation literature' },
  { conceptId: 'urn:maha:concept:computation:reference-frame-conversion', authority: 'IAU / IERS conventions' },
  { conceptId: 'urn:maha:concept:computation:root-finding', authority: 'NIST DLMF' },
]

/**
 * Concepts withdrawn from this file because nothing implements them.
 *
 * These were defined in the first draft. Both definitions described what the
 * practice would look like, cited a file that was merely adjacent, and passed
 * review only because the citation was checked for existence rather than for
 * support.
 */
export const DEFERRED_PENDING_IMPLEMENTATION: readonly {
  conceptId: string
  whatWasClaimed: string
  whyDeferred: string
  whatWouldGroundIt: string
}[] = [
  {
    conceptId: 'urn:maha:concept:evidence:conflicting-literature',
    whatWasClaimed: 'That two inspected sources bearing on the same claim and disagreeing are recorded as a disagreement rather than resolved by preferring one.',
    whyDeferred:
      'Nothing computes a relation between two sources. All six codes in PUBLIC_CLAIM_DEFECTS compare a single ' +
      'claim to its own evidence — whether the source was read, whether a locator exists, whether the claim reaches ' +
      'past the passage. A between-source disagreement is not among them, and no other module derives one.',
    whatWouldGroundIt: 'A defect code, or a separate check, that takes two or more inspected passages and reports that they conflict on a shared claim.',
  },
  {
    conceptId: 'urn:maha:concept:evidence:source-recovery',
    whatWasClaimed: 'That a lawful alternative route to a source — a repository copy, an author manuscript, a government mirror — was sought before the source was recorded as inaccessible.',
    whyDeferred:
      'ACCESS_STATUSES is open, restricted or unknown. Nothing records that an alternative route was attempted, ' +
      'which route it was, or that the recovered copy differs from the version of record. The practice may well ' +
      'happen; the system holds no trace of it, so a page citing this would be citing an intention.',
    whatWouldGroundIt: 'A recorded recovery attempt: the route tried, its outcome, and the relationship of any recovered copy to the cited version.',
  },
]

export const FIRST_PARTY_DEFINITIONS: readonly FirstPartyDefinition[] = [
  {
    conceptId: 'urn:maha:concept:evidence:runtime-witness-receipts',
    term: 'Runtime witness receipt',
    definition:
      'A record of one execution of a named callable, carrying the job identity, the module and qualified name ' +
      'invoked, start and finish times, a success or failure status, digests of the input and output, a digest of ' +
      'the environment, the random seeds used, and every artifact consumed or produced with its role and size.',
    establishes:
      'That a specific computation ran, under a recorded environment and seeds, producing outputs whose digests ' +
      'were captured at the time.',
    doesNotEstablish:
      'That the computation was correct, that the code did what it was meant to, or that re-running it elsewhere ' +
      'would reproduce the result. A receipt records what happened, not whether it should have.',
    groundedIn: {
      locator: 'lib/evidence-dossier/runtime-witness.ts — ComputationalWitnessReceipt',
      shows: 'The field set: jobId, callable.module and qualname, execution status and timing, inputSha256, outputSha256, environmentSha256, randomSeeds, artifacts.',
      supportsDefinitionBecause:
        'Every element of the definition is a required field on the interface. The definition is a reading of the ' +
        'type, not a description of what the type is for.',
    },
  },
  {
    conceptId: 'urn:maha:concept:evidence:calculation-receipts',
    term: 'Calculation receipt',
    definition:
      'A runtime witness receipt registered against a stored identity, so that a later reader can retrieve the ' +
      'record of a calculation rather than being asked to trust a reported figure.',
    establishes:
      'That a calculation has a retrievable execution record, bounded by the registry’s size limit and its ' +
      'explicit retention consent.',
    doesNotEstablish:
      'The accuracy of the calculation, or that the figure a page quotes was taken from the receipt rather than ' +
      'restated beside it.',
    groundedIn: {
      locator: 'lib/computational-witness-registry.ts — WITNESS_REGISTRY_MAX_BYTES',
      shows: 'Verification against the receipt schema, a maximum stored size, and an explicit persist-receipt retention consent.',
      supportsDefinitionBecause:
        'The definition’s claim is retrievability, and the registry is what makes a receipt retrievable after the ' +
        'run. The size cap and the retention consent are the two conditions it places on that, so both appear in ' +
        'the establishes clause rather than being omitted as detail.',
    },
  },
  {
    conceptId: 'urn:maha:concept:evidence:evidence-dossiers',
    term: 'Evidence dossier',
    definition:
      'A collection of evidentiary content whose provenance digest is computed over canonicalised fields, so that ' +
      'identical content always produces the same digest and any change to an evidentiary field always changes it.',
    establishes:
      'That the dossier’s evidentiary content is fixed at a digest, and that a later reader can detect whether ' +
      'it has changed.',
    doesNotEstablish:
      'That the evidence assembled is sufficient, relevant, or correctly interpreted. A digest fixes content; it ' +
      'does not assess it.',
    groundedIn: {
      locator: 'lib/evidence-dossier/digest.ts — provenanceDigest',
      shows: 'Canonicalisation before hashing, with the digest field excluded from its own preimage.',
      supportsDefinitionBecause:
        'The definition’s entire content is the digest property, and canonicalise-then-hash with the digest field ' +
        'excluded is exactly what the module does and the only thing it does.',
    },
  },
  {
    conceptId: 'urn:maha:concept:evidence:canonical-release',
    term: 'Canonical release',
    definition:
      'The act that makes one revision of a record the public one, binding a release row to the exact candidate ' +
      'target digest it released, distinct from the digest of the rendered public projection.',
    establishes:
      'Which revision is public, and that the released target can be distinguished from what a page renders.',
    doesNotEstablish:
      'That the released revision is accurate, or that a page rendering it reflects the release rather than a ' +
      'later edit. Release is an act of publication, not of verification.',
    groundedIn: {
      locator: 'lib/digest-roles.ts — ReleaseTargetDigest and PublicationDigest',
      shows: 'Separate branded digest types for the released target and the rendered projection.',
      supportsDefinitionBecause:
        'The definition turns on the released target being distinguishable from the rendered projection. The ' +
        'module exists to keep those two in separate branded types precisely so one cannot be passed where the ' +
        'other is expected — the distinction is enforced by the compiler, not by convention.',
    },
    notToBeConfusedWith:
      'The rel=canonical link relation, which this codebase also uses. That declares a preferred URL to a search ' +
      'engine; this declares which revision of a record is the published one.',
  },
  {
    conceptId: 'urn:maha:concept:evidence:unsupported-inference',
    term: 'Unsupported inference',
    definition:
      'A claim whose cited source does not bear the relationship the citation implies — where the source is ' +
      'topically related but does not support the specific assertion made.',
    establishes:
      'That the relationship between a claim and its evidence can be checked separately from whether the claim is true.',
    doesNotEstablish:
      'That a claim flagged as unsupported is false, or that an unflagged claim is true. A clean result means no ' +
      'defect of the six detected kinds was found, not that the page is correct.',
    groundedIn: {
      locator: 'lib/public-claim-defects.ts — PUBLIC_CLAIM_DEFECTS and RELEVANCE_CONTRACT',
      shows: 'Two of the six codes are this defect — claim-stronger-than-passage for the general case and unsupported-causal-inference for the causal one — and RELEVANCE_CONTRACT sets independentlyVerifiesTruth to false.',
      supportsDefinitionBecause:
        'The limit is expressed in the code as data rather than in prose about the code: a caller reading ' +
        'RELEVANCE_CONTRACT cannot present a clean result as verification, because the contract says it is not.',
    },
    notToBeConfusedWith:
      'Causal inference itself, which belongs to the statistical literature and is deliberately not defined here. ' +
      'The unsupported-causal-inference code flags a claim outrunning its passage; it does not define the inference.',
  },
  {
    conceptId: 'urn:maha:concept:evidence:internal-review',
    term: 'Internal review',
    definition:
      'Review of an exact revision by a named person, recorded so that it is observable independently of whether ' +
      'the revision was subsequently released.',
    establishes:
      'That a specific revision was reviewed, distinguishing a record reviewed and not released from one never ' +
      'reviewed at all.',
    doesNotEstablish:
      'That the review was adequate, or that its reviewer was independent. Internal review is review by this ' +
      'organisation of its own work.',
    groundedIn: {
      locator: 'lib/exact-revision-review.ts',
      shows: 'Review observed rather than inferred, because an active release was previously the only readable evidence of review.',
      supportsDefinitionBecause:
        'The module exists for the distinction the definition draws. Before it, a reviewed-but-unreleased revision ' +
        'and an unreviewed one were indistinguishable from outside; separating them is the module’s reason to exist.',
    },
    notToBeConfusedWith:
      'Peer review. This is review by the organisation of its own work, which the doesNotEstablish clause states ' +
      'rather than leaving to the reader.',
  },
  {
    conceptId: 'urn:maha:concept:evidence:uncertainty-recording',
    term: 'Uncertainty recording',
    definition:
      'Recording, for each kind of evidentiary basis, the classes of claim that basis cannot carry — held as a ' +
      'required field of the basis vocabulary rather than written per claim.',
    establishes:
      'That no source can be used without its limits being stated somewhere, because every basis kind carries a ' +
      'non-empty list of what it cannot establish.',
    doesNotEstablish:
      'That anyone judged the boundary of a particular claim. The limits are a fixed lookup keyed by basis kind: ' +
      'two claims on the same basis get identical limits regardless of what they assert. It is a vocabulary-level ' +
      'guarantee, and a weaker thing than an author having thought about this claim.',
    groundedIn: {
      locator: 'lib/evidence-basis.ts — BASIS_CONTRACT',
      shows: 'A required cannotEstablish array on every basis kind, from "anything outside the study stated scope" to, for the weakest basis, "anything".',
      supportsDefinitionBecause:
        'cannotEstablish is required on every entry, so the guarantee is structural — a basis cannot be added ' +
        'without stating its limits. That is what the definition claims, and it is deliberately scoped to the ' +
        'vocabulary rather than to authoring, because the code offers nothing per claim.',
    },
    notToBeConfusedWith:
      'Measurement uncertainty in the metrological sense (JCGM 100, the GUM). This concept is about the evidentiary ' +
      'scope of a source. It carries no interval, no coverage factor and no error budget, and must never be cited ' +
      'for a measurement claim. Both senses already appear in this codebase.',
  },
  {
    conceptId: 'urn:maha:concept:evidence:passage-support',
    term: 'Passage support',
    definition:
      'The relationship in which a specific passage of a source, at a stated locator, bears the particular claim a ' +
      'page makes — as opposed to the source as a whole being about the same subject.',
    establishes:
      'That support is asserted at passage granularity and can be checked by reading that passage.',
    doesNotEstablish:
      'That the passage is correct, or that the reader will agree it bears the claim. It fixes what is being ' +
      'pointed at, so that disagreement is possible.',
    groundedIn: {
      locator: 'lib/release-readiness-policy-v2.ts',
      shows: 'claim-to-passage-support is a named review axis, alongside scope-and-unsupported-inference, and a decision without an exact locator is refused as locator-missing.',
      supportsDefinitionBecause:
        'The axis is named for this exact relation, and the locator-missing refusal enforces the granularity the ' +
        'definition insists on: a decision cannot pass by pointing at a whole source.',
    },
  },
  {
    conceptId: 'urn:maha:concept:evidence:locator-verification',
    term: 'Locator verification',
    definition:
      'Confirming that a cited locator — a page, section, paragraph, figure, table, equation or timestamp — ' +
      'resolves in the source version cited, and contains the passage the citation relies on.',
    establishes:
      'That a citation can be followed to the specific place it names.',
    doesNotEstablish:
      'That the passage found there supports the claim. Verification of a locator and assessment of support are ' +
      'separate steps, and passing the first says nothing about the second.',
    groundedIn: {
      locator: 'lib/evidence-preflight-contract.ts — LOCATOR_KINDS',
      shows: 'An enumerated set of eight locator kinds, held separately from ACCESS_STATUSES and RIGHTS_BASES.',
      supportsDefinitionBecause:
        'Locator kind, access status and rights basis are three separate enumerations, which is the separation the ' +
        'definition draws between finding a place, reaching it, and being allowed to use it.',
    },
  },
  {
    conceptId: 'urn:maha:concept:evidence:privacy-boundary',
    term: 'Privacy boundary',
    definition:
      'The line between material that may be published and material that may not, enforced against what a served ' +
      'bundle actually contains rather than against what its inputs were.',
    establishes:
      'That served pages are scanned for a fixed set of private-corpus markers, in both the rendered markup and the ' +
      'streamed data payload, and that a match refuses publication.',
    doesNotEstablish:
      'That nothing private is present. The scan is a list of six literal markers; material that matches none of ' +
      'them passes untouched. Passing establishes that those markers are absent, not that the page is clean.',
    groundedIn: {
      locator: 'lib/batch-11-rehearsal-phases.ts — PRIVATE_CORPUS_MARKERS and assertNoPrivateCorpusInBundle',
      shows: 'A fixed marker list checked against both the rendered HTML and the RSC flight payload, because a served page can carry text in its streamed data that never appears in the markup a reader sees.',
      supportsDefinitionBecause:
        'The function refuses on the served bundle rather than on the inputs, which is the distinction the ' +
        'definition turns on. That the marker list is literal and finite is why the limit clause is stated as ' +
        'strongly as it is.',
    },
  },
  {
    conceptId: 'urn:maha:concept:evidence:claim-intake',
    term: 'Claim intake',
    definition:
      'Accepting claims one at a time, each arriving with its own source, excerpt, locator and rights, so that a ' +
      'claim cannot be submitted without its evidence attached and no claim inherits another’s status.',
    establishes:
      'That claims are structured and assessed individually, and that a submission carrying a claim without a ' +
      'source, excerpt, locator or rights basis is rejected at the boundary.',
    doesNotEstablish:
      'That a passage was correctly separated into claims. Nothing here reads a passage or extracts anything: the ' +
      'caller decides what the claims are and submits them already separated, up to three per request. Intake ' +
      'validates that structure; it does not produce it.',
    groundedIn: {
      locator: 'lib/evidence-preflight.ts — parseClaim',
      shows: 'Each claim parsed against a required key set of claim, source, excerpt, locator and rights, with the source and rights objects validated in turn.',
      supportsDefinitionBecause:
        'The required key set is the definition: a claim that arrives without its own evidence does not parse. ' +
        'Reading the parser is also what corrected the definition — an earlier draft said intake separates a ' +
        'passage into claims, which nothing here does.',
    },
  },
  {
    conceptId: 'urn:maha:concept:evidence:licensed-retrieval',
    term: 'Licensed retrieval',
    definition:
      'Machine access to released records granted under a named licence plan with an allowed tool list and a ' +
      'quota, rather than access implied by a capability being listed.',
    establishes:
      'That retrieval is scoped by an explicit entitlement, and that listing a tool grants nothing.',
    doesNotEstablish:
      'That the retrieved records are accurate, or that a licence to retrieve is a licence to reproduce.',
    groundedIn: {
      locator: 'lib/mcp-evidence-public-contract.ts — MCP_EVIDENCE_LICENSE_PLANS',
      shows: 'Plans carrying allowedTools and monthlyQuotaUnits, with a terms digest.',
      supportsDefinitionBecause:
        'allowedTools and monthlyQuotaUnits are fields of a plan, so entitlement is data attached to the plan ' +
        'rather than implied by a tool appearing in a manifest. That contrast is what the definition asserts.',
    },
  },
  {
    conceptId: 'urn:maha:concept:evidence:delivery-acknowledgement',
    term: 'Delivery acknowledgement',
    definition:
      'A record that a purchased artifact reached its buyer, written by its own call at its own time, separate ' +
      'from the record that payment settled.',
    establishes:
      'That for card checkout, delivery is recorded as an event in its own right rather than inferred from payment.',
    doesNotEstablish:
      'That the buyer received a correct deliverable or accepted it — only that this system recorded a delivery. ' +
      'And it covers card checkout alone: x402 settlements have no delivery record at all, so for those the ' +
      'concept is not merely unproven but unrepresented, and no x402 page may cite this.',
    groundedIn: {
      locator: 'lib/revenue-reconciliation.ts — reconcileRevenueDelivery',
      shows: 'A separate call from reconcileRevenuePayment, writing deliveredAt through record_revenue_checkout_delivery, with refunds handled by a third call again.',
      supportsDefinitionBecause:
        'Delivery, payment and reversal are three separate calls to three RPCs, so the events cannot be conflated ' +
        'in the ledger. An earlier draft grounded this in the x402 settlement ledger, which states three times ' +
        'that it does not establish delivery — citing a file’s disclaimer as evidence for the thing disclaimed.',
    },
  },
  {
    conceptId: 'urn:maha:concept:evidence:correction-and-retraction',
    term: 'Correction and retraction',
    definition:
      'Correction is not a state here: a corrected record is released as a new revision that supersedes the earlier ' +
      'one, which remains readable as superseded. Retraction is withdrawal — a distinct act carrying its own ' +
      'rationale and timestamp, after which the release stops being served as active.',
    establishes:
      'That a released record can be superseded or withdrawn, that the reason for a withdrawal is part of the ' +
      'record rather than an external note, and that withdrawn releases are excluded from what is served.',
    doesNotEstablish:
      'That every error has been found, or that a withdrawn record is unreachable — withdrawal stops this system ' +
      'serving it, and does nothing about copies, caches or citations already made elsewhere.',
    groundedIn: {
      locator: 'lib/epistemic-release.ts — EpistemicReleaseStatus',
      shows: 'Three statuses (active, superseded, withdrawn), a withdrawal record carrying rationale, withdrawnAt and withdrawalSha256, and withdrawn releases filtered out of the active set in lib/mcp-evidence-store.ts before they are served.',
      supportsDefinitionBecause:
        'The vocabulary has no corrected state, which is why the definition says correction is supersession rather ' +
        'than a status of its own. Reading the type is what produced that wording.',
    },
    notToBeConfusedWith:
      'Correction and retraction in scholarly publishing (COPE, ICMJE). Same words, different obligations. This ' +
      'describes what this system does to its own records, not what a journal owes a reader.',
  },
  {
    conceptId: 'urn:maha:concept:computation:reproducibility-fixtures',
    term: 'Reproducibility fixture',
    definition:
      'A synthetic, committed input used to exercise a workflow end to end, so the workflow can be checked without ' +
      'customer data and without a live service.',
    establishes:
      'That a workflow was exercised against a fixed input whose content is inspectable, and that a caller can ' +
      'tell a fixture from a real record from the data rather than by reading it.',
    doesNotEstablish:
      'That the workflow behaves the same on real data. A fixture is synthetic by construction, which is what ' +
      'makes it safe to commit and what limits what it proves.',
    groundedIn: {
      locator: 'lib/evidence-workflow-examples.ts',
      shows: 'Workflow seeds carrying synthetic: true, with fixture claims written to be recognisably artificial.',
      supportsDefinitionBecause:
        'The synthetic flag is on the seed as data, so a consumer can refuse to treat a fixture as a record ' +
        'without inspecting its text — which is the property that makes committing them safe.',
    },
    notToBeConfusedWith:
      'Reproducibility in the scientific sense — independent replication of a result. A fixture exercises a code ' +
      'path. It replicates nothing, and no page may cite it as evidence that a finding reproduces.',
  },
]
