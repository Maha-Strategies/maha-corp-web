import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

// A workflow that writes to a database asserts its target against a literal.
// That literal is only trustworthy while it agrees with the document a human
// reads when deciding which project is which -- otherwise the assertion is
// self-referential and proves nothing.
//
// This is the failure being guarded: for a week the production migration
// workflow ran against staging because a variable said so and nothing
// disagreed. The fix was a literal in the workflow; this keeps that literal
// honest.

const read = (path: string) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

/** The ref the canonical table names as Production. */
async function documentedProductionRef(): Promise<string> {
  const doc = await read('docs/supabase-projects.md')
  const row = doc.split('\n').find((line) => line.includes('**Production**'))
  assert.ok(row, 'docs/supabase-projects.md must contain a row marked **Production**')
  const ref = row.match(/`([a-z0-9]{20})`/)?.[1]
  assert.ok(ref, `could not read a project ref from the Production row: ${row}`)
  return ref
}

test('the migration workflow asserts the ref the documentation calls Production', async () => {
  const workflow = await read('.github/workflows/production-migrations.yml')
  const asserted = workflow.match(/expected='([a-z0-9]{20})'/)?.[1]

  assert.ok(asserted, 'production-migrations.yml must assert an expected project ref')
  assert.equal(
    asserted,
    await documentedProductionRef(),
    'The migration workflow and docs/supabase-projects.md disagree about which project is Production. '
    + 'One of them is about to send migrations to the wrong database.',
  )
})

test('the workflow asserts its target before it does any work', async () => {
  // Ordering is the point. The failure it prevents costs three minutes of
  // install and link against the wrong database before anything notices; more
  // importantly, `Record migration history` would have already reported that
  // database's history as Production's.
  const workflow = await read('.github/workflows/production-migrations.yml')
  const assertion = workflow.indexOf('Assert the Production target')
  const checkout = workflow.indexOf('actions/checkout')
  const link = workflow.indexOf('Link the Production project')

  assert.ok(assertion > 0, 'the target assertion step must exist')
  assert.ok(assertion < checkout, 'the target assertion must run before checkout')
  assert.ok(assertion < link, 'the target assertion must run before linking')
})

test('staging is never the documented Production ref', async () => {
  // The exact substitution that happened. Cheap to assert, and it names the
  // wrong value so a future reader sees what to look out for.
  assert.notEqual(await documentedProductionRef(), 'wukyzcqxzkbwuledzxlx')
})

test('the canonical table lists every project this repository can reach', async () => {
  const doc = await read('docs/supabase-projects.md')
  for (const ref of ['uhwuullakihgszxhiygz', 'wukyzcqxzkbwuledzxlx']) {
    assert.ok(doc.includes(ref), `${ref} must appear in docs/supabase-projects.md`)
  }
})
