/** Synthetic-only remote smoke test. Vercel CLI owns protection authentication. */
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { calculationDigest } from '../lib/x402/celestial-products.ts'

const deployment = process.argv[2]
const url = new URL(deployment)
if (url.protocol !== 'https:' || !url.hostname.endsWith('.vercel.app') || url.pathname !== '/' || url.search || url.username || url.password) {
  throw new Error('An explicit Vercel Preview origin is required; Production is not a smoke-test target.')
}
const path = '/api/v1/interpretations/jyotisha/basic'
const input = { date: '2000-01-01', time: '12:00', timeZone: 'UTC', latitudeDegrees: 0,
  longitudeDegrees: 0, birthTimeUncertaintyMinutes: 0, timingInstantUtc: '2026-09-14T12:00:00.000Z' }
function request(target: string, body?: unknown, method = 'POST') {
  const output = execFileSync('vercel', ['curl', target, '--deployment', url.origin, '--',
    '--silent', '--show-error', '--max-time', '45', '--request', method,
    ...(body === undefined ? [] : ['--header', 'Content-Type: application/json', '--data-binary', JSON.stringify(body)]),
    '--write-out', '\n__META__%{http_code}|%header{cache-control}|%header{x-robots-tag}'],
  { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, timeout: 60000, stdio: ['ignore', 'pipe', 'pipe'] })
  const at = output.lastIndexOf('\n__META__')
  assert.ok(at >= 0, 'Missing HTTP result')
  const [status, cache, robots] = output.slice(at + 9).split('|')
  return { status: Number(status), cache, robots, body: output.slice(0, at) }
}
const nominal = request(path, input)
assert.equal(nominal.status, 200)
assert.match(nominal.cache, /no-store/)
assert.match(nominal.robots, /noindex/)
const data = JSON.parse(nominal.body)
assert.equal(data.schemaVersion, 'jyotisha-basic/0.2')
assert.equal(data.reading.educational.profile, 'iyer-symbolic-reflection/0.1')
assert.equal(data.reading.educational.predictiveValidation, false)
assert.equal(data.reading.educational.sections.length, 4)
assert.equal(data.reading.educational.planetary.length, 9)
const { receiptDigest, ...payload } = data.reading.educational
assert.equal(receiptDigest, calculationDigest(payload), 'Returned payload integrity')

const uncertain = request(path, { ...input, birthTimeUncertaintyMinutes: 30 })
assert.equal(uncertain.status, 200)
const alternate = JSON.parse(uncertain.body)
assert.equal(alternate.foundation.sensitivity.intervalStabilityProven, false)
assert.ok(alternate.reading.educational.sections.every((s: { status: string }) => s.status === 'nominal-study-only'))
assert.equal(request(path, { ...input, date: '2024-11-03', time: '01:30', timeZone: 'America/New_York' }).status, 400)
assert.equal(request(`${path}?date=synthetic`, input).status, 400)
assert.equal(request(path, { ...input, reviews: [{ accepted: true }] }).status, 400)
assert.equal(request(path, undefined, 'GET').status, 405)
const page = request('/knowledge/birth', undefined, 'GET')
assert.equal(page.status, 200)
assert.match(page.body, /internally reviewed, not expert-reviewed/)
assert.match(page.body, /name="birthTimeUncertaintyMinutes"/)
assert.doesNotMatch(page.body, /iyer-symbolic-reflection\/0\.1.{0,100}planet-Sun/)
console.log(JSON.stringify({ deployment: url.origin, syntheticOnly: true, apiNominal: 'passed',
  uncertainty: 'passed', invalidInputs: 'passed', freeWithoutPayment: true,
  noStore: true, noindex: true, educationalPayloadIntegrity: true, readerHtml: 'passed',
  browserInteraction: 'not-tested-by-this-script', productionChanged: false }, null, 2))
