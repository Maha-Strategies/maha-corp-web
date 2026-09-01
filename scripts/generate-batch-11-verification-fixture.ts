import { mkdirSync, writeFileSync } from 'node:fs'

import {
  TEMPORARY_ENVIRONMENT_SECRET_NAMES,
  buildBoundEvidence,
  contractReleaseIdentities,
  environmentSecretSlotFingerprint,
  runMarkerFor,
  teardownHandleDigests,
  type ExactTeardownHandles,
} from '../lib/batch-11-evidence-binding.ts'
import { fingerprintCredential } from '../lib/batch-11-credential-provenance.ts'
import { REVOCABLE_CREDENTIALS, produceRevocationEvidence, type RevocationCheck } from '../lib/batch-11-revocation-evidence.ts'
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
const WORKFLOW_RUN_ID = '77'
const RUN_MARKER = runMarkerFor(WORKFLOW_RUN_ID)

const PROTECTED_ENVIRONMENT = 'batch-11-preview-rehearsal'
/** Stand-in values, never credentials. The fixture proves the wiring, not a run. */
const SYNTHETIC_BRANCH_MANAGEMENT = 'synthetic-branch-management-identity'
const SYNTHETIC_AUTOMATION_BYPASS = 'synthetic-automation-bypass-identity'

const releaseIdentities = contractReleaseIdentities().map((entry, index) => ({
  ...entry,
  releaseId: `epirelease_synthetic${String(index).padStart(2, '0')}`,
}))
const teardownHandles: ExactTeardownHandles = {
  schemaVersion: 'maha-batch-11-private-teardown-handles/1.0',
  workflowRunId: WORKFLOW_RUN_ID,
  runMarker: RUN_MARKER,
  reviewedCommit: REVIEWED_COMMIT,
  supabaseBranch: { branchId: 'branch_synthetic', parentProjectRef: 'staging_synthetic' },
  vercelPreview: { deploymentId: 'dpl_synthetic', origin: 'https://synthetic.vercel.app' },
  githubEnvironmentSecrets: { environment: 'batch-11-preview-rehearsal', names: TEMPORARY_ENVIRONMENT_SECRET_NAMES },
  databaseReleaseRows: { branchId: 'branch_synthetic', releaseIds: releaseIdentities.map((entry) => entry.releaseId) },
}

const bound = buildBoundEvidence({
  expectedReviewedCommit: REVIEWED_COMMIT,
  checkedOutCommit: REVIEWED_COMMIT,
  workflowRunId: WORKFLOW_RUN_ID,
  planDigest: contract.planDigest,
  cohortRecordIds: BATCH_11_LINEAGE_DECLARATIONS.map((entry) => entry.recordId),
  lineageClassifications: BATCH_11_LINEAGE_DECLARATIONS.map((entry) => ({
    recordId: entry.recordId,
    expected: entry.declaredReleaseKind,
    observed: entry.declaredReleaseKind,
  })),
  phaseOutcomes: PHASE_ORDER.map((phase) => ({ phase, status: 'executed', mutations: 1 })),
  // Derived from the repository contract. An arbitrary well-formed hash here
  // would be refused, which is the point of deriving them.
  releaseIdentities,
  replayedReleases: 0,
  deploymentMarker: { deploymentId: 'dpl_synthetic', origin: 'https://synthetic.vercel.app', reviewedCommit: REVIEWED_COMMIT },
  teardownHandles,
  cleanup: { branchDestroyed: true, deploymentDestroyed: true, markerRemoved: true },
  identities: {
    protectedEnvironment: PROTECTED_ENVIRONMENT,
    operationsIdentityFingerprint: fingerprintCredential('synthetic-operations-identity'),
    releaseAuthorityIdentityFingerprint: fingerprintCredential('synthetic-release-authority-identity'),
    // The same synthetic values the revocation checks below fingerprint, so the
    // fixture exercises the binding rather than sidestepping it.
    branchManagementIdentityFingerprint: fingerprintCredential(SYNTHETIC_BRANCH_MANAGEMENT),
    automationBypassIdentityFingerprint: fingerprintCredential(SYNTHETIC_AUTOMATION_BYPASS),
  },
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
  identifierFingerprint: teardownHandleDigests(teardownHandles)[kind],
  matches: [],
  detail: `Queried ${kind} at exact run-marker scope; no matching resource remained.`,
}))

const teardown = produceTeardownObservations({
  runMarker: RUN_MARKER,
  reviewedCommit: REVIEWED_COMMIT,
  expectedFingerprints: teardownHandleDigests(teardownHandles),
  results: providerResults,
})

/** Sanitized post-run revocation checks, as an operator would supply them. */
const revocationIdentity: Record<string, string> = {
  'supabase-access-token': fingerprintCredential(SYNTHETIC_BRANCH_MANAGEMENT),
  'vercel-automation-bypass': fingerprintCredential(SYNTHETIC_AUTOMATION_BYPASS),
  // No value exists to fingerprint; the slot is what is bound. Derived by the
  // same function the closure verifier uses, so a drift between them fails.
  'github-environment-secrets': environmentSecretSlotFingerprint({
    environment: PROTECTED_ENVIRONMENT,
    names: TEMPORARY_ENVIRONMENT_SECRET_NAMES,
    runMarker: RUN_MARKER,
    reviewedCommit: REVIEWED_COMMIT,
  }),
}

const revocationChecks: RevocationCheck[] = REVOCABLE_CREDENTIALS.map((credential) => ({
  provider: credential.split('-')[0],
  credential,
  checkStatus: 'succeeded',
  scope: credential === 'github-environment-secrets' ? 'exact-environment' : 'exact-credential-fingerprint',
  runMarker: RUN_MARKER,
  reviewedCommit: REVIEWED_COMMIT,
  credentialFingerprint: revocationIdentity[credential],
  stillResolves: false,
  selfReportedOnly: false,
  detail: `The ${credential} no longer resolves at the provider.`,
}))

const revocation = produceRevocationEvidence({
  runMarker: RUN_MARKER,
  reviewedCommit: REVIEWED_COMMIT,
  checks: revocationChecks,
})

const fixture = {
  syntheticFixture: true,
  note: 'Synthetic compliant run. Not evidence of any rehearsal; no protected run has occurred.',
  reviewedCommit: REVIEWED_COMMIT,
  workflowRunId: WORKFLOW_RUN_ID,
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
    // Credential provenance, as the runner now records it. Fingerprints only.
    credentialFingerprintMatched: true,
    poolerCapabilityPreflight: {
      version: 'maha-batch-11-credential-provenance/1.0',
      parentProjectRefFingerprint: fingerprintCredential('synthetic-parent-project-ref'),
      primaryHostFingerprint: fingerprintCredential('synthetic-pooler-host'),
      poolMode: 'session',
      databaseType: 'PRIMARY',
      status: 200,
    },
    mutationStartedAfterPreflight: true,
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
  // The producer's own report, verbatim. The verifier validates the whole
  // report; a hand-assembled list of observations is refused.
  teardown: { ...teardown, workflowRunId: WORKFLOW_RUN_ID },
  revocationChecks,
  revocation,
}

mkdirSync('test/fixtures', { recursive: true })
writeFileSync('test/fixtures/batch-11-compliant-artifact.json', `${JSON.stringify(fixture, null, 2)}\n`)
process.stdout.write('Wrote test/fixtures/batch-11-compliant-artifact.json\n')
