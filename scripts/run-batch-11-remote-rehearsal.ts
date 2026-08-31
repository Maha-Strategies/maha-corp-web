import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

import {
  TEMPORARY_PREVIEW_SECRET_NAMES,
  buildBoundEvidence,
  runMarkerFor,
  type ExactTeardownHandles,
} from '../lib/batch-11-evidence-binding.ts'
import { assertLineageFresh } from '../lib/batch-11-lineage-freshness.ts'
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
import {
  assertPrivatePreviewResponses,
  deriveEphemeralServiceRole,
  parseVercelDeploymentOutput,
  vercelDeploymentArguments,
} from '../lib/batch-11-preview-binding.ts'
import { batch11RevisionReviewInputs } from '../lib/batch-11-revision-canary.ts'
import { previewSessionPoolerEnvironment } from '../lib/batch-11-supabase-pooler.ts'

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
const VERCEL_SCOPE = 'mayonerajans-projects'

const authorized = process.env.MAHA_B11_REMOTE_AUTHORIZED === '1'
const operation = process.env.MAHA_B11_OPERATION ?? ''
const confirmation = process.env.MAHA_B11_CONFIRMATION ?? ''
let previewOrigin = ''
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
// Order independence is a property of a releasable cohort. Proving it requires
// simulating the lifecycle, and simulating a refused record would assert
// exactly what the gate denied, so it is not attempted when the cohort is
// blocked. A blocked cohort is reported as blocked, not as an ordering result.
const blockedGates = gates.filter((gate) => !gate.ready)
const ordering = blockedGates.length === 0
  ? proveOrderIndependence(BATCH_11_LINEAGE_DECLARATIONS.map((d) => d.recordId), gates)
  : {
    ordersTested: 0,
    finalStateDigests: [] as readonly string[],
    independent: false,
    detail: `Not attempted: ${blockedGates.length} of ${gates.length} records did not gate cleanly.`,
  }
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
    mode: refused ? 'refused' : blockedGates.length > 0 ? 'blocked' : 'dry-run',
    reason: refused
      ? 'Authorization was set but the operation name or confirmation phrase did not match exactly.'
      : blockedGates.length > 0
        ? `The cohort is not releasable: ${blockedGates.map((gate) => `${gate.recordId} (${gate.alignmentVerdict}: ${gate.failures.join(', ')})`).join('; ')}`
        : 'MAHA_B11_REMOTE_AUTHORIZED is not set to 1.',
    blockedRecords: blockedGates.map((gate) => ({
      recordId: gate.recordId,
      declaredKind: gate.declaredKind,
      alignmentVerdict: gate.alignmentVerdict,
      failures: gate.failures,
    })),
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
const operationsToken = process.env.EPISTEMIC_OPERATIONS_TOKEN?.trim() ?? ''
const authorityToken = process.env.EPISTEMIC_RELEASE_AUTHORITY_TOKEN?.trim() ?? ''
const bypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET?.trim() ?? ''
const vercelToken = process.env.VERCEL_TOKEN?.trim() ?? ''
const expectedReviewedCommit = process.env.MAHA_B11_REVIEWED_COMMIT?.trim() ?? ''
const checkedOutCommit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()

const lifecycleState = {
  /** Retained privately so teardown can query the exact branch after deletion. */
  branchHandle: null as { branchId: string; parentProjectRef: string } | null,
  /** Retained so the marker can be attested after it is deleted. */
  deploymentMarker: null as Record<string, unknown> | null,
  markerRemoved: false,
  previewBranchCreated: false,
  previewBranchDestroyed: false,
  previewDeploymentCreated: false,
  previewDeploymentDestroyed: false,
  migrationsApplied: 0,
  releasesIssued: 0,
  remoteOperationsPerformed: 0,
}

type Json = Record<string, unknown>

const object = (value: unknown, label: string): Json => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} must be an object.`)
  return value as Json
}
const array = (value: unknown, label: string): Json[] => {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array.`)
  return value.map((entry, index) => object(entry, `${label}[${index}]`))
}

interface ManagementResponse {
  ok: boolean
  status: number
  body: unknown
}

/** Management API call. The token travels in a header, never in an argument. */
async function managementResponse(path: string, init: RequestInit = {}): Promise<ManagementResponse> {
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
  let body: unknown = null
  try { body = text ? JSON.parse(text) : null } catch { body = text }
  return { ok: response.ok, status: response.status, body }
}

async function management(path: string, init: RequestInit = {}): Promise<unknown> {
  const response = await managementResponse(path, init)
  // The body is not echoed on failure: a Management API error can quote the
  // request, and the request carried a credential.
  if (!response.ok) throw new Error(`Management API ${init.method ?? 'GET'} ${path} returned ${response.status}.`)
  return response.body
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
let branchApiUrl = ''
let branchServiceRole = ''

const wait = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds))

async function readyBranchDetail(branchId: string): Promise<Json> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const response = await managementResponse(`/v1/branches/${branchId}`)
    // Branch creation is asynchronous. Supabase can return the branch id from
    // POST before the config endpoint has materialized, during which GET is a
    // temporary 404 rather than evidence that creation failed.
    if (response.status === 404) {
      await wait(3_000)
      continue
    }
    if (!response.ok) {
      throw new Error(`Management API GET /v1/branches/${branchId} returned ${response.status}.`)
    }
    const detail = object(response.body, 'branch detail')
    if (detail.ref && detail.db_host && detail.db_pass && detail.jwt_secret) return detail
    await wait(3_000)
  }
  throw new Error('The ephemeral branch did not expose its isolated connection details before the five-minute deadline.')
}

async function verifyPrivatePreview(origin: string): Promise<void> {
  const unauthenticated = await fetch(origin, { redirect: 'manual', cache: 'no-store' })
  const authorized = await fetch(origin, {
    headers: { 'x-vercel-protection-bypass': bypass },
    redirect: 'follow',
    cache: 'no-store',
  })
  assertPrivatePreviewResponses({
    unauthenticatedStatus: unauthenticated.status,
    unauthenticatedLocation: unauthenticated.headers.get('location'),
    authorizedStatus: authorized.status,
  })
}

function deploymentMarkerPath(): string | null {
  return evidencePath ? join(dirname(evidencePath), 'preview-deployment.json') : null
}

function removePreviewDeployment(deploymentId: string): void {
  try {
    execFileSync('vercel', ['remove', deploymentId, '--yes', '--scope', VERCEL_SCOPE], {
      encoding: 'utf8',
      env: { ...process.env, VERCEL_TOKEN: vercelToken },
      stdio: ['ignore', 'pipe', 'pipe'],
    })
  } catch {
    throw new Error('The branch-bound Vercel Preview could not be destroyed.')
  } finally {
    previewOrigin = ''
  }
}

const driver: RehearsalDriver = {
  branchCredentialPresent: () => managementToken.length > 0,
  parentProjectRef: () => parentRef,

  async createEphemeralBranch(name: string): Promise<EphemeralBranch> {
    const created = object(
      await management(`/v1/projects/${parentRef}/branches`, {
        method: 'POST',
        // No parent data is copied: the branch starts from schema alone.
        body: JSON.stringify({
          branch_name: `${name}-${process.env.GITHUB_RUN_ID ?? 'local'}`,
          region: 'us-east-1',
          persistent: false,
          with_data: false,
        }),
      }),
      'created branch',
    )
    const branchId = String(created.id ?? created.branch_id ?? '')
    if (!branchId) throw new Error('The Management API did not return a branch id.')
    // The POST is already a remote mutation. Record it before waiting for the
    // asynchronously-created branch config so a later refusal cannot claim
    // that nothing was created.
    lifecycleState.previewBranchCreated = true
    lifecycleState.branchHandle = { branchId, parentProjectRef: String(created.parent_project_ref ?? parentRef) }
    lifecycleState.remoteOperationsPerformed += 1
    const detail = await readyBranchDetail(branchId)
    const branchRef = String(detail.ref)
    const jwtSecret = String(detail.jwt_secret)
    // The fine-grained token is scoped to the parent staging project. An
    // ephemeral branch has a distinct project ref, so asking for config under
    // that ref is correctly forbidden. The parent response supplies the
    // authoritative regional Supavisor host; the selector binds the database
    // user to the exact branch ref and uses the branch's isolated password.
    const poolerConfiguration = await management(`/v1/projects/${parentRef}/config/database/pooler`)
    branchEnv = previewSessionPoolerEnvironment({
      branchRef,
      parentProjectRef: parentRef,
      branchPassword: detail.db_pass,
      poolerConfiguration,
    })
    branchApiUrl = `https://${branchRef}.supabase.co`
    branchServiceRole = deriveEphemeralServiceRole(jwtSecret, Math.floor(Date.now() / 1000))
    lifecycleState.branchHandle = { branchId, parentProjectRef: String(detail.parent_project_ref ?? parentRef) }
    return {
      branchId,
      parentProjectRef: String(detail.parent_project_ref ?? parentRef),
      schemaOnly: true,
    }
  },

  async destroyEphemeralBranch(branchId: string): Promise<void> {
    await management(`/v1/branches/${branchId}`, { method: 'DELETE' })
    lifecycleState.previewBranchDestroyed = true
    lifecycleState.remoteOperationsPerformed += 1
    branchEnv = {}
    branchApiUrl = ''
    branchServiceRole = ''
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
      lifecycleState.remoteOperationsPerformed += 1
    }
  },

  async applyMigrations(_branch: EphemeralBranch, migrations: readonly string[]): Promise<string[]> {
    const applied: string[] = []
    for (const migration of migrations) {
      const path = join('supabase/migrations', migration)
      psql(branchEnv, ['--single-transaction', '-f', path])
      applied.push(migration)
      lifecycleState.migrationsApplied += 1
      lifecycleState.remoteOperationsPerformed += 1
    }
    return applied
  },

  async bindPreview(branch: EphemeralBranch) {
    if (!vercelToken || !bypass) throw new Error('The protected Vercel deployment credentials are not available.')
    if (!branchApiUrl || !branchServiceRole) throw new Error('The ephemeral branch runtime binding is unavailable.')
    const reviewedCommit = checkedOutCommit
    if (!/^[0-9a-f]{40}$/.test(reviewedCommit) || reviewedCommit !== expectedReviewedCommit) {
      throw new Error('The checked-out commit does not equal the exact reviewed commit.')
    }

    const deploymentEnvironment = {
      ...process.env,
      NEXT_PUBLIC_SUPABASE_URL: branchApiUrl,
      SUPABASE_SERVICE_ROLE_KEY: branchServiceRole,
      EPISTEMIC_OPERATIONS_TOKEN: operationsToken,
      EPISTEMIC_RELEASE_AUTHORITY_TOKEN: authorityToken,
      VERCEL_AUTOMATION_BYPASS_SECRET: bypass,
      EPISTEMIC_EXTERNAL_LINEAGE_REHEARSAL: 'batch-11-preview',
      VERCEL_TOKEN: vercelToken,
    }
    let output = ''
    try {
      output = execFileSync('vercel', [...vercelDeploymentArguments(reviewedCommit)], {
        encoding: 'utf8',
        env: deploymentEnvironment,
        stdio: ['ignore', 'pipe', 'pipe'],
      })
    } catch {
      throw new Error('The exact-commit Vercel Preview deployment failed.')
    }
    const deployment = parseVercelDeploymentOutput(output)
    lifecycleState.previewDeploymentCreated = true
    lifecycleState.remoteOperationsPerformed += 1
    previewOrigin = deployment.origin
    const markerPath = deploymentMarkerPath()
    if (markerPath) {
      mkdirSync(dirname(markerPath), { recursive: true })
      const marker = { deploymentId: deployment.id, origin: deployment.origin, reviewedCommit }
      lifecycleState.deploymentMarker = marker
      writeFileSync(markerPath, `${JSON.stringify(marker)}\n`)
    }
    try {
      await verifyPrivatePreview(previewOrigin)
    } catch (error) {
      removePreviewDeployment(deployment.id)
      lifecycleState.previewDeploymentDestroyed = true
      lifecycleState.remoteOperationsPerformed += 1
      if (markerPath && existsSync(markerPath)) { unlinkSync(markerPath); lifecycleState.markerRemoved = true }
      throw error
    }
    return {
      deploymentId: deployment.id,
      origin: deployment.origin,
      branchId: branch.branchId,
      reviewedCommit,
      privateAccessVerified: true,
    }
  },

  async destroyBoundPreview(deploymentId: string) {
    removePreviewDeployment(deploymentId)
    lifecycleState.previewDeploymentDestroyed = true
    lifecycleState.remoteOperationsPerformed += 1
    const markerPath = deploymentMarkerPath()
    if (markerPath && existsSync(markerPath)) { unlinkSync(markerPath); lifecycleState.markerRemoved = true }
  },

  /**
   * Reads the public Production registry again, right before releasing.
   *
   * Credential-free and read-only, exactly like the phase-2 read: a plain GET
   * of a public document with no token and no body.
   */
  async assertLineageFresh(): Promise<void> {
    const response = await fetch(PRODUCTION_REGISTRY_URL, { method: 'GET', cache: 'no-store' })
    let body: unknown = null
    try { body = await response.json() } catch { body = null }
    assertLineageFresh({ ok: response.ok, status: response.status, body })
  },

  async ingest(idempotency: string): Promise<{ decisionsRecorded: number }> {
    await preview('/api/admin/epistemic-ingestion', operationsToken, {
      method: 'POST',
      body: JSON.stringify({ adapterId: 'batch-11-mixed-lineage-rehearsal', idempotencyKey: idempotency }),
    })
    lifecycleState.remoteOperationsPerformed += 1
    let decisionsRecorded = 0
    for (const decision of batch11RevisionReviewInputs()) {
      await preview('/api/admin/epistemic-reviews', operationsToken, {
        method: 'POST',
        body: JSON.stringify(decision),
      })
      decisionsRecorded += 1
      lifecycleState.remoteOperationsPerformed += 1
    }
    return { decisionsRecorded }
  },

  async issueRelease(request: ReleaseRequest): Promise<ReleaseResult> {
    const common = {
      recordId: request.recordId,
      targetSha256: request.targetSha256,
      canonicalVersion: request.releaseKind === 'superseding' ? 'batch-11-preview-1.1.0' : 'batch-11-preview-1.0.0',
      supersedesReleaseId: request.supersedesReleaseId,
      authority: {
        authorityId: 'authority_batch-11-preview',
        displayName: 'Maha Batch 11 Preview Release Authority',
        role: 'Internal Preview-only canonical release authority',
        authorizationBasis: 'The owner authorized this exact five-record isolated Preview rehearsal after inspected-source alignment, exact-revision internal review, lineage reconciliation and projection-safety checks passed. Production release is not authorized.',
        publicAttribution: false,
      },
      publicChangeSummary: request.releaseKind === 'superseding'
        ? 'Preview-only superseding release binds the inspected Batch 11 source replacement and exact revised record.'
        : 'Preview-only initial release binds the inspected Batch 11 source replacement and exact revised record.',
      rationale: 'The exact revision has an inspected subject-matched source, exact locator, eight-dimension audit and four scoped internal-editorial approvals. External endorsement, independent reproduction, scientific validation and Production publication are not claimed.',
    }
    await preview('/api/admin/epistemic-releases', authorityToken, {
      method: 'POST',
      body: JSON.stringify({
        ...common,
        operation: 'preview',
        idempotencyKey: idempotencyKey('preview', request.targetSha256),
      }),
    })
    const response = await preview('/api/admin/epistemic-releases', authorityToken, {
      method: 'POST',
      body: JSON.stringify({
        ...common,
        operation: 'publish',
        idempotencyKey: request.idempotencyKey,
      }),
    })
    const body = object(response.body, `${request.recordId} published release`)
    const release = object(body.release, `${request.recordId} release`)
    const replayed = body.replayed === true || body.created === false
    if (!replayed) lifecycleState.releasesIssued += 1
    lifecycleState.remoteOperationsPerformed += 2
    return {
      recordId: request.recordId,
      releaseId: String(release.releaseId),
      targetSha256: String(release.targetSha256),
      replayed,
    }
  },

  async observeTransitions(): Promise<ObservedTransition[]> {
    const registry = object((await preview('/knowledge/epistemic-system/releases/registry.json', null)).body, 'preview registry')
    const releases = array(registry.releases, 'preview registry releases')
    const witnessRows = psql(
      branchEnv,
      [],
      "select record_id || E'\\t' || prior_release_id || E'\\t' || prior_target_sha256 from public.batch_11_rehearsal_imported_lineage order by record_id;",
    ).trim().split('\n').filter(Boolean).map((line) => {
      const [recordId, releaseId, targetSha256] = line.split('\t')
      return { recordId, releaseId, targetSha256 }
    })
    return BATCH_11_LINEAGE_DECLARATIONS.map((declaration) => {
      const active = releases.filter((row) => row.recordId === declaration.recordId && row.status === 'active')
      if (active.length !== 1) throw new Error(`${declaration.recordId}: expected one active release, found ${active.length}.`)
      const prior = witnessRows.find((row) => row.recordId === declaration.recordId)
      return {
        recordId: declaration.recordId,
        releaseKind: declaration.declaredReleaseKind,
        activeTargetSha256: String(active[0].targetSha256),
        supersededReleaseId: active[0].supersedesReleaseId ? String(active[0].supersedesReleaseId) : null,
        priorStillPresent: declaration.declaredPriorReleaseId === null
          ? true
          : prior?.releaseId === declaration.declaredPriorReleaseId && prior.targetSha256 === declaration.declaredPriorTargetSha256,
        priorStatus: prior && active[0].supersedesReleaseId === prior.releaseId ? 'superseded' : null,
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
  if (Buffer.byteLength(operationsToken) < 32 || Buffer.byteLength(authorityToken) < 32 || operationsToken === authorityToken) {
    throw new RehearsalRefused('preview-credential-invalid', 'provision-ephemeral-branch', 'The isolated Preview operations and release-authority credentials are missing, too short, or not distinct.')
  }
  if (!bypass || !vercelToken) {
    throw new RehearsalRefused('preview-credential-invalid', 'provision-ephemeral-branch', 'The isolated Preview deployment credentials are unavailable.')
  }
  if (!/^[0-9a-f]{40}$/.test(expectedReviewedCommit) || checkedOutCommit !== expectedReviewedCommit) {
    throw new RehearsalRefused('reviewed-commit-mismatch', 'provision-ephemeral-branch', 'The checked-out commit does not equal the exact reviewed commit.')
  }
  if (parentRef === PRODUCTION_SUPABASE_PROJECT_REF) {
    throw new RehearsalRefused('production-project-targeted', 'provision-ephemeral-branch', 'SUPABASE_PROJECT_REF is the Production project.')
  }
  const outcome = await runRehearsal(driver, gates)
  if (!lifecycleState.branchHandle || !lifecycleState.deploymentMarker) {
    throw new RehearsalRefused('teardown-handle-missing', 'destroy-ephemeral-resources', 'Exact private teardown handles were not retained for every temporary resource.')
  }
  const workflowRunId = process.env.GITHUB_RUN_ID ?? ''
  const deploymentId = String(lifecycleState.deploymentMarker.deploymentId ?? '')
  const deploymentOrigin = String(lifecycleState.deploymentMarker.origin ?? '')
  const teardownHandles: ExactTeardownHandles = {
    schemaVersion: 'maha-batch-11-private-teardown-handles/1.0',
    workflowRunId,
    runMarker: runMarkerFor(workflowRunId),
    reviewedCommit: expectedReviewedCommit,
    supabaseBranch: lifecycleState.branchHandle,
    vercelPreview: { deploymentId, origin: deploymentOrigin },
    githubEnvironmentSecrets: {
      environment: 'batch-11-preview-rehearsal',
      names: TEMPORARY_PREVIEW_SECRET_NAMES,
    },
    databaseReleaseRows: {
      branchId: lifecycleState.branchHandle.branchId,
      releaseIds: outcome.releaseIdentities.map((entry) => entry.releaseId),
    },
  }
  if (evidencePath) {
    const privatePath = join(dirname(evidencePath), 'teardown-handles.json')
    writeFileSync(privatePath, `${JSON.stringify(teardownHandles, null, 2)}\n`, { mode: 0o600 })
  }
  // The reviewed commit comes from the validated inputs above, never from a
  // field on the artifact this block is about to produce.
  const bound = buildBoundEvidence({
    expectedReviewedCommit,
    checkedOutCommit,
    // Mandatory. buildBoundEvidence refuses an absent or non-numeric value
    // rather than emitting evidence that cannot name its run.
    workflowRunId,
    planDigest,
    cohortRecordIds: BATCH_11_LINEAGE_DECLARATIONS.map((entry) => entry.recordId),
    // Expected is what the cohort declares; observed is what the registry probe
    // independently found. Recording both is what makes a disagreement visible.
    lineageClassifications: gates.map((gate) => ({
      recordId: gate.recordId,
      expected: BATCH_11_LINEAGE_DECLARATIONS.find((entry) => entry.recordId === gate.recordId)!.declaredReleaseKind,
      observed: gate.probeState === 'lineage-present' ? 'superseding' as const : 'initial' as const,
    })),
    phaseOutcomes: outcome.phases.map((phase) => ({ phase: phase.phase, status: phase.status, mutations: phase.mutations })),
    // Compared against the repository contract inside buildBoundEvidence: the
    // target digest must be the one the revision audit declares, not merely a
    // well-formed hash.
    releaseIdentities: outcome.releaseIdentities.map((entry) => ({
      recordId: entry.recordId,
      releaseId: entry.releaseId,
      targetSha256: entry.targetSha256,
      releaseKind: entry.releaseKind,
      supersedesReleaseId: entry.supersedesReleaseId,
    })),
    replayedReleases: outcome.replayedReleases,
    deploymentMarker: lifecycleState.deploymentMarker,
    teardownHandles,
    cleanup: {
      branchDestroyed: outcome.branchDestroyed,
      deploymentDestroyed: outcome.previewDestroyed,
      markerRemoved: lifecycleState.markerRemoved,
    },
    requiredPhaseCount: PHASE_ORDER.length,
  })
  emit({
    ...bound,
    mode: 'executed',
    reason: `All ${outcome.phasesExecuted} phases executed against an ephemeral Preview branch.`,
    remoteOperationsPerformed: outcome.phases.reduce((total, phase) => total + phase.mutations, 0),
    previewBranchCreated: true,
    previewBranchDestroyed: outcome.branchDestroyed,
    previewDeploymentCreated: true,
    previewDeploymentDestroyed: outcome.previewDestroyed,
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
    remoteOperationsPerformed: lifecycleState.remoteOperationsPerformed,
    previewBranchCreated: lifecycleState.previewBranchCreated,
    previewBranchDestroyed: lifecycleState.previewBranchDestroyed,
    previewDeploymentCreated: lifecycleState.previewDeploymentCreated,
    previewDeploymentDestroyed: lifecycleState.previewDeploymentDestroyed,
    migrationsApplied: lifecycleState.migrationsApplied,
    releasesIssued: lifecycleState.releasesIssued,
    productionWritesPerformed: 0,
    fingerprint,
  })
  process.exit(1)
}
