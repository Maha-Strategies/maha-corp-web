import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { buildMicroProduct, microDigest } from '../lib/x402/micro-products.ts'
import { PLANNING_IDS, PLANNING_PRODUCTS } from '../lib/x402/micro-planning-contracts.ts'
import { PLANNING_SAMPLES } from '../lib/x402/micro-planning-samples.ts'
import { planningWorkloads } from './planning-ten-workloads.ts'
import { microExecutionAllowed } from '../lib/x402/micro-release.ts'

const root = resolve(import.meta.dirname, '..'), args = process.argv.slice(2)
if (args.length !== 1 || !['--capture', '--check'].includes(args[0])) throw new Error('Local --capture once or --check only; no remote/build/deployment mode.')
const implementationFiles = ['lib/x402/micro-planning-contracts.ts', 'lib/x402/micro-planning-products.ts', 'lib/x402/micro-planning-samples.ts', 'lib/x402/micro-contracts.ts', 'lib/x402/micro-products.ts', 'lib/x402/micro-output-schemas.ts', 'lib/x402/micro-schema.ts', 'lib/x402/micro-offers.ts', 'lib/x402/micro-route.ts', 'lib/x402/micro-release.ts', 'scripts/planning-ten-workloads.ts', 'scripts/profile-planning-ten.ts', 'lib/x402/micro-price-policy.ts', 'lib/x402/offers.ts', 'lib/x402/operator-settlement-receipts.ts']
const implementationDigest = microDigest(implementationFiles.map(path => ({ path, digest: microDigest(readFileSync(resolve(root, path), 'utf8')) })))
const buildList = PLANNING_IDS.map((id, i) => ({ position: i + 1, id, path: `/api/v1/micro/${id}`, method: 'POST', amountBaseUnits: PLANNING_PRODUCTS[id].amount, currency: 'USDC', priceStatus: 'approved-fixed-batch', status: 'release-approved-pending-deployment', payableInProduction: microExecutionAllowed(id, 'production'), maximumAllInCostFor80PercentMarginBaseUnits: String(BigInt(PLANNING_PRODUCTS[id].amount) / BigInt(5)), observedDemand: null, cloudCostUsd: null, extraGate: id === 'campaign-record-reconcile' || id === 'committee-finance-snapshot' ? 'commercial data-use and privacy review; public/synthetic non-personal metadata only' : 'product boundary review' }))
if (buildList.some(x => !x.payableInProduction)) throw new Error('approved cohort must be explicitly released')
const target = resolve(root, 'content/discovery/micro-planning-build-list-v4.json'), workloadsDigest = microDigest(planningWorkloads)
if (args[0] === '--check') {
  const { digest, ...record } = JSON.parse(readFileSync(target, 'utf8'))
  if (digest !== microDigest(record) || record.implementationDigest !== implementationDigest || record.workloadsDigest !== workloadsDigest || microDigest(record.buildList) !== microDigest(buildList)) throw new Error('planning-build-list-or-observation-stale')
} else {
  let remoteCalls = 0
  globalThis.fetch = async () => { remoteCalls++; throw new Error('network forbidden during local profile') }
  const observations = []
  for (const id of PLANNING_IDS) {
    const start = performance.now(); await buildMicroProduct(id, PLANNING_SAMPLES[id]); const coldExampleMs = performance.now() - start
    const times: number[] = []; let responseBytes = 0; const cpu = process.cpuUsage()
    for (let i = 0; i < 31; i++) { const t = performance.now(); const output = await buildMicroProduct(id, planningWorkloads[id]); times.push(performance.now() - t); responseBytes = Math.max(responseBytes, Buffer.byteLength(JSON.stringify(output))) }
    const usage = process.cpuUsage(cpu); times.sort((a, b) => a - b)
    observations.push({ id, calls: 32, coldExampleMs, cappedFixtureP95Ms: times[29], cappedFixtureMaxMs: times[30], cpuMicros: usage.user + usage.system, requestBytes: Buffer.byteLength(JSON.stringify(planningWorkloads[id])), responseBytes, providerCalls: 0, cloudCostUsd: null })
  }
  if (remoteCalls) throw new Error('unexpected remote call')
  const body = { version: 'micro-planning-build-list/4', supersedes: 'micro-planning-build-list-v3.json', revisionReason: 'Recapture against the approved combined book/evidence release. Ten approved prices and bounded workloads unchanged. Preserve v1-v3; no deployment or indexing is claimed by this local observation.', observedAt: new Date().toISOString(), basis: 'local process; one example and 31 capped-fixture repetitions per product, not exhaustive worst-case, cloud costs or demand evidence', nodeVersion: process.version, buildList, observations, implementationFiles, implementationDigest, workloadsDigest, remoteCalls, deploymentBuilds: 0, indexingPurchases: 0, deploymentHeld: true, releaseGates: ['Restore settlement backfill and freshness monitoring.', 'Review all intended local publication changes and passing release checks.', 'Approve final prices and exact release cohort.', 'Resolve campaign-data commercial-use and privacy review.', 'Explicitly approve a combined Vercel build; no automatic Git-triggered deployment.', 'Configure only the approved cohort and verify unpaid challenges before paid calls.', 'Explicitly approve a bounded publisher-funded indexing budget; record it as operator activity, not organic demand.', 'Confirm confirmed settlement, delivered receipt, public discovery and ongoing freshness.'] }
  writeFileSync(target, JSON.stringify({ ...body, digest: microDigest(body) }, null, 2) + '\n', { flag: 'wx' })
}
console.log('Ten prices, build-list entries and local observations checked. Local release approval recorded; deployment and indexing have not been performed.')
