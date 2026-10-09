import assert from 'node:assert/strict'
import { execFile, execFileSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { promisify } from 'node:util'
import test from 'node:test'
import { makeAiSafetyRecord, verifyAiSafetyRecord } from '../lib/civic/ai-safety-service.ts'

// This applies migrations to an empty disposable local database only.
const database = process.env.CIVIC_SAFETY_TEST_DATABASE_URL
const quote = (value: string) => `'${value.replaceAll("'", "''")}'`
const sql = (query: string) => execFileSync('psql', [database!, '-X', '-q', '-v', 'ON_ERROR_STOP=1', '-t', '-A'], { input: query, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim()
const record = () => makeAiSafetyRecord({ submissionId: randomUUID(), topic: 'oversight', basis: 'concern',
  concern: 'Synthetic private concern about testing autonomy boundaries; த 😀.',
  requestedAction: 'Investigate independent permission-boundary tests.', sourceUrls: ['https://example.test/research'], consentToPrivateReview: true })
const submit = (input: ReturnType<typeof record>, visitor = 'a'.repeat(64)) => `set role service_role; select public.submit_civic_safety_concern(${quote(JSON.stringify(input))}::jsonb,${quote(visitor)});`

test('private PostgreSQL inbox persists receipts, enforces atomic quotas and denies public access', { skip: !database }, async () => {
  assert.match(database!, /^postgres(?:ql)?:\/\/[^/]*@?(?:127\.0\.0\.1|localhost)(?::\d+)?\/civic_safety_test(?:\?.*)?$/, 'Use an isolated local civic_safety_test database.')
  assert.equal(sql("select count(*) from information_schema.tables where table_schema='public'"), '0', 'The test database must be empty.')
  sql("do $$ begin if not exists(select 1 from pg_roles where rolname='anon') then create role anon; end if; if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated; end if; if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role; end if; end $$; create schema if not exists extensions; create extension if not exists pgcrypto with schema extensions;")
  for (const file of ['20261004090000_civic_transparency_ledger.sql', '20261008090000_civic_ai_safety_participation.sql']) sql(readFileSync(new URL(`../supabase/migrations/${file}`, import.meta.url), 'utf8'))
  for (const role of ['anon', 'authenticated']) {
    assert.throws(() => sql(`set role ${role}; select public.read_civic_safety_inbox();`), /permission denied/)
    assert.throws(() => sql(`set role ${role}; select * from public.civic_safety_concerns;`), /permission denied/)
    assert.throws(() => sql(`set role ${role}; select public.submit_civic_safety_concern('{}'::jsonb,${quote('a'.repeat(64))});`), /permission denied/)
  }
  assert.throws(() => sql('set role service_role; select * from public.civic_safety_concerns;'), /permission denied/)
  assert.equal(sql('set role service_role; select public.civic_safety_intake_status();'), 't')
  const first = record()
  assert.deepEqual(verifyAiSafetyRecord(JSON.parse(sql(submit(first)))), first)
  assert.deepEqual(JSON.parse(sql(submit(first))), first)
  const changed = makeAiSafetyRecord({ ...first.submission, concern: 'Another synthetic concern with a reused identifier.' })
  assert.throws(() => sql(submit(changed)), /safety_id_conflict/)
  const tampered = { ...record(), receipt: { ...record().receipt, digest: '0'.repeat(64) } }
  assert.throws(() => sql(submit(tampered)), /invalid_safety_record/)
  const run = promisify(execFile)
  const concurrent = await Promise.allSettled(Array.from({ length: 4 }, () => run('psql', [database!, '-X', '-v', 'ON_ERROR_STOP=1', '-t', '-A', '-c', submit(record())])))
  assert.equal(concurrent.filter(result => result.status === 'fulfilled').length, 2)
  assert.equal(sql('select count(*) from public.civic_safety_concerns;'), '3')
  const inbox = JSON.parse(sql('set role service_role; select public.read_civic_safety_inbox();'))
  assert.equal(inbox.length, 3); inbox.forEach(verifyAiSafetyRecord)
  const reviewed = verifyAiSafetyRecord(JSON.parse(sql(`set role service_role; select public.review_civic_safety_concern(${quote(first.receipt.id)},'needs-research','Investigate the underlying source before making any claim.');`)))
  assert.equal(reviewed.status, 'needs-research'); assert.deepEqual(reviewed.receipt, first.receipt)
  assert.equal(JSON.parse(sql(submit(first))).status, 'needs-research', 'An idempotent retry does not overwrite operator review.')
  assert.throws(() => sql(`set role service_role; select public.review_civic_safety_concern(${quote(first.receipt.id)},'verified','An unsupported factual verdict.');`), /invalid_safety_review/)
  sql(`update public.civic_safety_concerns set expires_at=now()-interval '1 second' where id=${quote(first.receipt.id)};`)
  assert.equal(JSON.parse(sql('set role service_role; select public.read_civic_safety_inbox();')).length, 2)
  assert.equal(sql(`select count(*) from public.civic_safety_concerns where id=${quote(first.receipt.id)};`), '0')
  // Populate the global budget as test owner; a new visitor must also be limited.
  sql('delete from public.civic_safety_usage;')
  sql("insert into public.civic_safety_usage select (now() at time zone 'utc')::date, lpad(to_hex(i),64,'0'), 1 from generate_series(1,1000) i;")
  assert.throws(() => sql(submit(record(), 'b'.repeat(64))), /safety_rate_limited/)
})
