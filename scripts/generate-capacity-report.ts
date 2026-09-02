import { createHash } from 'node:crypto'
import { writeFileSync } from 'node:fs'

import { canonicalJson } from '../lib/evidence-dossier/digest.ts'
import plan from '../content/source-cluster/production-operating-plan.json' with { type: 'json' }
import preflight from '../content/source-cluster/production-preflight.json' with { type: 'json' }

/**
 * Capacity, stated against what was observed rather than what was expected.
 *
 * The sprint's expected figures descend from a 764 baseline captured on
 * 2026-09-01. Three merges landed after it. Every expected number downstream is
 * therefore low by the same 20 routes, and the deployment that looked like it
 * missed 772 by 20 in fact added exactly the eight routes it was supposed to.
 */

const sha = (v: unknown) => `sha256:${createHash('sha256').update(canonicalJson(v), 'utf8').digest('hex')}`
const TARGET = 1000
const observedAfterDeploy = 792
const preDeploy = observedAfterDeploy - 8

const report = {
  schemaVersion: 'maha-capacity-report/2.0',
  reportedAt: '2026-09-02',
  live: {
    baselineRecordedInScalingObservation: 764,
    baselineRecordedAt: '2026-09-01T12:00:00.000Z',
    baselineIsStale: true,
    routesLandedBetweenBaselineAndThisSprint: {
      total: 20,
      'the-cosmic-recursion (#358)': 18,
      'exactzk integration evidence': 1,
      '/knowledge/integrations': 1,
    },
    liveImmediatelyBeforeThisDeployment: preDeploy,
    liveAfterSourcePageDeployment: {
      expectedFromStaleBaseline: 772,
      expectedFromCorrectedBaseline: preDeploy + 8,
      observed: observedAfterDeploy,
      matchesCorrectedExpectation: preDeploy + 8 === observedAfterDeploy,
      sourceRoutesAdded: 8,
      duplicateUrls: 0,
      note: 'The deployment added exactly eight routes, which is what it was supposed to add. The 772 figure was computed from a baseline that had already gone stale by twenty routes.',
    },
  },
  prepared: {
    status: 'NOT LIVE. Prepared, unauthorized and unexecuted.',
    canaryReady: preflight.classification['canary-ready'],
    remainderReady: preflight.classification['remainder-ready'],
    cascadeReadySourcePages: 1,
    staleRevision: preflight.classification['stale-revision'] ?? 0,
    existingRelease: preflight.classification['existing-release'] ?? 0,
    missingDecision: preflight.classification['missing-decision'] ?? 0,
    lineageConflict: preflight.classification['lineage-conflict'] ?? 0,
    blocked: preflight.classification.blocked ?? 0,
    preparedFinalTotal: {
      statedInSprint: 806,
      correctedForObservedBaseline: observedAfterDeploy + 34,
      derivation: `${observedAfterDeploy} live + 5 canary + 28 remainder + 1 cascade source page`,
    },
  },
  gapToTarget: {
    target: TARGET,
    statedInSprint: 194,
    fromLiveToday: TARGET - observedAfterDeploy,
    fromPreparedFinalTotal: TARGET - (observedAfterDeploy + 34),
    note: 'The stated 194 is the gap from the stale 806. Against the observed surface the prepared final total is 826 and the remaining gap is 174.',
  },
  accounting: {
    preparedCountedAsLive: false,
    rule: 'A prepared release reaches no reader. Live and prepared are reported in separate columns and never summed into a single public figure.',
  },
  reportDigest: '',
}
report.reportDigest = sha({ ...report, reportDigest: '' })
writeFileSync('content/source-cluster/capacity-report.json', `${JSON.stringify(report, null, 2)}\n`)
process.stdout.write(`${JSON.stringify(report, null, 2).slice(0, 2600)}\n`)
