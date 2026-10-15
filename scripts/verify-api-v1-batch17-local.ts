import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { mkdir, writeFile, readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { SEVENTEENTH_BATCH, LOCAL_BATCH_PLAN } from '../lib/api-v1/batch50.ts'
import { SEVENTEENTH_BATCH_AUDITS } from '../lib/api-v1/batch17-audits.ts'
import { REGISTRY_SUMMARY } from '../lib/api-v1/endpoints.registry.ts'
import { PRODUCTION_ENDPOINTS } from '../lib/api-v1/production-release.ts'
import { handlerFor } from '../lib/api-v1/handlers.ts'
import { demandDigest } from '../lib/x402/demand6/digest.ts'
import { localOnlyEnvironment } from './lib/api-v1-local-only-environment.ts'

const run = promisify(execFile), out = resolve(process.argv[2] ?? '/Users/mayonerajan/Projects/maha-corp-web/output/api-v1-batch17-2026-10-15')
await mkdir(out, { recursive: true })
const check = async (name: string, command: string, args: string[]) => {
  try { const r = await run(command, args, { env: localOnlyEnvironment(), maxBuffer: 32 * 1024 * 1024 }); await writeFile(resolve(out, name + '.log'), r.stdout + r.stderr); return r.stdout }
  catch (error) { const e = error as { stdout?: string; stderr?: string }; await writeFile(resolve(out, name + '.log'), (e.stdout ?? '') + (e.stderr ?? '')); throw Error(name + '_failed_see_saved_log') }
}
const tests = [...Array.from({ length: 16 }, (_, n) => 'api-v1-batch' + (17 - n)), 'api-v1-batch50', 'api-v1-value-staircase', 'api-v1', 'api-v1-research-books', 'api-v1-production-release', 'modular-controlled-retry', 'x402-integration-isolation', 'x402-settlement-backfill', 'x402-settlement-refresh', 'x402-settlement-rpc']
const tap = await check('tests', process.execPath, ['--experimental-strip-types', '--test', '--test-concurrency=4', '--test-reporter=tap', ...tests.map(n => 'test/' + n + '.test.ts')])
const count = (key: string) => Number(tap.match(new RegExp('^# ' + key + ' (\\d+)$', 'm'))?.[1] ?? NaN)
assert.equal(count('fail'), 0); assert.equal(count('skipped'), 0); assert.equal(count('pass'), count('tests')); assert.ok(count('pass') >= 4100)
await check('types', resolve('node_modules/.bin/tsc'), ['-p', 'tsconfig.api-v1-batch17.json', '--pretty', 'false'])
await check('lint', resolve('node_modules/.bin/eslint'), ['lib/api-v1/batch17-audits.ts', 'lib/api-v1/batch17-counts.ts', 'lib/api-v1/batch17-planetary.ts', 'lib/api-v1/batch17-publications.ts', 'lib/api-v1/batch17-trials.ts', 'lib/api-v1/batch16-telescope.ts', 'lib/api-v1/batch50.ts', 'lib/api-v1/endpoints.registry.ts', 'lib/api-v1/handlers.ts', 'test/api-v1-batch17.test.ts', 'scripts/freeze-api-v1-contracts.ts', 'scripts/verify-api-v1-batch17-local.ts', 'scripts/measure-api-v1-batch17-local.ts', 'scripts/check-api-v1-batch17-http.ts', '--max-warnings=0'])
const examples = []
for (const e of SEVENTEENTH_BATCH) { const spec = SEVENTEENTH_BATCH_AUDITS.find(s => s.id === e.id)!, input = structuredClone(spec.sample), output = await handlerFor(e.id, e.amount)!.execute(input)
  examples.push({ id: e.id, name: e.name, description: e.description, path: e.path, method: e.method, priceUsdc: e.price_usdc, amountBaseUnits: e.amount, pricing: e.pricing, schema: e.schema, input, output, outputDigest: demandDigest(output), costPolicy: e.execution_cost, productionApproved: false }) }
await writeFile(resolve(out, 'batch17-catalogue-and-examples.json'), JSON.stringify({ version: 'maha-local-batch17/1', examples }, null, 2) + '\n')
const http = JSON.parse(await readFile(resolve(out, 'http-verification.json'), 'utf8')), runtime = JSON.parse(await readFile(resolve(out, 'local-runtime-samples.json'), 'utf8'))
assert.equal(http.unsignedQuotes, 50); assert.equal(http.discoverySchemaChecks, 50); assert.equal(http.cumulativeDiscoverable, 850)
assert.equal(runtime.rows.length, 50); assert.equal(runtime.networkCalls, 0); assert.equal(REGISTRY_SUMMARY.localImplemented, 850)
const report = { verifiedAt: new Date().toISOString(), localOnly: true, batch: 17, implemented: 50, cumulativeLocalImplemented: REGISTRY_SUMMARY.localImplemented,
  categories: { telescopeCalibrations: 3, planetaryMeasurements: 16, publicationRecords: 16, trialRegistryRecords: 15 }, totalDefined: REGISTRY_SUMMARY.defined, remaining: LOCAL_BATCH_PLAN.remaining.length,
  unchangedProductionModularProducts: PRODUCTION_ENDPOINTS.length, previous800ContractsAnd1000PricesFrozen: true,
  proposedPriceRangeUsdc: [Math.min(...SEVENTEENTH_BATCH.map(e => e.price_usdc)), Math.max(...SEVENTEENTH_BATCH.map(e => e.price_usdc))],
  proposedOnePerProductBaseUnits: SEVENTEENTH_BATCH.reduce((n, e) => n + BigInt(e.amount), 0n).toString(), amountUnit: 'six-decimal-USDC-base-units', indexingAuthorized: false,
  checks: { tests: count('pass'), failures: 0, skipped: 0, strictTypes: true, lint: true, realNextUnsignedQuotes: 50, realNextDiscoverySchemas: 50, independentAuthorizationAndSchemaChecks: true, sdkLostResponseAndRestartRecovery: true, retainedResultDeadlineHours: 24, minimalReceiptRetentionDays: 90, supabaseRuntimeDependencies: 0, zizkaDbRuntimeDependencies: 0, upstreamApiDependencies: 0, liveModelCalls: 0, realPaidCalls: 0, deployments: 0 },
  costs: { usdCostsMeasured: false, grossMarginsEstablished: false, runtimeSamples: 50, liveModelSpendingAuthorized: false },
  designReferences: ['https://pds.nasa.gov/datastandards/about/', 'https://www.crossref.org/documentation/retrieve-metadata/rest-api/', 'https://clinicaltrials.gov/data-api/about-api'],
  designReferenceAccess: { pdsOverviewRead: true, crossrefMetadataGuideRead: true, clinicalTrialPageOnlyReturnedShell: true, standardsConformanceEstablished: false, runtimeSourceLookups: 0 },
  boundaries: ['Only bounded caller-supplied public/synthetic nonpersonal metadata is audited; no sources, private records, models or partner services are accessed.',
    'Planetary coordinates, conventions and unit labels are compared literally, never converted or scientifically validated.',
    'Publication DOI syntax, revision pins and relation declarations do not establish resolution, authorship, correction/retraction status, research quality or rights.',
    'Trial registry records are study-level metadata only; no individual data, clinical advice, efficacy/safety assessment or compliance certification.',
    'Null, unknown and estimated declarations never silently become exact measurements, counts or available modules.',
    'These are local timings, not measured hosting bills or established profit margins. No deployment, indexing or paid refresh is authorized.'] }
await writeFile(resolve(out, 'verification.json'), JSON.stringify(report, null, 2) + '\n')
console.log(JSON.stringify({ out, batch: 17, implemented: 50, cumulativeLocal: 850, tests: count('pass'), liveModelCalls: 0, realPaidCalls: 0, deployments: 0 }))
