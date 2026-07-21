import { createHash, randomUUID } from 'node:crypto'

type CandidateForHandoff = { public_id: string; proposed_path: string; quality_score: number; evidence: unknown; policy_checks: unknown; status: string }
type DraftForHandoff = { public_id: string; candidate_id: string; title: string; summary: string; direct_answer: string; method: string; artifact_url: string | null; artifact_label: string | null; limitations: string | null; editorial_reviewer: string; status: string }

function hash(value: string) { return `sha256:${createHash('sha256').update(value).digest('hex')}` }
function evidenceCount(value: unknown): number { return Array.isArray(value) ? value.length : 0 }
function allPolicyChecks(value: unknown): boolean { return typeof value === 'object' && value !== null && !Array.isArray(value) && Object.values(value).every((item) => item === true) }

export function contentHandoffId() { return `contenthandoff_${randomUUID().replaceAll('-', '')}` }
export function contentHandoffHash(value: string) { return hash(value) }

export function publicationHandoff(input: { candidate: CandidateForHandoff; draft: DraftForHandoff }) {
  const { candidate, draft } = input
  const checklist = {
    evidencePackageApproved: candidate.status === 'approved_for_draft',
    threeOrMoreSources: evidenceCount(candidate.evidence) >= 3,
    policyChecksComplete: allPolicyChecks(candidate.policy_checks),
    editorialReady: draft.status === 'editorial_ready',
    titleComplete: draft.title.trim().length >= 40,
    summaryComplete: draft.summary.trim().length >= 120,
    directAnswerComplete: draft.direct_answer.trim().length >= 300,
    mahaMethodComplete: draft.method.trim().length >= 300,
    limitsIncluded: (draft.limitations?.trim().length ?? 0) >= 100,
    evidenceArtifactIncluded: Boolean(draft.artifact_url && draft.artifact_label),
    reviewerAssigned: draft.editorial_reviewer.trim().length >= 3,
  }
  const score = Math.round(
    candidate.quality_score * 0.35
    + (checklist.evidencePackageApproved ? 5 : 0)
    + (checklist.threeOrMoreSources ? 5 : 0)
    + (checklist.policyChecksComplete ? 5 : 0)
    + (checklist.editorialReady ? 5 : 0)
    + (checklist.titleComplete ? 4 : 0)
    + (checklist.summaryComplete ? 5 : 0)
    + (checklist.directAnswerComplete ? 12 : 0)
    + (checklist.mahaMethodComplete ? 12 : 0)
    + (checklist.limitsIncluded ? 5 : 0)
    + (checklist.evidenceArtifactIncluded ? 3 : 0)
    + (checklist.reviewerAssigned ? 4 : 0),
  )
  const hardBlockersClear = checklist.summaryComplete && checklist.mahaMethodComplete && checklist.limitsIncluded && checklist.evidenceArtifactIncluded
  return { score, decision: score >= 70 && hardBlockersClear ? 'ready_for_human_publish' as const : 'withheld' as const, checklist }
}
