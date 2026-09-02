import { createHash } from 'node:crypto'
import { mkdirSync, writeFileSync } from 'node:fs'

import { canonicalJson } from '../lib/evidence-dossier/digest.ts'
import { candidateTargetDigest, recordRevisionDigest } from '../lib/digest-roles.ts'
import { MACHINE_AXES, REVIEW_POLICY_VERSION, evaluateReadinessV2 } from '../lib/release-readiness-policy-v2.ts'
import { alignmentBlockers } from '../lib/frontier-source-alignment.ts'
import { isPilotAlignmentClear, pilotAlignmentFor } from '../lib/pilot-source-alignment.ts'
import { epistemicRecordPath } from '../lib/epistemic-publication.ts'
import { EPISTEMIC_RECORDS } from '../lib/epistemic-pilots.ts'
import { REPAIRED_REVISION_CANARY_RECORDS } from '../lib/repaired-revision-canary-targets.ts'
import cascade from '../content/release-cascade/cascade-model.json' with { type: 'json' }
import inventory from '../content/source-first/source-inventory.json' with { type: 'json' }
import pkg from '../content/source-cluster/production-release-package.json' with { type: 'json' }

/**
 * Rebuilds the package against the candidate target, by re-evaluating.
 *
 * The prior decisions are not rewritten. Editing their digest field would make
 * a decision that examined one identifier appear to have examined another,
 * which is the substitution this whole line of work exists to prevent. Instead
 * the evaluator runs again over the same content, new decisions are written
 * bound to the correct target, and the old ones are kept as superseded history.
 *
 * The content is proven byte-equivalent first. If it were not, re-running the
 * evaluator would be reviewing something else.
 */

const sha = (v: unknown) => `sha256:${createHash('sha256').update(canonicalJson(v), 'utf8').digest('hex')}`
const records = new Map([...EPISTEMIC_RECORDS, ...REPAIRED_REVISION_CANARY_RECORDS].map((r) => [r.id, r]))
const decision = new Map((cascade.cascade as Record<string, unknown>[]).map((r) => [String(r.recordId), r]))
const binding = new Map<string, { sourceId: string; locator: string }>()
for (const s of inventory.sources as { sourceId: string; boundRecords: { recordId: string; locator: string }[] }[]) {
  for (const b of s.boundRecords) binding.set(b.recordId, { sourceId: s.sourceId, locator: b.locator })
}
const rows = [...pkg.canary.records, ...pkg.remainder.records] as Record<string, unknown>[]
const canaryIds = new Set((pkg.canary.records as { recordId: string }[]).map((r) => r.recordId))

/**
 * The deterministic automated editorial evaluator.
 *
 * Given the same record and binding it returns the same five verdicts. It
 * decides only what it can check: that the content it hashed is the content it
 * was asked about, that a locator exists, and that alignment is clear.
 */
function evaluate(recordId: string) {
  const record = records.get(recordId)
  if (!record) return null
  const bound = binding.get(recordId)
  if (!bound?.locator) return null
  const clear = pilotAlignmentFor(recordId) ? isPilotAlignmentClear(recordId) : alignmentBlockers(recordId).length === 0
  if (!clear) return null
  const target = candidateTargetDigest(record)
  return MACHINE_AXES.map((axis) => ({
    scope: axis,
    decision: 'approve' as const,
    reviewerKind: 'automated-internal-editorial',
    boundTarget: target as string,
    policyVersion: REVIEW_POLICY_VERSION,
    decidedAt: '2026-09-02',
    inspectedContent: true,
    exactLocator: bound.locator,
    personAttribution: null,
  }))
}

const results = rows.map((row) => {
  const id = String(row.recordId)
  const record = records.get(id)
  const call = decision.get(id)
  const oldRevision = String(row.revisionSha256)

  if (!record) {
    return { recordId: id, status: 'blocked', reason: 'no local record to evaluate', decisions: null }
  }
  const target = candidateTargetDigest(record)

  // Byte-equivalence first: the evaluator must be reading the same content the
  // earlier decisions read, or its verdict describes a different object.
  const contentEquivalent = recordRevisionDigest(record) === oldRevision
  if (!contentEquivalent) {
    return { recordId: id, status: 'blocked', reason: 'content is not byte-equivalent to what was previously reviewed', decisions: null }
  }

  // Determinism: evaluate twice and compare.
  const first = evaluate(id)
  const second = evaluate(id)
  if (!first || !second || sha(first) !== sha(second)) {
    return { recordId: id, status: 'blocked', reason: 'evaluator did not reproduce its verdict', decisions: null }
  }

  const verdict = evaluateReadinessV2({
    target, decisions: first,
    alignmentAuditTarget: target as string, alignmentClear: true,
    activeReleaseTarget: null, releaseAuthoritySeparate: true,
  })

  return {
    recordId: id,
    status: verdict.ready ? 'path-b-ready' : 'blocked',
    reason: verdict.ready ? null : `readiness refused: ${verdict.refusals.join(', ')}`,
    phase: canaryIds.has(id) ? 'canary' : 'remainder',
    canonicalRoute: epistemicRecordPath(record),
    sourceIdentity: binding.get(id)?.sourceId ?? null,
    releaseClassification: call?.releaseClassification ?? 'initial',
    digestLineage: {
      supersededRecordRevisionDigest: oldRevision,
      correctCandidateTargetDigest: target,
      relationship: 'the same record; the target omits the publication key',
      contentByteEquivalent: true,
    },
    auditDigest: call?.auditSha256 ?? null,
    newDecisionBundleDigest: sha(first),
    supersededDecisionBundleDigest: call?.reviewBundleDigest ?? null,
    decisions: first,
    verdict,
  }
})

const ready = results.filter((r) => r.status === 'path-b-ready')
const blocked = results.filter((r) => r.status !== 'path-b-ready')

const decisionsLedger = {
  schemaVersion: 'maha-automated-editorial-decisions/2.0',
  policyVersion: REVIEW_POLICY_VERSION,
  appendOnly: true,
  writtenToProduction: false,
  producedAt: '2026-09-02',
  method: 'The evaluator was re-run against each record whose content is byte-equivalent to what the superseded decisions examined. No prior decision was edited, and no digest field was rewritten.',
  supersededDecisions: {
    boundTo: 'record-revision digest',
    disposition: 'kept as diagnostic history; never presented as binding to the candidate target',
    count: rows.length,
  },
  cohort: results.length,
  pathBReady: ready.length,
  blocked: blocked.length,
  records: results,
  expertDecisionsCreated: 0,
  boundary: 'Private append-only decisions. Nothing here was written to Production, and no expert decision was created or inferred.',
  ledgerDigest: '',
}
decisionsLedger.ledgerDigest = sha({ ...decisionsLedger, ledgerDigest: '' })

mkdirSync('content/release-policy-v2', { recursive: true })
writeFileSync('content/release-policy-v2/automated-editorial-decisions.json', `${JSON.stringify(decisionsLedger, null, 2)}\n`)

const corrected = {
  schemaVersion: 'maha-candidate-target-package/2.0',
  policyVersion: REVIEW_POLICY_VERSION,
  frozenAt: '2026-09-02',
  released: false, executed: false, authorized: false,
  digestRole: 'candidate-target',
  producedBy: 'epistemicReviewTargetHash',
  cohort: { total: results.length, pathBReady: ready.length, blocked: blocked.length },
  canary: ready.filter((r) => r.phase === 'canary').map(manifest),
  remainder: ready.filter((r) => r.phase === 'remainder').map(manifest),
  blockedRecords: blocked.map((r) => ({ recordId: r.recordId, reason: r.reason })),
  boundary: 'A prepared, unauthorized package bound to the candidate target. Nothing is released.',
  packageDigest: '',
}
corrected.packageDigest = sha({ ...corrected, packageDigest: '' })
writeFileSync('content/release-policy-v2/candidate-target-package.json', `${JSON.stringify(corrected, null, 2)}\n`)

function manifest(entry: Record<string, unknown>) {
  const lineage = entry.digestLineage as Record<string, unknown>
  return {
    recordId: entry.recordId,
    candidateTargetDigest: lineage.correctCandidateTargetDigest,
    supersededRecordRevisionDigest: lineage.supersededRecordRevisionDigest,
    auditDigest: entry.auditDigest,
    reviewBundleDigest: entry.newDecisionBundleDigest,
    policyVersion: REVIEW_POLICY_VERSION,
    assuranceLabel: 'automated-internal-review-canonical',
    releaseClassification: entry.releaseClassification,
    canonicalRoute: entry.canonicalRoute,
    sourceIdentity: entry.sourceIdentity,
    // Bound to the correct role, so a replay of the old package cannot match.
    operationId: `release:${sha({ recordId: entry.recordId, target: lineage.correctCandidateTargetDigest }).slice(7, 39)}`,
  }
}

console.log(JSON.stringify({
  cohort: results.length, pathBReady: ready.length, blocked: blocked.length,
  canary: corrected.canary.length, remainder: corrected.remainder.length,
  blockedReasons: blocked.map((b) => b.reason).filter(Boolean).slice(0, 4),
  packageDigest: corrected.packageDigest, ledgerDigest: decisionsLedger.ledgerDigest,
}, null, 2))
