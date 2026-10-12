import { spawnSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
const args = process.argv.slice(2)
if (args.length > 1 || (args.length === 1 && args[0] !== '--write')) throw new Error('local optional --write only')
const files = ['test/x402-science50.test.ts', 'test/x402-microproducts.test.ts', 'test/x402-micro-next12.test.ts', 'test/x402-micro-planning.test.ts', 'test/x402-micro-release.test.ts', 'test/x402-micro-payment.test.ts', 'test/x402-micro-price-policy.test.ts', 'test/x402-offer-catalog.test.ts', 'test/x402-buyer-delivery-check.test.ts']
const result = spawnSync(process.execPath, ['--experimental-strip-types', '--test', '--test-reporter=tap', ...files], { cwd: new URL('../', import.meta.url), encoding: 'utf8', maxBuffer: 8 * 1024 * 1024, timeout: 120000 })
const count = (key: string) => Number(new RegExp(`^# ${key} (\\d+)$`, 'm').exec(result.stdout)?.[1] ?? -1)
const report = { observedAt: new Date().toISOString(), files, nodeVersion: process.version, exitCode: result.status, tests: count('tests'), passed: count('pass'), failed: count('fail'), skipped: count('skipped'), cancelled: count('cancelled'),
  realPayments: 0, productionBuilds: 0, independentScientificReview: false, basis: 'local reference, independent schema checker, regression and injected mock facilitator/recovery tests; no on-chain payment' }
if (args[0] === '--write') writeFileSync(new URL('../output/x402-science50-readiness-2026-10-11/local-tests.json', import.meta.url), JSON.stringify(report, null, 2) + '\n')
console.log(JSON.stringify(report))
if (result.status !== 0) { console.error(result.stdout.slice(-12000), result.stderr.slice(-3000)); process.exitCode = 1 }
