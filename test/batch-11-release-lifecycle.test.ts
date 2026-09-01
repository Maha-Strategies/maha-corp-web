import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import test from 'node:test'

import { REQUIRED_MIGRATIONS } from '../lib/batch-11-rehearsal-phases.ts'
import { BATCH_11_LINEAGE_DECLARATIONS } from '../lib/batch-11-mixed-lineage-release.ts'
import { BATCH_11_REVISION_AUDITS, batch11RevisionReviewInputs } from '../lib/batch-11-revision-canary.ts'
import { buildEpistemicIngestionBatch, parseEpistemicIngestionRequest } from '../lib/epistemic-ingestion.ts'
import { insertEpistemicIngestionBatch } from '../lib/epistemic-ingestion-store.ts'
import { buildEpistemicExpertReview, epistemicOperationsHash } from '../lib/epistemic-review.ts'
import { parseEpistemicReleaseRequest } from '../lib/epistemic-release.ts'
import { executeEpistemicCanonicalRelease } from '../lib/epistemic-release-execution.ts'
import { insertEpistemicExpertReview } from '../lib/epistemic-store.ts'
import { loadPool, makeClient } from './helpers/postgres-supabase-shim.ts'

/**
 * The whole release path, against the real schema.
 *
 * Run 33498939287 reached the release phase and answered 503 with a code the
 * route does not classify. Nothing readable came back, and four earlier runs
 * had already been spent on failures that a local reconstruction would have
 * caught in minutes.
 *
 * So this rebuilds every prerequisite the Preview route supplies - five exact
 * ingestion records through the real RPC, twenty scoped review decisions, two
 * predecessor lineage witnesses - and then issues all five releases through the
 * real executor. No simplified fixture: a fixture that omitted a prerequisite
 * would have hidden the defect, which was inside a check that only runs once
 * every prerequisite is present.
 *
 * The defect was operator precedence. `-` binds tighter than `->`, so
 *   record_snapshot->'candidateSnapshot' - 'publication'
 * parses as record_snapshot -> ('candidateSnapshot' - 'publication'), which is
 * `unknown - unknown` and raises SQLSTATE 42725 before the comparison happens.
 * The check is the one proving released content equals the frozen target: it
 * was not weak, it was unreachable.
 */

const ROOT = resolve(import.meta.dirname, '..')
const PG_BIN = ['/opt/homebrew/opt/postgresql@17/bin', '/usr/lib/postgresql/17/bin', '/usr/local/opt/postgresql@17/bin']
  .find((dir) => existsSync(join(dir, 'initdb')))

const EXECUTION_MIGRATION = 'supabase/migrations/20260831123000_batch_11_mixed_lineage_rehearsal_execution.sql'
const ACTOR = epistemicOperationsHash('release-lifecycle-actor-material')

/** Brings up a disposable cluster carrying the exact migration allowlist. */
function cluster(mutateExecutionSql?: (sql: string) => string) {
  const dir = mkdtempSync(join(tmpdir(), 'b11-rel-'))
  const data = join(dir, 'data')
  const port = String(50000 + Math.floor(Math.random() * 10000))
  const pg = (name: string) => join(PG_BIN!, name)
  const env = { ...process.env, LC_ALL: 'C', LANG: 'C', PGHOST: '127.0.0.1', PGPORT: port, PGUSER: 'postgres' }
  const psql = (args: string[], input?: string) =>
    execFileSync(pg('psql'), ['-v', 'ON_ERROR_STOP=1', '-q', '-At', ...args], { env, input, encoding: 'utf8' })

  execFileSync(pg('initdb'), ['-D', data, '-U', 'postgres', '--auth=trust', '--locale=C'], { env, stdio: 'ignore' })
  execFileSync(pg('pg_ctl'), ['-D', data, '-o', `-p ${port} -k ${dir} -c listen_addresses='127.0.0.1'`, '-l', join(dir, 'log'), '-w', 'start'],
    { env, stdio: 'ignore' })
  psql(['-d', 'postgres', '-c', "create database b11 encoding 'UTF8' template template0 lc_collate 'C' lc_ctype 'C';"])
  psql(['-d', 'b11'], `
    create schema if not exists extensions;
    do $$ begin
      if not exists (select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;
      if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
      if not exists (select 1 from pg_roles where rolname='service_role') then create role service_role nologin bypassrls; end if;
    end $$;
    create extension if not exists pgcrypto with schema extensions;`)

  for (const migration of REQUIRED_MIGRATIONS) {
    const path = resolve(ROOT, 'supabase/migrations', migration)
    if (mutateExecutionSql && path.endsWith('20260831123000_batch_11_mixed_lineage_rehearsal_execution.sql')) {
      psql(['-d', 'b11', '--single-transaction'], mutateExecutionSql(readFileSync(path, 'utf8')))
    } else {
      psql(['-d', 'b11', '--single-transaction', '-f', path])
    }
  }
  return {
    connectionString: `postgres://postgres@127.0.0.1:${port}/b11`,
    psql,
    stop() {
      spawnSync(pg('pg_ctl'), ['-D', data, '-m', 'immediate', 'stop'], { env, stdio: 'ignore' })
      rmSync(dir, { recursive: true, force: true })
    },
  }
}

/** Everything the Preview route relies on existing before a release is issued. */
async function seedPrerequisites(client: never, raw: { raw(sql: string, values?: unknown[]): Promise<unknown> }) {
  const parsed = parseEpistemicIngestionRequest({ adapterId: 'batch-11-mixed-lineage-rehearsal', idempotencyKey: 'lifecycle' })
  await insertEpistemicIngestionBatch(client, buildEpistemicIngestionBatch(parsed), 'lifecycle', ACTOR)
  for (const input of batch11RevisionReviewInputs()) {
    await insertEpistemicExpertReview(client, buildEpistemicExpertReview(input), `${input.recordId}:${input.scope}`, ACTOR)
  }
  for (const declaration of BATCH_11_LINEAGE_DECLARATIONS.filter((entry) => entry.declaredReleaseKind === 'superseding')) {
    await raw.raw(
      'insert into public.batch_11_rehearsal_imported_lineage (record_id, prior_release_id, prior_target_sha256) values ($1,$2,$3) on conflict do nothing',
      [declaration.recordId, declaration.declaredPriorReleaseId, declaration.declaredPriorTargetSha256],
    )
  }
}

/** The exact body the Preview runner posts, parsed by the route's own parser. */
function releaseBody(declaration: typeof BATCH_11_LINEAGE_DECLARATIONS[number], idempotencyKey: string) {
  const audit = BATCH_11_REVISION_AUDITS.find((entry) => entry.recordId === declaration.recordId)!
  const superseding = declaration.declaredReleaseKind === 'superseding'
  return {
    operation: 'publish',
    recordId: declaration.recordId,
    targetSha256: audit.revisedRecordRevisionSha256,
    canonicalVersion: superseding ? 'batch-11-preview-1.1.0' : 'batch-11-preview-1.0.0',
    supersedesReleaseId: declaration.declaredPriorReleaseId,
    authority: {
      authorityId: 'authority_batch-11-preview',
      displayName: 'Maha Batch 11 Preview Release Authority',
      role: 'Internal Preview-only canonical release authority',
      authorizationBasis: 'The owner authorized this exact five-record isolated Preview rehearsal after inspected-source alignment, exact-revision internal review, lineage reconciliation and projection-safety checks passed. Production release is not authorized.',
      publicAttribution: false,
    },
    publicChangeSummary: superseding
      ? 'Preview-only superseding release binds the inspected Batch 11 source replacement and exact revised record.'
      : 'Preview-only initial release binds the inspected Batch 11 source replacement and exact revised record.',
    rationale: 'The exact revision has an inspected subject-matched source, exact locator, eight-dimension audit and four scoped internal-editorial approvals. External endorsement, independent reproduction, scientific validation and Production publication are not claimed.',
    idempotencyKey,
  }
}

const issue = (client: never, declaration: typeof BATCH_11_LINEAGE_DECLARATIONS[number], key: string) =>
  executeEpistemicCanonicalRelease(client, parseEpistemicReleaseRequest(releaseBody(declaration, key)) as never, ACTOR)

const skip = PG_BIN ? false : 'no local PostgreSQL 17'

test('the five-release lifecycle completes: three initial and two superseding', { skip }, async (t) => {
  const db = cluster()
  const pool = await loadPool(db.connectionString)
  if (!pool) { db.stop(); return t.skip('pg module not installed') }
  const client = makeClient(pool) as never
  const raw = client as unknown as { raw(sql: string, values?: unknown[]): Promise<unknown>; end(): Promise<void> }
  process.env.EPISTEMIC_EXTERNAL_LINEAGE_REHEARSAL = 'batch-11-preview'

  try {
    await seedPrerequisites(client, raw)
    const kinds: string[] = []
    for (const declaration of BATCH_11_LINEAGE_DECLARATIONS) {
      const outcome = await issue(client, declaration, `lifecycle-${declaration.recordId}`)
      assert.equal(outcome.persisted, true, `${declaration.recordId} did not persist`)
      assert.equal(outcome.release.releaseKind, declaration.declaredReleaseKind)
      kinds.push(outcome.release.releaseKind)
    }
    assert.equal(kinds.filter((kind) => kind === 'initial').length, 3)
    assert.equal(kinds.filter((kind) => kind === 'superseding').length, 2)

    const persisted = await raw.raw('select release_kind, count(*)::int as n from public.epistemic_canonical_releases group by 1 order by 1') as { rows: { release_kind: string; n: number }[] }
    assert.deepEqual(persisted.rows, [{ release_kind: 'initial', n: 3 }, { release_kind: 'superseding', n: 2 }])
  } finally {
    await raw.end()
    db.stop()
  }
})

test('before the correction, every release fails with SQLSTATE 42725', { skip }, async (t) => {
  // The original SQL, restored exactly: `->` without parentheses. Postgres
  // reads it as unknown - unknown and raises ambiguous_function, which the
  // route cannot classify and reports as 503.
  const db = cluster((sql) => sql.replace(
    "if (v_target.record_snapshot->'candidateSnapshot') - 'publication' <> (p_release->'recordSnapshot') - 'publication'",
    "if v_target.record_snapshot->'candidateSnapshot' - 'publication' <> p_release->'recordSnapshot' - 'publication'",
  ))
  const pool = await loadPool(db.connectionString)
  if (!pool) { db.stop(); return t.skip('pg module not installed') }
  const client = makeClient(pool) as never
  const raw = client as unknown as { raw(sql: string, values?: unknown[]): Promise<unknown>; end(): Promise<void> }
  process.env.EPISTEMIC_EXTERNAL_LINEAGE_REHEARSAL = 'batch-11-preview'

  try {
    await seedPrerequisites(client, raw)
    for (const declaration of BATCH_11_LINEAGE_DECLARATIONS) {
      await assert.rejects(
        () => issue(client, declaration, `regression-${declaration.recordId}`),
        /failed \[42725\]/,
        `${declaration.recordId} must fail on the original SQL`,
      )
    }
    const persisted = await raw.raw('select count(*)::int as n from public.epistemic_canonical_releases') as { rows: { n: number }[] }
    assert.equal(persisted.rows[0].n, 0, 'no release may persist while the check is unreachable')
  } finally {
    await raw.end()
    db.stop()
  }
})

test('the corrected comparison is present, and the Production RPC was already correct', () => {
  const execution = readFileSync(resolve(ROOT, EXECUTION_MIGRATION), 'utf8')
  assert.match(execution, /if \(v_target\.record_snapshot->'candidateSnapshot'\) - 'publication' <> \(p_release->'recordSnapshot'\) - 'publication'/)
  assert.ok(!/[^)]record_snapshot->'candidateSnapshot' - 'publication'/.test(execution))

  // The Production release RPC subtracts from a typed jsonb variable, so the
  // literal coerces and there was never an ambiguity there to fix.
  const control = readFileSync(resolve(ROOT, 'supabase/migrations/20260824190000_epistemic_canonical_release_control.sql'), 'utf8')
  assert.match(control, /if v_target_record - 'publication' <> \(p_release->'recordSnapshot'\) - 'publication'/)
})

/* --- the gates the correction must not have weakened ---------------------- */

test('the release gates still refuse everything they refused before', { skip }, async (t) => {
  const db = cluster()
  const pool = await loadPool(db.connectionString)
  if (!pool) { db.stop(); return t.skip('pg module not installed') }
  const client = makeClient(pool) as never
  const raw = client as unknown as { raw(sql: string, values?: unknown[]): Promise<unknown>; end(): Promise<void> }
  process.env.EPISTEMIC_EXTERNAL_LINEAGE_REHEARSAL = 'batch-11-preview'

  const initial = BATCH_11_LINEAGE_DECLARATIONS.find((entry) => entry.declaredReleaseKind === 'initial')!
  const superseding = BATCH_11_LINEAGE_DECLARATIONS.find((entry) => entry.declaredReleaseKind === 'superseding')!

  try {
    await seedPrerequisites(client, raw)

    await t.test('an initial release cannot claim a predecessor', async () => {
      const body = { ...releaseBody(initial, 'gate-initial-supersedes'), supersedesReleaseId: superseding.declaredPriorReleaseId }
      await assert.rejects(() => executeEpistemicCanonicalRelease(client, parseEpistemicReleaseRequest(body) as never, ACTOR))
    })

    await t.test('a tampered revision digest is not the frozen target', async () => {
      const body = { ...releaseBody(initial, 'gate-bad-target'), targetSha256: `sha256:${'0'.repeat(64)}` }
      await assert.rejects(
        () => executeEpistemicCanonicalRelease(client, parseEpistemicReleaseRequest(body) as never, ACTOR),
        /frozen release target was not found/,
      )
    })

    await t.test('a superseding release requires its exact predecessor witness', async () => {
      await raw.raw('delete from public.batch_11_rehearsal_imported_lineage where record_id = $1', [superseding.recordId])
      await assert.rejects(() => executeEpistemicCanonicalRelease(
        client, parseEpistemicReleaseRequest(releaseBody(superseding, 'gate-no-witness')) as never, ACTOR))
      // Restored, so the remaining subtests see the seeded state.
      await raw.raw(
        'insert into public.batch_11_rehearsal_imported_lineage (record_id, prior_release_id, prior_target_sha256) values ($1,$2,$3)',
        [superseding.recordId, superseding.declaredPriorReleaseId, superseding.declaredPriorTargetSha256],
      )
    })

    await t.test('a stale predecessor digest cannot even be written', async () => {
      // Stronger than a release-time refusal: the witness table's allowlist
      // constraint pins the exact record/release/digest triples, so a stale
      // lineage row is rejected by the database before any release sees it.
      await assert.rejects(
        () => raw.raw('update public.batch_11_rehearsal_imported_lineage set prior_target_sha256 = $2 where record_id = $1',
          [superseding.recordId, `sha256:${'1'.repeat(64)}`]),
        /batch_11_rehearsal_imported_lineage_allowlist_check/,
      )
      // And a witness for a record outside the declared lineage is refused too.
      await assert.rejects(
        () => raw.raw('insert into public.batch_11_rehearsal_imported_lineage (record_id, prior_release_id, prior_target_sha256) values ($1,$2,$3)',
          [initial.recordId, superseding.declaredPriorReleaseId, superseding.declaredPriorTargetSha256]),
        /batch_11_rehearsal_imported_lineage_allowlist_check/,
      )
    })

    await t.test('the review ledger is append-only, so approvals cannot be removed', async () => {
      await assert.rejects(
        () => raw.raw('delete from public.epistemic_expert_review_decisions where candidate_record_id = $1', [initial.recordId]),
        /append-only/,
      )
    })

    await t.test('nothing partial was persisted by any refusal', async () => {
      const persisted = await raw.raw('select count(*)::int as n from public.epistemic_canonical_releases') as { rows: { n: number }[] }
      assert.equal(persisted.rows[0].n, 0)
    })
  } finally {
    await raw.end()
    db.stop()
  }
})

test('one release per record: a second distinct release refuses', { skip }, async (t) => {
  const db = cluster()
  const pool = await loadPool(db.connectionString)
  if (!pool) { db.stop(); return t.skip('pg module not installed') }
  const client = makeClient(pool) as never
  const raw = client as unknown as { raw(sql: string, values?: unknown[]): Promise<unknown>; end(): Promise<void> }
  process.env.EPISTEMIC_EXTERNAL_LINEAGE_REHEARSAL = 'batch-11-preview'
  const declaration = BATCH_11_LINEAGE_DECLARATIONS.find((entry) => entry.declaredReleaseKind === 'initial')!

  try {
    await seedPrerequisites(client, raw)
    const first = await issue(client, declaration, 'replay-first')
    assert.equal(first.persisted, true)

    // A different idempotency key for a record that already has a release. The
    // rehearsal permits exactly one, and re-issuing must not create a second.
    await assert.rejects(() => issue(client, declaration, 'replay-second'))
    const persisted = await raw.raw('select count(*)::int as n from public.epistemic_canonical_releases') as { rows: { n: number }[] }
    assert.equal(persisted.rows[0].n, 1, 'exactly one release per record')
  } finally {
    await raw.end()
    db.stop()
  }
})

test('three scoped decisions are not enough to release', { skip }, async (t) => {
  // Seeded short rather than pruned: the review ledger is append-only, so the
  // only way a record can have three approvals is to have been given three.
  const db = cluster()
  const pool = await loadPool(db.connectionString)
  if (!pool) { db.stop(); return t.skip('pg module not installed') }
  const client = makeClient(pool) as never
  const raw = client as unknown as { raw(sql: string, values?: unknown[]): Promise<unknown>; end(): Promise<void> }
  process.env.EPISTEMIC_EXTERNAL_LINEAGE_REHEARSAL = 'batch-11-preview'
  const shortRecord = BATCH_11_LINEAGE_DECLARATIONS[2]

  try {
    const parsed = parseEpistemicIngestionRequest({ adapterId: 'batch-11-mixed-lineage-rehearsal', idempotencyKey: 'three-scopes' })
    await insertEpistemicIngestionBatch(client, buildEpistemicIngestionBatch(parsed), 'three-scopes', ACTOR)

    let skipped = false
    for (const input of batch11RevisionReviewInputs()) {
      if (input.recordId === shortRecord.recordId && !skipped) { skipped = true; continue }
      await insertEpistemicExpertReview(client, buildEpistemicExpertReview(input), `${input.recordId}:${input.scope}`, ACTOR)
    }
    const counted = await raw.raw('select count(*)::int as n from public.epistemic_expert_review_decisions where candidate_record_id = $1',
      [shortRecord.recordId]) as { rows: { n: number }[] }
    assert.equal(counted.rows[0].n, 3, 'this record must carry exactly three approvals')

    await assert.rejects(() => executeEpistemicCanonicalRelease(
      client, parseEpistemicReleaseRequest(releaseBody(shortRecord, 'three-scopes')) as never, ACTOR))

    // A fully-approved record in the same database still releases, so the
    // refusal is about the missing approval and not about the seeding.
    const complete = BATCH_11_LINEAGE_DECLARATIONS.find((entry) => entry.recordId !== shortRecord.recordId
      && entry.declaredReleaseKind === 'initial')!
    const ok = await executeEpistemicCanonicalRelease(
      client, parseEpistemicReleaseRequest(releaseBody(complete, 'three-scopes-control')) as never, ACTOR)
    assert.equal(ok.persisted, true)
  } finally {
    await raw.end()
    db.stop()
  }
})
