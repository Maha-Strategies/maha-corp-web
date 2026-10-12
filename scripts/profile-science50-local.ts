import { readFileSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { SCIENCE_IDS, SCIENCE_SAMPLES, SCIENCE_PRODUCTS } from '../lib/x402/science/contracts.ts'
import { buildMicroProduct, microDigest } from '../lib/x402/micro-products.ts'
const args = process.argv.slice(2)
if (args.length !== 1 || !['--write', '--check'].includes(args[0])) throw new Error('local --write or --check only')
const root = new URL('../', import.meta.url), target = new URL('output/x402-science50-readiness-2026-10-11/local-profile.json', root)
const files = ['contracts.ts', 'math.ts', 'quantum.ts', 'biology.ts', 'chemistry.ts', 'materials.ts', 'products.ts', 'catalogue.json'].map(p => 'lib/x402/science/' + p)
files.push('lib/x402/micro-schema.ts', 'lib/x402/micro-contracts.ts', 'lib/x402/micro-products.ts', 'lib/x402/micro-output-schemas.ts', 'scripts/profile-science50-local.ts', 'node_modules/@rdkit/rdkit/dist/RDKit_minimal.js', 'node_modules/@rdkit/rdkit/dist/RDKit_minimal.wasm')
const implementationDigest = microDigest(files.map(path => ({ path, sha256: createHash('sha256').update(readFileSync(new URL(path, root))).digest('hex') })))
if (args[0] === '--check') {
  const { digest, ...body } = JSON.parse(readFileSync(target, 'utf8'))
  if (microDigest(body) !== digest || body.implementationDigest !== implementationDigest) throw new Error('science50-profile-stale')
  console.log(JSON.stringify({ profiles: body.observations.length, payments: 0, digest })); process.exit(0)
}
// Larger deterministic fixtures for the algorithms with material scaling cost.
const workloads = structuredClone(SCIENCE_SAMPLES)
workloads['biology-pairwise-sequence-comparison'] = { dataClass: 'synthetic', left: 'ACGT'.repeat(100), right: 'AGCT'.repeat(100) }
workloads['biology-fasta-quality'] = { dataClass: 'synthetic', alphabet: 'DNA', fasta: '>synthetic-max\n' + 'ACGT'.repeat(2500) }
workloads['biology-protein-sequence-descriptors'] = { dataClass: 'synthetic', sequence: 'ACDEFGHIKLMNPQRSTVWY'.repeat(200) }
workloads['biology-protein-confidence-audit'] = { dataClass: 'synthetic', plddt: Array(4000).fill(80) }
workloads['quantum-rabi-ramsey-analysis'] = { dataClass: 'synthetic', kind: 'ramsey', timesSeconds: Array.from({ length: 128 }, (_, k) => k * .005), signal: Array.from({ length: 128 }, (_, k) => .5 + .3 * Math.exp(-k * .005 / .2) * Math.cos(2 * Math.PI * 10 * k * .005)), frequencyRangeHz: [5, 15], decayRangeSeconds: [.1, .3] }
for (const id of ['chemistry-molecular-descriptor-pack', 'chemistry-smiles-validation'] as const) workloads[id] = { dataClass: 'synthetic', smiles: 'C'.repeat(256) }
workloads['chemistry-fingerprint-similarity'] = { dataClass: 'synthetic', left: 'C'.repeat(256), right: 'C'.repeat(255) + 'O' }
let blockedRemoteAttempts = 0
globalThis.fetch = async () => { blockedRemoteAttempts++; throw new Error('remote calls forbidden during local science profile') }
const observations = []
for (const id of SCIENCE_IDS) {
  const coldStart = performance.now(); await buildMicroProduct(id, SCIENCE_SAMPLES[id]); const firstFixtureMs = performance.now() - coldStart
  const times: number[] = [], cpuStart = process.cpuUsage(); let responseBytes = 0
  for (let k = 0; k < 21; k++) { const start = performance.now(), out = await buildMicroProduct(id, workloads[id]); times.push(performance.now() - start); responseBytes = Math.max(responseBytes, Buffer.byteLength(JSON.stringify(out))) }
  times.sort((a, b) => a - b); const cpu = process.cpuUsage(cpuStart)
  observations.push({ id, priceBaseUnits: SCIENCE_PRODUCTS[id].amount, firstFixtureMs, repetitions: 21, p95Ms: times[19], maximumMs: times[20], totalCpuMicros: cpu.user + cpu.system,
    requestBytes: Buffer.byteLength(JSON.stringify(workloads[id])), responseBytes, actualProductionCostUsd: null, observedCustomerDemand: null })
}
if (blockedRemoteAttempts) throw new Error('unexpected remote calls')
const memory = process.memoryUsage()
const body = { observedAt: new Date().toISOString(), basis: 'local Node process; 21 repeats of declared fixtures, enlarged fixtures for selected scaling algorithms; not exhaustive worst-case, isolated per-product peak memory or production cost', nodeVersion: process.version,
  observations, files, implementationDigest, workloadsDigest: microDigest(workloads), processMemoryAfterAllProductsBytes: memory, blockedRemoteAttempts, realPayments: 0, deploymentBuilds: 0 }
writeFileSync(target, JSON.stringify({ ...body, digest: microDigest(body) }, null, 2) + '\n')
console.log(JSON.stringify({ profiles: observations.length, repeats: 1050, maxMs: Math.max(...observations.map(o => o.maximumMs)), peakRequestBytes: Math.max(...observations.map(o => o.requestBytes)), peakResponseBytes: Math.max(...observations.map(o => o.responseBytes)), payments: 0, productionCostKnown: false }))
