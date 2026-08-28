import { createHash, timingSafeEqual } from 'node:crypto'

import agentOffers from '../content/discovery/agent-offers.json' with { type: 'json' }
import { canonicalJson } from './evidence-dossier/digest.ts'

export const CABEZON_PREVIEW_SCHEMA_VERSION = 'maha-cabezon-preview/1.0' as const
export const CABEZON_PREVIEW_MAX_BYTES = 16_384
export const CABEZON_PREVIEW_HEADERS = {
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
  'X-Robots-Tag': 'noindex, nofollow, noarchive',
} as const

const DIGEST = /^sha256:[a-f0-9]{64}$/
const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,159}$/
const DID = /^did:[a-z0-9]+:[A-Za-z0-9._:%-]{8,240}$/
const LIFECYCLE_ID = /^cbz_[a-f0-9]{32}$/
const UTC_SECOND = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/
const UTC_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/

export type CabezonOfferState = {
  information: 'informational'
  enquiry: 'inquiry_available' | 'unavailable'
  purchase: 'purchase_disabled'
}

export interface CarpIdentityBinding {
  did: string
  sadSha256: string
  endpoint: string
}

export interface CabezonPreviewConfig {
  seller: CarpIdentityBinding
  customers: readonly CarpIdentityBinding[]
  token: string
}

export interface CabezonProjectedOffer {
  id: string
  name: string
  serviceUrl: string
  sourceStatus: string
  states: CabezonOfferState
}

export interface CabezonOfferProjection {
  schemaVersion: typeof CABEZON_PREVIEW_SCHEMA_VERSION
  mode: 'preview-no-payment'
  seller: CarpIdentityBinding
  sourceCatalog: { version: string; updatedAt: string; sha256: string }
  offers: CabezonProjectedOffer[]
  projectionSha256: string
  authority: {
    paymentEnabled: false
    escrowEnabled: false
    autonomousExecutionEnabled: false
    corpusMutationEnabled: false
    canonicalReleaseEnabled: false
  }
}

export interface CabezonEnquiryInput {
  schemaVersion: typeof CABEZON_PREVIEW_SCHEMA_VERSION
  customer: CarpIdentityBinding
  seller: CarpIdentityBinding
  offerCatalogSha256: string
  offerId: string
  question: string
  decisionContext?: string
}

export type CabezonLifecycleStatus = 'offered' | 'delivered' | 'acknowledged'
export type CabezonEventType = 'enquiry_received' | 'offer_returned' | 'delivery_recorded' | 'acknowledgement_recorded'

export interface CabezonLifecycleEvent {
  sequence: number
  type: CabezonEventType
  occurredAt: string
  payloadSha256: string
}

export interface CabezonDeliveryReference {
  deliveryReferenceVersion: '0.1'
  lifecycleId: string
  orderId: string
  sellerDid: string
  deliveredAt: string
  requestSha256: string
  resultSha256: string
  artifactSha256: null
  retrieval: { mode: 'direct_response'; reference: string }
  status: 'delivered'
  paymentEnabled: false
  referenceSha256: string
}

export interface CabezonLifecycle {
  lifecycleId: string
  idempotencyHash: string
  requestSha256: string
  customer: CarpIdentityBinding
  seller: CarpIdentityBinding
  offerId: string
  offerProjectionSha256: string
  status: CabezonLifecycleStatus
  createdAt: string
  updatedAt: string
  deliveryReference: CabezonDeliveryReference | null
  acknowledgementSha256: string | null
  events: CabezonLifecycleEvent[]
}

export interface CabezonEnquiryPlan {
  lifecycle: CabezonLifecycle
  questionSha256: string
  decisionContextSha256: string | null
}

export interface CabezonLifecycleStore {
  submitEnquiry(plan: CabezonEnquiryPlan): Promise<{ status: 'created' | 'idempotent'; lifecycle: CabezonLifecycle }>
  recordDelivery(input: { lifecycleId: string; idempotencyHash: string; requestSha256: string; deliveredAt: string; deliveryReference: CabezonDeliveryReference; updatedLifecycle: CabezonLifecycle }): Promise<{ status: 'created' | 'idempotent'; lifecycle: CabezonLifecycle }>
  acknowledge(input: { lifecycleId: string; idempotencyHash: string; requestSha256: string; deliveryReferenceSha256: string; acknowledgementSha256: string; acknowledgedAt: string; updatedLifecycle: CabezonLifecycle }): Promise<{ status: 'created' | 'idempotent'; lifecycle: CabezonLifecycle }>
  read(lifecycleId: string): Promise<CabezonLifecycle | null>
}

export class CabezonPreviewError extends Error {
  readonly status: 400 | 401 | 403 | 404 | 409 | 413 | 415 | 503
  readonly code: string

  constructor(status: 400 | 401 | 403 | 404 | 409 | 413 | 415 | 503, code: string, message: string) {
    super(message)
    this.status = status
    this.code = code
    this.name = 'CabezonPreviewError'
  }
}

function sha256(value: string): string {
  return `sha256:${createHash('sha256').update(value, 'utf8').digest('hex')}`
}

export function digestJson(value: unknown): string {
  return sha256(canonicalJson(value))
}

function exactObject(value: unknown, field: string, allowed: readonly string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new CabezonPreviewError(400, 'invalid_request', `${field} must be an object.`)
  const record = value as Record<string, unknown>
  const unexpected = Object.keys(record).filter((key) => !allowed.includes(key))
  if (unexpected.length) throw new CabezonPreviewError(400, 'undeclared_field', `${field} contains undeclared fields.`)
  return record
}

function line(value: unknown, field: string, minimum: number, maximum: number): string {
  if (typeof value !== 'string') throw new CabezonPreviewError(400, 'invalid_request', `${field} must be a string.`)
  const result = value.trim()
  if (result.length < minimum || result.length > maximum || /[\r\n]/.test(result)) throw new CabezonPreviewError(400, 'invalid_request', `${field} must contain ${minimum}-${maximum} characters on one line.`)
  return result
}

function boundedText(value: unknown, field: string, minimum: number, maximum: number): string {
  if (typeof value !== 'string') throw new CabezonPreviewError(400, 'invalid_request', `${field} must be a string.`)
  const result = value.trim()
  if (result.length < minimum || result.length > maximum) throw new CabezonPreviewError(400, 'invalid_request', `${field} must contain ${minimum}-${maximum} characters.`)
  return result
}

function exactHttpsEndpoint(value: unknown, field: string): string {
  const raw = line(value, field, 12, 2_000)
  let url: URL
  try { url = new URL(raw) } catch { throw new CabezonPreviewError(400, 'identity_endpoint_invalid', `${field} must be an absolute HTTPS URL.`) }
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) throw new CabezonPreviewError(400, 'identity_endpoint_invalid', `${field} must be an absolute credential-free HTTPS URL without query or fragment.`)
  return url.toString()
}

export function parseCarpIdentityBinding(value: unknown, field = 'identity'): CarpIdentityBinding {
  const record = exactObject(value, field, ['did', 'sadSha256', 'endpoint'])
  const did = line(record.did, `${field}.did`, 16, 255)
  const sadSha256 = line(record.sadSha256, `${field}.sadSha256`, 71, 71)
  if (!DID.test(did)) throw new CabezonPreviewError(400, 'identity_did_invalid', `${field}.did is not a supported CARP DID.`)
  if (!DIGEST.test(sadSha256)) throw new CabezonPreviewError(400, 'identity_sad_invalid', `${field}.sadSha256 must be a SHA-256 digest.`)
  return { did, sadSha256, endpoint: exactHttpsEndpoint(record.endpoint, `${field}.endpoint`) }
}

export function sameCarpIdentity(left: CarpIdentityBinding, right: CarpIdentityBinding): boolean {
  return left.did === right.did && left.sadSha256 === right.sadSha256 && left.endpoint === right.endpoint
}

function parseConfigJson(value: string | undefined, field: string): unknown {
  if (!value) throw new CabezonPreviewError(503, 'cabezon_preview_unconfigured', `${field} is not configured.`)
  try { return JSON.parse(value) } catch { throw new CabezonPreviewError(503, 'cabezon_preview_unconfigured', `${field} is not valid JSON.`) }
}

export function cabezonPreviewConfigFromEnvironment(environment: NodeJS.ProcessEnv = process.env): CabezonPreviewConfig {
  if (environment.VERCEL_ENV !== 'preview' || environment.CABEZON_PREVIEW_ENABLED !== 'true') throw new CabezonPreviewError(404, 'cabezon_preview_not_found', 'CABEZON Preview adapter is unavailable.')
  const token = environment.CABEZON_PREVIEW_TOKEN?.trim()
  if (!token || token.length < 32) throw new CabezonPreviewError(503, 'cabezon_preview_unconfigured', 'CABEZON Preview token is not configured.')
  const seller = parseCarpIdentityBinding(parseConfigJson(environment.CABEZON_PREVIEW_SELLER_BINDING_JSON, 'CABEZON_PREVIEW_SELLER_BINDING_JSON'), 'seller')
  const rawCustomers = parseConfigJson(environment.CABEZON_PREVIEW_CUSTOMER_BINDINGS_JSON, 'CABEZON_PREVIEW_CUSTOMER_BINDINGS_JSON')
  if (!Array.isArray(rawCustomers) || rawCustomers.length < 1 || rawCustomers.length > 20) throw new CabezonPreviewError(503, 'cabezon_preview_unconfigured', 'CABEZON Preview customer bindings must contain 1-20 identities.')
  const customers = rawCustomers.map((identity, index) => parseCarpIdentityBinding(identity, `customers[${index}]`))
  if (new Set(customers.map((identity) => identity.did)).size !== customers.length) throw new CabezonPreviewError(503, 'cabezon_preview_unconfigured', 'CABEZON Preview customer DIDs must be unique.')
  return { seller, customers, token }
}

export function authorizeCabezonPreview(request: Request, config: CabezonPreviewConfig): void {
  const authorization = request.headers.get('authorization')
  if (!authorization?.startsWith('Bearer ')) throw new CabezonPreviewError(401, 'cabezon_preview_token_required', 'CABEZON Preview bearer token is required.')
  const supplied = Buffer.from(authorization.slice('Bearer '.length))
  const expected = Buffer.from(config.token)
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) throw new CabezonPreviewError(401, 'cabezon_preview_token_invalid', 'CABEZON Preview bearer token is invalid.')
}

type RawOffer = { id?: unknown; name?: unknown; status?: unknown; serviceUrl?: unknown }
type RawCatalog = { version?: unknown; updatedAt?: unknown; offers?: unknown }

export function projectCabezonOffers(seller: CarpIdentityBinding, catalogValue: unknown = agentOffers): CabezonOfferProjection {
  const catalog = exactObject(catalogValue, 'agentOffers', ['schema', 'version', 'updatedAt', 'provider', 'transactionPolicy', 'credentialPolicy', 'bookMachineAccessPolicy', 'provenance', 'technicalCapabilities', 'capabilities', 'offers']) as RawCatalog & Record<string, unknown>
  const version = line(catalog.version, 'agentOffers.version', 1, 40)
  const updatedAt = line(catalog.updatedAt, 'agentOffers.updatedAt', 20, 40)
  if (!UTC_INSTANT.test(updatedAt) || !Number.isFinite(Date.parse(updatedAt))) throw new CabezonPreviewError(503, 'offer_catalog_invalid', 'Agent offer catalog updatedAt must be a UTC instant.')
  if (!Array.isArray(catalog.offers) || catalog.offers.length < 1 || catalog.offers.length > 100) throw new CabezonPreviewError(503, 'offer_catalog_invalid', 'Agent offer catalog must contain 1-100 offers.')
  const offers = catalog.offers.map((value, index): CabezonProjectedOffer => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new CabezonPreviewError(503, 'offer_catalog_invalid', `Offer ${index} is invalid.`)
    const offer = value as RawOffer
    const id = line(offer.id, `offers[${index}].id`, 3, 120)
    const name = line(offer.name, `offers[${index}].name`, 2, 200)
    const sourceStatus = line(offer.status, `offers[${index}].status`, 3, 100)
    const serviceUrl = exactHttpsEndpoint(offer.serviceUrl, `offers[${index}].serviceUrl`)
    return {
      id, name, serviceUrl, sourceStatus,
      states: { information: 'informational', enquiry: sourceStatus === 'available_for_inquiry' ? 'inquiry_available' : 'unavailable', purchase: 'purchase_disabled' },
    }
  }).sort((left, right) => left.id < right.id ? -1 : left.id > right.id ? 1 : 0)
  if (new Set(offers.map((offer) => offer.id)).size !== offers.length) throw new CabezonPreviewError(503, 'offer_catalog_invalid', 'Agent offer ids must be unique.')
  const sourceCatalog = { version, updatedAt, sha256: digestJson(catalogValue) }
  const base = {
    schemaVersion: CABEZON_PREVIEW_SCHEMA_VERSION,
    mode: 'preview-no-payment' as const,
    seller,
    sourceCatalog,
    offers,
    authority: { paymentEnabled: false as const, escrowEnabled: false as const, autonomousExecutionEnabled: false as const, corpusMutationEnabled: false as const, canonicalReleaseEnabled: false as const },
  }
  return { ...base, projectionSha256: digestJson(base) }
}

export async function readBoundedCabezonJson(request: Request): Promise<unknown> {
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) throw new CabezonPreviewError(415, 'content_type_required', 'Content-Type must be application/json.')
  const declared = Number(request.headers.get('content-length'))
  if (Number.isFinite(declared) && declared > CABEZON_PREVIEW_MAX_BYTES) throw new CabezonPreviewError(413, 'payload_too_large', `Request exceeds ${CABEZON_PREVIEW_MAX_BYTES} bytes.`)
  const raw = await request.text()
  if (new TextEncoder().encode(raw).byteLength > CABEZON_PREVIEW_MAX_BYTES) throw new CabezonPreviewError(413, 'payload_too_large', `Request exceeds ${CABEZON_PREVIEW_MAX_BYTES} bytes.`)
  try { return JSON.parse(raw) } catch { throw new CabezonPreviewError(400, 'invalid_json', 'Request body is not valid JSON.') }
}

export function parseCabezonEnquiry(value: unknown): CabezonEnquiryInput {
  const body = exactObject(value, 'enquiry', ['schemaVersion', 'customer', 'seller', 'offerCatalogSha256', 'offerId', 'question', 'decisionContext'])
  if (body.schemaVersion !== CABEZON_PREVIEW_SCHEMA_VERSION) throw new CabezonPreviewError(400, 'schema_version_invalid', `schemaVersion must be ${CABEZON_PREVIEW_SCHEMA_VERSION}.`)
  const offerCatalogSha256 = line(body.offerCatalogSha256, 'offerCatalogSha256', 71, 71)
  if (!DIGEST.test(offerCatalogSha256)) throw new CabezonPreviewError(400, 'offer_catalog_digest_invalid', 'offerCatalogSha256 must be a SHA-256 digest.')
  return {
    schemaVersion: CABEZON_PREVIEW_SCHEMA_VERSION,
    customer: parseCarpIdentityBinding(body.customer, 'customer'),
    seller: parseCarpIdentityBinding(body.seller, 'seller'),
    offerCatalogSha256,
    offerId: line(body.offerId, 'offerId', 3, 120),
    question: boundedText(body.question, 'question', 20, 4_000),
    decisionContext: body.decisionContext === undefined ? undefined : boundedText(body.decisionContext, 'decisionContext', 12, 2_000),
  }
}

export function validateIdentityBinding(input: CabezonEnquiryInput, config: CabezonPreviewConfig): void {
  if (!sameCarpIdentity(input.seller, config.seller)) throw new CabezonPreviewError(403, 'seller_identity_binding_mismatch', 'Seller DID, SAD digest and endpoint must match the configured CABEZON Seller binding.')
  if (!config.customers.some((customer) => sameCarpIdentity(input.customer, customer))) throw new CabezonPreviewError(403, 'customer_identity_binding_mismatch', 'Customer DID, SAD digest and endpoint are not an exact pre-registered CARP binding.')
}

export function requestIdempotencyKey(request: Request): string {
  const value = request.headers.get('idempotency-key') ?? ''
  if (!IDENTIFIER.test(value)) throw new CabezonPreviewError(400, 'idempotency_key_invalid', 'Idempotency-Key must contain 8-160 safe identifier characters.')
  return value
}

function requireUtcSecond(value: string, field: string): string {
  if (!UTC_SECOND.test(value) || !Number.isFinite(Date.parse(value))) throw new CabezonPreviewError(400, 'instant_invalid', `${field} must be UTC second precision.`)
  return value
}

function event(sequence: number, type: CabezonEventType, occurredAt: string, payload: unknown): CabezonLifecycleEvent {
  return { sequence, type, occurredAt: requireUtcSecond(occurredAt, 'occurredAt'), payloadSha256: digestJson(payload) }
}

export function buildCabezonEnquiryPlan(input: { enquiry: CabezonEnquiryInput; config: CabezonPreviewConfig; projection: CabezonOfferProjection; idempotencyKey: string; now: string }): CabezonEnquiryPlan {
  validateIdentityBinding(input.enquiry, input.config)
  if (input.enquiry.offerCatalogSha256 !== input.projection.projectionSha256) throw new CabezonPreviewError(409, 'offer_catalog_stale', 'The submitted CABEZON offer projection is stale or substituted.')
  const offer = input.projection.offers.find((candidate) => candidate.id === input.enquiry.offerId)
  if (!offer) throw new CabezonPreviewError(404, 'offer_not_found', 'Requested offer is not present in the current projection.')
  if (offer.states.enquiry !== 'inquiry_available') throw new CabezonPreviewError(409, 'offer_enquiry_unavailable', 'Requested offer is informational only in this Preview adapter.')
  const now = requireUtcSecond(input.now, 'now')
  const idempotencyHash = digestJson({ sellerDid: input.config.seller.did, customerDid: input.enquiry.customer.did, idempotencyKey: input.idempotencyKey })
  const lifecycleId = `cbz_${idempotencyHash.slice('sha256:'.length, 'sha256:'.length + 32)}`
  const questionSha256 = digestJson(input.enquiry.question)
  const decisionContextSha256 = input.enquiry.decisionContext ? digestJson(input.enquiry.decisionContext) : null
  const requestShape = {
    schemaVersion: input.enquiry.schemaVersion,
    customer: input.enquiry.customer,
    seller: input.enquiry.seller,
    offerCatalogSha256: input.enquiry.offerCatalogSha256,
    offerId: input.enquiry.offerId,
    questionSha256,
    decisionContextSha256,
  }
  const requestSha256 = digestJson(requestShape)
  const lifecycle: CabezonLifecycle = {
    lifecycleId, idempotencyHash, requestSha256,
    customer: input.enquiry.customer, seller: input.enquiry.seller,
    offerId: offer.id, offerProjectionSha256: input.projection.projectionSha256,
    status: 'offered', createdAt: now, updatedAt: now,
    deliveryReference: null, acknowledgementSha256: null,
    events: [
      event(1, 'enquiry_received', now, { lifecycleId, requestSha256, questionSha256, decisionContextSha256 }),
      event(2, 'offer_returned', now, { lifecycleId, offerId: offer.id, offerProjectionSha256: input.projection.projectionSha256, purchase: 'purchase_disabled' }),
    ],
  }
  return { lifecycle, questionSha256, decisionContextSha256 }
}

export function buildDeliveryReference(lifecycle: CabezonLifecycle, deliveredAt: string): CabezonDeliveryReference {
  if (!LIFECYCLE_ID.test(lifecycle.lifecycleId)) throw new CabezonPreviewError(400, 'lifecycle_id_invalid', 'Lifecycle id is invalid.')
  if (lifecycle.status !== 'offered') throw new CabezonPreviewError(409, 'delivery_state_invalid', 'Delivery fixture is available only after an offer and before delivery.')
  const base = {
    deliveryReferenceVersion: '0.1' as const,
    lifecycleId: lifecycle.lifecycleId,
    orderId: lifecycle.lifecycleId,
    sellerDid: lifecycle.seller.did,
    deliveredAt: requireUtcSecond(deliveredAt, 'deliveredAt'),
    requestSha256: lifecycle.requestSha256,
    resultSha256: digestJson({ lifecycleId: lifecycle.lifecycleId, offerId: lifecycle.offerId, result: 'preview-fixture-delivered' }),
    artifactSha256: null,
    retrieval: { mode: 'direct_response' as const, reference: `urn:maha:cabezon-preview:${lifecycle.lifecycleId}:fixture` },
    status: 'delivered' as const,
    paymentEnabled: false as const,
  }
  return { ...base, referenceSha256: digestJson(base) }
}

export function applyDeliveryToLifecycle(lifecycleValue: CabezonLifecycle, deliveryReference: CabezonDeliveryReference): CabezonLifecycle {
  const lifecycle = structuredClone(lifecycleValue)
  const expected = buildDeliveryReference(lifecycle, deliveryReference.deliveredAt)
  if (expected.referenceSha256 !== deliveryReference.referenceSha256 || canonicalJson(expected) !== canonicalJson(deliveryReference)) throw new CabezonPreviewError(409, 'delivery_reference_mismatch', 'Delivery reference is not the deterministic lifecycle reference.')
  lifecycle.deliveryReference = deliveryReference
  lifecycle.status = 'delivered'
  lifecycle.updatedAt = deliveryReference.deliveredAt
  lifecycle.events.push(event(lifecycle.events.length + 1, 'delivery_recorded', deliveryReference.deliveredAt, { lifecycleId: lifecycle.lifecycleId, referenceSha256: deliveryReference.referenceSha256 }))
  return lifecycle
}

export function applyAcknowledgementToLifecycle(lifecycleValue: CabezonLifecycle, input: { deliveryReferenceSha256: string; acknowledgementSha256: string; acknowledgedAt: string }): CabezonLifecycle {
  const lifecycle = structuredClone(lifecycleValue)
  if (lifecycle.status !== 'delivered' || !lifecycle.deliveryReference) throw new CabezonPreviewError(409, 'acknowledgement_state_invalid', 'Acknowledgement requires an available delivery reference.')
  if (lifecycle.deliveryReference.referenceSha256 !== input.deliveryReferenceSha256) throw new CabezonPreviewError(409, 'delivery_reference_mismatch', 'Acknowledgement does not bind the lifecycle delivery reference.')
  const expectedAcknowledgement = digestJson({ lifecycleId: lifecycle.lifecycleId, deliveryReferenceSha256: input.deliveryReferenceSha256, received: true })
  if (expectedAcknowledgement !== input.acknowledgementSha256) throw new CabezonPreviewError(409, 'acknowledgement_digest_mismatch', 'Acknowledgement digest is not bound to the lifecycle delivery reference.')
  const acknowledgedAt = requireUtcSecond(input.acknowledgedAt, 'acknowledgedAt')
  lifecycle.acknowledgementSha256 = expectedAcknowledgement
  lifecycle.status = 'acknowledged'
  lifecycle.updatedAt = acknowledgedAt
  lifecycle.events.push(event(lifecycle.events.length + 1, 'acknowledgement_recorded', acknowledgedAt, { lifecycleId: lifecycle.lifecycleId, acknowledgementSha256: lifecycle.acknowledgementSha256 }))
  return lifecycle
}

export class MemoryCabezonLifecycleStore implements CabezonLifecycleStore {
  private readonly records = new Map<string, CabezonLifecycle>()
  private readonly actionIdempotency = new Map<string, string>()

  async submitEnquiry(plan: CabezonEnquiryPlan) {
    const existing = this.records.get(plan.lifecycle.lifecycleId)
    if (existing) {
      if (existing.idempotencyHash !== plan.lifecycle.idempotencyHash || existing.requestSha256 !== plan.lifecycle.requestSha256) throw new CabezonPreviewError(409, 'idempotency_conflict', 'Idempotency-Key was already used for a different enquiry.')
      return { status: 'idempotent' as const, lifecycle: structuredClone(existing) }
    }
    this.records.set(plan.lifecycle.lifecycleId, structuredClone(plan.lifecycle))
    return { status: 'created' as const, lifecycle: structuredClone(plan.lifecycle) }
  }

  async recordDelivery(input: Parameters<CabezonLifecycleStore['recordDelivery']>[0]) {
    const existingAction = this.actionIdempotency.get(input.idempotencyHash)
    const lifecycle = this.records.get(input.lifecycleId)
    if (!lifecycle) throw new CabezonPreviewError(404, 'lifecycle_not_found', 'CABEZON Preview lifecycle was not found.')
    if (existingAction) {
      if (existingAction !== input.requestSha256 || !lifecycle.deliveryReference) throw new CabezonPreviewError(409, 'idempotency_conflict', 'Idempotency-Key was already used for a different delivery action.')
      return { status: 'idempotent' as const, lifecycle: structuredClone(lifecycle) }
    }
    const updated = applyDeliveryToLifecycle(lifecycle, input.deliveryReference)
    if (canonicalJson(updated) !== canonicalJson(input.updatedLifecycle)) throw new CabezonPreviewError(409, 'lifecycle_revision_mismatch', 'Delivery lifecycle revision does not match the deterministic transition.')
    this.records.set(input.lifecycleId, structuredClone(updated))
    this.actionIdempotency.set(input.idempotencyHash, input.requestSha256)
    return { status: 'created' as const, lifecycle: structuredClone(updated) }
  }

  async acknowledge(input: Parameters<CabezonLifecycleStore['acknowledge']>[0]) {
    const existingAction = this.actionIdempotency.get(input.idempotencyHash)
    const lifecycle = this.records.get(input.lifecycleId)
    if (!lifecycle) throw new CabezonPreviewError(404, 'lifecycle_not_found', 'CABEZON Preview lifecycle was not found.')
    if (existingAction) {
      if (existingAction !== input.requestSha256 || !lifecycle.acknowledgementSha256) throw new CabezonPreviewError(409, 'idempotency_conflict', 'Idempotency-Key was already used for a different acknowledgement.')
      return { status: 'idempotent' as const, lifecycle: structuredClone(lifecycle) }
    }
    const updated = applyAcknowledgementToLifecycle(lifecycle, input)
    if (canonicalJson(updated) !== canonicalJson(input.updatedLifecycle)) throw new CabezonPreviewError(409, 'lifecycle_revision_mismatch', 'Acknowledgement lifecycle revision does not match the deterministic transition.')
    this.records.set(input.lifecycleId, structuredClone(updated))
    this.actionIdempotency.set(input.idempotencyHash, input.requestSha256)
    return { status: 'created' as const, lifecycle: structuredClone(updated) }
  }

  async read(lifecycleId: string) { return structuredClone(this.records.get(lifecycleId) ?? null) }
}

function publicLifecycle(lifecycle: CabezonLifecycle) {
  return {
    lifecycleId: lifecycle.lifecycleId,
    requestSha256: lifecycle.requestSha256,
    offerId: lifecycle.offerId,
    status: lifecycle.status,
    createdAt: lifecycle.createdAt,
    updatedAt: lifecycle.updatedAt,
    deliveryReference: lifecycle.deliveryReference,
    acknowledgementSha256: lifecycle.acknowledgementSha256,
    events: lifecycle.events,
    authority: { paymentEnabled: false, escrowEnabled: false, autonomousExecutionEnabled: false, canonicalReleaseEnabled: false },
  }
}

export function cabezonPreviewErrorResponse(error: unknown): Response {
  if (error instanceof CabezonPreviewError) return Response.json({ error: { code: error.code, message: error.message } }, { status: error.status, headers: CABEZON_PREVIEW_HEADERS })
  console.error('[CABEZON_PREVIEW_ERROR]', error instanceof Error ? error.name : 'unknown_error')
  return Response.json({ error: { code: 'cabezon_preview_unavailable', message: 'CABEZON Preview adapter is temporarily unavailable.' } }, { status: 503, headers: CABEZON_PREVIEW_HEADERS })
}

function actionIdempotency(request: Request, lifecycleId: string, action: string): { hash: string; key: string } {
  const key = requestIdempotencyKey(request)
  return { key, hash: digestJson({ lifecycleId, action, idempotencyKey: key }) }
}

export function createCabezonPreviewHandlers(dependencies: { config: CabezonPreviewConfig; store: CabezonLifecycleStore; now?: () => string }) {
  const now = dependencies.now ?? (() => new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'))
  const projection = () => projectCabezonOffers(dependencies.config.seller)
  return {
    offers: async (request: Request): Promise<Response> => {
      try {
        authorizeCabezonPreview(request, dependencies.config)
        return Response.json(projection(), { headers: CABEZON_PREVIEW_HEADERS })
      } catch (error) { return cabezonPreviewErrorResponse(error) }
    },
    enquire: async (request: Request): Promise<Response> => {
      try {
        authorizeCabezonPreview(request, dependencies.config)
        const key = requestIdempotencyKey(request)
        const enquiry = parseCabezonEnquiry(await readBoundedCabezonJson(request))
        const result = await dependencies.store.submitEnquiry(buildCabezonEnquiryPlan({ enquiry, config: dependencies.config, projection: projection(), idempotencyKey: key, now: now() }))
        return Response.json({ operation: result.status, lifecycle: publicLifecycle(result.lifecycle), offer: projection().offers.find((offer) => offer.id === result.lifecycle.offerId) }, { status: result.status === 'created' ? 201 : 200, headers: CABEZON_PREVIEW_HEADERS })
      } catch (error) { return cabezonPreviewErrorResponse(error) }
    },
    deliver: async (request: Request, lifecycleId: string): Promise<Response> => {
      try {
        authorizeCabezonPreview(request, dependencies.config)
        if (!LIFECYCLE_ID.test(lifecycleId)) throw new CabezonPreviewError(400, 'lifecycle_id_invalid', 'Lifecycle id is invalid.')
        const idempotency = actionIdempotency(request, lifecycleId, 'deliver')
        const body = exactObject(await readBoundedCabezonJson(request), 'delivery', ['expectedRequestSha256'])
        const expectedRequestSha256 = line(body.expectedRequestSha256, 'expectedRequestSha256', 71, 71)
        if (!DIGEST.test(expectedRequestSha256)) throw new CabezonPreviewError(400, 'request_digest_invalid', 'expectedRequestSha256 must be a SHA-256 digest.')
        const lifecycle = await dependencies.store.read(lifecycleId)
        if (!lifecycle) throw new CabezonPreviewError(404, 'lifecycle_not_found', 'CABEZON Preview lifecycle was not found.')
        if (lifecycle.requestSha256 !== expectedRequestSha256) throw new CabezonPreviewError(409, 'request_binding_mismatch', 'Delivery does not bind the lifecycle request.')
        const deliveryRequestSha256 = digestJson({ lifecycleId, expectedRequestSha256 })
        if (lifecycle.deliveryReference) {
          const result = await dependencies.store.recordDelivery({
            lifecycleId,
            idempotencyHash: idempotency.hash,
            requestSha256: deliveryRequestSha256,
            deliveredAt: lifecycle.deliveryReference.deliveredAt,
            deliveryReference: lifecycle.deliveryReference,
            updatedLifecycle: lifecycle,
          })
          return Response.json({ operation: result.status, lifecycle: publicLifecycle(result.lifecycle) }, { status: result.status === 'created' ? 201 : 200, headers: CABEZON_PREVIEW_HEADERS })
        }
        const deliveredAt = now()
        const deliveryReference = buildDeliveryReference(lifecycle, deliveredAt)
        const updatedLifecycle = applyDeliveryToLifecycle(lifecycle, deliveryReference)
        const result = await dependencies.store.recordDelivery({ lifecycleId, idempotencyHash: idempotency.hash, requestSha256: deliveryRequestSha256, deliveredAt, deliveryReference, updatedLifecycle })
        return Response.json({ operation: result.status, lifecycle: publicLifecycle(result.lifecycle) }, { status: result.status === 'created' ? 201 : 200, headers: CABEZON_PREVIEW_HEADERS })
      } catch (error) { return cabezonPreviewErrorResponse(error) }
    },
    acknowledge: async (request: Request, lifecycleId: string): Promise<Response> => {
      try {
        authorizeCabezonPreview(request, dependencies.config)
        if (!LIFECYCLE_ID.test(lifecycleId)) throw new CabezonPreviewError(400, 'lifecycle_id_invalid', 'Lifecycle id is invalid.')
        const idempotency = actionIdempotency(request, lifecycleId, 'acknowledge')
        const body = exactObject(await readBoundedCabezonJson(request), 'acknowledgement', ['deliveryReferenceSha256', 'received'])
        if (body.received !== true) throw new CabezonPreviewError(400, 'acknowledgement_invalid', 'received must be true.')
        const deliveryReferenceSha256 = line(body.deliveryReferenceSha256, 'deliveryReferenceSha256', 71, 71)
        if (!DIGEST.test(deliveryReferenceSha256)) throw new CabezonPreviewError(400, 'delivery_reference_digest_invalid', 'deliveryReferenceSha256 must be a SHA-256 digest.')
        const acknowledgementSha256 = digestJson({ lifecycleId, deliveryReferenceSha256, received: true })
        const acknowledgementRequestSha256 = digestJson({ lifecycleId, deliveryReferenceSha256 })
        const lifecycle = await dependencies.store.read(lifecycleId)
        if (!lifecycle) throw new CabezonPreviewError(404, 'lifecycle_not_found', 'CABEZON Preview lifecycle was not found.')
        if (lifecycle.status === 'acknowledged' && lifecycle.deliveryReference && lifecycle.acknowledgementSha256) {
          const result = await dependencies.store.acknowledge({
            lifecycleId,
            idempotencyHash: idempotency.hash,
            requestSha256: acknowledgementRequestSha256,
            deliveryReferenceSha256,
            acknowledgementSha256: lifecycle.acknowledgementSha256,
            acknowledgedAt: lifecycle.updatedAt,
            updatedLifecycle: lifecycle,
          })
          return Response.json({ operation: result.status, lifecycle: publicLifecycle(result.lifecycle) }, { status: result.status === 'created' ? 201 : 200, headers: CABEZON_PREVIEW_HEADERS })
        }
        const acknowledgedAt = now()
        const updatedLifecycle = applyAcknowledgementToLifecycle(lifecycle, { deliveryReferenceSha256, acknowledgementSha256, acknowledgedAt })
        const result = await dependencies.store.acknowledge({ lifecycleId, idempotencyHash: idempotency.hash, requestSha256: acknowledgementRequestSha256, deliveryReferenceSha256, acknowledgementSha256, acknowledgedAt, updatedLifecycle })
        return Response.json({ operation: result.status, lifecycle: publicLifecycle(result.lifecycle) }, { status: result.status === 'created' ? 201 : 200, headers: CABEZON_PREVIEW_HEADERS })
      } catch (error) { return cabezonPreviewErrorResponse(error) }
    },
  }
}
