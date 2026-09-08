import canonicalize from 'canonicalize'
import { compileContextPack, parseContextPackRequest } from './context-compiler.ts'
import { bytesDigest, checkBuyerDelivery, createBuyerCapture } from './x402/buyer-delivery-check.ts'

/** RFC 8785 JSON commitment; unlike dossier hashing, no digest fields are omitted. */
export function certenExampleDigest(value: unknown): string {
  const encoded = canonicalize(value)
  if (encoded === undefined) throw new Error('Expected JSON value')
  return bytesDigest(encoded)
}

export const CERTEN_EXAMPLE_TIME = '2026-09-08T12:00:00Z'

export function buildCertenSyntheticExample() {
  const text = 'Synthetic purchasing policy: the authorized buyer may spend at most 1000 USDC base units on context compression. Missing evidence requires human review.'
  const request = {
    clientRequestId: 'certen-synthetic-001', task: 'Retain the spending limit and missing-evidence rule.', tokenBudget: 256,
    documents: [{ id: 'synthetic-policy', title: 'Synthetic purchase policy', text }],
    provenance: 'compact', scoring: 'bm25', budgetMode: 'guaranteed',
  }
  const compiled = compileContextPack(parseContextPackRequest(request))
  // Production pack IDs are random. Only this explicitly synthetic example pins one for reproducibility.
  const response = { ...compiled, packId: 'ctxpack_00000000000000000000000000000001', sourceTextStored: false, compiledContextStored: false }
  const requestJson = JSON.stringify(request)
  const responseJson = JSON.stringify(response)
  const evidence = [{ sourceId: 'synthetic-policy', sectionId: 'spending-rule', text, sourceSha256: bytesDigest(text) }]
  const intent = {
    intentId: 'synthetic-intent-001', actor: 'synthetic:buyer', signer: 'synthetic:cabezon-headless-signer',
    recipient: 'synthetic:seller-not-a-wallet', network: 'synthetic:no-chain', asset: 'USDC',
    amountBaseUnits: '1000', offerId: 'context-compression', method: 'POST', resourcePath: '/api/v1/compress',
    nonce: 'synthetic-one-use-001', notBefore: '2026-09-08T11:00:00Z', expiresAt: '2026-09-08T13:00:00Z',
    requestSha256: bytesDigest(requestJson), evidenceSha256: certenExampleDigest(evidence),
    selectedContextSha256: bytesDigest(compiled.context),
  }
  const authorization = {
    schemaVersion: 'maha-certen-synthetic-authorization/0.1', syntheticOnly: true,
    approvedIntent: structuredClone(intent),
    policy: { version: 'synthetic-evidence-policy/0.1', maxAmountBaseUnits: '1000',
      requiredText: 'Missing evidence requires human review.' },
  }
  const capture = createBuyerCapture({ provenance: 'synthetic', offerId: intent.offerId, method: intent.method,
    resourcePath: intent.resourcePath, httpStatus: 200 }, Buffer.from(requestJson), Buffer.from(responseJson))
  const captureJson = JSON.stringify(capture)
  return {
    schemaVersion: 'maha-certen-synthetic-example/0.1', syntheticOnly: true,
    authorization, intent, evidence, selectedContext: compiled.context, requestJson,
    delivery: { captureJson, responseJson },
  }
}

/** Proposed Maha adapter boundary, NOT an implementation of Certen proofs or signature validation. */
export function evaluateCertenSyntheticExample(bundle: unknown, trust: {
  authorizationSha256: string
  captureSha256: string
  now: string
  usedNonces: readonly string[]
}) {
  const problems: string[] = []
  let delivery: ReturnType<typeof checkBuyerDelivery> | null = null
  try {
    const value = bundle as ReturnType<typeof buildCertenSyntheticExample>
    if (value.schemaVersion !== 'maha-certen-synthetic-example/0.1' || value.syntheticOnly !== true
      || value.authorization.syntheticOnly !== true) throw new Error('not_synthetic')
    if (!/^sha256:[a-f0-9]{64}$/.test(trust.authorizationSha256)
      || certenExampleDigest(value.authorization) !== trust.authorizationSha256) throw new Error('authorization_commitment_mismatch')
    // Exact approval, including actor, recipient, amount, endpoint, nonce and evidence commitments.
    if (certenExampleDigest(value.intent) !== certenExampleDigest(value.authorization.approvedIntent)) problems.push('intent_differs_from_approval')
    const now = Date.parse(trust.now)
    if (!Number.isFinite(now) || !Number.isFinite(Date.parse(value.intent.notBefore))
      || !Number.isFinite(Date.parse(value.intent.expiresAt)) || now < Date.parse(value.intent.notBefore)
      || now >= Date.parse(value.intent.expiresAt)) problems.push('outside_authority_window')
    if (trust.usedNonces.includes(value.intent.nonce)) problems.push('nonce_already_used')
    if (!/^\d+$/.test(value.intent.amountBaseUnits) || !/^\d+$/.test(value.authorization.policy.maxAmountBaseUnits)
      || BigInt(value.intent.amountBaseUnits) > BigInt(value.authorization.policy.maxAmountBaseUnits)) problems.push('spending_limit_exceeded')
    if (bytesDigest(value.requestJson) !== value.intent.requestSha256) problems.push('request_commitment_mismatch')
    if (!Array.isArray(value.evidence) || value.evidence.length === 0
      || certenExampleDigest(value.evidence) !== value.intent.evidenceSha256
      || value.evidence.some((source) => bytesDigest(source.text) !== source.sourceSha256)) problems.push('evidence_commitment_mismatch')
    if (bytesDigest(value.selectedContext) !== value.intent.selectedContextSha256) problems.push('context_commitment_mismatch')
    if (!value.selectedContext.includes(value.authorization.policy.requiredText)) problems.push('required_evidence_missing')
    delivery = checkBuyerDelivery({ captureBytes: Buffer.from(value.delivery.captureJson), expectedCaptureSha256: trust.captureSha256,
      requestBytes: Buffer.from(value.requestJson), responseBytes: Buffer.from(value.delivery.responseJson) })
  } catch { problems.push('malformed_or_untrusted_example') }
  const result = {
    schemaVersion: 'maha-certen-synthetic-verdict/0.1', syntheticOnly: true,
    evaluatedAt: trust.now,
    preSignDecision: problems.length ? 'withhold' : 'eligible_for_signer_review',
    problems, delivery,
    actualSignatureIssued: false, transactionSubmitted: false, settlement: 'not_checked',
    boundaries: [
      'Fixture evaluation only; not a Certen Proof of Intent, ADI authority check, vault call, or proof of effect.',
      'Required text presence is not proof that an agent read, understood, or obeyed it.',
      'Post-delivery evidence cannot authorize the original payment retroactively.',
      'Trust roots and nonce history are supplied by the caller; no signature verification or durable replay store is implemented.',
      'Certen must define its real signer adapter, approval rules and cryptographic proof format before integration.',
    ],
  }
  return { ...result, receiptDigest: certenExampleDigest(result) }
}
