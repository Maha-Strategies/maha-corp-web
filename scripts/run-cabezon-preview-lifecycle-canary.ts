import { mkdir, writeFile } from 'node:fs/promises'

import {
  CABEZON_PREVIEW_SCHEMA_VERSION,
  MemoryCabezonLifecycleStore,
  createCabezonPreviewHandlers,
  digestJson,
  projectCabezonOffers,
  type CabezonPreviewConfig,
} from '../lib/cabezon-preview.ts'

const OUTPUT_URL = new URL('../fixtures/cabezon/preview-lifecycle.json', import.meta.url)
const TOKEN = 'local-private-canary-token-at-least-32-bytes'
const SELLER = {
  did: 'did:web:mahastrategies.com:cabezon:seller',
  sadSha256: `sha256:${'1'.repeat(64)}`,
  endpoint: 'https://preview.mahastrategies.com/api/integrations/cabezon/preview',
}
const CUSTOMER = {
  did: 'did:web:cabezon.example:customers:private-canary',
  sadSha256: `sha256:${'2'.repeat(64)}`,
  endpoint: 'https://preview.cabezon.example/carp/customer',
}

type CanaryLifecycle = {
  lifecycleId: string
  requestSha256: string
  status: string
  deliveryReference: { referenceSha256: string; paymentEnabled: boolean }
  events: Array<{ sequence: number; type: string }>
  [key: string]: unknown
}
type CanaryResponse = { operation?: string; lifecycle: CanaryLifecycle; [key: string]: unknown }

function jsonRequest(url: string, body: unknown, idempotencyKey: string): Request {
  return new Request(url, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${TOKEN}`,
      'content-type': 'application/json',
      'idempotency-key': idempotencyKey,
    },
    body: JSON.stringify(body),
  })
}

async function responseBody(response: Response): Promise<CanaryResponse> {
  return await response.json() as CanaryResponse
}

function invariant(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`CABEZON Preview canary failed: ${message}`)
}

export async function runCabezonPreviewLifecycleCanary() {
  const config: CabezonPreviewConfig = { seller: SELLER, customers: [CUSTOMER], token: TOKEN }
  const projection = projectCabezonOffers(SELLER)
  const instants = [
    '2026-08-28T11:57:00Z', '2026-08-28T11:58:00Z', '2026-08-28T11:59:00Z',
    '2026-08-28T12:00:00Z', '2026-08-28T12:01:00Z', '2026-08-28T12:02:00Z', '2026-08-28T12:03:00Z',
  ]
  let instantIndex = 0
  const handlers = createCabezonPreviewHandlers({
    config,
    store: new MemoryCabezonLifecycleStore(),
    now: () => instants[instantIndex++] ?? instants.at(-1)!,
  })
  const enquiry = {
    schemaVersion: CABEZON_PREVIEW_SCHEMA_VERSION,
    customer: CUSTOMER,
    seller: SELLER,
    offerCatalogSha256: projection.projectionSha256,
    offerId: 'mps-evidence-audit',
    question: 'Can Maha compile a bounded evidence dossier for this private canary?',
    decisionContext: 'No payment, autonomous execution or canonical release is authorised.',
  }

  const stale = await handlers.enquire(jsonRequest('https://preview.example/enquiries', { ...enquiry, offerCatalogSha256: `sha256:${'f'.repeat(64)}` }, 'canary-stale-0001'))
  const substituted = await handlers.enquire(jsonRequest('https://preview.example/enquiries', { ...enquiry, customer: { ...CUSTOMER, endpoint: 'https://substituted.example/customer' } }, 'canary-substitute-0001'))
  const unavailable = await handlers.enquire(jsonRequest('https://preview.example/enquiries', { ...enquiry, offerId: 'mps-preflight' }, 'canary-unavailable-0001'))
  invariant(stale.status === 409, 'stale offer projection was not rejected')
  invariant(substituted.status === 403, 'substituted customer endpoint was not rejected')
  invariant(unavailable.status === 409, 'informational-only offer accepted an enquiry')

  const offeredResponse = await handlers.enquire(jsonRequest('https://preview.example/enquiries', enquiry, 'canary-enquiry-0001'))
  const offeredBody = await responseBody(offeredResponse)
  const replayResponse = await handlers.enquire(jsonRequest('https://preview.example/enquiries', enquiry, 'canary-enquiry-0001'))
  const replayBody = await responseBody(replayResponse)
  invariant(offeredResponse.status === 201 && offeredBody.operation === 'created', 'enquiry was not created')
  invariant(replayResponse.status === 200 && replayBody.operation === 'idempotent', 'enquiry replay was not idempotent')
  invariant(JSON.stringify(offeredBody.lifecycle) === JSON.stringify(replayBody.lifecycle), 'enquiry replay changed the lifecycle')

  const offered = offeredBody.lifecycle
  const prematureAcknowledgement = await handlers.acknowledge(jsonRequest('https://preview.example/acknowledgement', {
    deliveryReferenceSha256: `sha256:${'b'.repeat(64)}`,
    received: true,
  }, 'canary-premature-ack-0001'), offered.lifecycleId)
  invariant(prematureAcknowledgement.status === 409, 'acknowledgement succeeded while delivery was unavailable')
  const deliveryResponse = await handlers.deliver(jsonRequest('https://preview.example/delivery', { expectedRequestSha256: offered.requestSha256 }, 'canary-delivery-0001'), offered.lifecycleId)
  const deliveredBody = await responseBody(deliveryResponse)
  invariant(deliveryResponse.status === 201 && deliveredBody.lifecycle.status === 'delivered', 'delivery was not recorded')
  const deliveryReplay = await handlers.deliver(jsonRequest('https://preview.example/delivery', { expectedRequestSha256: offered.requestSha256 }, 'canary-delivery-0001'), offered.lifecycleId)
  invariant(deliveryReplay.status === 200 && (await responseBody(deliveryReplay)).operation === 'idempotent', 'delivery replay was not idempotent')

  const acknowledgementResponse = await handlers.acknowledge(jsonRequest('https://preview.example/acknowledgement', {
    deliveryReferenceSha256: deliveredBody.lifecycle.deliveryReference.referenceSha256,
    received: true,
  }, 'canary-acknowledgement-0001'), offered.lifecycleId)
  const acknowledgedBody = await responseBody(acknowledgementResponse)
  invariant(acknowledgementResponse.status === 201 && acknowledgedBody.lifecycle.status === 'acknowledged', 'acknowledgement was not recorded')
  invariant(acknowledgedBody.lifecycle.events.length === 4, 'lifecycle does not contain exactly four append-only events')
  invariant(acknowledgedBody.lifecycle.events.map((entry: { sequence: number }) => entry.sequence).join(',') === '1,2,3,4', 'event sequence is not contiguous')
  invariant(acknowledgedBody.lifecycle.deliveryReference.paymentEnabled === false, 'delivery reference enabled payment')

  const base = {
    schemaVersion: 'maha-cabezon-preview-canary/0.1',
    mode: 'private-local-lifecycle-canary',
    adapterSchemaVersion: CABEZON_PREVIEW_SCHEMA_VERSION,
    projection: {
      sourceCatalogSha256: projection.sourceCatalog.sha256,
      projectionSha256: projection.projectionSha256,
      offerCount: projection.offers.length,
      inquiryAvailableCount: projection.offers.filter((offer) => offer.states.enquiry === 'inquiry_available').length,
      purchaseEnabledCount: 0,
    },
    identityBindings: {
      sellerDid: SELLER.did,
      sellerBindingSha256: digestJson(SELLER),
      customerDid: CUSTOMER.did,
      customerBindingSha256: digestJson(CUSTOMER),
      exactBindingRequired: true,
    },
    negativeChecks: {
      staleOfferStatus: stale.status,
      substitutedEndpointStatus: substituted.status,
      unavailableOfferStatus: unavailable.status,
      unavailableDeliveryStatus: prematureAcknowledgement.status,
    },
    replayChecks: { enquiry: 'idempotent', delivery: 'idempotent' },
    lifecycle: acknowledgedBody.lifecycle,
    authority: {
      paymentEnabled: false,
      escrowEnabled: false,
      authenticatedDeliveryEnabled: false,
      corpusMutationEnabled: false,
      canonicalReleaseEnabled: false,
    },
  }
  return { ...base, fixtureSha256: digestJson(base) }
}

const report = await runCabezonPreviewLifecycleCanary()
const serialized = `${JSON.stringify(report, null, 2)}\n`
if (process.argv.includes('--write')) {
  await mkdir(new URL('./', OUTPUT_URL), { recursive: true })
  await writeFile(OUTPUT_URL, serialized, 'utf8')
}
process.stdout.write(serialized)
