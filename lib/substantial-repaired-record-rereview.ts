import { createHash } from 'node:crypto'

import { epistemicReviewTargetHash } from './epistemic-publication.ts'
import { revisionAudit } from './substantial-revision-alignment-audit.ts'
import type { EpistemicRecord } from './epistemic-schema.ts'

export const REPAIRED_REREVIEW_CHECKLIST_VERSION = 'maha-repaired-record-rereview/1.0' as const

export const REREVIEW_DIMENSIONS = [
  'source-fidelity',
  'locator-fidelity',
  'claim-boundedness',
  'domain-fidelity',
  'title-and-slug-accuracy',
  'record-class-suitability',
  'uncertainty-adequacy',
  'prohibited-inference-coverage',
  'rights-basis',
  'public-wording-safety',
] as const
export type RereviewDimension = (typeof REREVIEW_DIMENSIONS)[number]

export const REREVIEW_VERDICTS = ['approve', 'revise', 'withhold'] as const
export type RereviewVerdict = (typeof REREVIEW_VERDICTS)[number]

export const REREVIEW_STATES = [
  'internally-approved-ready-for-release-preflight',
  'revise-again',
  'remain-withheld',
] as const
export type RereviewState = (typeof REREVIEW_STATES)[number]

const NOT_EXTERNAL =
  'This is AI-assisted internal editorial review performed by the publisher. It is not external expert review, peer review, consensus, independent reproduction, scientific validation, or commercial certification.'

const REVIEWER = {
  reviewerId: 'expert_maha-internal-editorial-v2',
  reviewerKind: 'internal-editorial' as const,
  role: 'Internal editorial reviewer for source-bounded epistemic records',
  affiliation: 'Maha Strategies',
  conflict: 'Maha Strategies authors, repairs, and reviews this record. The reviewer is not independent of the publisher.',
}

export interface DimensionDecision {
  dimension: RereviewDimension
  recordId: string
  /** The exact revision this decision binds. A decision is never revision-agnostic. */
  revisionSha256: string
  reviewerId: string
  reviewerKind: 'internal-editorial'
  reviewerRole: string
  checklistVersion: typeof REPAIRED_REREVIEW_CHECKLIST_VERSION
  verdict: RereviewVerdict
  rationale: string
  disagreementsOrUncertainty: string
  notExternalReview: string
  decisionDigest: string
}

function digest(value: unknown): string {
  return `sha256:${createHash('sha256').update(JSON.stringify(value)).digest('hex')}`
}

interface DecisionDraft {
  dimension: RereviewDimension
  verdict: RereviewVerdict
  rationale: string
  disagreementsOrUncertainty: string
}

const MCP = 'urn:maha:record:agentic-systems-mcp-tool-deny-by-default'
const TBM = 'urn:maha:record:fusion-plasma-systems-breeding-blanket-test-modules'

const DRAFTS: Readonly<Record<string, readonly DecisionDraft[]>> = {
  [MCP]: [
    {
      dimension: 'source-fidelity',
      verdict: 'approve',
      rationale: 'The cited artifact is the Model Context Protocol specification at version 2024-11-05, and the record\'s source title names that artifact rather than a single page. The stable identifier resolves to the version root while the url resolves to the Tools page inside it, which is coherent citation practice: identify the artifact, locate within it. The establishes statement reproduces four distinct specification statements and overstates none of them.',
      disagreementsOrUncertainty: 'The identifier and the url differ by design here. That is defensible for a multi-page specification but would be a defect for a single-page artifact, and the distinction is recorded so a later reviewer does not read it as an inconsistency.',
    },
    {
      dimension: 'locator-fidelity',
      verdict: 'approve',
      rationale: 'The locator names the "User Interaction Model" warning block and the "Security Considerations" list on the Tools page of version 2024-11-05. Both headings exist verbatim on the inspected page, and both carry the exact language the claim relies on. The locator is section-level, not whole-document, so a reader can reach the supporting text directly.',
      disagreementsOrUncertainty: 'No archival snapshot was pinned. The specification version is fixed at 2024-11-05, which bounds drift far more tightly than an unversioned page, but the served rendering could still change.',
    },
    {
      dimension: 'claim-boundedness',
      verdict: 'approve',
      rationale: 'The claim asserts exactly two things the page states: a normative SHOULD addressed to implementors that a human remain able to deny tool invocations, and an express statement that the protocol does not mandate any specific user interaction model. It converts neither into a MUST, and it attributes the recommendation to implementors rather than to the protocol. The claim boundary then removes the three readings the evidence cannot carry.',
      disagreementsOrUncertainty: 'Whether a reader treats "a human able to deny" as equivalent to a default-deny posture remains an editorial risk. The claim mitigates it by stating the recommendation rather than naming a posture.',
    },
    {
      dimension: 'domain-fidelity',
      verdict: 'approve',
      rationale: 'The record stays inside agentic systems and MCP, describing a protocol specification\'s guidance to implementors. It does not migrate into organisational security policy, into zero-trust architecture, or into any claim about a named runtime\'s behaviour. The scope sentence explicitly disclaims describing an organisation\'s allowlist, identity, retention, or approval policy.',
      disagreementsOrUncertainty: 'None. The domain boundary is the clearest part of this revision.',
    },
    {
      dimension: 'title-and-slug-accuracy',
      verdict: 'approve',
      rationale: 'The title "Human denial control for tool invocations" names an available control, which is what the specification recommends, rather than a default posture, which it never describes. The superseded title asserted "deny by default", a phrase absent from the entire inspected page. The slug matches the title and the canonical path moved to the concepts segment with it.',
      disagreementsOrUncertainty: 'The alternative "human-in-the-loop-tool-denial" would also be accurate and is arguably closer to the source\'s own phrasing. Choosing between them is editorial preference, not accuracy, and the current title is defensible on the text as it stands.',
    },
    {
      dimension: 'record-class-suitability',
      verdict: 'approve',
      rationale: 'Concept is correct. The artifact defines a recommended control and reports no comparison between exposure postures, so comparison is unavailable; it reports no measured quantity, so measurement is unavailable; and it prescribes no procedure for the reader to execute, so method would overstate. Concept records the bounded existence and force of the recommendation, which is what the page supports.',
      disagreementsOrUncertainty: 'None material. Mechanism was considered and rejected because nothing causal is described.',
    },
    {
      dimension: 'uncertainty-adequacy',
      verdict: 'approve',
      rationale: 'Uncertainty is declared qualitative, which is right: the page states a recommendation and asserts no interval, rate, or measurement, so a quantitative interval would be fabricated. The replication assessment records that independent replication and cross-platform transfer have not been compiled, and the audit records independentlyReproduced and externallyReviewed as false.',
      disagreementsOrUncertainty: 'The uncertainty statement is inherited boilerplate rather than written for this record. It is accurate here, but a reviewer should note it was not authored specifically for a recommendation-type claim.',
    },
    {
      dimension: 'prohibited-inference-coverage',
      verdict: 'approve',
      rationale: 'Three prohibitions are carried, and the third is the one this record specifically needs: do not read a recommended human ability to deny an invocation as a requirement that tools be denied unless explicitly permitted. That closes precisely the overclaim the superseded record made. The general prohibitions on proven, safe, scalable and commercially available readings are also retained.',
      disagreementsOrUncertainty: 'None. Coverage is specific to this record\'s failure mode rather than generic.',
    },
    {
      dimension: 'rights-basis',
      verdict: 'approve',
      rationale: 'citation-with-paraphrase against a publicly served specification page. The record reproduces no block of specification prose, no schema, and no diagram; the establishes statement and the claim are original paraphrase. The normative keyword SHOULD is reproduced as a single word because its capitalisation carries the meaning, which is fair citation rather than reproduction.',
      disagreementsOrUncertainty: 'None.',
    },
    {
      dimension: 'public-wording-safety',
      verdict: 'approve',
      rationale: 'Read as a public page, the wording cannot be mistaken for a security mandate. It says "recommends", names SHOULD explicitly, attributes the recommendation to implementors, and states in the same sentence that the protocol does not mandate a user interaction model. The honest negations survive in the boundaries and prohibited inferences rather than being trimmed for readability.',
      disagreementsOrUncertainty: 'The claim sentence is long and carries three qualifications at once. It is accurate but dense; a future editorial pass could split it without weakening it.',
    },
  ],
  [TBM]: [
    {
      dimension: 'source-fidelity',
      verdict: 'revise',
      rationale: 'The source binding is internally inconsistent. The url now resolves to the ITER Tritium Breeding page, but the source title still reads "Supporting systems" and the stable identifier still resolves to https://www.iter.org/machine/supporting-systems, which is the superseded page that never named the subject. A citation whose title and identifier name one artifact while its url names another cannot be followed reliably: a reader resolving the identifier lands on the page the repair rejected. The source title should read the inspected page\'s own title and the identifier should resolve to the cited url before this record is reviewed again.',
      disagreementsOrUncertainty: 'This is a defect in the proposed revision, not in the underlying evidence. The inspected passages and the claim are sound; the citation metadata simply was not carried across when the url changed. Fixing it is mechanical, but it must be a new revision with a new digest rather than an in-place edit.',
    },
    {
      dimension: 'locator-fidelity',
      verdict: 'approve',
      rationale: 'The locator names the "ITER Test Blanket Module (TBM) Program" section, and that heading exists verbatim on the inspected page. The section names the test blanket modules and the four member concepts, which is exactly the subject the record claims. This is a genuine repair of the original defect, where the locator named neither blankets nor test modules.',
      disagreementsOrUncertainty: 'The locator is only reachable once the url is followed, and the url is currently contradicted by the title and identifier. The locator itself is correct; its addressability depends on the source-fidelity revision.',
    },
    {
      dimension: 'claim-boundedness',
      verdict: 'approve',
      rationale: 'The claim states that ITER documents a programme under which modules will be used to test breeding concepts, and carries the page\'s own statement that further research is necessary to demonstrate feasibility. Both halves track sentences on the page. The future tense is preserved throughout, so nothing reads as achieved.',
      disagreementsOrUncertainty: 'None material.',
    },
    {
      dimension: 'domain-fidelity',
      verdict: 'approve',
      rationale: 'The record stays in fusion and plasma systems and describes an experimental programme on one machine. It does not generalise to DEMO, to power reactors, or across the four TBM concepts, which differ in coolant and breeder and are explicitly not pooled by the scope sentence.',
      disagreementsOrUncertainty: 'None.',
    },
    {
      dimension: 'title-and-slug-accuracy',
      verdict: 'approve',
      rationale: 'The title "Breeding blanket test modules" names precisely what the inspected section names. It asserts no performance, no completion, and no readiness, so unlike the MCP record it required no correction. The slug matches the title.',
      disagreementsOrUncertainty: 'The title names the modules rather than the programme, while the claim is about the programme. The gap is small and the scope sentence closes it, but a future revision might prefer "ITER test blanket module programme".',
    },
    {
      dimension: 'record-class-suitability',
      verdict: 'approve',
      rationale: 'Concept is the most defensible class. Measurement is unavailable because the page reports no measured quantity. Method would imply a procedure the reader is instructed to follow, whereas the page describes a programme ITER will run. Concept records the bounded existence and scope of that programme, which is what the section supports.',
      disagreementsOrUncertainty: 'Method was seriously considered, because a test programme does describe an experimental approach. Concept was chosen because the record captures that the programme exists and what it is for, not how to perform it. A reviewer could reasonably prefer method.',
    },
    {
      dimension: 'uncertainty-adequacy',
      verdict: 'approve',
      rationale: 'Qualitative uncertainty is correct for a record whose source reports no measurement. More importantly, the specific uncertainty that matters here is recorded on the alignment audit rather than left implicit: the ITER page carries no publication date, no version number and no last-updated stamp, and no archival snapshot was pinned, so versionRelationshipVerified and archivalSnapshotPinned are both false.',
      disagreementsOrUncertainty: 'The living-page limitation is a standing risk that no revision can remove without pinning a snapshot. It is disclosed rather than resolved.',
    },
    {
      dimension: 'prohibited-inference-coverage',
      verdict: 'approve',
      rationale: 'The third prohibition names this record\'s exact failure mode: do not read a planned test programme as demonstrated tritium breeding, measured performance, completed materials qualification, or commercial blanket readiness. Transfer between TBM concepts is separately forbidden. The claim boundary independently enumerates breeding ratio, extraction rate, neutron and heat-load performance, qualification outcome, and commercial readiness.',
      disagreementsOrUncertainty: 'None. This is the strongest dimension of the revision.',
    },
    {
      dimension: 'rights-basis',
      verdict: 'approve',
      rationale: 'citation-with-paraphrase against an authoritative publisher page. No ITER figure, diagram, or block of page text is reproduced; the establishes statement and claim are original paraphrase of two identified sentences.',
      disagreementsOrUncertainty: 'None.',
    },
    {
      dimension: 'public-wording-safety',
      verdict: 'approve',
      rationale: 'Read as a public page, the wording cannot be mistaken for a fusion milestone announcement. "Documents a programme", "will be used to test", and the carried statement that further research is necessary all keep the record in the planning tense. No number appears anywhere in the claim, so there is nothing for a reader to quote as a result.',
      disagreementsOrUncertainty: 'A casual reader may still take "ITER will experiment with tritium production" as more imminent than the 2039 operation date implies. The record does not state a date, which is accurate to the cited section but leaves timing open.',
    },
  ],
}

function buildDecisions(recordId: string): readonly DimensionDecision[] {
  const audit = revisionAudit(recordId)
  if (!audit) throw new Error(`${recordId}: no alignment audit exists, so no rereview may be recorded.`)
  if (audit.outcome !== 'alignment-clear-ready-for-internal-rereview') {
    throw new Error(`${recordId}: a rereview requires an alignment-clear audit; found ${audit.outcome}.`)
  }
  const revisionSha256 = audit.auditedRevision
  const drafts = DRAFTS[recordId] ?? []
  return drafts.map((draft) => {
    const unsigned = {
      dimension: draft.dimension,
      recordId,
      revisionSha256,
      reviewerId: REVIEWER.reviewerId,
      reviewerKind: REVIEWER.reviewerKind,
      reviewerRole: REVIEWER.role,
      checklistVersion: REPAIRED_REREVIEW_CHECKLIST_VERSION,
      verdict: draft.verdict,
      rationale: draft.rationale,
      disagreementsOrUncertainty: draft.disagreementsOrUncertainty,
      notExternalReview: NOT_EXTERNAL,
    }
    return { ...unsigned, decisionDigest: digest(unsigned) }
  })
}

export interface RereviewLedger {
  recordId: string
  revisionSha256: string
  auditDigest: string
  checklistVersion: typeof REPAIRED_REREVIEW_CHECKLIST_VERSION
  decisions: readonly DimensionDecision[]
  verdictTotals: Record<RereviewVerdict, number>
  state: RereviewState
  blockingDimensions: readonly RereviewDimension[]
  ledgerDigest: string
}

function buildLedger(recordId: string): RereviewLedger {
  const audit = revisionAudit(recordId)!
  const decisions = buildDecisions(recordId)
  const totals = { approve: 0, revise: 0, withhold: 0 }
  for (const decision of decisions) totals[decision.verdict] += 1
  const blocking = decisions.filter((decision) => decision.verdict !== 'approve').map((decision) => decision.dimension)

  // Readiness requires every dimension judged and every verdict an approval.
  const complete = REREVIEW_DIMENSIONS.every((dimension) => decisions.some((decision) => decision.dimension === dimension))
  const state: RereviewState = !complete
    ? 'revise-again'
    : totals.withhold > 0
      ? 'remain-withheld'
      : totals.revise > 0
        ? 'revise-again'
        : 'internally-approved-ready-for-release-preflight'

  const unsigned = {
    recordId,
    revisionSha256: audit.auditedRevision,
    auditDigest: audit.auditDigest,
    checklistVersion: REPAIRED_REREVIEW_CHECKLIST_VERSION,
    decisions,
    verdictTotals: totals,
    state,
    blockingDimensions: blocking,
  }
  return { ...unsigned, ledgerDigest: digest(unsigned) }
}

export const REPAIRED_REREVIEW_LEDGERS: readonly RereviewLedger[] = [MCP, TBM].map(buildLedger)

/**
 * A decision only binds while the record it judged is unchanged. Recomputing the
 * revision digest from the live audited record is the check: change the title,
 * claim, source, locator, scope, or a prohibited inference and the digest moves,
 * so every decision taken against the old digest stops applying.
 */
export function decisionsStillBind(recordId: string, record: EpistemicRecord): boolean {
  const ledger = REPAIRED_REREVIEW_LEDGERS.find((entry) => entry.recordId === recordId)
  if (!ledger) return false
  return ledger.revisionSha256 === epistemicReviewTargetHash(record)
}

/** Approval is an editorial state. It is not a release and creates no release. */
export interface ReleasePreflightReport {
  recordId: string
  revisionSha256: string
  internalReviewState: RereviewState
  internallyApproved: boolean
  canonicalReleaseCreated: false
  releaseAuthorityUsed: false
  inFrozenRemainderCohort: false
  proposedNextStep: string
}

export function releasePreflightReports(): readonly ReleasePreflightReport[] {
  return REPAIRED_REREVIEW_LEDGERS.map((ledger) => ({
    recordId: ledger.recordId,
    revisionSha256: ledger.revisionSha256,
    internalReviewState: ledger.state,
    internallyApproved: ledger.state === 'internally-approved-ready-for-release-preflight',
    canonicalReleaseCreated: false,
    releaseAuthorityUsed: false,
    inFrozenRemainderCohort: false,
    proposedNextStep: ledger.state === 'internally-approved-ready-for-release-preflight'
      ? 'Eligible to be proposed for a later, separate two-record repaired-revision canary. That canary is not created or dispatched here, and this record stays outside the frozen 20-record remainder cohort.'
      : `Return to evidence repair for ${ledger.blockingDimensions.join(', ')}. A corrected revision must carry a new digest and be re-audited before any further review.`,
  }))
}

export function rereviewLedger(recordId: string): RereviewLedger | undefined {
  return REPAIRED_REREVIEW_LEDGERS.find((entry) => entry.recordId === recordId)
}

// Module-load integrity: rationale quality is enforced, not assumed.
{
  const seen = new Map<string, string>()
  for (const ledger of REPAIRED_REREVIEW_LEDGERS) {
    if (ledger.decisions.length !== REREVIEW_DIMENSIONS.length) throw new Error(`${ledger.recordId}: every dimension must carry a decision.`)
    for (const decision of ledger.decisions) {
      if (decision.revisionSha256 !== ledger.revisionSha256) throw new Error(`${decision.recordId}: a decision must bind the ledger revision.`)
      if (decision.rationale.trim().length < 120) throw new Error(`${decision.recordId}/${decision.dimension}: rationale is too thin to be dimension-specific.`)
      if (!decision.disagreementsOrUncertainty.trim()) throw new Error(`${decision.recordId}/${decision.dimension}: disagreement or uncertainty must be stated.`)
      const key = decision.rationale.trim()
      const owner = seen.get(key)
      if (owner) throw new Error(`${decision.recordId}/${decision.dimension}: rationale duplicates ${owner}.`)
      seen.set(key, `${decision.recordId}/${decision.dimension}`)
    }
  }
}

export const REPAIRED_REREVIEW_BOUNDARY = NOT_EXTERNAL
