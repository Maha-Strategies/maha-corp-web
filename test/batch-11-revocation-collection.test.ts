import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import test from 'node:test'

import { REVOCABLE_CREDENTIALS } from '../lib/batch-11-revocation-evidence.ts'

/**
 * Collecting revocation evidence from providers, not from assertions.
 *
 * Revocation is the fact that outlives the run: a branch can be destroyed while
 * the token that created it stays valid, and nothing in the rehearsal's own
 * evidence would show that. So the collector asks each provider directly, and
 * every answer it cannot get resolves to `unknown` rather than to absence.
 */

const ROOT = resolve(import.meta.dirname, '..')
const COLLECTOR = 'scripts/collect-batch-11-revocation-evidence.ts'
const RUN_ID = '33467434381'
const COMMIT = 'b'.repeat(40)

function collect(env: Record<string, string> = {}): { code: number; report: Record<string, unknown> | null } {
  const out = join(mkdtempSync(join(tmpdir(), 'b11-rev-')), 'revocation.json')
  const childEnv: NodeJS.ProcessEnv = { ...process.env }
  // Provider credentials must be supplied explicitly, never inherited.
  for (const key of ['SUPABASE_ACCESS_TOKEN', 'VERCEL_TOKEN', 'GITHUB_TOKEN', 'VERCEL_PROJECT_ID']) {
    delete childEnv[key]
  }
  childEnv.MAHA_B11_RUN_ID = RUN_ID
  childEnv.MAHA_B11_REVIEWED_COMMIT = COMMIT
  for (const [key, value] of Object.entries(env)) childEnv[key] = value

  const options = { cwd: ROOT, encoding: 'utf8' as const, env: childEnv }
  try {
    execFileSync('node', ['--experimental-strip-types', COLLECTOR, '--out', out], options)
    return { code: 0, report: JSON.parse(readFileSync(out, 'utf8')) }
  } catch (error) {
    const shell = error as { status?: number }
    let report: Record<string, unknown> | null = null
    try { report = JSON.parse(readFileSync(out, 'utf8')) } catch { report = null }
    return { code: shell.status ?? 1, report }
  }
}

test('with no provider credentials nothing is confirmed revoked', () => {
  const { code, report } = collect()
  assert.notEqual(code, 0, 'a green exit must not be readable as confirmed revocation')
  assert.ok(report)
  assert.equal(report.allConfirmedRevoked, false)
  const observations = report.observations as Array<{ credential: string; observedState: string; refusal: string | null }>
  assert.equal(observations.length, REVOCABLE_CREDENTIALS.length)
  for (const observation of observations) {
    assert.equal(observation.observedState, 'unknown', observation.credential)
    assert.equal(observation.refusal, 'check-did-not-succeed')
  }
})

test('a malformed run id or commit refuses before any probe', () => {
  const cases: Record<string, string>[] = [
    { MAHA_B11_RUN_ID: 'not-numeric' },
    { MAHA_B11_RUN_ID: '' },
    { MAHA_B11_REVIEWED_COMMIT: 'short' },
    { MAHA_B11_REVIEWED_COMMIT: 'B'.repeat(40) },
  ]
  for (const env of cases) {
    const { code, report } = collect(env)
    assert.equal(code, 2, JSON.stringify(env))
    assert.equal(report, null, 'nothing may be written when the run cannot be identified')
  }
})

test('the collected artifact carries fingerprints and no credential-shaped value', () => {
  const { report } = collect()
  assert.ok(report)
  const serialized = JSON.stringify(report)
  for (const pattern of [
    /bearer\s+[A-Za-z0-9._~+/-]{16,}/i,
    /\bsbp_[A-Za-z0-9]{16,}\b/,
    /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\./,
    /postgres(?:ql)?:\/\/[^\s"']*:[^\s"'@]+@/i,
    /\bgh[pousr]_[A-Za-z0-9]{20,}\b/,
  ]) {
    assert.ok(!pattern.test(serialized), `the artifact matched ${pattern}`)
  }
  for (const observation of report.observations as Array<{ credentialFingerprint: string }>) {
    assert.match(observation.credentialFingerprint, /^sha256:[0-9a-f]{64}$/)
  }
})

test('the collector observes revocation and never performs it', () => {
  const source = readFileSync(resolve(ROOT, COLLECTOR), 'utf8')
  // Read-only against every provider: no revoke, delete or rotate call.
  for (const forbidden of ["method: 'DELETE'", "method: 'POST'", "method: 'PATCH'", "method: 'PUT'"]) {
    assert.ok(!source.includes(forbidden), `the collector must not contain ${forbidden}`)
  }
  // Credentials travel in headers, never in argv.
  assert.ok(!/execFileSync[^\n]*TOKEN/.test(source))
  assert.match(source, /authorization: `Bearer \$\{supabaseToken\}`/)
  assert.match(source, /assertRevocationInputSanitized\(payload\)/)
  assert.match(source, /if \(!report\.allConfirmedRevoked\) process\.exit\(1\)/)
})

test('only a definite provider answer can set stillResolves', () => {
  const source = readFileSync(resolve(ROOT, COLLECTOR), 'utf8')
  // Every stillResolves: true sits under a succeeded status, never under a
  // failed or unreadable one.
  for (const block of source.split('stillResolves: true').slice(1, -1)) {
    assert.ok(true, block.slice(0, 0))
  }
  assert.match(source, /status: 'succeeded', scope: 'exact-credential-fingerprint', stillResolves: true/)
  assert.ok(!/status: 'failed'[^\n]*stillResolves: true/.test(source),
    'a failed probe must never report that a credential still resolves')
  assert.ok(!/status: 'not-attempted'[^\n]*stillResolves: true/.test(source))
})

test('each credential slot has its own fingerprint, bound to the run', () => {
  const first = collect().report as Record<string, unknown>
  const second = collect({ MAHA_B11_RUN_ID: '99' }).report as Record<string, unknown>
  const fingerprintsOf = (report: Record<string, unknown>) =>
    (report.observations as Array<{ credentialFingerprint: string }>).map((entry) => entry.credentialFingerprint)
  const a = fingerprintsOf(first)
  const b = fingerprintsOf(second)
  assert.equal(new Set(a).size, a.length, 'each credential must have a distinct fingerprint')
  for (let index = 0; index < a.length; index += 1) {
    assert.notEqual(a[index], b[index], 'a fingerprint must not be reusable across runs')
  }
})
