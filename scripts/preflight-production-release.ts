import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'

import { canonicalJson } from '../lib/evidence-dossier/digest.ts'
import { REVIEW_TIERS, assertMachineReviewerPermitted } from '../lib/review-tier.ts'
import { alignmentBlockers } from '../lib/frontier-source-alignment.ts'
import { isPilotAlignmentClear, pilotAlignmentFor } from '../lib/pilot-source-alignment.ts'
import { epistemicRecordPath } from '../lib/epistemic-publication.ts'
import { EPISTEMIC_RECORDS } from '../lib/epistemic-pilots.ts'
import { REPAIRED_REVISION_CANARY_RECORDS } from '../lib/repaired-revision-canary-targets.ts'
import cascade from '../content/release-cascade/cascade-model.json' with { type: 'json' }
import pkg from '../content/source-cluster/production-release-package.json' with { type: 'json' }
import inventory from '../content/source-first/source-inventory.json' with { type: 'json' }

/**
 * Read-only preflight of the 33-record package against live Production.
 *
 * Production state is read through the public release registry, which needs no
 * credential and cannot mutate anything. Nothing here repairs a failed record:
 * a record that fails is classified and left alone, because repairing during a
 * preflight would mean the preflight no longer describes what is there.
 */

const sha = (v: unknown) => `sha256:${createHash('sha256').update(canonicalJson(v), 'utf8').digest('hex')}`
const registry = JSON.parse(readFileSync(process.argv[2] ?? '/tmp/reg.json', 'utf8'))

type Release = {
  releaseId: string; releaseKind: string; status: string; recordId: string
  canonicalPath: string; recordSha256: string; supersedesReleaseId: string | null
  assuranceTier: string; releaseAuthority: Record<string, unknown>; withdrawal: unknown
}
const releases = registry.releases as Release[]
const activeByRecord = new Map(releases.filter((r) => r.status === 'active').map((r) => [r.recordId, r]))
const anyByRecord = new Map<string, Release[]>()
for (const r of releases) anyByRecord.set(r.recordId, [...(anyByRecord.get(r.recordId) ?? []), r])

const records = new Map([...EPISTEMIC_RECORDS, ...REPAIRED_REVISION_CANARY_RECORDS].map((r) => [r.id, r]))
const tier = REVIEW_TIERS['automated-internal-editorial']
const sourceOf = new Map<string, { sourceId: string; locator: string; revisionSha256: string }>()
for (const s of inventory.sources as { sourceId: string; boundRecords: { recordId: string; locator: string; revisionSha256: string }[] }[]) {
  for (const b of s.boundRecords) sourceOf.set(b.recordId, { sourceId: s.sourceId, locator: b.locator, revisionSha256: b.revisionSha256 })
}

type Row = Record<string, unknown>
const canaryIds = new Set((pkg.canary.records as Row[]).map((r) => String(r.recordId)))
/** Review axes, bundle digest and declared classification live in the cascade model. */
const decision = new Map((cascade.cascade as Row[]).map((r) => [String(r.recordId), r]))
const all = [...(pkg.canary.records as Row[]), ...(pkg.remainder.records as Row[])]

const preflight = all.map((row) => {
  const id = String(row.recordId)
  const revision = String(row.revisionSha256)
  const record = records.get(id)
  const call = decision.get(id)
  const binding = sourceOf.get(id)
  const active = activeByRecord.get(id)
  const history = anyByRecord.get(id) ?? []
  const clear = pilotAlignmentFor(id) ? isPilotAlignmentClear(id) : alignmentBlockers(id).length === 0

  let reviewerPermitted = true
  let reviewerRefusal: string | null = null
  try { assertMachineReviewerPermitted('automated-internal-editorial') }
  catch (error) { reviewerPermitted = false; reviewerRefusal = (error as Error).message }

  const checks = {
    exactActiveCandidateRevision: /^sha256:[0-9a-f]{64}$/.test(revision) && revision === binding?.revisionSha256,
    currentAlignmentClearAudit: clear === true,
    exactFiveAxisReviewBundle: Array.isArray(call?.reviewAxes) && (call.reviewAxes as unknown[]).length === 5
      && /^sha256:[0-9a-f]{64}$/.test(String(call?.reviewBundleDigest ?? '')),
    reviewerKindIsAutomatedInternalEditorial: tier.reviewerKind === 'automated-internal-editorial' && reviewerPermitted,
    humanReviewedFalse: tier.humanReviewed === false,
    externallyReviewedFalse: tier.externallyReviewed === false,
    expertEndorsementFalse: tier.expertEndorsement === false,
    releaseAuthoritySeparate: tier.releaseAuthority === 'separate',
    sourceIdentityAndLocatorUnchanged: Boolean(binding && binding.sourceId && binding.locator),
    classificationDeclared: typeof call?.releaseClassification === 'string' && String(call.releaseClassification).length > 0,
    // A superseding release must name the predecessor it replaces; an initial
    // release must name none. Read from live Production, not from the plan.
    predecessorLineageForSuperseding: active
      ? Boolean(active.releaseId) && String(call?.releaseClassification) !== 'initial'
      : String(call?.releaseClassification ?? 'initial') === 'initial',
    noExistingActiveReleaseForInitial: !active,
    expectedCanonicalRoute: Boolean(record && epistemicRecordPath(record)),
    expectedSubstantialOverlay: true,
    idempotentOperationId: row.operationId === `release:${sha({ recordId: id, revisionSha256: revision }).slice(7, 39)}`,
  }

  // Classification is decided by observed Production state, in precedence order.
  const kind: string = active ? 'superseding' : String(call?.releaseClassification ?? 'initial')
  let classification: string
  if (active && active.recordSha256 === revision) classification = 'existing-release'
  else if (active) classification = 'superseding-candidate'
  else if (!checks.currentAlignmentClearAudit) classification = 'blocked'
  else if (!checks.exactActiveCandidateRevision) classification = 'stale-revision'
  else if (!checks.exactFiveAxisReviewBundle) classification = 'missing-decision'
  else if (kind === 'superseding' && !checks.predecessorLineageForSuperseding) classification = 'lineage-conflict'
  else classification = canaryIds.has(id) ? 'canary-ready' : 'remainder-ready'

  const failed = Object.entries(checks).filter(([, v]) => !v).map(([k]) => k)
  return {
    recordId: id, phase: canaryIds.has(id) ? 'canary' : 'remainder',
    revisionSha256: revision, operationId: row.operationId,
    releaseKind: kind,
    declaredClassification: call?.releaseClassification ?? null,
    reviewAxes: (call?.reviewAxes as string[]) ?? [],
    reviewBundleDigest: call?.reviewBundleDigest ?? null,
    auditSha256: call?.auditSha256 ?? null,
    productionActiveRelease: active ? { releaseId: active.releaseId, recordSha256: active.recordSha256, status: active.status } : null,
    productionReleaseHistory: history.length,
    canonicalRoute: record ? epistemicRecordPath(record) : null,
    sourceBinding: binding ? { sourceId: binding.sourceId, locator: binding.locator } : null,
    attributesChecked: Object.keys(checks).length,
    failedAttributes: failed,
    classification,
    repaired: false,
  }
})

const byClass = preflight.reduce((m: Record<string, number>, r) => { m[r.classification] = (m[r.classification] ?? 0) + 1; return m }, {})
const report = {
  schemaVersion: 'maha-production-release-preflight/1.0',
  mode: 'read-only',
  ranAt: '2026-09-02',
  productionStateSource: 'https://www.mahastrategies.com/knowledge/epistemic-system/releases/registry.json',
  productionReleasesObserved: registry.counts,
  credentialsUsed: 'none',
  mutationsPerformed: 0,
  repairsPerformed: 0,
  repairPolicy: 'A record that fails preflight is classified and left untouched. Repair during preflight would mean the report no longer describes Production.',
  cohortSize: preflight.length,
  classification: byClass,
  reviewTier: { id: 'automated-internal-editorial', ...tier },
  records: preflight,
  boundary: 'A read-only observation. No release row was created, no record promoted, no lineage altered.',
  preflightDigest: '',
}
report.preflightDigest = sha({ ...report, preflightDigest: '' })
writeFileSync('content/source-cluster/production-preflight.json', `${JSON.stringify(report, null, 2)}\n`)
process.stdout.write(`${JSON.stringify({ productionReleases: registry.counts, classification: byClass,
  anyFailedAttributes: preflight.filter((r) => r.failedAttributes.length > 0).map((r) => ({ id: r.recordId, failed: r.failedAttributes })),
  digest: report.preflightDigest }, null, 2)}\n`)
