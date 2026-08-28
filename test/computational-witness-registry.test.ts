import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

import {
  buildWitnessSubmissionPlan,
  createWitnessRegistryHandlers,
  retentionPolicy,
  validatedWitnessReceipt,
  verifyWitnessRegistryRequest,
  WitnessRegistryConflictError,
  type WitnessAuthenticator,
  type WitnessRegistryPrincipal,
  type WitnessRegistryRead,
  type WitnessRegistryStore,
  type WitnessSubmissionPlan,
} from '../lib/computational-witness-registry.ts'
import type { ComputationalWitnessReceipt } from '../packages/evidence-dossier-builder/src/runtime-witness.ts'
import { canonicalJson } from '../packages/evidence-dossier-builder/src/canonicalize.ts'
import { apiProxyGate } from '../lib/api-proxy-policy.ts'

const ROOT = new URL('../', import.meta.url)
const fixture = async () => JSON.parse(await readFile(new URL('packages/maha-witness/fixtures/success-receipt.json', ROOT), 'utf8')) as ComputationalWitnessReceipt
const principal: WitnessRegistryPrincipal = { tenantId: 'tenant_fixture_0001', keyId: 'key_fixture_0001', tier: 'starter', zeroDataRetention: true, role: 'tenant-api-key', permissions: ['witness:verify', 'witness:submit', 'witness:read', 'witness:purge'] }
const authenticate: WitnessAuthenticator = async () => ({ ok: true, principal })
const resign = (receipt: ComputationalWitnessReceipt): ComputationalWitnessReceipt => {
  const snapshot = { ...receipt } as Record<string, unknown>
  delete snapshot.receiptSha256
  return { ...snapshot, receiptSha256: `sha256:${createHash('sha256').update(canonicalJson(snapshot)).digest('hex')}` } as unknown as ComputationalWitnessReceipt
}
const digest = (value: unknown) => `sha256:${createHash('sha256').update(canonicalJson(value)).digest('hex')}`

class MemoryStore implements WitnessRegistryStore {
  readonly plans: WitnessSubmissionPlan[] = []
  readonly records = new Map<string, WitnessRegistryRead>()
  readonly requests = new Map<string, string>()

  async submit(plan: WitnessSubmissionPlan) {
    const previous = this.requests.get(plan.idempotencyHash)
    if (previous && previous !== plan.requestSha256) throw new WitnessRegistryConflictError()
    const key = `${plan.tenantId}:${plan.receiptSha256}`
    const existing = this.records.get(key)
    this.requests.set(plan.idempotencyHash, plan.requestSha256)
    if (!existing) {
      this.plans.push(plan)
      this.records.set(key, { receiptSha256: plan.receiptSha256, schemaVersion: plan.receipt.schemaVersion, executionStatus: plan.receipt.execution.status, inputSha256: plan.receipt.inputSha256, outputSha256: plan.receipt.outputSha256, environmentSha256: plan.receipt.environmentSha256, artifactCount: plan.receipt.artifacts.length, retainedUntil: '2026-09-27T10:00:00Z', payloadAvailable: true, receipt: plan.receipt })
      return { status: 'created' as const, receiptSha256: plan.receiptSha256, retainedUntil: '2026-09-27T10:00:00Z', payloadAvailable: true }
    }
    return { status: previous ? 'idempotent' as const : 'replay' as const, receiptSha256: plan.receiptSha256, retainedUntil: existing.retainedUntil, payloadAvailable: existing.payloadAvailable }
  }

  async read(tenantId: string, receiptSha256: string) { return this.records.get(`${tenantId}:${receiptSha256}`) ?? null }

  async purge(tenantId: string, receiptSha256: string) {
    const record = this.records.get(`${tenantId}:${receiptSha256}`)
    if (!record) return { receiptSha256, payloadPurged: false, immutableIdentityRetained: false }
    this.records.set(`${tenantId}:${receiptSha256}`, { ...record, payloadAvailable: false, receipt: null })
    return { receiptSha256, payloadPurged: record.payloadAvailable, immutableIdentityRetained: true }
  }
}

function submissionRequest(receipt: ComputationalWitnessReceipt, overrides: { key?: string; days?: string; consent?: string } = {}) {
  return new Request('https://example.test/api/v1/witness/receipts', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer test-key',
      'Content-Type': 'application/json',
      'Idempotency-Key': overrides.key ?? 'witness-submit-001',
      'X-Maha-Witness-Retention-Consent': overrides.consent ?? 'persist-receipt',
      'X-Maha-Witness-Retention-Days': overrides.days ?? '30',
    },
    body: JSON.stringify(receipt),
  })
}

test('registry submission requires explicit retention consent before consuming an API unit', async () => {
  const authorizationModes: boolean[] = []
  const store = new MemoryStore()
  const handlers = createWitnessRegistryHandlers({ authenticate: async (_request, consume) => { authorizationModes.push(consume); return { ok: true, principal } }, store })
  const response = await handlers.submit(submissionRequest(await fixture(), { consent: 'no' }))
  assert.equal(response.status, 409)
  assert.deepEqual(authorizationModes, [false])
  assert.equal(store.plans.length, 0)
})

test('unauthenticated requests are rejected before their body is parsed', async () => {
  const store = new MemoryStore()
  const handlers = createWitnessRegistryHandlers({ authenticate: async () => ({ ok: false, status: 401, code: 'invalid_api_key' }), store })
  const response = await handlers.submit(new Request('https://example.test/api/v1/witness/receipts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{not-json' }))
  assert.equal(response.status, 401)
  assert.equal((await response.json()).error.code, 'invalid_api_key')
  assert.equal(store.records.size, 0)
})

test('a valid receipt is tenant-bound, idempotent, and records the scoped zero-retention override', async () => {
  const store = new MemoryStore()
  const handlers = createWitnessRegistryHandlers({ authenticate, store })
  const receipt = await fixture()
  const first = await handlers.submit(submissionRequest(receipt))
  assert.equal(first.status, 201)
  const body = await first.json()
  assert.equal(body.status, 'created')
  assert.equal(body.retention.zeroDataRetentionOverrideApplied, true)
  assert.equal(body.retention.immutableIdentityRetainedAfterPurge, true)
  const second = await handlers.submit(submissionRequest(receipt))
  assert.equal(second.status, 200)
  assert.equal((await second.json()).status, 'idempotent')
  assert.equal(store.plans.length, 1)
  assert.equal(store.plans[0].tenantId, principal.tenantId)
  assert.doesNotMatch(store.plans[0].actorFingerprint, /key_fixture/)
})

test('one idempotency key cannot cross a retention policy or receipt digest', async () => {
  const store = new MemoryStore()
  const handlers = createWitnessRegistryHandlers({ authenticate, store })
  const receipt = await fixture()
  assert.equal((await handlers.submit(submissionRequest(receipt))).status, 201)
  const conflict = await handlers.submit(submissionRequest(receipt, { days: '31' }))
  assert.equal(conflict.status, 409)
  assert.equal((await conflict.json()).error.code, 'idempotency_conflict')
})

test('authorization identity cannot change between validation and metering', async () => {
  const store = new MemoryStore()
  let calls = 0
  const handlers = createWitnessRegistryHandlers({
    authenticate: async () => ({ ok: true, principal: { ...principal, tenantId: calls++ === 0 ? principal.tenantId : 'tenant_fixture_9999' } }),
    store,
  })
  const response = await handlers.submit(submissionRequest(await fixture()))
  assert.equal(response.status, 401)
  assert.equal((await response.json()).error.code, 'api_key_identity_changed')
  assert.equal(store.records.size, 0)
})

test('tenant role permissions fail closed before persistence', async () => {
  const store = new MemoryStore()
  const handlers = createWitnessRegistryHandlers({ authenticate: async () => ({ ok: true, principal: { ...principal, permissions: ['witness:read'] } }), store })
  const response = await handlers.submit(submissionRequest(await fixture()))
  assert.equal(response.status, 403)
  assert.equal((await response.json()).error.code, 'witness_permission_denied')
  assert.equal(store.records.size, 0)
})

test('a different idempotency key for the same digest is a replay, not another receipt', async () => {
  const store = new MemoryStore()
  const handlers = createWitnessRegistryHandlers({ authenticate, store })
  const receipt = await fixture()
  await handlers.submit(submissionRequest(receipt))
  const replay = await handlers.submit(submissionRequest(receipt, { key: 'witness-submit-002' }))
  assert.equal((await replay.json()).status, 'replay')
  assert.equal(store.records.size, 1)
})

test('read and purge are tenant scoped and retain only immutable identity after deletion', async () => {
  const store = new MemoryStore()
  const handlers = createWitnessRegistryHandlers({ authenticate, store })
  const receipt = await fixture()
  await handlers.submit(submissionRequest(receipt))
  const getRequest = new Request('https://example.test', { headers: { Authorization: 'Bearer test-key' } })
  const before = await handlers.read(getRequest, receipt.receiptSha256)
  assert.equal(before.status, 200)
  assert.deepEqual((await before.json()).verification, { available: true, ok: true, findings: [] })
  const deletion = await handlers.purge(getRequest, receipt.receiptSha256)
  assert.deepEqual(await deletion.json(), { receiptSha256: receipt.receiptSha256, payloadPurged: true, immutableIdentityRetained: true, contentRetained: false })
  const after = await handlers.read(getRequest, receipt.receiptSha256)
  assert.equal(after.status, 410)
  const afterBody = await after.json()
  assert.equal(afterBody.receipt, null)
  assert.equal(afterBody.immutableIdentityRetained, true)
  assert.deepEqual(afterBody.verification, { available: false, reason: 'payload-unavailable' })

  const otherTenantHandlers = createWitnessRegistryHandlers({ authenticate: async () => ({ ok: true, principal: { ...principal, tenantId: 'tenant_fixture_9999' } }), store })
  assert.equal((await otherTenantHandlers.read(getRequest, receipt.receiptSha256)).status, 404)
})

test('verification is authenticated but never persists the supplied receipt', async () => {
  const store = new MemoryStore()
  const handlers = createWitnessRegistryHandlers({ authenticate, store })
  const response = await handlers.verify(new Request('https://example.test/api/v1/witness/verify', { method: 'POST', headers: { Authorization: 'Bearer test-key', 'Content-Type': 'application/json' }, body: JSON.stringify(await fixture()) }))
  assert.equal(response.status, 200)
  assert.equal((await response.json()).contentRetained, false)
  assert.equal(store.records.size, 0)
})

test('verification remains available without configuring the persistence store', async () => {
  const response = await verifyWitnessRegistryRequest(new Request('https://example.test/api/v1/witness/verify', {
    method: 'POST',
    headers: { Authorization: 'Bearer test-key', 'Content-Type': 'application/json' },
    body: JSON.stringify(await fixture()),
  }), authenticate)
  assert.equal(response.status, 200)
  const route = await readFile(new URL('app/api/v1/witness/verify/route.ts', ROOT), 'utf8')
  assert.doesNotMatch(route, /productionWitnessRegistryStore|computational-witness-registry-store/)
})

test('registry rejects credential metadata, cross-runtime floats, and schema extensions even when re-signed', async () => {
  const original = await fixture()
  const credential = structuredClone(original)
  ;(credential.environment as Record<string, unknown>).apiKey = 'must-not-persist'
  credential.environmentSha256 = digest(credential.environment)
  assert.throws(() => validatedWitnessReceipt(resign(credential)), /Credential-shaped metadata/)

  const floating = structuredClone(original)
  ;(floating.configuration as Record<string, unknown>).tolerance = 0.1
  assert.throws(() => validatedWitnessReceipt(resign(floating)), /decimal strings/)

  const extended = { ...original, rawEnvironment: { HOME: '/private/path' } } as unknown as ComputationalWitnessReceipt
  assert.throws(() => validatedWitnessReceipt(resign(extended)), /undeclared top-level field/)
})

test('submission plans hash private identifiers and bind retention into the request digest', async () => {
  const receipt = validatedWitnessReceipt(await fixture())
  const first = buildWitnessSubmissionPlan({ principal, receipt, idempotencyKey: 'witness-submit-001', retentionDays: 30 })
  const second = buildWitnessSubmissionPlan({ principal, receipt, idempotencyKey: 'witness-submit-001', retentionDays: 31 })
  assert.notEqual(first.requestSha256, second.requestSha256)
  assert.match(first.jobIdSha256, /^sha256:/)
  assert.notEqual(first.jobIdSha256, receipt.jobId)
  assert.equal(retentionPolicy(submissionRequest(receipt)).days, 30)
})

test('the migration separates immutable identity from purgeable payloads and restricts database access', async () => {
  const sql = await readFile(new URL('supabase/migrations/20260828100000_computational_witness_registry.sql', ROOT), 'utf8')
  for (const table of ['computational_witness_receipts', 'computational_witness_payloads', 'computational_witness_submissions', 'computational_witness_payload_events']) assert.match(sql, new RegExp(`create table public\\.${table}`))
  assert.match(sql, /create function public\.reject_computational_witness_mutation\(\)/)
  assert.match(sql, /computational_witness_receipts_immutable[\s\S]*reject_computational_witness_mutation/)
  assert.match(sql, /computational_witness_submissions_immutable[\s\S]*reject_computational_witness_mutation/)
  assert.match(sql, /pg_advisory_xact_lock\(hashtextextended\(p_tenant_id \|\| ':' \|\| p_idempotency_hash, 0\)\)/)
  assert.match(sql, /v_existing_receipt\.retention_days <> p_retention_days/)
  assert.match(sql, /delete from public\.computational_witness_payloads/)
  assert.doesNotMatch(sql, /delete from public\.computational_witness_receipts/)
  assert.match(sql, /revoke all on table[\s\S]*from public, anon, authenticated, service_role/)
  assert.match(sql, /grant execute on function public\.record_computational_witness_receipt[\s\S]*to service_role/)
  assert.match(sql, /idempotency key cannot cross request digests/)
  assert.match(sql, /This records provenance integrity, not scientific validity or independent reproduction/)
})

test('witness registry routes are private machine APIs and never enter discovery or indexing', async () => {
  const surfaces = await Promise.all(['app/sitemap.ts', 'app/llms.txt/route.ts', 'lib/openapi.ts', 'lib/llms-manifest.ts'].map((path) => readFile(new URL(path, ROOT), 'utf8')))
  for (const source of surfaces) assert.doesNotMatch(source, /api\/v1\/witness|computational witness registry/i)
  assert.equal(apiProxyGate('/api/v1/witness/receipts', 'POST', true), 'self_managed')
  assert.equal(apiProxyGate(`/api/v1/witness/receipts/sha256:${'a'.repeat(64)}`, 'GET', true), 'self_managed')
  assert.equal(apiProxyGate('/api/v1/witness/verify', 'POST', true), 'self_managed')
})

test('the daily retention cron is registered and separately authenticated', async () => {
  const [vercel, route] = await Promise.all([
    readFile(new URL('vercel.json', ROOT), 'utf8'),
    readFile(new URL('app/api/cron/computational-witness-retention/route.ts', ROOT), 'utf8'),
  ])
  assert.match(vercel, /api\/cron\/computational-witness-retention/)
  assert.match(route, /CRON_SECRET/)
  assert.match(route, /timingSafeEqual/)
  assert.match(route, /immutableIdentityRetained: true/)
})

test('Preview and Production lifecycle workflows are scope-separated around one receipt lifecycle', async () => {
  const [migrationWorkflow, previewWorkflow, productionWorkflow, canary] = await Promise.all([
    readFile(new URL('.github/workflows/preview-migrations.yml', ROOT), 'utf8'),
    readFile(new URL('.github/workflows/preview-computational-witness-canary.yml', ROOT), 'utf8'),
    readFile(new URL('.github/workflows/production-computational-witness-canary.yml', ROOT), 'utf8'),
    readFile(new URL('scripts/run-witness-lifecycle-canary.py', ROOT), 'utf8'),
  ])
  assert.match(migrationWorkflow, /20260828100000_computational_witness_registry\.sql/)
  assert.match(migrationWorkflow, /immutable_witness=/)
  assert.match(migrationWorkflow, /--single-transaction/)
  for (const object of ['witness_receipts', 'witness_payloads', 'witness_submissions', 'witness_payload_events', 'record_witness', 'read_witness', 'purge_witness', 'expire_witness']) assert.match(migrationWorkflow, new RegExp(`${object}=`))
  assert.match(previewWorkflow, /environment: preview-e2e/)
  assert.match(previewWorkflow, /WITNESS_CANARY_SCOPE: preview/)
  assert.match(previewWorkflow, /RUN PRIVATE WITNESS CANARY/)
  assert.doesNotMatch(previewWorkflow, /production-database|production-canary/)
  assert.match(productionWorkflow, /name: production-canary/)
  assert.match(productionWorkflow, /WITNESS_CANARY_SCOPE: production/)
  assert.match(productionWorkflow, /WITNESS_CANARY_PROVISION_DISPOSABLE_KEY: 'true'/)
  assert.match(productionWorkflow, /RUN PRODUCTION WITNESS CANARY/)
  assert.match(productionWorkflow, /test "\$TEST_API_URL" = 'https:\/\/www\.mahastrategies\.com'/)
  assert.doesNotMatch(productionWorkflow, /preview-e2e|PREVIEW_CANARY_API_KEY|PRODUCTION_CANARY_API_KEY/)
  for (const method of ['POST', 'GET', 'DELETE']) assert.match(canary, new RegExp(`request\\(\"${method}\"`))
  assert.match(canary, /expected=410/)
  assert.match(canary, /immutableIdentityRetained/)
  assert.match(canary, /base_url != "https:\/\/www\.mahastrategies\.com"/)
  assert.match(canary, /hostname\.endswith\("mahastrategies\.com"\)/)
  assert.match(canary, /\/api\/v1\/keys\/generate/)
  assert.match(canary, /\/api\/v1\/keys\/revoke/)
  assert.match(canary, /Production must provision a disposable canary key and cannot accept a shared API key/)
  assert.match(canary, /lifecycle_state\["created"\] and not lifecycle_state\["purged"\]/)
  assert.doesNotMatch(canary, /print\(api_key|print\(bypass/)
})
