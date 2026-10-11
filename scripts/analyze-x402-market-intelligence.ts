import { createHash } from 'node:crypto'
import { setDefaultResultOrder } from 'node:dns'
import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { categoryProfile, fetchMerchantPages, merchantSignals, rankInFrozenCohort, sellerCohort,
  snapshotAge, validateDataset } from './lib/x402-market-intelligence.ts'

setDefaultResultOrder('ipv4first')
const dir = process.argv[process.argv.indexOf('--dir') + 1]
if (!process.argv.includes('--dir') || !dir) throw new Error('Provide --dir with the purchased artifacts directory.')
const HOST = 'www.mahastrategies.com'
const raw = await readFile(join(dir, 'dataset.json'))
const data = validateDataset(JSON.parse(raw.toString('utf8')))
const reportRaw = await readFile(join(dir, 'report.json'))
const report = JSON.parse(reportRaw.toString('utf8'))
const evidence = JSON.parse(await readFile(join(dir, 'purchase-evidence.json'), 'utf8'))
for (const [product, bytes] of [['dataset', raw], ['report', reportRaw]] as const) {
  const payment = evidence.purchases.find((p: { product: string }) => p.product === product)
  if (payment?.state !== 'delivered_and_chain_confirmed' || payment.responseSha256 !== createHash('sha256').update(bytes).digest('hex')) throw new Error('Purchased artifact is unconfirmed or no longer matches its receipt.')
}
if (data.receipt.snapshotHash !== report.receipt?.snapshotHash) throw new Error('Report and dataset refer to different market snapshots.')

const checkedAt = new Date().toISOString()
const cohort = sellerCohort(data.services)
const maha = data.services.filter(s => new URL(s.u).hostname === HOST)
const profiles = ['context-compression', 'rag', 'evidence', 'research', 'calculator', 'security', 'analytics', 'books', 'physical-ai', 'neural-interface']
  .map(tag => categoryProfile(data.services, tag, HOST))
const ownSnapshot = cohort.find(s => s.host === HOST)
const summary = {
  schemaVersion: 'maha-market-intelligence-analysis/1.0', checkedAt,
  provenance: { source: 'P0 export of Coinbase Bazaar', sourceSnapshotAt: data.receipt.snapshotGeneratedAt,
    snapshotHash: data.receipt.snapshotHash, datasetSha256: createHash('sha256').update(raw).digest('hex'),
    reportSha256: createHash('sha256').update(reportRaw).digest('hex'), purchaseRun: evidence.runId,
    ...snapshotAge(data.receipt.snapshotGeneratedAt, Date.parse(checkedAt)) },
  market: { resources: data.count, sellerHosts: cohort.length,
    mostListedSellers: [...cohort].sort((a, b) => b.resources - a.resources).slice(0, 5),
    mostCalledSellers: cohort.slice(0, 10) },
  mahaHistoricalSnapshot: { ...ownSnapshot, missingServiceNames: maha.filter(s => !s.n.trim()).map(s => ({ resource: s.u, description: s.d })),
    rank: rankInFrozenCohort(data.services, HOST),
    excludingAssistedTestScenario: rankInFrozenCohort(data.services, HOST, (ownSnapshot?.calls30dKnown ?? 0) - (maha.find(s => s.u.endsWith('/cabezon/buyer-brief'))?.c ?? 0)),
    hypothetical140CallsScenario: rankInFrozenCohort(data.services, HOST, 140) },
  categoryBenchmarks: profiles,
  limitations: ['Rank is reconstructed within this frozen cohort, not a published current ranking.',
    'All third-party call counts can include operator traffic; they do not measure organic customers.',
    'Per-resource wallet counts cannot be summed as distinct seller customers.',
    'Price times calls is not earned revenue or profitability.',
    'Category medians do not normalize output scope, quality or variable per-token pricing.',
    'The source snapshot, not generatedAt on the purchased response, determines data freshness.'],
  live: null as unknown,
  recommendedActions: [
    { priority: 1, action: 'Persist source snapshot timestamp/hash separately from purchase time; suppress current-rank and organic-growth claims from stale snapshots.' },
    { priority: 2, action: 'Compare listing names against live declarations before refreshing the 14 historical unnamed resources; do not blindly repay.' },
    { priority: 3, action: 'Use paginated merchant coverage and retain unknown quality metrics as unknown rather than zero.' },
    { priority: 4, action: 'Benchmark against distinct sellers and inspect market concentration before choosing prices; do not price-match bulk endpoint farms.' },
    { priority: 5, action: 'Test repeat-use context/evidence workflows first. Keep current prices until scope, execution cost and external conversion evidence justify a change.' },
  ],
}

if (process.argv.includes('--live')) {
  // Only these public, unpaid observations. No signer or payment library is imported.
  const merchantUrl = 'https://api.cdp.coinbase.com/platform/v2/x402/discovery/merchant?payTo=0xec84c1cd6602bbe387bc8e6f0d3c062f2762de28'
  const rows = await fetchMerchantPages(merchantUrl)
  const manifestResponse = await fetch(`https://${HOST}/.well-known/x402-public-manifest.json`, { redirect: 'error', signal: AbortSignal.timeout(30000) })
  if (!manifestResponse.ok) throw new Error('Public manifest unavailable.')
  const manifest = await manifestResponse.json() as { offers?: Array<{ status: string; canonicalResource: string; payment: { protocol: string; amountBaseUnits: string } }> }
  if (!Array.isArray(manifest.offers)) throw new Error('Invalid public manifest.')
  const priorResources = new Set(maha.map(s => s.u))
  // Existing higher-price listings remain covered. Five deliberately unindexed
  // higher-price offers do not become misleading emergency refresh requests.
  const expected = manifest.offers.filter(o => o.status === 'active' && o.payment.protocol === 'x402'
    && (BigInt(o.payment.amountBaseUnits) <= BigInt(390000) || priorResources.has(o.canonicalResource))).map(o => o.canonicalResource)
  if (expected.length > 128 || new Set(expected).size !== expected.length) throw new Error('Unexpected watch inventory.')
  const signals = merchantSignals(rows, expected, Date.now())
  const nameGaps = signals.observations.filter(s => s.nameMissing)
  summary.live = { checkedAt: new Date().toISOString(), ...signals,
    indexPolicy: 'Current active offers up to 0.39 USDC plus previously indexed higher-priced offers; no paid refreshes.',
    listingNameGaps: nameGaps.map(s => ({ resource: s.resource,
      sourceAlreadyNamesIt: null as boolean | null, publishedName: null as string | null })) }
  // A route's own declaration can already contain its name. Distinguish
  // crawler/index loss from missing publisher metadata before proposing a fix.
  for (const gap of (summary.live as { listingNameGaps: Array<{ resource: string; sourceAlreadyNamesIt: boolean | null; publishedName: string | null }> }).listingNameGaps) {
    const response = await fetch(gap.resource, { redirect: 'error', method: 'POST',
      headers: { 'content-type': 'application/json' }, body: '{}', signal: AbortSignal.timeout(15000) })
    const header = response.headers.get('payment-required')
    if (response.status === 402 && header) {
      const challenge = JSON.parse(Buffer.from(header, 'base64').toString('utf8'))
      const name = challenge.resource?.serviceName
      gap.publishedName = typeof name === 'string' ? name : null
      gap.sourceAlreadyNamesIt = typeof name === 'string' && !!name.trim()
    }
  }
  await writeFile(join(dir, 'live-merchant-baseline.json'), JSON.stringify(summary.live, null, 2) + '\n', { mode: 0o600 })
}
await writeFile(join(dir, 'infrastructure-analysis.json'), JSON.stringify(summary, null, 2) + '\n', { mode: 0o600 })
console.log(JSON.stringify({ sourceSnapshotAt: summary.provenance.sourceSnapshotAt, freshness: summary.provenance.freshness,
  marketResources: data.count, marketSellerHosts: cohort.length, historicalMaha: summary.mahaHistoricalSnapshot,
  categoryBenchmarks: profiles, live: summary.live ? { ...(summary.live as object), observations: undefined } : null,
  output: join(dir, 'infrastructure-analysis.json') }, null, 2))
