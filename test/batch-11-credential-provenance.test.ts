import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import test from 'node:test'

import {
  CredentialProvenanceRefused,
  FINGERPRINT_PATTERN,
  assertExpectedCredential,
  assertPoolerCapability,
  fingerprintCredential,
  type CapabilityProbe,
  type ProvenanceRefusal,
} from '../lib/batch-11-credential-provenance.ts'

/**
 * A wrong credential must cost nothing.
 *
 * The previous rehearsal held a stale token, created a branch, and learned the
 * token was wrong from a 403 afterwards. Nothing was damaged and the branch
 * was destroyed, but a resource existed that no correct run would have made.
 * These tests pin the two gates that make that impossible: identify the token
 * before using it, and prove it can do the job before creating anything.
 */

const ROOT = resolve(import.meta.dirname, '..')
const PRODUCTION_REF = 'uhwuullakihgszxhiygz'
const PARENT_REF = 'osmccujuezymcgckgwxo'
const TOKEN = 'a-token-value-that-is-not-real'
const FINGERPRINT = fingerprintCredential(TOKEN)

const primary = (over: Record<string, unknown> = {}) => ({
  identifier: 'primary',
  database_type: 'PRIMARY',
  pool_mode: 'session',
  db_host: 'aws-0-us-east-1.pooler.supabase.com',
  db_port: 5432,
  db_user: `postgres.${PARENT_REF}`,
  db_name: 'postgres',
  ...over,
})

const refusal = (run: () => unknown): CredentialProvenanceRefused => {
  try {
    run()
  } catch (error) {
    assert.ok(error instanceof CredentialProvenanceRefused, `expected a provenance refusal, got ${String(error)}`)
    return error
  }
  throw new Error('expected a refusal but the call succeeded')
}

/* ------------------------------------------------- credential identity --- */

test('a fingerprint is the whole secret, never a fragment or a name', () => {
  assert.match(FINGERPRINT, FINGERPRINT_PATTERN)
  // Every shape an operator might paste in by mistake is refused as malformed,
  // and none of them is echoed back.
  for (const supplied of [
    TOKEN,
    TOKEN.slice(0, 12),
    TOKEN.slice(-12),
    'batch-11-preview-rehearsal-pooler-2026-08-31',
    'sha256:',
    `sha256:${'A'.repeat(64)}`,
    `sha256:${'a'.repeat(63)}`,
    `sha256:${'a'.repeat(65)}`,
    `${FINGERPRINT} `.replace('sha256', 'sha512'),
  ]) {
    const error = refusal(() => assertExpectedCredential(TOKEN, supplied))
    assert.equal(error.code, 'credential-fingerprint-malformed', supplied.slice(0, 20))
    assert.ok(!error.message.includes(TOKEN), 'the token must never appear in a refusal')
    // Short values like "sha256:" appear in the explanatory text by design;
    // what must never appear is a value long enough to be a real secret.
    if (supplied.length >= 20) {
      assert.ok(!error.message.includes(supplied), 'the supplied value must never be echoed')
    }
  }
})

test('the correct token matches and a different one does not', () => {
  assert.equal(assertExpectedCredential(TOKEN, FINGERPRINT), FINGERPRINT)
  const error = refusal(() => assertExpectedCredential('a-different-token', FINGERPRINT))
  assert.equal(error.code, 'credential-fingerprint-mismatch')
})

test('an absent token or an absent fingerprint refuses', () => {
  assert.equal(refusal(() => assertExpectedCredential('', FINGERPRINT)).code, 'credential-absent')
  assert.equal(refusal(() => assertExpectedCredential('   ', FINGERPRINT)).code, 'credential-absent')
  assert.equal(refusal(() => assertExpectedCredential(TOKEN, '')).code, 'credential-fingerprint-absent')
  assert.equal(refusal(() => assertExpectedCredential(TOKEN, '   ')).code, 'credential-fingerprint-absent')
})

test('a fingerprint identifies one token and cannot be replayed for another', () => {
  const other = fingerprintCredential('a-second-token-value')
  assert.notEqual(other, FINGERPRINT)
  assert.equal(refusal(() => assertExpectedCredential(TOKEN, other)).code, 'credential-fingerprint-mismatch')
  // And the fingerprint is not reversible to the token.
  assert.ok(!FINGERPRINT.includes(TOKEN.slice(0, 8)))
})

/* ------------------------------------------------ capability preflight --- */

const probe = (status: number, body: unknown = null): CapabilityProbe => ({ status, body })

test('a healthy parent pooler config authorizes the preflight', () => {
  const capability = assertPoolerCapability(PARENT_REF, PRODUCTION_REF, probe(200, [primary(), { database_type: 'READ_REPLICA' }]))
  assert.equal(capability.status, 200)
  assert.equal(capability.databaseType, 'PRIMARY')
  assert.equal(capability.poolMode, 'session')
  // Only fingerprints leave; no host, ref, user or connection string.
  assert.match(capability.primaryHostFingerprint, FINGERPRINT_PATTERN)
  assert.match(capability.parentProjectRefFingerprint, FINGERPRINT_PATTERN)
  const serialized = JSON.stringify(capability)
  assert.ok(!serialized.includes('pooler.supabase.com'))
  assert.ok(!serialized.includes(PARENT_REF))
})

test('every unauthorized, missing, throttled or failing response refuses', () => {
  for (const status of [401, 403, 404, 429, 500, 502, 503, 0]) {
    const error = refusal(() => assertPoolerCapability(PARENT_REF, PRODUCTION_REF, probe(status, [primary()])))
    assert.equal(error.code, 'pooler-capability-unavailable', String(status))
    assert.match(error.message, new RegExp(`returned ${status}`))
  }
})

test('a 200 that is not a usable PRIMARY configuration refuses', () => {
  for (const body of [
    null,
    { message: 'forbidden' },
    [],
    [{ database_type: 'READ_REPLICA' }],
    [primary(), primary({ identifier: 'second' })],
    [primary({ db_host: '' })],
    [primary({ pool_mode: undefined })],
  ]) {
    const error = refusal(() => assertPoolerCapability(PARENT_REF, PRODUCTION_REF, probe(200, body)))
    assert.equal(error.code, 'pooler-capability-malformed', JSON.stringify(body)?.slice(0, 40))
  }
})

test('a successful preflight can never authorize Production', () => {
  // Even a perfectly healthy response cannot make the Production project a
  // legitimate parent.
  const error = refusal(() => assertPoolerCapability(PRODUCTION_REF, PRODUCTION_REF, probe(200, [primary()])))
  assert.equal(error.code, 'pooler-capability-production-target')
  assert.equal(refusal(() => assertPoolerCapability('', PRODUCTION_REF, probe(200, [primary()]))).code, 'pooler-capability-production-target')
})

test('a preflight is bound to its project and cannot be replayed for another', () => {
  const first = assertPoolerCapability(PARENT_REF, PRODUCTION_REF, probe(200, [primary()]))
  const second = assertPoolerCapability('anotherprojectref000', PRODUCTION_REF, probe(200, [primary()]))
  assert.notEqual(first.parentProjectRefFingerprint, second.parentProjectRefFingerprint,
    'a capability recorded for one project must not read as a capability for another')
})

test('no refusal message carries a token, host, connection string or response body', () => {
  const secretish = [
    TOKEN,
    'aws-0-us-east-1.pooler.supabase.com',
    'postgresql://postgres:hunter2@host:5432/postgres',
    // Assembled at run time. The value is invented, but a scanner cannot know
    // that, and a token-shaped literal is blocked at push and lives forever in
    // a secret report. The assertion under test sees the same string.
    ['sbp', '_', '0123456789abcdef0123456789abcdef01234567'].join(''),
  ]
  const bodies: CapabilityProbe[] = [
    probe(403, { message: 'Forbidden', token: secretish[3], connection_string: secretish[2] }),
    probe(200, [primary({ db_host: secretish[1], connection_string: secretish[2] }), primary()]),
    probe(500, { error: secretish[2] }),
  ]
  for (const value of bodies) {
    const error = refusal(() => assertPoolerCapability(PARENT_REF, PRODUCTION_REF, value))
    for (const secret of secretish) {
      assert.ok(!error.message.includes(secret), `a refusal leaked ${secret.slice(0, 18)}`)
    }
    assert.ok(!error.message.includes('Forbidden'), 'a refusal must not quote the response body')
  }
})

/* ------------------------------------------- ordering, proven by running -- */

/** Runs the authorized path with a deliberately wrong environment. */
function runAuthorized(over: Record<string, string>): Record<string, unknown> {
  const commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim()
  // The runner exits non-zero on refusal, which is correct, so the JSON is read
  // from the error's stdout rather than treated as a failure.
  let output: string
  const options = {
    cwd: ROOT,
    encoding: 'utf8' as const,
    env: {
      ...process.env,
      MAHA_B11_REMOTE_AUTHORIZED: '1',
      MAHA_B11_OPERATION: 'batch-11-mixed-lineage-preview-rehearsal',
      MAHA_B11_CONFIRMATION: 'rehearse-batch-11-mixed-lineage-in-preview-only',
      MAHA_B11_REVIEWED_COMMIT: commit,
      SUPABASE_ACCESS_TOKEN: TOKEN,
      SUPABASE_PROJECT_REF: PARENT_REF,
      EPISTEMIC_OPERATIONS_TOKEN: 'o'.repeat(40),
      EPISTEMIC_RELEASE_AUTHORITY_TOKEN: 'r'.repeat(40),
      VERCEL_AUTOMATION_BYPASS_SECRET: 'bypass',
      VERCEL_TOKEN: 'vercel',
      GITHUB_RUN_ID: '77',
      ...over,
    },
  }
  try {
    output = execFileSync('node', ['--experimental-strip-types', 'scripts/run-batch-11-remote-rehearsal.ts'], options)
  } catch (error) {
    output = (error as { stdout?: string }).stdout ?? ''
  }
  assert.ok(output.trim().length > 0, 'the runner emitted no artifact')
  return JSON.parse(output) as Record<string, unknown>
}

const performedNothing = (result: Record<string, unknown>) => {
  assert.equal(result.mode, 'refused')
  assert.equal(result.remoteOperationsPerformed, 0)
  assert.equal(result.previewBranchCreated, false)
  assert.equal(result.migrationsApplied, 0)
  assert.equal(result.releasesIssued, 0)
  assert.equal(result.productionWritesPerformed, 0)
  assert.equal(result.mutationStartedAfterPreflight, false)
}

test('a wrong, malformed or absent fingerprint performs zero remote operations', () => {
  for (const [fingerprint, code] of [
    [`sha256:${'a'.repeat(64)}`, 'credential-fingerprint-mismatch'],
    ['not-a-fingerprint', 'credential-fingerprint-malformed'],
    [TOKEN, 'credential-fingerprint-malformed'],
    ['', 'credential-fingerprint-absent'],
  ] as [string, ProvenanceRefusal][]) {
    const result = runAuthorized({ SUPABASE_ACCESS_TOKEN_SHA256: fingerprint })
    assert.equal(result.refusalCode, code, JSON.stringify(fingerprint).slice(0, 24))
    assert.equal(result.credentialFingerprintMatched, false)
    assert.equal(result.poolerCapabilityPreflight, null, 'the capability probe must not run on an unidentified token')
    performedNothing(result)
  }
})

test('a matched fingerprint whose token lacks capability still performs zero mutations', () => {
  // This is the previous rehearsal exactly: the token is real enough to be
  // identified, and cannot read the parent pooler config. Before this gate it
  // created a branch and then received a 403.
  const result = runAuthorized({ SUPABASE_ACCESS_TOKEN_SHA256: FINGERPRINT })
  assert.equal(result.credentialFingerprintMatched, true, 'the token was identified')
  assert.equal(result.refusalCode, 'pooler-capability-unavailable')
  performedNothing(result)
})

test('a refusal artifact carries no token, fingerprint of a secret aside, or body', () => {
  const result = runAuthorized({ SUPABASE_ACCESS_TOKEN_SHA256: FINGERPRINT })
  const serialized = JSON.stringify(result)
  for (const secret of [TOKEN, 'o'.repeat(40), 'r'.repeat(40), 'bypass', 'vercel']) {
    assert.ok(!serialized.includes(secret), 'the refusal artifact leaked a credential')
  }
})

test('the branch POST is guarded, not merely ordered', () => {
  const source = readFileSync(resolve(ROOT, 'scripts/run-batch-11-remote-rehearsal.ts'), 'utf8')
  const create = source.slice(source.indexOf('async createEphemeralBranch'))
  const guard = create.indexOf('preflightCompleted')
  const post = create.indexOf('/branches')
  assert.ok(guard >= 0, 'branch creation must check the preflight flag')
  assert.ok(guard < post, 'the guard must precede the branch POST')
  assert.match(create.slice(0, post), /mutation-before-preflight/)
})

test('the preflight sequence runs in the required order', () => {
  const source = readFileSync(resolve(ROOT, 'scripts/run-batch-11-remote-rehearsal.ts'), 'utf8')
  // Scoped to the pre-mutation block: earlier reporting paths mention some of
  // these strings and would match the wrong occurrence.
  const block = source.slice(source.indexOf('\ntry {'))
  const at = (needle: string) => {
    const index = block.indexOf(needle)
    assert.notEqual(index, -1, `${needle} is missing from the pre-mutation block`)
    return index
  }
  const commit = at("'reviewed-commit-mismatch'")
  const gates = at('const notReady = gates.filter')
  const fingerprint = at('assertExpectedCredential(managementToken')
  const capability = at('assertPoolerCapability(parentRef')
  const completed = at('lifecycleState.preflightCompleted = true')
  const rehearse = at('await runRehearsal(driver, gates)')
  assert.ok(commit < gates, 'reviewed commit before cohort gates')
  assert.ok(gates < fingerprint, 'cohort gates before credential identity')
  assert.ok(fingerprint < capability, 'credential identity before capability')
  assert.ok(capability < completed, 'capability before the preflight flag')
  assert.ok(completed < rehearse, 'the preflight flag before any lifecycle mutation')
})

test('cleanup still runs after a later failure', () => {
  // The gates added here are all pre-mutation, so the teardown path that runs
  // when a later phase fails must be untouched.
  const source = readFileSync(resolve(ROOT, 'scripts/run-batch-11-remote-rehearsal.ts'), 'utf8')
  assert.match(source, /finally\s*\{/)
  const workflow = readFileSync(resolve(ROOT, '.github/workflows/preview-batch-11-remote-rehearsal.yml'), 'utf8')
  const cleanup = workflow.slice(workflow.indexOf('Destroy any surviving'))
  assert.match(cleanup, /if: always\(\)/)
})

test('the workflow requires the fingerprint from the protected environment', () => {
  const workflow = readFileSync(resolve(ROOT, '.github/workflows/preview-batch-11-remote-rehearsal.yml'), 'utf8')
  assert.match(workflow, /SUPABASE_ACCESS_TOKEN_SHA256: \$\{\{ secrets\.SUPABASE_ACCESS_TOKEN_SHA256 \}\}/)
  const boundary = workflow.slice(workflow.indexOf('Enforce the Preview boundary'), workflow.indexOf('actions/checkout'))
  assert.ok(boundary.includes('SUPABASE_ACCESS_TOKEN_SHA256'), 'the fingerprint must be required before checkout')
  assert.match(boundary, /must not be the token itself/, 'the fingerprint must not be allowed to be the raw token')
})
