import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { buildMicroProduct, microDigest } from '../lib/x402/micro-products.ts'
import { PLANNING_IDS, PLANNING_PRODUCTS } from '../lib/x402/micro-planning-contracts.ts'
import { PLANNING_SAMPLES } from '../lib/x402/micro-planning-samples.ts'
import { planningWorkloads } from './planning-ten-workloads.ts'
import { microExecutionAllowed } from '../lib/x402/micro-release.ts'

const root = resolve(import.meta.dirname, '..'), args = process.argv.slice(2)
if (args.length !== 1 || !['--capture', '--check'].includes(args[0])) throw new Error('Local --capture once or --check only; no remote/build/deployment mode.')
// These file hashes cover shared expansion dispatch, not expansion workloads.
const implementationFiles = ['lib/x402/micro-planning-contracts.ts', 'lib/x402/micro-planning-products.ts', 'lib/x402/micro-planning-samples.ts', 'lib/x402/micro-contracts.ts', 'lib/x402/micro-products.ts', 'lib/x402/micro-output-schemas.ts', 'lib/x402/micro-schema.ts', 'lib/x402/micro-offers.ts', 'lib/x402/micro-route.ts', 'lib/x402/micro-release.ts', 'scripts/planning-ten-workloads.ts', 'scripts/profile-planning-ten.ts', 'lib/x402/micro-price-policy.ts', 'lib/x402/offers.ts', 'lib/x402/compiler-current-price.ts', 'lib/x402/operator-settlement-receipts.ts', 'lib/x402/expansion-registry.ts', 'lib/x402/expansion-evidence.ts', 'lib/x402/expansion-commerce.ts', 'lib/x402/expansion-physical-neural.ts', 'lib/x402/expansion-research-content.ts', 'lib/x402/expansion-book-pack.ts']
const snapshotImplementation = () => implementationFiles.map(path => ({ path, digest: microDigest(readFileSync(resolve(root, path), 'utf8')) }))
const implementationFileDigests = snapshotImplementation(), implementationDigest = microDigest(implementationFileDigests)
const buildList = PLANNING_IDS.map((id, i) => ({ position: i + 1, id, path: `/api/v1/micro/${id}`, method: 'POST', amountBaseUnits: PLANNING_PRODUCTS[id].amount, currency: 'USDC', priceStatus: 'approved-fixed-batch', status: 'release-approved-pending-deployment', payableInProduction: microExecutionAllowed(id, 'production'), maximumAllInCostFor80PercentMarginBaseUnits: String(BigInt(PLANNING_PRODUCTS[id].amount) / BigInt(5)), observedDemand: null, cloudCostUsd: null, extraGate: id === 'campaign-record-reconcile' || id === 'committee-finance-snapshot' ? 'commercial data-use and privacy review; public/synthetic non-personal metadata only' : 'product boundary review' }))
if (buildList.some(x => !x.payableInProduction)) throw new Error('approved cohort must be explicitly released')
const target = resolve(root, 'content/discovery/micro-planning-build-list-v9.json'), workloadsDigest = microDigest(planningWorkloads)
if (args[0] === '--capture' && existsSync(target)) throw new Error('immutable-profile-already-exists')
if (args[0] === '--check') {
  const { digest, ...record } = JSON.parse(readFileSync(target, 'utf8'))
  if (digest !== microDigest(record) || record.implementationDigest !== implementationDigest || microDigest(record.implementationFileDigests) !== implementationDigest || record.workloadsDigest !== workloadsDigest || microDigest(record.buildList) !== microDigest(buildList)) {
    const changed = implementationFileDigests.filter(f => record.implementationFileDigests?.find((p: { path: string; digest: string }) => p.path === f.path)?.digest !== f.digest).map(f => f.path)
    throw new Error(`planning-build-list-or-observation-stale:${changed.join(',') || 'record-digest-workload-or-build-list'}`)
  }
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
  if (microDigest(snapshotImplementation()) !== implementationDigest) throw new Error('implementation-changed-during-capture; no artifact written')
  const body = { version: 'micro-planning-build-list/9', supersedes: 'micro-planning-build-list-v8.json', revisionReason: 'Rebind the unchanged ten-product prices and workloads after the owner-approved compiler repricing changed shared catalogue declarations. Preserve v1-v8 as immutable history. This local measurement does not claim science profiling, production deployment or indexing.', observedAt: new Date().toISOString(), basis: 'local process; one example and 31 capped-fixture repetitions per product, not an exhaustive worst-case proof, cloud billing, cloud costs or demand evidence. Wall-clock timings are sensitive to uncontrolled host load and scheduling; no causal attribution to contention or guaranteed latency.', nodeVersion: process.version, buildList, observations, implementationFiles, implementationFileDigests, implementationDigest, workloadsDigest, remoteCalls, deploymentBuilds: 0, paymentAttempts: 0, indexingPurchases: 0, cloudBillingMeasured: false, exhaustiveWorstCaseProof: false, deploymentHeld: true, releaseGates: ['Restore settlement backfill and freshness monitoring.', 'Review all intended local publication changes and passing release checks.', 'Approve final prices and exact release cohort.', 'Resolve campaign-data commercial-use and privacy review.', 'Explicitly approve a combined Vercel build; no automatic Git-triggered deployment.', 'Configure only the approved cohort and verify unpaid challenges before paid calls.', 'Explicitly approve a bounded publisher-funded indexing budget; record it as operator activity, not organic demand.', 'Confirm confirmed settlement, delivered receipt, public discovery and ongoing freshness.'] }
  writeFileSync(target, JSON.stringify({ ...body, digest: microDigest(body) }, null, 2) + '\n', { flag: 'wx' })
}
console.log('Ten prices, build-list entries and local observations checked. Local release approval recorded; deployment and indexing have not been performed.')
