import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

import {
  CELESTIAL_ENTERPRISE_API_VERSION, CelestialEnterpriseValidationError,
  compileEnterpriseCelestialReport, parseCelestialEnterpriseRequest,
} from '../lib/celestial-enterprise/contracts.ts'
import { generateEvidenceJson, generateEvidencePdf } from '../lib/celestial-enterprise/export.ts'
import { decryptReportPayload, encryptReportPayload, roleAllows } from '../lib/celestial-enterprise/security.ts'

const request = {
  apiVersion: CELESTIAL_ENTERPRISE_API_VERSION,
  clientRequestId: 'birth_case_001',
  reportType: 'individual-birth',
  interpretationPack: { packId: 'facts-only', version: '1.0.0' },
  dataPolicy: {
    saveReport: true, retentionDays: 30,
    consent: { policyVersion: 'celestial-consent/1', basis: 'explicit-subject-consent', capturedAtUtc: '2026-08-17T10:00:00Z', consentReferenceSha256: `sha256:${'a'.repeat(64)}` },
  },
  input: { date: '1992-11-30', time: '20:09', timeZone: 'America/Chicago', latitudeDegrees: 48.601, longitudeDegrees: -93.411 },
} as const

test('enterprise request enforces consent, retention, and a frozen pack version', () => {
  assert.equal(parseCelestialEnterpriseRequest(request).reportType, 'individual-birth')
  assert.throws(() => parseCelestialEnterpriseRequest({ ...request, dataPolicy: { ...request.dataPolicy, consent: { ...request.dataPolicy.consent, basis: 'public-record' } } }), CelestialEnterpriseValidationError)
  assert.throws(() => parseCelestialEnterpriseRequest({ ...request, dataPolicy: { ...request.dataPolicy, saveReport: false } }), /invalid/i)
  assert.throws(() => parseCelestialEnterpriseRequest({ ...request, interpretationPack: { packId: 'facts-only', version: 'latest' } }), (error) => error instanceof CelestialEnterpriseValidationError && error.issues.some((issue) => issue.includes('unavailable')))
})

test('facts-only compilation strips interpretations and preserves reproducibility evidence', () => {
  const parsed = parseCelestialEnterpriseRequest(request)
  const first = compileEnterpriseCelestialReport('tenant_enterprise01', parsed, '2026-08-17T10:01:00Z')
  const second = compileEnterpriseCelestialReport('tenant_enterprise01', parsed, '2026-08-17T10:02:00Z')
  assert.equal(first.reportId, second.reportId)
  assert.equal(first.reproducibility.requestSha256, second.reproducibility.requestSha256)
  assert.equal(first.reproducibility.resultSha256, second.reproducibility.resultSha256)
  assert.deepEqual('traditions' in first.result ? first.result.traditions : null, [])
  assert.match(first.boundaries.join(' '), /do not upgrade empirical status/)
})

test('saved report encryption authenticates tenant and report identity', () => {
  const previous = process.env.CELESTIAL_REPORT_ENCRYPTION_KEY
  process.env.CELESTIAL_REPORT_ENCRYPTION_KEY = '01'.repeat(32)
  try {
    const payload = { reportId: 'celrep_0123456789abcdef01234567', private: 'not plaintext storage' }
    const encrypted = encryptReportPayload('tenant_enterprise01', payload.reportId, payload)
    assert.equal(encrypted.ciphertext.includes(payload.private), false)
    assert.deepEqual(decryptReportPayload('tenant_enterprise01', payload.reportId, encrypted.ciphertext), payload)
    assert.throws(() => decryptReportPayload('tenant_enterprise02', payload.reportId, encrypted.ciphertext))
  } finally {
    if (previous === undefined) delete process.env.CELESTIAL_REPORT_ENCRYPTION_KEY
    else process.env.CELESTIAL_REPORT_ENCRYPTION_KEY = previous
  }
})

test('RBAC keeps deletion, pack review, and billing permissions distinct', () => {
  assert.equal(roleAllows('developer', 'reports:create'), true)
  assert.equal(roleAllows('developer', 'reports:delete'), false)
  assert.equal(roleAllows('reviewer', 'packs:review'), true)
  assert.equal(roleAllows('billing', 'reports:read'), false)
})

test('JSON and PDF evidence exports carry the audit boundary', async () => {
  const report = compileEnterpriseCelestialReport('tenant_enterprise01', parseCelestialEnterpriseRequest(request), '2026-08-17T10:01:00Z')
  const json = generateEvidenceJson(report)
  assert.match(json, /celestial-evidence-export\/1/)
  assert.match(json, /resultSha256/)
  const pdf = await generateEvidencePdf(report)
  assert.equal(Buffer.from(pdf).subarray(0, 4).toString(), '%PDF')
})

test('migration and routes encode tenant isolation, erasure, metering, and delivery controls', async () => {
  const migration = await readFile(new URL('../supabase/migrations/20260817000400_celestial_enterprise_product.sql', import.meta.url), 'utf8')
  assert.match(migration, /encrypted_payload/)
  assert.match(migration, /enable row level security/)
  assert.match(migration, /delete_celestial_enterprise_report/)
  assert.match(migration, /purge_expired_celestial_reports/)
  assert.match(migration, /billable_units/)
  assert.match(migration, /for update skip locked/)
  assert.match(migration, /interval '15 minutes'/)
  assert.match(migration, /revoke delete, truncate/)
  const route = await readFile(new URL('../app/api/v1/celestial/reports/route.ts', import.meta.url), 'utf8')
  assert.match(route, /x-maha-zero-data-retention/)
  assert.match(route, /getEnterpriseReportByClientRequestId/)
  const webhook = await readFile(new URL('../lib/celestial-enterprise/webhooks.ts', import.meta.url), 'utf8')
  assert.match(webhook, /assertPublicUpstreamHost/)
  assert.match(webhook, /X-Maha-Webhook-Signature/)
})

test('SDK and guide expose the stable enterprise lifecycle without predictive claims', async () => {
  const sdk = await readFile(new URL('../lib/sdk/index.ts', import.meta.url), 'utf8')
  for (const method of ['createReport', 'getReport', 'deleteReport', 'createBatch', 'registerWebhook', 'exportReport']) assert.match(sdk, new RegExp(method))
  const guide = await readFile(new URL('../docs/celestial-evidence-api.md', import.meta.url), 'utf8')
  assert.match(guide, /not astrology's predictive validity/i)
  assert.match(guide, /Deployment checklist/)
  assert.match(guide, /executed order form/)
})
