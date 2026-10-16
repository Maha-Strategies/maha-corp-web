import { strict as assert } from 'node:assert'
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import test from 'node:test'

test('the Git ignore step fails closed for every environment and commit range', () => {
  for (const environment of ['production', 'preview', 'development', undefined]) {
    for (const sha of [undefined, 'deadbeef', '1aaaac7f0d04a2482cd4c40ad21941ed79eba55f']) {
      const result = spawnSync(process.execPath, ['scripts/vercel-should-build.cjs'], { encoding: 'utf8',
        env: { ...process.env, VERCEL_ENV: environment, VERCEL_GIT_COMMIT_SHA: sha } })
      assert.equal(result.status, 0, 'Vercel exit 0 skips, exit 1 spends build credits')
      assert.match(result.stdout, /Skipping automatic Git build/)
    }
  }
})
test('all Git branches are disabled, without disturbing cron schedules or normal local builds', () => {
  const config = JSON.parse(readFileSync('vercel.json', 'utf8'))
  assert.equal(config.ignoreCommand, 'node scripts/vercel-should-build.cjs')
  assert.equal(config.git.deploymentEnabled, false, 'a true main override would restart automatic spending')
  assert.ok(config.crons.some((c: { path: string }) => c.path === '/api/cron/x402-settlements'))
  const pkg = JSON.parse(readFileSync('package.json', 'utf8'))
  assert.equal(pkg.scripts.build, 'next build', 'approved manual and local builds remain possible')
})
