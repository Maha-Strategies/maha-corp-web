import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import test from 'node:test'

import {
  BATCH_11_LINEAGE_DECLARATIONS,
  type RegistryObservation,
} from '../lib/batch-11-mixed-lineage-release.ts'
import {
  KNOWN_RELEASE_STATUSES,
  gateRecord,
  probeLineage,
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
  assertImportAllowed,
  assertMigrationsAllowed,
  assertNoPrivateCorpusInBundle,
  assertNoSecretShapedText,
  assertProductionReadOnly,
  assertTransitions,
  idempotencyKey,
  runRehearsal,
  type EphemeralBranch,
  type ImportedLineage,
  type ObservedTransition,
  type RehearsalDriver,
  type ReleaseRequest,
  type ReleaseResult,
} from '../lib/batch-11-rehearsal-phases.ts'

const ROOT = resolve(import.meta.dirname, '..')
const OBSERVATION = JSON.parse(
  readFileSync(resolve(ROOT, 'content/frontier-alignment/batch-11-registry-observation.json'), 'utf8'),
) as RegistryObservation

const PROBE: RegistryProbeInput = {
  observation: OBSERVATION,
  totalRegistryRows: OBSERVATION.totalReleasesInRegistry,
  statusVocabulary: [...KNOWN_RELEASE_STATUSES],
}

const GATES = BATCH_11_LINEAGE_DECLARATIONS.map((declaration) =>
  gateRecord(probeLineage(declaration.recordId, PROBE), declaration.declaredReleaseKind),
)

const INITIALS = BATCH_11_LINEAGE_DECLARATIONS.filter((d) => d.declaredReleaseKind === 'initial')
const INITIAL = INITIALS[0]
const gateFor = (recordId: string) => GATES.find((gate) => gate.recordId === recordId)!

const goodLineages = (): ImportedLineage[] =>
  IMPORT_ALLOWLIST.map((entry) => ({
    recordId: entry.recordId,
    releaseId: entry.priorReleaseId,
    targetSha256: entry.priorTargetSha256,
    status: 'active',
  }))

const goodTransitions = (): ObservedTransition[] =>
  BATCH_11_LINEAGE_DECLARATIONS.map((declaration) => ({
    recordId: declaration.recordId,
    releaseKind: declaration.declaredReleaseKind,
    activeTargetSha256: gateFor(declaration.recordId).proposedTargetSha256,
    supersededReleaseId: declaration.declaredPriorReleaseId,
    priorStillPresent: true,
    priorStatus: declaration.declaredPriorReleaseId === null ? null : 'superseded',
  }))

/** A complete in-memory double. Every phase runs; nothing leaves the process. */
function fakeDriver(overrides: Partial<RehearsalDriver> = {}) {
  const log: string[] = []
  const issued = new Map<string, ReleaseResult>()
  let branches = 0
  let live = 0
  let deployments = 0
  let liveDeployments = 0

  const base: RehearsalDriver = {
    branchCredentialPresent: () => true,
    parentProjectRef: () => 'previewprojectref00',
    async createEphemeralBranch(name: string): Promise<EphemeralBranch> {
      branches += 1
      live += 1
      log.push(`create:${name}`)
      return { branchId: `branch_${branches}`, parentProjectRef: 'previewprojectref00', schemaOnly: true }
    },
    async destroyEphemeralBranch(branchId: string) {
      live -= 1
      log.push(`destroy:${branchId}`)
    },
    productionAccess: () => ({ kind: 'public-https-get', url: PRODUCTION_REGISTRY_URL, credentialPresented: false }),
    async readProductionLineages() {
      log.push('read-production')
      return goodLineages()
    },
    async importLineages(_branch, lineages) {
      log.push(`import:${lineages.length}`)
    },
    async applyMigrations(_branch, migrations) {
      log.push(`migrate:${migrations.length}`)
      return [...migrations]
    },
    async bindPreview(branch) {
      deployments += 1
      liveDeployments += 1
      log.push(`bind-preview:${branch.branchId}`)
      return {
        deploymentId: `deployment_${deployments}`,
        origin: `https://batch-11-${deployments}.vercel.app`,
        branchId: branch.branchId,
        reviewedCommit: 'a'.repeat(40),
        privateAccessVerified: true,
      }
    },
    async destroyBoundPreview(deploymentId) {
      liveDeployments -= 1
      log.push(`destroy-preview:${deploymentId}`)
    },
    async ingest(key: string) {
      log.push(`ingest:${key}`)
      return { decisionsRecorded: BATCH_11_LINEAGE_DECLARATIONS.length * 4 }
    },
    async issueRelease(request: ReleaseRequest): Promise<ReleaseResult> {
      const existing = issued.get(request.idempotencyKey)
      if (existing) return { ...existing, replayed: true }
      const result: ReleaseResult = {
        recordId: request.recordId,
        releaseId: `epirelease_new_${request.recordId.slice(-6)}`,
        targetSha256: request.targetSha256,
        replayed: false,
      }
      issued.set(request.idempotencyKey, result)
      log.push(`release:${request.recordId}`)
      return result
    },
    async observeTransitions() {
      return goodTransitions()
    },
    async fetchServedBundle() {
      return '<html><main>A public evidence page.</main></html>'
    },
  }

  return {
    driver: { ...base, ...overrides },
    log,
    issued,
    liveBranches: () => live,
    livePreviews: () => liveDeployments,
  }
}

function throwsRefusal(fn: () => unknown): RehearsalRefused {
  try {
    fn()
  } catch (error) {
    assert.ok(error instanceof RehearsalRefused, `expected a RehearsalRefused, got ${String(error)}`)
    return error
  }
  throw new Error("expected a refusal but the call succeeded")
}

async function refusalFrom(promise: Promise<unknown>): Promise<RehearsalRefused> {
  try {
    await promise
  } catch (error) {
    assert.ok(error instanceof RehearsalRefused, `expected a RehearsalRefused, got ${String(error)}`)
    return error
  }
  throw new Error('expected a refusal but the call succeeded')
}

// --- the happy path, so the refusals below mean something -------------------

test('all seven phases execute against a branch-bound private Preview', async () => {
  const { driver, liveBranches, livePreviews } = fakeDriver()
  const outcome = await runRehearsal(driver, GATES)
  assert.equal(outcome.phasesExecuted, 7)
  assert.deepEqual(outcome.phases.map((phase) => phase.phase), PHASE_ORDER)
  assert.equal(outcome.releasesIssued, 5)
  assert.equal(outcome.productionWritesPerformed, 0)
  assert.equal(outcome.previewDestroyed, true)
  assert.equal(outcome.branchDestroyed, true)
  assert.equal(livePreviews(), 0, 'no Preview deployment may outlive the run')
  assert.equal(liveBranches(), 0, 'no branch may outlive the run')
})

test('the Preview must bind to the exact branch and reviewed commit', async () => {
  for (const override of [
    { branchId: 'a-different-branch' },
    { reviewedCommit: 'short' },
    { privateAccessVerified: false },
    { origin: 'https://www.mahastrategies.com' },
  ]) {
    const { driver, log, liveBranches } = fakeDriver({
      async bindPreview(branch) {
        return {
          deploymentId: 'deployment_bad',
          origin: 'https://batch-11.vercel.app',
          branchId: branch.branchId,
          reviewedCommit: 'a'.repeat(40),
          privateAccessVerified: true,
          ...override,
        }
      },
    })
    const refusal = await refusalFrom(runRehearsal(driver, GATES))
    assert.equal(refusal.code, 'preview-not-bound')
    assert.ok(log.includes('destroy:branch_1'), 'the database branch must be destroyed after a binding refusal')
    assert.equal(liveBranches(), 0)
  }
})

// --- phase 1: provisioning --------------------------------------------------

test('an absent branch-management credential refuses before any mutation', async () => {
  const { driver, log } = fakeDriver({ branchCredentialPresent: () => false })
  const refusal = await refusalFrom(runRehearsal(driver, GATES))
  assert.equal(refusal.code, 'branch-credential-absent')
  assert.equal(refusal.phase, 'provision-ephemeral-branch')
  assert.match(refusal.message, new RegExp(BRANCH_MANAGEMENT_CREDENTIAL))
  assert.deepEqual(log, [], 'nothing remote may happen once the credential is missing')
})

test('the Production project may not be the branch parent', async () => {
  const { driver, log } = fakeDriver({ parentProjectRef: () => PRODUCTION_SUPABASE_PROJECT_REF })
  const refusal = await refusalFrom(runRehearsal(driver, GATES))
  assert.equal(refusal.code, 'production-project-targeted')
  assert.deepEqual(log, [])
})

test('a branch that reports a Production parent is destroyed and refused', async () => {
  const { driver, log } = fakeDriver({
    async createEphemeralBranch() {
      return { branchId: 'branch_x', parentProjectRef: PRODUCTION_SUPABASE_PROJECT_REF, schemaOnly: true }
    },
  })
  const refusal = await refusalFrom(runRehearsal(driver, GATES))
  assert.equal(refusal.code, 'production-project-targeted')
  assert.ok(log.includes('destroy:branch_x'), 'a wrongly parented branch must still be destroyed')
})

test('a record that does not gate cleanly stops the run before provisioning', async () => {
  const { driver, log } = fakeDriver()
  const broken = GATES.map((gate) =>
    gate.recordId === INITIAL.recordId ? { ...gate, ready: false, failures: ['decision-held' as const] } : gate,
  )
  const refusal = await refusalFrom(runRehearsal(driver, broken))
  assert.equal(refusal.code, 'gate-not-ready')
  assert.deepEqual(log, [])
})

// --- phase 2: Production is structurally read-only --------------------------

test('a write-capable Production connection fails preflight', () => {
  for (const url of [
    'postgresql://postgres:pw@db.example.supabase.co:5432/postgres',
    'postgres://user:pw@host/db',
  ]) {
    const refusal = throwsRefusal(
      () => assertProductionReadOnly({ kind: 'public-https-get', url, credentialPresented: false }))
    assert.equal(refusal.code, 'production-access-write-capable')
  }
})

test('Production access presenting any credential is refused', () => {
  const refusal = throwsRefusal(
    () => assertProductionReadOnly({ kind: 'public-https-get', url: PRODUCTION_REGISTRY_URL, credentialPresented: true }))
  assert.equal(refusal.code, 'production-access-write-capable')
})

test('Production access to any URL other than the public registry is refused', () => {
  const refusal = throwsRefusal(
    () => assertProductionReadOnly({ kind: 'public-https-get', url: 'https://www.mahastrategies.com/api/admin/epistemic-releases', credentialPresented: false }))
  assert.equal(refusal.code, 'production-access-write-capable')
})

test('the driver interface exposes no Production write method', () => {
  const { driver } = fakeDriver()
  const productionMembers = Object.keys(driver).filter((key) => /production/i.test(key))
  assert.deepEqual(productionMembers.sort(), ['productionAccess', 'readProductionLineages'])
})

// --- phase 2: the import allowlist ------------------------------------------

test('importing a record outside the cohort is refused', () => {
  const refusal = throwsRefusal(
    () => assertImportAllowed([...goodLineages(), { recordId: 'urn:maha:record:some-other-record', releaseId: 'epirelease_other', targetSha256: 'sha256:00', status: 'active' }]))
  assert.equal(refusal.code, 'import-outside-allowlist')
})

test('importing a lineage for any initial record is refused', () => {
  assert.equal(INITIALS.length, 3)
  for (const initial of INITIALS) {
    const refusal = throwsRefusal(
      () => assertImportAllowed([...goodLineages(), { recordId: initial.recordId, releaseId: 'epirelease_invented', targetSha256: 'sha256:00', status: 'active' }]))
    assert.equal(refusal.code, 'import-outside-allowlist')
    assert.ok(
      !IMPORT_ALLOWLIST.some((entry) => entry.recordId === initial.recordId),
      'an initial record must never appear in the import allowlist',
    )
  }
})

test('a wrong predecessor release id is refused', () => {
  const wrong = goodLineages()
  wrong[0] = { ...wrong[0], releaseId: 'epirelease_ffffffffffffffffffffffffffffffff' }
  const refusal = throwsRefusal(() => assertImportAllowed(wrong))
  assert.equal(refusal.code, 'import-lineage-mismatch')
})

test('a predecessor whose digest does not match the declared lineage is refused', () => {
  const wrong = goodLineages()
  wrong[1] = { ...wrong[1], targetSha256: 'sha256:0000000000000000000000000000000000000000000000000000000000000000' }
  const refusal = throwsRefusal(() => assertImportAllowed(wrong))
  assert.equal(refusal.code, 'import-lineage-mismatch')
})

test('a short import is refused rather than silently narrowing the cohort', () => {
  const refusal = throwsRefusal(() => assertImportAllowed(goodLineages().slice(0, 1)))
  assert.equal(refusal.code, 'import-lineage-mismatch')
})

test('an adjacent but undeclared record cannot satisfy an initial record lineage', () => {
  const adjacent = 'urn:maha:record:agentic-systems-mcp-tool-deny-by-default'
  assert.notEqual(adjacent, INITIAL.recordId)
  assert.ok(!IMPORT_ALLOWLIST.some((entry) => entry.recordId === adjacent))
  const refusal = throwsRefusal(
    () => assertImportAllowed([...goodLineages(), { recordId: adjacent, releaseId: 'epirelease_adjacent', targetSha256: 'sha256:00', status: 'active' }]))
  assert.equal(refusal.code, 'import-outside-allowlist')
})

// --- phase 3: migrations ----------------------------------------------------

test('applying a migration outside the declared set is refused', () => {
  const refusal = throwsRefusal(
    () => assertMigrationsAllowed([...REQUIRED_MIGRATIONS, '20260830200000_substantial_scale_release_targets.sql']))
  assert.equal(refusal.code, 'migration-outside-allowlist')
})

test('a required migration that was not applied is refused', () => {
  const refusal = throwsRefusal(() => assertMigrationsAllowed([]))
  assert.equal(refusal.code, 'migration-missing')
})

test('the declared forward migration pair exists on disk in order', () => {
  const [planMigration, executionMigration] = REQUIRED_MIGRATIONS.map((migration) =>
    readFileSync(resolve(ROOT, 'supabase/migrations', migration), 'utf8'))
  assert.ok(planMigration.includes('batch_11_rehearsal_observations'))
  assert.ok(executionMigration.includes('record_batch_11_rehearsal_targets'))
  assert.ok(executionMigration.includes('record_batch_11_rehearsal_canonical_release'))
})

// --- phase 5: replay safety -------------------------------------------------

test('idempotency keys are deterministic and carry no run identity', () => {
  const first = idempotencyKey('publish', 'sha256:abc')
  assert.equal(first, idempotencyKey('publish', 'sha256:abc'))
  assert.notEqual(first, idempotencyKey('preview', 'sha256:abc'))
  assert.ok(!/\d{10,}/.test(first), 'a timestamp would make every replay look novel')
})

test('a second run issues no new release', async () => {
  const shared = new Map<string, ReleaseResult>()
  const build = () =>
    fakeDriver({
      async issueRelease(request: ReleaseRequest): Promise<ReleaseResult> {
        const existing = shared.get(request.idempotencyKey)
        if (existing) return { ...existing, replayed: true }
        const result: ReleaseResult = { recordId: request.recordId, releaseId: `epirelease_${shared.size}`, targetSha256: request.targetSha256, replayed: false }
        shared.set(request.idempotencyKey, result)
        return result
      },
    }).driver

  const first = await runRehearsal(build(), GATES)
  const second = await runRehearsal(build(), GATES)
  assert.equal(first.releasesIssued, 5)
  assert.equal(second.releasesIssued, 0, 'a replay must create nothing')
  assert.equal(second.replayedReleases, 5)
})

test('a release binding a different revision than the gated one is refused', async () => {
  const { driver } = fakeDriver({
    async issueRelease(request: ReleaseRequest): Promise<ReleaseResult> {
      return { recordId: request.recordId, releaseId: 'epirelease_drift', targetSha256: 'sha256:drifted', replayed: false }
    },
  })
  const refusal = await refusalFrom(runRehearsal(driver, GATES))
  assert.equal(refusal.code, 'transition-not-observed')
})

// --- phase 6: transitions verified independently ----------------------------

test('a superseding record that superseded the wrong predecessor is refused', () => {
  const observed = goodTransitions()
  const index = observed.findIndex((row) => row.releaseKind === 'superseding')
  observed[index] = { ...observed[index], supersededReleaseId: 'epirelease_ffffffffffffffffffffffffffffffff' }
  const refusal = throwsRefusal(() => assertTransitions(observed, GATES))
  assert.equal(refusal.code, 'transition-not-observed')
})

test('a predecessor removed rather than superseded is refused', () => {
  const observed = goodTransitions()
  const index = observed.findIndex((row) => row.releaseKind === 'superseding')
  observed[index] = { ...observed[index], priorStillPresent: false }
  const refusal = throwsRefusal(() => assertTransitions(observed, GATES))
  assert.equal(refusal.code, 'transition-not-observed')
  assert.match(refusal.message, /append-only/)
})

test('an initial release that superseded something is refused', () => {
  const observed = goodTransitions()
  const index = observed.findIndex((row) => row.releaseKind === 'initial')
  observed[index] = { ...observed[index], supersededReleaseId: 'epirelease_93c92eb7a317465b83fabf8d3e6962da' }
  const refusal = throwsRefusal(() => assertTransitions(observed, GATES))
  assert.equal(refusal.code, 'initial-supersedes-something')
})

test('a record released under the wrong kind is refused', () => {
  const observed = goodTransitions()
  const index = observed.findIndex((row) => row.releaseKind === 'initial')
  observed[index] = { ...observed[index], releaseKind: 'superseding' }
  const refusal = throwsRefusal(() => assertTransitions(observed, GATES))
  assert.equal(refusal.code, 'transition-not-observed')
})

test('a missing transition is refused rather than treated as unchanged', () => {
  const refusal = throwsRefusal(() => assertTransitions(goodTransitions().slice(0, 4), GATES))
  assert.equal(refusal.code, 'transition-not-observed')
})

// --- phase 6: nothing private reaches a served bundle -----------------------

test('private corpus text in a served bundle is refused', () => {
  const refusal = throwsRefusal(
    () => assertNoPrivateCorpusInBundle(INITIAL.recordId, '<html><main>ok</main><script>{"disposition":"reject-or-hold"}</script></html>'))
  assert.equal(refusal.code, 'private-corpus-in-served-bundle')
})

test('private text hidden in the RSC payload rather than the markup is refused', async () => {
  const { driver } = fakeDriver({
    async fetchServedBundle() {
      // Clean markup, private material only in the streamed flight payload.
      return '<html><main>A public evidence page.</main></html>\n3:["$","div",null,{"authorizationBasis":"internal"}]'
    },
  })
  const refusal = await refusalFrom(runRehearsal(driver, GATES))
  assert.equal(refusal.code, 'private-corpus-in-served-bundle')
})

// --- evidence hygiene -------------------------------------------------------

test('secret-shaped text in evidence is refused rather than redacted', () => {
  // Assembled at run time rather than written as literals. These values are
  // invented, but a scanner cannot know that, and a file containing a
  // token-shaped literal is blocked at push and shows up forever in a secret
  // report. The detector under test receives exactly the same strings.
  const join = (...parts: string[]) => parts.join('')
  for (const artifact of [
    { note: join('Authorization: Bearer ', 'sk-', 'abcdefghijklmnopqrstuvwxyz012345') },
    { token: join('sbp', '_', '0123456789abcdef0123456789abcdef01234567') },
    { url: join('postgresql://postgres:', 'hunter2hunter2', '@db.host.supabase.co:5432/postgres') },
    { jwt: join('eyJ', 'hbGciOiJIUzI1NiJ9', '.', 'eyJzdWIiOiIxMjM0NTY3ODkwIn0', '.abc') },
  ]) {
    const refusal = throwsRefusal(() => assertNoSecretShapedText(artifact))
    assert.equal(refusal.code, 'secret-shaped-text-in-evidence')
  }
})

test('a digest is not mistaken for a secret', () => {
  assert.doesNotThrow(() =>
    assertNoSecretShapedText({ targetSha256: 'sha256:655c3ae116314eb3d2f42d40834b64034cac6a6ca7ea3b2f246f9134585ebaee' }),
  )
})

test('the emitted outcome carries no secret-shaped text', async () => {
  const { driver } = fakeDriver()
  const outcome = await runRehearsal(driver, GATES)
  assert.doesNotThrow(() => assertNoSecretShapedText(outcome))
})

// --- phase 7: cleanup is unconditional --------------------------------------

test('a failure after binding still destroys the Preview and ephemeral branch', async () => {
  const { driver, log, liveBranches, livePreviews } = fakeDriver({
    async ingest() {
      throw new Error('ingestion exploded')
    },
  })
  await assert.rejects(runRehearsal(driver, GATES), /ingestion exploded/)
  assert.ok(log.some((entry) => entry.startsWith('destroy-preview:')), 'Preview cleanup must run on the failure path')
  assert.ok(log.some((entry) => entry.startsWith('destroy:')), 'cleanup must run on the failure path')
  assert.equal(livePreviews(), 0)
  assert.equal(liveBranches(), 0)
})

// --- the workflow and script boundaries, checked as text --------------------

const WORKFLOW = readFileSync(resolve(ROOT, '.github/workflows/preview-batch-11-remote-rehearsal.yml'), 'utf8')
const SCRIPT = readFileSync(resolve(ROOT, 'scripts/run-batch-11-remote-rehearsal.ts'), 'utf8')

test('branch readiness treats an initial 404 as asynchronous propagation, not creation failure', () => {
  assert.match(SCRIPT, /const response = await managementResponse\(`\/v1\/branches\/\$\{branchId\}`\)/)
  assert.match(SCRIPT, /if \(response\.status === 404\) \{[\s\S]*?await wait\(3_000\)[\s\S]*?continue/)
})

test('the branch POST is counted before readiness polling can fail', () => {
  const branchId = SCRIPT.indexOf("const branchId = String(created.id ?? created.branch_id ?? '')")
  const counted = SCRIPT.indexOf('lifecycleState.remoteOperationsPerformed += 1', branchId)
  const readiness = SCRIPT.indexOf('const detail = await readyBranchDetail(branchId)', branchId)
  assert.ok(branchId >= 0 && counted > branchId && readiness > counted,
    'the branch mutation and exact handle must be recorded before readiness polling')
})
const BINDING = readFileSync(resolve(ROOT, 'lib/batch-11-preview-binding.ts'), 'utf8')
const POOLER = readFileSync(resolve(ROOT, 'lib/batch-11-supabase-pooler.ts'), 'utf8')

test('the rehearsal never exits authorized-but-unimplemented', () => {
  // The mode this change exists to remove. A run that satisfies all three locks
  // now performs the phases or refuses with a reason; it never stops at
  // "authorized, but nothing is wired up".
  assert.ok(!SCRIPT.includes('authorized-but-unimplemented'))
  assert.ok(!WORKFLOW.includes('authorized-but-unimplemented'))
  assert.ok(SCRIPT.includes("mode: 'executed'"), 'the authorized path must have an executed outcome')
})

test('the workflow is reachable only by manual dispatch', () => {
  const triggers = WORKFLOW.slice(WORKFLOW.indexOf('\non:'), WORKFLOW.indexOf('\npermissions:'))
  assert.ok(triggers.includes('workflow_dispatch:'))
  for (const trigger of ['push:', 'pull_request:', 'schedule:', 'repository_dispatch:']) {
    assert.ok(!triggers.includes(trigger), `${trigger} would make the rehearsal reachable without a human`)
  }
})

test('the workflow carries no Production write credential', () => {
  const referenced = [...WORKFLOW.matchAll(/secrets\.([A-Z_]+)/g)].map((match) => match[1])
  const previewOnly = [
    'SUPABASE_ACCESS_TOKEN',
    'SUPABASE_PROJECT_REF',
    'EPISTEMIC_OPERATIONS_TOKEN',
    'EPISTEMIC_RELEASE_AUTHORITY_TOKEN',
    'VERCEL_AUTOMATION_BYPASS_SECRET',
    'VERCEL_TOKEN',
  ]
  for (const name of referenced) {
    assert.ok(previewOnly.includes(name), `${name} is not a bounded Preview-rehearsal credential`)
  }
  for (const forbidden of ['PRODUCTION_RELEASE_HEALTH_TOKEN', 'MAHA_PRODUCTION_READONLY_URL', 'SUPABASE_DB_PASSWORD']) {
    assert.ok(!referenced.includes(forbidden), `${forbidden} must not be available to a Preview rehearsal`)
  }
  assert.ok(!WORKFLOW.includes('environment: Production'))
  assert.ok(!WORKFLOW.includes('environment: production-database'))
})

test('the workflow refuses the Production Supabase project', () => {
  assert.ok(WORKFLOW.includes(PRODUCTION_SUPABASE_PROJECT_REF), 'the Production ref must be named in order to be refused')
  assert.match(WORKFLOW, /!=\s*'uhwuullakihgszxhiygz'/)
})

test('cleanup runs even when the rehearsal fails', () => {
  const cleanup = WORKFLOW.slice(WORKFLOW.indexOf('Destroy any surviving Preview deployment and ephemeral branch'))
  assert.match(cleanup, /if: always\(\)/)
  assert.match(cleanup, /vercel remove/)
  assert.match(cleanup, /branches/)
})

test('the rehearsal script never combines psql -c with a psql variable', () => {
  // The repository already enforces this for workflows. psql expands :'var'
  // only from a file or stdin; with -c the tokens reach the server literally
  // and fail with `syntax error at or near ":"`. The rule is the same wherever
  // psql is invoked, so it is checked here for the script too.
  const source = SCRIPT.split('\n').filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line)).join('\n')
  const usesCommandFlag = /'-c'/.test(source)
  const variableToken = source.match(/:'[a-zA-Z_][a-zA-Z0-9_]*'/)
  assert.ok(
    !(usesCommandFlag && variableToken),
    `the script passes psql -c and contains ${variableToken?.[0]}; write the SQL to a file or stdin and pass -f or input instead`,
  )
})

test('psql variables in the script are supplied on a path where they expand', () => {
  assert.match(SCRIPT, /-v', `B11_RECORD=/, 'values must arrive as -v variables, not concatenated into SQL')
  assert.match(SCRIPT, /\n\s*sql,\n/, 'the statement must be fed to psql on stdin so :\'var\' expands')
})

test('no credential is passed as a command argument', () => {
  // Anything in argv is visible in the process list. Tokens travel in headers
  // and connection details travel in the environment.
  const deployArgv = BINDING.match(/return \[([\s\S]*?)\]\n\}/)?.[1] ?? ''
  assert.ok(deployArgv, 'the Vercel deployment argv must be inspectable')
  for (const valueVariable of ['managementToken', 'branchServiceRole', 'operationsToken', 'authorityToken', 'bypass', 'vercelToken']) {
    assert.ok(!deployArgv.includes(valueVariable), `${valueVariable} must not reach argv`)
  }
  assert.ok(POOLER.includes('PGPASSWORD: password'), 'the database password must travel in the environment')
  assert.ok(SCRIPT.includes('branchPassword: detail.db_pass'), 'the isolated branch password must bind the pooler environment without turning absence into the string "undefined"')
  assert.match(BINDING, /'--env', 'SUPABASE_SERVICE_ROLE_KEY'/)
  assert.doesNotMatch(deployArgv, /--env', `[^`]*=/, 'Vercel runtime values must be inherited by name, never embedded in argv')
})

test('the exact reviewed commit is deployed only after a schema-only branch is ready', () => {
  assert.match(SCRIPT, /with_data: false/)
  assert.match(SCRIPT, /persistent: false/)
  assert.match(SCRIPT, /git', \['rev-parse', 'HEAD'\]/)
  assert.match(SCRIPT, /MAHA_B11_REVIEWED_COMMIT/)
  assert.doesNotMatch(SCRIPT, /process\.env\.GITHUB_SHA/)
  assert.match(BINDING, /batch11ReviewedCommit=/)
  assert.match(SCRIPT, /verifyPrivatePreview/)
  assert.ok(!WORKFLOW.includes('preview_origin:'), 'an operator-supplied deployment could be bound to the wrong database')
  assert.ok(WORKFLOW.includes('vercel@58.7.1'), 'the deployment client must be pinned')
})

test('the only Production URL the script contacts is the public registry', () => {
  const productionUrls = [...SCRIPT.matchAll(/https:\/\/[^\s'"`]*mahastrategies\.com[^\s'"`]*/g)].map((m) => m[0])
  assert.deepEqual([...new Set(productionUrls)], [])
  assert.ok(SCRIPT.includes('PRODUCTION_REGISTRY_URL'), 'Production access must go through the single named constant')
  assert.equal(PRODUCTION_REGISTRY_URL, 'https://www.mahastrategies.com/knowledge/epistemic-system/releases/registry.json')
})
