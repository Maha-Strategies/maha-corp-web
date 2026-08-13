import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('personal call, family and internal assessment documents are ignored', async () => {
  const ignore = await readFile(new URL('../.gitignore', import.meta.url), 'utf8')
  assert.match(ignore, /\/artifacts\/\*Call-Guide\*\.docx/)
  assert.match(ignore, /\/docs\/\*Family_Guide\*\.docx/)
  assert.match(ignore, /\/docs\/reports\/maha-strategies-\*-report-\*\.md/)
  assert.match(ignore, /\/scripts\/create-\*-call-guide\.py/)
  assert.match(ignore, /\/scripts\/create-\*-family-guide\.py/)

  const tracked = execFileSync('git', ['ls-files'], { encoding: 'utf8' }).split('\n').filter(Boolean)
  const privateArtifacts = tracked.filter((path) => [
    /^artifacts\/.*Call-Guide.*\.(?:docx|pdf)$/i,
    /^docs\/.*Family_Guide.*\.(?:docx|pdf)$/i,
    /^docs\/reports\/maha-strategies-.*-report-.*\.md$/i,
    /^scripts\/create-.*-(?:call|family)-guide\.py$/i,
  ].some((pattern) => pattern.test(path)))
  assert.deepEqual(privateArtifacts, [])
})
