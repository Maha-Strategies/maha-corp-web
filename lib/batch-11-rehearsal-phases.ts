import { createHash } from 'node:crypto'

import { canonicalJson } from './evidence-dossier/digest.ts'
import { BATCH_11_LINEAGE_DECLARATIONS, type ReleaseKind } from './batch-11-mixed-lineage-release.ts'
import type { RehearsalGate } from './batch-11-remote-rehearsal.ts'

/**
 * The seven remote phases of the Batch 11 mixed-lineage Preview rehearsal.
 *
 * Every phase here is implemented, not described. The remote effects are
 * reached through an injected driver so the whole lifecycle - including the
 * failure paths that matter most - runs against an in-memory double in tests
 * and against Supabase and a Preview deployment in CI, using the same code.
 *
 * Two properties are structural rather than procedural:
 *
 *  - Production is reachable only through `readProductionRegistry`, which is an
 *    unauthenticated HTTPS GET of a public JSON document. There is no
 *    Production write method on the driver to call, so a Production write is
 *    not forbidden by a check that could be removed; it is absent.
 *  - The ephemeral branch is created before anything is written and destroyed
 *    in a finally block, so an aborted run cannot leave one behind.
 */

export const BATCH_11_REHEARSAL_PHASES_VERSION = 'maha-batch-11-rehearsal-phases/1.0' as const

/** The Supabase project that holds Production data. Never a rehearsal target. */
export const PRODUCTION_SUPABASE_PROJECT_REF = 'uhwuullakihgszxhiygz' as const

/** The public, credential-free Production release registry. GET only. */
export const PRODUCTION_REGISTRY_URL =
  'https://www.mahastrategies.com/knowledge/epistemic-system/releases/registry.json' as const

/**
 * The existing protected secret that can create and destroy a Supabase branch.
 *
 * This is the repository's established name for the Supabase Management API
 * personal access token. No new credential is introduced by this rehearsal: if
 * this one is not bound to the rehearsal environment, phase 1 refuses before
 * any mutation and names it.
 */
export const BRANCH_MANAGEMENT_CREDENTIAL = 'SUPABASE_ACCESS_TOKEN' as const

export type PhaseName =
  | 'provision-ephemeral-branch'
  | 'import-prior-lineages'
  | 'apply-migrations'
  | 'ingest-revisions-and-decisions'
  | 'issue-releases'
  | 'verify-transitions'
  | 'destroy-ephemeral-branch'

export const PHASE_ORDER: readonly PhaseName[] = [
  'provision-ephemeral-branch',
  'apply-migrations',
  'import-prior-lineages',
  'ingest-revisions-and-decisions',
  'issue-releases',
  'verify-transitions',
  'destroy-ephemeral-branch',
]

export type PhaseStatus = 'executed' | 'refused' | 'skipped'

export interface PhaseRecord {
  phase: PhaseName
  status: PhaseStatus
  detail: string
  /** Remote effects this phase actually performed. Zero for a refusal. */
  mutations: number
}

/**
 * The migrations this lifecycle requires, and the only ones it may apply.
 *
 * Named exactly so a run cannot quietly pick up whatever else has landed in
 * supabase/migrations since review.
 */
export const REQUIRED_MIGRATIONS: readonly string[] = [
  '20260831120000_batch_11_mixed_lineage_rehearsal.sql',
  '20260831123000_batch_11_mixed_lineage_rehearsal_execution.sql',
]

/**
 * The only prior releases this rehearsal may import.
 *
 * Derived from the declarations rather than restated, so the allowlist cannot
 * drift away from the cohort it is meant to bound. The initial record has no
 * prior release and therefore contributes nothing to import - importing
 * anything for it would manufacture the lineage the initial gate requires to be
 * absent.
 */
export const IMPORT_ALLOWLIST: readonly { recordId: string; priorReleaseId: string; priorTargetSha256: string }[] =
  BATCH_11_LINEAGE_DECLARATIONS.filter((entry) => entry.declaredPriorReleaseId !== null).map((entry) => ({
    recordId: entry.recordId,
    priorReleaseId: entry.declaredPriorReleaseId as string,
    priorTargetSha256: entry.declaredPriorTargetSha256 as string,
  }))

export type RehearsalRefusal =
  | 'branch-credential-absent'
  | 'production-project-targeted'
  | 'production-access-write-capable'
  | 'import-outside-allowlist'
  | 'import-lineage-mismatch'
  | 'migration-outside-allowlist'
  | 'migration-missing'
  | 'gate-not-ready'
  | 'replay-would-duplicate'
  | 'transition-not-observed'
  | 'initial-supersedes-something'
  | 'secret-shaped-text-in-evidence'
  | 'private-corpus-in-served-bundle'
  | 'preview-credential-invalid'
  | 'reviewed-commit-mismatch'
  | 'preview-not-bound'
  | 'preview-not-destroyed'
  | 'branch-not-destroyed'
  | 'teardown-handle-missing'

export class RehearsalRefused extends Error {
  code: RehearsalRefusal
  phase: PhaseName

  constructor(code: RehearsalRefusal, phase: PhaseName, message: string) {
    super(message)
    this.name = 'RehearsalRefused'
    this.code = code
    this.phase = phase
  }
}

/**
 * Declared as a function rather than a const arrow so TypeScript narrows after
 * a call: `if (!row) refuse(...)` then leaves `row` non-nullable. An arrow
 * assigned to an un-annotated const does not get that treatment.
 */
function refuse(code: RehearsalRefusal, phase: PhaseName, message: string): never {
  throw new RehearsalRefused(code, phase, message)
}

/**
 * How this run may reach Production.
 *
 * `kind` is declared, not inferred, and only `public-https-get` is accepted. A
 * descriptor carrying a connection string or a service-role key is refused even
 * if nothing would have used it: a write-capable credential inside the job is
 * the hazard, not the write itself.
 */
export interface ProductionAccessDescriptor {
  kind: string
  url: string
  credentialPresented: boolean
}

const WRITE_CAPABLE_SCHEMES = ['postgres://', 'postgresql://', 'mysql://', 'mongodb://']

/** Refuses any Production access that could write, before it is ever used. */
export function assertProductionReadOnly(descriptor: ProductionAccessDescriptor): void {
  const phase: PhaseName = 'import-prior-lineages'
  if (descriptor.kind !== 'public-https-get') {
    refuse('production-access-write-capable', phase, `Production access must be a public HTTPS GET; got "${descriptor.kind}".`)
  }
  const lowered = descriptor.url.toLowerCase()
  if (WRITE_CAPABLE_SCHEMES.some((scheme) => lowered.startsWith(scheme))) {
    refuse('production-access-write-capable', phase, 'A database connection string is write-capable and is refused as Production access.')
  }
  if (!lowered.startsWith('https://')) {
    refuse('production-access-write-capable', phase, 'Production access must be HTTPS.')
  }
  if (descriptor.credentialPresented) {
    refuse('production-access-write-capable', phase, 'Production access must present no credential. A credential implies capability beyond reading a public document.')
  }
  if (descriptor.url !== PRODUCTION_REGISTRY_URL) {
    refuse('production-access-write-capable', phase, `Production access is restricted to ${PRODUCTION_REGISTRY_URL}.`)
  }
}

/** One prior release, as read from Production and carried into the branch. */
export interface ImportedLineage {
  recordId: string
  releaseId: string
  targetSha256: string
  status: string
}

/**
 * Restricts the import to exactly the two prior lineages, by identity.
 *
 * Both directions are checked. Anything outside the allowlist is refused, and
 * a missing or altered member is refused too, so an import cannot be quietly
 * narrowed into a cohort that no longer supersedes what it claims to.
 */
export function assertImportAllowed(imported: readonly ImportedLineage[]): void {
  const phase: PhaseName = 'import-prior-lineages'
  for (const row of imported) {
    const allowed = IMPORT_ALLOWLIST.find((entry) => entry.recordId === row.recordId)
    if (!allowed) {
      refuse('import-outside-allowlist', phase, `${row.recordId} is not one of the two prior lineages this rehearsal may import.`)
    }
    if (row.releaseId !== allowed.priorReleaseId) {
      refuse('import-lineage-mismatch', phase, `${row.recordId}: imported release ${row.releaseId} is not the declared predecessor ${allowed.priorReleaseId}.`)
    }
    if (row.targetSha256 !== allowed.priorTargetSha256) {
      refuse('import-lineage-mismatch', phase, `${row.recordId}: imported predecessor digest does not match the declared lineage.`)
    }
  }
  if (imported.length !== IMPORT_ALLOWLIST.length) {
    refuse('import-lineage-mismatch', phase, `Expected exactly ${IMPORT_ALLOWLIST.length} prior lineages, imported ${imported.length}.`)
  }
  const distinct = new Set(imported.map((row) => row.recordId))
  if (distinct.size !== imported.length) {
    refuse('import-lineage-mismatch', phase, 'A record appears more than once in the imported lineage set.')
  }
}

/** Refuses a migration this lifecycle did not declare. */
export function assertMigrationsAllowed(migrations: readonly string[]): void {
  const phase: PhaseName = 'apply-migrations'
  for (const migration of migrations) {
    if (!REQUIRED_MIGRATIONS.includes(migration)) {
      refuse('migration-outside-allowlist', phase, `${migration} is not required by this lifecycle and must not be applied.`)
    }
  }
  for (const required of REQUIRED_MIGRATIONS) {
    if (!migrations.includes(required)) {
      refuse('migration-missing', phase, `${required} is required by this lifecycle but was not applied.`)
    }
  }
}

/**
 * Deterministic idempotency keys.
 *
 * Derived from the exact revision digest, so re-running the rehearsal presents
 * the same key for the same intent and the server can recognise a replay. A key
 * containing a timestamp or a run id would make every replay look novel, which
 * is precisely how a rehearsal turns into a duplicate release.
 */
export function idempotencyKey(operation: 'ingest' | 'preview' | 'publish', targetSha256: string): string {
  return `batch-11-rehearsal-${operation}:${targetSha256}`
}

/** A secret-shaped run of characters that must never reach an artifact. */
const SECRET_SHAPES: readonly { name: string; pattern: RegExp }[] = [
  { name: 'bearer token', pattern: /bearer\s+[A-Za-z0-9._~+/-]{16,}/i },
  { name: 'supabase access token', pattern: /\bsbp_[A-Za-z0-9]{16,}\b/ },
  { name: 'json web token', pattern: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\./ },
  { name: 'postgres connection string', pattern: /postgres(?:ql)?:\/\/[^\s"']*:[^\s"'@]+@/i },
  { name: 'authorization header', pattern: /"authorization"\s*:/i },
  { name: 'high-entropy hex secret', pattern: /\b(?:secret|token|password|key)"?\s*[:=]\s*"?[A-Za-z0-9/+_-]{24,}/i },
]

/**
 * Refuses to emit evidence that carries anything secret-shaped.
 *
 * A digest is `sha256:` prefixed and stays legible; a credential is not. This
 * runs over the serialized artifact rather than over the fields it was built
 * from, so a secret that arrived through an unexpected field is still caught.
 */
export function assertNoSecretShapedText(artifact: unknown, phase: PhaseName = 'verify-transitions'): void {
  const serialized = typeof artifact === 'string' ? artifact : JSON.stringify(artifact)
  for (const shape of SECRET_SHAPES) {
    if (shape.pattern.test(serialized)) {
      refuse('secret-shaped-text-in-evidence', phase, `The artifact contains text shaped like a ${shape.name}. Evidence is refused rather than redacted.`)
    }
  }
}

/**
 * Private material that must never appear in anything the site serves.
 *
 * Checked against the rendered HTML and against the RSC flight payload, because
 * a served page can carry text in its streamed data that never appears in the
 * markup a reader sees.
 */
export const PRIVATE_CORPUS_MARKERS: readonly string[] = [
  'reject-or-hold',
  'review packet',
  'audit corpus',
  'internal-only',
  'MAHA_B11_',
  'authorizationBasis',
]

export function assertNoPrivateCorpusInBundle(recordId: string, bundle: string): void {
  for (const marker of PRIVATE_CORPUS_MARKERS) {
    if (bundle.toLowerCase().includes(marker.toLowerCase())) {
      refuse('private-corpus-in-served-bundle', 'verify-transitions', `${recordId}: the served bundle contains private material ("${marker}").`)
    }
  }
}

/** One record's observed transition after publication. */
export interface ObservedTransition {
  recordId: string
  releaseKind: ReleaseKind
  activeTargetSha256: string
  supersededReleaseId: string | null
  priorStillPresent: boolean
  priorStatus: string | null
}

/**
 * Verifies each transition against its own declaration, independently.
 *
 * "Independently" is the point: a superseding record must show the exact prior
 * release moved to `superseded` and still present, and the initial record must
 * show that it superseded nothing. Checking only that five active releases
 * exist would pass a run that silently released five initials.
 */
export function assertTransitions(observed: readonly ObservedTransition[], gates: readonly RehearsalGate[]): void {
  const phase: PhaseName = 'verify-transitions'
  for (const declared of BATCH_11_LINEAGE_DECLARATIONS) {
    const row = observed.find((entry) => entry.recordId === declared.recordId)
    if (!row) refuse('transition-not-observed', phase, `${declared.recordId}: no transition was observed after publication.`)
    const gate = gates.find((entry) => entry.recordId === declared.recordId)
    if (!gate) refuse('gate-not-ready', phase, `${declared.recordId}: no gate exists for an observed transition.`)

    if (row.releaseKind !== declared.declaredReleaseKind) {
      refuse('transition-not-observed', phase, `${declared.recordId}: released as ${row.releaseKind} but declared ${declared.declaredReleaseKind}.`)
    }
    if (row.activeTargetSha256 !== gate.proposedTargetSha256) {
      refuse('transition-not-observed', phase, `${declared.recordId}: the active release does not bind the exact proposed revision.`)
    }

    if (declared.declaredReleaseKind === 'superseding') {
      if (row.supersededReleaseId !== declared.declaredPriorReleaseId) {
        refuse('transition-not-observed', phase, `${declared.recordId}: superseded ${row.supersededReleaseId ?? 'nothing'} rather than the declared predecessor ${declared.declaredPriorReleaseId}.`)
      }
      if (!row.priorStillPresent) {
        refuse('transition-not-observed', phase, `${declared.recordId}: the prior release is absent. Release history is append-only; a predecessor is superseded, never removed.`)
      }
      if (row.priorStatus !== 'superseded') {
        refuse('transition-not-observed', phase, `${declared.recordId}: the prior release is "${row.priorStatus}" rather than superseded.`)
      }
    } else if (row.supersededReleaseId !== null) {
      refuse('initial-supersedes-something', phase, `${declared.recordId}: an initial release superseded ${row.supersededReleaseId}. That would rewrite a lineage this record does not have.`)
    }
  }
  if (observed.length !== BATCH_11_LINEAGE_DECLARATIONS.length) {
    refuse('transition-not-observed', phase, `Expected ${BATCH_11_LINEAGE_DECLARATIONS.length} transitions, observed ${observed.length}.`)
  }
}

export function rehearsalEvidenceDigest(payload: unknown): string {
  return `sha256:${createHash('sha256').update(canonicalJson(payload), 'utf8').digest('hex')}`
}

/** An ephemeral Preview branch, as returned by whatever provisions it. */
export interface EphemeralBranch {
  branchId: string
  parentProjectRef: string
  /** True when the branch was created with schema only and no parent rows. */
  schemaOnly: boolean
}

/**
 * The isolated application deployment bound to one ephemeral database branch.
 *
 * Neither the branch service credential nor any release credential belongs in
 * this descriptor. The driver keeps those in process memory and returns only
 * non-secret identifiers needed to prove and clean up the binding.
 */
export interface BoundPreview {
  deploymentId: string
  origin: string
  branchId: string
  reviewedCommit: string
  privateAccessVerified: boolean
}

export interface ReleaseRequest {
  recordId: string
  targetSha256: string
  releaseKind: ReleaseKind
  supersedesReleaseId: string | null
  idempotencyKey: string
}

export interface ReleaseResult {
  recordId: string
  releaseId: string
  targetSha256: string
  /** True when the server recognised the idempotency key and created nothing. */
  replayed: boolean
}

/**
 * The remote effects the rehearsal is allowed to have.
 *
 * There is deliberately no Production write method. The only Production member
 * is a GET of a public document, so "Production was not written" is a property
 * of this interface rather than a claim about the code that uses it.
 */
export interface RehearsalDriver {
  branchCredentialPresent(): boolean
  parentProjectRef(): string
  createEphemeralBranch(name: string): Promise<EphemeralBranch>
  destroyEphemeralBranch(branchId: string): Promise<void>

  productionAccess(): ProductionAccessDescriptor
  readProductionLineages(): Promise<ImportedLineage[]>
  importLineages(branch: EphemeralBranch, lineages: readonly ImportedLineage[]): Promise<void>

  applyMigrations(branch: EphemeralBranch, migrations: readonly string[]): Promise<string[]>
  bindPreview(branch: EphemeralBranch): Promise<BoundPreview>
  destroyBoundPreview(deploymentId: string): Promise<void>

  /**
   * Re-checks lineage against a live public read, immediately before release.
   *
   * Optional so an in-memory double need not implement it; a driver that has a
   * live registry to consult must, and the real one does.
   */
  assertLineageFresh?(): Promise<void>
  ingest(idempotency: string): Promise<{ decisionsRecorded: number }>
  issueRelease(request: ReleaseRequest): Promise<ReleaseResult>

  observeTransitions(): Promise<ObservedTransition[]>
  fetchServedBundle(recordId: string): Promise<string>
}

export interface IssuedRelease {
  recordId: string
  releaseId: string
  targetSha256: string
  releaseKind: ReleaseKind
  supersedesReleaseId: string | null
  replayed: boolean
}

export interface RehearsalOutcome {
  version: typeof BATCH_11_REHEARSAL_PHASES_VERSION
  phases: readonly PhaseRecord[]
  /**
   * What was actually released, per record.
   *
   * Counts alone cannot distinguish five correct releases from five releases
   * of the wrong things, so the identities travel with the outcome and into
   * the artifact that attests to it.
   */
  releaseIdentities: readonly IssuedRelease[]
  phasesExecuted: number
  releasesIssued: number
  replayedReleases: number
  productionWritesPerformed: 0
  previewDestroyed: boolean
  branchDestroyed: boolean
  evidenceDigest: string
}

/**
 * Runs all seven phases, or refuses before mutating anything.
 *
 * The credential check is first and unconditional. If the branch-management
 * credential is absent, the run ends having created nothing, applied nothing
 * and released nothing - which is the correct outcome, not a degraded one.
 *
 * Once a branch exists, destruction is guaranteed by `finally`: a phase that
 * throws still gets cleaned up, and a cleanup failure is itself a refusal
 * rather than a logged warning.
 */
export async function runRehearsal(
  driver: RehearsalDriver,
  gates: readonly RehearsalGate[],
): Promise<RehearsalOutcome> {
  const phases: PhaseRecord[] = []
  const record = (phase: PhaseName, status: PhaseStatus, detail: string, mutations: number) => {
    phases.push({ phase, status, detail, mutations })
  }

  const notReady = gates.filter((gate) => !gate.ready)
  if (notReady.length > 0) {
    refuse('gate-not-ready', 'provision-ephemeral-branch', `${notReady.length} record(s) did not gate cleanly: ${notReady.map((g) => `${g.recordId} (${g.failures.join(', ')})`).join('; ')}`)
  }

  // Phase 1. Nothing above this line has touched anything remote.
  if (!driver.branchCredentialPresent()) {
    refuse(
      'branch-credential-absent',
      'provision-ephemeral-branch',
      `${BRANCH_MANAGEMENT_CREDENTIAL} is not available to this job, so the ephemeral Preview branch cannot be created or destroyed. Refusing before any mutation.`,
    )
  }
  const parent = driver.parentProjectRef()
  if (parent === PRODUCTION_SUPABASE_PROJECT_REF || parent.length === 0) {
    refuse('production-project-targeted', 'provision-ephemeral-branch', 'The Production Supabase project may not be the parent of a rehearsal branch.')
  }

  const branch = await driver.createEphemeralBranch('batch-11-mixed-lineage-rehearsal')
  if (branch.parentProjectRef === PRODUCTION_SUPABASE_PROJECT_REF) {
    // Checked again from the created branch, not only from the input, so a
    // driver that ignored the requested parent cannot slip past.
    await driver.destroyEphemeralBranch(branch.branchId)
    refuse('production-project-targeted', 'provision-ephemeral-branch', 'The created branch reports the Production project as its parent.')
  }
  record('provision-ephemeral-branch', 'executed', `Created ephemeral ${branch.schemaOnly ? 'schema-only ' : ''}branch on parent project ${branch.parentProjectRef}.`, 1)

  let releasesIssued = 0
  let replayedReleases = 0
  const issuedReleases: IssuedRelease[] = []
  let preview: BoundPreview | null = null
  let previewDestroyed = false
  let branchDestroyed = false

  try {
    // Phase 2. The dedicated schema must exist before lineage witnesses can be
    // inserted into an otherwise empty schema-only branch.
    const applied = await driver.applyMigrations(branch, REQUIRED_MIGRATIONS)
    assertMigrationsAllowed(applied)
    preview = await driver.bindPreview(branch)
    if (
      preview.branchId !== branch.branchId
      || preview.origin.includes('mahastrategies.com')
      || !preview.origin.startsWith('https://')
      || !preview.origin.endsWith('.vercel.app')
      || !preview.privateAccessVerified
      || !/^[0-9a-f]{40}$/.test(preview.reviewedCommit)
    ) {
      refuse(
        'preview-not-bound',
        'apply-migrations',
        'The isolated application deployment is not privately bound to this branch and the exact reviewed commit.',
      )
    }
    record(
      'apply-migrations',
      'executed',
      `Applied ${applied.length} required migration(s), then bound one private Vercel Preview of the exact reviewed commit to that branch.`,
      applied.length + 1,
    )

    // Phase 3.
    assertProductionReadOnly(driver.productionAccess())
    const lineages = await driver.readProductionLineages()
    assertImportAllowed(lineages)
    await driver.importLineages(branch, lineages)
    record('import-prior-lineages', 'executed', `Imported ${lineages.length} exact external predecessor witnesses over a credential-free public HTTPS GET. No predecessor release snapshot was reconstructed.`, lineages.length)

    // Phase 4.
    const cohortDigest = rehearsalEvidenceDigest(gates.map((gate) => ({ recordId: gate.recordId, targetSha256: gate.proposedTargetSha256 })))
    const ingestion = await driver.ingest(idempotencyKey('ingest', cohortDigest))
    if (ingestion.decisionsRecorded !== gates.length * 4) {
      refuse('gate-not-ready', 'ingest-revisions-and-decisions', `Expected ${gates.length * 4} exact-revision decisions, recorded ${ingestion.decisionsRecorded}.`)
    }
    record('ingest-revisions-and-decisions', 'executed', `Ingested ${gates.length} proposed revisions and ${ingestion.decisionsRecorded} exact-revision decisions.`, gates.length + ingestion.decisionsRecorded)

    // Phase 5. Planning ran against a snapshot; the world has had time to move
    // since. Re-read before mutating, so a lineage that changed after planning
    // stops the release rather than being released over.
    if (driver.assertLineageFresh) await driver.assertLineageFresh()

    const seen = new Set<string>()
    for (const declared of BATCH_11_LINEAGE_DECLARATIONS) {
      const gate = gates.find((entry) => entry.recordId === declared.recordId)
      if (!gate) refuse('gate-not-ready', 'issue-releases', `${declared.recordId}: no gate.`)
      if (seen.has(declared.recordId)) {
        refuse('replay-would-duplicate', 'issue-releases', `${declared.recordId} was released twice within one run.`)
      }
      seen.add(declared.recordId)
      const result = await driver.issueRelease({
        recordId: declared.recordId,
        targetSha256: gate.proposedTargetSha256,
        releaseKind: declared.declaredReleaseKind,
        supersedesReleaseId: declared.declaredPriorReleaseId,
        idempotencyKey: idempotencyKey('publish', gate.proposedTargetSha256),
      })
      if (result.targetSha256 !== gate.proposedTargetSha256) {
        refuse('transition-not-observed', 'issue-releases', `${declared.recordId}: the issued release binds a different revision than the one gated.`)
      }
      issuedReleases.push({
        recordId: declared.recordId,
        releaseId: result.releaseId,
        targetSha256: result.targetSha256,
        releaseKind: declared.declaredReleaseKind,
        supersedesReleaseId: declared.declaredPriorReleaseId,
        replayed: result.replayed,
      })
      if (result.replayed) replayedReleases += 1
      else releasesIssued += 1
    }
    record('issue-releases', 'executed', `Issued ${releasesIssued} new release(s); ${replayedReleases} were recognised as replays and created nothing.`, releasesIssued)

    // Phase 6.
    const observed = await driver.observeTransitions()
    assertTransitions(observed, gates)
    for (const declared of BATCH_11_LINEAGE_DECLARATIONS) {
      assertNoPrivateCorpusInBundle(declared.recordId, await driver.fetchServedBundle(declared.recordId))
    }
    record('verify-transitions', 'executed', `Verified ${observed.length} transitions independently: ${IMPORT_ALLOWLIST.length} superseding with the predecessor retained and marked superseded, ${observed.length - IMPORT_ALLOWLIST.length} initial releases superseding nothing.`, 0)
  } finally {
    // Phase 7. Runs whether or not the phases above succeeded.
    let previewCleanupError: unknown = null
    try {
      if (preview) {
        await driver.destroyBoundPreview(preview.deploymentId)
        previewDestroyed = true
      }
    } catch (error) {
      previewCleanupError = error
    }
    try {
      await driver.destroyEphemeralBranch(branch.branchId)
      branchDestroyed = true
    } finally {
      record(
        'destroy-ephemeral-branch',
        'executed',
        'Destroyed the branch-bound Vercel Preview and the ephemeral database branch. No temporary credential outlives the run.',
        Number(previewDestroyed) + Number(branchDestroyed),
      )
    }
    if (previewCleanupError) throw previewCleanupError
  }

  if (!previewDestroyed) {
    refuse('preview-not-destroyed', 'destroy-ephemeral-branch', 'The branch-bound Vercel Preview was not destroyed.')
  }
  if (!branchDestroyed) {
    refuse('branch-not-destroyed', 'destroy-ephemeral-branch', 'The ephemeral branch was not destroyed.')
  }

  const outcome: RehearsalOutcome = {
    version: BATCH_11_REHEARSAL_PHASES_VERSION,
    phases,
    releaseIdentities: issuedReleases,
    phasesExecuted: phases.filter((entry) => entry.status === 'executed').length,
    releasesIssued,
    replayedReleases,
    productionWritesPerformed: 0,
    previewDestroyed,
    branchDestroyed,
    evidenceDigest: rehearsalEvidenceDigest(phases),
  }
  assertNoSecretShapedText(outcome)
  return outcome
}
