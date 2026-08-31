import { mkdirSync, writeFileSync } from 'node:fs'

import { PHASE_ORDER } from '../lib/batch-11-rehearsal-phases.ts'
import { repositoryContract } from '../lib/batch-11-evidence-verifier.ts'

/**
 * A synthetic, compliant artifact for exercising the verifier.
 *
 * This is NOT evidence of a rehearsal. No rehearsal has produced it, and the
 * `syntheticFixture` marker exists so it can never be mistaken for one - a test
 * asserts the marker is present, and the verifier's own operator report carries
 * it through.
 *
 * It exists because a verifier that has only ever seen failing input is not
 * known to accept anything, and "refuses everything" is not the property being
 * built.
 */

const contract = repositoryContract()
const REVIEWED_COMMIT = 'b'.repeat(40)

const fixture = {
  syntheticFixture: true,
  note: 'Synthetic compliant artifact. Not evidence of any rehearsal; no protected run has occurred.',
  reviewedCommit: REVIEWED_COMMIT,
  artifact: {
    mode: 'executed',
    reason: `All ${PHASE_ORDER.length} phases executed against an ephemeral Preview branch.`,
    reviewedCommit: REVIEWED_COMMIT,
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
    cohortRecordIds: [...contract.recordIds],
    phases: PHASE_ORDER.map((phase) => ({ phase, status: 'executed', detail: 'Phase completed.', mutations: 1 })),
    fingerprint: {
      schemaVersion: 'maha-batch-11-remote-rehearsal/1.0',
      cohortSize: contract.recordIds.length,
      readyCount: contract.recordIds.length,
      supersedingCount: contract.supersedingCount,
      initialCount: contract.initialCount,
      probeStates: ['lineage-absent', 'lineage-absent', 'lineage-absent', 'lineage-present', 'lineage-present'],
      ordersProvenIndependent: 120,
      orderIndependent: true,
      planDigest: contract.planDigest,
    },
  },
  teardown: [
    {
      resourceKind: 'supabase-branch',
      identifierFingerprint: `sha256:${'1'.repeat(64)}`,
      observedState: 'confirmed-absent',
      detail: 'Branch list re-read after deletion; no branch carrying this run marker remained.',
    },
    {
      resourceKind: 'vercel-preview',
      identifierFingerprint: `sha256:${'2'.repeat(64)}`,
      observedState: 'confirmed-absent',
      detail: 'The deployment identifier no longer resolves.',
    },
  ],
}

mkdirSync('test/fixtures', { recursive: true })
writeFileSync('test/fixtures/batch-11-compliant-artifact.json', `${JSON.stringify(fixture, null, 2)}\n`)
process.stdout.write('Wrote test/fixtures/batch-11-compliant-artifact.json\n')
