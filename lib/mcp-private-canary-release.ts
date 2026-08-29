import { createHash } from 'node:crypto'

import { EXPERT_REVIEW_CRITERIA, type ExpertReviewInput } from './epistemic-review.ts'
import { epistemicReviewTargetHash, sha256Canonical } from './epistemic-publication.ts'
import {
  EPISTEMIC_POLICY_VERSION,
  EPISTEMIC_SCHEMA_VERSION,
  EXPERT_REVIEW_SCOPES,
  type EpistemicRecord,
  type ExpertReviewScope,
} from './epistemic-schema.ts'

export const MCP_PRIVATE_CANARY_ADAPTER_ID = 'mcp-private-canary' as const
export const MCP_PRIVATE_CANARY_RECORD_ID = 'urn:maha:record:synthetic-private-mcp-release-fixture' as const
export const MCP_PRIVATE_CANARY_DATASET_VERSION = 'maha-synthetic-private-mcp-release/1.0' as const

export const MCP_PRIVATE_CANARY_INSPECTION = {
  schemaVersion: 'maha-synthetic-source-inspection/1.0',
  sourceId: 'source-maha-epistemic-system-boundary',
  sourceUrl: 'https://www.mahastrategies.com/knowledge/epistemic-system',
  exactLocator: 'Publication gateway and canonical release boundary sections.',
  inspectedAt: '2026-08-29',
  inspectionMethod: 'Internal editorial reading of the named public sections for this synthetic control-path claim only.',
  verdict: 'supports-bounded-synthetic-claim',
  externalReview: false,
} as const

export const MCP_PRIVATE_CANARY_INSPECTION_SHA256 = sha256Canonical(MCP_PRIVATE_CANARY_INSPECTION)

export const MCP_PRIVATE_CANARY_RECORD: EpistemicRecord = {
  schemaVersion: EPISTEMIC_SCHEMA_VERSION,
  evidencePolicyVersion: EPISTEMIC_POLICY_VERSION,
  id: MCP_PRIVATE_CANARY_RECORD_ID,
  domainSlug: 'agentic-systems-mcp',
  recordKind: 'method',
  slug: 'synthetic-private-mcp-release-fixture',
  title: 'Synthetic private MCP release fixture',
  description: 'A non-production method record used only to verify that ingestion, scoped internal review, separate release authority, licensed MCP retrieval, delivery and acknowledgement remain distinct governed transitions.',
  summary: 'Every entity and assertion in this record is an internal synthetic test fixture. It exists only inside an ephemeral schema-only Preview branch and is deleted with that branch.',
  claims: [{
    id: 'urn:maha:claim:synthetic-private-mcp-release-separation',
    statement: 'Maha’s governed test protocol treats candidate ingestion, scoped editorial decisions, release authorization, licensed retrieval, delivery and acknowledgement as separate state transitions.',
    claimKind: 'formal-proposition',
    evidenceMaturity: 'not-applicable',
    sourceIds: ['source-maha-epistemic-system-boundary'],
    scope: 'The internal control architecture and this single ephemeral Preview lifecycle; no external system, scientific proposition or commercial outcome.',
    boundary: 'The lifecycle proves only that declared controls execute in one synthetic run. It does not establish scientific truth, external interoperability, security certification, customer demand or Production readiness.',
    uncertainty: { kind: 'not-applicable', statement: 'This is a deterministic control-path fixture, not a measurement or empirical estimate.' },
    replication: { independentReplicationCount: null, assessment: 'No independent reproduction is claimed; this is an internal synthetic canary.', asOfDate: '2026-08-29' },
  }],
  sources: [{
    id: 'source-maha-epistemic-system-boundary',
    title: 'Maha Epistemic System',
    authors: ['Maha Strategies'],
    publisher: 'Maha Strategies',
    publishedAt: '',
    sourceChronology: { status: 'living-document', accessedAt: '2026-08-29', sourceVersion: 'maha-epistemic/1.0' },
    url: 'https://www.mahastrategies.com/knowledge/epistemic-system',
    identifiers: [{ scheme: 'url', value: 'https://www.mahastrategies.com/knowledge/epistemic-system' }],
    exactLocator: 'Publication gateway and canonical release boundary sections.',
    rights: { basis: 'citation-with-paraphrase', quotationUsed: false, note: 'Maha-authored control description; this fixture retains original paraphrase and no quoted passage.' },
    establishes: 'The published architecture separates candidate compilation, review decisions and canonical release authority, and states that governance does not certify truth or fitness.',
    boundary: 'The source describes Maha’s control design. It does not independently validate implementation security, scientific claims, interoperability or commercial value.',
    conflictsOfInterest: 'Maha Strategies authors both the referenced control description and this internal fixture.',
  }],
  sections: [{
    heading: 'Synthetic control-path assertion',
    paragraphs: ['The fixture is designed to exercise each governed transition separately and to fail closed if any exact-hash, identity, entitlement, replay or delivery binding is absent.'],
    claimIds: ['urn:maha:claim:synthetic-private-mcp-release-separation'],
  }, {
    heading: 'Non-claims',
    paragraphs: ['A passing run is operational evidence for one ephemeral environment only. It is not a scientific result, external audit, security certification, sale, payment, escrow event or Production release.'],
    claimIds: [],
  }],
  bridges: [],
  boundaries: [
    'Every identity, decision and commercial state in this fixture is synthetic and internal.',
    'The named Maha source locator was internally inspected on 2026-08-29 only for the bounded synthetic control-path claim; that inspection is not external review or independent validation.',
    'The release is valid only inside the named ephemeral Preview branch and must disappear when that branch is deleted.',
    'Internal editorial approval is not external expert endorsement or independent reproduction.',
  ],
  prohibitedInferences: [
    'Do not represent this fixture as a Production canonical release, customer transaction, scientific finding or external CABEZON validation.',
    'Do not reuse the fixture authority, credential, grant, execution or lifecycle outside its one ephemeral canary.',
  ],
  publication: {
    requestedPublicPromotion: false,
    reviewState: 'draft',
    canonicalVersion: 'private-canary/1.0',
    lastReviewedAt: '2026-08-29T00:00:00.000Z',
    requiredReviewScopes: [...EXPERT_REVIEW_SCOPES],
    reviewEvents: [],
  },
}

export const MCP_PRIVATE_CANARY_TARGET_SHA256 = epistemicReviewTargetHash(MCP_PRIVATE_CANARY_RECORD)

const SCOPE_FINDINGS: Record<ExpertReviewScope, string> = {
  'source-fidelity': 'The sole claim is limited to Maha’s own published separation of candidate, review and release controls; the source does not support any external validation claim.',
  'domain-fidelity': 'The record is explicitly a method-level agentic/MCP control fixture and does not transfer its result into science, security certification or CABEZON network performance.',
  'boundary-adequacy': 'The record repeatedly excludes Production release, scientific truth, external review, commercial validation, payment, escrow and readiness inferences.',
  'rights-and-locator': 'The Maha-authored living source, exact public URL, named sections, citation-only use and organizational conflict are all declared.',
}

export function mcpPrivateCanaryReviewInputs(): ExpertReviewInput[] {
  return EXPERT_REVIEW_SCOPES.map((scope) => ({
    recordId: MCP_PRIVATE_CANARY_RECORD.id,
    domainSlug: MCP_PRIVATE_CANARY_RECORD.domainSlug,
    targetSha256: MCP_PRIVATE_CANARY_TARGET_SHA256,
    scope,
    reviewer: {
      reviewerId: 'expert_maha-synthetic-canary',
      profileVersion: 1,
      displayName: 'Maha Synthetic Canary Editorial Protocol',
      qualifications: ['Internal record-specific checklist review for a synthetic control-path fixture; no external subject-matter expertise or endorsement is claimed.'],
      affiliation: 'Maha Strategies',
      identityUrl: 'https://www.mahastrategies.com/knowledge/epistemic-system',
      domains: [MCP_PRIVATE_CANARY_RECORD.domainSlug],
      conflicts: ['Maha Strategies authors the source, fixture and review protocol.'],
      reviewerKind: 'internal-editorial',
      reviewMethod: 'Exact-revision internal checklist review of source scope, domain terminology, non-claims, rights, locator and synthetic-only lifecycle boundaries.',
    },
    criteria: EXPERT_REVIEW_CRITERIA[scope].map((criterion) => ({
      criterionId: criterion.id,
      verdict: 'satisfied' as const,
      rationale: `${SCOPE_FINDINGS[scope]} Criterion checked: ${criterion.question}`,
    })),
    disagreements: ['No external reviewer participated; the organizational authorship conflict is retained.'],
    rationale: `${SCOPE_FINDINGS[scope]} Approval applies only to ${scope} on exact target ${MCP_PRIVATE_CANARY_TARGET_SHA256}.`,
    supersedesReviewId: null,
    idempotencyKey: `mcp-private-canary:${createHash('sha256').update(`${MCP_PRIVATE_CANARY_RECORD.id}|${MCP_PRIVATE_CANARY_TARGET_SHA256}|${scope}`).digest('hex')}`,
  }))
}
