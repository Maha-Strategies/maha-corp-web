import { mkdir, writeFile } from 'node:fs/promises'

import { digestJson, parseCarpIdentityBinding } from '../lib/cabezon-preview.ts'

function required(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`${name} is required.`)
  return value
}

function invariant(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`CABEZON Preview remote canary failed: ${message}`)
}

const baseUrl = new URL(required('CABEZON_PREVIEW_BASE_URL'))
invariant(baseUrl.protocol === 'https:', 'target must use HTTPS')
invariant(baseUrl.hostname.endsWith('.vercel.app'), 'target must be a preconfigured Vercel Preview hostname')
invariant(baseUrl.pathname === '/' && !baseUrl.search && !baseUrl.hash, 'target must be an origin without path, query or fragment')
const token = required('CABEZON_PREVIEW_TOKEN')
const seller = parseCarpIdentityBinding(JSON.parse(required('CABEZON_PREVIEW_SELLER_BINDING_JSON')), 'seller')
const customer = parseCarpIdentityBinding(JSON.parse(required('CABEZON_PREVIEW_CANARY_CUSTOMER_BINDING_JSON')), 'customer')
const runId = required('CABEZON_PREVIEW_CANARY_RUN_ID').replace(/[^A-Za-z0-9._:-]/g, '-').slice(0, 80)
invariant(runId.length >= 8, 'run id is too short')
const bypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET?.trim()

type ProjectedOffer = { id: string; states: { enquiry: 'inquiry_available' | 'unavailable' } }
type OfferProjection = {
  schemaVersion: string
  projectionSha256: string
  offers: ProjectedOffer[]
  authority: { paymentEnabled: boolean }
}
type RemoteLifecycle = {
  lifecycleId: string
  requestSha256: string
  status: string
  deliveryReference: { referenceSha256: string }
  acknowledgementSha256: string | null
  events: Array<{ type: string }>
}
type RemoteResponse = { operation?: string; lifecycle: RemoteLifecycle }

function url(path: string) { return new URL(path, baseUrl).toString() }
function headers(idempotencyKey?: string) {
  return {
    authorization: `Bearer ${token}`,
    ...(idempotencyKey ? { 'content-type': 'application/json', 'idempotency-key': idempotencyKey } : {}),
    ...(bypass ? { 'x-vercel-protection-bypass': bypass } : {}),
  }
}
async function json<T>(response: Response): Promise<T> { return await response.json() as T }
async function post(path: string, body: unknown, key: string) {
  return fetch(url(path), { method: 'POST', headers: headers(key), body: JSON.stringify(body), redirect: 'error' })
}

const offersResponse = await fetch(url('/api/integrations/cabezon/preview/offers'), { headers: headers(), redirect: 'error' })
invariant(offersResponse.status === 200, `offer projection returned ${offersResponse.status}`)
const projection = await json<OfferProjection>(offersResponse)
const selected = projection.offers.find((offer) => offer.states.enquiry === 'inquiry_available')
const unavailable = projection.offers.find((offer) => offer.states.enquiry === 'unavailable')
invariant(selected && unavailable, 'projection must contain both enquiry states')
invariant(projection.authority.paymentEnabled === false, 'projection enabled payment')

const enquiry = {
  schemaVersion: projection.schemaVersion,
  customer,
  seller,
  offerCatalogSha256: projection.projectionSha256,
  offerId: selected.id,
  question: 'Can Maha accept this bounded Preview-only lifecycle canary enquiry?',
  decisionContext: 'Synthetic operational canary; no payment or external delivery.',
}
const staleResponse = await post('/api/integrations/cabezon/preview/enquiries', { ...enquiry, offerCatalogSha256: `sha256:${'f'.repeat(64)}` }, `stale-${runId}`)
const substitutedResponse = await post('/api/integrations/cabezon/preview/enquiries', { ...enquiry, customer: { ...customer, endpoint: 'https://substituted.invalid/customer' } }, `substitute-${runId}`)
const unavailableResponse = await post('/api/integrations/cabezon/preview/enquiries', { ...enquiry, offerId: unavailable.id }, `unavailable-${runId}`)
invariant(staleResponse.status === 409, 'stale projection was not rejected')
invariant(substitutedResponse.status === 403, 'substituted endpoint was not rejected')
invariant(unavailableResponse.status === 409, 'unavailable enquiry was not rejected')

const enquiryKey = `enquiry-${runId}`
const enquiryResponse = await post('/api/integrations/cabezon/preview/enquiries', enquiry, enquiryKey)
const offered = await json<RemoteResponse>(enquiryResponse)
invariant(enquiryResponse.status === 201 && offered.operation === 'created', 'enquiry was not created')
const replayResponse = await post('/api/integrations/cabezon/preview/enquiries', enquiry, enquiryKey)
invariant(replayResponse.status === 200 && (await json<RemoteResponse>(replayResponse)).operation === 'idempotent', 'enquiry replay was not idempotent')

const lifecycleId = offered.lifecycle.lifecycleId as string
const prematureAcknowledgementResponse = await post(`/api/integrations/cabezon/preview/lifecycles/${lifecycleId}/acknowledgement`, {
  deliveryReferenceSha256: `sha256:${'b'.repeat(64)}`,
  received: true,
}, `premature-ack-${runId}`)
invariant(prematureAcknowledgementResponse.status === 409, 'acknowledgement succeeded while delivery was unavailable')
const deliveryResponse = await post(`/api/integrations/cabezon/preview/lifecycles/${lifecycleId}/delivery`, { expectedRequestSha256: offered.lifecycle.requestSha256 }, `delivery-${runId}`)
const delivered = await json<RemoteResponse>(deliveryResponse)
invariant(deliveryResponse.status === 201 && delivered.lifecycle.status === 'delivered', 'delivery reference was not recorded')
const acknowledgementResponse = await post(`/api/integrations/cabezon/preview/lifecycles/${lifecycleId}/acknowledgement`, {
  deliveryReferenceSha256: delivered.lifecycle.deliveryReference.referenceSha256,
  received: true,
}, `ack-${runId}`)
const acknowledged = await json<RemoteResponse>(acknowledgementResponse)
invariant(acknowledgementResponse.status === 201 && acknowledged.lifecycle.status === 'acknowledged', 'acknowledgement was not recorded')
invariant(acknowledged.lifecycle.events.length === 4, 'event ledger is not four entries')

const base = {
  schemaVersion: 'maha-cabezon-preview-remote-canary/0.1',
  targetHost: baseUrl.hostname,
  runId,
  tokenSha256: digestJson(token),
  projectionSha256: projection.projectionSha256,
  lifecycleId,
  lifecycleStatus: acknowledged.lifecycle.status,
  eventTypes: acknowledged.lifecycle.events.map((entry: { type: string }) => entry.type),
  deliveryReferenceSha256: acknowledged.lifecycle.deliveryReference.referenceSha256,
  acknowledgementSha256: acknowledged.lifecycle.acknowledgementSha256,
  negativeStatuses: { stale: staleResponse.status, substituted: substitutedResponse.status, unavailable: unavailableResponse.status, unavailableDelivery: prematureAcknowledgementResponse.status },
  authority: { paymentEnabled: false, externalDeliveryEnabled: false, canonicalReleaseEnabled: false },
}
const report = { ...base, evidenceSha256: digestJson(base) }
const output = `${JSON.stringify(report, null, 2)}\n`
const evidencePath = process.env.CABEZON_PREVIEW_CANARY_EVIDENCE?.trim()
if (evidencePath) {
  const file = new URL(`file://${evidencePath}`)
  await mkdir(new URL('./', file), { recursive: true })
  await writeFile(file, output, 'utf8')
}
process.stdout.write(output)
