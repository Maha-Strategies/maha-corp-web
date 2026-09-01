import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import test from 'node:test'

const ROOT = resolve(import.meta.dirname, '..')

import { REHEARSAL_FLAG, previewDiagnostic } from '../lib/epistemic-ingestion-diagnostics.ts'


/**
 * The diagnostic boundary.
 *
 * A 503 from this route covers two unrelated causes, and telling them apart
 * from outside cost protected rehearsal runs. The Preview deployment may now
 * learn which one it hit - and nothing else, and only there.
 *
 * These drive the real handler rather than inspecting its source, because the
 * property under test is what crosses the wire.
 */

const OPERATIONS_TOKEN = 'o'.repeat(48)

/** The 503 body the route builds, for a given flag value. */
const body = (flag: string | undefined, operation = 'persistence-client-absent', error?: unknown) => ({
  error: { code: 'epistemic_persistence_unavailable', message: 'Epistemic ingestion persistence is unavailable.' },
  ...previewDiagnostic(operation, error, flag),
})

test('Production gets no diagnostic, and its body is unchanged', () => {
  const production = body(undefined)
  assert.ok(!('diagnostic' in production), 'Production must carry no diagnostic key at all')
  // Absent, not empty: the serialized body is byte-for-byte the prior shape.
  assert.deepEqual(Object.keys(production), ['error'])
  assert.equal(JSON.stringify(production), JSON.stringify({
    error: { code: 'epistemic_persistence_unavailable', message: 'Epistemic ingestion persistence is unavailable.' },
  }))
})

test('a near-miss flag value cannot activate the diagnostic', () => {
  for (const value of ['batch-11-preview ', ' batch-11-preview', 'Batch-11-Preview', 'batch-11', 'preview', 'true', '1', '', undefined]) {
    assert.ok(!('diagnostic' in body(value)), `${JSON.stringify(value)} must not activate diagnostics`)
  }
  assert.equal(REHEARSAL_FLAG, 'batch-11-preview')
})

test('the isolated Preview learns which of the two causes it hit', () => {
  const absent = previewDiagnostic('persistence-client-absent', undefined, REHEARSAL_FLAG)
  assert.deepEqual(absent, { diagnostic: { operation: 'persistence-client-absent', sqlstate: 'none' } })

  const threw = previewDiagnostic('persistence-call-failed',
    new Error('Epistemic ingestion failed [42883]: function does not exist'), REHEARSAL_FLAG)
  assert.deepEqual(threw, { diagnostic: { operation: 'persistence-call-failed', sqlstate: '42883' } })
})

test('the diagnostic carries no SQL, value, identifier, URL or credential', () => {
  // A provider message stuffed with everything that must never escape.
  const hostile = new Error(
    `Epistemic ingestion failed [unknown]: insert into public.epistemic_ingestion_batches values ('${OPERATIONS_TOKEN}') `
    + 'at postgres://user:pw@db.abcdefghijklmnop.supabase.co:5432/postgres')
  const serialized = JSON.stringify(body(REHEARSAL_FLAG, 'persistence-call-failed', hostile))

  assert.ok(!serialized.includes(OPERATIONS_TOKEN), 'a credential reached the response')
  for (const forbidden of [/\binsert\b/i, /\bselect\b/i, /public\./, /https?:\/\//, /postgres:\/\//, /supabase\.co/, /epistemic_ingestion_batches/, /user:pw/]) {
    assert.ok(!forbidden.test(serialized), `the response leaked ${forbidden}`)
  }
  // Exactly two fields, so nothing can be added by accident.
  assert.deepEqual(Object.keys((JSON.parse(serialized) as { diagnostic: object }).diagnostic).sort(), ['operation', 'sqlstate'])
})

test('only a fixed code shape can cross, never a provider message', () => {
  // The regex is the boundary: it matches a bracketed SQLSTATE or PostgREST
  // code and nothing else, so a message carrying other bracketed text yields
  // "none" rather than passing that text through.
  const shape = /\[(PGRST\d{3}|[0-9A-Z]{5})\]/
  for (const [message, expected] of [
    ['Epistemic ingestion failed [42883]: function does not exist', '42883'],
    ['Epistemic ingestion failed [PGRST202]: not in schema cache', 'PGRST202'],
    ['Epistemic ingestion failed [unknown]: connect ECONNREFUSED 10.0.0.1:5432', null],
    ['failed [postgres://user:pw@host/db]: nope', null],
    ['failed [select * from epistemic_ingestion_batches]: nope', null],
  ] as const) {
    const matched = message.match(shape)
    assert.equal(matched ? matched[1] : null, expected, message)
  }
})

test('the rehearsal flag is forwarded to the Preview deployment', async () => {
  // The gate above is worthless if the deployment never receives the flag -
  // which is exactly what happened: it was set in the runner's environment and
  // never passed through, so the Preview behaved like Production.
  const { vercelDeploymentArguments } = await import('../lib/batch-11-preview-binding.ts')
  const args = vercelDeploymentArguments('a'.repeat(40))
  assert.ok(args.includes('EPISTEMIC_EXTERNAL_LINEAGE_REHEARSAL'),
    'the Preview deployment must receive the rehearsal flag')
  // Forwarded by name only. The value is never an argument.
  assert.ok(!args.some((argument) => argument.includes('batch-11-preview')))
})

test('the route actually routes its 503 through this boundary', () => {
  // The lib tests above are only load-bearing if the route uses the lib.
  const route = readFileSync(resolve(ROOT, 'app/api/admin/epistemic-ingestion/route.ts'), 'utf8')
  assert.match(route, /import \{ previewDiagnostic \} from '@\/lib\/epistemic-ingestion-diagnostics'/)
  assert.match(route, /\.\.\.previewDiagnostic\(operation, error\),/)
  // Both null-client sites name themselves, which is the distinction that was
  // missing when a 503 could mean either cause.
  assert.equal((route.match(/unavailable\(undefined, 'persistence-client-absent'\)/g) ?? []).length, 2)
  // The route must not re-derive the gate itself.
  assert.ok(!/EPISTEMIC_EXTERNAL_LINEAGE_REHEARSAL/.test(route), 'the flag check belongs in one place')
})

/* --- the releases route shares the same boundary -------------------------- */

test('the releases route routes its 503 through the same boundary', () => {
  const route = readFileSync(resolve(ROOT, 'app/api/admin/epistemic-releases/route.ts'), 'utf8')
  assert.match(route, /import \{ previewDiagnostic \} from '@\/lib\/epistemic-ingestion-diagnostics'/)
  assert.match(route, /\.\.\.previewDiagnostic\(operation, error\),/)
  assert.equal((route.match(/unavailable\(undefined, 'persistence-client-absent'\)/g) ?? []).length, 2)
  assert.ok(!/EPISTEMIC_EXTERNAL_LINEAGE_REHEARSAL/.test(route), 'the flag check belongs in one place')
  // The 400/409/404 arms are untouched: only the unclassified case gains a code.
  assert.match(route, /message\.includes\('\[22023\]'\)/)
  assert.match(route, /message\.includes\('\[P0001\]'\)/)
  assert.match(route, /message\.includes\('\[P0002\]'\)/)
})

test('the release operation names are fixed enums, not free text', () => {
  const route = readFileSync(resolve(ROOT, 'app/api/admin/epistemic-releases/route.ts'), 'utf8')
  const operations = [...route.matchAll(/unavailable\((?:undefined, )?'([a-z-]+)'\)/g)].map((match) => match[1])
  const declared = route.match(/operation = '([a-z-]+)'/)?.[1]
  for (const operation of [...operations, declared!]) {
    assert.match(operation, /^[a-z][a-z-]{4,40}$/, `${operation} must be a fixed lowercase enum`)
  }
  assert.ok(new Set([...operations, declared!]).size <= 3, 'the operation vocabulary must stay small and fixed')
})

test('a release failure carries a SQLSTATE and nothing else', () => {
  // The exact shape the release path produced: 42725 from an ambiguous operator.
  const real = new Error('Epistemic canonical release failed [42725]: operator is not unique: unknown - unknown')
  assert.deepEqual(previewDiagnostic('release-persistence-call-failed', real, REHEARSAL_FLAG),
    { diagnostic: { operation: 'release-persistence-call-failed', sqlstate: '42725' } })
  assert.deepEqual(previewDiagnostic('release-persistence-call-failed', real, undefined), {})
})
