import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
import test from 'node:test'

// Optional, isolated fallback when macOS shared-memory capacity prevents native
// PostgreSQL startup. Does not modify repository dependencies or contact a DB.
test('recovery migration executes in isolated PostgreSQL WASM with real constraints and RPCs', { skip: process.env.X402_TEST_PGLITE_MODULE ? false : 'set X402_TEST_PGLITE_MODULE to an installed PGlite dist/index.js' }, async () => {
  const { PGlite } = await import(pathToFileURL(process.env.X402_TEST_PGLITE_MODULE!).href)
  const db = new PGlite()
  const exec = (sql: string) => db.exec(sql)
  const scalar = async (sql: string) => {
    const result = await db.query(sql)
    return Object.values(result.rows[0] ?? {})[0]
  }
  try {
    await exec('create schema extensions; create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;')
    for (const migration of ['20260810000500_x402_offer_admissions.sql', '20261003090000_x402_admission_recovery.sql']) {
      await exec(await readFile(new URL(`../supabase/migrations/${migration}`, import.meta.url), 'utf8'))
    }
    const binding = `'synthetic-offer','0xSynthetic','request_0001','sha256:${'a'.repeat(64)}','https://synthetic.invalid/api',1000`
    const record = (state: string, id = 'b'.repeat(64), tx: string | null = null) => exec(`select record_x402_admission_recovery(${binding},'${id}','eip155:8453','${state}',${tx ? `'${tx}'` : 'null'});`)
    assert.equal(await scalar(`select decision from reserve_x402_admission(${binding});`), 'proceed')
    await record('pending')
    assert.equal(await scalar(`select decision from reserve_x402_admission(${binding});`), 'in_progress')
    await assert.rejects(() => record('pending', 'c'.repeat(64)))
    await assert.rejects(() => record('settled', 'c'.repeat(64), 'tx_wrong'))
    await record('unknown')
    assert.equal(Number(await scalar(`select count from x402_admission_recovery_health() where state='unknown';`)), 1)
    assert.equal(await scalar(`select decision from reserve_x402_admission(${binding});`), 'in_progress')
    await record('settled', 'b'.repeat(64), 'tx_original')
    assert.equal(await scalar(`select state || ':' || transaction from read_x402_admission_recovery(${binding});`), 'settled:tx_original')
    assert.equal(Number(await scalar(`select count(*) from read_x402_admission_recovery('synthetic-offer','0xSynthetic','request_0001','sha256:${'d'.repeat(64)}','https://synthetic.invalid/api',1000);`)), 0)
    await assert.rejects(() => record('settled', 'b'.repeat(64), 'tx_replacement'))
    await assert.rejects(() => record('not_settled'))
    await record('marker_failed', 'b'.repeat(64), 'tx_original')
    assert.equal(Number(await scalar(`select count from x402_admission_recovery_health() where state='marker_failed';`)), 1)
    await record('contradicted', 'b'.repeat(64), 'tx_original')
    await assert.rejects(() => record('settled', 'b'.repeat(64), 'tx_original'))
    assert.equal(await scalar(`select has_table_privilege('anon','public.x402_admission_recovery','select');`), false)
    assert.equal(await scalar(`select has_function_privilege('anon','public.x402_admission_recovery_health()','execute');`), false)
    assert.equal(await scalar(`select has_function_privilege('service_role','public.x402_admission_recovery_health()','execute');`), true)
    const other = binding.replace('request_0001', 'request_0002')
    await exec(`select reserve_x402_admission(${other}); select record_x402_admission_recovery(${other},'${'e'.repeat(64)}','eip155:8453','pending'); select record_x402_admission_recovery(${other},'${'e'.repeat(64)}','eip155:8453','not_settled'); select release_x402_admission('synthetic-offer','0xSynthetic','request_0002');`)
    assert.equal(await scalar(`select decision from reserve_x402_admission(${other});`), 'proceed')
    await exec(`select record_x402_admission_recovery(${other},'${'f'.repeat(64)}','eip155:8453','pending');`)
    assert.equal(await scalar(`select state from read_x402_admission_recovery(${other});`), 'pending')
    await exec(`update x402_admission_recovery set updated_at=now()-interval '10 minutes' where idempotency_key='request_0002';`)
    assert.equal(Number(await scalar(`select count from x402_admission_recovery_health() where state='stale_pending';`)), 1)
    await exec('set role service_role;')
    assert.equal(Number(await scalar('select count(*) from x402_admission_recovery_health();')), 5)
  } finally { await db.close() }
})
