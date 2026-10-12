import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import { privateKeyToAccount } from 'viem/accounts'
import { validate } from './helpers/json-schema.ts'
import { DEMAND6_IDS, DEMAND6_PRODUCTS, DEMAND6_SAMPLES, DEMAND6_INPUTS, demandResultSchema, parseDemandInput, demand6Path, type Demand6Id } from '../lib/x402/demand6/contracts.ts'
import { DEMAND6_OFFERS } from '../lib/x402/demand6/offers.ts'
import { csvPreflight, cataloguePreflight, validGtin } from '../lib/x402/demand6/validators.ts'
import { buildDemandProduct, demandDigest, inspectQuote, quoteHistoryReport } from '../lib/x402/demand6/products.ts'
import { createPublicReader, publicIPv4, publicTargetUrl, type PublicRead } from '../lib/x402/demand6/public-fetch.ts'
import { extractedPublicText, extractiveBrief, quoteLocations, textHash } from '../lib/x402/demand6/sources.ts'
import { fixtureDependencies, FIXTURE_NOW, FIXTURE_HISTORY, fixtureQuote } from '../lib/x402/demand6/fixtures.ts'
import { demand6Handlers as createDemand6Handlers } from '../lib/x402/demand6/route.ts'
import { demandPurchaseHeaders, demandPurchaseTypedData, readDemandAuthorization } from '../lib/x402/demand6/purchase.ts'
import { memoryDemandStore, type DemandStore } from '../lib/x402/demand6/store.ts'
import { DECLARED_PAYMENT_NETWORKS, usdcNetwork } from '../lib/x402/networks.ts'
import { MAHA_PAYEE } from '../lib/x402/discovery-payment-recipe.ts'
import { encodePaymentSignature } from '../lib/x402/client.ts'
import { encodePaymentResponse, type PaymentRequirement } from '../lib/x402/protocol.ts'
import { payableOffers, X402_OFFERS } from '../lib/x402/offers.ts'
import { apiProxyGate } from '../lib/api-proxy-policy.ts'
import { resolveX402, type X402Outcome } from '../lib/x402/gateway.ts'
import { x402Config, requirementsFor } from '../lib/x402/config.ts'
import { discoveryExtensionsFor, resourceInfoFor } from '../lib/x402/discovery.ts'
import { MICRO_MAX_REQUEST_BYTES } from '../lib/x402/micro-contracts.ts'
import { DEMAND6_MAX_REQUEST_BYTES } from '../lib/x402/demand6/contracts.ts'
import type { PurchaseAttribution } from '../lib/x402/discovery-attribution.ts'
import { openApiDocument } from '../lib/openapi.ts'
const origin = 'https://www.mahastrategies.com'
const resource = origin + '/api/v1/compress'
const sourceUrl = origin + '/tools/context-review'
const sample = (id: Demand6Id) => ({ ...DEMAND6_SAMPLES[id], dataClass: 'synthetic' })
const demand6Handlers = (id: Demand6Id, dependencies: Parameters<typeof createDemand6Handlers>[1] = {}) => createDemand6Handlers(id, {
  recordPurchase: async () => {},
  acquirePreparation: async () => ({ admitted: true, active: 1, token: 'mock-preparation' }), releasePreparation: async () => {}, ...dependencies,
})
for (const id of DEMAND6_IDS) {
  test(`${id}: reproducible synthetic result, independently valid schemas and integrity bindings`, async () => {
    const offer = DEMAND6_OFFERS.find(offer => offer.id === id)!, value = sample(id)
    assert.deepEqual(validate(value, offer.discovery.inputSchema), [])
    const result = await buildDemandProduct(id, value, fixtureDependencies)
    assert.deepEqual(validate(result, offer.discovery.outputSchema), [])
    assert.deepEqual(result, await buildDemandProduct(id, value, fixtureDependencies))
    assert.deepEqual(result, offer.discovery.output)
    assert.equal(result.inputHash, demandDigest(value)); assert.equal(result.resultHash, demandDigest(result.result))
    assert.equal(result.receiptDigest, demandDigest({ version: result.version, productId: id, inputHash: result.inputHash, resultHash: result.resultHash }))
  })
  test(`${id}: strict input, no silent private-data acceptance or production activation`, async () => {
    for (const input of [{ ...sample(id), dataClass: 'private' }, { ...sample(id), unexpected: 'not admitted' }, {}]) {
      await assert.rejects(buildDemandProduct(id, input, fixtureDependencies))
    }
    const handler = demand6Handlers(id, { environment: 'production', enabled: false, resolve: async () => { throw Error('must not settle') }, build: async () => { throw Error('must not build') } })
    assert.equal((await handler.POST(new Request(origin + demand6Path(id), { method: 'POST' }))).status, 503)
    assert.equal((await handler.GET(new Request(origin + demand6Path(id)))).status, 200)
    assert.equal(apiProxyGate(demand6Path(id), 'POST', true), 'self_managed')
  })
}
test('six unique owner-approved releases preserve the existing 155 payable offers', () => {
  assert.equal(payableOffers().filter(offer => !DEMAND6_IDS.includes(offer.id as Demand6Id)).length, 155)
  assert.equal(payableOffers().length, 161)
  assert.equal(new Set(DEMAND6_IDS.map(id => DEMAND6_PRODUCTS[id].amount)).size, 6)
  for (const offer of DEMAND6_OFFERS) {
    assert.equal(offer.status, 'available'); assert.equal(offer.availability.payableInProduction, true)
    assert.ok(offer.description.length <= 480 && Buffer.byteLength(offer.description) <= 480)
    assert.equal(X402_OFFERS.filter(other => other.id !== offer.id && [other.amount, ...(other.supersededAmounts ?? [])].includes(offer.amount)).length, 0)
  }
})
test('all six OpenAPI contracts have declared tags, exact schemas and released status', () => {
  const paths = openApiDocument.paths as unknown as Record<string, { get: { tags: string[] }; post: {
    tags: string[]; 'x-maha-payable-in-production': boolean; requestBody: { content: { 'application/json': { schema: unknown } } } } }>
  const tags = new Set<string>(openApiDocument.tags.map(tag => tag.name))
  for (const offer of DEMAND6_OFFERS) {
    const path = paths[offer.path]
    assert.ok(path)
    for (const tag of [...path.get.tags, ...path.post.tags]) assert.ok(tags.has(tag))
    assert.equal(path.post['x-maha-payable-in-production'], true)
    assert.deepEqual(path.post.requestBody.content['application/json'].schema, offer.discovery.inputSchema)
  }
})
test('CSV quoting handles embedded delimiters, escaped quotes, CRLF, BOM and quoted newlines without execution', () => {
  const input = DEMAND6_INPUTS['csv-import-preflight'].parse({ ...sample('csv-import-preflight'), csv: '\uFEFFsku,quantity\r\n"a,b",2\r\n"a""b",3\r\n"a\nb",4\r\n' })
  const result = csvPreflight(input)
  assert.equal(result.recordsChecked, 3); assert.equal(result.readyUnderDeclaredSchema, true); assert.equal(result.cellsExecuted, false)
  const bad = csvPreflight({ ...input, csv: 'sku,sku\na,2,3\n"unterminated' })
  for (const code of ['duplicate_header', 'declared_column_missing', 'inconsistent_column_count', 'unclosed_quote']) assert.ok(bad.findings.some(finding => finding.code === code))
})
test('CSV type, missing-value and formula-prefix findings are bounded and never echo cells', () => {
  const parsed = DEMAND6_INPUTS['csv-import-preflight'].parse({ ...sample('csv-import-preflight'), csv: 'sku,quantity\n=EXFIL(),not-a-number\na,\n' })
  const result = csvPreflight(parsed)
  for (const code of ['spreadsheet_formula_prefix', 'declared_type_mismatch', 'required_value_missing']) assert.ok(result.findings.some(row => row.code === code))
  assert.ok(!JSON.stringify(result).includes('EXFIL'))
  const many = csvPreflight({ ...parsed, csv: 'sku,quantity\n' + '=X,bad\n'.repeat(200) })
  assert.equal(many.findings.length, 300); assert.equal(many.findingsTruncated, true)
  assert.throws(() => csvPreflight({ ...parsed, csv: 'sku,quantity\n' + 'a,1\n'.repeat(501) }), /csv_work_bound/)
  assert.throws(() => parseDemandInput('csv-import-preflight', { ...parsed, columns: [parsed.columns[0], parsed.columns[0]] }), /duplicate_schema/)
})
test('GTIN leading zeros and valid lengths work; malformed identifiers and feed currency mismatch are findings', () => {
  for (const value of ['96385074', '036000291452', '4006381333931', '04006381333931']) assert.equal(validGtin(value), true)
  for (const value of ['4006381333932', '123', '400638133393x']) assert.equal(validGtin(value), false)
  const input = DEMAND6_INPUTS['product-catalogue-preflight'].parse(sample('product-catalogue-preflight'))
  const result = cataloguePreflight({ ...input, products: [input.products[0], { ...input.products[0], price: '-1', currency: 'EUR', gtin: 'invalid' }] })
  for (const code of ['duplicate_sku', 'price_not_positive_decimal', 'currency_differs_from_declared_feed_currency', 'invalid_gtin_check_digit_or_length']) assert.ok(result.findings.some(finding => finding.code === code))
  assert.equal(result.marketplaceApprovalEstablished, false)
})
test('network quotes, schema presence, settlement and paid delivery stay separate', () => {
  const quote = inspectQuote(resource, fixtureQuote(), MAHA_PAYEE, '2000', new Date(FIXTURE_NOW).toISOString())
  assert.deepEqual(quote.networks.map(row => row.state), DECLARED_PAYMENT_NETWORKS.map(() => 'valid_quote'))
  assert.equal(quote.schemaState, 'present_not_validated')
  const wrong = fixtureQuote(), challenge = JSON.parse(Buffer.from(wrong.headers['payment-required'], 'base64').toString())
  challenge.accepts[1].asset = challenge.accepts[0].asset
  wrong.headers['payment-required'] = Buffer.from(JSON.stringify(challenge)).toString('base64')
  assert.equal(inspectQuote(resource, wrong, MAHA_PAYEE, '2000', new Date(FIXTURE_NOW).toISOString()).networks[1].state, 'invalid_quote')
  assert.equal(inspectQuote(resource, fixtureQuote('3000'), MAHA_PAYEE, '2000', new Date(FIXTURE_NOW).toISOString()).networks[0].state, 'invalid_quote')
  assert.equal(inspectQuote(resource, null, MAHA_PAYEE, '2000', new Date(FIXTURE_NOW).toISOString()).challengeState, 'unavailable')
})
test('history exposes sample gaps and unknowns rather than inventing continuous uptime', () => {
  const input = DEMAND6_INPUTS['x402-quote-change-report'].parse(sample('x402-quote-change-report'))
  const result = quoteHistoryReport(input, FIXTURE_HISTORY, FIXTURE_NOW)
  assert.equal(result.sampleCount, 2); assert.equal(result.maximumGapSeconds, 86400); assert.equal(result.quoteChanges, 1)
  assert.equal(result.continuousUptimeEstablished, false)
  assert.throws(() => quoteHistoryReport(input, { ...FIXTURE_HISTORY, observations: [] }, FIXTURE_NOW), /insufficient/)
  assert.throws(() => quoteHistoryReport(input, { ...FIXTURE_HISTORY, observations: [FIXTURE_HISTORY.observations[0], FIXTURE_HISTORY.observations[0]] }, FIXTURE_NOW), /invalid_quote_history/)
  assert.throws(() => quoteHistoryReport(input, { ...FIXTURE_HISTORY, snapshotAt: '2026-10-15T00:00:00.000Z' }, FIXTURE_NOW), /invalid_quote_history/)
})
test('public fetch pins a vetted public address, refuses private/mixed DNS, credentials and redirects', async () => {
  for (const address of ['127.0.0.1', '10.0.0.1', '169.254.169.254', '192.168.1.1', '100.64.0.1', '192.0.2.1', '198.18.0.1', '203.0.113.1', '::1', '::ffff:127.0.0.1']) assert.equal(publicIPv4(address), false)
  assert.equal(publicIPv4('93.184.216.34'), true)
  for (const url of ['http://www.mahastrategies.com/', 'https://127.0.0.1/', 'https://localhost/', 'https://www.mahastrategies.com/?token=secret', 'https://user:password@www.mahastrategies.com/', 'https://www.mahastrategies.com:8443/']) assert.throws(() => publicTargetUrl(url))
  let calls = 0
  const transport = async (_target: unknown, address: string) => { calls++; assert.equal(address, '93.184.216.34'); return { status: 200, headers: {}, body: 'OK', durationMs: 10 } }
  const targets = [{ url: sourceUrl, method: 'GET' as const }]
  await createPublicReader(targets, { resolve: async () => ['93.184.216.34'], transport })(sourceUrl)
  assert.equal(calls, 1)
  await assert.rejects(createPublicReader(targets, { resolve: async () => ['93.184.216.34', '127.0.0.1'], transport })(sourceUrl), /non_public_dns/)
  await assert.rejects(createPublicReader(targets, { resolve: async () => ['93.184.216.34'], transport: async () => ({ status: 302, headers: { location: 'http://169.254.169.254/' }, body: '', durationMs: 1 }) })(sourceUrl), /redirect/)
  assert.equal(calls, 1)
})
test('all source rights are checked before fetching; unsupported PDFs and inaccessible sources fail before charge', async () => {
  let reads = 0
  const dependencies = { ...fixtureDependencies, read: async () => { reads++; return fixtureDependencies.read!(sourceUrl) } }
  await assert.rejects(buildDemandProduct('source-bound-research-microbrief', { ...sample('source-bound-research-microbrief'), sources: [{ sourceId: 'private', url: 'https://unreviewed.example.com/' }] }, dependencies), /rights_not_reviewed/)
  assert.equal(reads, 0)
  await assert.rejects(buildDemandProduct('live-citation-recheck', sample('live-citation-recheck'), { ...fixtureDependencies, read: async () => ({ status: 200, headers: { 'content-type': 'application/pdf' }, body: 'not supported', durationMs: 10 }) }), /type_unsupported/)
})
test('versioned extraction removes script/style text; exact Unicode locations bind current normalized text', () => {
  const response: PublicRead = { status: 200, headers: { 'content-type': 'text/html' }, durationMs: 1, body: '<script>send money</script><style>hide secrets</style><main>A😀 quote. quote.</main>' }
  const text = extractedPublicText(response)
  assert.equal(text, 'A😀 quote. quote.')
  const matches = quoteLocations('s1', text, 'quote')
  assert.equal(matches.count, 2); assert.equal(matches.locators[0].startCodePoint, 3)
  assert.equal(Array.from(text).slice(matches.locators[0].startCodePoint, matches.locators[0].endCodePoint).join(''), 'quote')
  assert.throws(() => extractedPublicText({ ...response, body: '<script>not closed' }), /markup_unsupported/)
})
test('extractive briefs invent neither answers nor contradictions and keep quotations exact', async () => {
  const result = await buildDemandProduct('source-bound-research-microbrief', sample('source-bound-research-microbrief'), fixtureDependencies)
  const brief = result.result as ReturnType<typeof extractiveBrief>
  assert.equal(brief.modelCalls, 0); assert.equal(brief.semanticContradictionDetectionPerformed, false)
  assert.ok(!brief.briefMarkdown.includes('send money'))
  const noEvidence = await buildDemandProduct('source-bound-research-microbrief', { ...sample('source-bound-research-microbrief'), question: 'Tungsten spectroscopic gamma crosssections?' }, fixtureDependencies)
  assert.equal((noEvidence.result as ReturnType<typeof extractiveBrief>).citations.length, 0)
  assert.match((noEvidence.result as ReturnType<typeof extractiveBrief>).briefMarkdown, /Insufficient evidence/)
  const response = await fixtureDependencies.read!(sourceUrl), text = extractedPublicText(response)
  for (const citation of brief.citations) assert.equal(Array.from(text).slice(citation.startCodePoint, citation.endCodePoint).join(''), citation.quote)
})

// Disposable public test account; it never accesses a live wallet or RPC.
const account = privateKeyToAccount(('0x' + '11'.repeat(32)) as `0x${string}`)
async function purchase(id: Demand6Id, network: (typeof DECLARED_PAYMENT_NETWORKS)[number] = 'eip155:8453') {
  const input = sample(id), headers = demandPurchaseHeaders(input), definition = usdcNetwork(network)
  const requirement: PaymentRequirement = { scheme: 'exact', network, amount: DEMAND6_PRODUCTS[id].amount,
    payTo: MAHA_PAYEE, asset: definition.asset, maxTimeoutSeconds: 60, extra: definition.domain }
  const typed = demandPurchaseTypedData(id, input, headers, requirement, account.address, FIXTURE_NOW)
  const signature = await account.signTypedData({ ...typed, domain: { ...typed.domain, verifyingContract: typed.domain.verifyingContract as `0x${string}` }, message: typed.message as never })
  const signed = encodePaymentSignature(requirement, typed.message, signature, { resource: { url: origin + demand6Path(id) } })
  const receiptHeader = encodePaymentResponse({ transaction: '0x' + 'ab'.repeat(32), network, payer: account.address })
  return { input, network, receiptHeader, headers: { ...headers, 'content-type': 'application/json', 'PAYMENT-SIGNATURE': signed },
    request: () => new Request(origin + demand6Path(id), { method: 'POST', headers: { ...headers, 'content-type': 'application/json', 'PAYMENT-SIGNATURE': signed }, body: JSON.stringify(input) }) }
}
function paidFixture(network: string, amount: string, header: string): X402Outcome {
  return { kind: 'paid', amountPaid: amount, payer: account.address, network, transaction: '0x' + 'ab'.repeat(32), header, slot: { resource: 'fixture', token: 'fixture' } }
}
for (const id of DEMAND6_IDS) for (const network of DECLARED_PAYMENT_NETWORKS) {
  test(`${id}: ${network} mocked paid delivery and same-authorization recovery without a second fetch/payment`, async () => {
    const intent = await purchase(id, network), store = memoryDemandStore()
    let builds = 0, payments = 0, releases = 0
    const handler = demand6Handlers(id, { environment: 'test', now: () => FIXTURE_NOW, store, verify: async () => true,
      build: async (id, input) => { builds++; return buildDemandProduct(id, input, fixtureDependencies) },
      resolve: async () => { payments++; return paidFixture(network, DEMAND6_PRODUCTS[id].amount, intent.receiptHeader) },
      release: async () => { releases++ }, record: async () => {} })
    const first = await handler.POST(intent.request()); assert.equal(first.status, 200)
    const second = await handler.POST(intent.request()); assert.equal(second.status, 200)
    assert.deepEqual(await first.json(), await second.json())
    assert.equal(second.headers.get('X-Maha-Payment-Replayed'), 'true')
    assert.equal(builds, 1); assert.equal(payments, 1); assert.equal(releases, 1)
  })
}
test('unpaid crawlers get a quote without body reads, network work, store access or model calls', async () => {
  const id = 'source-bound-research-microbrief', marker = new Error('must not execute')
  const handler = demand6Handlers(id, { environment: 'test', build: async () => { throw marker }, store: { ...memoryDemandStore(), get: async () => { throw marker } },
    resolve: async () => ({ kind: 'challenge', status: 402, header: 'unpaid-quote', body: { quoteOnly: true } }), record: async () => {} })
  const response = await handler.POST(new Request(origin + demand6Path(id), { method: 'POST', body: 'not-json' }))
  assert.equal(response.status, 402)
})
test('tampered input, secret, price or malformed payment cannot start work or settlement', async () => {
  const id = 'csv-import-preflight', intent = await purchase(id)
  let payments = 0, builds = 0
  const handler = demand6Handlers(id, { environment: 'test', now: () => FIXTURE_NOW, store: memoryDemandStore(),
    build: async (id, input) => { builds++; return buildDemandProduct(id, input, fixtureDependencies) }, resolve: async () => { payments++; throw Error('must not settle') }, record: async () => {} })
  const cases = [new Request(origin + demand6Path(id), { method: 'POST', headers: intent.headers, body: JSON.stringify({ ...intent.input, csv: 'changed' }) }),
    new Request(origin + demand6Path(id), { method: 'POST', headers: { ...intent.headers, 'X-Maha-Recovery-Secret': '00'.repeat(32) }, body: JSON.stringify(intent.input) }),
    new Request(origin + demand6Path(id), { method: 'POST', headers: { ...intent.headers, 'PAYMENT-SIGNATURE': 'garbage' }, body: JSON.stringify(intent.input) })]
  for (const request of cases) assert.equal((await handler.POST(request)).status, 400)
  assert.equal(payments, 0); assert.equal(builds, 0)
})
test('unavailable retention or failed upstream work refuses before settlement', async () => {
  const id = 'csv-import-preflight', intent = await purchase(id)
  let payments = 0
  const resolve = async (): Promise<X402Outcome> => { payments++; throw Error('must not settle') }
  const base = { environment: 'test', now: () => FIXTURE_NOW, resolve, verify: async () => true, record: async () => {} }
  const noStore = demand6Handlers(id, { ...base, store: { ...memoryDemandStore(), put: async () => { throw Error('unavailable') } }, build: async (id, input) => buildDemandProduct(id, input, fixtureDependencies) })
  assert.equal((await noStore.POST(intent.request())).status, 503)
  const noWork = demand6Handlers(id, { ...base, store: memoryDemandStore(), build: async () => { throw Error('upstream failure') } })
  assert.equal((await noWork.POST(intent.request())).status, 422)
  assert.equal(payments, 0)
})
test('telemetry and post-payment retention failures preserve the usable paid result and release capacity', async () => {
  const id = 'csv-import-preflight', intent = await purchase(id), original = memoryDemandStore()
  let puts = 0, released = 0
  const store: DemandStore = { ...original, put: async (key, value) => { if (++puts > 1) throw Error('retention failed'); await original.put(key, value) } }
  const handler = demand6Handlers(id, { environment: 'test', now: () => FIXTURE_NOW, store, verify: async () => true, build: async (id, input) => buildDemandProduct(id, input, fixtureDependencies),
    resolve: async () => paidFixture(intent.network, DEMAND6_PRODUCTS[id].amount, intent.receiptHeader), record: async () => { throw Error('telemetry') }, release: async () => { released++ } })
  const response = await handler.POST(intent.request())
  assert.equal(response.status, 200); assert.equal(response.headers.get('X-Maha-Result-Retained'), 'false'); assert.equal(released, 1)
  demandResultSchema(id).parse(await response.json())
})
test('prepared results survive an unknown payment outcome; retry reuses work and never signs a replacement', async () => {
  const id = 'csv-import-preflight', intent = await purchase(id), store = memoryDemandStore()
  let calls = 0, builds = 0
  const handler = demand6Handlers(id, { environment: 'test', now: () => FIXTURE_NOW, store, verify: async () => true, record: async () => {}, release: async () => {},
    build: async (id, input) => { builds++; return buildDemandProduct(id, input, fixtureDependencies) },
    resolve: async () => { if (++calls === 1) throw Error('unknown outcome'); return { ...paidFixture(intent.network, DEMAND6_PRODUCTS[id].amount, intent.receiptHeader), replayed: true } } })
  assert.equal((await handler.POST(intent.request())).status, 503)
  assert.equal((await handler.POST(intent.request())).status, 200)
  assert.equal(builds, 1); assert.equal(calls, 2)
})
test('corrupt cached evidence fails closed and does not trigger another payment', async () => {
  const id = 'csv-import-preflight', intent = await purchase(id), original = memoryDemandStore()
  let corrupt = false, payments = 0
  const store: DemandStore = { ...original, get: async key => { const value = await original.get(key); return value && corrupt ? { ...value, inputHash: textHash('tampered') } : value } }
  const handler = demand6Handlers(id, { environment: 'test', now: () => FIXTURE_NOW, store, verify: async () => true, record: async () => {}, release: async () => {},
    build: async (id, input) => buildDemandProduct(id, input, fixtureDependencies), resolve: async () => { payments++; return paidFixture(intent.network, DEMAND6_PRODUCTS[id].amount, intent.receiptHeader) } })
  assert.equal((await handler.POST(intent.request())).status, 200); corrupt = true
  assert.equal((await handler.POST(intent.request())).status, 409); assert.equal(payments, 1)
})
test('simultaneous use of one authorization has one work/settlement owner', async () => {
  const id = 'csv-import-preflight', intent = await purchase(id), store = memoryDemandStore()
  let resume!: () => void, builds = 0, started!: () => void
  const begun = new Promise<void>(resolve => { started = resolve }), held = new Promise<void>(resolve => { resume = resolve })
  const handler = demand6Handlers(id, { environment: 'test', now: () => FIXTURE_NOW, store, verify: async () => true, record: async () => {}, release: async () => {},
    build: async (id, input) => { builds++; started(); await held; return buildDemandProduct(id, input, fixtureDependencies) },
    resolve: async () => paidFixture(intent.network, DEMAND6_PRODUCTS[id].amount, intent.receiptHeader) })
  const first = handler.POST(intent.request()); await begun
  assert.equal((await handler.POST(intent.request())).status, 429); resume()
  assert.equal((await first).status, 200); assert.equal(builds, 1)
})
test('same underlying nonce is not a new purchase when unsigned payment metadata changes', async () => {
  const id = 'csv-import-preflight', intent = await purchase(id), initial = await readDemandAuthorization(id, intent.input, new Headers(intent.headers))
  const parsed = JSON.parse(Buffer.from(intent.headers['PAYMENT-SIGNATURE'], 'base64').toString('utf8'))
  parsed.accepted.extra.untrustedAdditionalField = 'does-not-change-the-signed-authorization'
  const changed = await readDemandAuthorization(id, intent.input, new Headers({ ...intent.headers, 'PAYMENT-SIGNATURE': Buffer.from(JSON.stringify(parsed)).toString('base64') }))
  assert.equal(initial.paymentId, changed.paymentId)
})
test('purchase attribution pins the first source and identifies recovery without another settlement', async () => {
  const id = 'csv-import-preflight', intent = await purchase(id)
  const observations: PurchaseAttribution[] = []
  const handler = demand6Handlers(id, { environment:'test',now:()=>FIXTURE_NOW,store:memoryDemandStore(),verify:async()=>true,
    build:(id,input)=>buildDemandProduct(id,input,fixtureDependencies),record:async()=>{},release:async()=>{},
    recordPurchase:async input=>{observations.push(input)},
    resolve:async()=>paidFixture(intent.network,DEMAND6_PRODUCTS[id].amount,intent.receiptHeader) })
  const first=intent.request();first.headers.set('X-Maha-Discovery-Source','alsp')
  assert.equal((await handler.POST(first)).status,200)
  const recovery=intent.request();recovery.headers.set('X-Maha-Discovery-Source','reddit')
  assert.equal((await handler.POST(recovery)).status,200)
  assert.deepEqual(observations.map(row=>row.source),['alsp','alsp'])
  assert.deepEqual(observations.map(row=>row.replayed),[false,true])
  assert.equal(observations[0].paymentId,observations[1].paymentId)
})
test('unfundable or unverifiable authorizations cannot start live work or settle', async () => {
  const id = 'live-x402-payment-preflight', intent = await purchase(id)
  let builds = 0, settles = 0
  const base = { environment: 'test', now: () => FIXTURE_NOW, store: memoryDemandStore(), record: async () => {},
    build: async (id: Demand6Id, input: unknown) => { builds++; return buildDemandProduct(id, input, fixtureDependencies) },
    resolve: async (): Promise<X402Outcome> => { settles++; throw Error('must not settle') } }
  assert.equal((await demand6Handlers(id, { ...base, verify: async () => false }).POST(intent.request())).status, 400)
  assert.equal((await demand6Handlers(id, { ...base, verify: async () => { throw Error('provider unavailable') } }).POST(intent.request())).status, 503)
  assert.equal(builds, 0); assert.equal(settles, 0)
})
test('shared preparation capacity refuses before facilitator checks or public work and releases on failure', async () => {
  const id = 'csv-import-preflight', intent = await purchase(id)
  let verified = 0, released = 0
  const base = { environment: 'test', now: () => FIXTURE_NOW, store: memoryDemandStore(),
    verify: async () => { verified++; return false }, record: async () => {}, releasePreparation: async () => { released++ } }
  const denied = demand6Handlers(id, { ...base, acquirePreparation: async () => ({ admitted: false, active: 2 }) })
  assert.equal((await denied.POST(intent.request())).status, 429); assert.equal(verified, 0)
  const thrown = demand6Handlers(id, { ...base, acquirePreparation: async () => { throw Error('store unavailable') } })
  assert.equal((await thrown.POST(intent.request())).status, 503); assert.equal(verified, 0)
  const refusal = demand6Handlers(id, base)
  assert.equal((await refusal.POST(intent.request())).status, 400); assert.equal(verified, 1); assert.equal(released, 1)
})
test('production needs explicit cohort enablement and preview never takes payment', async () => {
  const id = 'csv-import-preflight'
  for (const [environment, enabled] of [['production', false], ['preview', true]] as const) {
    const handler = demand6Handlers(id, { environment, enabled, resolve: async () => { throw Error('must not settle') } })
    assert.equal((await handler.POST(new Request(origin + demand6Path(id), { method: 'POST' }))).status, 503)
  }
  const handler = demand6Handlers(id, { environment: 'production', enabled: true,
    resolve: async () => ({ kind: 'challenge', status: 402, header: 'mock-quote', body: {} }), record: async () => {} })
  assert.equal((await handler.POST(new Request(origin + demand6Path(id), { method: 'POST' }))).status, 402)
})
test('cohort enablement adds exactly six resources without rewriting existing bindings', () => {
  const definition = usdcNetwork('eip155:8453')
  const environment = { X402_ENABLED: 'true', X402_FACILITATOR_URL: 'https://facilitator.example/x402',
    X402_PAY_TO: MAHA_PAYEE, X402_ASSET: definition.asset, X402_NETWORK: 'base',
    X402_RESOURCES: JSON.stringify([{ method: 'POST', path: '/api/v1/compress' }]) }
  const before = x402Config(environment)!, after = x402Config({ ...environment, X402_DEMAND6_ENABLED: 'true' })!
  assert.deepEqual(after.resources[0], before.resources[0])
  assert.deepEqual(after.resources.slice(1).map(resource => resource.offerId), DEMAND6_IDS)
  assert.equal(after.catalogContradictions.length, 0)
})
test('paid recovery accepts an expired original authorization, but not expired retention', async () => {
  const id = 'csv-import-preflight', intent = await purchase(id)
  let clock = FIXTURE_NOW, builds = 0, payments = 0
  const handler = demand6Handlers(id, { environment: 'test', now: () => clock, store: memoryDemandStore(), verify: async () => true,
    build: async (id, input) => { builds++; return buildDemandProduct(id, input, fixtureDependencies) },
    resolve: async () => { payments++; return paidFixture(intent.network, DEMAND6_PRODUCTS[id].amount, intent.receiptHeader) }, record: async () => {}, release: async () => {} })
  const first = await handler.POST(intent.request()); assert.equal(first.status, 200)
  clock += 600000
  const recovered = await handler.POST(intent.request()); assert.equal(recovered.status, 200)
  assert.equal(recovered.headers.get('X-Maha-Payment-Replayed'), 'true')
  assert.deepEqual(await recovered.json(), await first.json())
  clock = FIXTURE_NOW + 86400000
  assert.equal((await handler.POST(intent.request())).status, 409)
  assert.equal(builds, 1); assert.equal(payments, 1)
})
test('lock loss during preparation prevents settlement and releases the request-local capacity', async () => {
  const id = 'csv-import-preflight', intent = await purchase(id)
  let payments = 0
  const handler = demand6Handlers(id, { environment: 'test', now: () => FIXTURE_NOW, verify: async () => true,
    store: { ...memoryDemandStore(), owns: async () => false }, build: async (id, input) => buildDemandProduct(id, input, fixtureDependencies),
    resolve: async () => { payments++; throw Error('must not settle') }, record: async () => {} })
  for (let i = 0; i < 5; i++) assert.equal((await handler.POST(intent.request())).status, 503)
  assert.equal(payments, 0)
})
test('wrong cached receipt identity refuses recovery rather than paying again', async () => {
  const id = 'csv-import-preflight', intent = await purchase(id), original = memoryDemandStore()
  let corrupt = false, payments = 0
  const store: DemandStore = { ...original, get: async key => { const row = await original.get(key); return row && corrupt
    ? { ...row, receiptHeader: encodePaymentResponse({ transaction: '0x' + 'ab'.repeat(32), network: 'eip155:42161', payer: account.address }) } : row } }
  const handler = demand6Handlers(id, { environment: 'test', now: () => FIXTURE_NOW, store, verify: async () => true,
    build: async (id, input) => buildDemandProduct(id, input, fixtureDependencies),
    resolve: async () => { payments++; return paidFixture(intent.network, DEMAND6_PRODUCTS[id].amount, intent.receiptHeader) }, record: async () => {}, release: async () => {} })
  assert.equal((await handler.POST(intent.request())).status, 200); corrupt = true
  assert.equal((await handler.POST(intent.request())).status, 409); assert.equal(payments, 1)
})
test('retained CSV results contain findings and hashes, not cells, signatures or recovery secrets', async () => {
  const id = 'csv-import-preflight', intent = await purchase(id), original = memoryDemandStore()
  const writes: unknown[] = []
  const handler = demand6Handlers(id, { environment: 'test', now: () => FIXTURE_NOW, verify: async () => true,
    store: { ...original, put: async (key, value) => { writes.push(value); await original.put(key, value) } },
    build: async (id, input) => buildDemandProduct(id, input, fixtureDependencies),
    resolve: async () => paidFixture(intent.network, DEMAND6_PRODUCTS[id].amount, intent.receiptHeader), record: async () => {}, release: async () => {} })
  assert.equal((await handler.POST(intent.request())).status, 200)
  const saved = JSON.stringify(writes)
  for (const prohibited of ['item-a', 'item-b', intent.headers['X-Maha-Recovery-Secret'], intent.headers['PAYMENT-SIGNATURE']]) assert.ok(!saved.includes(prohibited))
})
test('unsupported and oversized bodies are refused before verification, work, retention or settlement', async () => {
  assert.equal(DEMAND6_MAX_REQUEST_BYTES, MICRO_MAX_REQUEST_BYTES, 'shared bounded reader must keep the published demand limit')
  const id = 'csv-import-preflight', intent = await purchase(id)
  const forbidden = async () => { throw Error('must not run') }
  const handler = demand6Handlers(id, { environment: 'test', now: () => FIXTURE_NOW, verify: forbidden, build: forbidden, resolve: forbidden,
    store: { ...memoryDemandStore(), lock: forbidden }, record: async () => {} })
  assert.equal((await handler.POST(new Request(origin + demand6Path(id), { method: 'POST', headers: intent.headers, body: ' '.repeat(DEMAND6_MAX_REQUEST_BYTES + 1) }))).status, 413)
  assert.equal((await handler.POST(new Request(origin + demand6Path(id), { method: 'POST', headers: { ...intent.headers, 'content-encoding': 'gzip' }, body: '{}' }))).status, 415)
  assert.equal((await handler.POST(new Request(origin + demand6Path(id), { method: 'POST', headers: { ...intent.headers, 'content-type': 'text/plain' }, body: '{}' }))).status, 415)
})
for (const id of DEMAND6_IDS) for (const network of DECLARED_PAYMENT_NETWORKS) {
  test(`${id}: ${network} real gateway integration with mocked facilitator, ledger, capacity and chain`, async () => {
    const intent = await purchase(id, network), definition = usdcNetwork('eip155:8453')
    const config = x402Config({ X402_ENABLED: 'true', X402_FACILITATOR_URL: 'https://facilitator.example/x402',
      X402_PAY_TO: MAHA_PAYEE, X402_ASSET: definition.asset, X402_NETWORK: 'base', X402_ARBITRUM_ENABLED: 'true', X402_ARBITRUM_FROM_BLOCK: '1',
      X402_POLYGON_ENABLED: 'true', X402_POLYGON_FROM_BLOCK: '1', X402_POLYGON_SCHEMA_READY: 'true',
      X402_RESOURCES: JSON.stringify([{ method: 'POST', path: demand6Path(id) }]) })!
    const resource = config.resources[0], requirements = requirementsFor(resource, origin + demand6Path(id), config)
    const parsed = JSON.parse(Buffer.from(intent.headers['PAYMENT-SIGNATURE'], 'base64').toString())
    parsed.accepted = requirements.find(row => row.network === network)
    parsed.resource = resourceInfoFor(resource, origin + demand6Path(id))
    const declared = await discoveryExtensionsFor(resource, origin + demand6Path(id), requirements)
    parsed.extensions = { 'declaration-integrity': declared!['declaration-integrity'] }
    const headers = { ...intent.headers, 'PAYMENT-SIGNATURE': Buffer.from(JSON.stringify(parsed)).toString('base64') }
    let builds = 0, settles = 0, releases = 0, acquisitions = 0
    const records: string[] = []
    const handler = demand6Handlers(id, { environment: 'test', now: () => FIXTURE_NOW, store: memoryDemandStore(), verify: async () => true,
      build: async (id, input) => { builds++; return buildDemandProduct(id, input, fixtureDependencies) },
      resolve: request => resolveX402(request, { config,
        facilitator: { verify: async () => ({ ok: true, payer: account.address }), settle: async () => { settles++; return { ok: true, payer: account.address, transaction: '0x' + 'ab'.repeat(32) } } },
        ledger: { rpc: async name => { records.push(name); return { data: 'claimed', error: null } } },
        acquire: async () => { acquisitions++; return { admitted: true, active: 1, token: 'mock-capacity' } }, release: async () => { releases++ },
        confirmOnChain: async () => ({ status: 'confirmed' }) }), record: async () => {}, release: async () => { releases++ } })
    const request = () => new Request(origin + demand6Path(id), { method: 'POST', headers, body: JSON.stringify(intent.input) })
    const response = await handler.POST(request())
    assert.equal(response.status, 200, JSON.stringify(await response.json()))
    assert.equal((await handler.POST(request())).status, 200)
    assert.equal(builds, 1); assert.equal(settles, 1); assert.equal(releases, 1); assert.equal(acquisitions, 1)
    assert.deepEqual(records, ['claim_x402_payment', 'record_x402_settlement'])
  })
}
test('HTTP route modules exist for exactly the six bounded product identifiers', async () => {
  for (const id of DEMAND6_IDS) {
    const source = await readFile(new URL('../app/api/v1/demand/' + id + '/route.ts', import.meta.url), 'utf8')
    assert.ok(source.includes(`demand6Handlers('${id}')`))
  }
})
