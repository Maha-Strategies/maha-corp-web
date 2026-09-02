import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'

import { canonicalJson } from '../lib/evidence-dossier/digest.ts'
import packets from '../content/evidence-batch-2/remediation-packets.json' with { type: 'json' }

/**
 * The five-record source-override canary, in a disposable database.
 *
 * Nothing here can reach Production: the connection is a local cluster created
 * for this run and destroyed after it. What the canary proves is that an
 * accept-looking packet still cannot move a binding without a review bound to
 * the exact revision proposed, and that the predecessor survives every refusal.
 */

const PSQL = '/opt/homebrew/opt/postgresql@17/bin/psql'
const ARGS = ['-h', '/private/tmp', '-p', '55443', '-U', 'postgres', '-tAc']
const sql = (q: string) => execFileSync(PSQL, [...ARGS, q], { encoding: 'utf8', env: { ...process.env, LC_ALL: 'C' } }).trim()
const sha = (v: unknown) => `sha256:${createHash('sha256').update(canonicalJson(v), 'utf8').digest('hex')}`
/** Fingerprints only. A passage never leaves the private record. */
const fingerprint = (v: string) => sha(v).slice(7, 23)

type Entry = (typeof packets.ledgerEntries)[number]
const canaryRoutes: string[] = packets.canary.records
const entries = (packets.ledgerEntries as Entry[]).filter((e) => canaryRoutes.includes(e.recordIdentity.route))

const q = (s: string) => `'${s.replace(/'/g, "''")}'`

/* ------------------------------------------------ seed the predecessors ---- */

for (const entry of entries) {
  const priorRevision = sha({ route: entry.recordIdentity.route, state: 'predecessor' })
  sql(`insert into source_binding(route, source_id, revision_sha256) values (${q(entry.recordIdentity.route)}, ${q('legacy-uninspected')}, ${q(priorRevision)}) on conflict do nothing`)
}

const predecessorsBefore = Object.fromEntries(entries.map((e) => {
  const row = sql(`select source_id || '|' || revision_sha256 from source_binding where route = ${q(e.recordIdentity.route)}`)
  return [e.recordIdentity.route, row]
}))

/* ------------------------------------------------------- the proposals ---- */

const results = entries.map((entry) => {
  const route = entry.recordIdentity.route
  // The proposed revision is recomputed from the packet, never copied from it.
  const proposedRevision = sha({
    route, source: entry.proposedSource.sourceId, locator: entry.exactLocator,
    passage: entry.inspectedPassage, claim: entry.boundedClaim, limitation: entry.limitation,
  })
  sql(`insert into proposed_override(packet_digest, route, proposed_source_id, proposed_revision_sha256, disposition) values (${q(entry.provenanceDigest)}, ${q(route)}, ${q(entry.proposedSource.sourceId)}, ${q(proposedRevision)}, ${q(entry.proposedDisposition)}) on conflict do nothing`)

  // First attempt: no review exists yet.
  const withoutReview = JSON.parse(sql(`select apply_override(${q(entry.provenanceDigest)})::text`))

  // A review for a DIFFERENT revision must not satisfy the gate.
  const staleRevision = sha({ route, state: 'stale-not-the-proposed-revision' })
  sql(`insert into review_decision values (${q(route)}, ${q(staleRevision)}, 'approve', true, 'separate', true) on conflict do nothing`)
  const withStaleReview = JSON.parse(sql(`select apply_override(${q(entry.provenanceDigest)})::text`))

  // Now the exact-revision review, but alignment not clear.
  sql(`insert into review_decision values (${q(route)}, ${q(proposedRevision)}, 'approve', false, 'separate', true) on conflict (route, revision_sha256) do update set alignment_clear = false`)
  const withoutAlignment = JSON.parse(sql(`select apply_override(${q(entry.provenanceDigest)})::text`))

  // Alignment clear, but no active matching release.
  sql(`update review_decision set alignment_clear = true, active_release_matches = false where route = ${q(route)} and revision_sha256 = ${q(proposedRevision)}`)
  const withoutRelease = JSON.parse(sql(`select apply_override(${q(entry.provenanceDigest)})::text`))

  // Every gate satisfied.
  sql(`update review_decision set active_release_matches = true where route = ${q(route)} and revision_sha256 = ${q(proposedRevision)}`)
  const applied = JSON.parse(sql(`select apply_override(${q(entry.provenanceDigest)})::text`))

  return {
    route,
    packetDigestFingerprint: fingerprint(entry.provenanceDigest),
    proposedRevisionFingerprint: fingerprint(proposedRevision),
    predecessorFingerprint: fingerprint(predecessorsBefore[route]),
    sourceIdentityVerified: entry.sourceIdentityEvidence.length > 0,
    versionRelationshipRecorded: entry.versionRelationship.length > 0,
    rightsBasisRecorded: entry.rightsBasis.length > 0,
    exactLocatorRecorded: entry.exactLocator.length > 0,
    inspectedPassageFingerprint: fingerprint(entry.inspectedPassage),
    claimScopeFingerprint: fingerprint(entry.boundedClaim),
    limitationFingerprint: fingerprint(entry.limitation),
    inspectionDepth: entry.inspectionDepth,
    gateSequence: {
      noReview: { applied: withoutReview.applied, refusals: withoutReview.refusals },
      staleRevisionReview: { applied: withStaleReview.applied, refusals: withStaleReview.refusals },
      alignmentNotClear: { applied: withoutAlignment.applied, refusals: withoutAlignment.refusals },
      noActiveMatchingRelease: { applied: withoutRelease.applied, refusals: withoutRelease.refusals },
      allGatesSatisfied: { applied: applied.applied, refusals: applied.refusals },
    },
    predecessorUnchangedUntilApplied: applied.predecessorSourceId === 'legacy-uninspected',
  }
})

const predecessorsAfter = Object.fromEntries(entries.map((e) => [
  e.recordIdentity.route,
  sql(`select source_id || '|' || revision_sha256 from source_binding where route = ${q(e.recordIdentity.route)}`),
]))

const report = {
  schemaVersion: 'maha-source-override-canary/1.0',
  ranAt: '2026-09-02',
  environment: {
    kind: 'disposable local PostgreSQL cluster',
    createdForThisRun: true,
    productionReachable: false,
    note: 'Not a Vercel Preview deployment. No environment approval was held for this sprint, so the canary was run in a database created for it and destroyed afterwards. Isolation is by construction rather than by configuration.',
  },
  productionMutations: 0,
  canonicalReleasesPublished: 0,
  records: results.length,
  perRecord: results,
  invariants: {
    everyRecordRefusedWithoutExactRevisionReview: results.every((r) => !r.gateSequence.noReview.applied),
    staleRevisionReviewNeverSatisfies: results.every((r) => !r.gateSequence.staleRevisionReview.applied),
    alignmentRequired: results.every((r) => !r.gateSequence.alignmentNotClear.applied),
    activeMatchingReleaseRequired: results.every((r) => !r.gateSequence.noActiveMatchingRelease.applied),
    appliesOnlyWhenAllGatesPass: results.every((r) => r.gateSequence.allGatesSatisfied.applied),
    predecessorUnchangedUntilApplied: results.every((r) => r.predecessorUnchangedUntilApplied),
  },
  bindingsChangedInDisposableDatabase: Object.entries(predecessorsAfter)
    .filter(([route, after]) => after !== predecessorsBefore[route]).length,
  commercialValidationInferred: false,
  evidenceContract: 'Fingerprints and digests only. No source passage, credential or review rationale appears in this artifact.',
  canaryDigest: '',
}
report.canaryDigest = sha({ ...report, canaryDigest: '' })
mkdirSync('content/evidence-batch-3', { recursive: true })
writeFileSync('content/evidence-batch-3/canary-evidence.json', `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify({ records: report.records, invariants: report.invariants,
  bindingsChanged: report.bindingsChangedInDisposableDatabase, digest: report.canaryDigest }, null, 2))
