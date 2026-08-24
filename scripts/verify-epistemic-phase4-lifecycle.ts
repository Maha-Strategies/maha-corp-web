import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { buildEpistemicIngestionBatch, ingestionBatchSnapshot } from '../lib/epistemic-ingestion.ts'
import { EPISTEMIC_PHASE4_PILOT_ENTRIES } from '../lib/epistemic-pilot-corpus.ts'
import {
  buildEpistemicReviewInvitation,
  buildEpistemicReviewInvitationEvent,
  parseEpistemicReviewInvitationRequest,
  parseInvitedEpistemicExpertReview,
} from '../lib/epistemic-review-invitation.ts'
import {
  buildEpistemicExpertReview,
  epistemicOperationsHash,
  EXPERT_REVIEW_CRITERIA,
} from '../lib/epistemic-review.ts'
import { expertReviewProfileHash } from '../lib/epistemic-review.ts'

function sqlJson(value: unknown): string {
  return `'${JSON.stringify(value).replaceAll("'", "''")}'::jsonb`
}

const now = new Date()
const actorFingerprint = `sha256:${'4'.repeat(64)}`
const batch = buildEpistemicIngestionBatch({ adapterId: 'semiconductor', idempotencyKey: 'phase4-local-integration-ingestion' }, now)
const pilot = EPISTEMIC_PHASE4_PILOT_ENTRIES[0]
const invitationInput = parseEpistemicReviewInvitationRequest({
  recordId: pilot.recordId,
  domainSlug: pilot.domainSlug,
  targetSha256: pilot.initialReviewTargetSha256,
  scope: 'source-fidelity',
  reviewer: {
    reviewerId: 'expert_phase4-integration',
    profileVersion: 1,
    displayName: 'Phase 4 Integration Reviewer',
    qualifications: ['Synthetic local lifecycle verifier; not a production reviewer identity.'],
    affiliation: null,
    identityUrl: null,
    domains: [pilot.domainSlug],
    conflicts: ['Synthetic local verification only.'],
  },
  note: 'Local transaction-only verification of the exact-hash invitation and review lifecycle.',
  expiresAt: new Date(now.getTime() + 7 * 86_400_000).toISOString(),
  idempotencyKey: 'phase4-local-integration-invitation',
}, now)
const credential = buildEpistemicReviewInvitation(invitationInput, actorFingerprint, now)
const reviewInput = parseInvitedEpistemicExpertReview({
  criteria: EXPERT_REVIEW_CRITERIA[credential.invitation.scope].map((criterion) => ({
    criterionId: criterion.id,
    verdict: 'satisfied',
    rationale: 'Synthetic criterion decision used only to verify transactional database constraints.',
  })),
  disagreements: [],
  rationale: 'Synthetic scoped conclusion used only for a rolled-back local integration verification.',
  supersedesReviewId: null,
  idempotencyKey: 'phase4-local-integration-review',
}, credential.invitation)
const review = buildEpistemicExpertReview(reviewInput, new Date(now.getTime() + 1000))
const event = buildEpistemicReviewInvitationEvent({
  invitationId: credential.invitation.invitationId,
  action: 'consume',
  reviewId: review.reviewId,
  reason: 'Synthetic invitation consumption used only for a rolled-back local integration verification.',
  actorFingerprint: credential.invitation.tokenSha256,
}, new Date(review.reviewedAt))

const config = readFileSync(join(process.cwd(), 'supabase/config.toml'), 'utf8')
const projectId = config.match(/^project_id\s*=\s*"([^"]+)"/m)?.[1]
assert.ok(projectId, 'supabase/config.toml must declare project_id.')

const sql = `
begin;
select public.record_epistemic_ingestion_batch(
  ${sqlJson(ingestionBatchSnapshot(batch))},
  ${sqlJson(batch.records)},
  '${epistemicOperationsHash('phase4-local-integration-ingestion')}',
  '${actorFingerprint}'
);
select public.record_epistemic_reviewer_invitation(
  ${sqlJson(credential.invitation)},
  '${epistemicOperationsHash(invitationInput.idempotencyKey)}',
  '${actorFingerprint}'
);
select public.consume_epistemic_reviewer_invitation(
  '${credential.invitation.tokenSha256}',
  ${sqlJson(review)},
  '${expertReviewProfileHash(review.reviewer)}',
  '${epistemicOperationsHash(reviewInput.idempotencyKey)}',
  ${sqlJson(event)}
);
do $phase4$
declare
  v_invitation_count integer;
  v_event_count integer;
  v_review_count integer;
begin
  select count(*) into v_invitation_count from public.epistemic_reviewer_invitations where invitation_id = '${credential.invitation.invitationId}';
  select count(*) into v_event_count from public.epistemic_reviewer_invitation_events where invitation_id = '${credential.invitation.invitationId}' and action = 'consume' and review_id = '${review.reviewId}';
  select count(*) into v_review_count from public.epistemic_expert_review_decisions where review_id = '${review.reviewId}' and target_sha256 = '${credential.invitation.targetSha256}';
  if v_invitation_count <> 1 or v_event_count <> 1 or v_review_count <> 1 then
    raise exception 'Phase 4 lifecycle did not atomically create invitation, terminal event, and exact-hash review.';
  end if;
end $phase4$;
rollback;
`

const result = spawnSync('docker', ['exec', '-i', `supabase_db_${projectId}`, 'psql', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '--no-psqlrc'], {
  input: sql,
  encoding: 'utf8',
  maxBuffer: 10 * 1024 * 1024,
})
if (result.status !== 0) {
  process.stderr.write(result.stderr || result.stdout)
  process.exit(result.status ?? 1)
}
assert.match(result.stdout, /ROLLBACK/)
process.stdout.write('Phase 4 local lifecycle passed: ingestion → invitation → exact-hash review + consumption → rollback.\n')
