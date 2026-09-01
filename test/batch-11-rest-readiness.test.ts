import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import test from 'node:test'

import {
  DEFAULT_DELAYS,
  READINESS_RELATION,
  awaitRestReadiness,
} from '../lib/batch-11-rest-readiness.ts'

/**
 * "The database is up" is not "the API is up".
 *
 * Run 33491367609 applied six migrations over psql and then failed its first
 * application call with no status and no SQLSTATE, because PostgREST had not
 * begun serving on the branch hostname. Direct SQL proved the database; nothing
 * proved the interface the deployment actually uses.
 *
 * These pin the asymmetry: only an expected success is readiness, ordinary
 * propagation states are waited out, and a rejected credential refuses at once
 * instead of hiding behind a timeout.
 */

const ROOT = resolve(import.meta.dirname, '..')
const BRANCH_URL = 'https://ephemeralbranchref00.supabase.co'
const SERVICE_ROLE = ['eyJ', 'a'.repeat(60), '.', 'b'.repeat(40), '.', 'c'.repeat(43)].join('')

/** Replays a scripted sequence of provider answers, with no real waiting. */
function scripted(answers: readonly (number | 'network' | { status: number; body: string })[]) {
  const seen: { url: string; headers: Record<string, string> }[] = []
  const slept: number[] = []
  let index = 0
  const fetchImpl = (async (url: string | URL | Request, init?: RequestInit) => {
    seen.push({
      url: String(url),
      headers: Object.fromEntries(Object.entries((init?.headers ?? {}) as Record<string, string>)),
    })
    const answer = answers[Math.min(index, answers.length - 1)]
    index += 1
    if (answer === 'network') throw new TypeError('fetch failed')
    const { status, body } = typeof answer === 'number' ? { status: answer, body: '[]' } : answer
    return new Response(status === 200 ? body : '', { status })
  }) as unknown as typeof fetch
  return { fetchImpl, seen, slept, sleep: async (ms: number) => { slept.push(ms) } }
}

const run = (answers: readonly (number | 'network' | { status: number; body: string })[], delaysMs = DEFAULT_DELAYS) => {
  const harness = scripted(answers)
  return awaitRestReadiness({
    branchApiUrl: BRANCH_URL, serviceRole: SERVICE_ROLE, delaysMs,
    fetchImpl: harness.fetchImpl, sleep: harness.sleep,
  }).then((outcome) => ({ outcome, ...harness }))
}

/* --- 1, 2: transient states are waited out -------------------------------- */

test('repeated 503 followed by 200 becomes ready', async () => {
  const { outcome } = await run([503, 503, 503, 200])
  assert.equal(outcome.ready, true)
  assert.equal(outcome.attempts, 4)
  assert.equal(outcome.refusal, null)
  assert.deepEqual(outcome.statusClasses, { 503: 3, 200: 1 })
})

test('network failures followed by readiness pass within the bound', async () => {
  // The exact shape run 33491367609 produced: no status at all.
  const { outcome, slept } = await run(['network', 'network', 200])
  assert.equal(outcome.ready, true)
  assert.equal(outcome.statusClasses.network, 2)
  assert.deepEqual(slept, [DEFAULT_DELAYS[0], DEFAULT_DELAYS[1]], 'the retry schedule must be deterministic')
})

test('404 and the 5xx family are treated as propagation, not failure', async () => {
  for (const transient of [404, 500, 502, 503, 504, 429]) {
    const { outcome } = await run([transient, 200])
    assert.equal(outcome.ready, true, `${transient} must be retried`)
    assert.equal(outcome.statusClasses[String(transient)], 1)
  }
})

/* --- 3: permanent unavailability is bounded ------------------------------- */

test('permanent unavailability times out and never reports ready', async () => {
  const delays = [1, 1, 1]
  const { outcome, seen, slept } = await run([503], delays)
  assert.equal(outcome.ready, false)
  assert.equal(outcome.refusal, 'timed-out')
  assert.equal(outcome.attempts, delays.length + 1)
  assert.equal(seen.length, delays.length + 1, 'attempts must be bounded by the schedule')
  assert.equal(slept.length, delays.length, 'the final attempt is not followed by a wait')
})

test('a timeout refuses the run before any deployment is attempted', () => {
  // The gate throws, so bindPreview cannot reach the Vercel call below it.
  const runner = readFileSync(resolve(ROOT, 'scripts/run-batch-11-remote-rehearsal.ts'), 'utf8')
  const bind = runner.slice(runner.indexOf('async bindPreview('))
  const gate = bind.indexOf('awaitRestReadiness')
  const refusal = bind.indexOf('never became ready')
  const deploy = bind.indexOf("execFileSync('vercel'")
  assert.ok(gate > -1 && refusal > gate, 'readiness must be checked and refused before anything else')
  assert.ok(deploy > refusal, 'the deployment must come after the readiness refusal')
})

/* --- 4: a rejected credential is not propagation -------------------------- */

test('401 and 403 refuse immediately without retrying', async () => {
  for (const [status, refusal] of [[401, 'unauthorized'], [403, 'forbidden']] as const) {
    const { outcome, seen, slept } = await run([status, 200])
    assert.equal(outcome.ready, false)
    assert.equal(outcome.refusal, refusal)
    assert.equal(outcome.attempts, 1)
    assert.equal(seen.length, 1, 'a rejected credential must not be retried')
    assert.deepEqual(slept, [], 'refusal must not wait')
  }
})

/* --- 5: only the expected response counts --------------------------------- */

test('a 200 from something other than this relation is not readiness', async () => {
  for (const body of ['<!doctype html><title>hi</title>', '{"message":"ok"}', 'null', '']) {
    const { outcome } = await run([{ status: 200, body }], [1, 1])
    assert.equal(outcome.ready, false, `a 200 returning ${JSON.stringify(body.slice(0, 20))} must not satisfy readiness`)
    assert.equal(outcome.refusal, 'timed-out')
    assert.equal(outcome.statusClasses['200-unexpected'], 3)
  }
})

test('readiness probes the migrated Batch 11 relation, authenticated', async () => {
  const { seen } = await run([200])
  assert.equal(seen.length, 1)
  assert.ok(seen[0].url.startsWith(`${BRANCH_URL}/rest/v1/${READINESS_RELATION}?`),
    'readiness must probe the Batch 11 relation over PostgREST')
  // The credential travels in headers, never in the URL.
  assert.equal(seen[0].headers.apikey, SERVICE_ROLE)
  assert.equal(seen[0].headers.authorization, `Bearer ${SERVICE_ROLE}`)
  assert.ok(!seen[0].url.includes(SERVICE_ROLE))
})

/* --- 6: nothing sensitive can escape -------------------------------------- */

test('the outcome carries no credential, hostname or response body', async () => {
  const { outcome } = await run([
    { status: 200, body: `{"leak":"${SERVICE_ROLE}"}` }, 503, 'network',
  ], [1, 1, 1])
  const serialized = JSON.stringify(outcome)
  assert.ok(!serialized.includes(SERVICE_ROLE), 'the service role reached the outcome')
  assert.ok(!serialized.includes('ephemeralbranchref00'), 'the branch hostname reached the outcome')
  assert.ok(!serialized.includes('supabase.co'), 'the branch URL reached the outcome')
  assert.ok(!serialized.includes('leak'), 'a response body reached the outcome')
  // Only counts per class survive.
  for (const value of Object.values(outcome.statusClasses)) assert.equal(typeof value, 'number')
})

test('the runner never logs the readiness credential or URL', () => {
  const runner = readFileSync(resolve(ROOT, 'scripts/run-batch-11-remote-rehearsal.ts'), 'utf8')
  const bind = runner.slice(runner.indexOf('async bindPreview('), runner.indexOf('async bindPreview(') + 2500)
  assert.match(bind, /awaitRestReadiness\(\{ branchApiUrl, serviceRole: branchServiceRole \}\)/)
  // The refusal reports classes and counts, never the URL or the credential.
  assert.match(bind, /JSON\.stringify\(readiness\.statusClasses\)/)
  assert.ok(!/never became ready[^`]*branchApiUrl/.test(bind))
  assert.ok(!/console\.(log|error)[^\n]*branchServiceRole/.test(runner))
})

/* --- 7: ordering is recorded, not just performed -------------------------- */

test('the evidence records that deployment followed readiness', () => {
  const runner = readFileSync(resolve(ROOT, 'scripts/run-batch-11-remote-rehearsal.ts'), 'utf8')
  assert.match(runner, /deploymentFollowedRestReadiness:\s*\n\s*lifecycleState\.restReadyAtMs > 0 && lifecycleState\.deploymentStartedAtMs >= lifecycleState\.restReadyAtMs/)
  assert.match(runner, /A Preview deployment was attempted before the branch REST API was proven ready\./)
  assert.match(runner, /restReadiness: lifecycleState\.restReadiness/)
})
