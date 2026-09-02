import { createHash } from 'node:crypto'
import { writeFileSync } from 'node:fs'

import { canonicalJson } from '../lib/evidence-dossier/digest.ts'
import observation from '../content/scaling/public-surface-observation.json' with { type: 'json' }
import pkg from '../content/source-cluster/production-release-package.json' with { type: 'json' }
import yieldReport from '../content/source-cluster/route-yield.json' with { type: 'json' }
import cohort from '../content/source-cluster/batch-1-cohort.json' with { type: 'json' }

/**
 * Capacity, split by whether a page can be reached today.
 *
 * The two columns are kept apart on purpose. Everything in the second column
 * depends on an operation that has been prepared and not executed, and an
 * unexecuted operation reaches no reader. Summing the columns would produce a
 * number that looks like a public surface and is not one.
 */

const sha = (value: unknown) => `sha256:${createHash('sha256').update(canonicalJson(value), 'utf8').digest('hex')}`
const liveSitemapPaths = observation.sitemapPaths.length
const liveSourcePages = observation.sitemapPaths.filter((p) => p.startsWith('/knowledge/sources/')).length

const pending = [
  {
    operation: 'merge-and-deploy-pr-355',
    kind: 'code-merge',
    executed: false,
    authorization: 'not-granted',
    addsPages: 8,
    note: 'Reviewed and green, and explicitly not merged in this sprint. The eight source routes exist only on a branch.',
  },
  {
    operation: 'release-33-record-production-package',
    kind: 'canonical-release',
    executed: false,
    authorization: 'not-granted',
    addsPages: pkg.expectedPublicEffect.newRecordRoutes + pkg.expectedPublicEffect.newSourceRoutes,
    note: 'Frozen and reverified against thirteen attributes. Requires release credentials this sprint did not use.',
  },
  {
    operation: 'source-cluster-closure-batch-1',
    kind: 'canonical-release',
    executed: false,
    authorization: 'not-granted',
    addsPages: 0,
    note: 'Its one surviving cluster is wholly contained in the 33-record package, so it adds nothing the package does not already add. Counted at zero rather than counted twice.',
  },
]

const reconciliation = {
  schemaVersion: 'maha-cluster-capacity-reconciliation/1.0',
  reconciledAt: '2026-09-02',
  currentlyReachable: {
    sitemapPaths: liveSitemapPaths,
    sourceReferencePages: liveSourcePages,
    basis: 'Observed public surface. These are the only pages a reader can open today.',
  },
  reachableAfterPreparedButUnexecutedOperations: {
    sitemapPaths: liveSitemapPaths + pending.reduce((n, op) => n + op.addsPages, 0),
    sourceReferencePages: liveSourcePages + 8 + pkg.expectedPublicEffect.newSourceRoutes,
    operations: pending,
    status: 'NOT LIVE. Every operation below is prepared and unexecuted, and none is authorized.',
  },
  doubleCountingAvoided: {
    check: 'Batch 1 overlaps the 33-record package entirely.',
    naiveSum: 8 + 34 + yieldReport.yield.find((y) => y.scenario === 'cluster-batch-1')!.newPages,
    honestSum: 8 + 34,
    difference: 1,
  },
  batch1Reconciliation: {
    clustersFrozen: cohort.clusters.length,
    clustersSurvivingInspection: yieldReport.clustersSurvivingInspection,
    recordsRemovedForLackOfSupport: yieldReport.recordsRemovedFromClusters,
    marginalPagesBeyondExistingPlans: 0,
    honestFinding: 'Batch 1 produced no marginal page. Its value was diagnostic: it established by direct reading that four of the five nearest clusters are blocked by records their sources do not support, which is a re-sourcing problem, not a release backlog.',
  },
  boundary: 'A private reconciliation. The second column is a projection of prepared work and must never be reported as the live surface.',
  reconciliationDigest: '',
}
reconciliation.reconciliationDigest = sha({ ...reconciliation, reconciliationDigest: '' })
writeFileSync('content/source-cluster/capacity-reconciliation.json', `${JSON.stringify(reconciliation, null, 2)}\n`)
process.stdout.write(`${JSON.stringify({
  live: reconciliation.currentlyReachable,
  afterPrepared: { sitemapPaths: reconciliation.reachableAfterPreparedButUnexecutedOperations.sitemapPaths, status: 'NOT LIVE' },
  doubleCounting: reconciliation.doubleCountingAvoided,
  batch1: reconciliation.batch1Reconciliation,
}, null, 2)}\n`)
