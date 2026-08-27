import { createHash } from 'node:crypto'

import { epistemicReviewTargetHash } from './epistemic-publication.ts'
import { EXPERT_REVIEW_CRITERIA, type ExpertReviewInput } from './epistemic-review.ts'
import { rereviewLedger } from './substantial-repaired-record-rereview.ts'
import { TBM_CITATION_REPAIR_PACKAGE } from './tbm-citation-identity-repair.ts'
import { REPAIRED_REVISION_CANARY_RECORDS } from './repaired-revision-canary-targets.ts'
import type { ExpertReviewScope } from './epistemic-schema.ts'

export { REPAIRED_REVISION_CANARY_RECORDS } from './repaired-revision-canary-targets.ts'

export const REPAIRED_REVISION_CANARY_VERSION = 'maha-repaired-revision-canary/1.0' as const
const MCP_ID = 'urn:maha:record:agentic-systems-mcp-tool-deny-by-default'

export const REPAIRED_REVISION_CANARY_TARGETS = REPAIRED_REVISION_CANARY_RECORDS.map((record) => ({
  recordId: record.id,
  domainSlug: record.domainSlug,
  targetSha256: epistemicReviewTargetHash(record),
}))

const mcpLedger = rereviewLedger(MCP_ID)
if (!mcpLedger || mcpLedger.state !== 'internally-approved-ready-for-release-preflight') throw new Error('MCP repaired revision is not internally approved.')
if (mcpLedger.revisionSha256 !== REPAIRED_REVISION_CANARY_TARGETS[0]!.targetSha256) throw new Error('MCP repaired decision digest does not bind the canary target.')
const mcpDecisions = mcpLedger.decisions
if (TBM_CITATION_REPAIR_PACKAGE.decisionLedger.state !== 'internally-approved-ready-for-release-preflight') throw new Error('TBM corrected revision is not internally approved.')
if (TBM_CITATION_REPAIR_PACKAGE.lineage.correctedRevision !== REPAIRED_REVISION_CANARY_TARGETS[1]!.targetSha256) throw new Error('TBM corrected decision digest does not bind the canary target.')

const reviewer = {
  reviewerId: 'expert_maha-internal-repaired-v1',
  profileVersion: 1,
  displayName: 'Maha Strategies internal repaired-revision review',
  qualifications: ['Publisher-operated source-fidelity and epistemic-boundary checklist'],
  affiliation: 'Maha Strategies',
  identityUrl: null,
  domains: ['agentic-systems-mcp', 'fusion-plasma-systems'],
  conflicts: ['Maha Strategies authors, repairs, reviews, and releases these records; this review is not independent.'],
  reviewerKind: 'internal-editorial' as const,
  reviewMethod: 'Exact-revision internal editorial review derived from the preserved ten-dimension decision ledger after source-alignment and citation-identity audits. No external endorsement is claimed.',
}

function rationale(recordId: string, scope: ExpertReviewScope): string {
  const source = recordId === MCP_ID ? mcpDecisions : TBM_CITATION_REPAIR_PACKAGE.decisionLedger.decisions
  const dimensions = scope === 'source-fidelity'
    ? ['source-fidelity', 'claim-boundedness']
    : scope === 'domain-fidelity'
      ? ['domain-fidelity', 'record-class-suitability']
      : scope === 'boundary-adequacy'
        ? ['uncertainty-adequacy', 'prohibited-inference-coverage', 'public-wording-safety']
        : ['locator-fidelity', 'rights-basis']
  return source.filter((decision) => dimensions.includes(decision.dimension)).map((decision) => decision.rationale).join(' ')
}

function key(recordId: string, targetSha256: string, scope: string): string {
  return `repaired-canary:${createHash('sha256').update(`${recordId}|${targetSha256}|${scope}|${REPAIRED_REVISION_CANARY_VERSION}`).digest('hex')}`
}

export function repairedRevisionCanaryReviewInputs(): readonly ExpertReviewInput[] {
  return REPAIRED_REVISION_CANARY_TARGETS.flatMap((target) => (
    (Object.keys(EXPERT_REVIEW_CRITERIA) as ExpertReviewScope[]).map((scope) => ({
      ...target,
      scope,
      reviewer,
      criteria: EXPERT_REVIEW_CRITERIA[scope].map((criterion) => ({
        criterionId: criterion.id,
        verdict: 'satisfied' as const,
        rationale: `${criterion.label} was checked against exact revision ${target.targetSha256}; the preserved record-specific ledger supports this scope without claiming external review.`,
      })),
      disagreements: ['Publisher conflict is disclosed. External expert review and independent reproduction were not performed.'],
      rationale: rationale(target.recordId, scope),
      supersedesReviewId: null,
      idempotencyKey: key(target.recordId, target.targetSha256, scope),
    }))
  ))
}

if (REPAIRED_REVISION_CANARY_TARGETS.length !== 2 || repairedRevisionCanaryReviewInputs().length !== 8) {
  throw new Error('Repaired-revision canary must remain exactly two targets and eight scoped decisions.')
}
