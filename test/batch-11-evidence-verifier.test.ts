import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import test from 'node:test'

import { PHASE_ORDER } from '../lib/batch-11-rehearsal-phases.ts'
import {
  TEARDOWN_PRODUCER_VERSION as PRODUCER_VERSION_FOR_RESEAL,
  recomputeObservationsDigest as recomputeForReseal,
} from '../lib/batch-11-teardown-observations.ts'
import {
  REQUIRED_EXECUTION_ORDERS,
  repositoryContract,
  scanForProhibitedContent,
  verifyRehearsalEvidence,
  type RefusalCode,
  type TeardownEvidence,
} from '../lib/batch-11-evidence-verifier.ts'

/**
 * The verifier must refuse a bad run, not describe one.
 *
 * Every case below is a way a rehearsal could look successful while something
 * went wrong, so each asserts a specific refusal code rather than merely that
 * the verdict was not "verified" - a verifier that refuses everything for the
 * wrong reason would pass a weaker test.
 */

const ROOT = resolve(import.meta.dirname, '..')
const FIXTURE = JSON.parse(readFileSync(resolve(ROOT, 'test/fixtures/batch-11-compliant-artifact.json'), 'utf8'))
const CONTRACT = repositoryContract(resolve(ROOT, 'content/frontier-alignment/batch-11-registry-observation.json'))

type Artifact = Record<string, unknown>
const artifact = (): Artifact => structuredClone(FIXTURE.artifact) as Artifact
const teardown = (): TeardownEvidence => structuredClone(FIXTURE.teardown) as TeardownEvidence
const COMMIT: string = FIXTURE.reviewedCommit

function verify(over: { artifact?: Artifact; reviewedCommit?: string; teardown?: TeardownEvidence | null } = {}) {
  return verifyRehearsalEvidence({
    artifact: over.artifact ?? artifact(),
    reviewedCommit: over.reviewedCommit ?? COMMIT,
    teardown: over.teardown === undefined ? teardown() : over.teardown,
  }, CONTRACT)
}


/**
 * Mutates observations and re-seals the report.
 *
 * Without this every mutation trips the digest check first, which would make
 * these tests pass for the wrong reason.
 */
function resealed(mutate: (evidence: TeardownEvidence) => void): TeardownEvidence {
  const evidence = teardown()
  mutate(evidence)
  evidence.observationsDigest = recomputeForReseal({
    schemaVersion: PRODUCER_VERSION_FOR_RESEAL,
    runMarker: evidence.runMarker,
    reviewedCommit: evidence.reviewedCommit,
    observations: evidence.observations as never,
    allConfirmedAbsent: evidence.observations.every((entry) => entry.observedState === 'confirmed-absent'),
  })
  return evidence
}

const refusesWith = (code: RefusalCode, over: Parameters<typeof verify>[0] = {}) => {
  const report = verify(over)
  assert.equal(report.verdict, 'refused')
  assert.ok(report.refusals.includes(code), `expected ${code}, got ${report.refusals.join(', ') || 'none'}`)
  return report
}

/* --------------------------------------------------------- the baseline -- */

test('the bundled fixture is explicitly synthetic and never mistakable for evidence', () => {
  assert.equal(FIXTURE.syntheticFixture, true)
  assert.match(FIXTURE.note, /Not evidence of any rehearsal/i)
})

test('a compliant artifact with confirmed teardown verifies', () => {
  const report = verify()
  assert.equal(report.verdict, 'verified', report.refusals.join(', '))
  assert.deepEqual(report.refusals, [])
  assert.ok(report.checks.length >= 20)
  assert.match(report.verificationDigest, /^sha256:[0-9a-f]{64}$/)
})

/* ------------------------------------------------------------- phases ---- */

test('a missing phase refuses', () => {
  const bad = artifact()
  bad.phases = (bad.phases as unknown[]).slice(0, PHASE_ORDER.length - 1)
  refusesWith('phase-count-wrong', { artifact: bad })
})

test('a duplicated phase refuses', () => {
  const bad = artifact()
  const phases = bad.phases as Record<string, unknown>[]
  phases[phases.length - 1] = structuredClone(phases[0])
  refusesWith('phase-duplicated', { artifact: bad })
})

test('reordered phases refuse even when all seven are present', () => {
  const bad = artifact()
  const phases = bad.phases as Record<string, unknown>[]
  ;[phases[0], phases[1]] = [phases[1], phases[0]]
  const report = refusesWith('phase-out-of-order', { artifact: bad })
  assert.ok(!report.refusals.includes('phase-count-wrong'), 'the count is still right; only the order is wrong')
})

test('a phase that did not execute refuses', () => {
  const bad = artifact()
  ;(bad.phases as Record<string, unknown>[])[3].status = 'refused'
  refusesWith('phase-not-executed', { artifact: bad })
})

/* ------------------------------------------------------------ releases --- */

test('a forged release count refuses', () => {
  for (const count of [4, 6, 0, 50]) {
    const bad = artifact()
    bad.releasesIssued = count
    refusesWith('release-count-mismatch', { artifact: bad })
  }
})

test('a wrong initial/superseding classification refuses', () => {
  const bad = artifact()
  const fingerprint = bad.fingerprint as Record<string, unknown>
  // The total is still five; only the split is wrong.
  fingerprint.supersedingCount = 3
  fingerprint.initialCount = 2
  refusesWith('release-composition-mismatch', { artifact: bad })
})

test('a cohort of the wrong size refuses', () => {
  const bad = artifact()
  ;(bad.fingerprint as Record<string, unknown>).cohortSize = 6
  refusesWith('cohort-size-mismatch', { artifact: bad })
})

/* --------------------------------------------------- digests and records -- */

test('an altered revision or record digest refuses', () => {
  const bad = artifact()
  ;(bad.fingerprint as Record<string, unknown>).planDigest = `sha256:${'f'.repeat(64)}`
  refusesWith('plan-digest-mismatch', { artifact: bad })
})

test('a substituted record refuses', () => {
  const bad = artifact()
  const ids = [...(bad.cohortRecordIds as string[])]
  ids[0] = 'urn:maha:record:agentic-systems-mcp-tool-deny-by-default'
  bad.cohortRecordIds = ids
  refusesWith('record-substituted-or-undeclared', { artifact: bad })
})

test('an unrelated record refuses', () => {
  const bad = artifact()
  bad.cohortRecordIds = [...(bad.cohortRecordIds as string[]), 'urn:maha:record:something-entirely-else']
  refusesWith('record-substituted-or-undeclared', { artifact: bad })
})

test('self-consistent tampering refuses because the digest is re-derived, not echoed', () => {
  // The artifact is internally coherent: the record list, the counts and the
  // plan digest all agree with each other. They disagree with the repository,
  // which is the only reason this is catchable.
  const bad = artifact()
  bad.cohortRecordIds = [
    'urn:maha:record:agentic-systems-mcp-tool-deny-by-default',
    ...(bad.cohortRecordIds as string[]).slice(1),
  ]
  ;(bad.fingerprint as Record<string, unknown>).planDigest = `sha256:${'a1b2c3d4'.repeat(8)}`
  const report = verify({ artifact: bad })
  assert.equal(report.verdict, 'refused')
  assert.ok(report.refusals.includes('plan-digest-mismatch'))
  assert.ok(report.refusals.includes('record-substituted-or-undeclared'))
})

/* ------------------------------------------------- order convergence ----- */

test('a missing order-convergence proof refuses', () => {
  const bad = artifact()
  delete (bad.fingerprint as Record<string, unknown>).orderIndependent
  refusesWith('order-convergence-missing', { artifact: bad })
})

test('an incomplete order-convergence proof refuses', () => {
  for (const orders of [1, 60, REQUIRED_EXECUTION_ORDERS - 1, REQUIRED_EXECUTION_ORDERS + 1]) {
    const bad = artifact()
    ;(bad.fingerprint as Record<string, unknown>).ordersProvenIndependent = orders
    refusesWith('order-convergence-incomplete', { artifact: bad })
  }
})

/* ------------------------------------------------------------ Production -- */

test('any Production write refuses', () => {
  for (const writes of [1, 5, -1]) {
    const bad = artifact()
    bad.productionWritesPerformed = writes
    refusesWith('production-write-detected', { artifact: bad })
  }
})

test('credential-presented Production access refuses', () => {
  const bad = artifact()
  ;(bad.productionAccess as Record<string, unknown>).credentialPresented = true
  refusesWith('production-access-credentialed', { artifact: bad })
})

test('Production access by any means other than a public GET refuses', () => {
  for (const kind of ['postgres', 'authenticated-https-get', 'service-role', undefined]) {
    const bad = artifact()
    ;(bad.productionAccess as Record<string, unknown>).kind = kind
    refusesWith('production-access-not-public-get', { artifact: bad })
  }
})

/* -------------------------------------------------- reviewed commit ------ */

test('a stale reviewed SHA refuses', () => {
  refusesWith('reviewed-commit-mismatch', { reviewedCommit: 'c'.repeat(40) })
})

test('an artifact that names no reviewed commit cannot be tied to reviewed code', () => {
  const bad = artifact()
  delete bad.reviewedCommit
  const report = verify({ artifact: bad })
  assert.equal(report.verdict, 'refused')
  assert.ok(
    report.refusals.includes('reviewed-commit-unbound-in-artifact') || report.refusals.includes('artifact-digest-mismatch'),
    report.refusals.join(', '),
  )
})

/* ------------------------------------------------------------- teardown -- */

test('absent teardown observations refuse: self-reported cleanup is not confirmation', () => {
  refusesWith('teardown-observations-absent', { teardown: null })
  refusesWith('teardown-observations-absent', { teardown: { ...teardown(), observations: [] } })
})

test('partial cleanup refuses', () => {
  // The branch is gone; the deployment was never observed.
  refusesWith('teardown-observations-absent', {
    teardown: resealed((evidence) => { evidence.observations = evidence.observations.filter((entry) => entry.resourceKind === 'supabase-branch') }),
  })
})

test('cleanup reported but not independently observed refuses', () => {
  refusesWith('teardown-reported-not-observed', {
    teardown: resealed((evidence) => { evidence.observations[0].observedState = 'reported-not-observed' }),
  })
})

test('unknown API state refuses rather than being read as absence', () => {
  refusesWith('teardown-state-unknown', {
    teardown: resealed((evidence) => { evidence.observations[1].observedState = 'unknown' }),
  })
})

test('a surviving Preview resource refuses', () => {
  refusesWith('teardown-resource-present', {
    teardown: resealed((evidence) => { evidence.observations[1].observedState = 'present' }),
  })
})

test('only confirmed absence passes, for every resource kind', () => {
  for (const state of ['reported-not-observed', 'unknown', 'present'] as const) {
    for (let index = 0; index < teardown().observations.length; index += 1) {
      const evidence = resealed((draft) => { draft.observations[index].observedState = state })
      assert.equal(verify({ teardown: evidence }).verdict, 'refused', `${state} on ${evidence.observations[index].resourceKind}`)
    }
  }
})

/* ------------------------------------------------------------- content --- */

test('secret-shaped content refuses', () => {
  const join = (...parts: string[]) => parts.join('')
  for (const injected of [
    { note: join('Authorization: Bearer ', 'sk-', 'abcdefghijklmnopqrstuvwxyz012345') },
    { note: join('sbp', '_', '0123456789abcdef0123456789abcdef01234567') },
    { note: join('postgresql://postgres:', 'hunter2hunter2', '@db.host.supabase.co:5432/postgres') },
    { note: join('eyJ', 'hbGciOiJIUzI1NiJ9', '.', 'eyJzdWIiOiIxMjM0NTY3ODkwIn0', '.abc') },
  ]) {
    const bad = { ...artifact(), ...injected }
    refusesWith('secret-shaped-content', { artifact: bad })
  }
})

test('participant, natal, customer, enquiry and payment data refuse', () => {
  for (const injected of [
    { participantId: 'p-1' },
    { natal: { birthTime: '12:00' } },
    { customerEmail: 'someone@example.com' },
    { enquiry: 'inbound' },
    { paymentIntent: 'pi_x' },
  ]) {
    const bad = { ...artifact(), ...injected }
    refusesWith('sensitive-data-detected', { artifact: bad })
  }
})

test('private corpus excerpts and unhashed authority values refuse', () => {
  refusesWith('sensitive-data-detected', { artifact: { ...artifact(), note: 'disposition: reject-or-hold' } })
  refusesWith('sensitive-data-detected', { artifact: { ...artifact(), authorizationBasis: 'the owner approved' } })
})

test('a digest is not mistaken for a secret', () => {
  assert.deepEqual(scanForProhibitedContent({ planDigest: `sha256:${'6'.repeat(64)}` }), { secrets: [], sensitive: [] })
})

/* ---------------------------------------------------------- malformed ---- */

test('a malformed artifact refuses instead of throwing', () => {
  for (const value of [null, 'not an object', 42, []]) {
    const report = verifyRehearsalEvidence({ artifact: value, reviewedCommit: COMMIT }, CONTRACT)
    assert.equal(report.verdict, 'refused')
    assert.deepEqual(report.refusals, ['artifact-malformed'])
  }
})

test('mode other than executed refuses', () => {
  for (const mode of ['blocked', 'dry-run', 'refused', 'authorized-but-unimplemented', undefined]) {
    const bad = artifact()
    bad.mode = mode
    refusesWith('mode-not-executed', { artifact: bad })
  }
})

/* ------------------------------------------------- determinism & digest -- */

test('the verification digest is stable and excludes free text and timestamps', () => {
  const first = verify()
  const second = verify()
  assert.equal(first.verificationDigest, second.verificationDigest)

  // Reworded detail and an added observation timestamp must not move it.
  const reworded = resealed((evidence) => {
    evidence.observations[0].detail = 'Completely different prose describing the same observation.'
    evidence.observations[0].observedAt = '2026-08-31T12:00:00.000Z'
  })
  assert.equal(verify({ teardown: reworded }).verificationDigest, first.verificationDigest)

  // A changed verdict must move it.
  const bad = artifact()
  bad.productionWritesPerformed = 1
  assert.notEqual(verify({ artifact: bad }).verificationDigest, first.verificationDigest)
})

test('the reports regenerate byte-identically', () => {
  const paths = [
    'content/frontier-audit/batch-11-verification-report.json',
    'docs/frontier-audit/batch-11-verification-report.md',
    'test/fixtures/batch-11-compliant-artifact.json',
  ]
  const before = paths.map((path) => readFileSync(resolve(ROOT, path), 'utf8'))
  execFileSync('node', ['--experimental-strip-types', 'scripts/generate-batch-11-verification-fixture.ts'], { cwd: ROOT })
  execFileSync('node', ['--experimental-strip-types', 'scripts/verify-batch-11-rehearsal-evidence.ts'], { cwd: ROOT })
  paths.forEach((path, index) => {
    assert.equal(readFileSync(resolve(ROOT, path), 'utf8'), before[index], `${path} is not deterministic`)
  })
})

test('the reports carry no generation timestamp or absolute path', () => {
  for (const path of [
    'content/frontier-audit/batch-11-verification-report.json',
    'docs/frontier-audit/batch-11-verification-report.md',
  ]) {
    const text = readFileSync(resolve(ROOT, path), 'utf8')
    assert.ok(!/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(text), `${path} contains a timestamp`)
    assert.ok(!/\/(Users|home|private\/tmp)\//.test(text), `${path} contains an absolute path`)
  }
})

test('the verifier makes no remote call and mutates nothing', () => {
  const source = readFileSync(resolve(ROOT, 'lib/batch-11-evidence-verifier.ts'), 'utf8')
  // Invocation shapes, not vocabulary: the module legitimately names
  // "vercel-preview" as a resource kind and "vercel token" as a scanner label.
  for (const forbidden of ['fetch(', 'execFileSync', 'spawnSync', 'writeFileSync', 'https://api.', 'psql']) {
    assert.ok(!source.includes(forbidden), `the verifier must not contain ${forbidden}`)
  }
  // readFileSync is the one filesystem call it makes, and only for manifests.
  const reads = [...source.matchAll(/readFileSync\(([^)]*)\)/g)].map((m) => m[1])
  assert.equal(reads.length, 1, 'the verifier reads exactly one path, the registry observation')
  assert.match(reads[0], /observationPath/)
})

/* ------------------------------------------------------ public boundary -- */

test('no verifier artifact reaches a client bundle, route, sitemap or llms.txt', () => {
  const markers = ['batch-11-evidence-verifier', 'batch-11-verification-report', 'batch-11-compliant-artifact']
  const clientEntries: string[] = []
  const collect = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name)
      if (entry.isDirectory()) collect(path)
      else if (/\.tsx?$/.test(entry.name) && /^\s*['"]use client['"]/.test(readFileSync(path, 'utf8'))) clientEntries.push(path)
    }
  }
  for (const dir of ['app', 'components']) if (existsSync(join(ROOT, dir))) collect(join(ROOT, dir))
  assert.ok(clientEntries.length > 0)

  const seen = new Set<string>()
  const queue = [...clientEntries]
  while (queue.length > 0) {
    const file = queue.pop()!
    if (seen.has(file) || !existsSync(file)) continue
    seen.add(file)
    const source = readFileSync(file, 'utf8')
    for (const marker of markers) {
      assert.ok(!source.includes(marker), `${file.replace(ROOT, '')} pulls ${marker} into a client bundle`)
    }
    for (const match of source.matchAll(/from\s+'(\.[^']+)'/g)) {
      const target = resolve(dirname(file), match[1])
      for (const candidate of [target, `${target}.ts`, `${target}.tsx`, join(target, 'index.ts')]) {
        if (existsSync(candidate) && !seen.has(candidate)) queue.push(candidate)
      }
    }
  }
  for (const served of ['app/sitemap.ts', 'lib/llms-manifest.ts']) {
    if (!existsSync(join(ROOT, served))) continue
    const source = readFileSync(join(ROOT, served), 'utf8')
    for (const marker of markers) assert.ok(!source.includes(marker), `${served} references ${marker}`)
  }
  assert.ok(!existsSync(join(ROOT, 'public/frontier-audit')))
})

/* ============================================================ binding ===== */

import {
  BOUND_EVIDENCE_SCHEMA,
  EvidenceBindingRefused,
  bindReviewedCommit,
  boundEvidenceDigest,
} from '../lib/batch-11-evidence-binding.ts'
import {
  TEARDOWN_RESOURCE_KINDS,
  assertSanitized,
  produceTeardownObservations,
  type ProviderQueryResult,
} from '../lib/batch-11-teardown-observations.ts'

test('the reviewed commit is bound into the artifact digest', () => {
  const bound = artifact()
  const original = String(bound.artifactDigest)
  // Same run, different commit: the digest must move.
  const moved = boundEvidenceDigest({
    artifactSchema: BOUND_EVIDENCE_SCHEMA,
    reviewedCommit: 'd'.repeat(40),
    workflowRunId: String(bound.workflowRunId),
    runMarker: String(bound.runMarker),
    planDigest: String(bound.planDigest),
    cohortRecordIds: bound.cohortRecordIds as string[],
    lineageClassifications: bound.lineageClassifications as never,
    phaseOutcomes: bound.phaseOutcomes as never,
    releaseIdentities: bound.releaseIdentities as never,
    releaseCounts: bound.releaseCounts as never,
    deploymentMarkerDigest: bound.deploymentMarkerDigest as string | null,
    teardownHandleDigests: bound.teardownHandleDigests as never,
    cleanup: bound.cleanup as never,
    identities: bound.identities as never,
  })
  assert.notEqual(moved, original, 'the reviewed commit must be inside the digest')
})

test('a correct artifact from another commit is refused', () => {
  // Everything else is right; only the commit differs. Both the supplied SHA
  // and the artifact's own field are changed together, so this is not merely a
  // mismatch between them - it is a coherent artifact from the wrong tree.
  const other = 'd'.repeat(40)
  const bad = artifact()
  bad.reviewedCommit = other
  const evidence = teardown()
  evidence.reviewedCommit = other
  const report = verify({ artifact: bad, reviewedCommit: other, teardown: evidence })
  assert.equal(report.verdict, 'refused')
  assert.ok(report.refusals.includes('artifact-digest-mismatch'), report.refusals.join(', '))
})

test('a malformed or missing reviewed commit fails closed at binding time', () => {
  for (const [expected, checkedOut, code] of [
    ['', 'a'.repeat(40), 'reviewed-commit-malformed'],
    ['not-a-sha', 'a'.repeat(40), 'reviewed-commit-malformed'],
    ['A'.repeat(40), 'A'.repeat(40), 'reviewed-commit-malformed'],
    ['a'.repeat(40), 'b'.repeat(40), 'reviewed-commit-mismatch'],
  ] as const) {
    let caught: EvidenceBindingRefused | null = null
    try {
      bindReviewedCommit(expected, checkedOut)
    } catch (error) {
      assert.ok(error instanceof EvidenceBindingRefused, `expected EvidenceBindingRefused, got ${String(error)}`)
      caught = error
    }
    assert.ok(caught, `${expected || '<empty>'} / ${checkedOut} should have refused`)
    assert.equal(caught.code, code)
  }
  assert.equal(bindReviewedCommit('a'.repeat(40), 'a'.repeat(40)), 'a'.repeat(40))
})

test('missing cohort ids refuse; identity may not rest on the plan digest alone', () => {
  const bad = artifact()
  delete bad.cohortRecordIds
  refusesWith('cohort-identity-missing', { artifact: bad })
})

test('reordered cohort ids refuse even when the set is complete', () => {
  const bad = artifact()
  const ids = [...(bad.cohortRecordIds as string[])]
  ;[ids[0], ids[1]] = [ids[1], ids[0]]
  bad.cohortRecordIds = ids
  const report = verify({ artifact: bad })
  assert.equal(report.verdict, 'refused')
  assert.ok(report.refusals.includes('cohort-order-mismatch'), report.refusals.join(', '))
})

test('a lineage classification the registry did not observe refuses', () => {
  const bad = artifact()
  const classifications = bad.lineageClassifications as Record<string, string>[]
  classifications[0].observed = classifications[0].expected === 'initial' ? 'superseding' : 'initial'
  refusesWith('lineage-classification-mismatch', { artifact: bad })
})

test('missing or incomplete release identities refuse', () => {
  const missing = artifact()
  missing.releaseIdentities = []
  refusesWith('release-identity-missing', { artifact: missing })

  const incomplete = artifact()
  ;(incomplete.releaseIdentities as Record<string, unknown>[])[0].releaseId = ''
  refusesWith('release-identity-missing', { artifact: incomplete })
})

test('missing cleanup status refuses', () => {
  const bad = artifact()
  delete bad.cleanup
  refusesWith('cleanup-status-missing', { artifact: bad })
})

test('the wrong artifact schema refuses', () => {
  const bad = artifact()
  bad.artifactSchema = 'maha-batch-11-rehearsal-evidence/1.0'
  refusesWith('artifact-schema-missing', { artifact: bad })
})

/* ================================================== teardown producer ===== */

const query = (over: Partial<ProviderQueryResult> = {}): ProviderQueryResult => ({
  provider: 'supabase',
  resourceKind: 'supabase-branch',
  queryStatus: 'succeeded',
  scope: 'exact-run-marker',
  runMarker: FIXTURE.runMarker,
  reviewedCommit: COMMIT,
  identifierFingerprint: FIXTURE.artifact.teardownHandleDigests['supabase-branch'],
  matches: [],
  detail: '',
  ...over,
})

const cleanResults = (): ProviderQueryResult[] =>
  TEARDOWN_RESOURCE_KINDS.map((kind) => query({
    resourceKind: kind,
    provider: kind.split('-')[0],
    identifierFingerprint: FIXTURE.artifact.teardownHandleDigests[kind],
  }))

const produce = (results: ProviderQueryResult[]) =>
  produceTeardownObservations({
    runMarker: FIXTURE.runMarker,
    reviewedCommit: COMMIT,
    expectedFingerprints: FIXTURE.artifact.teardownHandleDigests,
    results,
  })

test('the producer confirms absence only when every query succeeded at exact scope', () => {
  const report = produce(cleanResults())
  assert.equal(report.allConfirmedAbsent, true)
  assert.equal(report.observations.length, TEARDOWN_RESOURCE_KINDS.length)
  for (const observation of report.observations) {
    assert.equal(observation.observedState, 'confirmed-absent')
    assert.equal(observation.refusal, null)
  }
})

test('a failed provider query can never become confirmed-absent', () => {
  for (const status of ['failed', 'malformed', 'not-attempted'] as const) {
    const results = cleanResults()
    results[0].queryStatus = status
    const report = produce(results)
    assert.equal(report.observations[0].observedState, 'unknown')
    assert.equal(report.observations[0].refusal, 'query-did-not-succeed')
    assert.equal(report.allConfirmedAbsent, false)
  }
})

test('a partial or unknown query scope cannot support an absence claim', () => {
  for (const scope of ['partial', 'unknown'] as const) {
    const results = cleanResults()
    results[1].scope = scope
    const report = produce(results)
    assert.equal(report.observations[1].observedState, 'unknown')
    assert.equal(report.observations[1].refusal, 'scope-insufficient')
  }
})

test('a stale run marker or another commit cannot support an absence claim', () => {
  const stale = cleanResults()
  stale[0].runMarker = 'batch-11-mixed-lineage-rehearsal-99'
  assert.equal(produce(stale).observations[0].refusal, 'stale-run-marker')

  const other = cleanResults()
  other[0].reviewedCommit = 'd'.repeat(40)
  assert.equal(produce(other).observations[0].refusal, 'commit-mismatch')
})

test('a query for a different exact identifier cannot support absence', () => {
  const results = cleanResults()
  results[0].identifierFingerprint = `sha256:${'4'.repeat(64)}`
  const report = produce(results)
  assert.equal(report.observations[0].observedState, 'unknown')
  assert.equal(report.observations[0].refusal, 'identifier-mismatch')
})

test('a missing query for any resource is unknown, not absent', () => {
  const results = cleanResults().filter((entry) => entry.resourceKind !== 'database-release-rows')
  const report = produce(results)
  const rows = report.observations.find((entry) => entry.resourceKind === 'database-release-rows')!
  assert.equal(rows.observedState, 'unknown')
  assert.equal(rows.refusal, 'no-query-for-resource')
})

test('a surviving resource is present, and provider disagreement is flagged', () => {
  const results = cleanResults()
  results[0].matches = [{ identifierFingerprint: `sha256:${'9'.repeat(64)}`, status: 'ACTIVE' }]
  assert.equal(produce(results).observations[0].refusal, 'resource-present')

  // A second provider for the same kind reports none: they disagree.
  const disagreeing = [...cleanResults(), query({ provider: 'audit', matches: [] })]
  disagreeing[0].matches = [{ identifierFingerprint: `sha256:${'8'.repeat(64)}`, status: 'ACTIVE' }]
  const report = produceTeardownObservations({
    runMarker: FIXTURE.runMarker,
    reviewedCommit: COMMIT,
    expectedFingerprints: FIXTURE.artifact.teardownHandleDigests,
    results: disagreeing,
  })
  assert.equal(report.observations[0].observedState, 'present')
  assert.equal(report.observations[0].refusal, 'provider-disagreement')
})

test('unrelated provider resources do not affect the result', () => {
  const results = cleanResults()
  // Another run's resources, reported alongside. They are for a different
  // marker, so they must not be read as this run's survivors.
  results.push(query({ provider: 'supabase', runMarker: 'batch-11-mixed-lineage-rehearsal-42', matches: [{ identifierFingerprint: `sha256:${'7'.repeat(64)}`, status: 'ACTIVE' }] }))
  const report = produce(results)
  // The foreign match makes this kind unresolvable rather than silently absent.
  assert.notEqual(report.observations[0].observedState, 'confirmed-absent')
  // Every other resource kind is unaffected.
  for (const observation of report.observations.slice(1)) {
    assert.equal(observation.observedState, 'confirmed-absent', observation.resourceKind)
  }
})

test('the producer refuses credential-shaped input outright', () => {
  const join = (...parts: string[]) => parts.join('')
  for (const detail of [
    join('Authorization: Bearer ', 'sk-', 'abcdefghijklmnopqrstuvwxyz012345'),
    join('sbp', '_', '0123456789abcdef0123456789abcdef01234567'),
    join('postgresql://postgres:', 'hunter2hunter2', '@db.host.supabase.co:5432/postgres'),
  ]) {
    const results = cleanResults()
    results[0].detail = detail
    assert.throws(() => produce(results), /credential-shaped/i)
  }
  assert.doesNotThrow(() => assertSanitized(cleanResults()))
})

test('the producer makes no network call', () => {
  const source = readFileSync(resolve(ROOT, 'lib/batch-11-teardown-observations.ts'), 'utf8')
  for (const forbidden of ['fetch(', 'execFileSync', 'https://api.', 'readFileSync', 'writeFileSync']) {
    assert.ok(!source.includes(forbidden), `the producer must not contain ${forbidden}`)
  }
})

test('produced observations are deterministic', () => {
  assert.equal(produce(cleanResults()).observationsDigest, produce(cleanResults()).observationsDigest)
  const changed = cleanResults()
  changed[0].queryStatus = 'failed'
  assert.notEqual(produce(changed).observationsDigest, produce(cleanResults()).observationsDigest)
})

/* ================================================ end-to-end and legacy === */

test('the whole chain verifies: bound evidence -> observations -> verifier', () => {
  const produced = produce(cleanResults())
  const report = verifyRehearsalEvidence({
    artifact: artifact(),
    reviewedCommit: COMMIT,
    teardown: { ...produced, workflowRunId: FIXTURE.workflowRunId },
  }, CONTRACT)
  assert.equal(report.verdict, 'verified', report.refusals.join(', '))
  assert.equal(produced.allConfirmedAbsent, true)
})

test('observations from another run are refused as stale', () => {
  const evidence = teardown()
  evidence.reviewedCommit = 'd'.repeat(40)
  refusesWith('teardown-observations-stale', { teardown: evidence })
})

test('the live dry-run artifact remains refused', () => {
  // Whatever mode the current cohort produces, a run that did not execute the
  // lifecycle must never verify.
  const output = execFileSync('node', ['--experimental-strip-types', 'scripts/run-batch-11-remote-rehearsal.ts'], { cwd: ROOT, encoding: 'utf8' })
  const live = JSON.parse(output) as Record<string, unknown>
  assert.notEqual(live.mode, 'executed')
  const report = verifyRehearsalEvidence({ artifact: live, reviewedCommit: COMMIT, teardown: null }, CONTRACT)
  assert.equal(report.verdict, 'refused')
  assert.ok(report.refusals.includes('mode-not-executed'))
  assert.ok(report.refusals.includes('teardown-observations-absent'))
})

/* ================================ producer report coupling ================ */

import {
  TEARDOWN_PRODUCER_VERSION,
  recomputeObservationsDigest,
} from '../lib/batch-11-teardown-observations.ts'

test('a handcrafted "everything absent" object is refused: it is not a producer report', () => {
  // The shape a well-meaning operator would assemble by hand. Every resource
  // says confirmed-absent, and none of it was produced by anything.
  const handcrafted = {
    reviewedCommit: COMMIT,
    runMarker: FIXTURE.runMarker,
    observations: TEARDOWN_RESOURCE_KINDS.map((kind) => ({
      resourceKind: kind,
      identifierFingerprint: `sha256:${'0'.repeat(64)}`,
      observedState: 'confirmed-absent' as const,
      detail: 'Checked manually; nothing there.',
    })),
  }
  refusesWith('teardown-report-schema-invalid', { teardown: handcrafted as never })
})

test('a producer report whose digest does not recompute is refused', () => {
  const tampered = teardown()
  tampered.observationsDigest = `sha256:${'e'.repeat(64)}`
  refusesWith('teardown-report-digest-mismatch', { teardown: tampered })
})

test('a duplicated observation is refused', () => {
  const duplicated = teardown()
  duplicated.observations = [...duplicated.observations, duplicated.observations[0]]
  duplicated.observationsDigest = recomputeObservationsDigest({
    schemaVersion: TEARDOWN_PRODUCER_VERSION,
    runMarker: duplicated.runMarker,
    reviewedCommit: duplicated.reviewedCommit,
    observations: duplicated.observations as never,
    allConfirmedAbsent: true,
  })
  refusesWith('teardown-observation-duplicated', { teardown: duplicated })
})

test('an observation for an unsupported resource kind is refused', () => {
  const extra = teardown()
  extra.observations = [...extra.observations, {
    resourceKind: 'some-other-thing' as never,
    identifierFingerprint: `sha256:${'f'.repeat(64)}`,
    observedState: 'confirmed-absent',
    detail: 'An unrelated resource.',
  }]
  extra.observationsDigest = recomputeObservationsDigest({
    schemaVersion: TEARDOWN_PRODUCER_VERSION,
    runMarker: extra.runMarker,
    reviewedCommit: extra.reviewedCommit,
    observations: extra.observations as never,
    allConfirmedAbsent: true,
  })
  refusesWith('teardown-observation-unsupported-kind', { teardown: extra })
})

test('an omitted resource kind is refused', () => {
  const omitted = teardown()
  omitted.observations = omitted.observations.filter((entry) => entry.resourceKind !== 'database-release-rows')
  omitted.observationsDigest = recomputeObservationsDigest({
    schemaVersion: TEARDOWN_PRODUCER_VERSION,
    runMarker: omitted.runMarker,
    reviewedCommit: omitted.reviewedCommit,
    observations: omitted.observations as never,
    allConfirmedAbsent: true,
  })
  refusesWith('teardown-observations-absent', { teardown: omitted })
})

test('an observation fingerprint that does not match the bound exact handle is refused', () => {
  const forged = teardown()
  forged.observations = forged.observations.map((entry, index) =>
    index === 0 ? { ...entry, identifierFingerprint: `sha256:${'a'.repeat(64)}` } : entry)
  forged.observationsDigest = recomputeObservationsDigest({
    schemaVersion: TEARDOWN_PRODUCER_VERSION,
    runMarker: forged.runMarker,
    reviewedCommit: forged.reviewedCommit,
    observations: forged.observations as never,
    allConfirmedAbsent: true,
  })
  refusesWith('teardown-fingerprint-mismatch', { teardown: forged })
})

test('observations copied from another run are refused', () => {
  const copied = teardown()
  copied.workflowRunId = '999'
  copied.runMarker = 'batch-11-mixed-lineage-rehearsal-999'
  refusesWith('teardown-run-mismatch', { teardown: copied })
})

test('the collector never reports absence without a successful query', () => {
  // Standing in for the operator path: with no credentials supplied, every
  // resource is unknown and nothing is confirmed absent.
  const source = readFileSync(resolve(ROOT, 'scripts/collect-batch-11-teardown-evidence.ts'), 'utf8')
  assert.match(source, /not-attempted/, 'an unsupplied credential must produce not-attempted, not an empty match list')
  assert.match(source, /status: 'failed'/, 'a failed request must produce failed')
  assert.match(source, /status: 'malformed'/, 'an uninterpretable body must produce malformed')
  assert.match(source, /assertSanitized\(payload\)/, 'the written report must be scanned before it lands')
  assert.match(source, /if \(!report\.allConfirmedAbsent\)/, 'unconfirmed teardown must enter an explicit refusal branch')
  assert.match(source, /if \(!partialSafe\) process\.exit\(1\)/, 'a green partial exit must require the three exact non-secret resources absent')
  // Exact identifiers are reduced to digests bound by the public artifact.
  assert.match(source, /teardownHandleDigests\(handles\)/)
  assert.match(source, /expected\[kind\]/)
  assert.match(source, /\/v1\/branches\/\$\{encodeURIComponent\(handles\.supabaseBranch\.branchId\)\}/)
  assert.match(source, /\/v13\/deployments\/\$\{encodeURIComponent\(handles\.vercelPreview\.deploymentId\)\}/)
  assert.doesNotMatch(source, /rehearsalRunMarker|registry\.json|\.includes\(runMarker\)/)

  const finalizer = readFileSync(resolve(ROOT, 'scripts/finalize-batch-11-teardown-evidence.ts'), 'utf8')
  assert.match(finalizer, /TEMPORARY_ENVIRONMENT_SECRET_NAMES/)
  assert.match(finalizer, /requiredPrior/)
  assert.match(finalizer, /if \(!report\.allConfirmedAbsent\) process\.exit\(1\)/)
})
