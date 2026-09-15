import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { selected } from '../scripts/run-bazaar-listing-refresh.ts'

test('compatibility indexing cannot widen the completed 23-offer payment cohort', () => {
  const cohort = selected('compatibility')
  assert.deepEqual(cohort.map(o => [o.id, o.amount]), [
    ['celestial-result-compatibility', '7000'], ['evidence-frame-compatibility', '10500'],
  ])
  assert.equal(cohort.reduce((n, o) => n + BigInt(o.amount), BigInt(0)), BigInt(17500))
  assert.equal(selected('launch').length, 23)
  assert.ok(cohort.every(o => !selected('launch').some(old => old.id === o.id)))
  const script = readFileSync(new URL('../scripts/run-bazaar-listing-refresh.ts', import.meta.url), 'utf8')
  assert.match(script, /original_23_launch_settled_do_not_repay/)
  assert.match(script, /await verifyMicroProduct/)
  const workflow = readFileSync(new URL('../.github/workflows/compatibility-launch-index.yml', import.meta.url), 'utf8')
  assert.match(workflow, /github.run_attempt == 1/)
  assert.doesNotMatch(workflow, /--phase=launch/)
})
