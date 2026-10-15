import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { mkdir, writeFile, readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { NINETEENTH_BATCH, LOCAL_BATCH_PLAN } from '../lib/api-v1/batch50.ts'
import { NINETEENTH_BATCH_AUDITS } from '../lib/api-v1/batch19-audits.ts'
import { REGISTRY_SUMMARY } from '../lib/api-v1/endpoints.registry.ts'
import { PRODUCTION_ENDPOINTS } from '../lib/api-v1/production-release.ts'
import { handlerFor } from '../lib/api-v1/handlers.ts'
import { demandDigest } from '../lib/x402/demand6/digest.ts'
import { localOnlyEnvironment } from './lib/api-v1-local-only-environment.ts'

const run = promisify(execFile), out = resolve(process.argv[2] ?? '/Users/mayonerajan/Projects/maha-corp-web/output/api-v1-batch19-2026-10-15')
await mkdir(out, { recursive: true })
const check = async (name: string, command: string, args: string[]) => {
  try { const r = await run(command, args, { env: localOnlyEnvironment(), maxBuffer: 32 * 1024 * 1024 }); await writeFile(resolve(out, name + '.log'), r.stdout + r.stderr); return r.stdout }
  catch (error) { const e = error as { stdout?: string; stderr?: string }; await writeFile(resolve(out, name + '.log'), (e.stdout ?? '') + (e.stderr ?? '')); throw Error(name + '_failed_see_saved_log') }
}
const tests = [...Array.from({ length: 18 }, (_, n) => 'api-v1-batch' + (19 - n)), 'api-v1-batch50', 'api-v1-value-staircase', 'api-v1', 'api-v1-research-books', 'api-v1-production-release', 'modular-controlled-retry', 'x402-integration-isolation', 'x402-settlement-backfill', 'x402-settlement-refresh', 'x402-settlement-rpc']
const tap = await check('tests', process.execPath, ['--experimental-strip-types', '--test', '--test-concurrency=4', '--test-reporter=tap', ...tests.map(n => 'test/' + n + '.test.ts')])
const count = (key: string) => Number(tap.match(new RegExp('^# ' + key + ' (\\d+)$', 'm'))?.[1] ?? NaN)
assert.equal(count('fail'), 0); assert.equal(count('skipped'), 0); assert.equal(count('pass'), count('tests')); assert.ok(count('pass') >= 4500)
await check('types', resolve('node_modules/.bin/tsc'), ['-p', 'tsconfig.api-v1-batch19.json', '--pretty', 'false'])
await check('lint', resolve('node_modules/.bin/eslint'), ['lib/api-v1/batch19-audits.ts', 'lib/api-v1/batch50.ts', 'lib/api-v1/endpoints.registry.ts', 'lib/api-v1/handlers.ts', 'test/api-v1-batch19.test.ts', 'scripts/verify-api-v1-batch19-local.ts', 'scripts/measure-api-v1-batch19-local.ts', 'scripts/check-api-v1-batch19-http.ts', '--max-warnings=0'])
const examples = []
for (const e of NINETEENTH_BATCH) { const spec = NINETEENTH_BATCH_AUDITS.find(s => s.id === e.id)!, input = structuredClone(spec.sample), output = await handlerFor(e.id, e.amount)!.execute(input)
  examples.push({ id: e.id, name: e.name, description: e.description, path: e.path, method: e.method, priceUsdc: e.price_usdc, amountBaseUnits: e.amount, pricing: e.pricing, schema: e.schema, input, output, outputDigest: demandDigest(output), costPolicy: e.execution_cost, productionApproved: false }) }
await writeFile(resolve(out, 'batch19-catalogue-and-examples.json'), JSON.stringify({ version: 'maha-local-batch19/1', examples }, null, 2) + '\n')
const http = JSON.parse(await readFile(resolve(out, 'http-verification.json'), 'utf8')), runtime = JSON.parse(await readFile(resolve(out, 'local-runtime-samples.json'), 'utf8'))
assert.equal(http.unsignedQuotes, 50); assert.equal(http.discoverySchemaChecks, 50); assert.equal(http.cumulativeDiscoverable, 950)
assert.equal(runtime.rows.length, 50); assert.equal(runtime.networkCalls, 0); assert.equal(REGISTRY_SUMMARY.localImplemented, 950)
const report = { verifiedAt: new Date().toISOString(), localOnly: true, batch: 19, implemented: 50, cumulativeLocalImplemented: REGISTRY_SUMMARY.localImplemented,
  categories: { marketCatalogues: 14, scientificDatasetRecords: 15, bibliographies: 15, readingPlans: 6 }, totalDefined: REGISTRY_SUMMARY.defined, remaining: LOCAL_BATCH_PLAN.remaining.length,
  unchangedProductionModularProducts: PRODUCTION_ENDPOINTS.length, previous900ContractsAnd1000PricesFrozen: true,
  proposedPriceRangeUsdc: [Math.min(...NINETEENTH_BATCH.map(e => e.price_usdc)), Math.max(...NINETEENTH_BATCH.map(e => e.price_usdc))],
  proposedOnePerProductBaseUnits: NINETEENTH_BATCH.reduce((n, e) => n + BigInt(e.amount), 0n).toString(), amountUnit: 'six-decimal-USDC-base-units', indexingAuthorized: false,
  checks: { tests: count('pass'), failures: 0, skipped: 0, strictTypes: true, lint: true, realNextUnsignedQuotes: 50, realNextDiscoverySchemas: 50, independentAuthorizationAndSchemaChecks: true, sdkLostResponseAndRestartRecovery: true, retainedResultDeadlineHours: 24, minimalReceiptRetentionDays: 90, supabaseRuntimeDependencies: 0, zizkaDbRuntimeDependencies: 0, upstreamApiDependencies: 0, liveModelCalls: 0, realPaidCalls: 0, deployments: 0 },
  costs: { usdCostsMeasured: false, grossMarginsEstablished: false, runtimeSamples: 50, liveModelSpendingAuthorized: false },
  boundaries: [
  "Bounded public/synthetic nonpersonal organization-level declarations only. No live source lookup, partner API, model, hosted database, source-byte verification or authentication of official records.",
  "Market amounts use canonical minor-unit integer strings and BigInt; scientific/bibliographic/reading manifest counts reject negative or fractional counts. No conversions or scientific validation.",
  "Caller-supplied windows and requested modules do not establish legal deadlines, application eligibility, current availability, statutory filing requirements or compliance.",
  "Earlier 900 contracts, all 1000 prices and the production release projection remain frozen.",
  "Local timings are not hosting bills or established margins. Deployment, indexing and live model spending remain unapproved."
] }
await writeFile(resolve(out, 'verification.json'), JSON.stringify(report, null, 2) + '\n')
console.log(JSON.stringify({ out, batch: 19, implemented: 50, cumulativeLocal: 950, tests: count('pass'), liveModelCalls: 0, realPaidCalls: 0, deployments: 0 }))
