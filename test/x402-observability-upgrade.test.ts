import assert from 'node:assert/strict'
import test from 'node:test'
import { encodeAbiParameters, encodeEventTopics } from 'viem'
import { readMerchantResources, validateExpectedInventory, INTENTIONALLY_UNINDEXED_OFFERS } from '../lib/x402/merchant-catalog.ts'
import { runInactivityWatch, shouldFailInactivityWatch } from '../scripts/run-bazaar-inactivity-watch.ts'
import { MAHA_PAYEE, OPERATOR_WALLETS } from '../lib/x402/discovery-payment-recipe.ts'
import { payableOffers, offerById } from '../lib/x402/offers.ts'
import { DISCOVERY_PROBLEM_COPY } from '../lib/x402/discovery-problem-copy.ts'
import { MICRO_PRODUCTS } from '../lib/x402/micro-contracts.ts'
import { compareCatalogueSnapshots, observeProduct } from '../lib/x402/product-observations.ts'
import { summarizeProductUsage, unavailableUsage } from '../lib/x402/product-usage.ts'
import { usdcNetwork, DECLARED_PAYMENT_NETWORKS, type UsdcNetwork } from '../lib/x402/networks.ts'
import { TRANSFER_EVENT, AUTHORIZATION_EVENT, classifyTransferMechanism, inspectTransferEvidence,
  type ObservedTransfer, type ReceiptEvidence } from '../lib/x402/settlement-authorization.ts'
import { DEMAND_FEED_URL, readFreeTanodQuery, readFreeTanodDomain, readFreeTanodHistory,
  summarizeDemandFeed, summarizeTanodQuery, summarizeTanodDomain, summarizeTanodHistory } from '../lib/x402/external-signals.ts'

const at = '2026-10-12T06:00:00Z', origin = 'https://www.mahastrategies.com'
const now = Date.parse(at)
function pages(rows: unknown[], mutate?: (body: Record<string, unknown>, offset: number) => void): typeof fetch {
  return (async input => {
    const offset = Number(new URL(String(input)).searchParams.get('offset'))
    const body = { payTo: MAHA_PAYEE, resources: rows.slice(offset, offset + 100), pagination: { total: rows.length, offset } }
    mutate?.(body, offset)
    return Response.json(body)
  }) as typeof fetch
}
test('150, 250 and 1000-row inventories are completely paginated, including object URLs', async () => {
  for (const count of [150, 250, 1000]) {
    const rows = Array.from({ length: count }, (_, i) => ({ resource: i % 2 ? { url: `${origin}/api/v1/${i}` } : `${origin}/api/v1/${i}` }))
    assert.equal((await readMerchantResources('https://discovery.test/merchant', { fetchImpl: pages(rows), expectedPayTo: MAHA_PAYEE })).length, count)
  }
})
test('truncated, duplicate, changing and wrong-merchant observations fail closed', async () => {
  const rows = Array.from({ length: 150 }, (_, i) => ({ resource: `${origin}/api/v1/${i}` }))
  for (const mutate of [
    (b: Record<string, unknown>, offset: number) => { if (offset) b.resources = [] },
    (b: Record<string, unknown>, offset: number) => { if (offset) (b.resources as unknown[])[0] = rows[0] },
    (b: Record<string, unknown>, offset: number) => { if (offset) b.pagination = { total: 149, offset } },
    (b: Record<string, unknown>) => { b.payTo = '0xwrong' },
  ]) await assert.rejects(readMerchantResources('https://discovery.test/merchant', { fetchImpl: pages(rows, mutate), expectedPayTo: MAHA_PAYEE }))
})
test('inventory ceiling allows 150 but rejects duplicates, empty and unbounded inventories', () => {
  validateExpectedInventory(Array.from({ length: 150 }, (_, i) => `${origin}/${i}`))
  for (const rows of [[], ['same', 'same'], Array.from({ length: 1001 }, (_, i) => `${origin}/${i}`)]) assert.throws(() => validateExpectedInventory(rows))
})
test('malformed activity metrics are unavailable, not negative calls or fresh timestamps', async () => {
  const rows = await readMerchantResources('https://discovery.test/merchant', { fetchImpl: pages([
    { resource, quality: { l30DaysTotalCalls: -1, l30DaysUniquePayers: 1.5, lastCalledAt: 'not-a-clock', injectedField: 'ignore' } },
  ]) })
  assert.equal(rows[0].quality, undefined)
})
test('inactivity covers every expected listing on page two and separates deliberately unindexed offers', async () => {
  const expected = payableOffers().filter(offer => !INTENTIONALLY_UNINDEXED_OFFERS.has(offer.id))
  assert.equal(expected.length, 156)
  const rows = expected.map(offer => ({ resource: origin + offer.path, quality: { lastCalledAt: at, l30DaysTotalCalls: 1, l30DaysUniquePayers: 1 } }))
  const report = await runInactivityWatch(now, pages(rows))
  assert.equal(report.catalogueComplete, true); assert.equal(report.observedResources, 156)
  assert.equal(report.level, 'ok'); assert.equal(report.reports.length, 156)
  assert.equal(report.notRequestedOfferIds.length, 5)
  await assert.rejects(runInactivityWatch(now, pages(rows, (b, offset) => { if (offset) b.resources = [] })))
})
test('a warning does not hide an unknown listing or prematurely close an incident', async () => {
  const expected = payableOffers().filter(offer => !INTENTIONALLY_UNINDEXED_OFFERS.has(offer.id))
  const report = await runInactivityWatch(now, pages(expected.slice(1).map((offer, i) => ({ resource: origin + offer.path,
    quality: { lastCalledAt: i === 0 ? '2026-09-25T21:02:49.377Z' : at } }))))
  assert.equal(report.level, 'warn')
  assert.equal(shouldFailInactivityWatch(report.reports), true)
  const warningsOnly = report.reports.filter(row => row.level !== 'unknown')
  assert.equal(shouldFailInactivityWatch(warningsOnly), false)
  assert.equal(shouldFailInactivityWatch(warningsOnly, true), true)
})
test('problem-focused copy changes no price, route, launch status or offline boundaries', () => {
  for (const [id, copy] of Object.entries(DISCOVERY_PROBLEM_COPY)) {
    const offer = offerById(id)!, original = MICRO_PRODUCTS[id as keyof typeof MICRO_PRODUCTS]
    assert.equal(offer.description, copy); assert.equal(offer.amount, original.amount)
    assert.equal(offer.status, 'available'); assert.ok(copy.length <= 512)
    assert.match(copy, /no |not |does not/i)
  }
  assert.match(DISCOVERY_PROBLEM_COPY['audit-export-normalizer'], /no CSV parsing/)
})

const offer = offerById('x402-challenge-sanity')!
const resource = origin + offer.path
const index = { available: true, complete: true, checkedAt: at, resources: [resource] }
type MutableQuote = { x402Version: number; resource: { url: string }; accepts: { scheme: string; network: string;
  amount: string; asset: string; payTo: string; maxTimeoutSeconds: number; extra: { name: string; version: string } }[] }
function quote(mutator?: (challenge: MutableQuote) => void) {
  const challenge: MutableQuote = { x402Version: 2, resource: { url: resource }, accepts: DECLARED_PAYMENT_NETWORKS.map(network => ({
    scheme: 'exact', network, amount: offer.amount, asset: usdcNetwork(network).asset, payTo: MAHA_PAYEE,
    maxTimeoutSeconds: 300, extra: usdcNetwork(network).domain,
  })) }
  mutator?.(challenge)
  return new Response('', { status: 402, headers: { 'PAYMENT-REQUIRED': Buffer.from(JSON.stringify(challenge)).toString('base64') } })
}
test('listing, quotes on declared chains, and unobserved delivery remain independent', async () => {
  const report = await observeProduct(offer, index, quote(), unavailableUsage())
  assert.equal(report.listing.state, 'observed')
  assert.deepEqual(report.payability.networks.map(row => row.status), DECLARED_PAYMENT_NETWORKS.map(() => 'valid_quote'))
  assert.equal(report.payability.settlementTestPerformed, false)
  assert.equal(report.delivery.state, 'unknown'); assert.equal(report.delivery.successfulResponses, null)
  assert.equal(report.delivery.buyerReceiptProven, false); assert.equal(report.automaticRefreshPayments, false)
})
test('wrong assets, prices, domains and missing chains cannot be called payable', async () => {
  for (const mutate of [
    (c: MutableQuote) => { c.accepts[1].asset = c.accepts[0].asset },
    (c: MutableQuote) => { c.accepts[1].amount = '999' },
    (c: MutableQuote) => { c.accepts[1].extra = { name: 'USDC', version: '1' } },
  ]) assert.equal((await observeProduct(offer, index, quote(mutate))).payability.networks[1].status, 'invalid_quote')
  assert.equal((await observeProduct(offer, index, quote(c => c.accepts.splice(1, 1)))).payability.networks[1].status, 'not_offered')
  assert.equal((await observeProduct(offer, index, quote(c => c.accepts.pop()))).payability.networks[2].status, 'not_offered')
  assert.equal((await observeProduct(offer, index, null)).payability.networks[0].status, 'unknown')
})
test('only complete ordered snapshots report catalogue changes; absence never authorizes payment', () => {
  const previous = { ...index, checkedAt: '2026-10-11T00:00:00Z', resources: [resource + '-old'] }
  assert.deepEqual(compareCatalogueSnapshots(previous, index).noLongerObserved, [resource + '-old'])
  assert.equal(compareCatalogueSnapshots({ ...previous, complete: false }, index).comparable, false)
  assert.equal(compareCatalogueSnapshots({ ...previous, checkedAt: '2026-10-13T00:00:00Z' }, index).comparable, false)
  assert.equal(compareCatalogueSnapshots({ ...previous, resources: [resource, resource] }, index).comparable, false)
  assert.equal(compareCatalogueSnapshots(previous, index).automaticRefreshPayments, false)
})
test('settlement attribution is separate from listing, quotes and server responses', async () => {
  const report = await observeProduct(offer, index, quote(), undefined, {
    available: true, observedAt: at, priceMatchingTransfers: 2, externalIncludingAssisted: 1, operatorTransfers: 1,
  })
  assert.equal(report.settlement.state, 'amount_attributed_transfers')
  assert.equal(report.settlement.priceMatchingTransfers, 2)
  assert.equal(report.settlement.routeOrPurchaseProven, false)
  assert.equal(report.delivery.state, 'unknown')
  const stale = await observeProduct(offer, index, quote(), undefined, {
    available: false, observedAt: at, priceMatchingTransfers: 2, externalIncludingAssisted: 1, operatorTransfers: 1,
  })
  assert.equal(stale.settlement.state, 'unknown')
  assert.equal(stale.settlement.priceMatchingTransfers, null)
})
test('recorded server success is not proof of buyer delivery; empty meters are not zero fulfillment', async () => {
  const usage = summarizeProductUsage([{ offer_id: offer.id, event_kind: 'invocation', status_class: '2xx', discovery_source: 'maha_canary',
    event_count: 1, first_observed_at: at, last_observed_at: at }], [offer.id])
  const report = await observeProduct(offer, index, quote(), usage)
  assert.equal(report.delivery.successfulResponses, 1); assert.equal(report.delivery.declaredOperatorResponses, 1)
  assert.equal(report.delivery.buyerReceiptProven, false)
  assert.equal((await observeProduct(offer, index, quote(), summarizeProductUsage([], [offer.id]))).delivery.successfulResponses, null)
})

const payer = '0x1111111111111111111111111111111111111111', other = '0x2222222222222222222222222222222222222222'
const hash = ('0x' + 'ab'.repeat(32)) as `0x${string}`, nonce = ('0x' + 'cd'.repeat(32)) as `0x${string}`
const row: ObservedTransfer = { payer, amountBaseUnits: BigInt(3500), blockNumber: BigInt(100), transactionHash: hash, logIndex: 2 }
function receipt(network: UsdcNetwork = 'eip155:8453', authorizer: `0x${string}` = payer): ReceiptEvidence {
  return { transactionHash: hash, blockNumber: BigInt(100), status: 'success', logs: [
    { address: usdcNetwork(network).asset, topics: encodeEventTopics({ abi: [AUTHORIZATION_EVENT], eventName: 'AuthorizationUsed', args: { authorizer, nonce } }) as string[], data: '0x', logIndex: 1 },
    { address: usdcNetwork(network).asset, topics: encodeEventTopics({ abi: [TRANSFER_EVENT], eventName: 'Transfer', args: { from: payer, to: MAHA_PAYEE } }) as string[],
      data: encodeAbiParameters([{ type: 'uint256' }], [BigInt(3500)]), logIndex: 2 },
  ] }
}
test('native USDC Transfer plus matching AuthorizationUsed is EIP-3009-style on each declared chain', () => {
  for (const network of DECLARED_PAYMENT_NETWORKS) assert.equal(classifyTransferMechanism(row, receipt(network), network).kind, 'eip3009_style')
})
test('wrong payer/contract authorization does not turn a plain transfer into x402', () => {
  assert.equal(classifyTransferMechanism(row, receipt('eip155:8453', other), 'eip155:8453').kind, 'plain_usdc_transfer')
  const r = receipt(); r.logs[0].address = other
  assert.equal(classifyTransferMechanism(row, r, 'eip155:8453').kind, 'plain_usdc_transfer')
  assert.equal(classifyTransferMechanism(row, receipt('eip155:42161'), 'eip155:8453').kind, 'unknown')
})
test('unavailable, reverted, mismatched, malformed and batched evidence stays unknown', () => {
  const r = receipt()
  for (const bad of [null, { ...r, status: 'reverted' }, { ...r, blockNumber: BigInt(101) }, { ...r, transactionHash: '0x' + 'ff'.repeat(32) },
    { ...r, logs: [r.logs[0], { ...r.logs[1], logIndex: 3 }] },
    { ...r, logs: [r.logs[0], r.logs[1], { ...r.logs[1], logIndex: 4 }] },
    { ...r, logs: [{ ...r.logs[0], topics: [r.logs[0].topics[0]] }, r.logs[1]] },
  ]) assert.equal(classifyTransferMechanism(row, bad, 'eip155:8453').kind, 'unknown')
})
test('receipt requests are bounded/cached; known operators and assisted tests remain separate', async () => {
  let requests = 0
  const rows = [row, { ...row, payer: OPERATOR_WALLETS[0], transactionHash: '0x' + '01'.repeat(32) },
    { ...row, transactionHash: '0xa65221eb50ada8a92cee0759a6a340644cb8ffcbb36e1b0fc369adbeaaba0601', payer: '0x5b953a66eb0826c13ca2af80e0c36557cc6a1a96', amountBaseUnits: BigInt(20000000) }]
  const report = await inspectTransferEvidence(rows, 'eip155:8453', async () => { requests++; return null }, 2)
  assert.equal(requests, 2); assert.equal(report.external.transfers, 1)
  assert.equal(report.operator.transfers, 1); assert.equal(report.assistedTests.transfers, 1)
  assert.equal(report.classificationComplete, false); assert.equal(report.customerRevenueEstablished, false)
  await assert.rejects(inspectTransferEvidence([row, row], 'eip155:8453', null))
})

const feed = { generated_at_iso: at, window_starts_at_iso: '2026-09-12T00:00:00Z', window_ends_at_iso: '2026-10-05T06:00:00Z',
  covered_days: 23, delay_hours: 168, top_needs: [{ q: 'x402 endpoint reliability uptime data', distinct_days: 2, buyer_client_ips: 5,
    searches: 11, catalogue_status: 'checked', catalogue_top: [{ name: 'Existing competitor' }] }],
  named_listing_lookups: [{ q: 'test traffic', searches: 9999 }], scripted_rotation: [{ q: 'settlement ledger', searches: 9999 }] }
test('demand feed preserves source delay, competitors and scope gaps without treating IPs as buyers', () => {
  const report = summarizeDemandFeed(feed, now)
  assert.equal(report.source, DEMAND_FEED_URL); assert.equal(report.delayHours, 168)
  assert.equal(report.needs.length, 1); assert.equal(report.needs[0].buyerClientIps, 5)
  assert.deepEqual(report.needs[0].matchedListingNames, ['Existing competitor'])
  assert.match(report.needs[0].scopeBoundaries[0], /not an uptime/)
  assert.equal(report.buyerCountEstablished, false); assert.equal(report.unmetDemandEstablished, false)
  assert.equal(report.automaticPriceChanges, false)
  assert.throws(() => summarizeDemandFeed({ ...feed, generated_at_iso: '2026-10-13T00:00:00Z' }, now))
  assert.throws(() => summarizeDemandFeed({ ...feed, window_ends_at_iso: '2026-10-12T05:00:00Z' }, now))
})
test('free Tanod query stops at 402 and never submits payment or private inputs', async () => {
  let calls = 0
  const result = await readFreeTanodQuery((async (url, options) => {
    calls++; assert.equal(new URL(String(url)).hostname, 'tanod.dev')
    assert.equal(new Headers(options?.headers).get('X-Tanod-Free'), '1')
    assert.equal(new Headers(options?.headers).has('PAYMENT-SIGNATURE'), false)
    assert.deepEqual(JSON.parse(String(options?.body)), { q: 'mahastrategies' })
    return new Response('', { status: 402 })
  }) as typeof fetch)
  assert.equal(calls, 1); assert.equal(result.status, 'free_allowance_unavailable'); assert.equal(result.paymentsMade, 0)
})
test('partial/older Tanod census remains partial and never proves delivery or absence', () => {
  const report = summarizeTanodQuery({ has_more: true, records: [{ url: resource, name: 'Maha', source: 'cdp_bazaar', network: 'eip155:8453',
    first_seen: '2026-10-07T00:00:00Z', last_seen: '2026-10-12T04:00:00Z' }] }, now)
  assert.equal(report.complete, false); assert.equal(report.records[0].ageHours, 2)
  assert.equal(report.independentlyVerifiedDelivery, false)
})
test('free domain/history diagnostics use only fixed public targets and stop on payment requests', async () => {
  const calls: string[] = []
  const fetcher = (async (url, options) => {
    calls.push(new URL(String(url)).pathname)
    assert.equal(new Headers(options?.headers).get('X-Tanod-Free'), '1')
    assert.equal(new Headers(options?.headers).has('PAYMENT-SIGNATURE'), false)
    const body = JSON.parse(String(options?.body))
    assert.deepEqual(body, calls.length === 1 ? { domain: 'mahastrategies.com', checks: ['dns', 'tls'] }
      : { url: origin + '/api/v1/compress' })
    return new Response('', { status: 402 })
  }) as typeof fetch
  assert.equal((await readFreeTanodDomain(fetcher)).status, 'free_allowance_unavailable')
  assert.equal((await readFreeTanodHistory(fetcher)).status, 'free_allowance_unavailable')
  assert.deepEqual(calls, ['/v1/domain/inspect', '/v1/agents/history'])
})
test('third-party DNS/TLS and presence history are observations, not security/delivery proof', () => {
  const domain = { domain: 'mahastrategies.com', checks: ['dns', 'tls'], dns: { a: ['public-address'], ns: ['public-nameserver'] },
    tls: { reachable: true, trusted: true, certificate: { covers_domain: true, not_after: '2026-10-14T06:00:00Z', days_remaining: 999 } } }
  const report = summarizeTanodDomain(domain, now)
  assert.equal(report.tls.daysRemaining, 2)
  assert.equal(report.dns.mailExchangers, null)
  assert.equal(report.independentSecurityClearance, false)
  assert.throws(() => summarizeTanodDomain({ ...domain, domain: 'private.example' }, now))
  const history = { count: 1, records: [{ url: origin + '/api/v1/compress', first_seen: '2026-10-07T00:00:00Z',
    last_seen: '2026-10-12T04:00:00Z', current_price_usd: 0.001, history: [{ date: '2026-10-07', price_usd: 0.001 }] }] }
  const presence = summarizeTanodHistory(history, now)
  assert.equal(presence.records[0].ageHours, 2)
  assert.equal(presence.successfulPaymentOrDeliveryEstablished, false)
  assert.throws(() => summarizeTanodHistory({ ...history, count: 99 }, now))
})
test('free third-party response bodies are bounded before JSON parsing', async () => {
  await assert.rejects(readFreeTanodQuery((async () => new Response('x'.repeat(262145))) as typeof fetch), /oversized_tanod_body/)
})
