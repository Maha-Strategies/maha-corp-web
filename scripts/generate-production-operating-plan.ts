import { createHash } from 'node:crypto'
import { writeFileSync } from 'node:fs'

import { canonicalJson } from '../lib/evidence-dossier/digest.ts'
import { REVIEW_TIERS } from '../lib/review-tier.ts'
import preflight from '../content/source-cluster/production-preflight.json' with { type: 'json' }
import proof from '../content/source-cluster/cascade-proof.json' with { type: 'json' }

/**
 * The two-phase Production operating plan.
 *
 * Totals are stated against the observed live surface, not against the 764
 * figure recorded on 2026-09-01. That baseline went stale when the eighth open
 * book and two other routes landed, and planning against a stale number would
 * make a correct release look like a miscount.
 */

const sha = (v: unknown) => `sha256:${createHash('sha256').update(canonicalJson(v), 'utf8').digest('hex')}`
const OBSERVED_LIVE = 792
const rows = preflight.records as Record<string, unknown>[]
const canary = rows.filter((r) => r.phase === 'canary')
const remainder = rows.filter((r) => r.phase === 'remainder')
const cascadeIds = proof.jointlyRequiredRemainderRecords

const manifest = (r: Record<string, unknown>) => ({
  recordId: r.recordId,
  revisionSha256: r.revisionSha256,
  auditSha256: r.auditSha256,
  reviewBundleDigest: r.reviewBundleDigest,
  reviewAxes: r.reviewAxes,
  releaseClassification: r.declaredClassification,
  predecessorReleaseId: (r.productionActiveRelease as { releaseId?: string } | null)?.releaseId ?? null,
  canonicalRoute: r.canonicalRoute,
  sourceBinding: r.sourceBinding,
  operationId: r.operationId,
  unlocksCascade: cascadeIds.includes(String(r.recordId)),
})

const plan = {
  schemaVersion: 'maha-production-operating-plan/1.0',
  preparedAt: '2026-09-02',
  executed: false,
  authorized: false,
  baselineNote: `Totals are stated against the observed live sitemap of ${OBSERVED_LIVE}. The 764 figure in the scaling observation predates the eighth open book (+18), an ExactZK evidence page and /knowledge/integrations (+2), and the eight source references (+8).`,
  reviewTier: { reviewerKind: 'automated-internal-editorial', ...REVIEW_TIERS['automated-internal-editorial'] },
  phases: [
    {
      phase: 'A',
      name: 'five-record canary',
      records: canary.length,
      expectedDirectRoutes: 5,
      expectedSourceCascade: 0,
      cascadeNote: 'None of the four records that unlock 10.1038/s41580-020-00313-x is in this phase, so the source-page count does not move.',
      publicTotalBefore: OBSERVED_LIVE,
      publicTotalAfter: OBSERVED_LIVE + 5,
      originalPlanStated: '772 -> 777, computed from the stale baseline',
      initialCount: canary.filter((r) => r.declaredClassification === 'initial').length,
      supersedingCount: canary.filter((r) => r.declaredClassification !== 'initial').length,
      manifest: canary.map(manifest),
    },
    {
      phase: 'B',
      name: 'twenty-eight-record remainder',
      records: remainder.length,
      expectedDirectRoutes: 28,
      expectedSourceCascade: 1,
      cascadeNote: 'The four jointly-required records all sit in this phase. The source page appears once the last of them releases, not before.',
      publicTotalBefore: OBSERVED_LIVE + 5,
      publicTotalAfter: OBSERVED_LIVE + 5 + 28 + 1,
      originalPlanStated: '777 -> 806, computed from the stale baseline',
      initialCount: remainder.filter((r) => r.declaredClassification === 'initial').length,
      supersedingCount: remainder.filter((r) => r.declaredClassification !== 'initial').length,
      manifest: remainder.map(manifest),
    },
  ],
  expectedSitemapChanges: {
    afterPhaseA: { added: 5, sourceRoutesAdded: 0, total: OBSERVED_LIVE + 5 },
    afterPhaseB: { added: 29, sourceRoutesAdded: 1, total: OBSERVED_LIVE + 34 },
    llmsTxtMirrorsSitemap: true,
    note: 'llms.txt and the sitemap call the same eligibility function, so they move together or the release is wrong.',
  },
  replayBehaviour: {
    sameRecordSameRevision: 'Produces the identical operation id and is recognised as already applied. Not re-released.',
    sameRecordDriftedRevision: 'Produces a different operation id, which matches no prepared operation and is refused as unrecognised rather than released under the old review.',
    partialPhase: 'Operations are independent per record. A phase that stops halfway leaves released records released and unreleased records untouched; no aggregate page appears until its whole claim set is released.',
  },
  controls: {
    staleRevision: 'Every operation id binds record identity to the exact revision digest. A record edited after this plan was frozen cannot be released by it.',
    unreleasedClaims: 'The aggregate gate refuses a source page while any bound claim is unreleased. It is not relaxed for either phase.',
    tierHonesty: 'The tier asserts no human, expert, independent or external review. A release that claimed otherwise would contradict the bundle it carries.',
    authoritySeparation: 'Review does not confer release authority. Executing either phase needs a separate authorization this plan does not contain.',
    canaryFirst: 'Phase B must not begin until Phase A is verified live.',
  },
  rollback: {
    mechanism: 'Withdrawal, not deletion. A withdrawal row supersedes the release and the record leaves the public surface.',
    cascadeEffect: 'Withdrawing any one of the four cascade records removes the source page immediately, proved exhaustively over all four single-withdrawal cases.',
    order: 'Withdraw in reverse release order. Withdraw the cascade-completing record first if the intent is to retract only the source page while keeping record routes live.',
    verification: 'After a withdrawal, the sitemap count must fall by exactly the number of withdrawn routes plus any aggregate page they were sustaining.',
  },
  sanitizedEvidenceContract: {
    published: ['record id', 'canonical route', 'release classification', 'released claim statements', 'source identity and locator'],
    withheld: ['reviewer packets', 'inspection passages', 'internal decision rationale', 'release authority attribution', 'operator identity'],
    secretsIncluded: false,
    note: 'No credential, token or authority value appears in this plan or in any artifact it references.',
  },
  boundary: 'A prepared, unauthorized, unexecuted plan. It creates no release row and promotes no record.',
  planDigest: '',
}
plan.planDigest = sha({ ...plan, planDigest: '' })
writeFileSync('content/source-cluster/production-operating-plan.json', `${JSON.stringify(plan, null, 2)}\n`)
process.stdout.write(`${JSON.stringify({
  phases: plan.phases.map((p) => ({ phase: p.phase, records: p.records, directRoutes: p.expectedDirectRoutes,
    cascade: p.expectedSourceCascade, total: `${p.publicTotalBefore} -> ${p.publicTotalAfter}`,
    initial: p.initialCount, superseding: p.supersedingCount })),
  digest: plan.planDigest }, null, 2)}\n`)
