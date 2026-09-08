import { createHash } from 'node:crypto'
import { bazaarResourceServerExtension, declareDiscoveryExtension, validateDiscoveryExtension } from '@x402/extensions/bazaar'
import { offerById } from './offers.ts'

export const bytesDigest = (bytes: Uint8Array | string): string =>
  `sha256:${createHash('sha256').update(bytes).digest('hex')}`

export type BuyerCapture = {
  schemaVersion: 'maha-buyer-capture/0.1'
  provenance: 'synthetic' | 'buyer-local'
  offerId: string
  method: string
  resourcePath: string
  httpStatus: number
  requestSha256: string
  responseSha256: string
}

const object = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)

/** Exact-byte commitments, not dossier canonicalization: no fields are dropped. */
export function createBuyerCapture(input: Omit<BuyerCapture, 'schemaVersion' | 'requestSha256' | 'responseSha256'>,
  requestBytes: Uint8Array, responseBytes: Uint8Array): BuyerCapture {
  return { ...input, schemaVersion: 'maha-buyer-capture/0.1',
    requestSha256: bytesDigest(requestBytes), responseSha256: bytesDigest(responseBytes) }
}

/** Offline replay only. The trusted manifest digest must come from a separate trusted record. */
export function checkBuyerDelivery(input: {
  captureBytes: Uint8Array
  expectedCaptureSha256: string
  requestBytes: Uint8Array
  responseBytes: Uint8Array
}) {
  const problems: string[] = []
  let state: 'rejected' | 'pending' | 'payload_verified' = 'rejected'
  let provenance: 'synthetic' | 'buyer-local' | 'unknown' = 'unknown'
  let offerId: string | null = null
  const report = () => ({
    schemaVersion: 'maha-buyer-delivery-check/0.1' as const,
    state, provenance, offerId, problems,
    captureSha256: bytesDigest(input.captureBytes),
    requestSha256: bytesDigest(input.requestBytes),
    responseSha256: bytesDigest(input.responseBytes),
    responseBytes: input.responseBytes.byteLength,
    settlement: 'not_checked' as const,
    buyerIdentity: 'not_authenticated' as const,
    scope: 'Pinned capture integrity, request/offer binding and declared response shape; not product semantics or embedded receipt verification.',
    boundaries: ['No payment or network call made.', 'Local capture is not independent proof of delivery to another buyer.',
      'Does not prove substantive acceptance, factual correctness, agent comprehension, or Bazaar indexing.'],
  })
  if (!/^sha256:[a-f0-9]{64}$/.test(input.expectedCaptureSha256)
    || bytesDigest(input.captureBytes) !== input.expectedCaptureSha256) {
    problems.push('capture_commitment_mismatch'); return report()
  }
  let capture: unknown
  let request: unknown
  let response: unknown
  try {
    const decoder = new TextDecoder('utf-8', { fatal: true })
    capture = JSON.parse(decoder.decode(input.captureBytes))
    request = JSON.parse(decoder.decode(input.requestBytes))
    response = JSON.parse(decoder.decode(input.responseBytes))
  } catch { problems.push('invalid_utf8_or_json'); return report() }
  if (!object(capture) || !object(request) || !object(response)) {
    problems.push('expected_json_objects'); return report()
  }
  const fields = ['schemaVersion', 'provenance', 'offerId', 'method', 'resourcePath', 'httpStatus', 'requestSha256', 'responseSha256']
  if (Object.keys(capture).length !== fields.length || fields.some((key) => !Object.hasOwn(capture, key))
    || capture.schemaVersion !== 'maha-buyer-capture/0.1'
    || !['synthetic', 'buyer-local'].includes(String(capture.provenance))
    || typeof capture.offerId !== 'string' || !Number.isInteger(capture.httpStatus)) {
    problems.push('invalid_capture'); return report()
  }
  provenance = capture.provenance as typeof provenance
  offerId = capture.offerId
  const offer = offerById(offerId)
  if (!offer || capture.method !== offer.method || capture.resourcePath !== offer.path) {
    problems.push('offer_route_mismatch'); return report()
  }
  if (capture.requestSha256 !== bytesDigest(input.requestBytes)) problems.push('request_bytes_mismatch')
  if (capture.responseSha256 !== bytesDigest(input.responseBytes)) problems.push('response_bytes_mismatch')
  if (input.requestBytes.byteLength > offer.maxRequestBytes) problems.push('request_exceeds_offer_limit')
  const status = capture.httpStatus as number
  if (status < 200 || status >= 300) problems.push(status === 402 ? 'unpaid_challenge_not_delivery' : 'unsuccessful_http_status')
  if (problems.length) return report()
  // Never log validation details: they can contain customer input or retrieval credentials.
  const validate = (output?: Record<string, unknown>) => {
    const declared = declareDiscoveryExtension({ bodyType: 'json', input: request,
      inputSchema: offer.discovery.inputSchema,
      ...(output ? { output: { example: output, schema: offer.discovery.outputSchema } } : {}) })
    const enriched = bazaarResourceServerExtension.enrichDeclaration?.(declared.bazaar, {
      method: offer.method, path: offer.path, adapter: { getPath: () => offer.path },
    }) as Parameters<typeof validateDiscoveryExtension>[0]
    return validateDiscoveryExtension(enriched).valid
  }
  if (!validate()) problems.push('request_schema_mismatch')
  if ('clientRequestId' in request && response.clientRequestId !== request.clientRequestId) problems.push('request_id_mismatch')
  if ('offerId' in response && response.offerId !== offer.id) problems.push('response_offer_mismatch')
  if (response.exampleOnly === true) problems.push('discovery_example_not_deliverable')
  if (response.status === 'failed') problems.push('job_failed')
  if (problems.length) return report()
  if (status === 202 || response.status === 'processing') {
    state = 'pending'; return report()
  }
  if (!validate(response)) problems.push('response_schema_mismatch')
  if (offer.id === 'mps-autonomous-audit' && (response.status !== 'completed' || !object(response.audit))) problems.push('audit_not_completed')
  if (offer.id === 'research-intake-evidence-pack') {
    const progress = response.progress
    if (response.status !== 'completed' || !object(response.pack) || !object(progress)
      || progress.sectionsFailed !== 0 || !Array.isArray(request.sections)
      || progress.sectionCount !== request.sections.length || progress.sectionsCompleted !== request.sections.length) problems.push('intake_not_completed')
  }
  if (offer.id.startsWith('book-section-') && (!object(response.section) || response.section.id !== request.sectionId)) problems.push('section_selection_mismatch')
  if (offer.id.startsWith('book-') && (!object(response.book)
    || response.book.id !== offer.id.replace(/^book-(section|edition)-/, ''))) problems.push('book_selection_mismatch')
  if (!problems.length) state = 'payload_verified'
  return report()
}
