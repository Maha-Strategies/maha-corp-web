import assert from 'node:assert/strict'
import { execFileSync, spawn } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import test from 'node:test'

import {
  PERSISTENT_PREVIEW_BINDING_NAMES,
  TEMPORARY_ENVIRONMENT_SECRET_NAMES,
  assertDeletableNames,
  environmentSecretSlotFingerprint,
  teardownHandleDigests,
  type ExactTeardownHandles,
} from '../lib/batch-11-evidence-binding.ts'

/**
 * The temporary-versus-persistent lifecycle contract.
 *
 * Two lists used to disagree about which Batch 11 bindings are temporary, and
 * the disagreement was not cosmetic. The teardown list classified
 * SUPABASE_PROJECT_REF and VERCEL_TOKEN as temporary, so the finalizer looked
 * for them to be absent from an environment the runbook says to leave them in -
 * meaning a correct cleanup could never have been confirmed. It also omitted
 * SUPABASE_ACCESS_TOKEN_SHA256, so the binding that records which token a run
 * was authorized for could survive without anything noticing.
 *
 * These tests freeze the contract: one set of five, one set of two, disjoint,
 * order-independent, and reachable from nothing the public serves.
 */

const ROOT = resolve(import.meta.dirname, '..')

const EXPECTED_TEMPORARY = [
  'EPISTEMIC_OPERATIONS_TOKEN',
  'EPISTEMIC_RELEASE_AUTHORITY_TOKEN',
  'SUPABASE_ACCESS_TOKEN',
  'SUPABASE_ACCESS_TOKEN_SHA256',
  'VERCEL_AUTOMATION_BYPASS_SECRET',
]
const EXPECTED_PERSISTENT = ['SUPABASE_PROJECT_REF', 'VERCEL_TOKEN']

/* --- the contract itself -------------------------------------------------- */

test('the temporary set is exactly the five bindings a rehearsal is issued', () => {
  assert.deepEqual([...TEMPORARY_ENVIRONMENT_SECRET_NAMES].sort(), [...EXPECTED_TEMPORARY].sort())
  assert.equal(TEMPORARY_ENVIRONMENT_SECRET_NAMES.length, 5)
})

test('the persistent set is exactly the two bindings that outlive every run', () => {
  assert.deepEqual([...PERSISTENT_PREVIEW_BINDING_NAMES].sort(), [...EXPECTED_PERSISTENT].sort())
  assert.equal(PERSISTENT_PREVIEW_BINDING_NAMES.length, 2)
})

test('the two sets are disjoint: nothing is both temporary and persistent', () => {
  const overlap = TEMPORARY_ENVIRONMENT_SECRET_NAMES
    .filter((name) => (PERSISTENT_PREVIEW_BINDING_NAMES as readonly string[]).includes(name))
  assert.deepEqual(overlap, [])
})

test('the fingerprint binding is temporary, and cannot be dropped from the set', () => {
  // SUPABASE_ACCESS_TOKEN_SHA256 is what says which token a run was authorized
  // for. Leaving it bound after cleanup leaves that pointer behind.
  assert.ok((TEMPORARY_ENVIRONMENT_SECRET_NAMES as readonly string[]).includes('SUPABASE_ACCESS_TOKEN_SHA256'))
  assert.throws(
    () => assertDeletableNames(TEMPORARY_ENVIRONMENT_SECRET_NAMES.filter((n) => n !== 'SUPABASE_ACCESS_TOKEN_SHA256')),
    /SUPABASE_ACCESS_TOKEN_SHA256.*must be accounted for/,
  )
})

test('a persistent binding cannot enter a deletion set', () => {
  for (const name of PERSISTENT_PREVIEW_BINDING_NAMES) {
    assert.throws(
      () => assertDeletableNames([...TEMPORARY_ENVIRONMENT_SECRET_NAMES, name]),
      new RegExp(`${name}.*must survive cleanup`),
    )
  }
})

/* --- one constant, every consumer ----------------------------------------- */

test('every consumer derives from the one canonical constant', () => {
  const consumers = [
    'lib/batch-11-closure-verifier.ts',
    'scripts/finalize-batch-11-teardown-evidence.ts',
    'scripts/generate-batch-11-verification-fixture.ts',
    'scripts/collect-batch-11-revocation-evidence.ts',
    'scripts/run-batch-11-remote-rehearsal.ts',
  ]
  for (const consumer of consumers) {
    const source = readFileSync(resolve(ROOT, consumer), 'utf8')
    assert.match(source, /TEMPORARY_ENVIRONMENT_SECRET_NAMES/, `${consumer} must use the canonical constant`)
    // A literal list is how the two sets drifted apart in the first place.
    assert.ok(!/'SUPABASE_ACCESS_TOKEN_SHA256'/.test(source),
      `${consumer} must not restate a secret name literally`)
  }
})

test('the superseded constant names are gone from the tree', () => {
  const stale = ['TEMPORARY_PREVIEW_SECRET_NAMES', 'TEMPORARY_REVOCABLE_SECRET_NAMES']
  const walk = (dir: string): string[] => readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return entry.name === 'node_modules' || entry.name === '.next' ? [] : walk(path)
    return /\.tsx?$/.test(entry.name) ? [path] : []
  })
  for (const dir of ['lib', 'scripts', 'test', 'app']) {
    for (const file of walk(join(ROOT, dir))) {
      const source = readFileSync(file, 'utf8')
      for (const name of stale) {
        // This file names them once each, above, to say they are gone.
        if (file.endsWith('batch-11-secret-lifecycle.test.ts')) continue
        assert.ok(!source.includes(name), `${file} still references ${name}`)
      }
    }
  }
})

/* --- digests -------------------------------------------------------------- */

const handles = (names: readonly string[]): ExactTeardownHandles => ({
  schemaVersion: 'maha-batch-11-private-teardown-handles/1.0',
  workflowRunId: '77',
  runMarker: 'batch-11-mixed-lineage-rehearsal-77',
  reviewedCommit: 'b'.repeat(40),
  supabaseBranch: { branchId: 'branch', parentProjectRef: 'staging' },
  vercelPreview: { deploymentId: 'dpl', origin: 'https://x.vercel.app' },
  githubEnvironmentSecrets: { environment: 'batch-11-preview-rehearsal', names },
  databaseReleaseRows: { branchId: 'branch', releaseIds: ['r1'] },
})

const slot = (names: readonly string[]) => environmentSecretSlotFingerprint({
  environment: 'batch-11-preview-rehearsal',
  names,
  runMarker: 'batch-11-mixed-lineage-rehearsal-77',
  reviewedCommit: 'b'.repeat(40),
})

test('the digest is a property of the set, not of the order it is written in', () => {
  const forward = [...TEMPORARY_ENVIRONMENT_SECRET_NAMES]
  const reversed = [...forward].reverse()
  const shuffled = [forward[3], forward[0], forward[4], forward[1], forward[2]]

  assert.equal(slot(reversed), slot(forward))
  assert.equal(slot(shuffled), slot(forward))
  assert.equal(
    teardownHandleDigests(handles(reversed))['github-environment-secret'],
    teardownHandleDigests(handles(forward))['github-environment-secret'],
  )
})

test('a substituted, added or missing name refuses rather than digesting', () => {
  const substituted = TEMPORARY_ENVIRONMENT_SECRET_NAMES
    .map((name) => (name === 'SUPABASE_ACCESS_TOKEN' ? 'SUPABASE_PROJECT_REF' : name))

  for (const names of [
    substituted,
    [...TEMPORARY_ENVIRONMENT_SECRET_NAMES, 'VERCEL_TOKEN'],
    TEMPORARY_ENVIRONMENT_SECRET_NAMES.slice(1),
    [],
  ]) {
    assert.throws(() => slot(names), /must survive cleanup|must be accounted for/)
    assert.throws(() => teardownHandleDigests(handles(names)), /must survive cleanup|must be accounted for/)
  }
})

test('a name set that is merely reordered still verifies, and the fixture matches it', () => {
  const fixture = JSON.parse(readFileSync(resolve(ROOT, 'test/fixtures/batch-11-compliant-artifact.json'), 'utf8'))
  const observed = (fixture.revocation.observations as Array<{ credential: string; credentialFingerprint: string }>)
    .find((entry) => entry.credential === 'github-environment-secrets')!
  assert.equal(observed.credentialFingerprint, environmentSecretSlotFingerprint({
    environment: 'batch-11-preview-rehearsal',
    names: [...TEMPORARY_ENVIRONMENT_SECRET_NAMES].reverse(),
    runMarker: String(fixture.artifact.runMarker),
    reviewedCommit: String(fixture.artifact.reviewedCommit),
  }))
})

/* --- cleanup, against a controlled provider listing ------------------------ */

function sleepSync(ms: number): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)
}

/** Runs the finalizer against a stub GitHub listing of environment secrets. */
function finalizeAgainst(listed: string[]): { code: number; report: Record<string, unknown> | null } {
  const dir = mkdtempSync(join(tmpdir(), 'b11-final-'))
  const portFile = join(dir, 'port')
  const child = spawn('node', ['--experimental-strip-types', 'test/helpers/loopback-provider-stub.ts'], {
    cwd: ROOT,
    stdio: 'ignore',
    env: {
      ...process.env,
      MAHA_STUB_ROUTES: JSON.stringify({ github: { status: 200, body: { secrets: listed.map((name) => ({ name })) } } }),
      MAHA_STUB_PORT_FILE: portFile,
    },
  })
  try {
    // Sleeps on every unsuccessful attempt. Sleeping only in the catch made an
    // existing-but-empty file spin through all the attempts in microseconds,
    // which on a loaded runner looked like the stub never starting at all.
    let port = ''
    for (let attempt = 0; attempt < 200 && !port; attempt += 1) {
      try { port = readFileSync(portFile, 'utf8').trim() } catch { /* not yet */ }
      if (!port) sleepSync(25)
    }
    assert.ok(port, 'the loopback provider stub never reported a port')

    const fixture = JSON.parse(readFileSync(resolve(ROOT, 'test/fixtures/batch-11-compliant-artifact.json'), 'utf8'))
    const artifactPath = join(dir, 'artifact.json')
    const partialPath = join(dir, 'partial.json')
    const outPath = join(dir, 'teardown.json')
    writeFileSync(artifactPath, JSON.stringify(fixture.artifact))
    // The three non-GitHub results the workflow uploads. Their fingerprints come
    // from the artifact's own handle digests, which is what the finalizer checks
    // them against before it will touch the GitHub half at all.
    const digests = fixture.artifact.teardownHandleDigests as Record<string, string>
    writeFileSync(partialPath, JSON.stringify({
      workflowRunId: fixture.artifact.workflowRunId,
      runMarker: fixture.artifact.runMarker,
      reviewedCommit: fixture.artifact.reviewedCommit,
      providerResults: ['supabase-branch', 'vercel-preview', 'database-release-rows'].map((kind) => ({
        provider: kind.split('-')[0],
        resourceKind: kind,
        queryStatus: 'succeeded',
        scope: 'exact-run-marker',
        runMarker: fixture.artifact.runMarker,
        reviewedCommit: fixture.artifact.reviewedCommit,
        identifierFingerprint: digests[kind],
        matches: [],
        detail: `Queried ${kind} at exact run-marker scope; no matching resource remained.`,
      })),
    }))

    const options = {
      cwd: ROOT,
      encoding: 'utf8' as const,
      env: { ...process.env, MAHA_B11_GITHUB_API: `http://127.0.0.1:${port}`, GITHUB_TOKEN: 'stub-token' },
    }
    const parse = () => {
      try { return JSON.parse(readFileSync(outPath, 'utf8')) as Record<string, unknown> } catch { return null }
    }
    try {
      execFileSync('node', ['--experimental-strip-types', 'scripts/finalize-batch-11-teardown-evidence.ts',
        '--artifact', artifactPath, '--partial', partialPath, '--out', outPath], options)
      return { code: 0, report: parse() }
    } catch (error) {
      return { code: (error as { status?: number }).status ?? 1, report: parse() }
    }
  } finally {
    child.kill()
  }
}

const githubState = (report: Record<string, unknown> | null) =>
  (report?.observations as Array<{ resourceKind: string; observedState: string }> | undefined)
    ?.find((entry) => entry.resourceKind === 'github-environment-secret')?.observedState

test('cleanup confirms absence while both persistent bindings remain listed', () => {
  // The exact state a correct cleanup leaves behind. Under the old contract
  // this was unconfirmable: the two survivors were counted as leftovers.
  const { code, report } = finalizeAgainst([...EXPECTED_PERSISTENT])
  assert.equal(githubState(report), 'confirmed-absent')
  assert.equal(report?.allConfirmedAbsent, true)
  assert.equal(code, 0)
})

test('a surviving temporary binding is still caught, including the fingerprint one', () => {
  for (const survivor of TEMPORARY_ENVIRONMENT_SECRET_NAMES) {
    const { code, report } = finalizeAgainst([...EXPECTED_PERSISTENT, survivor])
    assert.notEqual(githubState(report), 'confirmed-absent', `${survivor} survived unnoticed`)
    assert.equal(report?.allConfirmedAbsent, false)
    assert.notEqual(code, 0)
  }
})

test('an empty environment also confirms absence: persistence is not required to close', () => {
  // Cleanup owes the temporary bindings' removal. Whether the persistent ones
  // are there is the runbook's business, not a teardown refusal.
  const { report } = finalizeAgainst([])
  assert.equal(githubState(report), 'confirmed-absent')
})

/* --- public boundary ------------------------------------------------------ */

test('no secret name and no lifecycle module is reachable from anything served', () => {
  const guarded = ['batch-11-evidence-binding', 'batch-11-provider-endpoints', 'batch-11-revocation-evidence']
  const names = [...TEMPORARY_ENVIRONMENT_SECRET_NAMES, ...PERSISTENT_PREVIEW_BINDING_NAMES]

  const seen = new Set<string>()
  const queue: string[] = []
  const collect = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name)
      if (entry.isDirectory()) collect(path)
      else if (/\.tsx?$/.test(entry.name)) queue.push(path)
    }
  }
  collect(join(ROOT, 'app'))
  for (const extra of ['lib/llms-manifest.ts', 'lib/openapi.ts', 'app/sitemap.ts']) {
    if (existsSync(join(ROOT, extra))) queue.push(join(ROOT, extra))
  }

  while (queue.length > 0) {
    const file = queue.pop()!
    if (seen.has(file) || !existsSync(file)) continue
    seen.add(file)
    const source = readFileSync(file, 'utf8')
    for (const match of source.matchAll(/from\s+'(\.[^']+)'/g)) {
      const target = resolve(dirname(file), match[1])
      for (const candidate of [target, `${target}.ts`, `${target}.tsx`, join(target, 'index.ts')]) {
        if (existsSync(candidate) && !seen.has(candidate)) queue.push(candidate)
      }
    }
    for (const guardedModule of guarded) {
      assert.ok(!file.includes(guardedModule), `${guardedModule} is reachable from a served route via ${file}`)
    }
    for (const name of names) {
      assert.ok(!source.includes(name), `${file} names the ${name} binding on a served path`)
    }
  }
  assert.ok(seen.size > 0, 'the reachability walk found nothing to walk')
})
