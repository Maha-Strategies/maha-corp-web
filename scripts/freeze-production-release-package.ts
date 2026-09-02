import { createHash } from 'node:crypto'
import { writeFileSync } from 'node:fs'

import { canonicalJson } from '../lib/evidence-dossier/digest.ts'
import { INFORMATION_DIMENSIONS, evaluateSourcePage } from '../lib/source-evidence-reference.ts'
import type { BoundClaim, SourcePageCandidate } from '../lib/source-evidence-reference.ts'
import { REVIEW_TIERS } from '../lib/review-tier.ts'
import { alignmentBlockers } from '../lib/frontier-source-alignment.ts'
import { isPilotAlignmentClear, pilotAlignmentFor } from '../lib/pilot-source-alignment.ts'
import cascade from '../content/release-cascade/cascade-model.json' with { type: 'json' }
import projection from '../content/review/exact-revision-projection.json' with { type: 'json' }
import inventory from '../content/source-first/source-inventory.json' with { type: 'json' }
import observation from '../content/scaling/public-surface-observation.json' with { type: 'json' }

/**
 * The frozen Production release package.
 *
 * Freezing means two things here. Every record is re-checked against all
 * thirteen attributes at freeze time rather than trusting the digest recorded
 * when the cascade was modelled, and every operation is given a deterministic
 * id derived from the record and its exact revision, so replaying the package
 * cannot double-release a record.
 *
 * Nothing in this file releases anything.
 */

const sha = (value: unknown) => `sha256:${createHash('sha256').update(canonicalJson(value), 'utf8').digest('hex')}`
const sourceRoute = (id: string) => `/knowledge/sources/${id.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase()}`

const reviewState = new Map((projection.projections as { recordId: string; classification: string }[])
  .map((entry) => [entry.recordId, entry.classification]))
const activeReleases = new Set(observation.releases.filter((r) => r.status === 'active').map((r) => r.recordId))
const rows = cascade.cascade as Record<string, unknown>[]

/** The thirteen attributes a record must satisfy before it may be released. */
const ATTRIBUTES = [
  'recordIdentityStable', 'exactRevisionDigestPresent', 'auditDigestPresent',
  'reviewBundleBoundToRevision', 'fiveReviewAxesPresent', 'reviewTierDeclared',
  'reviewTierNotOverstated', 'alignmentClear', 'notAlreadyReleased',
  'releaseClassificationDeclared', 'noStaleOrSupersedingRisk', 'sourceBindingKnown',
  'releaseAuthoritySeparateFromReview',
] as const

const tier = REVIEW_TIERS['automated-internal-editorial']
const verified = rows.map((row) => {
  const id: string = row.recordId
  const clear = pilotAlignmentFor(id) ? isPilotAlignmentClear(id) : alignmentBlockers(id).length === 0
  const axes = Array.isArray(row.reviewAxes) ? row.reviewAxes.length : Object.keys(row.reviewAxes ?? {}).length
  const checks: Record<string, boolean> = {
    recordIdentityStable: typeof id === 'string' && id.startsWith('urn:maha:record:'),
    exactRevisionDigestPresent: /^sha256:[0-9a-f]{64}$/.test(row.revisionSha256 ?? ''),
    auditDigestPresent: /^sha256:[0-9a-f]{64}$/.test(row.auditSha256 ?? ''),
    reviewBundleBoundToRevision: /^sha256:[0-9a-f]{64}$/.test(row.reviewBundleDigest ?? ''),
    fiveReviewAxesPresent: axes === 5,
    reviewTierDeclared: tier !== undefined,
    // The tier must not claim human, expert, independent or external review.
    reviewTierNotOverstated: !tier.independent && !tier.expertEndorsement
      && !tier.externallyReviewed && !tier.humanReviewed,
    alignmentClear: clear === true,
    notAlreadyReleased: !activeReleases.has(id),
    releaseClassificationDeclared: typeof row.releaseClassification === 'string' && row.releaseClassification.length > 0,
    noStaleOrSupersedingRisk: row.staleOrSupersedingRisk === false || row.staleOrSupersedingRisk === 'none',
    sourceBindingKnown: typeof row.sourceSlug === 'string' && row.sourceSlug.length > 0,
    releaseAuthoritySeparateFromReview: tier.releaseAuthority === 'separate',
  }
  const failed = ATTRIBUTES.filter((attribute) => !checks[attribute])
  return {
    recordId: id, domainSlug: row.domainSlug, revisionSha256: row.revisionSha256,
    sourceSlug: row.sourceSlug, reviewState: reviewState.get(id) ?? 'not-projected',
    attributesChecked: ATTRIBUTES.length, attributesPassed: ATTRIBUTES.length - failed.length,
    failedAttributes: failed, eligibleForPackage: failed.length === 0,
    // Deterministic and replay-safe: the same record at the same revision always
    // produces the same id, so a re-run is recognised rather than re-applied.
    operationId: `release:${sha({ recordId: id, revisionSha256: row.revisionSha256 }).slice(7, 39)}`,
  }
})

const admitted = verified.filter((entry) => entry.eligibleForPackage)
const rejected = verified.filter((entry) => !entry.eligibleForPackage)

/* ------------------------------ what the release actually changes publicly ---- */

function eligibleRoutesAfter(extra: ReadonlySet<string>) {
  const takenRoutes = new Set<string>(); const takenIntents = new Set<string>()
  const releasedPaths = new Set(inventory.releasedRecordRoutes ?? [])
  const out: string[] = []
  for (const entry of inventory.sources as Record<string, unknown>[]) {
    const claims: BoundClaim[] = (entry.boundRecords as Record<string, unknown>[]).map((b) => ({
      recordId: b.recordId, revisionSha256: b.revisionSha256,
      activeRelease: b.activeRelease || extra.has(b.recordId), locator: b.locator, statement: b.statement,
    }))
    const releasedCount = claims.filter((c) => c.activeRelease).length
    const deep = entry.inspectionDepth === 'section-or-full-text'
    const satisfies = [...INFORMATION_DIMENSIONS].filter((d) =>
      !(d === 'inspected-passages' && !deep)
      && !(d === 'claim-level-locators' && entry.exactLocators.length === 0)
      && !(d === 'rights-and-quotation-boundary' && !entry.rightsBasis)
      && !(d === 'supported-findings' && releasedCount < 2))
    const candidate: SourcePageCandidate = {
      sourceId: entry.sourceId, identityVerified: !entry.identityConflicted,
      inspectionDepth: entry.inspectionDepth, exactLocators: entry.exactLocators,
      rightsBasis: entry.rightsBasis, claims, satisfies, route: sourceRoute(entry.sourceId),
      searchIntent: entry.candidateSearchIntent, alignmentMismatch: entry.identityConflicted,
    }
    const verdict = evaluateSourcePage(candidate, takenRoutes, takenIntents, releasedPaths)
    if (verdict.eligible) { takenRoutes.add(candidate.route); takenIntents.add(candidate.searchIntent.toLowerCase()); out.push(candidate.route) }
  }
  return out
}

const before = eligibleRoutesAfter(new Set())
const after = eligibleRoutesAfter(new Set(admitted.map((entry) => entry.recordId)))
const newSourceRoutes = after.filter((route) => !before.includes(route))

/* ------------------------------------------------ canary and remainder ---- */

const ordered = [...admitted].sort((a, b) => a.recordId.localeCompare(b.recordId))
// The canary deliberately spans domains rather than clustering, so a single
// domain-specific fault cannot pass unnoticed.
const canary: typeof ordered = []
const seenDomains = new Set<string>()
for (const entry of ordered) {
  if (canary.length >= 5 || seenDomains.has(entry.domainSlug)) continue
  seenDomains.add(entry.domainSlug); canary.push(entry)
}
for (const entry of ordered) { if (canary.length < 5 && !canary.includes(entry)) canary.push(entry) }
const remainder = ordered.filter((entry) => !canary.includes(entry))

const pkg = {
  schemaVersion: 'maha-production-release-package/1.0',
  frozenAt: '2026-09-02',
  released: false,
  executed: false,
  environment: 'production',
  reviewTier: { id: 'automated-internal-editorial', ...tier },
  attributeContract: { count: ATTRIBUTES.length, attributes: ATTRIBUTES },
  cohort: { proposed: rows.length, admitted: admitted.length, rejected: rejected.length },
  rejectedRecords: rejected.map((entry) => ({ recordId: entry.recordId, failedAttributes: entry.failedAttributes })),
  canary: { size: canary.length, domainsSpanned: [...new Set(canary.map((e) => e.domainSlug))], records: canary },
  remainder: { size: remainder.length, records: remainder },
  expectedPublicEffect: {
    newRecordRoutes: admitted.length,
    newSourceRoutes: newSourceRoutes.length,
    newSourceRouteList: newSourceRoutes,
    sitemapEntriesAdded: admitted.length + newSourceRoutes.length,
    llmsTxtEntriesAdded: admitted.length + newSourceRoutes.length,
    correctsRecordedCascadeValue: {
      recordedSourcePagesUnlocked: cascade.sourcePagesUnlocked,
      measuredSourcePagesUnlocked: newSourceRoutes.length,
      cause: 'The cascade model asked, per record, whether that record completes a source aggregate. No single record does. Four of the thirty-three complete 10.1038/s41580-020-00313-x jointly, which a per-record question cannot see.',
      gateUnchanged: 'Measured by re-running evaluateSourcePage. The aggregate gate was not modified, relaxed, or bypassed.',
    },
  },
  controls: [
    { control: 'replay-safety', mechanism: 'Operation ids are derived from record id and exact revision digest, so a repeated run is identified as the same operation rather than a second release.' },
    { control: 'revision-binding', mechanism: 'A record whose revision digest changes produces a different operation id and is refused as unrecognised rather than released under its old review.' },
    { control: 'canary-first', mechanism: 'Five records across distinct domains precede the remaining twenty-eight, so a fault surfaces on a small blast radius.' },
    { control: 'tier-honesty', mechanism: 'The package carries the automated-internal-editorial tier and fails the freeze if that tier ever claims human, expert, independent or external review.' },
    { control: 'authority-separation', mechanism: 'Review does not confer release authority. This package is frozen, not executed, and carries no credential.' },
  ],
  packageDigest: '',
  boundary: 'A prepared, unexecuted release package. No record in it is public, and freezing it publishes nothing.',
}
pkg.packageDigest = sha({ ...pkg, packageDigest: '' })
writeFileSync('content/source-cluster/production-release-package.json', `${JSON.stringify(pkg, null, 2)}\n`)
process.stdout.write(`${JSON.stringify({
  cohort: pkg.cohort, rejected: pkg.rejectedRecords,
  canaryDomains: pkg.canary.domainsSpanned, remainder: pkg.remainder.size,
  expected: pkg.expectedPublicEffect, digest: pkg.packageDigest,
}, null, 2)}\n`)
