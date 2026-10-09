import assert from 'node:assert/strict'
import { execFile, execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { promisify } from 'node:util'
import test from 'node:test'
import { canonicalJson, civicDigest } from '../lib/civic/receipt.ts'
import { createHash } from 'node:crypto'
import { appendLedger, GENESIS_DIGEST, receiptPayload, verifyLedger, type CivicEvent, type LedgerReceipt } from '../lib/civic/transparency-ledger.ts'
import { ledgerPageSchema } from '../lib/civic/ledger-store.ts'

// Use only a disposable database. This test creates roles/tables and applies the migration.
const database = process.env.CIVIC_TEST_DATABASE_URL
const quote = (value: string) => `'${value.replaceAll("'", "''")}'`
const sql = (query: string) => execFileSync('psql', [database!, '-X', '-q', '-v', 'ON_ERROR_STOP=1', '-t', '-A'], { input: query, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim()
const event = (id: string): CivicEvent => ({ id, kind: 'decision', occurredAt: '2026-10-04T00:00:00Z', description: 'Synthetic append-only test', evidence: [{ citation: 'Disposable DB test', url: 'https://example.test/fixture' }], rationale: 'Verify storage integrity.' })
const appendQuery = (receipt: LedgerReceipt) => `set role service_role; select public.append_civic_receipt(${quote(JSON.stringify(receipt))}::jsonb,${quote(canonicalJson(receiptPayload(receipt)))});`

test('Postgres appends serialize, rejects stale heads/replay/tampering, pages and forbids rewrites', { skip: !database }, async () => {
  assert.match(database!, /^postgres(?:ql)?:\/\/[^/]*@?(?:127\.0\.0\.1|localhost)(?::\d+)?\/civic_test(?:\?.*)?$/, 'Use an isolated local civic_test database.')
  sql("do $$ begin if not exists(select 1 from pg_roles where rolname='anon') then create role anon; end if; if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated; end if; if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role; end if; end $$; create schema extensions; create extension pgcrypto with schema extensions;")
  sql(readFileSync(new URL('../supabase/migrations/20261004090000_civic_transparency_ledger.sql', import.meta.url), 'utf8'))
  const receipts = appendLedger(appendLedger([], event('one')), event('two'))
  assert.throws(() => sql(`set role anon; select public.read_civic_ledger_page('maha-civic',0,100);`), /permission denied/)
  assert.deepEqual(JSON.parse(sql(appendQuery(receipts[0]))), receipts[0])
  assert.throws(() => sql(appendQuery(receipts[0])), /stale_civic_head/)
  const alternative = appendLedger([receipts[0]], event('concurrent'))[1]
  const run = promisify(execFile)
  const results = await Promise.allSettled([receipts[1], alternative].map(r => run('psql', [database!, '-X', '-v', 'ON_ERROR_STOP=1', '-t', '-A', '-c', appendQuery(r)])))
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1)
  const page = ledgerPageSchema.parse(JSON.parse(sql("set role service_role; select public.read_civic_ledger_page('maha-civic',0,100);")))
  assert.equal(page.head.sequence, 2); assert.equal(page.hasMore, false)
  verifyLedger(page.receipts, { ledgerId: 'maha-civic', sequence: 0, digest: GENESIS_DIGEST }, page.head)
  const suffix = ledgerPageSchema.parse(JSON.parse(sql("set role service_role; select public.read_civic_ledger_page('maha-civic',1,1);")))
  assert.equal(suffix.receipts.length, 1); verifyLedger(suffix.receipts, suffix.preceding, suffix.head)
  const first = ledgerPageSchema.parse(JSON.parse(sql("set role service_role; select public.read_civic_ledger_page('maha-civic',0,1);")))
  assert.equal(first.hasMore, true)
  const tampered = { ...appendLedger(page.receipts, event('three'))[2], digest: 'f'.repeat(64) }
  assert.throws(() => sql(appendQuery(tampered)), /invalid_civic_receipt/)
  const next = appendLedger(page.receipts, { ...event('unicode'), description: 'Unicode மஹா 😀; quote " slash / newline\n' })[2]
  assert.equal(sql(`select public.civic_receipt_canonical(${quote(JSON.stringify(receiptPayload(next)))}::jsonb);`), canonicalJson(receiptPayload(next)))
  const noncanonical = JSON.stringify(receiptPayload(next), null, 2)
  const alternateDigest = createHash('sha256').update(noncanonical).digest('hex')
  assert.notEqual(alternateDigest, civicDigest(receiptPayload(next)))
  assert.throws(() => sql(`set role service_role; select public.append_civic_receipt(${quote(JSON.stringify({ ...next, digest: alternateDigest }))}::jsonb,${quote(noncanonical)});`), /invalid_civic_receipt/)
  assert.throws(() => sql(appendQuery(appendLedger(page.receipts, event('one'))[2])), /Duplicate civic event|duplicate key/)
  assert.throws(() => sql('set role service_role; delete from public.civic_ledger_receipts;'), /permission denied/)
  assert.throws(() => sql('delete from public.civic_ledger_receipts;'), /civic_receipts_are_append_only/)
  assert.throws(() => sql('update public.civic_ledger_receipts set event_id=event_id;'), /civic_receipts_are_append_only/)
  assert.throws(() => sql('truncate public.civic_ledger_receipts;'), /civic_receipts_are_append_only/)
  assert.equal(sql('select count(*) from public.civic_ledger_receipts;'), '2')
})
