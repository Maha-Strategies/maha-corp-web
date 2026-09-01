import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import test from 'node:test'

import {
  PRODUCTION_SUPABASE_PROJECT_REF,
  REQUIRED_MIGRATIONS,
  assertMigrationsAllowed,
  RehearsalRefused,
} from '../lib/batch-11-rehearsal-phases.ts'

/**
 * The Preview branch is genuinely empty.
 *
 * The first protected rehearsal failed applying the Batch 11 migration because
 * `public.epistemic_ingestion_batches` did not exist. The allowlist had assumed
 * a branch would arrive carrying the epistemic tables; a schema-only branch
 * carries nothing.
 *
 * These tests re-derive the prerequisite set from the SQL itself rather than
 * trusting the list, so the allowlist stays correct when a migration changes
 * what it references.
 */

const ROOT = resolve(import.meta.dirname, '..')
const MIGRATIONS = resolve(ROOT, 'supabase/migrations')

const sqlOf = (name: string) => readFileSync(join(MIGRATIONS, name), 'utf8')
/** Comments legitimately discuss tables a migration does not touch. */
const withoutComments = (sql: string) => sql.replace(/--[^\n]*/g, '')
/** Function bodies define behaviour; they are not this migration's own DML. */
const withoutFunctionBodies = (sql: string) => sql.replace(/\$\$[\s\S]*?\$\$/g, '<<body>>')

const RELATION = '([a-z_]+\\.[a-z_0-9]+)'
const matchAll = (sql: string, pattern: string): string[] =>
  [...sql.matchAll(new RegExp(pattern, 'gi'))].map((entry) => entry[1].toLowerCase())

const createdBy = (sql: string) =>
  new Set(matchAll(withoutComments(sql), `\\bcreate\\s+(?:or\\s+replace\\s+)?(?:table|view|materialized\\s+view)\\s+(?:if\\s+not\\s+exists\\s+)?${RELATION}`))

const referencedBy = (sql: string) => {
  const body = withoutComments(sql)
  return new Set([
    ...matchAll(body, `\\balter\\s+table\\s+(?:if\\s+exists\\s+)?(?:only\\s+)?${RELATION}`),
    ...matchAll(body, `\\breferences\\s+${RELATION}`),
    ...matchAll(body, `\\b(?:insert\\s+into|update|delete\\s+from)\\s+${RELATION}`),
    ...matchAll(body, `\\bfrom\\s+${RELATION}`),
    ...matchAll(body, `\\bjoin\\s+${RELATION}`),
  ])
}

const publicOnly = (relations: Iterable<string>) => [...relations].filter((entry) => entry.startsWith('public.'))

test('every migration in the allowlist exists on disk', () => {
  const present = new Set(readdirSync(MIGRATIONS))
  for (const migration of REQUIRED_MIGRATIONS) {
    assert.ok(present.has(migration), `${migration} is declared but absent`)
  }
})

test('every relation a migration alters or references is created earlier in the sequence', () => {
  // The property the failed rehearsal violated, checked over the whole ordered
  // sequence rather than the final set.
  const created = new Set<string>()
  for (const migration of REQUIRED_MIGRATIONS) {
    const sql = sqlOf(migration)
    const mine = createdBy(sql)
    const needed = publicOnly(referencedBy(sql)).filter((relation) => !mine.has(relation))
    const missing = needed.filter((relation) => !created.has(relation))
    assert.deepEqual(missing, [], `${migration} uses ${missing.join(', ')} before anything creates it`)
    for (const relation of mine) created.add(relation)
  }
  // And the tables the failure named are among them.
  for (const relation of ['public.epistemic_ingestion_batches', 'public.epistemic_ingestion_records',
    'public.epistemic_expert_review_decisions', 'public.epistemic_canonical_releases']) {
    assert.ok(created.has(relation), `${relation} is never created by the bootstrap sequence`)
  }
})

test('the allowlist is exactly the transitive closure of what Batch 11 needs', () => {
  // Re-derived from the SQL, so a migration that starts referencing something
  // new fails this test instead of failing a live run.
  const owner = new Map<string, string>()
  for (const file of readdirSync(MIGRATIONS).filter((name) => name.endsWith('.sql')).sort()) {
    for (const relation of createdBy(sqlOf(file))) {
      if (!owner.has(relation)) owner.set(relation, file)
    }
  }
  // Three now: the plan, the execution, and the forward correction that made
  // the release content comparison reachable instead of raising 42725.
  const batch11 = REQUIRED_MIGRATIONS.filter((name) => name.includes('batch_11'))
  assert.equal(batch11.length, 3, 'the three Batch 11 migrations must be the terminal entries')

  const needed = new Set<string>()
  const seen = new Set<string>()
  let frontier = new Set(batch11)
  while (frontier.size > 0) {
    const next = new Set<string>()
    for (const file of frontier) {
      if (seen.has(file)) continue
      seen.add(file)
      needed.add(file)
      const sql = sqlOf(file)
      const mine = createdBy(sql)
      for (const relation of publicOnly(referencedBy(sql))) {
        if (mine.has(relation)) continue
        const source = owner.get(relation)
        assert.ok(source, `${relation} is referenced by ${file} but no migration creates it`)
        if (!seen.has(source)) next.add(source)
      }
    }
    frontier = next
  }
  assert.deepEqual([...needed].sort(), [...REQUIRED_MIGRATIONS].sort(),
    'the allowlist is not exactly the set the Batch 11 migrations require')
})

test('the bootstrap seeds no rows: every insert lives in a function body', () => {
  for (const migration of REQUIRED_MIGRATIONS) {
    const topLevel = matchAll(withoutFunctionBodies(withoutComments(sqlOf(migration))), `\\binsert\\s+into\\s+${RELATION}`)
    assert.deepEqual(topLevel, [], `${migration} seeds rows at the top level: ${topLevel.join(', ')}`)
  }
})

test('no admitted migration touches an unrelated or personal-data domain', () => {
  for (const migration of REQUIRED_MIGRATIONS) {
    const sql = withoutComments(sqlOf(migration)).toLowerCase()
    for (const domain of ['natal', 'customer', 'invitation', 'payment', 'enquiry', 'participant', 'pilot']) {
      assert.ok(!sql.includes(domain), `${migration} references the ${domain} domain`)
    }
  }
})

test('the allowlist admits nothing beyond the declared six', () => {
  const all = readdirSync(MIGRATIONS).filter((name) => name.endsWith('.sql'))
  assert.ok(all.length > REQUIRED_MIGRATIONS.length, 'the repository must hold migrations the rehearsal does not apply')
  const excluded = all.filter((name) => !REQUIRED_MIGRATIONS.includes(name))
  for (const migration of excluded.slice(0, 5)) {
    assert.throws(() => assertMigrationsAllowed([...REQUIRED_MIGRATIONS, migration]), RehearsalRefused, migration)
  }
})

test('missing, duplicated, reordered or extra migrations fail closed', () => {
  assert.doesNotThrow(() => assertMigrationsAllowed([...REQUIRED_MIGRATIONS]))

  for (let index = 0; index < REQUIRED_MIGRATIONS.length; index += 1) {
    const missing = REQUIRED_MIGRATIONS.filter((_, position) => position !== index)
    assert.throws(() => assertMigrationsAllowed(missing), RehearsalRefused, `missing ${REQUIRED_MIGRATIONS[index]}`)
  }
  for (let index = 0; index < REQUIRED_MIGRATIONS.length - 1; index += 1) {
    const swapped = [...REQUIRED_MIGRATIONS]
    ;[swapped[index], swapped[index + 1]] = [swapped[index + 1], swapped[index]]
    assert.throws(() => assertMigrationsAllowed(swapped), RehearsalRefused, `swapped ${index}`)
  }
  assert.throws(() => assertMigrationsAllowed([...REQUIRED_MIGRATIONS, REQUIRED_MIGRATIONS[0]]), RehearsalRefused, 'duplicate')
  assert.throws(() => assertMigrationsAllowed([]), RehearsalRefused, 'empty')
})

test('the Production Supabase project can never be the target', () => {
  assert.match(PRODUCTION_SUPABASE_PROJECT_REF, /^[a-z]{20}$/)
  const workflow = readFileSync(resolve(ROOT, '.github/workflows/preview-batch-11-remote-rehearsal.yml'), 'utf8')
  assert.ok(workflow.includes(PRODUCTION_SUPABASE_PROJECT_REF), 'the Production ref must be named in order to be refused')
  assert.match(workflow, new RegExp(`!=\\s*'${PRODUCTION_SUPABASE_PROJECT_REF}'`))
  const runner = readFileSync(resolve(ROOT, 'scripts/run-batch-11-remote-rehearsal.ts'), 'utf8')
  assert.match(runner, /production-project-targeted/)
})
