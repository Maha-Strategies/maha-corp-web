import { readFileSync } from 'node:fs'

import {
  assertDeclarationCoverage,
  reconcileLineage,
  type LineageManifest,
  type RegistryObservation,
} from '../lib/batch-11-mixed-lineage-release.ts'

/**
 * Private Preview lineage rehearsal for the five Batch 11 records.
 *
 * DISABLED BY DEFAULT. Without MAHA_B11_REHEARSAL_AUTHORIZED=1 this performs the
 * entirely local reconciliation and prints the plan it *would* execute, then
 * exits. It creates no database, applies no migration, and presents no
 * credential. The remote half stays off until someone turns it on deliberately.
 *
 * The rehearsal exists to prove one thing the local manifest cannot: that a
 * mixed cohort - four superseding, one initial - moves through the real release
 * gate without the initial release being treated as a superseding one with a
 * missing parent, or the reverse.
 */

const AUTHORIZED = process.env.MAHA_B11_REHEARSAL_AUTHORIZED === '1'

assertDeclarationCoverage()
const observation = JSON.parse(
  readFileSync('content/frontier-alignment/batch-11-registry-observation.json', 'utf8'),
) as RegistryObservation
const manifest: LineageManifest = reconcileLineage(observation)

const blocked = manifest.entries.filter((entry) => !entry.ready)
if (blocked.length > 0) {
  console.error('Reconciliation is not clean; the rehearsal will not run.')
  for (const entry of blocked) console.error(`  ${entry.recordId}: ${entry.failures.join(', ')}`)
  process.exit(1)
}

/** What the remote half would assert, stated so it can be reviewed before it runs. */
const PLANNED_ASSERTIONS = [
  'All five records enter the release gate.',
  'The four superseding releases each bind their exact declared prior release id.',
  'The initial release binds no superseded target and carries supersedesReleaseId null.',
  'The publication queue admits a record only after its exact-revision release exists.',
  'A stale revision digest is refused at the gate.',
  'An older revision cannot render revised material.',
  'An unreleased revision stays out of the queue, the sitemap and llms.txt.',
  'Five routes, five provenance chains, five sitemap entries, five llms.txt entries and five registry entries converge on the same five exact revisions.',
] as const

if (!AUTHORIZED) {
  console.log(
    JSON.stringify(
      {
        mode: 'plan-only',
        reason: 'MAHA_B11_REHEARSAL_AUTHORIZED is not set to 1',
        remoteOperationsPerformed: 0,
        previewDatabaseCreated: false,
        migrationApplied: false,
        credentialPresented: false,
        cohort: manifest.totals,
        plannedAssertions: PLANNED_ASSERTIONS,
        requiredSecretNames: ['MAHA_PREVIEW_SUPABASE_URL', 'MAHA_PREVIEW_SUPABASE_SERVICE_ROLE', 'EPISTEMIC_RELEASE_AUTHORITY_TOKEN'],
        migrationScope: 'One additive migration creating only the Batch 11 rehearsal ingestion table and its RPC. No existing table is altered and no row outside the five records is touched.',
        cleanup: 'Drop the rehearsal schema and delete the Preview branch database. Production is never a target of this script.',
      },
      null,
      2,
    ),
  )
  process.exit(0)
}

// Authorized path. Left deliberately unimplemented rather than stubbed with
// something that looks like it worked: a rehearsal that silently no-ops would be
// worse than one that refuses.
console.error('Authorized rehearsal requested, but the remote half is not implemented in this change.')
console.error('It is gated here so that authorization alone cannot cause an unreviewed remote operation.')
process.exit(2)
