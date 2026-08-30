import { readFileSync } from 'node:fs'

import {
  BATCH_11_LINEAGE_DECLARATIONS,
  reconcileLineage,
  type RegistryObservation,
} from '../lib/batch-11-mixed-lineage-release.ts'
import {
  BATCH_11_REMOTE_REHEARSAL_VERSION,
  KNOWN_RELEASE_STATUSES,
  REQUIRED_PREVIEW_INVARIANTS,
  gateRecord,
  probeLineage,
  proveOrderIndependence,
  rehearsalPlanDigest,
  type RegistryProbeInput,
} from '../lib/batch-11-remote-rehearsal.ts'

/**
 * Batch 11 mixed-lineage remote Preview rehearsal.
 *
 * Three independent locks stand between running this and touching anything
 * remote: an authorization flag, an exact operation name, and an exact
 * confirmation phrase. All three must be present and correct. Any one missing
 * produces a dry run that performs nothing.
 *
 * Production is read-only here by construction: this script has no Production
 * write path at all, not merely an unused one.
 */

const OPERATION = 'batch-11-mixed-lineage-preview-rehearsal'
const CONFIRMATION = 'rehearse-batch-11-mixed-lineage-in-preview-only'

const authorized = process.env.MAHA_B11_REMOTE_AUTHORIZED === '1'
const operation = process.env.MAHA_B11_OPERATION ?? ''
const confirmation = process.env.MAHA_B11_CONFIRMATION ?? ''

const observation = JSON.parse(
  readFileSync('content/frontier-alignment/batch-11-registry-observation.json', 'utf8'),
) as RegistryObservation

const probeInput: RegistryProbeInput = {
  observation,
  totalRegistryRows: observation.totalReleasesInRegistry,
  statusVocabulary: [...KNOWN_RELEASE_STATUSES],
}

const manifest = reconcileLineage(observation)
const gates = BATCH_11_LINEAGE_DECLARATIONS.map((declaration) =>
  gateRecord(probeLineage(declaration.recordId, probeInput), declaration.declaredReleaseKind),
)
const ordering = proveOrderIndependence(BATCH_11_LINEAGE_DECLARATIONS.map((d) => d.recordId), gates)
const planDigest = rehearsalPlanDigest(manifest, gates)

/** Bounded, non-reversible summary. No identifier, token or source text. */
const fingerprint = {
  schemaVersion: BATCH_11_REMOTE_REHEARSAL_VERSION,
  cohortSize: gates.length,
  readyCount: gates.filter((gate) => gate.ready).length,
  supersedingCount: gates.filter((gate) => gate.declaredKind === 'superseding').length,
  initialCount: gates.filter((gate) => gate.declaredKind === 'initial').length,
  probeStates: gates.map((gate) => gate.probeState).sort(),
  ordersProvenIndependent: ordering.ordersTested,
  orderIndependent: ordering.independent,
  planDigest,
}

const emit = (payload: Record<string, unknown>) => {
  process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`)
}

if (!authorized || operation !== OPERATION || confirmation !== CONFIRMATION) {
  const refused = authorized && (operation !== OPERATION || confirmation !== CONFIRMATION)
  emit({
    mode: refused ? 'refused' : 'dry-run',
    reason: refused
      ? 'Authorization was set but the operation name or confirmation phrase did not match exactly.'
      : 'MAHA_B11_REMOTE_AUTHORIZED is not set to 1.',
    remoteOperationsPerformed: 0,
    previewBranchCreated: false,
    migrationsApplied: 0,
    productionWritesPerformed: 0,
    credentialsPresented: 0,
    fingerprint,
    requiredInvariants: REQUIRED_PREVIEW_INVARIANTS,
    plannedPhases: [
      'create an ephemeral schema-only Preview branch',
      'import only the four immutable prior-release lineages using read-only Production access',
      'apply only the migrations this lifecycle requires',
      'ingest the five proposed revisions and their twenty exact-revision decisions',
      'issue five releases using Preview-only release authority',
      'verify the four superseding transitions and the one initial transition independently',
      'destroy the ephemeral branch and revoke temporary credentials',
    ],
  })
  process.exit(0)
}

// Authorized. The remote implementation is intentionally not reachable from
// this change: a rehearsal that half-runs is worse than one that refuses, and
// the remote half has not been reviewed.
emit({
  mode: 'authorized-but-unimplemented',
  reason:
    'All three locks were satisfied, but the remote phases are not implemented in this change and must be reviewed before they can run. Nothing was executed.',
  remoteOperationsPerformed: 0,
  previewBranchCreated: false,
  migrationsApplied: 0,
  productionWritesPerformed: 0,
  credentialsPresented: 0,
  fingerprint,
})
process.exit(3)
