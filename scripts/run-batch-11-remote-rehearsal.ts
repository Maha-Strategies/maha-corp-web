import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

import {
  BATCH_11_LINEAGE_DECLARATIONS,
  assertDeclarationCoverage,
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
import {
  BRANCH_MANAGEMENT_CREDENTIAL,
  IMPORT_ALLOWLIST,
  PHASE_ORDER,
  PRODUCTION_REGISTRY_URL,
  PRODUCTION_SUPABASE_PROJECT_REF,
  REQUIRED_MIGRATIONS,
  RehearsalRefused,
  assertNoSecretShapedText,
  idempotencyKey,
  runRehearsal,
  type EphemeralBranch,
  type ImportedLineage,
  type ObservedTransition,
  type ProductionAccessDescriptor,
  type RehearsalDriver,
  type ReleaseRequest,
  type ReleaseResult,
} from '../lib/batch-11-rehearsal-phases.ts'

/**
 * Batch 11 mixed-lineage remote Preview rehearsal.
 *
 * Three independent locks stand between running this and touching anything
 * remote: an authorization flag, an exact operation name, and an exact
 * confirmation phrase. All three must be present and correct. Any one missing
 * produces a dry run that performs nothing.
 *
 * Production is read-only here by construction. The only Production access this
 * process has is an unauthenticated GET of a public JSON document; there is no
 * Production connection string, service-role key or release-authority token in
 * the environment this runs in, so a Production write is impossible rather than
 * merely prohibited.
 */

const OPERATION = 'batch-11-mixed-lineage-preview-rehearsal'
const CONFIRMATION = 'rehearse-batch-11-mixed-lineage-in-preview-only'
const MANAGEMENT_API = 'https://api.supabase.com'

const authorized = process.env.MAHA_B11_REMOTE_AUTHORIZED === '1'
const operation = process.env.MAHA_B11_OPERATION ?? ''
const confirmation = process.env.MAHA_B11_CONFIRMATION ?? ''
const previewOrigin = (process.env.MAHA_B11_PREVIEW_ORIGIN ?? '').replace(/\/$/, '')
const evidencePath = process.env.MAHA_B11_EVIDENCE_PATH?.trim()

// Inherited from the retired plan-only driver: the declarations must cover
// exactly the canary cohort, no more and no fewer. Checked before anything
// else so a cohort that drifted cannot reach a gate, let alone a release.
assertDeclarationCoverage()

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
  assertNoSecretShapedText(payload)
  const rendered = `${JSON.stringify(payload, null, 2)}\n`
  process.stdout.write(rendered)
  if (evidencePath) {
    mkdirSync(dirname(evidencePath), { recursive: true })
    writeFileSync(evidencePath, rendered)
  }
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
    plannedPhases: PHASE_ORDER,
  })
  process.exit(0)
}

// ---------------------------------------------------------------------------
// Authorized. Everything below performs the seven phases for real.
// ---------------------------------------------------------------------------

const managementToken = process.env[BRANCH_MANAGEMENT_CREDENTIAL]?.trim() ?? ''
const parentRef = process.env.SUPABASE_PROJECT_REF?.trim() ?? ''
const dbPassword = process.env.SUPABASE_DB_PASSWORD?.trim() ?? ''
const operationsToken = process.env.EPISTEMIC_OPERATIONS_TOKEN?.trim() ?? ''
const authorityToken = process.env.EPISTEMIC_RELEASE_AUTHORITY_TOKEN?.trim() ?? ''
const bypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET?.trim() ?? ''

type Json = Record<string, unknown>

const object = (value: unknown, label: string): Json => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} must be an object.`)
  return value as Json
}
const array = (value: unknown, label: string): Json[] => {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array.`)
  return value.map((entry, index) => object(entry, `${label}[${index}]`))
}

/** Management API call. The token travels in a header, never in an argument. */
async function management(path: string, init: RequestInit = {}): Promise<unknown> {
  const response = await fetch(`${MANAGEMENT_API}${path}`, {
    ...init,
    headers: {
      ...(init.headers ?? {}),
      authorization: `Bearer ${managementToken}`,
      'content-type': 'application/json',
    },
    cache: 'no-store',
  })
  const text = await response.text()
  // The body is not echoed on failure: a Management API error can quote the
  // request, and the request carried a credential.
  if (!response.ok) throw new Error(`Management API ${init.method ?? 'GET'} ${path} returned ${response.status}.`)
  return text ? JSON.parse(text) : null
}

/** Preview-origin call. Tokens travel in headers only. */
async function preview(path: string, token: string | null, init: RequestInit = {}) {
  const headers = new Headers(init.headers)
  if (token) headers.set('authorization', `Bearer ${token}`)
  if (bypass) headers.set('x-vercel-protection-bypass', bypass)
  if (init.body) headers.set('content-type', 'application/json')
  const response = await fetch(`${previewOrigin}${path}`, { ...init, headers, cache: 'no-store', redirect: 'follow' })
  const text = await response.text()
  if (!response.ok) throw new Error(`${init.method ?? 'GET'} ${path} returned ${response.status}.`)
  let body: unknown = null
  try { body = text ? JSON.parse(text) : null } catch { body = text }
  return { status: response.status, body, text }
}

/**
 * Runs psql against the ephemeral branch.
 *
 * Connection details go through the environment, never through argv, so the
 * password never appears in the process list or in a shell history.
 */
function psql(branchEnv: NodeJS.ProcessEnv, args: readonly string[], input?: string): string {
  return execFileSync('psql', ['-v', 'ON_ERROR_STOP=1', '-At', ...args], {
    encoding: 'utf8',
    env: { ...process.env, ...branchEnv },
    input,
  })
}

let branchEnv: NodeJS.ProcessEnv = {}

const driver: RehearsalDriver = {
  branchCredentialPresent: () => managementToken.length > 0,
  parentProjectRef: () => parentRef,

  async createEphemeralBranch(name: string): Promise<EphemeralBranch> {
    const created = object(
      await management(`/v1/projects/${parentRef}/branches`, {
        method: 'POST',
        // No parent data is copied: the branch starts from schema alone.
        body: JSON.stringify({ branch_name: `${name}-${process.env.GITHUB_RUN_ID ?? 'local'}`, region: 'us-east-1' }),
      }),
      'created branch',
    )
    const branchId = String(created.id ?? created.branch_id ?? '')
    if (!branchId) throw new Error('The Management API did not return a branch id.')
    const detail = object(await management(`/v1/branches/${branchId}`), 'branch detail')
    branchEnv = {
      PGHOST: String(detail.db_host ?? ''),
      PGPORT: String(detail.db_port ?? '5432'),
      PGUSER: String(detail.db_user ?? 'postgres'),
      PGPASSWORD: String(detail.db_pass ?? dbPassword),
      PGDATABASE: 'postgres',
    }
    return {
      branchId,
      parentProjectRef: String(detail.parent_project_ref ?? parentRef),
      schemaOnly: true,
    }
  },

  async destroyEphemeralBranch(branchId: string): Promise<void> {
    await management(`/v1/branches/${branchId}`, { method: 'DELETE' })
    branchEnv = {}
  },

  productionAccess(): ProductionAccessDescriptor {
    return { kind: 'public-https-get', url: PRODUCTION_REGISTRY_URL, credentialPresented: false }
  },

  async readProductionLineages(): Promise<ImportedLineage[]> {
    // No credential, no body, no method other than GET.
    const response = await fetch(PRODUCTION_REGISTRY_URL, { method: 'GET', cache: 'no-store' })
    if (!response.ok) throw new Error(`The public Production registry returned ${response.status}.`)
    const releases = array(object(await response.json(), 'production registry').releases, 'production registry releases')
    return IMPORT_ALLOWLIST.map((allowed) => {
      const match = releases.filter((row) => row.recordId === allowed.recordId && row.releaseId === allowed.priorReleaseId)
      if (match.length !== 1) throw new Error(`${allowed.recordId}: expected exactly one predecessor in the public registry, found ${match.length}.`)
      return {
        recordId: allowed.recordId,
        releaseId: String(match[0].releaseId),
        targetSha256: String(match[0].targetSha256),
        status: String(match[0].status ?? 'active'),
      }
    })
  },

  async importLineages(_branch: EphemeralBranch, lineages: readonly ImportedLineage[]): Promise<void> {
    // psql expands :'var' only on its normal input path - a file or stdin. With
    // -c the tokens reach the server verbatim and fail with a syntax error, so
    // the statement goes in on stdin and the values arrive as -v variables,
    // quoted by psql rather than concatenated into SQL here.
    const sql =
      'insert into public.batch_11_rehearsal_imported_lineage (record_id, prior_release_id, prior_target_sha256) '
      + "values (:'B11_RECORD', :'B11_RELEASE', :'B11_DIGEST') on conflict (record_id) do nothing;\n"
    for (const row of lineages) {
      psql(
        branchEnv,
        ['-v', `B11_RECORD=${row.recordId}`, '-v', `B11_RELEASE=${row.releaseId}`, '-v', `B11_DIGEST=${row.targetSha256}`],
        sql,
      )
    }
  },

  async applyMigrations(_branch: EphemeralBranch, migrations: readonly string[]): Promise<string[]> {
    const applied: string[] = []
    for (const migration of migrations) {
      const path = join('supabase/migrations', migration)
      psql(branchEnv, ['--single-transaction', '-f', path])
      applied.push(migration)
    }
    return applied
  },

  async ingest(idempotency: string): Promise<{ decisionsRecorded: number }> {
    await preview('/api/admin/epistemic-ingestion', operationsToken, {
      method: 'POST',
      body: JSON.stringify({ adapterId: 'batch-11-mixed-lineage-rehearsal', idempotencyKey: idempotency }),
    })
    let decisionsRecorded = 0
    for (const declaration of BATCH_11_LINEAGE_DECLARATIONS) {
      const gate = gates.find((entry) => entry.recordId === declaration.recordId)
      if (!gate) throw new Error(`${declaration.recordId}: no gate.`)
      for (const scope of ['source-alignment', 'revision-integrity', 'projection-safety', 'lineage-continuity']) {
        await preview('/api/admin/epistemic-reviews', operationsToken, {
          method: 'POST',
          body: JSON.stringify({ recordId: declaration.recordId, scope, reviewTargetSha256: gate.proposedTargetSha256, decision: 'approve' }),
        })
        decisionsRecorded += 1
      }
    }
    return { decisionsRecorded }
  },

  async issueRelease(request: ReleaseRequest): Promise<ReleaseResult> {
    await preview('/api/admin/epistemic-releases', authorityToken, {
      method: 'POST',
      body: JSON.stringify({
        recordId: request.recordId,
        targetSha256: request.targetSha256,
        supersedesReleaseId: request.supersedesReleaseId,
        operation: 'preview',
        idempotencyKey: idempotencyKey('preview', request.targetSha256),
      }),
    })
    const response = await preview('/api/admin/epistemic-releases', authorityToken, {
      method: 'POST',
      body: JSON.stringify({
        recordId: request.recordId,
        targetSha256: request.targetSha256,
        supersedesReleaseId: request.supersedesReleaseId,
        operation: 'publish',
        idempotencyKey: request.idempotencyKey,
      }),
    })
    const body = object(response.body, `${request.recordId} published release`)
    const release = object(body.release, `${request.recordId} release`)
    return {
      recordId: request.recordId,
      releaseId: String(release.releaseId),
      targetSha256: String(release.targetSha256),
      replayed: body.replayed === true || body.created === false,
    }
  },

  async observeTransitions(): Promise<ObservedTransition[]> {
    const registry = object((await preview('/knowledge/epistemic-system/releases/registry.json', null)).body, 'preview registry')
    const releases = array(registry.releases, 'preview registry releases')
    return BATCH_11_LINEAGE_DECLARATIONS.map((declaration) => {
      const active = releases.filter((row) => row.recordId === declaration.recordId && row.status === 'active')
      if (active.length !== 1) throw new Error(`${declaration.recordId}: expected one active release, found ${active.length}.`)
      const prior = declaration.declaredPriorReleaseId
        ? releases.find((row) => row.releaseId === declaration.declaredPriorReleaseId)
        : undefined
      return {
        recordId: declaration.recordId,
        releaseKind: declaration.declaredReleaseKind,
        activeTargetSha256: String(active[0].targetSha256),
        supersededReleaseId: active[0].supersedesReleaseId ? String(active[0].supersedesReleaseId) : null,
        priorStillPresent: declaration.declaredPriorReleaseId === null ? true : prior !== undefined,
        priorStatus: prior ? String(prior.status) : null,
      }
    })
  },

  async fetchServedBundle(recordId: string): Promise<string> {
    const entry = manifest.entries.find((row) => row.recordId === recordId)
    if (!entry) throw new Error(`${recordId}: no canonical path in the lineage manifest.`)
    const html = (await preview(entry.canonicalPath, null)).text
    // The RSC flight payload can carry text the markup never renders, so it is
    // fetched and scanned as well rather than trusting the HTML alone.
    const flight = (await preview(`${entry.canonicalPath}?_rsc=b11`, null)).text
    return `${html}\n${flight}`
  },
}

try {
  if (parentRef === PRODUCTION_SUPABASE_PROJECT_REF) {
    throw new RehearsalRefused('production-project-targeted', 'provision-ephemeral-branch', 'SUPABASE_PROJECT_REF is the Production project.')
  }
  const outcome = await runRehearsal(driver, gates)
  emit({
    mode: 'executed',
    reason: `All ${outcome.phasesExecuted} phases executed against an ephemeral Preview branch.`,
    remoteOperationsPerformed: outcome.phases.reduce((total, phase) => total + phase.mutations, 0),
    previewBranchCreated: true,
    previewBranchDestroyed: outcome.branchDestroyed,
    migrationsApplied: REQUIRED_MIGRATIONS.length,
    releasesIssued: outcome.releasesIssued,
    replayedReleases: outcome.replayedReleases,
    productionWritesPerformed: 0,
    productionAccess: driver.productionAccess(),
    phases: outcome.phases,
    fingerprint,
    requiredInvariants: REQUIRED_PREVIEW_INVARIANTS,
    evidenceDigest: outcome.evidenceDigest,
  })
  process.exit(0)
} catch (error) {
  const refusal = error instanceof RehearsalRefused ? error : null
  emit({
    mode: 'refused',
    reason: refusal ? refusal.message : (error as Error).message,
    refusalCode: refusal?.code ?? 'unhandled-error',
    refusedAtPhase: refusal?.phase ?? null,
    remoteOperationsPerformed: 0,
    previewBranchCreated: false,
    migrationsApplied: 0,
    productionWritesPerformed: 0,
    fingerprint,
  })
  process.exit(1)
}
