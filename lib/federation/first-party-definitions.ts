/**
 * First-party canonical definitions.
 *
 * Twenty-nine definitions added in map v3 reached Tranche 18 blocked on source
 * inspection. Seventeen of them are this organisation's own operational
 * concepts — runtime witness receipts, evidence dossiers, claim intake — for
 * which no external authority exists, because nobody outside Maha uses the
 * terms. Those are written here.
 *
 * The other twelve are not. causal-inference, cryptographic-commitments,
 * deterministic-arithmetic, dimensional-analysis, formal-verification,
 * interpolation, interval-bounds, numerical-integration, numerical-stability,
 * optimization, reference-frame-conversion and root-finding are established
 * concepts with real authorities — DLMF, IEEE 754, NIST, the IAU. Writing a
 * Maha definition for interpolation would manufacture authority where a
 * standard already exists, and would be worse than leaving the page blocked.
 * They stay blocked, and are listed as needing external inspection rather than
 * authorship.
 *
 * What a first-party definition is worth, stated once and carried on every
 * entry: it establishes what this organisation means by a term and what its
 * implementation does. It does not establish that the concept is standard, that
 * anyone else uses it, or that the implementation is correct. That is a weaker
 * claim than an external source supports, and it is the honest one — the same
 * distinction lib/evidence-basis.ts draws between first-party documentation and
 * independent scientific support.
 *
 * Every definition cites the implementation it describes. A definition of a
 * concept with no implementation would be a proposal, and this file contains
 * none.
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
  /** The implementation this describes, and what in it shows the behaviour. */
  groundedIn: { locator: string; shows: string }
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
      locator: 'lib/computational-witness-registry.ts',
      shows: 'Verification against the receipt schema, a maximum stored size, and an explicit persist-receipt retention consent.',
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
      locator: 'lib/evidence-dossier/digest.ts',
      shows: 'Canonicalisation before hashing, with the digest field excluded from its own preimage.',
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
    },
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
      'That a claim flagged as unsupported is false, or that an unflagged claim is true. The detector is a ' +
      'relevance fixture, not a truth oracle.',
    groundedIn: {
      locator: 'lib/public-claim-defects.ts',
      shows: 'Rules checking the relationship between a claim and its evidence, with the module stating it is not a truth oracle.',
    },
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
    },
  },
  {
    conceptId: 'urn:maha:concept:evidence:uncertainty-recording',
    term: 'Uncertainty recording',
    definition:
      'Stating what a source does not establish alongside what it does, as a required field rather than a caveat ' +
      'appended when convenient.',
    establishes:
      'That the boundary of a claim was considered and written down at the time the claim was made.',
    doesNotEstablish:
      'That the boundary is complete. An unrecorded uncertainty is not thereby absent, and a recorded one is not ' +
      'thereby the only one.',
    groundedIn: {
      locator: 'lib/evidence-basis.ts',
      shows: 'Basis kinds separating what a source can carry from how deep the page using it is.',
    },
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
      locator: 'lib/release-readiness-policy-v2.ts and lib/exact-revision-review.ts',
      shows: 'Support assessed against exact revisions and locators rather than whole sources.',
    },
  },
  {
    conceptId: 'urn:maha:concept:evidence:locator-verification',
    term: 'Locator verification',
    definition:
      'Confirming that a cited locator — a section, paragraph, table, figure or clause — resolves in the ' +
      'source version cited, and contains the passage the citation relies on.',
    establishes:
      'That a citation can be followed to the specific place it names.',
    doesNotEstablish:
      'That the passage found there supports the claim. Verification of a locator and assessment of support are ' +
      'separate steps, and passing the first says nothing about the second.',
    groundedIn: {
      locator: 'lib/evidence-preflight.ts — LOCATOR_KINDS',
      shows: 'An enumerated set of locator kinds, checked separately from access status and rights basis.',
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
    },
  },
  {
    conceptId: 'urn:maha:concept:evidence:source-recovery',
    term: 'Source recovery',
    definition:
      'Obtaining the content a citation refers to when the cited route is unavailable — through a repository ' +
      'copy, an author manuscript, or a government mirror — without bypassing an access control.',
    establishes:
      'That a lawful alternative route to a source was sought before the source was recorded as inaccessible.',
    doesNotEstablish:
      'That the recovered copy is identical to the cited version. A repository copy and a version of record differ ' +
      'by the edits each contains.',
    groundedIn: {
      locator: 'lib/evidence-preflight.ts — ACCESS_STATUSES and RIGHTS_BASES',
      shows: 'Access status recorded separately from rights basis, so reachable and reusable are distinct findings.',
    },
  },
  {
    conceptId: 'urn:maha:concept:evidence:claim-intake',
    term: 'Claim intake',
    definition:
      'Separating a passage into the individual substantive claims it makes, so each can carry its own evidence ' +
      'and its own status rather than inheriting the passage’s.',
    establishes:
      'That claims are assessed individually, and that a passage can hold claims at different statuses.',
    doesNotEstablish:
      'That the separation is complete or that each extracted claim is well-formed. Intake decides what will be ' +
      'assessed; it does not assess it.',
    groundedIn: {
      locator: 'lib/evidence-preflight.ts — EVIDENCE_PREFLIGHT_MAX_CLAIMS',
      shows: 'A bounded number of claims per submission, assessed individually.',
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
    },
  },
  {
    conceptId: 'urn:maha:concept:evidence:delivery-acknowledgement',
    term: 'Delivery acknowledgement',
    definition:
      'A record that a purchased artifact was delivered to a buyer, kept separately from the record that payment ' +
      'settled.',
    establishes:
      'That settlement and delivery are tracked as different events.',
    doesNotEstablish:
      'That the buyer received a correct deliverable, or accepted it. On-chain settlement establishes a transfer, ' +
      'not fulfilment.',
    groundedIn: {
      locator: 'lib/x402/settlement-ledger.ts',
      shows: 'The ledger stating that settlement is not delivery, and that establishing delivery would need internal response telemetry.',
    },
  },
  {
    conceptId: 'urn:maha:concept:evidence:conflicting-literature',
    term: 'Conflicting literature',
    definition:
      'Two or more inspected sources that bear on the same claim and disagree, recorded as a disagreement rather ' +
      'than resolved by preferring one.',
    establishes:
      'That the disagreement was found and is visible to a reader.',
    doesNotEstablish:
      'Which source is right. Recording a conflict is the opposite of adjudicating it, and a page citing this must ' +
      'not present either side as settled.',
    groundedIn: {
      locator: 'lib/public-claim-defects.ts',
      shows: 'Defect codes describing claim-to-evidence relationships rather than truth judgements.',
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
      locator: 'lib/epistemic-release.ts — EpistemicReleaseStatus, with lib/mcp-evidence-store.ts',
      shows: 'Three statuses (active, superseded, withdrawn), a withdrawal record carrying rationale, withdrawnAt and withdrawalSha256, and withdrawn releases filtered out of the active set before they are served.',
    },
  },
  {
    conceptId: 'urn:maha:concept:evidence:reproducibility-fixtures',
    term: 'Reproducibility fixture',
    definition:
      'A synthetic, committed input used to exercise a workflow end to end, so the workflow can be checked without ' +
      'customer data and without a live service.',
    establishes:
      'That a workflow was exercised against a fixed input whose content is inspectable.',
    doesNotEstablish:
      'That the workflow behaves the same on real data. A fixture is synthetic by construction, which is what makes ' +
      'it safe and what limits what it proves.',
    groundedIn: {
      locator: 'lib/evidence-workflow-examples.ts',
      shows: 'Workflow seeds carrying fixtures marked synthetic: true.',
    },
  },
]
