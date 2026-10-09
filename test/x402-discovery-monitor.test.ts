import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { classifyDiscoveryReport, discoveryMonitorMatrix } from '../lib/x402/discovery-monitor.ts'
import { recoveryHealthFromRows, RECOVERY_HEALTH_STATES } from '../lib/x402/recovery-health.ts'

const subject = 'https://www.mahastrategies.com/api/v1/compress'
const offer = { id: 'context-compression', status: 'active', method: 'POST', canonicalResource: subject, payment: { protocol: 'x402' } }
const clean = () => ({ schemaVersion: '1.0.0', tool: { name: 'x402-doctor' }, endpoint: subject, checkedAt: '2026-10-03T07:00:00Z', ok: true,
  summary: { errors: 0, warnings: 0, notes: 0 }, live: { status: 402, declarationDigest: 'synthetic' }, bazaar: { found: true, matchesLive: true }, findings: [] })
const finding = (ruleId: string, level = 'warning') => ({ ruleId, level, message: 'synthetic observation' })

test('monitor inventories every active x402 offer, excluding previews and other payment rails', () => {
  const result = discoveryMonitorMatrix({ offers: [offer, { ...offer, id: 'preview', status: 'preview' }, { ...offer, id: 'other', payment: { protocol: 'stripe' } }] })
  assert.deepEqual(result.include, [{ offer: offer.id, name: 'Context Compression', subject, method: 'POST' }])
  const manifest = JSON.parse(readFileSync(new URL('../public/.well-known/x402-public-manifest.json', import.meta.url), 'utf8'))
  assert.equal(discoveryMonitorMatrix(manifest).include.length, manifest.offers.filter((row: any) => row.status === 'active' && row.payment?.protocol === 'x402').length)
  assert.ok(discoveryMonitorMatrix(manifest).include.length > 2)
})

test('monitor refuses malformed, empty, duplicate, shell-unsafe or off-origin inventory', () => {
  for (const offers of [[], [offer, offer], [{ ...offer, id: 'bad\nkey' }], [{ ...offer, canonicalResource: 'https://evil.invalid/api/v1/test' }],
    [{ ...offer, method: 'DELETE' }], [{ ...offer, canonicalResource: `${subject}?secret=anything` }], Array.from({ length: 101 }, (_, n) => ({ ...offer, id: `offer-${n}`, canonicalResource: `${subject}/${n}` }))]) {
    assert.throws(() => discoveryMonitorMatrix({ offers }))
  }
  assert.throws(() => discoveryMonitorMatrix(null))
})

test('only a completed successful comparison can close monitoring incidents', () => {
  assert.equal(classifyDiscoveryReport(clean(), subject, 'success'), 'clean')
  for (const outcome of ['failure', 'skipped', 'cancelled', '']) assert.equal(classifyDiscoveryReport(clean(), subject, outcome), 'monitor_failure')
  for (const report of [null, {}, { ...clean(), endpoint: 'https://other.invalid' }, { ...clean(), bazaar: undefined }, { ...clean(), live: undefined }, { ...clean(), checkedAt: 'bad' }]) {
    assert.equal(classifyDiscoveryReport(report, subject, 'success'), 'monitor_failure')
  }
})

test('runner/lookup failure is not mislabeled as metadata drift', () => {
  const report = clean()
  assert.equal(classifyDiscoveryReport({ ...report, findings: [finding('x402.bazaar.lookup')], summary: { errors: 0, warnings: 1 } }, subject, 'failure'), 'probe_failure')
  assert.equal(classifyDiscoveryReport({ ...report, findings: [finding('x402.network', 'error')], summary: { errors: 1, warnings: 0 } }, subject, 'failure'), 'probe_failure')
  assert.equal(classifyDiscoveryReport({ ...report, findings: [finding('x402.bazaar.stale_metadata')], summary: { errors: 0, warnings: 1 }, bazaar: { found: true, matchesLive: false } }, subject, 'failure'), 'drift')
  assert.equal(classifyDiscoveryReport({ ...report, findings: [finding('x402.bazaar.not_found')], summary: { errors: 0, warnings: 1 }, bazaar: { found: false } }, subject, 'failure'), 'listing_missing')
  assert.equal(classifyDiscoveryReport({ ...report, findings: [finding('x402.resource', 'error')], summary: { errors: 1, warnings: 0 } }, subject, 'failure'), 'contract_failure')
  assert.equal(classifyDiscoveryReport({ ...report, findings: [finding('x402.bazaar.stale_metadata')], summary: { errors: 0, warnings: 0 } }, subject, 'failure'), 'monitor_failure')
})

test('recovery health distinguishes unresolved payments from stale markers and unreadable data', () => {
  const rows = RECOVERY_HEALTH_STATES.map((state) => ({ state, count: '0' }))
  assert.equal(recoveryHealthFromRows(rows)?.state, 'ok')
  for (const state of RECOVERY_HEALTH_STATES) {
    const report = recoveryHealthFromRows(rows.map((row) => row.state === state ? { ...row, count: '1' } : row))
    assert.equal(report?.state, ['unknown', 'contradicted'].includes(state) ? 'fail' : 'warn')
  }
  for (const invalid of [null, [], [...rows, rows[0]], rows.slice(1), rows.map((row) => ({ ...row, count: '-1' }))]) assert.equal(recoveryHealthFromRows(invalid), null)
})
