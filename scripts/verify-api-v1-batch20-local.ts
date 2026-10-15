import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { mkdir, writeFile, readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { TWENTIETH_BATCH, LOCAL_BATCH_PLAN } from '../lib/api-v1/batch50.ts'
import { TWENTIETH_BATCH_AUDITS } from '../lib/api-v1/batch20-audits.ts'
import { BATCH20_PORTS } from '../lib/api-v1/batch20-ports.ts'
import { batch20FixtureHandler } from './lib/api-v1-batch20-fixtures.ts'
import { ENDPOINTS, REGISTRY_SUMMARY } from '../lib/api-v1/endpoints.registry.ts'
import { PRODUCTION_ENDPOINTS } from '../lib/api-v1/production-release.ts'
import { handlerFor } from '../lib/api-v1/handlers.ts'
import { demandDigest } from '../lib/x402/demand6/digest.ts'
import { localOnlyEnvironment } from './lib/api-v1-local-only-environment.ts'

const run = promisify(execFile), out = resolve(process.argv[2] ?? '/Users/mayonerajan/Projects/maha-corp-web/output/api-v1-batch20-2026-10-15')
await mkdir(out, { recursive: true })
const check = async (name: string, command: string, args: string[]) => {
  try { const r = await run(command, args, { env: localOnlyEnvironment(), maxBuffer: 32 * 1024 * 1024 }); await writeFile(resolve(out, name + '.log'), r.stdout + r.stderr); return r.stdout }
  catch (error) { const e = error as { stdout?: string; stderr?: string }; await writeFile(resolve(out, name + '.log'), (e.stdout ?? '') + (e.stderr ?? '')); throw Error(name + '_failed_see_saved_log') }
}
const tests = [...Array.from({ length: 19 }, (_, n) => 'api-v1-batch' + (20 - n)), 'api-v1-batch50', 'api-v1-value-staircase', 'api-v1', 'api-v1-research-books', 'api-v1-production-release', 'modular-controlled-retry', 'x402-integration-isolation', 'x402-settlement-backfill', 'x402-settlement-refresh', 'x402-settlement-rpc']
const tap = await check('tests', process.execPath, ['--experimental-strip-types', '--test', '--test-concurrency=4', '--test-reporter=tap', ...tests.map(n => 'test/' + n + '.test.ts')])
const count = (key: string) => Number(tap.match(new RegExp('^# ' + key + ' (\\d+)$', 'm'))?.[1] ?? NaN)
assert.equal(count('fail'), 0); assert.equal(count('skipped'), 0); assert.equal(count('pass'), count('tests')); assert.ok(count('pass') >= 4800)
await check('types', resolve('node_modules/.bin/tsc'), ['-p', 'tsconfig.api-v1-batch20.json', '--pretty', 'false'])
await check('lint', resolve('node_modules/.bin/eslint'), ['lib/api-v1/batch20-audits.ts', 'lib/api-v1/batch20-ports.ts', 'lib/api-v1/cost-policy.ts', 'scripts/lib/api-v1-batch20-fixtures.ts', 'lib/api-v1/batch50.ts', 'lib/api-v1/endpoints.registry.ts', 'lib/api-v1/handlers.ts', 'test/api-v1-batch20.test.ts', 'scripts/verify-api-v1-batch20-local.ts', 'scripts/measure-api-v1-batch20-local.ts', 'scripts/check-api-v1-batch20-http.ts', '--max-warnings=0'])
const examples = []
for (const e of TWENTIETH_BATCH) { const spec = [...TWENTIETH_BATCH_AUDITS, ...BATCH20_PORTS].find(s => s.id === e.id)!, input = structuredClone(spec.sample), output = await (batch20FixtureHandler(e.id, e.amount) ?? handlerFor(e.id, e.amount)!).execute(input)
  examples.push({ id: e.id, name: e.name, description: e.description, path: e.path, method: e.method, priceUsdc: e.price_usdc, amountBaseUnits: e.amount, pricing: e.pricing, schema: e.schema, input, output, outputDigest: demandDigest(output), costPolicy: e.execution_cost, productionApproved: false }) }
await writeFile(resolve(out, 'batch20-catalogue-and-examples.json'), JSON.stringify({ version: 'maha-local-batch20/1', examples }, null, 2) + '\n')
await writeFile(resolve(out, '1000-endpoint-local-manifest.json'), JSON.stringify({ version: 'maha-local-1000/1', localOnly: true, productionDeploymentApproved: false,
  costsMeasured: false, marginsEstablished: false, endpoints: ENDPOINTS }, null, 2) + '\n')
const http = JSON.parse(await readFile(resolve(out, 'http-verification.json'), 'utf8')), runtime = JSON.parse(await readFile(resolve(out, 'local-runtime-samples.json'), 'utf8'))
assert.equal(http.unsignedQuotes, 49); assert.equal(http.modelSpendingRefusals, 1); assert.equal(http.discoverySchemaChecks, 50); assert.equal(http.cumulativeDiscoverable, 1000)
assert.equal(runtime.rows.length, 50); assert.equal(runtime.networkCalls, 0); assert.equal(REGISTRY_SUMMARY.localImplemented, 1000)
const report = { verifiedAt: new Date().toISOString(), localOnly: true, batch: 20, implemented: 50, cumulativeLocalImplemented: REGISTRY_SUMMARY.localImplemented,
  categories: { legacyPorts: 14, readingPlans: 9, editionRecords: 16, glossaryRecords: 11 }, totalDefined: REGISTRY_SUMMARY.defined, remaining: LOCAL_BATCH_PLAN.remaining.length,
  unchangedProductionModularProducts: PRODUCTION_ENDPOINTS.length, previous950ContractsAnd1000PricesFrozen: true,
  proposedPriceRangeUsdc: [Math.min(...TWENTIETH_BATCH.map(e => e.price_usdc)), Math.max(...TWENTIETH_BATCH.map(e => e.price_usdc))],
  proposedOnePerProductBaseUnits: TWENTIETH_BATCH.reduce((n, e) => n + BigInt(e.amount), 0n).toString(), amountUnit: 'six-decimal-USDC-base-units', indexingAuthorized: false,
  checks: { tests: count('pass'), failures: 0, skipped: 0, strictTypes: true, lint: true, realNextUnsignedQuotes: 49, realNextModelSpendingRefusals: 1, realNextDiscoverySchemas: 50, independentAuthorizationAndSchemaChecks: true, sdkLostResponseAndRestartRecovery: true, retainedResultDeadlineHours: 24, minimalReceiptRetentionDays: 90, supabaseRuntimeDependencies: 0, zizkaDbRuntimeDependencies: 0, sourceBackedAdapters: 3, liveSourceReadsInVerification: 0, mockedModelAdapter: 1, liveModelCalls: 0, realPaidCalls: 0, deployments: 0 },
  costs: { usdCostsMeasured: false, grossMarginsEstablished: false, runtimeSamples: 50, liveModelSpendingAuthorized: false },
  boundaries: [
    '1000 entries are implemented locally, not deployed, indexed or approved as 1000 production-payable services.',
    '36 metadata tools and 10 deterministic legacy adapters use local CPU. Three source-backed adapters use injected observations in tests; live source freshness was not tested.',
    'MPS is tested with a mock runner and remains blocked without approved three-times-cost pricing, a hard cost envelope and a separately configured connector. No live model provider is configured.',
    'Modular results retain content for 24 hours and minimal receipt metadata for 90 days; legacy stateless wording and old component prices do not describe modular billing.',
    'Earlier 950 contracts, all 1000 prices and the production release projection remain frozen.',
    'Local timings do not measure hosting, source acquisition, model provider bills or established margins.'
] }
await writeFile(resolve(out, 'verification.json'), JSON.stringify(report, null, 2) + '\n')
console.log(JSON.stringify({ out, batch: 20, implemented: 50, cumulativeLocal: 1000, tests: count('pass'), liveModelCalls: 0, realPaidCalls: 0, deployments: 0 }))
