import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { compileContextPack, parseContextPackRequest, sha256 } from '../../lib/context-compiler.ts'
import { buildDeepContextEvaluation, parseDeepContextRequest } from '../../lib/deep-context-evaluation.ts'
import { createPaidFetch, type PaymentChallenge, type PaymentRequirement, type TypedDataSigner } from '../../lib/x402/client.ts'

export const ORIGIN = 'https://www.mahastrategies.com'
export const PATHS = ['/api/v1/compress', '/api/v1/compress/evaluate'] as const
export const PAYEE = '0xec84c1cd6602bbe387bc8e6f0d3c062f2762de28'
export const ASSET = '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913'
// BigInt() calls rather than literals: the application tsconfig targets
// ES2017, where BigInt literals are a compile error.
export const CAPS = [BigInt(1000), BigInt(10000)] as const

// Entirely synthetic. Labels deliberately precede compilation, not selected
// afterwards to flatter the result. A low-budget run demonstrates abstention.
export function fixture(tokenBudget = 900) {
  const request = {
    clientRequestId: 'context-growth-synthetic-v1',
    task: 'Prepare the Atlas release handoff: approval, spending limit, rollback owner and unresolved delivery risks.',
    tokenBudget, provenance: 'compact', scoring: 'bm25', budgetMode: 'guaranteed',
    documents: [
      { id: 'meeting', title: 'Synthetic release meeting', text: [
        'Atlas release approval is pending the sandbox delivery test.',
        'The Atlas release spending limit is 20 USDC. No production funds are authorized.',
        'The Atlas release rollback owner is Mira. Roll back if the delivery test fails.',
        'The team discussed poster colors and lunch arrangements. These are unrelated to the release decision.',
      ].join('\n\n') },
      { id: 'record', title: 'Synthetic business record', text: [
        'Atlas release approval is pending the sandbox delivery test.',
        'The unresolved Atlas delivery risk is a timeout after payment. Payment alone does not establish delivery.',
        ...Array.from({ length: 30 }, (_, i) => `Archive note ${i + 1}: the office inventory contains notebooks, spare chairs and desk lamps. This inventory entry records routine facilities administration.`),
      ].join('\n\n') },
    ],
    requiredEvidence: [
      { evidenceId: 'approval', sourceId: 'meeting', text: 'Atlas release approval is pending the sandbox delivery test.' },
      { evidenceId: 'budget', sourceId: 'meeting', text: 'The Atlas release spending limit is 20 USDC. No production funds are authorized.' },
      { evidenceId: 'rollback', sourceId: 'meeting', text: 'The Atlas release rollback owner is Mira. Roll back if the delivery test fails.' },
      { evidenceId: 'delivery', sourceId: 'record', text: 'The unresolved Atlas delivery risk is a timeout after payment. Payment alone does not establish delivery.' },
    ],
  }
  return parseDeepContextRequest(request)
}

export function localWorkflow(tokenBudget = 900) {
  const input = fixture(tokenBudget)
  const pack = compileContextPack(parseContextPackRequest(input))
  const evaluation = buildDeepContextEvaluation(input)
  return { input, pack, evaluation, summary: validateResults(input, pack, evaluation) }
}

export function validateResults(
  input: ReturnType<typeof fixture>,
  pack: ReturnType<typeof compileContextPack>,
  evaluation: ReturnType<typeof buildDeepContextEvaluation>,
) {
  const expected = buildDeepContextEvaluation(input)
  assert.equal(pack.clientRequestId, input.clientRequestId)
  assert.equal(evaluation.clientRequestId, input.clientRequestId)
  assert.equal(pack.version, expected.contextPack.version)
  assert.equal(pack.inputHash, expected.contextPack.inputHash)
  assert.equal(pack.outputHash, sha256(pack.context))
  assert.equal(pack.context, expected.contextPack.context)
  assert.deepEqual(pack.includedPassages, expected.contextPack.includedPassages)
  assert.deepEqual(pack.metrics, expected.contextPack.metrics)
  assert.equal(evaluation.version, expected.version)
  assert.equal(evaluation.offerId, expected.offerId)
  assert.equal(evaluation.inputHash, expected.inputHash)
  assert.equal(evaluation.outputHash, expected.outputHash)
  assert.equal(evaluation.contextPack.outputHash, pack.outputHash)
  assert.equal(evaluation.contextPack.context, pack.context)
  assert.deepEqual(evaluation.evidence, expected.evidence)
  assert.deepEqual(evaluation.metrics, expected.metrics)
  assert.deepEqual(evaluation.retentionBoundaries, expected.retentionBoundaries)
  const omitted = evaluation.evidence.filter(e => e.status === 'omitted').map(e => e.evidenceId)
  return {
    inputHash: pack.inputHash, outputHash: pack.outputHash,
    originalEstimatedTokens: pack.metrics.originalEstimatedTokens,
    compiledEstimatedTokens: pack.metrics.compiledEstimatedTokens,
    estimatedReductionPercent: pack.metrics.estimatedReductionPercent,
    retained: evaluation.metrics.retainedEvidenceCount,
    required: evaluation.metrics.requiredEvidenceCount,
    omitted,
    gate: omitted.length ? 'STOP_REQUIRED_EVIDENCE_OMITTED' : 'LABELLED_SPANS_PRESENT',
    accuracyAssessed: false,
    limitation: 'Same-implementation reproduction, not independent scientific validation. Matching labelled spans do not establish answer quality or completeness.',
  }
}

export function paymentGuard() {
  let reserved = BigInt(0)
  const seen = new Set<string>()
  return (path: typeof PATHS[number], requirement: PaymentRequirement, challenge: PaymentChallenge) => {
    const cap = CAPS[PATHS.indexOf(path)]
    assert.equal(challenge.resource.url, ORIGIN + path, 'Unexpected resource')
    assert.equal(requirement.scheme, 'exact')
    assert.equal(requirement.network, 'eip155:8453')
    assert.equal(requirement.asset.toLowerCase(), ASSET)
    assert.equal(requirement.payTo.toLowerCase(), PAYEE)
    assert.equal(requirement.extra?.name, 'USD Coin')
    assert.equal(requirement.extra?.version, '2')
    assert.match(requirement.amount, /^[1-9][0-9]*$/)
    assert.equal(BigInt(requirement.amount), cap, 'Price changed: stop for fresh approval')
    assert.ok(Number.isInteger(requirement.maxTimeoutSeconds) && requirement.maxTimeoutSeconds > 0 && requirement.maxTimeoutSeconds <= 300)
    assert.ok(!seen.has(path), 'No automatic repeat authorization')
    assert.ok(reserved + cap <= BigInt(11000), 'Workflow cap exceeded')
    seen.add(path)
    reserved += cap // Never release on an ambiguous response.
  }
}

// Caller supplies its own signer. No keys, wallet discovery or automatic
// payments exist in the CLI. This function is never called by local mode.
export async function paidWorkflow(address: string, signTypedData: TypedDataSigner, fetchImpl = globalThis.fetch) {
  const input = fixture()
  input.clientRequestId = `context-growth-${randomUUID()}`
  const guard = paymentGuard()
  const results: unknown[] = []
  const receipts: unknown[] = []
  for (const path of PATHS) {
    const paidFetch = createPaidFetch({
      address, chainId: 8453, signTypedData,
      fetchImpl: (url, init) => fetchImpl(url, { ...init, redirect: 'error', signal: AbortSignal.timeout(30_000) }),
      onPaymentRequired: (requirement, { challenge }) => guard(path, requirement, challenge),
    })
    const response = await paidFetch(ORIGIN + path, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(path === PATHS[0] ? parseContextPackRequest(input) : input),
    })
    assert.ok(response.ok, `HTTP ${response.status}; stop, do not repay`)
    const receipt = response.x402?.receipt
    assert.equal(receipt?.success, true, 'Settlement receipt unavailable; reconcile before retry')
    assert.equal(receipt?.network, 'eip155:8453')
    assert.match(receipt?.transaction ?? '', /^0x[0-9a-fA-F]{64}$/)
    receipts.push({ path, receipt, chainStatus: 'unverified' })
    const body = await response.json()
    results.push(body)
    // Stop before buying evaluation if the first response is inconsistent.
    if (path === PATHS[0]) validateResults(input, body, buildDeepContextEvaluation(input))
  }
  return {
    mode: 'paid', receipts,
    summary: validateResults(input, results[0] as ReturnType<typeof compileContextPack>, results[1] as ReturnType<typeof buildDeepContextEvaluation>),
    warning: 'Receipts are seller-reported. Independently reconcile Base transfers before counting purchases. On error or timeout never automatically rerun this workflow.',
  }
}
