import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { mkdir, writeFile, readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { X402_OFFERS } from '../lib/x402/offers.ts'
import { x402Config } from '../lib/x402/config.ts'
import { resolveX402 } from '../lib/x402/gateway.ts'
import { PRODUCTION_ENDPOINTS } from '../lib/api-v1/production-release.ts'
import { with402Payment } from '../lib/api-v1/with402Payment.ts'
import { memoryPaymentStore } from '../lib/api-v1/payment-store.ts'
import { paymentRequiredHeaderBytes, PAYMENT_REQUIRED_HEADER_LIMIT } from '../lib/x402/response-header-budget.ts'
import { declarationDigest } from '../lib/x402/declaration-digest.ts'
import { MAHA_PAYEE } from '../lib/x402/merchant-identity.ts'
import { localOnlyEnvironment } from './lib/api-v1-local-only-environment.ts'

const run = promisify(execFile), out = resolve(process.argv[2] ?? '/Users/mayonerajan/Projects/maha-corp-web/output/x402-header-lockfile-2026-10-14')
await mkdir(out, { recursive: true })
const check = async (name: string, executable: string, args: string[], input?: string) => {
  const child = run(executable, args, { env: localOnlyEnvironment(), maxBuffer: 32 * 1024 * 1024 })
  if (input !== undefined) { child.child.stdin!.end(input) }
  try { const result = await child; await writeFile(resolve(out, name + '.log'), result.stdout + result.stderr); return result.stdout }
  catch (error) { const e = error as { stdout?: string; stderr?: string }; await writeFile(resolve(out, name + '.log'), (e.stdout ?? '') + (e.stderr ?? '')); throw Error(name + '_failed_see_saved_log') }
}
const tests = ['x402-response-header-size', 'x402-lockfile-repair', 'x402-payment-header-size', 'x402-declaration-digest', 'x402-discovery', 'x402-context-product-family', 'x402-facilitator', 'x402-polygon', 'x402-integration-isolation', 'x402-bazaar-discovery-monitoring', 'api-v1-production-release', 'api-v1', 'modular-controlled-retry']
const tap = await check('tests', process.execPath, ['--experimental-strip-types', '--test', '--test-concurrency=4', '--test-reporter=tap', ...tests.map(n => 'test/' + n + '.test.ts')])
const count = (k: string) => Number(tap.match(new RegExp('^# ' + k + ' (\\d+)$', 'm'))?.[1] ?? NaN)
assert.equal(count('fail'), 0); assert.equal(count('skipped'), 0); assert.equal(count('tests'), count('pass')); assert.ok(count('pass') > 300)
await check('types', resolve('node_modules/.bin/tsc'), ['-p', 'tsconfig.x402-header-repair.json', '--pretty', 'false'])
await check('lint', resolve('node_modules/.bin/eslint'), ['lib/x402/response-header-budget.ts', 'lib/x402/declaration-compaction.ts', 'lib/x402/discovery.ts', 'lib/x402/protocol.ts', 'lib/x402/gateway.ts', 'lib/api-v1/with402Payment.ts', 'test/x402-response-header-size.test.ts', 'test/x402-lockfile-repair.test.ts', 'scripts/verify-x402-header-repair-local.ts', '--max-warnings=0'])
const fixtures: { id: string; header: string }[] = [], measurements: { id: string; family: string; networks: number; headerValueBytes: number; headerLineBytes: number }[] = []
const fetchBefore = globalThis.fetch
let externalCalls = 0, paidCalls = 0
globalThis.fetch = async () => { externalCalls++; throw Error('offline_header_verification') }
const facilitator = { verify: async () => { paidCalls++; throw Error('paid_call_forbidden') }, settle: async () => { paidCalls++; throw Error('paid_call_forbidden') } }
try {
  for (const networks of [1, 2, 3]) {
    const config = x402Config({ X402_ENABLED: 'true', X402_NETWORK: 'base', X402_FACILITATOR_URL: 'https://facilitator.invalid', X402_PAY_TO: MAHA_PAYEE,
      X402_ASSET: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913', X402_RESOURCES: JSON.stringify(X402_OFFERS.filter(o => o.availability.payableInProduction).map(o => ({ method: o.method, path: o.path }))),
      ...(networks >= 2 ? { X402_ARBITRUM_ENABLED: 'true', X402_ARBITRUM_FROM_BLOCK: '1' } : {}),
      ...(networks >= 3 ? { X402_POLYGON_ENABLED: 'true', X402_POLYGON_FROM_BLOCK: '1', X402_POLYGON_SCHEMA_READY: 'true' } : {}) })!
    for (const p of config.resources) {
      const result = await resolveX402(new Request('https://www.mahastrategies.com' + p.path, { method: p.method }), { config, facilitator })
      assert.equal(result.kind, 'challenge', p.offerId); if (result.kind !== 'challenge') throw Error('quote_missing')
      const body = JSON.parse(Buffer.from(result.header, 'base64').toString('utf8'))
      assert.equal(await declarationDigest(body), body.extensions['declaration-integrity'].declarationDigest)
      fixtures.push({ id: p.offerId + ':' + networks, header: result.header })
      measurements.push({ id: p.offerId, family: 'legacy', networks, headerValueBytes: Buffer.byteLength(result.header), headerLineBytes: paymentRequiredHeaderBytes(result.header) })
    }
  }
  for (const e of PRODUCTION_ENDPOINTS) {
    const route = with402Payment(e, undefined, { environment: { NODE_ENV: 'test', BASE_PAYEE_ADDRESS: MAHA_PAYEE }, facilitator, store: memoryPaymentStore() })
    const response = await route(new Request('https://www.mahastrategies.com' + e.path, { method: e.method }))
    assert.equal(response.status, 402); const header = response.headers.get('PAYMENT-REQUIRED')!
    fixtures.push({ id: e.id, header }); measurements.push({ id: e.id, family: 'modular', networks: 1, headerValueBytes: Buffer.byteLength(header), headerLineBytes: paymentRequiredHeaderBytes(header) })
  }
} finally { globalThis.fetch = fetchBefore }
assert.equal(externalCalls, 0); assert.equal(paidCalls, 0)
assert.ok(measurements.every(m => m.headerLineBytes <= PAYMENT_REQUIRED_HEADER_LIMIT))
await writeFile(resolve(out, 'header-measurements.json'), JSON.stringify(measurements, null, 2) + '\n')
const python = process.argv[3]
if (!python || !python.startsWith('/')) throw Error('explicit_local_aiohttp_python_required')
const aiohttp = JSON.parse(await check('aiohttp', python, ['scripts/check-x402-aiohttp-local.py'], JSON.stringify(fixtures)))
assert.equal(aiohttp.acceptedChallenges, fixtures.length); assert.equal(aiohttp.reported11252ByteNegativeControlRejected, true)
const lock = JSON.parse(await readFile('package-lock.json', 'utf8'))
const report = { verifiedAt: new Date().toISOString(), localOnly: true, tests: count('pass'), failures: 0, skipped: 0, types: true, lint: true,
  headerLineLimitBytes: PAYMENT_REQUIRED_HEADER_LIMIT, largestHeaderLineBytes: Math.max(...measurements.map(m => m.headerLineBytes)),
  matrix: measurements.filter(m => m.id === 'evidence-retention-matrix'), legacyOffers: X402_OFFERS.filter(o => o.availability.payableInProduction).length,
  modularOffers: PRODUCTION_ENDPOINTS.length, quoteConfigurations: fixtures.length, aiohttp,
  lockfile: { packageCount: Object.keys(lock.packages).length, sixPreviouslyMissingEntriesPresent: true, packageJsonChanged: false, existingVersionsChanged: false, linuxLibcMetadataPreserved: true },
  safety: { deployments: 0, paidCalls, externalEndpointCalls: externalCalls, liveModelCalls: 0, zizkaDbIntegrationAdded: false, migrations: 0 },
  scope: 'Focused repair on main commit 5f65b007; unpublished endpoint batches are excluded. Headers are generated offline; only the parser test listens/connects to IPv4 loopback. Dependency downloads are not endpoint calls. This is not production deployment or indexing evidence.' }
await writeFile(resolve(out, 'verification.json'), JSON.stringify(report, null, 2) + '\n')
console.log(JSON.stringify({ out, tests: count('pass'), quoteConfigurations: fixtures.length, largestHeaderLineBytes: report.largestHeaderLineBytes, matrix: report.matrix, safety: report.safety }))
