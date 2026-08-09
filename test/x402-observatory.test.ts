import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

import type { DoctorReport } from '../lib/x402/doctor.ts'
import { authorizeObservatoryCron } from '../lib/x402/observatory-cron.ts'
import {
  observationFromDoctor,
  publicObservatorySnapshot,
  validateObservatoryResources,
  type ObservatoryResource,
} from '../lib/x402/observatory.ts'
import { PUBLIC_X402_OBSERVATORY_RESOURCES } from '../lib/x402/observatory-registry.ts'
import { runObservatorySweep } from '../lib/x402/observatory-runner.ts'

const resource: ObservatoryResource = {
  id: 'seller-resource', name: 'Seller resource', operator: 'Example operator',
  url: 'https://seller.example/api/resource', request: { method: 'POST' },
  boundedSettlement: { enabled: false },
}

function report(overrides: Partial<DoctorReport> = {}): DoctorReport {
  return {
    schemaVersion: '1.0.0', tool: { name: 'x402-doctor', version: '0.1.0' },
    endpoint: resource.url, checkedAt: '2026-08-09T00:00:00.000Z', durationMs: 42,
    ok: true, summary: { errors: 0, warnings: 0, notes: 0 },
    live: { status: 402, x402Version: 2, crawlerStatus: 402 },
    bazaar: { found: true, matchesLive: true, digestSource: 'catalog' },
    extensionResponses: [], findings: [], ...overrides,
  }
}

test('publishes only factual protocol and discovery states', () => {
  const observation = observationFromDoctor({ resource, report: report(), observationId: '00000000-0000-4000-8000-000000000001', observedAt: '2026-08-09T01:00:00.000Z' })
  assert.equal(observation.challengeReachable, 'pass')
  assert.equal(observation.v2Compliant, 'pass')
  assert.equal(observation.schemaValid, 'pass')
  assert.equal(observation.crawlerReceives402, 'pass')
  assert.equal(observation.bazaarState, 'current')
  assert.equal(observation.settlementState, 'disabled')
  assert.equal('score' in observation, false)
  assert.equal('trust' in observation, false)
})

test('missing Bazaar metadata is not misreported as an invalid schema', () => {
  const observation = observationFromDoctor({ resource, report: report({
    bazaar: undefined,
    live: { status: 402, x402Version: 2 },
    findings: [{ ruleId: 'x402.bazaar.missing', level: 'warning', message: 'No Bazaar declaration.' }],
  }) })
  assert.equal(observation.schemaValid, 'not_applicable')
  assert.equal(observation.crawlerReceives402, 'not_applicable')
  assert.equal(observation.bazaarState, 'not_declared')
})

test('network failures remain unknown rather than becoming a negative reputation signal', () => {
  const observation = observationFromDoctor({ resource, report: report({
    live: undefined, ok: false,
    findings: [{ ruleId: 'x402.network', level: 'error', message: 'Timed out.' }],
  }) })
  assert.equal(observation.challengeReachable, 'unknown')
  assert.equal(observation.v2Compliant, 'unknown')
  assert.equal(observation.schemaValid, 'unknown')
  assert.equal(observation.crawlerReceives402, 'unknown')
  assert.equal(observation.bazaarState, 'unknown')
})

test('the public snapshot exposes latest state and the last opt-in successful settlement separately', () => {
  const older = observationFromDoctor({ resource: { ...resource, boundedSettlement: { enabled: true, maximumAmountBaseUnits: '1000' } }, report: report({ live: { status: 402, x402Version: 2, crawlerStatus: 402, transaction: `0x${'a'.repeat(64)}`, paidStatus: 200 } }), observedAt: '2026-08-08T00:00:00.000Z' })
  const latest = observationFromDoctor({ resource, report: report(), observedAt: '2026-08-09T00:00:00.000Z' })
  const entry = publicObservatorySnapshot([resource], [older, latest])[0]!
  assert.equal(entry.latest?.observedAt, latest.observedAt)
  assert.equal(entry.lastSuccessfulBoundedSettlementAt, older.observedAt)
  assert.equal(entry.lastSuccessfulBoundedSettlementTransaction, older.settlementTransaction)
})

test('the registry is bounded, HTTPS-only, credential-free, and paid checks require a ceiling', () => {
  assert.doesNotThrow(() => validateObservatoryResources(PUBLIC_X402_OBSERVATORY_RESOURCES))
  assert.throws(() => validateObservatoryResources([{ ...resource, url: 'http://127.0.0.1/private' }]), /HTTPS/)
  assert.throws(() => validateObservatoryResources([{ ...resource, url: 'https://user:secret@example.com/resource' }]), /credential-free/)
  assert.throws(() => validateObservatoryResources([{ ...resource, url: 'https://127.0.0.1/private' }]), /public HTTPS DNS/)
  assert.throws(() => validateObservatoryResources([{ ...resource, request: { headers: { authorization: 'Bearer secret' } } }]), /sensitive headers/)
  assert.throws(() => validateObservatoryResources([{ ...resource, boundedSettlement: { enabled: true } }]), /ceiling/)
})

test('the default sweep is read-only and refuses a paid flag without a reviewed adapter', async () => {
  let calls = 0
  const observations = await runObservatorySweep({ resources: [resource], diagnose: async () => { calls += 1; return report() }, observedAt: '2026-08-09T00:00:00.000Z' })
  assert.equal(calls, 1)
  assert.equal(observations[0]?.settlementState, 'disabled')
  await assert.rejects(runObservatorySweep({ resources: [{ ...resource, boundedSettlement: { enabled: true, maximumAmountBaseUnits: '1000' } }], diagnose: async () => report() }), /separately reviewed paid-probe adapter/)
})

test('cron authorization fails closed and compares the configured secret', () => {
  assert.equal(authorizeObservatoryCron(new Request('https://example.com'), 'secret'), false)
  assert.equal(authorizeObservatoryCron(new Request('https://example.com', { headers: { authorization: 'Bearer wrong' } }), 'secret'), false)
  assert.equal(authorizeObservatoryCron(new Request('https://example.com', { headers: { authorization: 'Bearer secret' } }), 'secret'), true)
})

test('the migration is append-only and stores no request or response content', async () => {
  const migration = await readFile(new URL('../supabase/migrations/20260809000200_x402_conformance_observatory.sql', import.meta.url), 'utf8')
  const tableDefinition = migration.match(/create table[\s\S]+?\n\);/)?.[0] ?? ''
  assert.match(migration, /grant select, insert .* service_role/)
  assert.match(migration, /revoke update, delete, truncate .* service_role/)
  assert.doesNotMatch(tableDefinition, /request_body|response_body|payload|credential|ip_address|user_agent/)
})
