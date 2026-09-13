/** Offline bounded workloads, including validation and receipts; not cloud bills. */
import { readFileSync, writeFileSync } from 'node:fs'
import { buildMicroProduct, microDigest } from '../lib/x402/micro-products.ts'
import { CELESTIAL_EXAMPLE, EVIDENCE_EXAMPLE, COMPATIBILITY_PRODUCTS, type CompatibilityId } from '../lib/x402/compatibility-contracts.ts'
if (process.argv.slice(2).some(a => a !== '--write')) throw new Error('Only offline --write is supported')
const observer = { longitudeDeg: '179.999999999999', latitudeDeg: '89.999999999999', heightMeters: '99999.999999999999', datum: 'WGS84', latitudeType: 'geodetic', heightReference: 'ellipsoidal' }
const cases: { id: CompatibilityId; name: string; input: Record<string, unknown> }[] = [
  { id: 'celestial-result-compatibility', name: 'complete-topocentric', input: { dataClass: 'synthetic', left: { ...CELESTIAL_EXAMPLE, origin: 'topocentric', observer }, right: { ...CELESTIAL_EXAMPLE, origin: 'topocentric', observer } } },
  { id: 'celestial-result-compatibility', name: 'all-prerequisites-missing', input: { dataClass: 'synthetic', left: {}, right: {} } },
  { id: 'celestial-result-compatibility', name: 'many-differences', input: { dataClass: 'synthetic', left: { ...CELESTIAL_EXAMPLE, origin: 'topocentric', observer }, right: { ...CELESTIAL_EXAMPLE, targetBody: 'sun', julianDay: '2461297', timeScale: 'UTC', origin: 'topocentric', positionConvention: 'geometric', frameEpoch: 'J2000.0', observer: { ...observer, longitudeDeg: '0', latitudeDeg: '0', heightMeters: '-12000' }, ayanamsa: { modelId: 'different-model', definitionVersion: 'different-version' } } } },
  { id: 'evidence-frame-compatibility', name: 'ten-positive-long-metadata', input: { dataClass: 'synthetic', pairs: Array.from({ length: 10 }, (_, i) => ({ ...EVIDENCE_EXAMPLE, pairId: `pair-${i}`, evidenceType: 'empirical-measurement', sourceRole: 'independent-evaluator', claimScope: 'x'.repeat(160), evidenceScope: 'x'.repeat(160), sourceId: 's'.repeat(160), locator: 'l'.repeat(160) })) } },
  { id: 'evidence-frame-compatibility', name: 'ten-missing', input: { dataClass: 'synthetic', pairs: Array.from({ length: 10 }, () => ({})) } },
  { id: 'evidence-frame-compatibility', name: 'ten-failed-and-missing', input: { dataClass: 'synthetic', pairs: Array.from({ length: 10 }, (_, i) => ({ pairId: `pair-${i}`, claimType: 'historical-occurrence', evidenceType: 'religious-tradition' })) } },
]
const results = []
for (const c of cases) {
  const initial = performance.now(); const output = await buildMicroProduct(c.id, c.input); const firstMs = performance.now() - initial
  for (let i = 0; i < 50; i++) await buildMicroProduct(c.id, c.input)
  const cpu = process.cpuUsage(), samples = []
  for (let i = 0; i < 1000; i++) { const start = performance.now(); await buildMicroProduct(c.id, c.input); samples.push(performance.now() - start) }
  const used = process.cpuUsage(cpu); samples.sort((a, b) => a - b)
  results.push({ product: c.id, case: c.name, callsMeasured: 1000, firstMs, p50Ms: samples[499], p95Ms: samples[949], p99Ms: samples[989], maxMs: samples[999], cpuMicrosecondsPerCall: (used.user + used.system) / 1000, requestBytes: Buffer.byteLength(JSON.stringify(c.input)), responseBytes: Buffer.byteLength(JSON.stringify(output)) })
}
const report = { measuredAt: new Date().toISOString(), node: process.version, platform: process.platform, arch: process.arch,
  implementationDigest: microDigest(['lib/x402/compatibility-contracts.ts', 'lib/x402/compatibility-products.ts', 'lib/x402/micro-products.ts', 'lib/x402/micro-contracts.ts', 'lib/x402/micro-schema.ts', 'lib/x402/micro-output-schemas.ts', 'scripts/benchmark-compatibility-products.ts'].map(path => ({ path, digest: microDigest(readFileSync(new URL('../' + path, import.meta.url), 'utf8')) }))),
  workloadsDigest: microDigest(cases),
  basis: 'local-process-end-to-end-build-including-validation-and-receipt; selected-bounded-cases-not-exhaustive-worst-case', networkCalls: 0, providerCalls: 0, payments: 0,
  proposedAmountsBaseUnits: Object.fromEntries(Object.entries(COMPATIBILITY_PRODUCTS).map(([id, p]) => [id, p.amount])),
  peakProcessRssBytes: process.resourceUsage().maxRSS * 1024, memoryBasis: 'whole-process-high-water-mark-not-per-invocation-memory',
  cloudCostMeasured: false, externalDemandMeasured: false, results }
if (process.argv.includes('--write')) writeFileSync(new URL('../content/discovery/compatibility-cost-observation-v2.json', import.meta.url), JSON.stringify(report, null, 2) + '\n')
console.log(JSON.stringify(report, null, 2))
