import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import test from 'node:test'

import canary from '../content/batch-12b/mixed-revision-canary.json' with { type: 'json' }
import { REQUIRED_MIGRATIONS } from '../lib/batch-11-rehearsal-phases.ts'
import { adoptionOrder, evaluateAdoption, type AdoptionCandidate } from '../lib/mixed-revision-adoption.ts'
import { loadPool, makeClient } from './helpers/postgres-supabase-shim.ts'

/**
 * The canary that is not a source-override canary.
 *
 * Only one Batch 12A proposal replaces its source, and five are needed. Rather
 * than relabel the cohort, this is a mixed one: one source replacement, three
 * locator corrections and one downward scope narrowing. Naming it accurately is
 * the point - the evidence is what it is, and a name that oversold it would be
 * the first thing a reader trusted.
 */

const ROOT = resolve(import.meta.dirname, '..')
const PG_BIN = ['/opt/homebrew/opt/postgresql@17/bin', '/usr/lib/postgresql/17/bin', '/usr/local/opt/postgresql@17/bin']
  .find((dir) => existsSync(join(dir, 'initdb')))
const skip = PG_BIN ? false : 'no local PostgreSQL 17'

const cohort = canary.canary as AdoptionCandidate[]
const ids = new Set(cohort.map((entry) => entry.recordId))

/* --- composition ---------------------------------------------------------- */

test('the canary is named for what it is, and composed as required', () => {
  assert.equal(canary.canaryKind, 'mixed-revision-adoption')
  assert.notEqual(canary.canaryKind, 'source-override')
  assert.match(String(canary.whyNotSourceOverride), /only one .* replaces its source|five are required/i)
  assert.equal(cohort.length, 5)
  const kinds = cohort.map((entry) => entry.kind)
  assert.equal(kinds.filter((kind) => kind === 'source-replacement').length, 1)
  assert.ok(kinds.filter((kind) => kind === 'locator-correction').length >= 2)
  assert.ok(kinds.filter((kind) => kind === 'claim-scope-narrowing').length >= 1)
})

test('the unsupported record and every inaccessible control are excluded', () => {
  assert.ok(!ids.has('urn:maha:record:biomolecular-engineering-fitness-landscape-analysis'),
    'the inspected-but-unsupported record must not be adopted')
  for (const excluded of canary.excluded as { recordId: string }[]) {
    assert.ok(!ids.has(excluded.recordId), `${excluded.recordId} is excluded yet present`)
  }
  assert.equal((canary.excluded as unknown[]).length, 9, 'one unsupported plus eight inaccessible')
})

/* --- admission refuses what it should ------------------------------------- */

const base = (): AdoptionCandidate => ({ ...cohort[0] })

test('every canary candidate is admissible, and none is active', () => {
  for (const candidate of cohort) {
    const verdict = evaluateAdoption(candidate, ids)
    assert.equal(verdict.admissible, true, `${candidate.recordId}: ${verdict.refusals.join(', ')}`)
    assert.equal(verdict.active, false, 'admissible must never mean live')
  }
})

test('a review bundle naming the predecessor is refused', () => {
  // The exact shape of inheriting a decision, and the easiest to do by accident.
  const inherited = { ...base(), reviewBundleRevisionSha256: base().activeRevisionSha256 }
  const verdict = evaluateAdoption(inherited, ids)
  assert.equal(verdict.admissible, false)
  assert.ok(verdict.refusals.includes('review-bundle-names-a-different-revision'))
})

test('an incomplete bundle, an unbound audit and a no-op revision are refused', () => {
  assert.ok(evaluateAdoption({ ...base(), decidedAxes: base().decidedAxes.slice(0, 4) }, ids)
    .refusals.includes('incomplete-review-bundle'))
  assert.ok(evaluateAdoption({ ...base(), proposedAuditSha256: base().activeRevisionSha256 }, ids)
    .refusals.includes('audit-not-bound-to-proposed-revision'))
  assert.ok(evaluateAdoption({ ...base(), proposedRevisionSha256: base().activeRevisionSha256 }, ids)
    .refusals.includes('proposed-equals-active'))
})

test('a substituted record identity is refused', () => {
  const substituted = { ...base(), recordId: 'urn:maha:record:not-in-this-cohort' }
  assert.ok(evaluateAdoption(substituted, ids).refusals.includes('record-identity-substituted'))
})

test('release classification is read from release state, not from the proposal', () => {
  assert.equal(evaluateAdoption({ ...base(), hasActivePredecessorRelease: true }, ids).releaseClassification, 'superseding')
  assert.equal(evaluateAdoption({ ...base(), hasActivePredecessorRelease: false }, ids).releaseClassification, 'initial')
})

test('adoption order is deterministic', () => {
  const first = adoptionOrder(cohort)
  const shuffled = [...cohort].reverse()
  assert.deepEqual(adoptionOrder(shuffled), first, 'order must not depend on input order')
  assert.deepEqual(adoptionOrder(cohort), first)
})

/* --- against a real database ---------------------------------------------- */

test('proposed revisions ingest without any becoming active', { skip }, async (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'mixed-'))
  const data = join(dir, 'data')
  const port = String(50000 + Math.floor(Math.random() * 10000))
  const pg = (name: string) => join(PG_BIN!, name)
  const env = { ...process.env, LC_ALL: 'C', LANG: 'C', PGHOST: '127.0.0.1', PGPORT: port, PGUSER: 'postgres' }
  const psql = (args: string[], input?: string) =>
    execFileSync(pg('psql'), ['-v', 'ON_ERROR_STOP=1', '-q', '-At', ...args], { env, input, encoding: 'utf8' })

  execFileSync(pg('initdb'), ['-D', data, '-U', 'postgres', '--auth=trust', '--locale=C'], { env, stdio: 'ignore' })
  execFileSync(pg('pg_ctl'), ['-D', data, '-o', `-p ${port} -k ${dir} -c listen_addresses='127.0.0.1'`, '-l', join(dir, 'log'), '-w', 'start'], { env, stdio: 'ignore' })
  try {
    psql(['-d', 'postgres', '-c', "create database mixed encoding 'UTF8' template template0 lc_collate 'C' lc_ctype 'C';"])
    psql(['-d', 'mixed'], `
      create schema if not exists extensions;
      do $$ begin
        if not exists (select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;
        if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
        if not exists (select 1 from pg_roles where rolname='service_role') then create role service_role nologin bypassrls; end if;
      end $$;
      create extension if not exists pgcrypto with schema extensions;`)
    for (const migration of REQUIRED_MIGRATIONS) {
      psql(['-d', 'mixed', '--single-transaction', '-f', resolve(ROOT, 'supabase/migrations', migration)])
    }
    const pool = await loadPool(`postgres://postgres@127.0.0.1:${port}/mixed`)
    if (!pool) return t.skip('pg module not installed')
    const client = makeClient(pool)
    const raw = client as unknown as { raw(sql: string, values?: unknown[]): Promise<{ rows: Record<string, unknown>[] }>; end(): Promise<void> }

    try {
      // A proposed revision is held in its own table, never in the release ledger.
      await raw.raw(`create table proposed_revisions (
        record_id text primary key, active_revision text not null, proposed_revision text not null,
        review_bundle_revision text not null, active boolean not null default false,
        constraint proposal_must_differ_from_active check (proposed_revision <> active_revision),
        constraint proposal_may_never_be_active check (active = false))`)
      for (const candidate of cohort) {
        await raw.raw('insert into proposed_revisions (record_id, active_revision, proposed_revision, review_bundle_revision) values ($1,$2,$3,$4)',
          [candidate.recordId, candidate.activeRevisionSha256, candidate.proposedRevisionSha256, candidate.reviewBundleRevisionSha256])
      }
      const ingested = await raw.raw('select count(*)::int as n from proposed_revisions')
      assert.equal(ingested.rows[0].n, 5, 'all five proposed revisions ingest')

      const active = await raw.raw('select count(*)::int as n from proposed_revisions where active')
      assert.equal(active.rows[0].n, 0, 'none may be active')

      // Nothing reached the release ledger.
      const released = await raw.raw('select count(*)::int as n from public.epistemic_canonical_releases')
      assert.equal(released.rows[0].n, 0, 'a proposal must not create a release')

      // A proposal equal to its predecessor is refused by the database itself.
      await assert.rejects(() => raw.raw(
        'insert into proposed_revisions (record_id, active_revision, proposed_revision, review_bundle_revision) values ($1,$2,$2,$2)',
        ['urn:maha:record:noop', cohort[0].activeRevisionSha256]), /proposal_must_differ_from_active/)

      // Activation is refused: it is a separate authority, not a column update.
      await assert.rejects(() => raw.raw('update proposed_revisions set active = true'), /proposal_may_never_be_active/)

      // Predecessor digests are untouched by any of this.
      const preserved = await raw.raw('select record_id, active_revision from proposed_revisions order by record_id')
      for (const row of preserved.rows) {
        const original = cohort.find((entry) => entry.recordId === row.record_id)!
        assert.equal(row.active_revision, original.activeRevisionSha256, 'a predecessor revision was mutated')
      }
    } finally {
      await raw.end()
    }
  } finally {
    // Rollback is discarding the database, not editing history.
    spawnSync(pg('pg_ctl'), ['-D', data, '-m', 'immediate', 'stop'], { env, stdio: 'ignore' })
    rmSync(dir, { recursive: true, force: true })
    assert.equal(existsSync(dir), false, 'the disposable database is discarded, not retained')
  }
})

test('the canary does not touch the global scope repair', () => {
  const serialized = JSON.stringify(canary)
  assert.ok(!/scope-join|scopeJoin|malformed/i.test(serialized),
    'the mixed-revision canary must not reference the 238-record formatting migration')
})
