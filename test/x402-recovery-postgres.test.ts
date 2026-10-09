import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import test from 'node:test'

const ROOT = resolve(import.meta.dirname, '..')
const PG_BIN = ['/opt/homebrew/opt/postgresql@17/bin', '/usr/lib/postgresql/17/bin', '/usr/local/opt/postgresql@17/bin'].find((path) => existsSync(join(path, 'initdb')))

test('recovery migration enforces purchase/authorization binding, durable outcomes and private health in real PostgreSQL', { skip: PG_BIN ? false : 'no local PostgreSQL 17' }, (context) => {
  const directory = mkdtempSync(join(tmpdir(), 'x402-recovery-'))
  const data = join(directory, 'data')
  const pg = (name: string) => join(PG_BIN!, name)
  const environment = { ...process.env, LC_ALL: 'C', LANG: 'C', PGHOST: directory, PGPORT: String(50_000 + Math.floor(Math.random() * 10_000)), PGUSER: 'postgres' }
  const sql = (input: string) => execFileSync(pg('psql'), ['-v', 'ON_ERROR_STOP=1', '-q', '-At', '-d', 'postgres'], { env: environment, input, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim()
  let started = false
  try {
    try {
      execFileSync(pg('initdb'), ['-D', data, '-U', 'postgres', '--auth=trust', '--locale=C'], { env: environment, stdio: ['ignore', 'pipe', 'pipe'] })
    } catch (error) {
      if (String((error as { stderr?: Buffer }).stderr ?? error).includes('could not create shared memory segment')) {
        context.skip('host shared-memory capacity exhausted; run the isolated WASM test or retry on a healthy PostgreSQL host')
        return
      }
      throw error
    }
    execFileSync(pg('pg_ctl'), ['-D', data, '-o', `-p ${environment.PGPORT} -k ${directory} -c listen_addresses=''`, '-l', join(directory, 'log'), '-w', 'start'], { env: environment, stdio: 'ignore' })
    started = true
    sql('create schema extensions; create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;')
    for (const migration of ['20260810000500_x402_offer_admissions.sql', '20261003090000_x402_admission_recovery.sql']) {
      execFileSync(pg('psql'), ['-v', 'ON_ERROR_STOP=1', '-q', '-d', 'postgres', '--single-transaction', '-f', resolve(ROOT, 'supabase/migrations', migration)], { env: environment, stdio: ['ignore', 'pipe', 'pipe'] })
    }
    const binding = `'synthetic-offer','0xSynthetic','request_0001','sha256:${'a'.repeat(64)}','https://synthetic.invalid/api',1000`
    const reserve = () => sql(`set role service_role; select decision from reserve_x402_admission(${binding});`)
    const record = (state: string, id = 'b'.repeat(64), tx: string | null = null) => sql(`set role service_role; select record_x402_admission_recovery(${binding},'${id}','eip155:8453','${state}',${tx ? `'${tx}'` : 'null'});`)
    assert.equal(reserve(), 'proceed')
    record('pending')
    assert.equal(reserve(), 'in_progress')
    assert.throws(() => record('pending', 'c'.repeat(64)))
    assert.throws(() => record('settled', 'c'.repeat(64), 'tx_wrong'))
    record('unknown')
    assert.equal(sql(`set role service_role; select count from x402_admission_recovery_health() where state='unknown';`), '1')
    assert.equal(reserve(), 'in_progress')
    record('settled', 'b'.repeat(64), 'tx_original')
    // Main admission is deliberately still reserved: journal recovery must work independently.
    assert.equal(sql(`set role service_role; select state || ':' || transaction from read_x402_admission_recovery(${binding});`), 'settled:tx_original')
    assert.equal(sql(`set role service_role; select count(*) from read_x402_admission_recovery('synthetic-offer','0xSynthetic','request_0001','sha256:${'d'.repeat(64)}','https://synthetic.invalid/api',1000);`), '0')
    assert.throws(() => record('settled', 'b'.repeat(64), 'tx_replacement'))
    assert.throws(() => record('not_settled'))
    record('marker_failed', 'b'.repeat(64), 'tx_original')
    assert.equal(sql(`set role service_role; select count from x402_admission_recovery_health() where state='marker_failed';`), '1')
    record('contradicted', 'b'.repeat(64), 'tx_original')
    assert.throws(() => record('settled', 'b'.repeat(64), 'tx_original'))
    assert.equal(sql(`select has_table_privilege('anon','public.x402_admission_recovery','select');`), 'f')
    assert.equal(sql(`select has_function_privilege('anon','public.x402_admission_recovery_health()','execute');`), 'f')
    assert.equal(sql(`select has_function_privilege('service_role','public.x402_admission_recovery_health()','execute');`), 't')
    assert.equal(sql(`select count(*) from information_schema.columns where table_name='x402_admission_recovery' and column_name ~ '(signature|payload|content|email|excerpt)';`), '0')
    // A proven non-payment may be retried with a different authorization.
    const other = binding.replace('request_0001', 'request_0002')
    sql(`select reserve_x402_admission(${other}); select record_x402_admission_recovery(${other},'${'e'.repeat(64)}','eip155:8453','pending'); select record_x402_admission_recovery(${other},'${'e'.repeat(64)}','eip155:8453','not_settled'); select release_x402_admission('synthetic-offer','0xSynthetic','request_0002');`)
    assert.equal(sql(`select decision from reserve_x402_admission(${other});`), 'proceed')
    sql(`select record_x402_admission_recovery(${other},'${'f'.repeat(64)}','eip155:8453','pending');`)
    assert.equal(sql(`select state from read_x402_admission_recovery(${other});`), 'pending')
  } finally {
    if (started) spawnSync(pg('pg_ctl'), ['-D', data, '-m', 'immediate', 'stop'], { env: environment, stdio: 'ignore' })
    rmSync(directory, { recursive: true, force: true })
  }
})
