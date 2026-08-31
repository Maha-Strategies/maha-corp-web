import { mkdirSync, writeFileSync } from 'node:fs'

import { buildBoundEvidence } from '../lib/batch-11-evidence-binding.ts'
import { repositoryContract } from '../lib/batch-11-evidence-verifier.ts'
import { BATCH_11_LINEAGE_DECLARATIONS } from '../lib/batch-11-mixed-lineage-release.ts'
import { PHASE_ORDER } from '../lib/batch-11-rehearsal-phases.ts'
import {
  TEARDOWN_RESOURCE_KINDS,
  produceTeardownObservations,
  type ProviderQueryResult,
} from '../lib/batch-11-teardown-observations.ts'

/**
 * A synthetic, compliant run for exercising the whole chain.
 *
 * This is NOT evidence of a rehearsal. No rehearsal has produced it, and the
 * `syntheticFixture` marker exists so it can never be mistaken for one.
 *
 * It carries the full path - bound rehearsal evidence, sanitized provider
 * results, the observations produced from them - because a verifier that has
 * only ever seen failing input is not known to accept anything, and "refuses
 * everything" is not the property being built.
 */

const contract = repositoryContract()
const REVIEWED_COMMIT = 'b'.repeat(40)
const RUN_MARKER = 'batch-11-mixed-lineage-rehearsal-77'

const bound = buildBoundEvidence({
  expectedReviewedCommit: REVIEWED_COMMIT,
  checkedOutCommit: REVIEWED_COMMIT,
  workflowRunId: '77',
  planDigest: contract.planDigest,
  cohortRecordIds: BATCH_11_LINEAGE_DECLARATIONS.map((entry) => entry.recordId),
  lineageClassifications: BATCH_11_LINEAGE_DECLARATIONS.map((entry) => ({
    recordId: entry.recordId,
    expected: entry.declaredReleaseKind,
    observed: entry.declaredReleaseKind,
  })),
  phaseOutcomes: PHASE_ORDER.map((phase) => ({ phase, status: 'executed', mutations: 1 })),
  releaseIdentities: BATCH_11_LINEAGE_DECLARATIONS.map((entry, index) => ({
    recordId: entry.recordId,
    releaseId: `epirelease_synthetic${String(index).padStart(2, '0')}`,
    targetSha256: `sha256:${String(index).repeat(64).slice(0, 64)}`,
    releaseKind: entry.declaredReleaseKind,
    supersedesReleaseId: entry.declaredPriorReleaseId,
  })),
  replayedReleases: 0,
  deploymentMarker: { deploymentId: 'dpl_synthetic', origin: 'https://synthetic.vercel.app', reviewedCommit: REVIEWED_COMMIT },
  cleanup: { branchDestroyed: true, deploymentDestroyed: true, markerRemoved: true },
  requiredPhaseCount: PHASE_ORDER.length,
})

/** Sanitized authoritative query results, as an operator would supply them. */
const providerResults: ProviderQueryResult[] = TEARDOWN_RESOURCE_KINDS.map((kind) => ({
  provider: kind.split('-')[0],
  resourceKind: kind,
  queryStatus: 'succeeded',
  scope: 'exact-run-marker',
  runMarker: RUN_MARKER,
  reviewedCommit: REVIEWED_COMMIT,
  matches: [],
  detail: `Queried ${kind} at exact run-marker scope; no matching resource remained.`,
}))

const teardown = produceTeardownObservations({
  runMarker: RUN_MARKER,
  reviewedCommit: REVIEWED_COMMIT,
  results: providerResults,
})

const fixture = {
  syntheticFixture: true,
  note: 'Synthetic compliant run. Not evidence of any rehearsal; no protected run has occurred.',
  reviewedCommit: REVIEWED_COMMIT,
  runMarker: RUN_MARKER,
  providerResults,
  artifact: {
    ...bound,
    mode: 'executed',
    reason: `All ${PHASE_ORDER.length} phases executed against an ephemeral Preview branch.`,
    remoteOperationsPerformed: 14,
    previewBranchCreated: true,
    previewBranchDestroyed: true,
    previewDeploymentCreated: true,
    previewDeploymentDestroyed: true,
    migrationsApplied: 1,
    releasesIssued: 5,
    replayedReleases: 0,
    productionWritesPerformed: 0,
    productionAccess: {
      kind: 'public-https-get',
      url: 'https://www.mahastrategies.com/knowledge/epistemic-system/releases/registry.json',
      credentialPresented: false,
    },
    phases: PHASE_ORDER.map((phase) => ({ phase, status: 'executed', detail: 'Phase completed.', mutations: 1 })),
    fingerprint: {
      schemaVersion: 'maha-batch-11-remote-rehearsal/1.0',
      cohortSize: contract.recordIds.length,
      readyCount: contract.recordIds.length,
      supersedingCount: contract.supersedingCount,
      initialCount: contract.initialCount,
      ordersProvenIndependent: 120,
      orderIndependent: true,
      planDigest: contract.planDigest,
    },
  },
  teardown: {
    reviewedCommit: REVIEWED_COMMIT,
    runMarker: RUN_MARKER,
    observations: teardown.observations,
    observationsDigest: teardown.observationsDigest,
  },
}

mkdirSync('test/fixtures', { recursive: true })
writeFileSync('test/fixtures/batch-11-compliant-artifact.json', `${JSON.stringify(fixture, null, 2)}\n`)
process.stdout.write('Wrote test/fixtures/batch-11-compliant-artifact.json\n')
