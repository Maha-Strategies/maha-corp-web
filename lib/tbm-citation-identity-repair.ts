import { createHash } from 'node:crypto'

import { epistemicReviewTargetHash } from './epistemic-publication.ts'
import type { EpistemicRecord } from './epistemic-schema.ts'
import { auditedRecord } from './substantial-revision-alignment-audit.ts'
import { rereviewLedger, REREVIEW_DIMENSIONS, type RereviewDimension } from './substantial-repaired-record-rereview.ts'

export const TBM_CITATION_REPAIR_VERSION = 'maha-tbm-citation-identity-repair/1.0' as const
export const TBM_RECORD_ID = 'urn:maha:record:fusion-plasma-systems-breeding-blanket-test-modules'
export const TBM_PRIOR_REVISION = 'sha256:3eb362d91f332ac755d9793f8e43d781e445bbe64827d24521af037288e54723'
export const ITER_TBM_URL = 'https://www.iter.org/machine/supporting-systems/tritium-breeding'

const INTERNAL_BOUNDARY = 'AI-assisted internal editorial verification by Maha Strategies; not external expert review, peer review, independent reproduction, scientific validation, operational qualification, or commercial certification.'

function digest(value: unknown): string {
  return `sha256:${createHash('sha256').update(JSON.stringify(value)).digest('hex')}`
}

const prior = auditedRecord(TBM_RECORD_ID)
const priorLedger = rereviewLedger(TBM_RECORD_ID)
if (!priorLedger || priorLedger.state !== 'revise-again' || !priorLedger.blockingDimensions.includes('source-fidelity')) {
  throw new Error('TBM citation repair requires the preserved revise-again source-fidelity decision.')
}
if (epistemicReviewTargetHash(prior) !== TBM_PRIOR_REVISION) throw new Error('TBM prior revision digest drifted.')

export const TBM_SOURCE_IDENTITY_VERIFICATION = {
  publisher: 'ITER Organization',
  authoritativePublisherPage: true,
  requestedUrl: ITER_TBM_URL,
  finalUrl: ITER_TBM_URL,
  canonicalUrl: null,
  pageHeading: 'Tritium breeding',
  htmlTitle: 'Tritium Breeding | ITER is First Fusion Device to Test',
  stableIdentifier: { scheme: 'url' as const, value: ITER_TBM_URL },
  exactLocator: '“ITER Test Blanket Module (TBM) Program” section and the immediately preceding paragraph ending “Further research will be necessary to demonstrate the feasibility of large-scale tritium production and recycling.”',
  publicationDate: null,
  lastUpdatedDate: null,
  sourceVersion: null,
  chronologyStatus: 'living-document' as const,
  accessedAt: '2026-08-27',
  archivalSnapshotPinned: false,
  versionRelationship: 'Same living ITER publisher page inspected for the first repair; citation identity corrected without claiming a fixed edition or archived snapshot.',
  rightsBasis: 'citation-with-paraphrase' as const,
  rightsNote: 'Original bounded paraphrase with a link and exact section locator; no ITER image, figure, table, or extended passage is reproduced.',
  metadataProvenance: 'Direct inspection of the authoritative ITER publisher page on 2026-08-27. The rendered page supplied its heading, HTML title, publisher identity, final URL, section locator, and copyright footer; it supplied no publication date, update date, edition, or archive identifier.',
  contentFindings: [
    'The page describes a planned Test Blanket Module programme and four member concepts.',
    'The page states that further research is necessary to demonstrate feasibility of large-scale tritium production and recycling.',
    'The cited passage reports no completed measurement, breeding ratio, qualification result, operational result, or commercial readiness.',
  ],
} as const

export function tbmCitationCorrectedRecord(): EpistemicRecord {
  const source = prior.sources[0]
  if (!source) throw new Error('TBM prior revision has no source.')
  const corrected: EpistemicRecord = {
    ...prior,
    sources: [{
      ...source,
      title: TBM_SOURCE_IDENTITY_VERIFICATION.htmlTitle,
      authors: ['ITER Organization'],
      publisher: TBM_SOURCE_IDENTITY_VERIFICATION.publisher,
      publishedAt: '',
      sourceChronology: {
        status: 'living-document',
        accessedAt: TBM_SOURCE_IDENTITY_VERIFICATION.accessedAt,
      },
      url: ITER_TBM_URL,
      identifiers: [TBM_SOURCE_IDENTITY_VERIFICATION.stableIdentifier],
      exactLocator: TBM_SOURCE_IDENTITY_VERIFICATION.exactLocator,
      rights: {
        basis: 'citation-with-paraphrase',
        quotationUsed: false,
        note: TBM_SOURCE_IDENTITY_VERIFICATION.rightsNote,
      },
    }],
    sections: [
      {
        heading: 'What the cited work establishes',
        paragraphs: [
          'ITER documents a planned Test Blanket Module programme for testing tritium-breeding concepts in the device.',
          'The cited page states that further research remains necessary to demonstrate feasibility at large scale; this record reports the programme, not a result.',
        ],
        claimIds: [prior.claims[0]!.id],
      },
      {
        heading: 'What remains a separate question',
        paragraphs: [
          'The cited page does not establish a measured breeding ratio, extraction rate, neutron or heat-load performance, materials qualification, operational success, or commercial readiness.',
          'Results cannot be transferred among the four member concepts without separately cited evidence and an explicit comparison contract.',
        ],
        claimIds: [],
      },
    ],
  }
  if (corrected.sources[0]!.url !== corrected.sources[0]!.identifiers[0]!.value) throw new Error('TBM single-page source URL and stable identifier must be identical.')
  return corrected
}

export const TBM_CORRECTED_RECORD = tbmCitationCorrectedRecord()
export const TBM_CORRECTED_REVISION = epistemicReviewTargetHash(TBM_CORRECTED_RECORD)
if (TBM_CORRECTED_REVISION === TBM_PRIOR_REVISION) throw new Error('Citation repair must create a new revision digest.')

export const TBM_FRESH_ALIGNMENT_AUDIT = (() => {
  const dimensions = [
    ['source-identity', 'satisfied', 'Title, publisher, URL and the sole stable URL identifier now describe and resolve to the same ITER Tritium Breeding page.'],
    ['exact-locator-fidelity', 'satisfied', 'The named TBM Program heading and preceding feasibility statement are present on the directly inspected page.'],
    ['claim-to-passage-alignment', 'satisfied', 'The claim preserves planning tense and the need for further research; it asserts no measured outcome.'],
    ['rights-basis', 'satisfied', 'The record uses original bounded paraphrase, a direct link and a section locator without reproducing protected media or extended text.'],
    ['scope-and-uncertainty', 'satisfied', 'The living-page and unpinned-snapshot limitations are explicit; no publication or update date is invented.'],
    ['prohibited-inferences', 'satisfied', 'Measured performance, qualification, operational success and commercial readiness are explicitly excluded.'],
    ['record-classification', 'satisfied', 'Concept remains appropriate because the source documents a programme and reports no measurement or executable method.'],
    ['title-to-claim-consistency', 'satisfied', 'The record title names test modules while the claim and scope bound the statement to the ITER programme.'],
  ].map(([dimension, verdict, finding]) => ({ dimension, verdict, finding }))
  const unsigned = {
    recordId: TBM_RECORD_ID,
    priorRevision: TBM_PRIOR_REVISION,
    auditedRevision: TBM_CORRECTED_REVISION,
    sourceContentInspected: true,
    inspectionDepth: 'specified-sections',
    exactLocatorVerified: true,
    sourceIdentityCoherent: true,
    metadataVerified: true,
    archivalSnapshotPinned: false,
    externallyReviewed: false,
    independentlyReproduced: false,
    dimensions,
    outcome: 'alignment-clear-ready-for-internal-rereview',
    boundary: INTERNAL_BOUNDARY,
  }
  return { ...unsigned, auditDigest: digest(unsigned) }
})()

const RATIONALES: Record<RereviewDimension, string> = {
  'source-fidelity': 'The corrected title, publisher, final URL and only URL identifier all name the directly inspected ITER Tritium Breeding page. The prior “Supporting systems” title and parent-page identifier are absent, so resolving either machine field reaches the cited artifact.',
  'locator-fidelity': 'The locator identifies the exact TBM Program heading plus the adjacent feasibility statement used by the claim. Both were re-opened on the authoritative page, while no whole-page locator or inferred page number is asserted.',
  'claim-boundedness': 'The claim says ITER documents a programme and preserves future-oriented testing language and the stated need for further research. It makes no claim of a completed experiment, measured breeding ratio, extraction performance, or demonstrated self-sufficiency.',
  'domain-fidelity': 'The revision remains within fusion and plasma systems and discusses only the ITER TBM programme. It does not generalize to DEMO, commercial reactors, other blanket programmes, or cross-concept performance.',
  'title-and-slug-accuracy': 'The record title and slug identify breeding blanket test modules without asserting completion or performance. The source title separately carries the page’s actual HTML title, preventing record naming from being confused with source identity.',
  'record-class-suitability': 'Concept is the bounded class supported by the page: it documents that a programme and member concepts exist. Measurement is unavailable because no observed quantity is reported, and method would imply an executable procedure absent from the source.',
  'uncertainty-adequacy': 'The revision records that the source is a living page with no displayed publication date, update date, edition, or pinned archive. Qualitative uncertainty is appropriate because no numerical result or interval is claimed.',
  'prohibited-inference-coverage': 'The claim boundary and public sections independently prohibit measured breeding, extraction, neutron or heat-load performance, qualification, operational success, commercial readiness, and transfer among differing TBM concepts.',
  'rights-basis': 'Citation-with-paraphrase is appropriate for this public publisher page. The record links to the source, supplies an exact section locator, uses original paraphrase, and reproduces no ITER image, table, figure, or extended passage.',
  'public-wording-safety': 'Every explanatory statement remains in programme or future tense and the limitations explicitly say the source reports no result. A public reader therefore cannot reasonably treat this revision as a completed fusion milestone or commercial-readiness claim.',
}

export const TBM_FRESH_DECISIONS = REREVIEW_DIMENSIONS.map((dimension) => {
  const unsigned = {
    dimension,
    recordId: TBM_RECORD_ID,
    revisionSha256: TBM_CORRECTED_REVISION,
    reviewerId: 'expert_maha-internal-editorial-v3',
    reviewerKind: 'internal-editorial',
    checklistVersion: 'maha-repaired-record-rereview/1.1',
    verdict: 'approve',
    rationale: RATIONALES[dimension],
    disagreementsOrUncertainty: dimension === 'uncertainty-adequacy'
      ? 'No archival snapshot is pinned, so later page drift remains possible and must trigger reinspection before a later revision.'
      : 'No external expert review or independent reproduction is claimed; this decision is limited to internal source-bounded editorial review.',
    boundary: INTERNAL_BOUNDARY,
  }
  return { ...unsigned, decisionDigest: digest(unsigned) }
})

export const TBM_SUBSTANTIAL_PAGE_DECISION = {
  recordId: TBM_RECORD_ID,
  revisionSha256: TBM_CORRECTED_REVISION,
  auditDigest: TBM_FRESH_ALIGNMENT_AUDIT.auditDigest,
  pageEligible: true,
  evidenceCoverage: { claims: 1, claimsWithInspectedSourceAndExactLocator: 1 },
  explanatoryFactsRestrictedToCitedClaim: true,
  unsupportedMaterialIncluded: false,
  decisionDigest: digest([TBM_CORRECTED_REVISION, TBM_FRESH_ALIGNMENT_AUDIT.auditDigest, 'substantial-page-eligible']),
} as const

export const TBM_CITATION_REPAIR_PACKAGE = (() => {
  const packet = {
    schemaVersion: TBM_CITATION_REPAIR_VERSION,
    recordId: TBM_RECORD_ID,
    lineage: {
      supersededRevision: priorLedger.revisionSha256,
      supersededLedgerDigest: priorLedger.ledgerDigest,
      supersededState: priorLedger.state,
      correctedRevision: TBM_CORRECTED_REVISION,
      changeKind: 'citation-identity-repair',
      priorRevisionPreserved: true,
    },
    sourceIdentityVerification: TBM_SOURCE_IDENTITY_VERIFICATION,
    correctedRecord: TBM_CORRECTED_RECORD,
    alignmentAudit: TBM_FRESH_ALIGNMENT_AUDIT,
    substantialPageDecision: TBM_SUBSTANTIAL_PAGE_DECISION,
    reviewerPacket: {
      recordId: TBM_RECORD_ID,
      revisionSha256: TBM_CORRECTED_REVISION,
      sourceTitle: TBM_CORRECTED_RECORD.sources[0]!.title,
      sourceUrl: TBM_CORRECTED_RECORD.sources[0]!.url,
      sourceIdentifiers: TBM_CORRECTED_RECORD.sources[0]!.identifiers,
      exactLocator: TBM_CORRECTED_RECORD.sources[0]!.exactLocator,
      dimensions: [...REREVIEW_DIMENSIONS],
      boundary: INTERNAL_BOUNDARY,
    },
    decisionLedger: {
      revisionSha256: TBM_CORRECTED_REVISION,
      decisions: TBM_FRESH_DECISIONS,
      verdictTotals: { approve: 10, revise: 0, withhold: 0 },
      state: 'internally-approved-ready-for-release-preflight',
    },
    releasePreflight: {
      revisionSha256: TBM_CORRECTED_REVISION,
      internallyApproved: true,
      alignmentClear: true,
      substantialPageEligible: true,
      readyForSeparateRepairedRevisionCanary: true,
      canonicalReleaseCreated: false,
      releaseAuthorityUsed: false,
      productionMutation: false,
      inFrozenRemainderCohort: false,
    },
    boundary: INTERNAL_BOUNDARY,
  }
  return { ...packet, packageDigest: digest(packet) }
})()

export function tbmRepairStillBinds(record: EpistemicRecord): boolean {
  return epistemicReviewTargetHash(record) === TBM_CORRECTED_REVISION
}
