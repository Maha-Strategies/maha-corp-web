import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { NEXT_IDS } from '../lib/x402/micro-next-contracts.ts'
import { NEXT_SAMPLES } from '../lib/x402/micro-next-samples.ts'
import { buildMicroProduct, microDigest } from '../lib/x402/micro-products.ts'

const root = resolve(import.meta.dirname, '..')
// Bind the expanded shared dispatcher as well as the unchanged twelve-product
// workload. This is not a cost measurement of the 51 expansion products.
const implementationFiles = ['lib/x402/micro-next-contracts.ts', 'lib/x402/micro-next-numerics.ts', 'lib/x402/micro-next-products.ts', 'lib/x402/micro-next-religion.ts', 'lib/x402/micro-next-samples.ts', 'lib/x402/micro-products.ts', 'lib/x402/micro-contracts.ts', 'lib/x402/micro-output-schemas.ts', 'lib/x402/micro-schema.ts', 'lib/mayon-knowledge.ts', 'lib/mayon-topics.ts', 'lib/tiruvaymoli-passage-atlas.ts', 'lib/tamil-source-atlas.ts', 'lib/x402/expansion-registry.ts', 'lib/x402/expansion-evidence.ts', 'lib/x402/expansion-commerce.ts', 'lib/x402/expansion-physical-neural.ts', 'lib/x402/expansion-research-content.ts', 'lib/x402/expansion-book-pack.ts', 'lib/x402/micro-offers.ts', 'lib/x402/micro-release.ts', 'lib/x402/micro-price-policy.ts', 'lib/x402/offers.ts', 'scripts/profile-next12.ts']
const snapshotImplementation = () => implementationFiles.map(path => ({ path, contentDigest: microDigest(readFileSync(resolve(root, path), 'utf8')) }))
const implementationFileDigests = snapshotImplementation(), implementationDigest = microDigest(implementationFileDigests)
const workloads = structuredClone(NEXT_SAMPLES)
Object.assign(workloads['unit-uncertainty-conversion'], { value: '999999999999.999999', standardUncertainty: '999999999999.999999' })
Object.assign(workloads['exact-linear-system'], { matrix: Array.from({ length: 8 }, (_, i) => Array.from({ length: 8 }, (_, j) => i === j ? '999.123456' : String(i + j + 1))), rhs: Array(8).fill('999999.123456') })
Object.assign(workloads['bracketed-polynomial-root'], { coefficientsAscending: ['-2', '0', '0', '0', '0', '0', '0', '0', '1'], lower: '0', upper: '999999999999', maxIterations: 64 })
Object.assign(workloads['covariance-uncertainty'], { sensitivities: Array(8).fill('999999.123456'), covariance: Array.from({ length: 8 }, (_, i) => Array.from({ length: 8 }, (_, j) => i === j ? '999999.123456' : '1')) })
const clause = { text: 'Synthetic bounded policy clause. '.repeat(4), scope: 'sandbox' }
Object.assign(workloads['policy-version-comparison'], { before: Array.from({ length: 40 }, (_, i) => ({ clauseId: `clause-${i}`, ...clause })), after: Array.from({ length: 40 }, (_, i) => ({ clauseId: `clause-${i}`, ...clause, scope: 'changed-scope' })) })
const gap = workloads['control-evidence-gaps'], req = (gap.requirements as object[])[0], ev = (gap.evidence as object[])[0]
Object.assign(gap, { requirements: Array.from({ length: 40 }, (_, i) => ({ ...req, controlId: `c${i}` })), evidence: Array.from({ length: 80 }, (_, i) => ({ ...ev, controlId: `c${i % 40}`, evidenceId: `e${i}` })) })
const mcp = workloads['mcp-contract-compatibility'], server = mcp.required as { tools: object[] }
const tools = Array.from({ length: 30 }, (_, i) => ({ ...server.tools[0], name: `tool-${i}` }))
mcp.required = { ...server, tools }; mcp.offered = { ...server, tools }
Object.assign(workloads['tool-permission-diff'], { before: Array.from({ length: 50 }, (_, i) => ({ tool: `tool-${i}`, action: 'read', resource: `old-${i}` })), after: Array.from({ length: 50 }, (_, i) => ({ tool: `tool-${i}`, action: 'read', resource: `new-${i}` })) })
const bundle = workloads['publication-bundle-consistency'], views = bundle.views as object[]
bundle.views = Array.from({ length: 8 }, (_, i) => ({ ...views[i % 3], viewId: `view-${i}` }))
const args = process.argv.slice(2), target = resolve(root, 'content/discovery/micro-next12-cost-observation-v10.json')
if (args.length !== 1 || !['--capture', '--check'].includes(args[0])) throw new Error('Use --capture once or --check. No build/network mode.')
if (args[0] === '--capture' && existsSync(target)) throw new Error('immutable-profile-already-exists')
if (args[0] === '--check') {
  const { digest, ...record } = JSON.parse(readFileSync(target, 'utf8'))
  if (digest !== microDigest(record) || record.implementationDigest !== implementationDigest || microDigest(record.implementationFileDigests) !== implementationDigest || record.workloadsDigest !== microDigest(workloads)) {
    const changed = implementationFileDigests.filter(f => record.implementationFileDigests?.find((p: { path: string; contentDigest: string }) => p.path === f.path)?.contentDigest !== f.contentDigest).map(f => f.path)
    throw new Error(`cost-observation-stale:${changed.join(',') || 'record-digest-or-workload'}`)
  }
} else {
  let remoteCalls = 0
  globalThis.fetch = async () => { remoteCalls++; throw new Error('network-forbidden-in-profile') }
  const observations = []
  for (const id of NEXT_IDS) {
    const coldStart = performance.now(); await buildMicroProduct(id, NEXT_SAMPLES[id]); const coldMs = performance.now() - coldStart
    const times: number[] = []; let responseBytes = 0; const cpu = process.cpuUsage()
    for (let i = 0; i < 31; i++) { const start = performance.now(); const result = await buildMicroProduct(id, workloads[id]); times.push(performance.now() - start); responseBytes = Math.max(responseBytes, Buffer.byteLength(JSON.stringify(result))) }
    const usage = process.cpuUsage(cpu); times.sort((a, b) => a - b)
    observations.push({ id, calls: 32, coldMs, cappedWorkloadP95Ms: times[29], cappedWorkloadMaxMs: times[30], cpuMicros: usage.user + usage.system, requestBytes: Buffer.byteLength(JSON.stringify(workloads[id])), responseBytes, providerCalls: 0, cloudCostUsd: null, implementationDigest })
  }
  if (remoteCalls) throw new Error('unexpected remote call')
  if (microDigest(snapshotImplementation()) !== implementationDigest) throw new Error('implementation-changed-during-capture; no artifact written')
  const body = { version: 'micro-next12-cost-observation/10', supersedes: 'micro-next12-cost-observation-v9.json', revisionReason: 'Rebind the unchanged twelve-product workloads after shared registry typing, offer typing, physical category and research/book-server fixes. Preserve v1-v9 as immutable history. Per-file hashes expose the binding scope; expansion products are not profiled by this record.', basis: 'local-process; one example and 31 capped high-size fixture repetitions per product, not an exhaustive worst-case proof, cloud billing or Vercel bill. Wall-clock timings are sensitive to uncontrolled host load and scheduling; no causal attribution to contention or guaranteed 100 ms latency.', observedAt: new Date().toISOString(), implementationFiles, implementationFileDigests, implementationDigest, workloadsDigest: microDigest(workloads), nodeVersion: process.version, observations, remoteCalls, deploymentBuilds: 0, paymentAttempts: 0, indexingPurchases: 0, cloudBillingMeasured: false, exhaustiveWorstCaseProof: false }
  writeFileSync(target, JSON.stringify({ ...body, digest: microDigest(body) }, null, 2) + '\n', { flag: 'wx' })
}
console.log('Twelve local cost observations checked; cloud cost and demand remain unknown.')
