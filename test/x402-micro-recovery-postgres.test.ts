import assert from 'node:assert/strict'
import test from 'node:test'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { readFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { fixture } from './helpers/micro-payment-fixture.ts'
import { microPurchaseHeaders } from '../lib/x402/micro-purchase.ts'
import { MICRO_OFFERS as CATALOGUE } from '../lib/x402/micro-offers.ts'
const MICRO_OFFERS = [CATALOGUE.find(o => o.id === 'quantum-state-validity')!]
import { MICRO_RECOVERY_MODE_HEADER, MICRO_RECOVERY_PAYER_HEADER } from '../lib/x402/micro-recovery-contract.ts'

const database = process.env.X402_MICRO_RECOVERY_DATABASE_URL
const command = promisify(execFile)
const quote = (value: unknown) => value === null ? 'null' : typeof value === 'number' ? String(value) : "'" + String(value).replaceAll("'", "''") + "'"
// Only a new disposable loopback database. No application env/service keys.
test('paid HTTP recovery uses real PostgreSQL transactions and permissions', { skip: !database }, async t => {
  assert.match(database!, /^postgres(?:ql)?:\/\/[^/]*@?(?:127\.0\.0\.1|localhost)(?::\d+)?\/x402_micro_recovery_test(?:\?.*)?$/)
  // Bounded -c argument; never a shell or application credentials.
  const query = async (input: string) => (await command('psql', [database!, '-X', '-q', '-t', '-A', '-v', 'ON_ERROR_STOP=1', '-c', input], { encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 })).stdout.trim()
  assert.equal(await query("select count(*) from information_schema.tables where table_schema='public';"), '0')
  await query("create schema extensions; do $$ begin if not exists(select 1 from pg_roles where rolname='anon') then create role anon nologin; end if; if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if; if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role nologin bypassrls; end if; end $$;")
  for (const name of ['20260804000100_x402_payment_id_replay_key.sql', '20260804000200_x402_settlement_chain_confirmation.sql', '20260810000500_x402_offer_admissions.sql', '20261003090000_x402_admission_recovery.sql', '20261011110000_x402_micro_purchase_recovery.sql']) {
    await query(await readFile(new URL(`../supabase/migrations/${name}`, import.meta.url), 'utf8'))
  }
  const rpc = async (name: string, args: Record<string, unknown>) => {
    assert.match(name, /^[a-z0-9_]+$/)
    const parameters = Object.entries(args).map(([key, value]) => { assert.match(key, /^p_[a-z0-9_]+$/); return `${key}=>${quote(value)}` }).join(',')
    try {
      const rows = JSON.parse(await query(`set role service_role; select coalesce(json_agg(t),'[]'::json) from (select * from public.${name}(${parameters})) t;`))
      return { data: name === 'claim_x402_payment' ? rows[0]?.claim_x402_payment : rows, error: null }
    } catch { return { data: null, error: { code: 'synthetic_rpc_failed' } } }
  }
  const replayHeaders = { [MICRO_RECOVERY_MODE_HEADER]: 'replay', [MICRO_RECOVERY_PAYER_HEADER]: '0x' + '4'.repeat(40) }
  await t.test('network response loss after settlement, same proof and fresh authorization all preserve one original transaction', async () => {
    const f = fixture(MICRO_OFFERS[0], { rpc }), signature = await f.signature(101), fresh = await f.signature(102)
    let loseResponse = true
    const server = createServer(async (req, res) => {
      try {
        const chunks: Buffer[] = []
        for await (const chunk of req) chunks.push(Buffer.from(chunk))
        const headers = new Headers()
        for (const [key, value] of Object.entries(req.headers)) if (typeof value === 'string') headers.set(key, value)
        const response = await f.handlers.POST(new Request('https://www.mahastrategies.com' + req.url, { method: 'POST', headers, body: Buffer.concat(chunks) }))
        if (loseResponse && response.status === 200) { loseResponse = false; res.destroy(); return }
        res.writeHead(response.status, Object.fromEntries(response.headers)); res.end(await response.text())
      } catch { res.destroy() }
    })
    await new Promise<void>(r => server.listen(0, '127.0.0.1', r))
    const address = server.address(); assert.ok(address && typeof address !== 'string')
    const url = `http://127.0.0.1:${address.port}${MICRO_OFFERS[0].path}`
    const send = (headers: Record<string, string>) => { const request = f.request(undefined, headers); return fetch(url, { method: 'POST', headers: request.headers, body: JSON.stringify(MICRO_OFFERS[0].discovery.input) }) }
    try {
      await assert.rejects(() => send({ 'PAYMENT-SIGNATURE': signature }))
      assert.equal(f.calls.settle, 1)
      const recovered = await send(replayHeaders), body = await recovered.text(), receipt = recovered.headers.get('PAYMENT-RESPONSE')
      assert.equal(recovered.status, 200); assert.equal(f.calls.verify, 1)
      const wrongSecret = { ...f.identity, recoverySecret: '0'.repeat(64) }
      assert.equal((await send({ ...replayHeaders, ...microPurchaseHeaders(MICRO_OFFERS[0].id, MICRO_OFFERS[0].discovery.input, wrongSecret) })).status, 404)
      assert.equal((await send({ ...replayHeaders, [MICRO_RECOVERY_PAYER_HEADER]: '0x' + '9'.repeat(40) })).status, 404)
      const changed = structuredClone(MICRO_OFFERS[0].discovery.input) as { state: { real: number[] } }
      changed.state.real = [1,0,0,0]
      const conflicting = await f.handlers.POST(f.request(changed, { 'PAYMENT-SIGNATURE': fresh }))
      assert.equal(conflicting.status, 409)
      assert.equal(f.calls.settle, 1)
      for (const proof of [signature, fresh]) {
        const retry = await send({ 'PAYMENT-SIGNATURE': proof })
        assert.equal(retry.status, 200); assert.equal(await retry.text(), body)
        assert.equal(retry.headers.get('PAYMENT-RESPONSE'), receipt)
      }
      assert.equal(f.calls.settle, 1)
      assert.equal(await query('select count(*) from x402_payments;'), '1')
      assert.equal(await query('select count(*) from x402_settlements;'), '1')
      assert.equal(await query('select count(*) from x402_micro_purchases;'), '1')
      const stored = await query('select row_to_json(t) from x402_micro_purchases t;')
      assert.ok(!stored.includes(f.identity.recoverySecret))
      const fields = JSON.parse(stored)
      assert.deepEqual(Object.keys(fields).sort(), ['created_at','idempotency_key','offer_id','payer','response_digest','secret_hash'])
      // Expiry is an access limit, NOT deletion or authority to pay again.
      await query(`update x402_micro_purchases set created_at=now()-interval '31 days' where idempotency_key=${quote(f.identity.purchaseId)};`)
      const expired = await send(replayHeaders)
      assert.equal(expired.status, 409); assert.equal(expired.headers.get('PAYMENT-REQUIRED'), null)
      assert.equal((await expired.json()).error.code, 'purchase_expired_operator_review_required')
      assert.equal(await query('select count(*) from x402_micro_purchases;'), '1')
      assert.equal((await send({ 'PAYMENT-SIGNATURE': fresh })).status, 409)
      assert.equal(f.calls.settle, 1)
    } finally { server.closeAllConnections(); await new Promise<void>(r => server.close(() => r())) }
  })
  await t.test('reservation race blocks a fresh authorization while first settlement is running', async () => {
    let started!: () => void, finish!: () => void
    const entered = new Promise<void>(r => { started = r }), wait = new Promise<void>(r => { finish = r })
    const f = fixture(MICRO_OFFERS[0], { rpc, beforeSettle: async () => { started(); await wait } })
    const first = await f.signature(201), second = await f.signature(202)
    const pending = f.handlers.POST(f.request(undefined, { 'PAYMENT-SIGNATURE': first }))
    await entered
    try {
      const refused = await f.handlers.POST(f.request(undefined, { 'PAYMENT-SIGNATURE': second }))
      assert.equal(refused.status, 409); assert.equal((await refused.json()).error.code, 'request_already_in_progress')
      const recovery = await f.handlers.POST(f.request(undefined, replayHeaders))
      assert.equal(recovery.status, 409); assert.equal((await recovery.json()).error.code, 'purchase_pending_operator_review_required')
    } finally { finish() }
    assert.equal((await pending).status, 200); assert.equal(f.calls.settle, 1)
  })
  await t.test('unknown post-settlement outcome is durable and never retaken with fresh proof', async () => {
    const f = fixture(MICRO_OFFERS[0], { rpc, throwSettle: true }), first = await f.signature(301), fresh = await f.signature(302)
    assert.equal((await f.handlers.POST(f.request(undefined, { 'PAYMENT-SIGNATURE': first }))).status, 503)
    assert.equal((await f.handlers.POST(f.request(undefined, { 'PAYMENT-SIGNATURE': fresh }))).status, 409)
    assert.equal((await f.handlers.POST(f.request(undefined, replayHeaders))).status, 409)
    assert.equal(f.calls.settle, 1)
    assert.equal(await query(`select state from x402_admission_recovery where idempotency_key=${quote(f.identity.purchaseId)};`), 'unknown')
    await query(`update x402_offer_admissions set created_at=now()-interval '2 days' where idempotency_key=${quote(f.identity.purchaseId)};`)
    assert.equal((await f.handlers.POST(f.request(undefined, { 'PAYMENT-SIGNATURE': fresh }))).status, 409)
    assert.equal(f.calls.settle, 1)
  })
  await t.test('mixed-case EVM wallet retries share one durable purchase binding', async () => {
    let payer = '0x' + 'aBcD'.repeat(10)
    const f = fixture(MICRO_OFFERS[0], { rpc, getPayer: () => payer }), first = await f.signature(401), fresh = await f.signature(402)
    const paid = await f.handlers.POST(f.request(undefined, { 'PAYMENT-SIGNATURE': first }))
    assert.equal(paid.status, 200); const receipt = paid.headers.get('PAYMENT-RESPONSE')
    payer = payer.toLowerCase()
    const retry = await f.handlers.POST(f.request(undefined, { 'PAYMENT-SIGNATURE': fresh }))
    assert.equal(retry.status, 200); assert.equal(retry.headers.get('PAYMENT-RESPONSE'), receipt)
    const recovered = await f.handlers.POST(f.request(undefined, { ...replayHeaders, [MICRO_RECOVERY_PAYER_HEADER]: '0x' + 'ABCD'.repeat(10) }))
    assert.equal(recovered.status, 200); assert.equal(recovered.headers.get('PAYMENT-RESPONSE'), receipt)
    assert.equal(f.calls.settle, 1)
    assert.equal(await query(`select count(*) from x402_micro_purchases where idempotency_key=${quote(f.identity.purchaseId)};`), '1')
  })
  await t.test('only service RPCs can create bindings; public roles cannot read metadata or invoke recovery', async () => {
    for (const role of ['anon', 'authenticated']) {
      await assert.rejects(() => query(`set role ${role}; select * from x402_micro_purchases;`))
      await assert.rejects(() => query(`set role ${role}; select * from read_x402_micro_purchase('x','x','x','x','x');`))
      assert.equal(await query(`select has_function_privilege('${role}','reserve_x402_micro_purchase(text,text,text,text,text,numeric,text,text)','execute');`), 'f')
    }
    await assert.rejects(() => query("set role service_role; update x402_micro_purchases set secret_hash='sha256:'||repeat('0',64);"))
    await assert.rejects(() => query('set role service_role; delete from x402_micro_purchases;'))
    assert.equal(await query("select has_function_privilege('service_role','read_x402_micro_purchase(text,text,text,text,text)','execute');"), 't')
  })
})
