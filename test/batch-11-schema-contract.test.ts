import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import test from 'node:test'

import { REQUIRED_MIGRATIONS } from '../lib/batch-11-rehearsal-phases.ts'
import {
  buildEpistemicIngestionBatch,
  ingestionBatchSnapshot,
  parseEpistemicIngestionRequest,
} from '../lib/epistemic-ingestion.ts'
import { epistemicOperationsHash } from '../lib/epistemic-review.ts'

/**
 * Does the bootstrap schema actually accept the insert the route performs?
 *
 * Run 33486570315 refused with a 503 whose cause could not be read from
 * outside, and the leading theory was that the six-migration allowlist built a
 * schema the current persistence contract had outgrown. Reading migrations
 * could not settle that - only executing them can, because the question is
 * whether a specific RPC accepts a specific payload.
 *
 * So this replays the exact allowlist into a disposable cluster and calls the
 * real RPC with the payload the route builds. It is the regression that would
 * have answered the question before a protected run was spent on it.
 */

const ROOT = resolve(import.meta.dirname, '..')
const PG_BIN = ['/opt/homebrew/opt/postgresql@17/bin', '/usr/lib/postgresql/17/bin', '/usr/local/opt/postgresql@17/bin']
  .find((dir) => existsSync(join(dir, 'initdb')))

/** The payload the route hands to the RPC, built by the route's own code. */
function realInsertArguments() {
  const parsed = parseEpistemicIngestionRequest({
    adapterId: 'batch-11-mixed-lineage-rehearsal',
    idempotencyKey: 'batch-11-schema-contract-probe',
  })
  const batch = buildEpistemicIngestionBatch(parsed)
  return {
    snapshot: ingestionBatchSnapshot(batch),
    records: batch.records,
    idempotency: epistemicOperationsHash('batch-11-schema-contract-probe'),
    actor: epistemicOperationsHash('schema-contract-actor-fingerprint'),
  }
}

test('the ingestion payload the route builds matches what the RPC demands', () => {
  // Runs everywhere, including without a database: the RPC validates these
  // exact literals and raises 22023 on any disagreement.
  const { snapshot, records } = realInsertArguments()
  const sql = readFileSync(resolve(ROOT, 'supabase/migrations/20260831123000_batch_11_mixed_lineage_rehearsal_execution.sql'), 'utf8')

  assert.equal(snapshot.adapterId, 'batch-11-mixed-lineage-rehearsal')
  assert.equal(String(snapshot.recordCount), '5')
  assert.equal(records.length, 5)
  for (const [field, value] of [
    ['schemaVersion', snapshot.schemaVersion],
    ['adapterVersion', snapshot.adapterVersion],
    ['sourceDatasetVersion', snapshot.sourceDatasetVersion],
  ] as const) {
    assert.ok(sql.includes(`'${value}'`), `the RPC does not accept ${field} ${JSON.stringify(value)}`)
  }
  // Every record the payload carries must be in the RPC's hard-coded allowlist.
  for (const record of records) {
    assert.ok(sql.includes(`'${record.candidateRecordId}'`), `${record.candidateRecordId} is not allowed by the RPC`)
    assert.ok(sql.includes(`'${record.reviewTargetSha256}'`), `${record.candidateRecordId}: target digest is not the allowed one`)
  }
})

test('the six-migration allowlist builds a schema that accepts the real insert', { skip: PG_BIN ? false : 'no local PostgreSQL 17' }, () => {
  const dir = mkdtempSync(join(tmpdir(), 'b11-schema-'))
  const data = join(dir, 'data')
  const port = String(50000 + Math.floor(Math.random() * 10000))
  const pg = (name: string) => join(PG_BIN!, name)
  const env = { ...process.env, LC_ALL: 'C', LANG: 'C', PGHOST: dir, PGPORT: port, PGUSER: 'postgres' }
  const psql = (args: string[], input?: string) =>
    execFileSync(pg('psql'), ['-v', 'ON_ERROR_STOP=1', '-q', '-At', ...args], { env, input, encoding: 'utf8' })

  try {
    execFileSync(pg('initdb'), ['-D', data, '-U', 'postgres', '--auth=trust', '--locale=C'], { env, stdio: 'ignore' })
    execFileSync(pg('pg_ctl'), ['-D', data, '-o', `-p ${port} -k ${dir} -c listen_addresses=''`, '-l', join(dir, 'log'), '-w', 'start'],
      { env, stdio: 'ignore' })

    // UTF8 on purpose: the corpus carries en dashes, and an SQL_ASCII database
    // rejects them in a way the real database never would.
    psql(['-d', 'postgres', '-c', "create database b11 encoding 'UTF8' template template0 lc_collate 'C' lc_ctype 'C';"])
    psql(['-d', 'b11'], `
      create schema if not exists extensions;
      do $$ begin
        if not exists (select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;
        if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
        if not exists (select 1 from pg_roles where rolname='service_role') then create role service_role nologin bypassrls; end if;
      end $$;
      create extension if not exists pgcrypto with schema extensions;`)

    // The allowlist itself, in its declared order - not a hand-copied list.
    for (const migration of REQUIRED_MIGRATIONS) {
      psql(['-d', 'b11', '--single-transaction', '-f', resolve(ROOT, 'supabase/migrations', migration)])
    }

    const { snapshot, records, idempotency, actor } = realInsertArguments()
    const call = join(dir, 'call.sql')
    writeFileSync(call, `set role service_role;
select public.record_batch_11_rehearsal_targets(
  $j$${JSON.stringify(snapshot)}$j$::jsonb,
  $j$${JSON.stringify(records)}$j$::jsonb,
  '${idempotency}', '${actor}');`)

    const first = JSON.parse(psql(['-d', 'b11', '-f', call]).trim().split('\n').pop()!)
    assert.equal(first.recordCount, 5, 'the bootstrap schema did not accept five records')
    assert.equal(first.idempotentReplay, false)
    assert.match(String(first.batchId), /^epibatch_[a-f0-9]{32}$/)

    // Replay protection is part of the same contract.
    const second = JSON.parse(psql(['-d', 'b11', '-f', call]).trim().split('\n').pop()!)
    assert.equal(second.idempotentReplay, true, 'a duplicate insert must be refused as a replay')
    assert.equal(second.batchId, first.batchId)

    assert.equal(psql(['-d', 'b11', '-c', 'select count(*) from public.epistemic_ingestion_records;']).trim(), '5')
  } finally {
    spawnSync(pg('pg_ctl'), ['-D', data, '-m', 'immediate', 'stop'], { env, stdio: 'ignore' })
    rmSync(dir, { recursive: true, force: true })
  }
})
