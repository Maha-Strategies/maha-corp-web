import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import test from 'node:test'

import { DEFAULT_KEY_DELAYS, acquireBranchServiceKey } from '../lib/batch-11-branch-api-key.ts'

/**
 * The branch key is asked for, not constructed.
 *
 * Run 33494192235 refused at REST readiness with 401 on its first attempt: the
 * hand-minted HS256 token was not a credential the hosted branch recognised.
 * Provider-issued keys carry a form nothing outside the provider reproduces, so
 * the only reliable move is to request one - and then to be unforgiving about
 * what counts as having got it.
 */

const ROOT = resolve(import.meta.dirname, '..')
const BRANCH_REF = 'ephemeralbranchref00'
const SECRET_KEY = `sb_secret_${'S'.repeat(40)}`
const PUBLISHABLE = `sb_publishable_${'P'.repeat(40)}`

const secretRow = { id: 'k1', type: 'secret', name: 'default', api_key: SECRET_KEY }
const publishableRow = { id: 'k2', type: 'publishable', name: 'default', api_key: PUBLISHABLE }
const legacyAnon = { id: 'k3', type: 'legacy', name: 'anon', api_key: `eyJ${'a'.repeat(60)}` }
const legacyService = { id: 'k4', type: 'legacy', name: 'service_role', api_key: `eyJ${'b'.repeat(60)}` }

/** Replays scripted provider answers with no real waiting. */
function scripted(answers: readonly ({ status: number; body: unknown } | 'network')[]) {
  const paths: string[] = []
  const slept: number[] = []
  let index = 0
  return {
    paths,
    slept,
    request: async (path: string) => {
      paths.push(path)
      const answer = answers[Math.min(index, answers.length - 1)]
      index += 1
      if (answer === 'network') throw new TypeError('fetch failed')
      return answer
    },
    sleep: async (ms: number) => { slept.push(ms) },
  }
}

const acquire = (answers: readonly ({ status: number; body: unknown } | 'network')[], delaysMs = DEFAULT_KEY_DELAYS) => {
  const harness = scripted(answers)
  return acquireBranchServiceKey({ branchRef: BRANCH_REF, request: harness.request, delaysMs, sleep: harness.sleep })
    .then((result) => ({ ...result, ...harness }))
}

const ok = (rows: unknown[]) => ({ status: 200, body: rows })

/* --- delayed availability ------------------------------------------------- */

test('a key that appears late is still acquired', async () => {
  const { outcome, key, slept } = await acquire([ok([publishableRow]), ok([publishableRow]), ok([publishableRow, secretRow])])
  assert.equal(outcome.acquired, true)
  assert.equal(key, SECRET_KEY)
  assert.equal(outcome.attempts, 3)
  assert.equal(outcome.statusClasses['awaiting-key'], 2)
  assert.deepEqual(slept, [DEFAULT_KEY_DELAYS[0], DEFAULT_KEY_DELAYS[1]], 'the retry schedule must be deterministic')
})

test('transient 404, 429 and 5xx are retried, then succeed', async () => {
  for (const status of [404, 429, 500, 502, 503, 504]) {
    const { outcome, key } = await acquire([{ status, body: null }, ok([secretRow])])
    assert.equal(outcome.acquired, true, `${status} must be retried`)
    assert.equal(key, SECRET_KEY)
    assert.equal(outcome.statusClasses[String(status)], 1)
  }
})

test('network failures are retried within the bound', async () => {
  const { outcome, key } = await acquire(['network', 'network', ok([secretRow])])
  assert.equal(outcome.acquired, true)
  assert.equal(key, SECRET_KEY)
  assert.equal(outcome.statusClasses.network, 2)
})

test('permanent unavailability times out and yields no key', async () => {
  const delays = [1, 1, 1]
  const { outcome, key, paths, slept } = await acquire([{ status: 503, body: null }], delays)
  assert.equal(outcome.acquired, false)
  assert.equal(outcome.refusal, 'timed-out')
  assert.equal(key, null)
  assert.equal(paths.length, delays.length + 1, 'attempts must be bounded')
  assert.equal(slept.length, delays.length)
})

/* --- authorization is not propagation ------------------------------------- */

test('401 and 403 refuse immediately, without retrying', async () => {
  for (const [status, refusal] of [[401, 'unauthorized'], [403, 'forbidden']] as const) {
    const { outcome, key, paths, slept } = await acquire([{ status, body: null }, ok([secretRow])])
    assert.equal(outcome.acquired, false)
    assert.equal(outcome.refusal, refusal)
    assert.equal(key, null)
    assert.equal(paths.length, 1, 'a scope refusal must not be retried')
    assert.deepEqual(slept, [])
  }
})

/* --- selection is unforgiving --------------------------------------------- */

test('two keys of the same tier are ambiguous and refuse', async () => {
  const two = await acquire([ok([secretRow, { ...secretRow, id: 'k9', name: 'second' }])])
  assert.equal(two.outcome.refusal, 'ambiguous-secret-key')
  assert.equal(two.key, null)

  const twoLegacy = await acquire([ok([legacyService, { ...legacyService, id: 'k9' }])])
  assert.equal(twoLegacy.outcome.refusal, 'ambiguous-secret-key')
  assert.equal(twoLegacy.key, null)
})

/**
 * A modern secret and a legacy service_role key are not rival identities.
 *
 * Run 33497894169 refused here: the branch published both, and pooling them
 * made a routine hosted-project shape look ambiguous. They are the same
 * authority in two tiers, and the modern key is the one the provider issues
 * going forward, so the tiers are ranked. Genuine ambiguity - two of the same
 * tier - still refuses, which the test above pins.
 */
test('a modern secret key takes precedence over a legacy service_role key', async () => {
  const { outcome, key } = await acquire([ok([legacyAnon, legacyService, publishableRow, secretRow])])
  assert.equal(outcome.acquired, true)
  assert.equal(key, SECRET_KEY)
  assert.deepEqual(outcome.selected, { type: 'secret', name: 'default' })
})

test('a refusal describes what the branch offered, by type and name only', async () => {
  const { outcome } = await acquire([ok([secretRow, { ...secretRow, id: 'k9', name: 'second' }])])
  assert.deepEqual(outcome.candidates, [
    { type: 'secret', name: 'default' },
    { type: 'secret', name: 'second' },
  ])
  // Diagnosable without another protected run, and still carrying no values.
  const serialized = JSON.stringify(outcome)
  assert.ok(!serialized.includes(SECRET_KEY))
  assert.ok(!serialized.includes(PUBLISHABLE))
})

test('a publishable-only response never yields a key', async () => {
  const { outcome, key } = await acquire([ok([publishableRow, legacyAnon])], [1, 1])
  assert.equal(outcome.acquired, false)
  assert.equal(outcome.refusal, 'no-secret-key')
  assert.equal(key, null)
})

test('a publishable value under a secret type is refused on its shape', async () => {
  const { outcome, key } = await acquire([ok([{ ...secretRow, api_key: PUBLISHABLE }])])
  assert.equal(outcome.refusal, 'key-publishable-shaped')
  assert.equal(key, null)
})

test('masked or unrevealed keys are refused', async () => {
  for (const masked of [null, undefined, '', 'sb_secret_****', 'sb_secret_ab…', 'sb_secret_ab...', 'short']) {
    const { outcome, key } = await acquire([ok([{ ...secretRow, api_key: masked }])])
    assert.equal(outcome.refusal, 'key-masked', `${JSON.stringify(masked)} must be refused`)
    assert.equal(key, null)
  }
})

test('a malformed response refuses rather than guessing', async () => {
  for (const body of [{ keys: [] }, 'nope', null, [1, 2], ['x']]) {
    const { outcome, key } = await acquire([{ status: 200, body }], [1])
    assert.equal(outcome.refusal, 'response-malformed', `${JSON.stringify(body)} must be refused`)
    assert.equal(key, null)
  }
})

test('a legacy service_role key is used when no modern secret exists', async () => {
  const { outcome, key } = await acquire([ok([legacyAnon, legacyService])])
  assert.equal(outcome.acquired, true)
  assert.equal(key, legacyService.api_key)
  assert.deepEqual(outcome.selected, { type: 'legacy', name: 'service_role' })
})

/* --- the value cannot escape ---------------------------------------------- */

test('the key never enters the outcome, however it fails or succeeds', async () => {
  const cases = [
    ok([secretRow]),
    ok([{ ...secretRow, api_key: PUBLISHABLE }]),
    ok([secretRow, { ...secretRow, id: 'k9' }]),
    { status: 401, body: [secretRow] },
  ]
  for (const answer of cases) {
    const { outcome } = await acquire([answer], [1])
    const serialized = JSON.stringify(outcome)
    assert.ok(!serialized.includes(SECRET_KEY), 'the secret key reached the outcome')
    assert.ok(!serialized.includes(PUBLISHABLE), 'a key value reached the outcome')
    assert.ok(!serialized.includes(BRANCH_REF), 'the branch ref reached the outcome')
  }
})

test('the runner keeps the key in memory and never emits it', () => {
  const runner = readFileSync(resolve(ROOT, 'scripts/run-batch-11-remote-rehearsal.ts'), 'utf8')
  // Only the safe half is stored on lifecycle state or emitted.
  assert.match(runner, /lifecycleState\.branchKey = acquisition\.outcome/)
  assert.match(runner, /branchKeyAcquisition: lifecycleState\.branchKey/)
  assert.ok(!/lifecycleState\.\w+ = acquisition\.key/.test(runner), 'the key must not be stored on lifecycle state')
  // Exactly two mentions: the guard that refuses without one, and the single
  // assignment into the runtime binding. Anything else is a new escape route.
  const mentions = runner.match(/acquisition\.key/g) ?? []
  assert.equal(mentions.length, 2, `acquisition.key is referenced ${mentions.length} times; expected exactly 2`)
  assert.match(runner, /if \(!acquisition\.outcome\.acquired \|\| !acquisition\.key\)/)
  assert.match(runner, /branchServiceRole = acquisition\.key!/)
  // The refusal reports classes and counts only.
  assert.match(runner, /JSON\.stringify\(acquisition\.outcome\.statusClasses\)/)
  assert.ok(!/console\.(log|error)[^\n]*acquisition\.key/.test(runner))
  assert.ok(!/fingerprintCredential\(branchServiceRole\)/.test(runner), 'the branch key must not be fingerprinted into evidence')
})

/* --- ordering -------------------------------------------------------------- */

test('no deployment happens before key acquisition and REST readiness', () => {
  const runner = readFileSync(resolve(ROOT, 'scripts/run-batch-11-remote-rehearsal.ts'), 'utf8')
  // Call sites, not the import lines at the top of the file.
  const acquisition = runner.indexOf('await acquireBranchServiceKey({')
  const keyRefusal = runner.indexOf('The branch service key could not be obtained')
  const readiness = runner.indexOf('await awaitRestReadiness({')
  const readinessRefusal = runner.indexOf('never became ready')
  const guard = runner.indexOf('A Preview deployment was attempted before the branch REST API was proven ready')
  // The deployment specifically - not the teardown 'vercel remove', which
  // legitimately appears earlier in the file.
  const deploy = runner.indexOf("execFileSync('vercel', [...vercelDeploymentArguments(")

  assert.ok(acquisition > -1 && keyRefusal > acquisition, 'key acquisition must refuse before continuing')
  assert.ok(readiness > keyRefusal, 'readiness must follow key acquisition')
  assert.ok(readinessRefusal > readiness && guard > readinessRefusal && deploy > guard,
    'the deployment must come last, behind both gates')
})

test('the acquisition probes the branch ref with reveal, over the Management API', async () => {
  const { paths } = await acquire([ok([secretRow])])
  assert.deepEqual(paths, [`/v1/projects/${BRANCH_REF}/api-keys?reveal=true`])
})
