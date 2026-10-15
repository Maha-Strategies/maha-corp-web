import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { mkdir, writeFile, readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { THIRTEENTH_BATCH, LOCAL_BATCH_PLAN } from '../lib/api-v1/batch50.ts'
import { THIRTEENTH_BATCH_AUDITS } from '../lib/api-v1/batch13-audits.ts'
import { REGISTRY_SUMMARY } from '../lib/api-v1/endpoints.registry.ts'
import { PRODUCTION_ENDPOINTS } from '../lib/api-v1/production-release.ts'
import { handlerFor } from '../lib/api-v1/handlers.ts'
import { demandDigest } from '../lib/x402/demand6/digest.ts'
import { localOnlyEnvironment } from './lib/api-v1-local-only-environment.ts'
const run = promisify(execFile), out = resolve(process.argv[2] ?? '/Users/mayonerajan/Projects/maha-corp-web/output/api-v1-batch13-2026-10-14')
await mkdir(out, { recursive: true })
const environment = localOnlyEnvironment(), tests = ['api-v1-batch13', 'api-v1-batch12', 'api-v1-batch11', 'api-v1-batch10', 'api-v1-batch9', 'api-v1-production-release', 'api-v1-batch8', 'api-v1-batch7', 'api-v1-batch6', 'api-v1-batch5', 'api-v1-batch4', 'api-v1-batch3', 'api-v1-batch2', 'api-v1-batch50', 'api-v1-value-staircase', 'api-v1', 'api-v1-research-books', 'modular-controlled-retry', 'x402-integration-isolation', 'x402-settlement-backfill', 'x402-settlement-refresh', 'x402-settlement-rpc']
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
const passed = count('pass'); assert.ok(passed >= 3200)
await check('types', resolve('node_modules/.bin/tsc'), ['-p', 'tsconfig.api-v1-batch13.json', '--pretty', 'false'])
await check('lint', resolve('node_modules/.bin/eslint'), ['lib/api-v1/batch13-audits.ts', 'lib/api-v1/batch13-catalysts.ts', 'lib/api-v1/batch13-polymers.ts', 'lib/api-v1/batch13-alloys.ts', 'lib/api-v1/batch13-ceramics.ts', 'lib/api-v1/batch13-material-core.ts', 'lib/api-v1/batch12-catalysts.ts', 'lib/api-v1/batch9-record-suite.ts', 'lib/api-v1/batch50.ts', 'lib/api-v1/endpoints.registry.ts', 'lib/api-v1/handlers.ts', 'test/api-v1-batch13.test.ts', 'scripts/verify-api-v1-batch13-local.ts', 'scripts/measure-api-v1-batch13-local.ts', 'scripts/check-api-v1-batch13-http.ts', 'scripts/serve-api-v1-local.ts', 'lib/x402/settlement-refresh.ts', 'lib/x402/settlement-backfill.ts', 'test/x402-settlement-backfill.test.ts', '--max-warnings=0'])
const examples = []
for (const e of THIRTEENTH_BATCH) {
  const spec = THIRTEENTH_BATCH_AUDITS.find(s => s.id === e.id)!, h = handlerFor(e.id, e.amount)!
  const input = structuredClone(spec.sample), output = await h.execute(input)
  examples.push({ id: e.id, name: e.name, description: e.description, path: e.path, method: e.method, priceUsdc: e.price_usdc, amountBaseUnits: e.amount,
    pricing: e.pricing, schema: e.schema, input, output, outputDigest: demandDigest(output), costPolicy: e.execution_cost, productionApproved: false })
}
await writeFile(resolve(out, 'batch13-catalogue-and-examples.json'), JSON.stringify({ version: 'maha-local-batch13/1', examples }, null, 2) + '\n')
const http = JSON.parse(await readFile(resolve(out, 'http-verification.json'), 'utf8'))
assert.equal(http.unsignedQuotes, 50); assert.equal(http.discoverySchemaChecks, 50); assert.equal(http.cumulativeDiscoverable, 650)
const runtime = JSON.parse(await readFile(resolve(out, 'local-runtime-samples.json'), 'utf8'))
assert.equal(runtime.rows.length, 50); assert.equal(runtime.networkCalls, 0)
const report = { verifiedAt: new Date().toISOString(), localOnly: true, batch: 13, implemented: 50,
  categories: { catalystMeasurements: 14, polymerMeasurements: 16, alloyMeasurements: 16, ceramicMeasurements: 4 },
  cumulativeLocalImplemented: REGISTRY_SUMMARY.localImplemented, totalDefined: REGISTRY_SUMMARY.defined, remaining: LOCAL_BATCH_PLAN.remaining.length,
  unchangedProductionModularProducts: PRODUCTION_ENDPOINTS.length, previous600ContractsAnd1000PricesFrozen: true,
  proposedPriceRangeUsdc: [Math.min(...THIRTEENTH_BATCH.map(e => e.price_usdc)), Math.max(...THIRTEENTH_BATCH.map(e => e.price_usdc))],
  proposedOnePerProductBaseUnits: THIRTEENTH_BATCH.reduce((n, e) => n + BigInt(e.amount), 0n).toString(), amountUnit: 'six-decimal-USDC-base-units', indexingAuthorized: false,
  checks: { tests: passed, failures: 0, skipped: 0, strictTypes: true, lint: true, realNextUnsignedQuotes: 50, realNextDiscoverySchemas: 50,
    independentAuthorizationAndSchemaChecks: true, sdkLostResponseAndRestartRecovery: true, retainedResultDeadlineHours: 24, minimalReceiptRetentionDays: 90,
    supabaseRuntimeDependencies: 0, zizkaDbRuntimeDependencies: 0, upstreamApiDependencies: 0, liveModelCalls: 0, realPaidCalls: 0, deployments: 0 },
  costs: { usdCostsMeasured: false, grossMarginsEstablished: false, runtimeSamples: 50, liveModelSpendingAuthorized: false },
  designReferences: ['https://goldbook.iupac.org/terms/view/12217', 'https://goldbook.iupac.org/terms/view/12224', 'https://trc.nist.gov/MetalsAlloyUI/'],
  designReferenceAccess: { iupacDefinitionsAvailableInSearchResults: true, iupacDirectFetchStatus: 403, nistOverviewRead: true, runtimeSourceLookups: 0 },
  boundaries: ['Material checks inspect caller-supplied public or synthetic lot/method/revision metadata; no formulation, property prediction, synthesis or safety certification.',
    'Polymer averages use supplied integer number-count bins; unknown/censored counts and incompatible units block derivation, and finite-bin averages do not prove a complete measured distribution.', 'Alloy closure is integer ppm arithmetic with an explicit mass or atom basis, not complete measured composition or material certification.', 'Catalyst and ceramic declarations do not establish activity or engineering performance.',
    'Source pins and parent links do not establish authentic source bytes, causal execution or scientific validity.',
    'Declaring nonpersonal metadata is not automatic privacy detection; hashes are not anonymization.',
    'No changes to the existing production release manifest or deployment/indexing authority. Joint partner products remain outside this programme.',
    'Earlier book regressions use existing pinned private local fixtures; no new edition is selected or approved for release.'],
}
await writeFile(resolve(out, 'verification.json'), JSON.stringify(report, null, 2) + '\n')
console.log(JSON.stringify({ out, batch: 13, implemented: 50, cumulativeLocal: 650, tests: passed, liveModelCalls: 0, realPaidCalls: 0, deployments: 0 }))
