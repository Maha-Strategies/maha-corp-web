import { strict as assert } from 'node:assert'
import { execFileSync, spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import test from 'node:test'

/**
 * Vercel inverts the exit codes: 0 skips the build, 1 builds it. Every
 * assertion below states which it means, because the convention is backwards
 * from everything else and a silent inversion here would stop deploying the
 * site.
 */
const BUILD = 1
const SKIP = 0

function decide(env: Record<string, string | undefined>) {
  return spawnSync(process.execPath, ['scripts/vercel-should-build.cjs'],
    { encoding: 'utf8', env: { ...process.env, ...env } })
}

const head = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
const parent = execFileSync('git', ['rev-parse', 'HEAD^'], { encoding: 'utf8' }).trim()

test('a production deployment is never skipped', () => {
  for (const env of ['production', undefined]) {
    const r = decide({ VERCEL_ENV: env, VERCEL_GIT_PREVIOUS_SHA: parent, VERCEL_GIT_COMMIT_SHA: head })
    assert.equal(r.status, BUILD, `VERCEL_ENV=${env} must build; the live site must never go stale to save a build`)
  }
})

test('an undecidable range builds rather than guessing', () => {
  assert.equal(decide({ VERCEL_ENV: 'preview' }).status, BUILD, 'no shas must build')
  assert.equal(decide({ VERCEL_ENV: 'preview', VERCEL_GIT_PREVIOUS_SHA: parent }).status, BUILD)
  assert.equal(decide({
    VERCEL_ENV: 'preview', VERCEL_GIT_PREVIOUS_SHA: 'deadbeefdeadbeef', VERCEL_GIT_COMMIT_SHA: head,
  }).status, BUILD, 'an unreadable diff must build')
})

test('a commit touching only tests, docs, workflows or scripts is skipped', () => {
  // cc3107f converted test assertions and nothing else.
  const r = decide({ VERCEL_ENV: 'preview', VERCEL_GIT_PREVIOUS_SHA: 'cc3107f^', VERCEL_GIT_COMMIT_SHA: 'cc3107f' })
  assert.equal(r.status, SKIP, r.stdout)
  assert.match(r.stdout, /Skipping/)
})

test('a commit touching lib or content builds', () => {
  // 0e52186 changed the related-records derivation, which changes the pages.
  const r = decide({ VERCEL_ENV: 'preview', VERCEL_GIT_PREVIOUS_SHA: '0e52186^', VERCEL_GIT_COMMIT_SHA: '0e52186' })
  assert.equal(r.status, BUILD, r.stdout)
  assert.match(r.stdout, /Building/)
})

test('an app or component change always builds', () => {
  const r = decide({ VERCEL_ENV: 'preview', VERCEL_GIT_PREVIOUS_SHA: '02cdac9^', VERCEL_GIT_COMMIT_SHA: '02cdac9' })
  assert.equal(r.status, BUILD, 'the evidence-status banner changed 133 pages and must deploy')
})

test('the inert list cannot swallow a path the site can read', () => {
  const src = readFileSync('scripts/vercel-should-build.cjs', 'utf8')
  const inert = src.slice(src.indexOf('const INERT'), src.indexOf(']', src.indexOf('const INERT')))
  for (const reachable of ['app', 'components', 'lib', 'public', 'content', 'package.json', 'next.config']) {
    assert.ok(!inert.includes(`^${reachable}`), `${reachable} is reachable from the served site and must never be inert`)
  }
})

test('vercel.json wires the command and still builds main', () => {
  const config = JSON.parse(readFileSync('vercel.json', 'utf8'))
  assert.equal(config.ignoreCommand, 'node scripts/vercel-should-build.cjs')
  assert.equal(config.git.deploymentEnabled.main, true, 'main must keep deploying')
  assert.ok(Array.isArray(config.crons) && config.crons.length > 0, 'the cron schedule must survive the edit')
})
