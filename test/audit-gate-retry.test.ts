import { strict as assert } from 'node:assert'
import { spawnSync } from 'node:child_process'
import { chmodSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

/**
 * The audit gate is exercised against a stubbed npm, because the two failures
 * it has to tell apart -- a real advisory and a registry outage -- cannot be
 * produced on demand from the real registry.
 */
function runWithStub(stdout: string, stderr = '', exitCode = 1, attempts = 2) {
  const dir = mkdtempSync(join(tmpdir(), 'audit-stub-'))
  const stub = join(dir, 'npm')
  writeFileSync(stub, `#!/bin/sh\ncat <<'STUBOUT'\n${stdout}\nSTUBOUT\ncat >&2 <<'STUBERR'\n${stderr}\nSTUBERR\nexit ${exitCode}\n`)
  chmodSync(stub, 0o755)
  const started = Date.now()
  const result = spawnSync(process.execPath,
    ['--experimental-strip-types', 'scripts/audit-production-dependencies.ts'],
    { encoding: 'utf8', env: { ...process.env, PATH: `${dir}:${process.env.PATH}`, AUDIT_ATTEMPTS: String(attempts) } })
  return { ...result, elapsed: Date.now() - started }
}

const clean = JSON.stringify({ metadata: { vulnerabilities: { info: 0, low: 4, moderate: 0, high: 0, critical: 0, total: 4 } } })
const highAdvisory = JSON.stringify({
  metadata: { vulnerabilities: { info: 0, low: 0, moderate: 0, high: 2, critical: 0, total: 2 } },
  vulnerabilities: { 'ip-address': { severity: 'high', via: [] }, qs: { severity: 'high', via: [] } },
})
const registryDown = JSON.stringify({ error: { code: 'E503', summary: 'audit endpoint returned an error' } })

test('a clean audit passes', () => {
  const r = runWithStub(clean, '', 0)
  assert.equal(r.status, 0, r.stderr)
  assert.match(r.stdout, /audit passed/)
})

test('low-severity advisories do not block a release', () => {
  // The gate is --audit-level=high by design; dev and low advisories are
  // Dependabot's job, not a release blocker.
  const r = runWithStub(clean, '', 1)
  assert.equal(r.status, 0)
  assert.match(r.stdout, /4 low/)
})

test('a real high advisory fails immediately and is never retried', () => {
  const r = runWithStub(highAdvisory, '', 1, 5)
  assert.equal(r.status, 1)
  assert.match(r.stderr, /advisories at or above high/)
  assert.match(r.stderr, /ip-address/)
  // Five attempts with backoff would take at least 30 seconds. Failing fast is
  // the proof it did not retry a vulnerability.
  assert.ok(r.elapsed < 15000, `took ${r.elapsed}ms; a vulnerability must not be retried`)
})

test('a registry outage is retried, then fails as an outage rather than a pass', () => {
  const r = runWithStub(registryDown, 'npm error audit endpoint returned an error', 1, 3)
  assert.equal(r.status, 1, 'an unrun gate must never pass')
  assert.match(r.stderr, /could not reach the registry in 3 attempts/)
  assert.match(r.stderr, /established nothing/)
  assert.match(r.stderr, /infrastructure failure, not a clean audit/)
  // It really did retry rather than giving up at once.
  assert.match(r.stderr, /retrying in/)
})

test('a 503 in stderr is recognised even when the JSON is unparseable', () => {
  const r = runWithStub('not json at all', 'npm warn audit 503 Service Unavailable', 1, 2)
  assert.equal(r.status, 1)
  assert.match(r.stderr, /could not reach the registry/)
})

test('an unrecognised failure is not retried into silence', () => {
  // Anything that is not clearly the registry is treated as real, so a new kind
  // of genuine failure cannot be waited out.
  const r = runWithStub('not json', 'npm error something entirely new went wrong', 1, 5)
  assert.equal(r.status, 1)
  assert.match(r.stderr, /not a registry outage. Not retrying/)
  assert.ok(r.elapsed < 15000, `took ${r.elapsed}ms; an unknown failure must not be retried`)
})

test('the workflow calls the gate rather than npm audit directly', () => {
  const wf = spawnSync('git', ['show', 'HEAD:.github/workflows/quality.yml'], { encoding: 'utf8' })
  // Read the working copy, which is what will run.
  const current = spawnSync('cat', ['.github/workflows/quality.yml'], { encoding: 'utf8' }).stdout
  assert.match(current, /audit-production-dependencies\.ts/)
  assert.ok(!/run: npm audit /.test(current),
    'the raw npm audit call is what blocked three runs in a day; it must go through the gate')
  assert.ok(wf.stdout.length > 0)
})
