import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import test from 'node:test'

import canaryManifest from '../content/review/release-canary-manifest.json' with { type: 'json' }
import projectionArtifact from '../content/review/exact-revision-projection.json' with { type: 'json' }
import { REQUIRED_MIGRATIONS } from '../lib/batch-11-rehearsal-phases.ts'
import { buildEpistemicIngestionBatch, parseEpistemicIngestionRequest } from '../lib/epistemic-ingestion.ts'
import { insertEpistemicIngestionBatch } from '../lib/epistemic-ingestion-store.ts'
import { epistemicOperationsHash } from '../lib/epistemic-review.ts'
import { loadPool, makeClient } from './helpers/postgres-supabase-shim.ts'

/**
 * The canary cohort's release lifecycle, proven against a real database.
 *
 * The Preview rehearsal cannot run: five of the seven credentials it needs were
 * revoked when Batch 11 closed, and none of them is this repository's to mint.
 * What can be proven without them is everything the Preview run would prove
 * about the *data* - that the schema accepts these five exact revisions, that
 * the release path classifies them as initial, and that the records held back
 * stay held back.
 *
 * That is the part worth de-risking before a protected run. It leaves only the
 * Preview infrastructure itself unproven, which is what a Preview run is for.
 */

const ROOT = resolve(import.meta.dirname, '..')
const PG_BIN = ['/opt/homebrew/opt/postgresql@17/bin', '/usr/lib/postgresql/17/bin', '/usr/local/opt/postgresql@17/bin']
  .find((dir) => existsSync(join(dir, 'initdb')))
const skip = PG_BIN ? false : 'no local PostgreSQL 17'

function cluster() {
  const dir = mkdtempSync(join(tmpdir(), 'canary-'))
  const data = join(dir, 'data')
  const port = String(50000 + Math.floor(Math.random() * 10000))
  const pg = (name: string) => join(PG_BIN!, name)
  const env = { ...process.env, LC_ALL: 'C', LANG: 'C', PGHOST: '127.0.0.1', PGPORT: port, PGUSER: 'postgres' }
  const psql = (args: string[], input?: string) =>
    execFileSync(pg('psql'), ['-v', 'ON_ERROR_STOP=1', '-q', '-At', ...args], { env, input, encoding: 'utf8' })

  execFileSync(pg('initdb'), ['-D', data, '-U', 'postgres', '--auth=trust', '--locale=C'], { env, stdio: 'ignore' })
  execFileSync(pg('pg_ctl'), ['-D', data, '-o', `-p ${port} -k ${dir} -c listen_addresses='127.0.0.1'`, '-l', join(dir, 'log'), '-w', 'start'],
    { env, stdio: 'ignore' })
  psql(['-d', 'postgres', '-c', "create database canary encoding 'UTF8' template template0 lc_collate 'C' lc_ctype 'C';"])
  psql(['-d', 'canary'], `
    create schema if not exists extensions;
    do $$ begin
      if not exists (select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;
      if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
      if not exists (select 1 from pg_roles where rolname='service_role') then create role service_role nologin bypassrls; end if;
    end $$;
    create extension if not exists pgcrypto with schema extensions;`)
  // Only the declared allowlist. A migration outside it is exactly the kind of
  // schema drift a schema-only rehearsal exists to catch.
  for (const migration of REQUIRED_MIGRATIONS) {
    psql(['-d', 'canary', '--single-transaction', '-f', resolve(ROOT, 'supabase/migrations', migration)])
  }
  return {
    connectionString: `postgres://postgres@127.0.0.1:${port}/canary`,
    psql,
    stop() {
      spawnSync(pg('pg_ctl'), ['-D', data, '-m', 'immediate', 'stop'], { env, stdio: 'ignore' })
      rmSync(dir, { recursive: true, force: true })
    },
  }
}

/* --- the cohort is what it claims to be ----------------------------------- */

test('the canary is five release-ready records from five domains, all initial', () => {
  const cohort = canaryManifest.canary as { recordId: string; domainSlug: string; releaseKind: string; revisionSha256: string }[]
  assert.equal(cohort.length, 5)
  assert.equal(new Set(cohort.map((entry) => entry.domainSlug)).size, 5, 'five domains')
  assert.equal(new Set(cohort.map((entry) => entry.recordId)).size, 5)
  for (const entry of cohort) {
    assert.equal(entry.releaseKind, 'initial', 'none of these records supersedes an existing release')
    assert.match(entry.revisionSha256, /^sha256:[0-9a-f]{64}$/)
  }
  assert.equal(canaryManifest.released, false, 'the manifest must not claim release')
})

test('every canary record is release-ready in the projection, and none is held', () => {
  const rows = projectionArtifact.projections as { recordId: string; classification: string; releaseAuthorized: boolean }[]
  const byId = new Map(rows.map((row) => [row.recordId, row]))
  for (const entry of canaryManifest.canary as { recordId: string }[]) {
    const row = byId.get(entry.recordId)
    assert.ok(row, `${entry.recordId} is not in the projection`)
    assert.equal(row.classification, 'release-ready')
    assert.equal(row.releaseAuthorized, true)
  }
  // And the held-back records are genuinely elsewhere.
  const canaryIds = new Set((canaryManifest.canary as { recordId: string }[]).map((entry) => entry.recordId))
  for (const row of rows.filter((entry) => entry.classification !== 'release-ready')) {
    assert.ok(!canaryIds.has(row.recordId), `${row.recordId} is not release-ready yet appears in the canary`)
  }
  // Counts partition the cohort rather than being pinned individually: the
  // revise total moved from 7 to 4 when the inspection-depth classifier was
  // corrected, and a hard pin would have preserved the defect.
  const byClass = rows.reduce((counts, row) => counts.set(row.classification, (counts.get(row.classification) ?? 0) + 1), new Map<string, number>())
  assert.equal([...byClass.values()].reduce((sum, count) => sum + count, 0), 38, 'the cohort is 38 records')
  assert.equal(byClass.get('rejected'), 1)
  assert.ok((byClass.get('revise-and-rereview') ?? 0) > 0, 'a cohort with nothing sent back would not be a review')
  assert.equal(byClass.get('release-ready')! + byClass.get('revise-and-rereview')! + byClass.get('rejected')!, 38)
})

/* --- the schema accepts them, and only them ------------------------------- */

test('the required migrations build a schema that accepts the canary revisions', { skip }, async (t) => {
  const db = cluster()
  const pool = await loadPool(db.connectionString)
  if (!pool) { db.stop(); return t.skip('pg module not installed') }
  const client = makeClient(pool) as never
  const raw = client as unknown as { raw(sql: string, values?: unknown[]): Promise<{ rows: Record<string, unknown>[] }>; end(): Promise<void> }

  try {
    // The release-control tables and RPC the canary would use must exist from
    // the allowlist alone, with execution granted to the service role only.
    const objects = await raw.raw(`
      select p.proname as name, 'function' as kind from pg_proc p
        join pg_namespace n on n.oid = p.pronamespace
        where n.nspname='public' and p.proname in ('record_epistemic_canonical_release','record_epistemic_expert_review')
      union all
      select t.tablename, 'table' from pg_tables t where t.schemaname='public'
        and t.tablename in ('epistemic_canonical_releases','epistemic_expert_review_decisions','epistemic_ingestion_records')
      order by 1`)
    const present = new Set(objects.rows.map((row) => String(row.name)))
    for (const required of [
      'record_epistemic_canonical_release', 'record_epistemic_expert_review',
      'epistemic_canonical_releases', 'epistemic_expert_review_decisions', 'epistemic_ingestion_records',
    ]) {
      assert.ok(present.has(required), `${required} must exist from the declared allowlist`)
    }

    const grants = await raw.raw(`
      select grantee from information_schema.role_routine_grants
      where routine_name = 'record_epistemic_canonical_release' and privilege_type = 'EXECUTE' order by 1`)
    const grantees = grants.rows.map((row) => String(row.grantee))
    assert.ok(grantees.includes('service_role'), 'the release RPC must be executable by the service role')
    for (const forbidden of ['anon', 'authenticated', 'PUBLIC']) {
      assert.ok(!grantees.includes(forbidden), `${forbidden} must not execute the release RPC`)
    }

    // Nothing is released by building the schema.
    const releases = await raw.raw('select count(*)::int as n from public.epistemic_canonical_releases')
    assert.equal(releases.rows[0].n, 0, 'a fresh schema holds no releases')
  } finally {
    await raw.end()
    db.stop()
  }
})

test('ingesting the cohort does not release it', { skip }, async (t) => {
  const db = cluster()
  const pool = await loadPool(db.connectionString)
  if (!pool) { db.stop(); return t.skip('pg module not installed') }
  const client = makeClient(pool) as never
  const raw = client as unknown as { raw(sql: string, values?: unknown[]): Promise<{ rows: Record<string, unknown>[] }>; end(): Promise<void> }

  try {
    const parsed = parseEpistemicIngestionRequest({
      adapterId: 'batch-11-mixed-lineage-rehearsal', idempotencyKey: 'canary-schema-probe',
    })
    await insertEpistemicIngestionBatch(client, buildEpistemicIngestionBatch(parsed), 'canary-schema-probe',
      epistemicOperationsHash('canary-actor-material'))

    const ingested = await raw.raw('select count(*)::int as n from public.epistemic_ingestion_records')
    assert.ok(Number(ingested.rows[0].n) > 0, 'ingestion must persist records')

    // The point: ingestion is not release, and a page cannot follow from it.
    const released = await raw.raw('select count(*)::int as n from public.epistemic_canonical_releases')
    assert.equal(released.rows[0].n, 0, 'ingesting a record must not release it')
  } finally {
    await raw.end()
    db.stop()
  }
})

/* --- the Preview plan is honest about not having run ---------------------- */

test('the Preview plan states it is undispatched and Production-forbidden', async () => {
  const plan = (await import('../content/review/preview-release-plan.json', { with: { type: 'json' } })).default as Record<string, unknown>
  assert.equal(plan.dispatched, false)
  assert.equal(plan.productionMutationAuthorized, false)
  assert.equal((plan.releaseKinds as { initial: number; superseding: number }).initial, 5)
  assert.equal((plan.releaseKinds as { superseding: number }).superseding, 0)
  const controls = plan.controls as Record<string, string>
  for (const key of ['staleRevision', 'unreleasedRecord', 'rejectedRecord']) {
    assert.ok(String(controls[key]).length > 20, `${key} control must be stated`)
  }
})
