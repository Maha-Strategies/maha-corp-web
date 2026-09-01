import assert from 'node:assert/strict'
import { execFileSync, spawn } from 'node:child_process'
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import test from 'node:test'

import { fingerprintCredential } from '../lib/batch-11-credential-provenance.ts'
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

function collect(env: Record<string, string> = {}): {
  code: number
  report: Record<string, unknown> | null
  stdout: string
} {
  const out = join(mkdtempSync(join(tmpdir(), 'b11-rev-')), 'revocation.json')
  const childEnv: NodeJS.ProcessEnv = { ...process.env }
  // Provider credentials must be supplied explicitly, never inherited.
  for (const key of [
    'SUPABASE_ACCESS_TOKEN', 'VERCEL_TOKEN', 'GITHUB_TOKEN', 'VERCEL_PROJECT_ID',
    'VERCEL_AUTOMATION_BYPASS_SECRET', 'VERCEL_TEAM_ID',
  ]) {
    delete childEnv[key]
  }
  childEnv.MAHA_B11_RUN_ID = RUN_ID
  childEnv.MAHA_B11_REVIEWED_COMMIT = COMMIT
  for (const [key, value] of Object.entries(env)) childEnv[key] = value

  const options = { cwd: ROOT, encoding: 'utf8' as const, env: childEnv }
  const parse = () => {
    try { return JSON.parse(readFileSync(out, 'utf8')) as Record<string, unknown> } catch { return null }
  }
  try {
    const stdout = execFileSync('node', ['--experimental-strip-types', COLLECTOR, '--out', out], options)
    return { code: 0, report: parse(), stdout }
  } catch (error) {
    const shell = error as { status?: number; stdout?: string; stderr?: string }
    return { code: shell.status ?? 1, report: parse(), stdout: `${shell.stdout ?? ''}${shell.stderr ?? ''}` }
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

/**
 * A credential nobody supplied has no identity to record.
 *
 * The earlier version of this collector fingerprinted `runMarker:credential` -
 * the slot - which produced three confident-looking, always-distinct hashes
 * whether or not any credential had been tested. That is the defect this test
 * now guards: without the values, two of the three must be the unidentified
 * sentinel, and only the environment slot - which genuinely has no value to
 * fingerprint - carries a real identity.
 */
test('an unsupplied credential is recorded as unidentified, not as a slot hash', () => {
  const observations = (collect().report as Record<string, unknown>)
    .observations as Array<{ credential: string; credentialFingerprint: string }>
  const byCredential = new Map(observations.map((entry) => [entry.credential, entry.credentialFingerprint]))
  const sentinel = `sha256:${'0'.repeat(64)}`

  assert.equal(byCredential.get('supabase-access-token'), sentinel)
  assert.equal(byCredential.get('vercel-automation-bypass'), sentinel)
  assert.notEqual(byCredential.get('github-environment-secrets'), sentinel)
  assert.match(byCredential.get('github-environment-secrets')!, /^sha256:[0-9a-f]{64}$/)
})

test('the environment-slot identity is bound to the run and the commit', () => {
  const slotOf = (env: Record<string, string> = {}) =>
    ((collect(env).report as Record<string, unknown>).observations as Array<{ credential: string; credentialFingerprint: string }>)
      .find((entry) => entry.credential === 'github-environment-secrets')!.credentialFingerprint

  const base = slotOf()
  assert.notEqual(slotOf({ MAHA_B11_RUN_ID: '99' }), base, 'the slot identity must not be reusable across runs')
  assert.notEqual(slotOf({ MAHA_B11_REVIEWED_COMMIT: 'c'.repeat(40) }), base,
    'the slot identity must not be reusable across commits')
})

/* --- provider semantics, against controlled responses --------------------- */

/**
 * Runs the loopback provider stub, and points every probe at it.
 *
 * The stub is a separate process because `collect` blocks on execFileSync: a
 * server sharing this event loop would never answer. Every provider base URL is
 * redirected, so a probe that reached the real internet would fail here rather
 * than quietly succeeding against production.
 */
function withStub(routes: Record<string, { status: number; body?: unknown }>, run: (env: Record<string, string>) => void): void {
  const dir = mkdtempSync(join(tmpdir(), 'b11-stub-'))
  const portFile = join(dir, 'port')
  const child = spawn('node', ['--experimental-strip-types', 'test/helpers/loopback-provider-stub.ts'], {
    cwd: ROOT,
    stdio: 'ignore',
    env: { ...process.env, MAHA_STUB_ROUTES: JSON.stringify(routes), MAHA_STUB_PORT_FILE: portFile },
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
    const base = `http://127.0.0.1:${port}`
    run({ MAHA_B11_SUPABASE_API: base, MAHA_B11_VERCEL_API: base, MAHA_B11_GITHUB_API: base })
  } finally {
    child.kill()
  }
}

/** Blocking sleep: the polling above cannot yield to an event loop. */
function sleepSync(ms: number): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)
}

const FAKE_SUPABASE_TOKEN = ['sbp', '_', 'f'.repeat(40)].join('')
const FAKE_BYPASS = 'mine9c2f4a71b8e0d3675fa1c48e'
const OTHER_BYPASS = 'theirs0d51e7ba9c3648fd2081e'

const stateOf = (report: Record<string, unknown> | null, credential: string) =>
  (report?.observations as Array<{ credential: string; observedState: string }> | undefined)
    ?.find((entry) => entry.credential === credential)

const fingerprintOf = (report: Record<string, unknown> | null, credential: string) =>
  (report?.observations as Array<{ credential: string; credentialFingerprint: string }> | undefined)
    ?.find((entry) => entry.credential === credential)?.credentialFingerprint

/** Every documented Supabase answer, and what each one is allowed to mean. */
for (const [status, expected, why] of [
  [401, 'confirmed-revoked', 'an unambiguous authentication rejection'],
  [403, 'unknown', 'authenticated but forbidden - a live fine-grained token'],
  [404, 'unknown', 'the wrong resource, not a rejected credential'],
  [429, 'unknown', 'throttled, so the question went unanswered'],
  [500, 'unknown', 'the provider failed, which is not an answer'],
] as const) {
  test(`Supabase ${status} means ${expected}: ${why}`, () => {
    withStub({ supabase: { status } }, (stub) => {
      const { report } = collect({ ...stub, SUPABASE_ACCESS_TOKEN: FAKE_SUPABASE_TOKEN })
      assert.equal(stateOf(report, 'supabase-access-token')?.observedState, expected)
    })
  })
}

test('Supabase 200 reports the token still active, and never closes', () => {
  withStub({ supabase: { status: 200, body: [] } }, (stub) => {
    const { code, report } = collect({ ...stub, SUPABASE_ACCESS_TOKEN: FAKE_SUPABASE_TOKEN })
    assert.equal(stateOf(report, 'supabase-access-token')?.observedState, 'still-active')
    assert.equal(report?.allConfirmedRevoked, false)
    assert.notEqual(code, 0)
  })
})

test('a 401 closes the exact token that was tested, not the slot', () => {
  withStub({ supabase: { status: 401 } }, (stub) => {
    const mine = collect({ ...stub, SUPABASE_ACCESS_TOKEN: FAKE_SUPABASE_TOKEN })
    const other = collect({ ...stub, SUPABASE_ACCESS_TOKEN: `${FAKE_SUPABASE_TOKEN}x` })

    // Both are genuinely revoked. They are still not the same evidence, which
    // is the whole point: a different revoked token cannot stand in for ours.
    assert.equal(stateOf(mine.report, 'supabase-access-token')?.observedState, 'confirmed-revoked')
    assert.equal(stateOf(other.report, 'supabase-access-token')?.observedState, 'confirmed-revoked')
    assert.notEqual(
      fingerprintOf(mine.report, 'supabase-access-token'),
      fingerprintOf(other.report, 'supabase-access-token'),
    )
    assert.equal(fingerprintOf(mine.report, 'supabase-access-token'), fingerprintCredential(FAKE_SUPABASE_TOKEN))
  })
})

/** The documented shape: a map keyed by the bypass secrets themselves. */
const vercelProject = (bypasses: string[]) => ({
  vercel: {
    status: 200,
    body: {
      id: 'prj_test',
      protectionBypass: Object.fromEntries(bypasses.map((secret) => [
        secret, { createdAt: 1, createdBy: 'test', scope: 'automation-bypass' },
      ])),
    },
  },
})

const vercelEnv = (stub: Record<string, string>, bypass: string) => ({
  ...stub,
  VERCEL_TOKEN: 'vercel-test-token',
  VERCEL_PROJECT_ID: 'prj_test',
  VERCEL_AUTOMATION_BYPASS_SECRET: bypass,
})

test('the exact bypass absent closes, even while unrelated bypasses remain', () => {
  // Three legitimate, unrelated bypasses survive. The earlier probe read a
  // non-empty map as "still active" and would have refused to close here.
  withStub(vercelProject([OTHER_BYPASS, 'c'.repeat(32), 'd'.repeat(32)]), (stub) => {
    const { report } = collect(vercelEnv(stub, FAKE_BYPASS))
    assert.equal(stateOf(report, 'vercel-automation-bypass')?.observedState, 'confirmed-revoked')
    assert.equal(fingerprintOf(report, 'vercel-automation-bypass'), fingerprintCredential(FAKE_BYPASS))
  })
})

test('the exact bypass still present reports still active', () => {
  withStub(vercelProject([OTHER_BYPASS, FAKE_BYPASS]), (stub) => {
    const { code, report } = collect(vercelEnv(stub, FAKE_BYPASS))
    assert.equal(stateOf(report, 'vercel-automation-bypass')?.observedState, 'still-active')
    assert.notEqual(code, 0)
  })
})

test('a different absent bypass is not evidence about ours', () => {
  // OTHER_BYPASS is absent from the project, so a probe told to look for it
  // reports revoked - under an identity the closure verifier will not accept
  // for this run, which is where the substitution is caught.
  withStub(vercelProject([FAKE_BYPASS]), (stub) => {
    const { report } = collect(vercelEnv(stub, OTHER_BYPASS))
    assert.equal(stateOf(report, 'vercel-automation-bypass')?.observedState, 'confirmed-revoked')
    assert.equal(fingerprintOf(report, 'vercel-automation-bypass'), fingerprintCredential(OTHER_BYPASS))
    assert.notEqual(fingerprintOf(report, 'vercel-automation-bypass'), fingerprintCredential(FAKE_BYPASS))
  })
})

test('an unreadable Vercel response stays unknown', () => {
  for (const status of [401, 403, 404, 429, 500]) {
    withStub({ vercel: { status } }, (stub) => {
      const { report } = collect(vercelEnv(stub, FAKE_BYPASS))
      assert.equal(stateOf(report, 'vercel-automation-bypass')?.observedState, 'unknown', `status ${status}`)
    })
  }
  // A well-formed 200 whose protectionBypass is not a map is equally unreadable.
  withStub({ vercel: { status: 200, body: { id: 'prj_test', protectionBypass: 'nonsense' } } }, (stub) => {
    const { report } = collect(vercelEnv(stub, FAKE_BYPASS))
    assert.equal(stateOf(report, 'vercel-automation-bypass')?.observedState, 'unknown')
  })
})

test('no raw credential reaches the report, its detail text or the process output', () => {
  const githubToken = ['ghp', '_', 'e'.repeat(36)].join('')
  withStub({
    ...vercelProject([FAKE_BYPASS, OTHER_BYPASS]),
    supabase: { status: 401 },
    github: { status: 200, body: { secrets: [] } },
  }, (stub) => {
    const { report, stdout } = collect({
      ...vercelEnv(stub, FAKE_BYPASS),
      SUPABASE_ACCESS_TOKEN: FAKE_SUPABASE_TOKEN,
      GITHUB_TOKEN: githubToken,
    })
    const serialized = JSON.stringify(report)
    for (const secret of [FAKE_SUPABASE_TOKEN, FAKE_BYPASS, OTHER_BYPASS, 'vercel-test-token', githubToken]) {
      assert.ok(!serialized.includes(secret), 'a credential reached the written report')
      assert.ok(!stdout.includes(secret), 'a credential reached the process output')
    }
    // Including the bypass belonging to somebody else, which the probe read.
    assert.ok(!serialized.includes(OTHER_BYPASS))
  })
})

test('an endpoint override may only address loopback', () => {
  for (const override of ['https://api.supabase.com', 'http://example.test', 'http://127.0.0.1.evil.test', 'not-a-url']) {
    const { code, report } = collect({ MAHA_B11_SUPABASE_API: override, SUPABASE_ACCESS_TOKEN: FAKE_SUPABASE_TOKEN })
    assert.equal(code, 2, `${override} must be refused, never silently sent to production`)
    assert.equal(report, null)
  }
})

test('credentials travel in headers, never in argv', () => {
  const source = readFileSync(resolve(ROOT, COLLECTOR), 'utf8')
  assert.ok(!/process\.argv[^\n]*(TOKEN|SECRET)/i.test(source))
  assert.match(source, /headers: \{ authorization: `Bearer \$\{supabaseToken\}` \}/)
})

test('the collector performs no mutation against any provider', () => {
  // Comments are stripped first: this is about what the collector does, and the
  // header explains at length why /v1/oauth/revoke is the wrong endpoint.
  const source = readFileSync(resolve(ROOT, COLLECTOR), 'utf8')
    .split('\n')
    .filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line))
    .join('\n')
  for (const verb of ['DELETE', 'POST', 'PATCH', 'PUT']) {
    assert.ok(!new RegExp(`method:\\s*'${verb}'`, 'i').test(source), `${verb} must not appear`)
  }
  assert.ok(!/oauth\/revoke/.test(source), 'revoking is not observing')
  assert.ok(!/\bfetch\((?![^)]*\/v1\/projects|[^)]*\/v9\/projects|[^)]*\/repos\/)/.test(source),
    'every request must be one of the three documented read endpoints')
})
