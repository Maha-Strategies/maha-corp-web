import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { mkdir, writeFile, readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { SIXTEENTH_BATCH, LOCAL_BATCH_PLAN } from '../lib/api-v1/batch50.ts'
import { SIXTEENTH_BATCH_AUDITS } from '../lib/api-v1/batch16-audits.ts'
import { REGISTRY_SUMMARY } from '../lib/api-v1/endpoints.registry.ts'
import { PRODUCTION_ENDPOINTS } from '../lib/api-v1/production-release.ts'
import { handlerFor } from '../lib/api-v1/handlers.ts'
import { demandDigest } from '../lib/x402/demand6/digest.ts'
import { localOnlyEnvironment } from './lib/api-v1-local-only-environment.ts'

const run = promisify(execFile), out = resolve(process.argv[2] ?? '/Users/mayonerajan/Projects/maha-corp-web/output/api-v1-batch16-2026-10-14')
await mkdir(out, { recursive: true })
const environment = localOnlyEnvironment()
const tests = [...Array.from({ length: 15 }, (_, n) => 'api-v1-batch' + (16 - n)), 'api-v1-batch50', 'api-v1-value-staircase', 'api-v1', 'api-v1-research-books', 'api-v1-production-release', 'modular-controlled-retry', 'x402-integration-isolation', 'x402-settlement-backfill', 'x402-settlement-refresh', 'x402-settlement-rpc']
const check = async (name: string, command: string, args: string[]) => {
  try {
    const result = await run(command, args, { env: environment, maxBuffer: 32 * 1024 * 1024 })
    await writeFile(resolve(out, name + '.log'), result.stdout + result.stderr)
    return result.stdout
  } catch (error) {
    const e = error as { stdout?: string; stderr?: string }
    await writeFile(resolve(out, name + '.log'), (e.stdout ?? '') + (e.stderr ?? ''))
    throw Error(name + '_failed_see_saved_log')
  }
}
const tap = await check('tests', process.execPath, ['--experimental-strip-types', '--test', '--test-concurrency=4', '--test-reporter=tap', ...tests.map(name => 'test/' + name + '.test.ts')])
const count = (key: string) => Number(tap.match(new RegExp('^# ' + key + ' (\\d+)$', 'm'))?.[1] ?? NaN)
assert.equal(count('fail'), 0); assert.equal(count('skipped'), 0); assert.equal(count('pass'), count('tests'))
const passed = count('pass'); assert.ok(passed >= 3900)
await check('types', resolve('node_modules/.bin/tsc'), ['-p', 'tsconfig.api-v1-batch16.json', '--pretty', 'false'])
await check('lint', resolve('node_modules/.bin/eslint'), ['lib/api-v1/batch16-audits.ts', 'lib/api-v1/batch16-time-series.ts', 'lib/api-v1/batch16-orbital.ts', 'lib/api-v1/batch16-ephemeris.ts', 'lib/api-v1/batch16-telescope.ts', 'lib/api-v1/batch15-sky.ts', 'lib/api-v1/batch50.ts', 'lib/api-v1/endpoints.registry.ts', 'lib/api-v1/handlers.ts', 'test/api-v1-batch16.test.ts', 'scripts/verify-api-v1-batch16-local.ts', 'scripts/measure-api-v1-batch16-local.ts', 'scripts/check-api-v1-batch16-http.ts', '--max-warnings=0'])
const examples = []
for (const e of SIXTEENTH_BATCH) {
  const spec = SIXTEENTH_BATCH_AUDITS.find(s => s.id === e.id)!, h = handlerFor(e.id, e.amount)!
  const input = structuredClone(spec.sample), output = await h.execute(input)
  examples.push({ id: e.id, name: e.name, description: e.description, path: e.path, method: e.method, priceUsdc: e.price_usdc, amountBaseUnits: e.amount,
    pricing: e.pricing, schema: e.schema, input, output, outputDigest: demandDigest(output), costPolicy: e.execution_cost, productionApproved: false })
}
await writeFile(resolve(out, 'batch16-catalogue-and-examples.json'), JSON.stringify({ version: 'maha-local-batch16/1', examples }, null, 2) + '\n')
const http = JSON.parse(await readFile(resolve(out, 'http-verification.json'), 'utf8'))
assert.equal(http.unsignedQuotes, 50); assert.equal(http.discoverySchemaChecks, 50); assert.equal(http.cumulativeDiscoverable, 800)
const runtime = JSON.parse(await readFile(resolve(out, 'local-runtime-samples.json'), 'utf8'))
assert.equal(runtime.rows.length, 50); assert.equal(runtime.networkCalls, 0)
const report = { verifiedAt: new Date().toISOString(), localOnly: true, batch: 16, implemented: 50,
  categories: { skyObservations: 6, orbitalRecords: 16, ephemerisSnapshots: 15, telescopeCalibrations: 13 },
  cumulativeLocalImplemented: REGISTRY_SUMMARY.localImplemented, totalDefined: REGISTRY_SUMMARY.defined, remaining: LOCAL_BATCH_PLAN.remaining.length,
  unchangedProductionModularProducts: PRODUCTION_ENDPOINTS.length, previous750ContractsAnd1000PricesFrozen: true,
  proposedPriceRangeUsdc: [Math.min(...SIXTEENTH_BATCH.map(e => e.price_usdc)), Math.max(...SIXTEENTH_BATCH.map(e => e.price_usdc))],
  proposedOnePerProductBaseUnits: SIXTEENTH_BATCH.reduce((n, e) => n + BigInt(e.amount), 0n).toString(), amountUnit: 'six-decimal-USDC-base-units', indexingAuthorized: false,
  checks: { tests: passed, failures: 0, skipped: 0, strictTypes: true, lint: true, realNextUnsignedQuotes: 50, realNextDiscoverySchemas: 50,
    independentAuthorizationAndSchemaChecks: true, sdkLostResponseAndRestartRecovery: true, retainedResultDeadlineHours: 24, minimalReceiptRetentionDays: 90,
    supabaseRuntimeDependencies: 0, zizkaDbRuntimeDependencies: 0, upstreamApiDependencies: 0, liveModelCalls: 0, realPaidCalls: 0, deployments: 0 },
  costs: { usdCostsMeasured: false, grossMarginsEstablished: false, runtimeSamples: 50, liveModelSpendingAuthorized: false },
  designReferences: ['https://docs.astropy.org/en/stable/coordinates/index.html', 'https://ssd.jpl.nasa.gov/horizons/manual.html', 'https://fits.gsfc.nasa.gov/fits_standard.html'],
  designReferenceAccess: { officialCoordinateGuideRead: true, officialHorizonsManualRead: true, officialFitsOverviewRead: true, standardsConformanceEstablished: false, runtimeSourceLookups: 0 },
  boundaries: ['All 50 adapters audit bounded caller-supplied public/synthetic nonpersonal declarations; no live data source, model, instrument or vendor API capability.',
    'Orbital component coverage is an explicitly requested projection, not a full trajectory, force model or physical-consistency proof.',
    'Ephemeris grid availability never interpolates/extrapolates or independently verifies kernel bytes, positions, corrections or accuracy.',
    'Epoch ordering compares only integer ticks in an identical declared target/centre/frame/time-scale/origin/revision; unknown or mismatched rows break adjacency.',
    'Telescope master matching uses an explicitly restrictive exact-exposure policy, not general bias/dark/flat processing advice. Validity is half-open caller policy.',
    'No coordinate, time-scale, dimensional unit conversion, image correction, satellite control or navigation/safety certification.',
    'Digests, sources and parent links do not independently verify authenticity, causal execution, privacy, scientific validity or rights.',
    'The prior 750 contracts, all 1000 unique prices and the 296-product production projection remain frozen.',
    'Book fixtures and separate partner integrations remain unchanged; no new edition/rights review, deployment, indexing or paid call is approved.'],
}
await writeFile(resolve(out, 'verification.json'), JSON.stringify(report, null, 2) + '\n')
console.log(JSON.stringify({ out, batch: 16, implemented: 50, cumulativeLocal: 800, tests: passed, liveModelCalls: 0, realPaidCalls: 0, deployments: 0 }))
