import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

import {
  CABEZON_PREVIEW_SCHEMA_VERSION,
  CabezonPreviewError,
  MemoryCabezonLifecycleStore,
  buildCabezonEnquiryPlan,
  buildDeliveryReference,
  cabezonPreviewConfigFromEnvironment,
  createCabezonPreviewHandlers,
  digestJson,
  parseCabezonEnquiry,
  projectCabezonOffers,
  type CabezonPreviewConfig,
} from '../lib/cabezon-preview.ts'

const ROOT = new URL('../', import.meta.url)
const TOKEN = 'preview-test-token-that-is-at-least-32-bytes'
const SELLER = {
  did: 'did:web:mahastrategies.com:cabezon:seller',
  sadSha256: `sha256:${'1'.repeat(64)}`,
  endpoint: 'https://preview.mahastrategies.com/api/integrations/cabezon/preview',
}
const CUSTOMER = {
  did: 'did:web:cabezon.example:customers:preview-one',
  sadSha256: `sha256:${'2'.repeat(64)}`,
  endpoint: 'https://preview.cabezon.example/carp/customer',
}
const CONFIG: CabezonPreviewConfig = { seller: SELLER, customers: [CUSTOMER], token: TOKEN }

type LifecycleView = {
  lifecycleId: string
  requestSha256: string
  status: string
  deliveryReference: { referenceSha256: string; paymentEnabled: boolean } | null
  events: Array<{ sequence: number; type: string }>
  [key: string]: unknown
}
type HandlerBody = { operation?: string; lifecycle: LifecycleView; error?: { code: string }; [key: string]: unknown }

function request(url: string, init: RequestInit = {}): Request {
  return new Request(url, { ...init, headers: { authorization: `Bearer ${TOKEN}`, ...(init.headers ?? {}) } })
}

function jsonRequest(url: string, body: unknown, idempotencyKey: string): Request {
  return request(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'idempotency-key': idempotencyKey },
    body: JSON.stringify(body),
  })
}

function enquiry(overrides: Record<string, unknown> = {}) {
  const projection = projectCabezonOffers(SELLER)
  return {
    schemaVersion: CABEZON_PREVIEW_SCHEMA_VERSION,
    customer: CUSTOMER,
    seller: SELLER,
    offerCatalogSha256: projection.projectionSha256,
    offerId: 'mps-evidence-audit',
    question: 'Can Maha prepare a bounded evidence audit for this materials claim?',
    decisionContext: 'This is a Preview-only, non-purchase integration rehearsal.',
    ...overrides,
  }
}

async function body(response: Response) {
  return await response.json() as HandlerBody
}

test('Preview configuration fails closed outside Preview and requires exact CARP bindings', () => {
  assert.throws(() => cabezonPreviewConfigFromEnvironment({ NODE_ENV: 'test', VERCEL_ENV: 'production' } as NodeJS.ProcessEnv), (error: unknown) => error instanceof CabezonPreviewError && error.status === 404)
  const environment = {
    NODE_ENV: 'test',
    VERCEL_ENV: 'preview',
    CABEZON_PREVIEW_ENABLED: 'true',
    CABEZON_PREVIEW_TOKEN: TOKEN,
    CABEZON_PREVIEW_SELLER_BINDING_JSON: JSON.stringify(SELLER),
    CABEZON_PREVIEW_CUSTOMER_BINDINGS_JSON: JSON.stringify([CUSTOMER]),
  } as NodeJS.ProcessEnv
  assert.deepEqual(cabezonPreviewConfigFromEnvironment(environment), CONFIG)
  assert.throws(() => cabezonPreviewConfigFromEnvironment({ ...environment, CABEZON_PREVIEW_CUSTOMER_BINDINGS_JSON: JSON.stringify([CUSTOMER, CUSTOMER]) }), /must be unique/)
})

test('released offer projection is deterministic, read-only and makes purchase impossible', () => {
  const first = projectCabezonOffers(SELLER)
  const second = projectCabezonOffers(SELLER)
  assert.deepEqual(first, second)
  assert.equal(first.projectionSha256, second.projectionSha256)
  assert.equal(first.authority.paymentEnabled, false)
  assert.equal(first.authority.corpusMutationEnabled, false)
  assert.ok(first.offers.every((offer) => offer.states.information === 'informational' && offer.states.purchase === 'purchase_disabled'))
  assert.equal(first.offers.find((offer) => offer.id === 'mps-evidence-audit')?.states.enquiry, 'inquiry_available')
  assert.equal(first.offers.find((offer) => offer.id === 'mps-preflight')?.states.enquiry, 'unavailable')
  assert.doesNotMatch(JSON.stringify(first), /price|paymentAddress|wallet|checkout|releaseAuthority/i)
})

test('enquiry rejects stale catalogs, substituted endpoints and unavailable offers', () => {
  const projection = projectCabezonOffers(SELLER)
  const common = { config: CONFIG, projection, idempotencyKey: 'enquiry-key-0001', now: '2026-08-28T10:00:00Z' }
  assert.throws(() => buildCabezonEnquiryPlan({ ...common, enquiry: parseCabezonEnquiry(enquiry({ offerCatalogSha256: `sha256:${'f'.repeat(64)}` })) }), (error: unknown) => error instanceof CabezonPreviewError && error.code === 'offer_catalog_stale')
  assert.throws(() => buildCabezonEnquiryPlan({ ...common, enquiry: parseCabezonEnquiry(enquiry({ customer: { ...CUSTOMER, endpoint: 'https://attacker.example/customer' } })) }), (error: unknown) => error instanceof CabezonPreviewError && error.code === 'customer_identity_binding_mismatch')
  assert.throws(() => buildCabezonEnquiryPlan({ ...common, enquiry: parseCabezonEnquiry(enquiry({ seller: { ...SELLER, endpoint: 'https://attacker.example/seller' } })) }), (error: unknown) => error instanceof CabezonPreviewError && error.code === 'seller_identity_binding_mismatch')
  assert.throws(() => buildCabezonEnquiryPlan({ ...common, enquiry: parseCabezonEnquiry(enquiry({ offerId: 'mps-preflight' })) }), (error: unknown) => error instanceof CabezonPreviewError && error.code === 'offer_enquiry_unavailable')
})

test('free enquiry is bounded, private and replay-safe without persisting prose', async () => {
  const handlers = createCabezonPreviewHandlers({ config: CONFIG, store: new MemoryCabezonLifecycleStore(), now: () => '2026-08-28T10:00:00Z' })
  const missingToken = await handlers.enquire(new Request('https://preview.example/enquiries', { method: 'POST' }))
  assert.equal(missingToken.status, 401)
  const first = await handlers.enquire(jsonRequest('https://preview.example/enquiries', enquiry(), 'enquiry-key-0002'))
  const replay = await handlers.enquire(jsonRequest('https://preview.example/enquiries', enquiry(), 'enquiry-key-0002'))
  assert.equal(first.status, 201)
  assert.equal(replay.status, 200)
  const firstBody = await body(first)
  const replayBody = await body(replay)
  assert.equal(firstBody.operation, 'created')
  assert.equal(replayBody.operation, 'idempotent')
  assert.deepEqual(firstBody.lifecycle, replayBody.lifecycle)
  assert.deepEqual(firstBody.lifecycle.events.map((entry: { type: string }) => entry.type), ['enquiry_received', 'offer_returned'])
  assert.doesNotMatch(JSON.stringify(firstBody), /Can Maha prepare|integration rehearsal/)
  const conflict = await handlers.enquire(jsonRequest('https://preview.example/enquiries', enquiry({ question: 'Can Maha instead audit a different and unrelated technical assertion?' }), 'enquiry-key-0002'))
  assert.equal(conflict.status, 409)
  const conflictBody = await body(conflict)
  assert.ok(conflictBody.error)
  assert.equal(conflictBody.error.code, 'idempotency_conflict')
  const oversized = await handlers.enquire(jsonRequest('https://preview.example/enquiries', enquiry({ question: 'x'.repeat(17_000) }), 'enquiry-key-oversized'))
  assert.equal(oversized.status, 413)
})

test('delivery reference is deterministic and unavailable delivery fails closed', async () => {
  const projection = projectCabezonOffers(SELLER)
  const plan = buildCabezonEnquiryPlan({ enquiry: parseCabezonEnquiry(enquiry()), config: CONFIG, projection, idempotencyKey: 'enquiry-key-0003', now: '2026-08-28T10:00:00Z' })
  const first = buildDeliveryReference(plan.lifecycle, '2026-08-28T10:01:00Z')
  const second = buildDeliveryReference(plan.lifecycle, '2026-08-28T10:01:00Z')
  assert.deepEqual(first, second)
  assert.equal(first.referenceSha256, digestJson(Object.fromEntries(Object.entries(first).filter(([key]) => key !== 'referenceSha256'))))
  assert.equal(first.artifactSha256, null)
  assert.equal(first.paymentEnabled, false)

  const handlers = createCabezonPreviewHandlers({ config: CONFIG, store: new MemoryCabezonLifecycleStore(), now: () => '2026-08-28T10:01:00Z' })
  const missing = await handlers.deliver(jsonRequest('https://preview.example/delivery', { expectedRequestSha256: plan.lifecycle.requestSha256 }, 'delivery-key-0001'), plan.lifecycle.lifecycleId)
  assert.equal(missing.status, 404)
})

test('append-only enquiry to acknowledgement lifecycle is replay-safe and rejects substitution', async () => {
  const instants = ['2026-08-28T10:00:00Z', '2026-08-28T10:01:00Z', '2026-08-28T10:02:00Z']
  let index = 0
  const store = new MemoryCabezonLifecycleStore()
  const handlers = createCabezonPreviewHandlers({ config: CONFIG, store, now: () => instants[index++] ?? instants.at(-1)! })
  const enquiryResponse = await handlers.enquire(jsonRequest('https://preview.example/enquiries', enquiry(), 'enquiry-key-0004'))
  const offered = (await body(enquiryResponse)).lifecycle
  const wrongDelivery = await handlers.deliver(jsonRequest('https://preview.example/delivery', { expectedRequestSha256: `sha256:${'a'.repeat(64)}` }, 'delivery-key-0002'), offered.lifecycleId)
  assert.equal(wrongDelivery.status, 409)
  const acknowledgementBeforeDelivery = await handlers.acknowledge(jsonRequest('https://preview.example/ack', { deliveryReferenceSha256: `sha256:${'b'.repeat(64)}`, received: true }, 'ack-key-before-delivery'), offered.lifecycleId)
  assert.equal(acknowledgementBeforeDelivery.status, 409)
  assert.equal((await body(acknowledgementBeforeDelivery)).error?.code, 'acknowledgement_state_invalid')

  const deliveryResponse = await handlers.deliver(jsonRequest('https://preview.example/delivery', { expectedRequestSha256: offered.requestSha256 }, 'delivery-key-0003'), offered.lifecycleId)
  assert.equal(deliveryResponse.status, 201)
  const delivered = (await body(deliveryResponse)).lifecycle
  assert.ok(delivered.deliveryReference)
  const deliveryReferenceSha256 = delivered.deliveryReference.referenceSha256
  const deliveryReplay = await handlers.deliver(jsonRequest('https://preview.example/delivery', { expectedRequestSha256: offered.requestSha256 }, 'delivery-key-0003'), offered.lifecycleId)
  assert.equal(deliveryReplay.status, 200)
  assert.equal((await body(deliveryReplay)).operation, 'idempotent')

  const wrongAcknowledgement = await handlers.acknowledge(jsonRequest('https://preview.example/ack', { deliveryReferenceSha256: `sha256:${'b'.repeat(64)}`, received: true }, 'ack-key-0001'), offered.lifecycleId)
  assert.equal(wrongAcknowledgement.status, 409)
  const acknowledgementResponse = await handlers.acknowledge(jsonRequest('https://preview.example/ack', { deliveryReferenceSha256, received: true }, 'ack-key-0002'), offered.lifecycleId)
  assert.equal(acknowledgementResponse.status, 201)
  const acknowledged = (await body(acknowledgementResponse)).lifecycle
  assert.equal(acknowledged.status, 'acknowledged')
  assert.deepEqual(acknowledged.events.map((entry: { sequence: number; type: string }) => [entry.sequence, entry.type]), [
    [1, 'enquiry_received'], [2, 'offer_returned'], [3, 'delivery_recorded'], [4, 'acknowledgement_recorded'],
  ])
  const acknowledgementReplay = await handlers.acknowledge(jsonRequest('https://preview.example/ack', { deliveryReferenceSha256, received: true }, 'ack-key-0002'), offered.lifecycleId)
  assert.equal(acknowledgementReplay.status, 200)
  assert.equal((await body(acknowledgementReplay)).operation, 'idempotent')
})

test('migration enforces private append-only storage and bounded transition RPCs', async () => {
  const sql = await readFile(new URL('../supabase/migrations/20260828110000_cabezon_preview_seller_adapter.sql', import.meta.url), 'utf8')
  for (const table of ['cabezon_preview_lifecycles', 'cabezon_preview_lifecycle_events', 'cabezon_preview_action_idempotency']) assert.match(sql, new RegExp(`alter table public\\.${table} enable row level security`))
  assert.match(sql, /revoke all on table[\s\S]+from public, anon, authenticated/)
  assert.match(sql, /grant select on table[\s\S]+to service_role/)
  assert.doesNotMatch(sql, /grant (?:insert|update|delete)|grant select, insert|grant select, update/i)
  assert.equal((sql.match(/security definer/g) ?? []).length, 3)
  assert.match(sql, /before update or delete on public\.cabezon_preview_lifecycle_events/)
  assert.match(sql, /before update or delete on public\.cabezon_preview_action_idempotency/)
  for (const rpc of ['record_cabezon_preview_enquiry', 'read_cabezon_preview_lifecycle', 'record_cabezon_preview_delivery', 'record_cabezon_preview_acknowledgement']) assert.match(sql, new RegExp(`function public\\.${rpc}`))
  assert.doesNotMatch(sql, /price|payment_address|wallet|escrow/i)
})

test('Preview adapter is absent from crawl surfaces and cannot import release or audit machinery', async () => {
  const crawl = await Promise.all(['app/sitemap.ts', 'app/llms.txt/route.ts', 'lib/llms-manifest.ts', 'lib/openapi.ts'].map((path) => readFile(new URL(path, ROOT), 'utf8')))
  for (const text of crawl) assert.doesNotMatch(text, /cabezon\/preview|CABEZON Preview/)
  const adapterFiles = [
    'lib/cabezon-preview.ts', 'lib/cabezon-preview-store.ts', 'lib/cabezon-preview-runtime.ts',
    'app/api/integrations/cabezon/preview/offers/route.ts', 'app/api/integrations/cabezon/preview/enquiries/route.ts',
    'app/api/integrations/cabezon/preview/lifecycles/[lifecycleId]/delivery/route.ts',
    'app/api/integrations/cabezon/preview/lifecycles/[lifecycleId]/acknowledgement/route.ts',
  ]
  for (const path of adapterFiles) {
    const source = await readFile(new URL(path, ROOT), 'utf8')
    assert.doesNotMatch(source, /EPISTEMIC_RELEASE_AUTHORITY_TOKEN|OPERATIONS_TOKEN|frontier-source-alignment|pilot-source-alignment|evidence-dossier-rehearsal/)
  }
})

test('committed private lifecycle fixture is deterministic, append-only and non-commercial', async () => {
  const fixture = JSON.parse(await readFile(new URL('../fixtures/cabezon/preview-lifecycle.json', import.meta.url), 'utf8')) as {
    fixtureSha256: string
    mode: string
    lifecycle: LifecycleView
    authority: { paymentEnabled: boolean; authenticatedDeliveryEnabled: boolean }
    projection: { purchaseEnabledCount: number }
    [key: string]: unknown
  }
  const { fixtureSha256, ...base } = fixture
  assert.equal(fixtureSha256, digestJson(base))
  assert.equal(fixture.mode, 'private-local-lifecycle-canary')
  assert.deepEqual(fixture.lifecycle.events.map((entry: { sequence: number; type: string }) => [entry.sequence, entry.type]), [
    [1, 'enquiry_received'], [2, 'offer_returned'], [3, 'delivery_recorded'], [4, 'acknowledgement_recorded'],
  ])
  assert.equal(fixture.authority.paymentEnabled, false)
  assert.equal(fixture.authority.authenticatedDeliveryEnabled, false)
  assert.equal(fixture.projection.purchaseEnabledCount, 0)
  assert.doesNotMatch(JSON.stringify(fixture), /local-private-canary-token|Can Maha compile|EPISTEMIC_RELEASE_AUTHORITY_TOKEN/)
})

test('remote canary target is a protected secret rather than dispatcher-controlled input', async () => {
  const workflow = await readFile(new URL('../.github/workflows/preview-cabezon-seller-canary.yml', import.meta.url), 'utf8')
  const script = await readFile(new URL('../scripts/run-cabezon-preview-remote-canary.ts', import.meta.url), 'utf8')
  assert.doesNotMatch(workflow, /preview_url:/)
  assert.match(workflow, /CABEZON_PREVIEW_BASE_URL: \$\{\{ secrets\.CABEZON_PREVIEW_BASE_URL \}\}/)
  assert.match(script, /hostname\.endsWith\('\.vercel\.app'\)/)
  assert.match(script, /redirect: 'error'/)
  assert.doesNotMatch(script, /console\.(log|error)\([^\n]*(token|bypass|SELLER_BINDING|CUSTOMER_BINDING)/i)
})
