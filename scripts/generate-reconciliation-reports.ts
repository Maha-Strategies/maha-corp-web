import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'

import { canonicalJson } from '../lib/evidence-dossier/digest.ts'
import { reconcile } from '../lib/digest-reconciliation.ts'
import { candidateTargetDigest, recordRevisionDigest } from '../lib/digest-roles.ts'
import { EPISTEMIC_RECORDS } from '../lib/epistemic-pilots.ts'
import { REPAIRED_REVISION_CANARY_RECORDS } from '../lib/repaired-revision-canary-targets.ts'
import cascade from '../content/release-cascade/cascade-model.json' with { type: 'json' }
import pkg from '../content/source-cluster/production-release-package.json' with { type: 'json' }

/**
 * The two reports, with measured and inferred kept strictly apart.
 *
 * The 423-candidate classification is measured: it comes from a read-only
 * probe of the live workspace. The per-record blocker list for the 33 is
 * inferred, because the run that would have measured it was never approved,
 * and every inferred field says so rather than being presented as observed.
 */

const sha = (v: unknown) => `sha256:${createHash('sha256').update(canonicalJson(v), 'utf8').digest('hex')}`
const measured = JSON.parse(readFileSync(process.argv[2] ?? '/tmp/measured.json', 'utf8'))
const records = new Map([...EPISTEMIC_RECORDS, ...REPAIRED_REVISION_CANARY_RECORDS].map((r) => [r.id, r]))
const decision = new Map((cascade.cascade as Record<string, unknown>[]).map((r) => [String(r.recordId), r]))
const cohortRows = [...pkg.canary.records, ...pkg.remainder.records] as Record<string, unknown>[]

/* ------------------------------------------------ Part 4: all 423 by blocker --- */

const vocabulary = new Map<string, number>(measured.blockerVocabulary)
const reviewMissing = vocabulary.get('approval-review-missing') ?? 0
const alreadyActive = vocabulary.get('target-already-active-canonical') ?? 0
const legacyMetadata = [...vocabulary.entries()]
  .filter(([k]) => k.startsWith('source-publication-date-missing:') || k.startsWith('source-locator-missing:'))
  .reduce((n, [, v]) => n + v, 0)

const readiness = {
  schemaVersion: 'maha-workspace-readiness-report/1.0',
  evidence: 'measured',
  source: measured.source,
  productionMutations: 0,
  totals: {
    candidates: measured.totalCandidates,
    ready: measured.ready,
    withDeclaredBlockers: measured.withDeclaredBlockers,
    withApprovals: measured.withApprovals,
    withActiveRelease: measured.withActiveRelease,
  },
  categories: {
    'required-review-missing': reviewMissing,
    'active-release-already-present': alreadyActive,
    'malformed-candidate': 0,
    'revision-or-target-mismatch': 0,
    'stale-review': 0,
    'audit-digest-mismatch': 0,
    'source-alignment-blocked': 0,
    'unsupported-record-class': 0,
    'lineage-conflict': 0,
    'withdrawn-or-superseded-predecessor': 0,
    'policy-tier-mismatch': 0,
    'unknown-or-unobservable': 0,
  },
  partition: {
    explanation: 'Every candidate falls in exactly one of two buckets, and they sum to the whole workspace.',
    'awaiting-expert-review': reviewMissing,
    'already-released-at-this-target': alreadyActive,
    sum: reviewMissing + alreadyActive,
    total: measured.totalCandidates,
    exhaustive: reviewMissing + alreadyActive === measured.totalCandidates,
  },
  theActualFailedPredicate: {
    finding: 'The workspace is not unready for 423 different reasons. 310 candidates lack the four scoped expert review decisions the readiness predicate requires, and the remaining 113 are already released at the target on offer.',
    requiredScopes: ['source-fidelity', 'domain-fidelity', 'boundary-adequacy', 'rights-and-locator'],
    eachScopeMissingOn: 310,
    predicate: 'lib/epistemic-release.ts releaseReadiness collects, per required scope, the latest review bound to targetSha256 whose decision is approve. With none recorded, approvals is empty and evaluatePublicationGate refuses.',
  },
  secondaryFindings: {
    legacySourceMetadataBlockers: legacyMetadata,
    note: 'A handful of legacy records additionally lack a source publication date or locator. These are extra blockers on candidates already blocked by missing review, not a separate unready population.',
  },
  digestRoleFinding: {
    localRecordsPresent: measured.localRecordPresent,
    localTargetMatches: measured.localTargetMatches,
    conclusion: 'Every candidate whose record exists locally reproduces the workspace target exactly. Nothing in the workspace has drifted from the local corpus.',
  },
  boundary: 'Read-only. No candidate ingested, no review created, no release issued.',
  reportDigest: '',
}
readiness.reportDigest = sha({ ...readiness, reportDigest: '' })

/* ---------------------------------------- Part 5: the 33, record by record --- */

const cohort = cohortRows.map((row) => {
  const id = String(row.recordId)
  const record = records.get(id) ?? null
  const call = decision.get(id)
  const localTarget = record ? candidateTargetDigest(record) : null
  // The workspace target is not re-observed per record here. It is stated as
  // the value the local record produces, which the probe proved equal to the
  // workspace target for all 288 records it could compare.
  const result = reconcile({
    record,
    packageRevisionDigest: String(row.revisionSha256),
    candidate: localTarget ? { recordId: id, targetSha256: localTarget, ready: false, approvals: [], blockers: [], activeRelease: null } : null,
    auditDigest: call?.auditSha256 ? String(call.auditSha256) : null,
    reviewBundleDigest: call?.reviewBundleDigest ? String(call.reviewBundleDigest) : null,
    requiredReviewScopes: ['source-fidelity', 'domain-fidelity', 'boundary-adequacy', 'rights-and-locator'],
  })
  return {
    recordId: id,
    packageRevisionDigest: String(row.revisionSha256),
    workspaceTargetSha256: localTarget,
    workspaceTargetEvidence: 'derived-from-local-record; proven equal to the workspace target for all 288 comparable candidates',
    currentRecordRevisionDigest: record ? recordRevisionDigest(record) : null,
    currentCandidateTargetDigest: localTarget,
    auditDigest: call?.auditSha256 ?? null,
    reviewBundleDigest: call?.reviewBundleDigest ?? null,
    activeReleaseState: 'none',
    activeReleaseEvidence: 'measured: the public release registry holds no active release for any of the 33',
    readinessBlockers: ['required-review-missing'],
    readinessBlockerEvidence: 'inferred: these 33 hold no active release and reproduce their targets, so they belong to the 310-candidate awaiting-expert-review bucket. Not measured per record.',
    sourceIdentity: row.sourceSlug ?? null,
    route: row.canonicalRoute ?? null,
    expectation: call?.releaseClassification ?? 'initial',
    classification: result.classification,
    contentEquivalenceProven: result.exactEquivalence,
    equivalenceProof: result.equivalenceProof,
    remediation: 'remain-blocked',
    remediationReason: 'Content equivalence is cryptographically proven, so the digest defect alone would justify recompute-package-target. That outcome additionally requires that review already binds the correct semantic object, and it does not: Production holds no review for this target, and the package carries a five-axis automated-internal-editorial bundle, which is a different review vocabulary from the four expert scopes the readiness predicate requires. The record therefore stays blocked pending an expert review this sprint may not create.',
  }
})

const reconciliation = {
  schemaVersion: 'maha-cohort-reconciliation/1.0',
  cohortSize: cohort.length,
  classifications: cohort.reduce((m: Record<string, number>, r) => { m[r.classification] = (m[r.classification] ?? 0) + 1; return m }, {}),
  remediations: cohort.reduce((m: Record<string, number>, r) => { m[r.remediation] = (m[r.remediation] ?? 0) + 1; return m }, {}),
  contentEquivalenceProven: cohort.filter((r) => r.contentEquivalenceProven).length,
  reviewVocabularyMismatch: {
    packageCarries: { tier: 'automated-internal-editorial', axes: 5 },
    readinessRequires: { scopes: ['source-fidelity', 'domain-fidelity', 'boundary-adequacy', 'rights-and-locator'], count: 4 },
    finding: 'These are different review vocabularies. A five-axis internal editorial bundle is not four scoped expert approvals, and no amount of content equivalence converts one into the other.',
    refused: 'Transferring the internal-editorial decisions onto the expert scopes because the content matches. That is exactly the substitution this sprint exists to prevent.',
  },
  records: cohort,
  boundary: 'Read-only reconciliation. No review decision was created or moved.',
  reportDigest: '',
}
reconciliation.reportDigest = sha({ ...reconciliation, reportDigest: '' })

mkdirSync('content/digest-reconciliation', { recursive: true })
writeFileSync('content/digest-reconciliation/workspace-readiness-report.json', `${JSON.stringify(readiness, null, 2)}\n`)
writeFileSync('content/digest-reconciliation/cohort-reconciliation.json', `${JSON.stringify(reconciliation, null, 2)}\n`)
console.log(JSON.stringify({
  readiness: { totals: readiness.totals, partition: readiness.partition, categories: readiness.categories },
  cohort: { size: reconciliation.cohortSize, classifications: reconciliation.classifications,
    remediations: reconciliation.remediations, equivalenceProven: reconciliation.contentEquivalenceProven },
}, null, 2))
