import { createHash } from 'node:crypto'
import { writeFileSync } from 'node:fs'

import { canonicalJson } from '../lib/evidence-dossier/digest.ts'
import { INFORMATION_DIMENSIONS, evaluateSourcePage } from '../lib/source-evidence-reference.ts'
import type { BoundClaim, SourcePageCandidate } from '../lib/source-evidence-reference.ts'
import inventory from '../content/source-first/source-inventory.json' with { type: 'json' }
import cascade from '../content/release-cascade/cascade-model.json' with { type: 'json' }
import cohort from '../content/source-cluster/batch-1-cohort.json' with { type: 'json' }
import inspections from '../content/source-cluster/batch-1-inspections.json' with { type: 'json' }

/**
 * Route yield per governed action, measured through the shipped gate.
 *
 * Every scenario re-runs evaluateSourcePage over the whole inventory with a
 * different set of records marked released. Nothing here estimates: a page is
 * counted only if the same function that serves the route returns eligible.
 */

const digest = (value: unknown) => `sha256:${createHash('sha256').update(canonicalJson(value), 'utf8').digest('hex')}`
const sourceRoute = (id: string) => `/knowledge/sources/${id.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase()}`

type Entry = (typeof inventory.sources)[number]
const sources = inventory.sources as Entry[]

function runGate(extraReleases: ReadonlySet<string>) {
  const takenRoutes = new Set<string>()
  const takenIntents = new Set<string>()
  const releasedPaths = new Set(inventory.releasedRecordRoutes ?? [])
  return sources.map((entry) => {
    const bound = entry.boundRecords as Record<string, unknown>[]
    const claims: BoundClaim[] = bound.map((b) => ({
      recordId: b.recordId, revisionSha256: b.revisionSha256,
      activeRelease: b.activeRelease || extraReleases.has(b.recordId),
      locator: b.locator, statement: b.statement,
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
      rightsBasis: entry.rightsBasis, claims, satisfies,
      route: sourceRoute(entry.sourceId), searchIntent: entry.candidateSearchIntent,
      alignmentMismatch: entry.identityConflicted,
    }
    const verdict = evaluateSourcePage(candidate, takenRoutes, takenIntents, releasedPaths)
    if (verdict.eligible) { takenRoutes.add(candidate.route); takenIntents.add(candidate.searchIntent.toLowerCase()) }
    return { sourceId: entry.sourceId, route: candidate.route, ...verdict }
  })
}

const removed = new Set((inspections.inspections as { recordId: string; clusterDisposition: string }[])
  .filter((entry) => entry.clusterDisposition === 'removed').map((entry) => entry.recordId))

// The one cluster whose open records all passed inspection before this batch.
const closable = (cohort.clusters as Record<string, unknown>[]).filter((cluster) =>
  cluster.openRecords.every((r: Record<string, unknown>) => r.alignmentClear && !removed.has(r.recordId)))
const clusterReleases = new Set(closable.flatMap((c) => c.openRecords.map((r: Record<string, unknown>) => r.recordId)))
const packageReleases = new Set((cascade.cascade as { recordId: string }[]).map((r) => r.recordId))

const scenarios = [
  { id: 'baseline', label: 'Today, nothing released', releases: new Set<string>(), actions: 0 },
  { id: 'package-33', label: 'The 33-record Production package released', releases: packageReleases, actions: 33 },
  { id: 'cluster-batch-1', label: 'Source-Cluster Closure Batch 1 as it survived inspection', releases: clusterReleases, actions: clusterReleases.size },
  { id: 'both', label: 'Package and cluster batch together', releases: new Set([...packageReleases, ...clusterReleases]), actions: 33 + clusterReleases.size },
].map((scenario) => {
  const verdicts = runGate(scenario.releases)
  const eligible = verdicts.filter((v) => v.eligible)
  return { ...scenario, releases: [...scenario.releases].sort(), eligiblePages: eligible.length, eligibleRoutes: eligible.map((v) => v.route) }
})

const base = scenarios[0].eligiblePages
const yieldTable = scenarios.slice(1).map((scenario) => ({
  scenario: scenario.id, label: scenario.label, governedActions: scenario.actions,
  eligiblePages: scenario.eligiblePages, newPages: scenario.eligiblePages - base,
  pagesPerGovernedAction: scenario.actions === 0 ? 0 : Number(((scenario.eligiblePages - base) / scenario.actions).toFixed(4)),
  newRoutes: scenario.eligibleRoutes.filter((route) => !scenarios[0].eligibleRoutes.includes(route)),
}))

const report = {
  schemaVersion: 'maha-source-cluster-yield/1.0',
  measuredWith: 'lib/source-evidence-reference.ts evaluateSourcePage, the same function the served route calls',
  baselineEligiblePages: base,
  clustersFrozen: cohort.clusters.length,
  clustersSurvivingInspection: closable.length,
  clustersLostToInspection: cohort.clusters.length - closable.length,
  recordsRemovedFromClusters: removed.size,
  yield: yieldTable,
  interpretation: [
    'The 33-record package is a release of records. It adds records to sources that still hold unreleased siblings, so it moves no source across the page gate.',
    'Batch 1 was chosen for the smallest honest deficit, and four of its five clusters still failed, because deficit counts distance in governed actions and cannot see whether the source actually supports the record until the source is read.',
    'The surviving yield is real but small. It is reported as measured rather than adjusted upward.',
  ],
  reportDigest: '',
}
report.reportDigest = digest({ ...report, reportDigest: '' })
writeFileSync('content/source-cluster/route-yield.json', `${JSON.stringify(report, null, 2)}\n`)
process.stdout.write(`${JSON.stringify({ baseline: base, survivingClusters: closable.map((c) => c.sourceId), yield: yieldTable }, null, 2)}\n`)
