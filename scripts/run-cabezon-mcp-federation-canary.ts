import { createHash } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'

import { digestJson, parseCarpIdentityBinding } from '../lib/cabezon-preview.ts'

function required(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`${name} is required.`)
  return value
}

function invariant(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`CABEZON/MCP federation canary failed: ${message}`)
}

const baseUrl = new URL(required('CABEZON_PREVIEW_BASE_URL'))
invariant(baseUrl.protocol === 'https:' && baseUrl.hostname.endsWith('.vercel.app'), 'target must be a configured HTTPS Vercel Preview origin')
invariant(baseUrl.pathname === '/' && !baseUrl.search && !baseUrl.hash, 'target must not contain a path, query, or fragment')
const cabezonToken = required('CABEZON_PREVIEW_TOKEN')
const mcpCredential = required('MCP_EVIDENCE_CANARY_CREDENTIAL')
const releaseId = required('MCP_EVIDENCE_CANARY_RELEASE_ID')
const canonicalPath = required('MCP_EVIDENCE_CANARY_CANONICAL_PATH')
invariant(/^epirelease_[a-f0-9]{32}$/.test(releaseId), 'release id is invalid')
invariant(/^\/knowledge\/[a-z0-9-]+\/[a-z0-9-]+\/[a-z0-9-]+$/.test(canonicalPath), 'canonical path is invalid')
const seller = parseCarpIdentityBinding(JSON.parse(required('CABEZON_PREVIEW_SELLER_BINDING_JSON')), 'seller')
const customer = parseCarpIdentityBinding(JSON.parse(required('CABEZON_PREVIEW_CANARY_CUSTOMER_BINDING_JSON')), 'customer')
const runId = required('CABEZON_PREVIEW_CANARY_RUN_ID').replace(/[^A-Za-z0-9._:-]/g, '-').slice(0, 80)
invariant(runId.length >= 8, 'run id is too short')
const bypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET?.trim()

const url = (path: string) => new URL(path, baseUrl).toString()
const cabezonHeaders = (key?: string) => ({
  authorization: `Bearer ${cabezonToken}`,
  ...(key ? { 'content-type': 'application/json', 'idempotency-key': key } : {}),
  ...(bypass ? { 'x-vercel-protection-bypass': bypass } : {}),
})
const postCabezon = (path: string, body: unknown, key: string) => fetch(url(path), { method: 'POST', headers: cabezonHeaders(key), body: JSON.stringify(body), redirect: 'error', signal: AbortSignal.timeout(10_000) })
const readJson = async <T>(response: Response): Promise<T> => await response.json() as T

type Federation = { projectionSha256: string; products: Array<{ productId: string; state: string; capability: string | null }>; authority: { paymentEnabled: boolean; entitlementMutationEnabled: boolean; canonicalReleaseEnabled: boolean } }
type Offers = { schemaVersion: string; projectionSha256: string; offers: Array<{ id: string; states: { enquiry: string; purchase: string } }> }
type LifecycleResponse = { operation: string; lifecycle: { lifecycleId: string; requestSha256: string; status: string; deliveryReference: { referenceSha256: string; artifactSha256: string | null; retrieval: { mode: string; reference: string } }; acknowledgementSha256: string; events: Array<{ type: string }> } }

const federationResponse = await fetch(url('/api/integrations/cabezon/preview/federation'), { headers: cabezonHeaders(), redirect: 'error', signal: AbortSignal.timeout(10_000) })
invariant(federationResponse.status === 200, `federation returned ${federationResponse.status}`)
const federation = await readJson<Federation>(federationResponse)
const licensedProduct = federation.products.find((product) => product.productId === 'licensed-evidence-mcp')
invariant(licensedProduct?.state === 'licensed' && licensedProduct.capability?.includes('evidence.retrieve_released_record'), 'licensed evidence product is absent or misclassified')
invariant(federation.authority.paymentEnabled === false && federation.authority.entitlementMutationEnabled === false && federation.authority.canonicalReleaseEnabled === false, 'federation widened authority')

const offersResponse = await fetch(url('/api/integrations/cabezon/preview/offers'), { headers: cabezonHeaders(), redirect: 'error', signal: AbortSignal.timeout(10_000) })
const offers = await readJson<Offers>(offersResponse)
const licensedOffer = offers.offers.find((offer) => offer.id === 'licensed-evidence-mcp')
invariant(offersResponse.status === 200 && licensedOffer?.states.enquiry === 'inquiry_available' && licensedOffer.states.purchase === 'purchase_disabled', 'licensed evidence enquiry boundary is invalid')
const unavailableOffer = offers.offers.find((offer) => offer.states.enquiry === 'unavailable')
invariant(unavailableOffer, 'federation must retain at least one non-enquiry product')

const enquiry = {
  schemaVersion: offers.schemaVersion, customer, seller, offerCatalogSha256: offers.projectionSha256,
  offerId: 'licensed-evidence-mcp',
  question: 'Can Maha provide licensed retrieval of this exact active canonical evidence release?',
  decisionContext: 'Synthetic private Preview canary; no purchase, payment, release, or external delivery.',
}
const enquiryKey = `federation-enquiry-${runId}`
const staleResponse = await postCabezon('/api/integrations/cabezon/preview/enquiries', { ...enquiry, offerCatalogSha256: `sha256:${'f'.repeat(64)}` }, `federation-stale-${runId}`)
const substitutedResponse = await postCabezon('/api/integrations/cabezon/preview/enquiries', { ...enquiry, customer: { ...customer, endpoint: 'https://substituted.invalid/customer' } }, `federation-substitution-${runId}`)
const unavailableResponse = await postCabezon('/api/integrations/cabezon/preview/enquiries', { ...enquiry, offerId: unavailableOffer.id }, `federation-unavailable-${runId}`)
invariant(staleResponse.status === 409, 'stale federation projection was accepted')
invariant(substitutedResponse.status === 403, 'substituted CARP endpoint was accepted')
invariant(unavailableResponse.status === 409, 'non-enquiry product accepted an enquiry')
const enquiryResponse = await postCabezon('/api/integrations/cabezon/preview/enquiries', enquiry, enquiryKey)
const offered = await readJson<LifecycleResponse>(enquiryResponse)
invariant(enquiryResponse.status === 201 && offered.operation === 'created', 'licensed evidence enquiry was not created')
const replayResponse = await postCabezon('/api/integrations/cabezon/preview/enquiries', enquiry, enquiryKey)
invariant(replayResponse.status === 200 && (await readJson<LifecycleResponse>(replayResponse)).operation === 'idempotent', 'enquiry replay was not idempotent')

let rpcSequence = 0
async function rpc(method: string, params?: object) {
  const response = await fetch(url('/api/mcp/evidence'), {
    method: 'POST', redirect: 'error', signal: AbortSignal.timeout(10_000),
    headers: { authorization: `Bearer ${mcpCredential}`, 'content-type': 'application/json', 'mcp-protocol-version': '2025-11-25', ...(bypass ? { 'x-vercel-protection-bypass': bypass } : {}) },
    body: JSON.stringify({ jsonrpc: '2.0', id: ++rpcSequence, method, ...(params ? { params } : {}) }),
  })
  return { status: response.status, body: await readJson<Record<string, unknown>>(response) }
}
invariant((await rpc('initialize')).status === 200, 'MCP initialize failed')
const tools = await rpc('tools/list')
invariant(((tools.body.result as { tools?: Array<{ name?: string }> } | undefined)?.tools ?? []).some((tool) => tool.name === 'evidence.retrieve_released_record'), 'MCP tool discovery failed')
const clientRequestId = `federation-${runId}`
const parameters = { name: 'evidence.retrieve_released_record', arguments: { clientRequestId, selector: { releaseId } } }
const retrieved = await rpc('tools/call', parameters)
const retrievedResult = retrieved.body.result as { structuredContent?: Record<string, unknown>; _meta?: { idempotentReplay?: boolean } } | undefined
const projection = retrievedResult?.structuredContent
invariant(retrieved.status === 200 && (projection?.release as { releaseId?: string } | undefined)?.releaseId === releaseId, 'licensed evidence retrieval failed')
const executionId = (projection?.execution as { executionId?: string } | undefined)?.executionId
invariant(typeof executionId === 'string' && /^mcpexe_[a-f0-9]{32}$/.test(executionId), 'MCP execution id is invalid')
const mcpReplay = await rpc('tools/call', parameters)
invariant((mcpReplay.body.result as { _meta?: { idempotentReplay?: boolean } } | undefined)?._meta?.idempotentReplay === true, 'MCP replay was not idempotent')
const substitution = await rpc('tools/call', { name: parameters.name, arguments: { clientRequestId, selector: { canonicalPath } } })
invariant((substitution.body.error as { data?: { reason?: string } } | undefined)?.data?.reason === 'idempotency_conflict', 'MCP selector substitution did not fail closed')
const unavailableRelease = await rpc('tools/call', { name: parameters.name, arguments: { clientRequestId: `${clientRequestId}-missing`, selector: { releaseId: 'epirelease_00000000000000000000000000000000' } } })
invariant((unavailableRelease.body.error as { data?: { reason?: string } } | undefined)?.data?.reason === 'release_unavailable', 'unavailable MCP release did not fail closed')

const artifactSha256 = digestJson(projection)
const retrievalReference = `urn:maha:mcp-evidence-execution:${executionId}`
const deliveryResponse = await postCabezon(`/api/integrations/cabezon/preview/lifecycles/${offered.lifecycle.lifecycleId}/delivery`, {
  expectedRequestSha256: offered.lifecycle.requestSha256, artifactSha256, retrievalReference,
}, `federation-delivery-${runId}`)
const delivered = await readJson<LifecycleResponse>(deliveryResponse)
invariant(deliveryResponse.status === 201 && delivered.lifecycle.deliveryReference.artifactSha256 === artifactSha256, 'delivery did not bind the MCP projection')
invariant(delivered.lifecycle.deliveryReference.retrieval.mode === 'mcp_execution' && delivered.lifecycle.deliveryReference.retrieval.reference === retrievalReference, 'delivery substituted the MCP execution reference')
const acknowledgementResponse = await postCabezon(`/api/integrations/cabezon/preview/lifecycles/${offered.lifecycle.lifecycleId}/acknowledgement`, {
  deliveryReferenceSha256: delivered.lifecycle.deliveryReference.referenceSha256, received: true,
}, `federation-ack-${runId}`)
const acknowledged = await readJson<LifecycleResponse>(acknowledgementResponse)
invariant(acknowledgementResponse.status === 201 && acknowledged.lifecycle.status === 'acknowledged' && acknowledged.lifecycle.events.length === 4, 'delivery acknowledgement failed')

const base = {
  schemaVersion: 'maha-cabezon-mcp-federation-canary/1.0', targetHost: baseUrl.hostname, runId,
  cabezonTokenSha256: digestJson(cabezonToken), mcpCredentialSha256: `sha256:${createHash('sha256').update(mcpCredential).digest('hex')}`,
  federationSha256: federation.projectionSha256, lifecycleId: acknowledged.lifecycle.lifecycleId,
  releaseId, releaseSha256: (projection?.release as { releaseSha256?: string } | undefined)?.releaseSha256,
  executionId, artifactSha256, deliveryReferenceSha256: acknowledged.lifecycle.deliveryReference.referenceSha256,
  acknowledgementSha256: acknowledged.lifecycle.acknowledgementSha256,
  checks: { federationDiscovery: 'pass', staleProjection: 'blocked', substitutedEndpoint: 'blocked', unavailableEnquiry: 'blocked', boundedEnquiry: 'pass', enquiryReplay: 'pass', licensedRetrieval: 'pass', mcpReplay: 'pass', selectorSubstitution: 'blocked', unavailableRelease: 'blocked', artifactDeliveryBinding: 'pass', acknowledgement: 'pass' },
  authority: { paymentEnabled: false, escrowEnabled: false, entitlementMutationEnabled: false, canonicalReleaseEnabled: false },
  secretsIncluded: false,
}
const report = { ...base, evidenceSha256: digestJson(base) }
const output = `${JSON.stringify(report, null, 2)}\n`
const evidencePath = process.env.CABEZON_MCP_CANARY_EVIDENCE?.trim()
if (evidencePath) {
  const file = new URL(`file://${evidencePath}`)
  await mkdir(new URL('./', file), { recursive: true })
  await writeFile(file, output, 'utf8')
}
process.stdout.write(output)
