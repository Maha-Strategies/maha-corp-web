import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { x402Config, requirementsFor } from '../lib/x402/config.ts'
import { buildTypedData, encodePaymentSignature } from '../lib/x402/client.ts'
import { rpcUrlFor } from '../lib/x402/chain.ts'
import { acceptPayment, buildPaymentRequired, matchRequirement, matchesPaymentContext, parsePaymentHeader, type PaymentPayload, type PaymentRequirement } from '../lib/x402/protocol.ts'
import { X402_OFFERS } from '../lib/x402/offers.ts'
import { discoveryExtensionsFor, resourceInfoFor } from '../lib/x402/discovery.ts'
import { PAYMENT_HEADER_BUDGET, PAYMENT_HEADER_LIMIT } from '../lib/x402/declaration-compaction.ts'
import { USDC_NETWORKS, settlementNetworks, type UsdcNetwork } from '../lib/x402/networks.ts'
import { settlementRpcUrl } from '../lib/x402/settlement-rpc.ts'
import { ledgerFromRows, type SettlementReader } from '../lib/x402/settlement-refresh.ts'
import { bundledLedger, networkSeed, refreshStoredSettlements, validLiveSnapshot, type LiveSnapshot, type SettlementStore } from '../lib/x402/settlement-live-store.ts'
import { combineSettlementLedgers } from '../lib/x402/settlement-multichain.ts'
import { requireHealthySettlementView } from '../lib/x402/settlement-health.ts'
import { MAHA_PAYEE, CANARY_BUYER } from '../lib/x402/discovery-payment-recipe.ts'
import { MICRO_OFFERS } from '../lib/x402/micro-offers.ts'
import { fixture } from './helpers/micro-payment-fixture.ts'
import { MICRO_RECOVERY_MODE_HEADER, MICRO_RECOVERY_PAYER_HEADER } from '../lib/x402/micro-recovery-contract.ts'
import { getX402Readiness } from '../lib/x402/readiness.ts'
import { recordPurchaseAttribution, summarizePurchaseAttribution, type AttributionRow } from '../lib/x402/discovery-attribution.ts'
import { inspectQuote, quoteHistoryReport, demandDigest } from '../lib/x402/demand6/products.ts'
import { DEMAND6_INPUTS, DEMAND6_SAMPLES, quoteObservationSchema, demandResultSchema } from '../lib/x402/demand6/contracts.ts'
import { fixtureQuote, FIXTURE_NOW, FIXTURE_HISTORY } from '../lib/x402/demand6/fixtures.ts'

const B = 'eip155:8453', A = 'eip155:42161', P = 'eip155:137'
const payer = `0x${'a'.repeat(40)}`, tx = `0x${'b'.repeat(64)}`, time = new Date('2026-10-12T00:00:00Z')
const env = { X402_ENABLED: 'true', X402_NETWORK: 'base', X402_FACILITATOR_URL: 'https://facilitator.example', X402_PAY_TO: MAHA_PAYEE,
  X402_ASSET: USDC_NETWORKS[B].asset, X402_RESOURCES: JSON.stringify([{ method: 'POST', path: '/api/v1/compress' }]),
  X402_ARBITRUM_ENABLED: 'true', X402_ARBITRUM_FROM_BLOCK: '100', X402_POLYGON_ENABLED: 'true', X402_POLYGON_FROM_BLOCK: '100', X402_POLYGON_SCHEMA_READY: 'true' }
const config = x402Config(env)!, terms = requirementsFor(config.resources[0], 'https://www.mahastrategies.com/api/v1/compress', config)
const payment = (accepted: PaymentRequirement): PaymentPayload => ({ x402Version: 2, accepted, payload: { signature: 'synthetic' } })
function ledger(network: UsdcNetwork, operator = false) {
  return ledgerFromRows([{ payer: operator ? CANARY_BUYER : payer, amountBaseUnits: BigInt(1000), transactionHash: tx, blockNumber: BigInt(10), logIndex: 0, timestampUtc: time.toISOString() }], BigInt(1), BigInt(100), time.toISOString(), network)
}
function memory(initial: LiveSnapshot) {
  let value = initial, published = 0
  const store: SettlementStore = { read: async () => value, acquire: async () => true, publish: async (_, next) => { value = next; published++; return true }, release: async () => {} }
  return { store, value: () => value, published: () => published }
}
test('Polygon defaults off and preserves both existing native-USDC terms', () => {
  const two = x402Config({ ...env, X402_POLYGON_ENABLED: undefined })!
  assert.deepEqual(two.paymentNetworks, config.paymentNetworks!.slice(0, 2))
  assert.deepEqual(settlementNetworks({}), [B])
  assert.deepEqual(settlementNetworks({ X402_ARBITRUM_ENABLED: 'true' }), [B, A])
  assert.deepEqual(settlementNetworks(env), [B, A, P])
  assert.equal(x402Config({ X402_POLYGON_ENABLED: 'true' }), null)
})
test('Polygon scanner and receipt RPC defaults stay consistent after the archive-query correction', () => {
  assert.equal(USDC_NETWORKS[P].rpcUrl, 'https://polygon.drpc.org')
  assert.equal(rpcUrlFor(P), USDC_NETWORKS[P].rpcUrl)
  assert.equal(settlementRpcUrl({}, P), USDC_NETWORKS[P].rpcUrl)
  assert.throws(() => settlementRpcUrl({ VERCEL_ENV: 'production' }, P), /configuration_missing/)
})
test('Polygon cannot advertise without its scan origin, schema acknowledgment and production RPC', () => {
  assert.throws(() => x402Config({ ...env, X402_POLYGON_FROM_BLOCK: undefined }), /FROM_BLOCK/)
  assert.throws(() => x402Config({ ...env, X402_POLYGON_FROM_BLOCK: '0' }), /FROM_BLOCK/)
  assert.throws(() => x402Config({ ...env, X402_POLYGON_SCHEMA_READY: 'false' }), /SCHEMA_READY/)
  assert.throws(() => x402Config({ ...env, VERCEL_ENV: 'production' }), /POLYGON_RPC_URL/)
  assert.throws(() => x402Config({ ...env, POLYGON_RPC_URL: 'http://unsafe.example' }), /https/)
  assert.throws(() => x402Config({ ...env, X402_NETWORK: 'polygon' }), /additive/)
  assert.equal(x402Config({ ...env, VERCEL_ENV: 'production', POLYGON_RPC_URL: 'https://managed.example' })!.paymentNetworks![2].chainRpcUrl, 'https://managed.example')
})
test('same product price/payee, native Polygon asset and chain-specific EIP-712 signature', () => {
  assert.deepEqual(terms.map(term => term.network), [B, A, P])
  assert.equal(new Set(terms.map(term => term.amount)).size, 1)
  assert.equal(new Set(terms.map(term => term.payTo)).size, 1)
  const typed = buildTypedData(terms[2], payer, time.getTime())
  assert.deepEqual(typed.domain, { name: 'USD Coin', version: '2', chainId: 137, verifyingContract: USDC_NETWORKS[P].asset })
  assert.equal(typed.message.to, MAHA_PAYEE)
  assert.equal(typed.message.value, BigInt(terms[2].amount))
})
test('every payable offer has bounded three-chain quote and full-echo Polygon signing headers', async () => {
  const all = x402Config({ ...env, X402_RESOURCES: JSON.stringify(X402_OFFERS.filter(offer => offer.availability.payableInProduction).map(offer => ({ method: offer.method, path: offer.path }))) })!
  let largestQuote = 0, largestSignature = 0
  for (const priced of all.resources) {
    const url = 'https://www.mahastrategies.com' + priced.path, alternatives = requirementsFor(priced, url, all), term = alternatives[2]
    const extensions = await discoveryExtensionsFor(priced, url, term), resource = resourceInfoFor(priced, url)
    const quote = Buffer.from(JSON.stringify(buildPaymentRequired(alternatives, resource, 'Payment required.', extensions))).toString('base64')
    const typed = buildTypedData(term, payer, time.getTime())
    const signature = encodePaymentSignature(term, typed.message, `0x${'c'.repeat(130)}`, { resource, extensions })
    largestQuote = Math.max(largestQuote, quote.length); largestSignature = Math.max(largestSignature, signature.length)
    assert.ok(quote.length < PAYMENT_HEADER_LIMIT, `${priced.offerId}: quote exceeds edge header limit`)
    assert.ok(signature.length < PAYMENT_HEADER_BUDGET, `${priced.offerId}: signature exceeds conservative header budget`)
    const parsed = parsePaymentHeader(signature); assert.equal(parsed.ok, true)
    if (parsed.ok) { assert.equal(matchRequirement(parsed.payment, alternatives)?.network, P); assert.ok(matchesPaymentContext(parsed.payment, resource, extensions)) }
  }
  console.log(JSON.stringify({ payableOffers: all.resources.length, largestQuote, largestSignature, paymentsMade: 0 }))
})
test('wrong chain, token, domain or payee is refused before verification/settlement', async () => {
  const changes: Partial<PaymentRequirement>[] = [{ network: 'eip155:1' }, { asset: USDC_NETWORKS[B].asset }, { asset: '0x' + '1'.repeat(40) },
    { payTo: payer }, { extra: { name: 'USDC.e', version: '1' } }]
  for (const change of changes) {
    const p = payment({ ...terms[2], ...change })
    assert.equal(matchRequirement(p, terms), null)
    let calls = 0
    const result = await acceptPayment({ payment: p, requirements: terms,
      facilitator: { verify: async () => { calls++; return { ok: true, payer } }, settle: async () => { calls++; return { ok: true, payer, transaction: tx } } },
      replayGuard: { claim: async () => 'claimed', recordSettlement: async () => {} } })
    assert.equal(result.ok, false); assert.equal(calls, 0)
  }
})
test('a retry choosing Base confirms its original Polygon settlement without another charge', async () => {
  let settled = 0, claimed = 0; const seen: string[] = []
  const result = await acceptPayment({ payment: payment(terms[0]), requirements: terms,
    facilitator: { verify: async () => ({ ok: true, payer }), settle: async () => { settled++; return { ok: true, payer, transaction: tx } } },
    replayGuard: { claim: async () => { claimed++; return 'claimed' }, recordSettlement: async () => {} },
    admissionGuard: { reserve: async () => ({ kind: 'already_paid', transaction: tx, network: P }), settled: async () => {}, released: async () => {} },
    confirmRecoveryOnChain: network => async s => { seen.push(network); assert.equal(s.transaction, tx); return { status: 'confirmed' } } })
  assert.equal(result.ok, true)
  if (result.ok) { assert.equal(result.network, P); assert.equal(result.replayed, true) }
  assert.deepEqual(seen, [P]); assert.equal(settled, 0); assert.equal(claimed, 0)
})
test('same hash/log on three chains stays distinct with correct links and operator exclusions', () => {
  const combined = combineSettlementLedgers([ledger(B), ledger(A), ledger(P, true)])
  assert.equal(combined.entries.length, 3); assert.equal(combined.summary.externalSettlements, 2)
  assert.equal(combined.summary.canarySettlements, 1); assert.equal(combined.summary.externalValueUsdc, '0.002')
  assert.match(combined.entries.find(entry => entry.caip2Network === P)!.explorerUrl, /^https:\/\/polygonscan.com\/tx\//)
  assert.match(combined.network, /Polygon PoS/)
  assert.ok(validLiveSnapshot({ schemaVersion: 'maha-live-settlements/1.0', ledger: bundledLedger, caughtUp: true, finalizedBlock: bundledLedger.scannedToBlock }, B))
  for (const network of [B, A, P] as const) {
    const l = ledger(network), snapshot: LiveSnapshot = { schemaVersion: 'maha-live-settlements/1.0', ledger: l, caughtUp: true, finalizedBlock: '100' }
    assert.ok(validLiveSnapshot(snapshot, network))
    for (const other of [B, A, P].filter(n => n !== network)) assert.equal(validLiveSnapshot(snapshot, other as UsdcNetwork), false)
  }
})
test('Polygon outage preserves its cursor while both other chains publish', async () => {
  const networks = [B, A, P] as const, stores = networks.map(network => memory({ schemaVersion: 'maha-live-settlements/1.0', ledger: ledger(network), caughtUp: true, finalizedBlock: '100' }))
  const results = await Promise.allSettled(networks.map((network, i) => {
    const reader: SettlementReader = { caip2Network: network, finalizedBlock: async () => BigInt(120), timestamp: async () => time.toISOString(),
      transfers: async () => { if (network === P) throw Error('simulated Polygon outage'); return [] } }
    return refreshStoredSettlements(stores[i].store, reader, time, ledger(network))
  }))
  assert.deepEqual(results.map(result => result.status), ['fulfilled', 'fulfilled', 'rejected'])
  assert.deepEqual(stores.map(store => store.value().ledger.scannedToBlock), ['120', '120', '100'])
  assert.equal(stores[2].published(), 0)
})
test('Polygon has its own required seed; no hidden reuse of another chain cursor', () => {
  const before = process.env.X402_POLYGON_FROM_BLOCK
  try {
    delete process.env.X402_POLYGON_FROM_BLOCK
    assert.throws(() => networkSeed(P), /polygon_start_block_required/)
    process.env.X402_POLYGON_FROM_BLOCK = '90000'
    const l = networkSeed(P); assert.equal(l.caip2Network, P); assert.equal(l.scannedFromBlock, '90000')
    assert.equal(l.entries.length, 0); assert.equal(l.observedAt, '1970-01-01T00:00:00.000Z')
  } finally { if (before === undefined) delete process.env.X402_POLYGON_FROM_BLOCK; else process.env.X402_POLYGON_FROM_BLOCK = before }
})
test('science response recovery preserves Polygon and never repays', async () => {
  const offer = MICRO_OFFERS.find(o => o.id === 'quantum-state-validity')!
  const f = fixture(offer, { config: x402Config({ ...env, X402_RESOURCES: JSON.stringify([{ method: 'POST', path: offer.path }]) })! })
  const signature = await f.signature(0, 2)
  const paid = await f.handlers.POST(f.request(undefined, { 'PAYMENT-SIGNATURE': signature })); assert.equal(paid.status, 200)
  const body = await paid.json()
  const replay = await f.handlers.POST(f.request(undefined, { [MICRO_RECOVERY_MODE_HEADER]: 'replay', [MICRO_RECOVERY_PAYER_HEADER]: '0x' + '4'.repeat(40) }))
  assert.equal(replay.status, 200); assert.deepEqual(await replay.json(), body); assert.equal(f.calls.settle, 1)
  assert.equal(JSON.parse(Buffer.from(replay.headers.get('PAYMENT-RESPONSE')!, 'base64').toString()).network, P)
  assert.ok(f.calls.rpc.some(call => call.name === 'record_x402_admission_recovery' && call.p_network === P))
})
test('attribution chain namespaces and operator exclusions survive Polygon expansion', async () => {
  const args: Record<string, unknown>[] = [], rpc = { rpc: async (_name: string, parameters: Record<string, unknown>) => { args.push(parameters); return { error: null } } }
  for (const network of [B, A, P]) await recordPurchaseAttribution({ offerId: 'csv-import-preflight', paymentId: 'ab'.repeat(32), network, payer,
    amount: '13500', transaction: tx, source: 'reddit', settlement: 'confirmed', responsePrepared: true, replayed: false }, rpc)
  assert.deepEqual(args.map(arg => arg.p_network), [B, A, P]); assert.equal(new Set(args.map(arg => arg.p_payer_key)).size, 3)
  await recordPurchaseAttribution({ offerId: 'csv-import-preflight', paymentId: 'ab'.repeat(32), network: P, payer: CANARY_BUYER,
    amount: '13500', transaction: tx, source: 'direct', settlement: 'confirmed', responsePrepared: true, replayed: false }, rpc)
  assert.equal(args[3].p_operator, true)
  const rows: AttributionRow[] = args.map(arg => ({ offer_id: String(arg.p_offer_id), payment_id: String(arg.p_payment_id), network: String(arg.p_network),
    payer_key: String(arg.p_payer_key), discovery_source: 'reddit', settlement_state: 'confirmed', response_prepared: true, operator_activity: Boolean(arg.p_operator) }))
  // The last observation is another wallet but would share an authorization key: rejected as duplicate, not counted twice.
  assert.throws(() => summarizePurchaseAttribution(rows), /invalid_attribution/)
  const report = summarizePurchaseAttribution(rows.slice(0, 3))
  assert.equal(report.sources.reddit.purchases, 3); assert.equal(report.returningChainWalletOfferPairs, 0)
})
test('Polygon readiness uses an actual read-only constraint probe, not merely a feature flag', async () => {
  for (const result of [true, false, null]) {
    const report = await getX402Readiness({ environment: env, probe: async () => true, polygonSchemaProbe: async () => result })
    assert.equal(report.checks.find(check => check.id === 'x402.polygon.attribution')?.state, result === true ? 'ok' : 'fail')
  }
})
test('legacy two-network observations remain valid; absence of Polygon is not settlement or failure', () => {
  const legacy = { ...FIXTURE_HISTORY.observations[0], networks: FIXTURE_HISTORY.observations[0].networks.filter(row => row.network !== P) }
  assert.ok(quoteObservationSchema.safeParse(legacy).success)
  const input = DEMAND6_INPUTS['x402-quote-change-report'].parse({ ...DEMAND6_SAMPLES['x402-quote-change-report'], dataClass: 'synthetic' })
  assert.equal(quoteHistoryReport(input, { ...FIXTURE_HISTORY, observations: [legacy, FIXTURE_HISTORY.observations[1]] }, FIXTURE_NOW).sampleCount, 2)
  const read = fixtureQuote(), challenge = JSON.parse(Buffer.from(read.headers['payment-required'], 'base64').toString())
  challenge.accepts = challenge.accepts.filter((term: PaymentRequirement) => term.network !== P)
  read.headers['payment-required'] = Buffer.from(JSON.stringify(challenge)).toString('base64')
  assert.equal(inspectQuote('https://www.mahastrategies.com/api/v1/compress', read, MAHA_PAYEE, '2000', new Date(FIXTURE_NOW).toISOString()).networks[2].state, 'not_offered')
})
test('frozen pre-Polygon cached results still validate without changing their signed integrity hashes', () => {
  const old = JSON.parse(readFileSync('test/fixtures/x402-legacy-demand6-results.json', 'utf8'))
  for (const id of ['live-x402-payment-preflight', 'x402-quote-change-report'] as const) {
    const saved = old.products[id], parsed = demandResultSchema(id).parse(saved)
    assert.deepEqual(parsed, saved)
    assert.equal(parsed.inputHash, demandDigest({ ...DEMAND6_SAMPLES[id], dataClass: 'synthetic' }))
    assert.equal(parsed.resultHash, demandDigest(parsed.result))
    assert.equal(parsed.receiptDigest, demandDigest({ version: parsed.version, productId: id, inputHash: parsed.inputHash, resultHash: parsed.resultHash }))
  }
})
test('monitor accepts activated third chain but refuses missing/stale/duplicate network projections', () => {
  const fresh = { source: 'scheduled_snapshot', stale: false, caughtUp: true, observedAt: time.toISOString() }
  const two = { ...fresh, status: 'healthy', networks: [B, A].map(network => ({ ...fresh, network })) }
  const three = { ...two, networks: [...two.networks, { ...fresh, network: P }] }
  requireHealthySettlementView(two, [B, A], time.getTime()); requireHealthySettlementView(three, [B, A, P], time.getTime())
  assert.throws(() => requireHealthySettlementView(two, [B, A, P], time.getTime()), /configured network/)
  for (const bad of [{ ...three, networks: [...two.networks, { ...fresh, network: P, stale: true }] },
    { ...three, networks: [...two.networks, { ...fresh, network: A }] }, { ...three, networks: [...two.networks, { ...fresh, network: 'eip155:1' }] }]) {
    assert.throws(() => requireHealthySettlementView(bad, [B, A, P], time.getTime()), /configured network/)
  }
})
test('new migration leaves applied migration immutable and preserves restricted read-only verification', () => {
  assert.equal(createHash('sha256').update(readFileSync('supabase/migrations/20261012120000_x402_discovery_attribution.sql')).digest('hex'), '4e54b4e86921e97749c3cbcf9f1579802080687667bb3836d2a69aba76b6d5b5')
  const sql = readFileSync('supabase/migrations/20261012160000_x402_polygon_attribution_network.sql', 'utf8')
  assert.match(sql, /eip155:137/); assert.match(sql, /c\.convalidated and t\.relrowsecurity/)
  assert.match(sql, /revoke all on function public\.x402_polygon_attribution_ready\(\) from public,anon,authenticated/)
  assert.doesNotMatch(sql, /delete from|truncate |update public\.|disable row level security/i)
})
