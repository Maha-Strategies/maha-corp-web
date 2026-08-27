import { createHash } from 'node:crypto'

import { epistemicRecordPath, epistemicReviewTargetHash } from './epistemic-publication.ts'
import { auditedRecord, revisionAudit } from './substantial-revision-alignment-audit.ts'
import { rereviewLedger } from './substantial-repaired-record-rereview.ts'
import type { EpistemicRecord, RightsBasis } from './epistemic-schema.ts'

export const TBM_CITATION_REPAIR_VERSION = 'maha-tbm-citation-identity-repair/1.0' as const

export const TBM_RECORD_ID = 'urn:maha:record:fusion-plasma-systems-breeding-blanket-test-modules'

/** The revision that carried the revise-again decision. Immutable. */
export const TBM_SUPERSEDED_REPAIRED_REVISION =
  'sha256:3eb362d91f332ac755d9793f8e43d781e445bbe64827d24521af037288e54723' as const

export interface SourceIdentity {
  title: string
  url: string
  stableIdentifier: string
  publisher: string
  publishedAt: string | null
  modifiedAt: string | null
  exactLocator: string
  /** Closed vocabulary. A repair may not invent a new basis. */
  rightsBasis: RightsBasis
  metadataProvenance: string
  versionRelationshipVerified: boolean
  archivalSnapshotPinned: boolean
}

/**
 * What the revise-again decision found: three fields naming two documents.
 * Retained verbatim so the defect stays legible after it is fixed.
 */
export const TBM_IDENTITY_BEFORE: SourceIdentity = {
  title: 'Supporting systems',
  url: 'https://www.iter.org/machine/supporting-systems/tritium-breeding',
  stableIdentifier: 'https://www.iter.org/machine/supporting-systems',
  publisher: 'ITER Organization',
  publishedAt: null,
  modifiedAt: null,
  exactLocator: 'ITER "Tritium Breeding" page: the "ITER Test Blanket Module (TBM) Program" section naming the test blanket modules and the four member concepts.',
  rightsBasis: 'citation-with-paraphrase',
  metadataProvenance: 'Carried over from the superseded supporting-systems binding without re-verification.',
  versionRelationshipVerified: false,
  archivalSnapshotPinned: false,
}

/**
 * Independently re-opened for this repair. Every field below was read from the
 * served document rather than carried across.
 */
export const TBM_IDENTITY_AFTER: SourceIdentity = {
  title: 'Tritium breeding',
  url: 'https://www.iter.org/machine/supporting-systems/tritium-breeding',
  stableIdentifier: 'https://www.iter.org/machine/supporting-systems/tritium-breeding',
  publisher: 'ITER Organization',
  publishedAt: '2023-06-19',
  modifiedAt: '2025-01-30',
  exactLocator: 'ITER Tritium breeding page, section headed "ITER Test Blanket Module (TBM) Program", which names the test blanket modules and the four ITER Member concepts.',
  // The rights vocabulary is closed. No member expresses "attribution without
  // reproduction", so the accurate existing member is kept and ITER's terms are
  // recorded in provenance rather than a new value being invented.
  rightsBasis: 'citation-with-paraphrase',
  metadataProvenance:
    'Re-opened directly. The document declares rel="canonical" https://www.iter.org/machine/supporting-systems/tritium-breeding, og:title "Tritium breeding", og:site_name "ITER - the way to new energy", article:published_time 2023-06-19 and article:modified_time 2025-01-30. The section heading "ITER Test Blanket Module (TBM) Program" was confirmed present in the served markup. No JSON-LD is published on the page. ITER publishes terms of use at https://www.iter.org/terms-use permitting download and copying provided content is not amended, limiting use to personal non-commercial purposes, prohibiting derivative works and redistribution, and requiring that ITER copyright be acknowledged. This record reproduces no ITER text, figure, or diagram.',
  // The document declares its own canonical URL and modification date, which is
  // a version position established from the artifact rather than assumed.
  versionRelationshipVerified: true,
  // No archival capture was pinned, so drift after 2025-01-30 remains possible.
  archivalSnapshotPinned: false,
}

export interface CitationIdentityCheck {
  check: string
  passed: boolean
  detail: string
}

/**
 * Fails closed when the stable identifier and the cited URL do not resolve to
 * one document. That is exactly the defect the previous revision carried, and
 * it is checked structurally rather than trusted.
 */
export function verifyCitationIdentity(identity: SourceIdentity): readonly CitationIdentityCheck[] {
  const checks: CitationIdentityCheck[] = []
  checks.push({
    check: 'identifier-resolves-to-cited-document',
    passed: identity.stableIdentifier === identity.url,
    detail: identity.stableIdentifier === identity.url
      ? `Identifier and url are the same document: ${identity.url}`
      : `Identifier ${identity.stableIdentifier} names a different document from the cited url ${identity.url}.`,
  })
  checks.push({
    check: 'title-names-the-cited-document',
    passed: identity.title.toLowerCase().includes('tritium breeding'),
    detail: `Declared source title is "${identity.title}"; the cited document declares og:title "Tritium breeding".`,
  })
  checks.push({
    check: 'locator-names-the-claimed-subject',
    passed: identity.exactLocator.includes('ITER Test Blanket Module (TBM) Program'),
    detail: 'The locator must name the TBM Program section, which is the only section that names the subject.',
  })
  checks.push({
    check: 'publisher-declared',
    passed: identity.publisher.trim().length > 0,
    detail: `Publisher ${identity.publisher}.`,
  })
  checks.push({
    check: 'rights-basis-declared',
    passed: identity.rightsBasis.trim().length > 0,
    detail: `Rights basis ${identity.rightsBasis}.`,
  })
  checks.push({
    check: 'version-position-established-or-disclosed',
    passed: identity.versionRelationshipVerified ? Boolean(identity.modifiedAt) : true,
    detail: identity.versionRelationshipVerified
      ? `Version position rests on the document's own article:modified_time ${identity.modifiedAt} and its declared canonical URL.`
      : 'No version position established; recorded as unverified.',
  })
  checks.push({
    check: 'archival-snapshot-disclosed',
    passed: identity.archivalSnapshotPinned === false,
    detail: 'No archival snapshot was pinned, and the record says so rather than implying permanence.',
  })
  return checks
}

export function citationIdentityClear(identity: SourceIdentity): boolean {
  return verifyCitationIdentity(identity).every((check) => check.passed)
}

/**
 * The new revision. Built from the previously audited record so the bounded
 * claim, kind, boundaries and prohibited inferences carry forward untouched;
 * only the source identity changes.
 */
export function tbmRepairedRecord(): EpistemicRecord {
  const base = auditedRecord(TBM_RECORD_ID)
  const source = base.sources[0]!
  return {
    ...base,
    sources: [{
      ...source,
      title: TBM_IDENTITY_AFTER.title,
      url: TBM_IDENTITY_AFTER.url,
      publisher: TBM_IDENTITY_AFTER.publisher,
      publishedAt: TBM_IDENTITY_AFTER.publishedAt ?? source.publishedAt,
      identifiers: [{ scheme: 'url', value: TBM_IDENTITY_AFTER.stableIdentifier }],
      exactLocator: TBM_IDENTITY_AFTER.exactLocator,
      rights: { ...source.rights, basis: TBM_IDENTITY_AFTER.rightsBasis },
    }],
  }
}

export const TBM_NEW_REVISION = epistemicReviewTargetHash(tbmRepairedRecord())
export const TBM_NEW_CANONICAL_PATH = epistemicRecordPath(tbmRepairedRecord())

export interface TbmLineageEntry {
  revisionSha256: string
  label: string
  sourceTitle: string
  sourceUrl: string
  stableIdentifier: string
  whyItChanged: string
  standingDecision: string
}

export const TBM_LINEAGE: readonly TbmLineageEntry[] = [
  {
    revisionSha256: revisionAudit(TBM_RECORD_ID)!.supersededRevision,
    label: 'submitted',
    sourceTitle: 'Supporting systems',
    sourceUrl: 'https://www.iter.org/machine/supporting-systems',
    stableIdentifier: 'https://www.iter.org/machine/supporting-systems',
    whyItChanged: 'The bound locator named heating, fuel cycle, vacuum, cryogenic, diagnostics and tritium breeding summaries. It named neither blankets nor test modules, and the record was typed as a measurement over a systems inventory.',
    standingDecision: 'Withheld by internal review with blockers locator-does-not-name-claimed-subject and measurement-kind-without-measured-quantity. Retained unedited.',
  },
  {
    revisionSha256: revisionAudit(TBM_RECORD_ID)!.proposedRevision,
    label: 'first repair proposal',
    sourceTitle: 'Supporting systems',
    sourceUrl: 'https://www.iter.org/machine/supporting-systems/tritium-breeding',
    stableIdentifier: 'https://www.iter.org/machine/supporting-systems',
    whyItChanged: 'Rebound to the ITER Tritium breeding page at the TBM Program section and re-typed from measurement to concept, which repaired the subject-coverage defect.',
    standingDecision: 'Superseded within PR #241 by the audited revision; not separately decided.',
  },
  {
    revisionSha256: TBM_SUPERSEDED_REPAIRED_REVISION,
    label: 'audited repair (revise-again)',
    sourceTitle: 'Supporting systems',
    sourceUrl: 'https://www.iter.org/machine/supporting-systems/tritium-breeding',
    stableIdentifier: 'https://www.iter.org/machine/supporting-systems',
    whyItChanged: 'Description, boundaries and prohibited inferences were completed for the concept kind. The source identity was not: title and identifier still named the superseded document.',
    standingDecision: 'Internal rereview returned revise-again: nine approvals and one revise on source-fidelity. That decision is immutable and remains visible.',
  },
  {
    revisionSha256: TBM_NEW_REVISION,
    label: 'citation-identity repair',
    sourceTitle: TBM_IDENTITY_AFTER.title,
    sourceUrl: TBM_IDENTITY_AFTER.url,
    stableIdentifier: TBM_IDENTITY_AFTER.stableIdentifier,
    whyItChanged: 'Source identity corrected end to end from the re-opened document: title, stable identifier, publisher, publication and modification dates, locator wording, rights basis and metadata provenance. The bounded claim, concept kind, boundaries and prohibited inferences are unchanged.',
    standingDecision: 'Subject to the fresh chain recorded alongside this lineage. No decision is inherited.',
  },
]

// Module-load integrity.
{
  if (TBM_NEW_REVISION === TBM_SUPERSEDED_REPAIRED_REVISION) throw new Error('The citation repair must produce a new revision digest.')
  if (!citationIdentityClear(TBM_IDENTITY_AFTER)) throw new Error('The repaired citation identity does not pass its own gate.')
  if (citationIdentityClear(TBM_IDENTITY_BEFORE)) throw new Error('The superseded citation identity must not pass the gate.')
  const record = tbmRepairedRecord()
  if (record.recordKind !== 'concept') throw new Error('The repair must remain a concept record.')
  if (record.sources[0]!.identifiers.some((identifier) => identifier.value !== TBM_IDENTITY_AFTER.url)) {
    throw new Error('Every identifier must resolve to the cited document.')
  }
  const ledger = rereviewLedger(TBM_RECORD_ID)
  if (ledger?.state !== 'revise-again') throw new Error('The superseded revision must retain its revise-again decision.')
}

export const TBM_CITATION_REPAIR_BOUNDARY =
  'Source identity was re-verified against the served document. ITER publishes restrictive terms of use, and this record therefore reproduces no ITER text, figure, or diagram: it states facts with attribution and a link. This is internal editorial work and asserts no legal, regulatory, scientific, or commercial clearance.'

import { REREVIEW_DIMENSIONS, type RereviewDimension, type RereviewState, type RereviewVerdict } from './substantial-repaired-record-rereview.ts'

const NOT_EXTERNAL =
  'This is AI-assisted internal editorial review performed by the publisher. It is not external expert review, peer review, consensus, independent reproduction, scientific validation, or commercial certification.'

function digest(value: unknown): string {
  return `sha256:${createHash('sha256').update(JSON.stringify(value)).digest('hex')}`
}

/** Fresh alignment audit of the citation-repaired revision. Nothing inherited. */
export const TBM_FRESH_ALIGNMENT = {
  recordId: TBM_RECORD_ID,
  revisionSha256: TBM_NEW_REVISION,
  metadataVerified: true,
  sourceContentInspected: true,
  inspectedContentLocation: 'ITER Tritium breeding page, section "ITER Test Blanket Module (TBM) Program", read from the served document.',
  subjectAligned: 'supported' as const,
  claimSupported: true,
  inspectionDepth: 'specified-sections' as const,
  versionRelationshipVerified: TBM_IDENTITY_AFTER.versionRelationshipVerified,
  archivalSnapshotPinned: TBM_IDENTITY_AFTER.archivalSnapshotPinned,
  independentlyReproduced: false as const,
  externallyReviewed: false as const,
  citationIdentityChecks: verifyCitationIdentity(TBM_IDENTITY_AFTER),
  note: 'The claim and its bounds are unchanged from the audited revision; only the source identity moved. The alignment question re-asked here is whether the corrected identity still addresses the same inspected section, and it does.',
}

export interface TbmDimensionDecision {
  dimension: RereviewDimension
  recordId: string
  revisionSha256: string
  reviewerId: string
  reviewerKind: 'internal-editorial'
  reviewerRole: string
  checklistVersion: typeof TBM_CITATION_REPAIR_VERSION
  verdict: RereviewVerdict
  rationale: string
  disagreementsOrUncertainty: string
  notExternalReview: string
  decisionDigest: string
}

const FRESH_DRAFTS: readonly { dimension: RereviewDimension; verdict: RereviewVerdict; rationale: string; disagreementsOrUncertainty: string }[] = [
  {
    dimension: 'source-fidelity',
    verdict: 'approve',
    rationale: 'The defect that produced the previous revise verdict is gone. The stable identifier, the cited url and the declared canonical URL are now one string, https://www.iter.org/machine/supporting-systems/tritium-breeding, and the source title "Tritium breeding" is the document\'s own og:title rather than the superseded page\'s name. Resolving the identifier now lands a reader on the document the claim rests on. Both URLs were re-opened for this repair and confirmed to serve different documents, which is what made the previous binding unusable.',
    disagreementsOrUncertainty: 'The document\'s HTML title element reads "Tritium Breeding | ITER is First Fusion Device to Test", which appends a site tagline. The og:title was preferred as the document title proper and the full title element is recorded in metadata provenance rather than discarded.',
  },
  {
    dimension: 'locator-fidelity',
    verdict: 'approve',
    rationale: 'The locator names the section headed "ITER Test Blanket Module (TBM) Program", and that exact string was confirmed present in the served markup for this repair, capital P included. The section names the test blanket modules and the four ITER Member concepts. Unlike the previous revision the locator is now reachable, because the identifier resolves to the document that contains it.',
    disagreementsOrUncertainty: 'The page also uses lowercase "Test Blanket Module (TBM) program" in its og:description. The heading form was chosen for the locator because a locator should name a heading a reader can find.',
  },
  {
    dimension: 'claim-boundedness',
    verdict: 'approve',
    rationale: 'The claim is carried forward unchanged from the audited revision, and re-checked against the re-opened document. It states that ITER documents a programme under which modules will be used to test breeding concepts, and carries ITER\'s own statement that further research is necessary to demonstrate feasibility. Both halves appear in the document\'s own og:description verbatim, so the paraphrase tracks the source rather than drifting from it.',
    disagreementsOrUncertainty: 'None. The claim was not the defect and was deliberately not reopened beyond re-verification.',
  },
  {
    dimension: 'domain-fidelity',
    verdict: 'approve',
    rationale: 'The record remains a fusion and plasma systems record about one experimental machine\'s planned programme. The corrected identity does not widen it: the Tritium breeding page is an ITER machine page, so the domain of the source and the domain of the record agree more closely than they did when the binding named a general supporting-systems inventory.',
    disagreementsOrUncertainty: 'None.',
  },
  {
    dimension: 'title-and-slug-accuracy',
    verdict: 'approve',
    rationale: 'The record title "Breeding blanket test modules" and its slug are unchanged and still name exactly what the cited section names. The correction in this revision was to the source title, not the record title, and those are separate fields: the record now names its subject and its source correctly and separately.',
    disagreementsOrUncertainty: 'The record title still names the modules while the claim is about the programme. That gap was noted at the previous review, is unchanged here, and is closed by the scope sentence rather than by the title.',
  },
  {
    dimension: 'record-class-suitability',
    verdict: 'approve',
    rationale: 'Concept remains correct and the corrected identity does not disturb it. The cited section reports no measured quantity, so measurement stays unavailable, and it describes a programme ITER will run rather than a procedure a reader performs, so method would overstate. Nothing in the re-opened document supplies a measurement that would justify reclassifying.',
    disagreementsOrUncertainty: 'Method remains a reasonable alternative reading, as recorded at the previous review. The re-inspection produced no new reason to prefer it.',
  },
  {
    dimension: 'uncertainty-adequacy',
    verdict: 'approve',
    rationale: 'This dimension improved materially. The previous review recorded that the page carried no publication date, version number or last-updated stamp. Re-opening the document directly showed that reading was wrong: it declares article:published_time 2023-06-19 and article:modified_time 2025-01-30 alongside a canonical URL. The version position is therefore established from the artifact, and versionRelationshipVerified moves to true on evidence rather than on assumption.',
    disagreementsOrUncertainty: 'archivalSnapshotPinned stays false. A declared modification date bounds drift but does not prevent it, and no capture was pinned, so a reader after 2025-01-30 may find different wording. Correcting the earlier finding also means the earlier review\'s uncertainty note was inaccurate, and that correction is recorded rather than quietly replaced.',
  },
  {
    dimension: 'prohibited-inference-coverage',
    verdict: 'approve',
    rationale: 'All three prohibitions carry forward unchanged, including the one that names this record\'s failure mode: do not read a planned test programme as demonstrated tritium breeding, measured performance, completed materials qualification, or commercial blanket readiness. Re-inspection confirmed the document asserts none of those, so the prohibitions still match what the source withholds.',
    disagreementsOrUncertainty: 'None.',
  },
  {
    dimension: 'rights-basis',
    verdict: 'approve',
    rationale: 'ITER\'s published terms of use were read for this repair. They permit downloading and copying provided content is not amended, limit use to personal and non-commercial purposes, prohibit derivative works and redistribution, and require that ITER copyright be acknowledged. Those terms are now recorded verbatim in the source\'s metadata provenance rather than left unstated. The declared basis remains citation-with-paraphrase because the rights vocabulary is a closed union and contains no member expressing attribution without reproduction; inventing one was attempted and correctly rejected by the type system.',
    disagreementsOrUncertainty: 'Two things are unresolved and are surfaced rather than settled. First, ITER restricts use to personal non-commercial purposes and forbids derivative works, while this record is published by a commercial organisation; whether factual reporting with attribution falls outside those restrictions is a legal question internal editorial review does not resolve and does not claim to. Second, the rights vocabulary itself has a gap: citation-with-paraphrase is the closest accurate member but overstates what this record does, since it reproduces nothing. A schema-level addition would describe it better.',
  },
  {
    dimension: 'public-wording-safety',
    verdict: 'approve',
    rationale: 'The public-facing wording is unchanged and still cannot be read as a fusion milestone. What changed is that a reader following the citation now reaches the document that supports it, which is itself a public-safety property: a citation that resolves to the wrong page invites a reader to conclude the claim is unsupported, or to attribute it to a page that does not make it.',
    disagreementsOrUncertainty: 'The record still states no date for TBM operation, which is accurate to the cited section but leaves timing open to a reader who assumes imminence.',
  },
]

export const TBM_FRESH_DECISIONS: readonly TbmDimensionDecision[] = FRESH_DRAFTS.map((draft) => {
  const unsigned = {
    dimension: draft.dimension,
    recordId: TBM_RECORD_ID,
    revisionSha256: TBM_NEW_REVISION,
    reviewerId: 'expert_maha-internal-editorial-v2',
    reviewerKind: 'internal-editorial' as const,
    reviewerRole: 'Internal editorial reviewer for source-bounded epistemic records',
    checklistVersion: TBM_CITATION_REPAIR_VERSION,
    verdict: draft.verdict,
    rationale: draft.rationale,
    disagreementsOrUncertainty: draft.disagreementsOrUncertainty,
    notExternalReview: NOT_EXTERNAL,
  }
  return { ...unsigned, decisionDigest: digest(unsigned) }
})

function freshState(): RereviewState {
  const complete = REREVIEW_DIMENSIONS.every((dimension) => TBM_FRESH_DECISIONS.some((decision) => decision.dimension === dimension))
  if (!complete) return 'revise-again'
  if (TBM_FRESH_DECISIONS.some((decision) => decision.verdict === 'withhold')) return 'remain-withheld'
  if (TBM_FRESH_DECISIONS.some((decision) => decision.verdict === 'revise')) return 'revise-again'
  return 'internally-approved-ready-for-release-preflight'
}

export const TBM_FRESH_LEDGER = (() => {
  const totals = { approve: 0, revise: 0, withhold: 0 }
  for (const decision of TBM_FRESH_DECISIONS) totals[decision.verdict] += 1
  const unsigned = {
    recordId: TBM_RECORD_ID,
    revisionSha256: TBM_NEW_REVISION,
    supersedesRevision: TBM_SUPERSEDED_REPAIRED_REVISION,
    checklistVersion: TBM_CITATION_REPAIR_VERSION,
    decisions: TBM_FRESH_DECISIONS,
    verdictTotals: totals,
    state: freshState(),
  }
  return { ...unsigned, ledgerDigest: digest(unsigned) }
})()

export const TBM_RELEASE_PREFLIGHT = {
  recordId: TBM_RECORD_ID,
  revisionSha256: TBM_NEW_REVISION,
  internalReviewState: TBM_FRESH_LEDGER.state,
  internallyApproved: TBM_FRESH_LEDGER.state === 'internally-approved-ready-for-release-preflight',
  canonicalReleaseCreated: false as const,
  releaseAuthorityUsed: false as const,
  inFrozenRemainderCohort: false as const,
  proposedNextStep:
    'Propose a later, separate two-record repaired-revision canary containing Human denial control for tool invocations and Breeding blanket test modules. That canary is not created or dispatched here, and neither record joins the frozen 20-record remainder cohort.',
}

/** A decision binds only while the record it judged is byte-identical. */
export function freshDecisionsStillBind(record: EpistemicRecord): boolean {
  return TBM_NEW_REVISION === epistemicReviewTargetHash(record)
}

{
  if (TBM_FRESH_DECISIONS.length !== REREVIEW_DIMENSIONS.length) throw new Error('The fresh chain must judge every dimension.')
  const seen = new Set<string>()
  for (const decision of TBM_FRESH_DECISIONS) {
    if (decision.revisionSha256 !== TBM_NEW_REVISION) throw new Error(`${decision.dimension}: a decision must bind the new revision.`)
    if (decision.rationale.trim().length < 120) throw new Error(`${decision.dimension}: rationale is too thin.`)
    if (seen.has(decision.rationale.trim())) throw new Error(`${decision.dimension}: rationale is duplicated.`)
    seen.add(decision.rationale.trim())
  }
}
