import { createHash } from 'node:crypto'
import { MAHA_PAYEE } from './discovery-payment-recipe.ts'
import { usdcNetwork } from './networks.ts'
const object = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('invalid_alsp_sample')
  return value as Record<string, unknown>
}
export const ALSP_SAMPLE_COMMIT = '763d68c3218f29452990b87964e8808ffd0ac083'
export const ALSP_CODE_COMMIT = '545221097a48cb6480c58b5d43e05f302acef30f'
/** Static artifact inspection only. Never executes upstream scripts or treats mock RPC as chain evidence. */
export function reviewAlspSample(sample: unknown, mapping: unknown) {
  const root = object(sample), notes = object(mapping), metadata = object(root.fixtureMetadata), exports = object(root.nativeExports)
  if (metadata.mainSha !== ALSP_CODE_COMMIT) throw new Error('unexpected_alsp_version')
  const contract = object(notes.publicContractMapping), payment = object(contract.payment), native = usdcNetwork('eip155:8453')
  if (contract.resource !== 'https://www.mahastrategies.com/api/v1/compress' || contract.offerId !== 'context-compression'
    || payment.network !== 'eip155:8453' || payment.amount !== '1000' || String(payment.asset).toLowerCase() !== native.asset.toLowerCase()
    || String(payment.payTo).toLowerCase() !== MAHA_PAYEE.toLowerCase()) throw new Error('public_payment_mapping_mismatch')
  const recovered = object(exports.lostThenBodylessRecovery)
  const scenarios = { success: exports.success, lostResponse: exports.noWireAndUnrecoverableOutput,
    bodylessReconciliation: recovered.afterRecovery, emptyHttp200: exports.directHttp200NullBody }
  const observations = Object.entries(scenarios).map(([name, value]) => {
    const record = object(value), summary = object(record.summary)
    if (!Array.isArray(record.evidence) || record.evidence.length !== 1) throw new Error('unexpected_alsp_evidence')
    const evidence = object(record.evidence[0]), wire = evidence.wire == null ? null : object(evidence.wire)
    return { scenario: name, nativeSessionState: summary.state, reportedVerifiedSpend: summary.verifiedSpent,
      unresolvedCalls: summary.unresolved, wireStatus: wire?.status ?? null, outputAvailable: wire?.body != null,
      settlementEvidence: wire ? 'synthetic_mock_only' : 'absent_from_native_export', buyerReceiptEstablished: false }
  })
  const serialization = object(notes.requestSerializationObservation)
  return { sampleCommit: ALSP_SAMPLE_COMMIT, codeCommit: ALSP_CODE_COMMIT, evaluation: 'static_offline_artifact_review',
    observations, jsonPostCompatible: serialization.requestBodyPresent === true && serialization.payloadQueryPresent === false,
    gaps: ['Native settlement and delivery states are not separate.', 'Bodyless HTTP 200 can close an unsigned session without recovered output.',
      'POST transport uses flat query input, not the nested Maha JSON body.', 'Offer version and bare input digest are companion annotations, not native signed fields.',
      'The native export without a WireResponse cannot reconcile its mock settlement by itself.'],
    providerSignatureValidated: false, liveInteroperabilityEstablished: false, refundsImplemented: false,
    automaticPaidCalls: 0, upstreamCodeExecuted: false }
}
export const artifactSha256 = (bytes: string) => createHash('sha256').update(bytes).digest('hex')
