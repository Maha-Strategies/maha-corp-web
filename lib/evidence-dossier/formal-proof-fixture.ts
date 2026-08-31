import { CANONICALIZATION_VERSION, canonicalJson, passageDigest, provenanceDigest, sha256Hex } from './digest.ts'
import {
  DOSSIER_EPISTEMIC_BASE,
  DOSSIER_SCHEMA_VERSION,
  type EvidenceDossier,
} from './schema.ts'

/**
 * A synthetic internal fixture for the formal-proof lifecycle.
 *
 * WHY THIS IS SYNTHETIC. The obvious alternative was to attach the interval
 * theorems to a claim in the real EUV resist dossier. That would have been
 * dishonest: `clm_figure_conditions` records the pixel size and dose used to
 * generate a figure, and no theorem about integer interval addition bears on
 * whether a caption says what we report it says. Attaching one would have
 * decorated a real scientific claim with an irrelevant proof.
 *
 * So the fixture states a claim the theorems genuinely do bear on: combining
 * two declared tolerance intervals by bound-wise addition. `add_valid` and
 * `add_mem` are exactly about that operation, and `interval-add` is the kernel
 * operation that performs it.
 *
 * Everything here is internal rehearsal material. The "source" is our own
 * specification document, which is why the single claim is typed as a
 * design parameter and its epistemic status records that it rests on an
 * internal specification rather than on external literature.
 */

export const FORMAL_PROOF_FIXTURE_ID = 'dos_internal_interval_tolerance_fixture' as const
const CORPUS_REVISION = 'formal-proof-lifecycle-fixture/0.1'
const REVIEWER = { decidedBy: 'internal-editorial' as const, decidedAt: '2026-08-30' }

const PASSAGE = {
  passageId: 'pas_tolerance_composition_rule',
  sourceId: 'src_maha_interval_spec',
  locator: 'Section 2.1',
  locatorKind: 'section' as const,
  excerpt:
    'Two tolerance intervals are composed by adding their lower bounds and adding their upper bounds. Both operands must satisfy lower <= upper, and all quantities are exact integers in the units declared by the calculation receipt.',
  isParaphrase: false,
  extractionMethod: 'direct-pdf-read' as const,
  originalDocumentInspected: true,
  sourceRevision: 'maha-interval-spec/1.0',
}

const CLAIM_BASE = {
  claimId: 'clm_interval_composition',
  submittedStatement: 'Adding two tolerance intervals gives a valid interval containing every achievable sum.',
  auditedStatement:
    'Under the composition rule in Section 2.1, bound-wise addition of two ordered integer intervals yields an interval whose lower bound does not exceed its upper bound, and which contains the sum of any member of the first and any member of the second.',
  claimType: 'design-parameter' as const,
  sourceIds: ['src_maha_interval_spec'],
  passageIds: [PASSAGE.passageId],
  epistemicStatus: 'passage-supports-bounded-claim' as const,
  verificationScope:
    'Checked that the composition rule in the internal specification is what the attached theorems formalize. Not checked: whether the rule is the right uncertainty model for any physical measurement.',
  uncertainty:
    'The theorems are stated over unbounded integers. The kernel computes in signed 64-bit fixed point, so kernel overflow behaviour is outside what the proofs establish.',
  disagreements: [],
  unsupportedExtensions: [
    'Do not read this as evidence that interval arithmetic is the correct uncertainty model for any measured quantity.',
    'Do not read the attached proofs as establishing that the WASM kernel implements the specified operation.',
  ],
  reviewerDecisions: [
    {
      decision: 'accept-with-condition-recording' as const,
      rationale: 'Synthetic internal fixture. Recorded so it can never be mistaken for an external scientific claim.',
      ...REVIEWER,
    },
  ],
}

const SOURCE = {
  sourceId: 'src_maha_interval_spec',
  submittedCitation: 'Maha Strategies LLC, Interval Tolerance Composition, internal specification, 2026.',
  correctedCitation: null,
  // A stable internal document identifier. It is not a DOI and confers no
  // external standing; it exists so the passage can be located again.
  identifier: 'maha-internal:interval-tolerance-spec/1.0',
  publisherUrl: null,
  publicationType: 'internal-specification',
  rightsBasis: 'owned-internal-document',
  verificationState: 'document-inspected' as const,
  verifiedAt: '2026-08-30',
  metadataProvenance: 'Authored internally by Maha Strategies. Not an external publication and not peer reviewed.',
}

const BASE = {
  schemaVersion: DOSSIER_SCHEMA_VERSION,
  epistemicBaseVersion: DOSSIER_EPISTEMIC_BASE,
  dossierId: FORMAL_PROOF_FIXTURE_ID,
  title: 'Interval tolerance composition (internal fixture)',
  inquiry: 'Does bound-wise addition of two tolerance intervals preserve ordering and contain every achievable sum?',
  domainId: 'internal-fixtures',
  intendedUse:
    'Internal rehearsal of the formal-proof lifecycle. Demonstrates that a machine-checked deduction, a deterministic calculation and source-bound support can travel in one package without being conflated.',
  prohibitedUses: [
    'Do not present this fixture as a customer deliverable.',
    'Do not cite it as scientific evidence about any physical system.',
    'Do not treat the attached proofs as validation of the WASM kernel.',
  ],
  methodology:
    'One internally authored specification passage states the composition rule. Two Lean theorems formalize the rule and are machine-checked by the pinned toolchain. One deterministic kernel calculation exercises the same operation. The three are recorded as separate evidence categories.',
  generatedAt: '2026-08-30T00:00:00Z',
  corpusRevision: CORPUS_REVISION,
  reviewState: 'illustrative-draft' as const,
  sources: [SOURCE],
  passages: [{ ...PASSAGE, passageHash: passageDigest({ locator: PASSAGE.locator, excerpt: PASSAGE.excerpt }) }],
  claims: [{ ...CLAIM_BASE, provenanceDigest: provenanceDigest(CLAIM_BASE) }],
  comparisons: [],
  priorRevisions: [],
  contradictions: [],
  unsupportedInferences: [
    'A machine-checked proof of the composition rule does not establish that any measured tolerance is correct.',
    'A deterministic calculation of one interval sum does not establish that the model applies to any device.',
  ],
  limitations: [
    'This is a synthetic internal fixture, not an external scientific dossier.',
    'The single source is a document Maha authored; it carries no independent authority.',
    'The theorems are stated over unbounded integers and say nothing about 64-bit overflow in the kernel.',
  ],
  disclaimer:
    'Internal rehearsal material. A machine-checked proof establishes only that a stated conclusion follows from stated assumptions. It is not an experiment, it is not a reproduction by any independent party, no external expert examined it, and no regulator has passed on it. It does not establish that the Lean definitions match the compiled WASM kernel.',
}

const BUNDLE_BASE = {
  corpusRevision: CORPUS_REVISION,
  digestAlgorithm: 'sha256' as const,
  canonicalizationVersion: CANONICALIZATION_VERSION,
  sourceCount: BASE.sources.length,
  passageCount: BASE.passages.length,
  claimCount: BASE.claims.length,
  comparisonCount: BASE.comparisons.length,
}

export const FORMAL_PROOF_FIXTURE_DOSSIER: EvidenceDossier = {
  ...BASE,
  provenanceBundle: {
    ...BUNDLE_BASE,
    dossierDigest: provenanceDigest({ ...BASE, provenanceBundle: BUNDLE_BASE }),
  },
}

/** Kept exported so tests can assert the fixture's identity without re-deriving it. */
export const FORMAL_PROOF_FIXTURE_CLAIM_ID = CLAIM_BASE.claimId
export const FORMAL_PROOF_FIXTURE_DIGEST = FORMAL_PROOF_FIXTURE_DOSSIER.provenanceBundle.dossierDigest
void canonicalJson
void sha256Hex
