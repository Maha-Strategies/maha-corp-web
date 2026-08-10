import assert from 'node:assert/strict'
import test from 'node:test'

import { privateKeyToAccount } from 'viem/accounts'

import { createFacilitator, rejectionFromProbe } from '../lib/x402/facilitator.ts'
import { buildTypedData, type PaymentRequirement as ClientRequirement } from '../lib/x402/client.ts'
import { assertRecoverableSignature, failureEvidenceFor, hashNonce } from '../lib/x402/canary-evidence.ts'
import { X402PaymentError } from '../lib/x402/client.ts'
import {
  CONTEXT_COMPILER_DESCRIPTION,
  MAX_RESOURCE_DESCRIPTION_BYTES,
  MAX_RESOURCE_DESCRIPTION_CHARS,
  boundDescription,
  resourceInfoFor,
} from '../lib/x402/discovery.ts'
import type { PaymentPayload, PaymentRequirement } from '../lib/x402/protocol.ts'

// The canary spent a day reporting `facilitator_verify_failed` for what was a
// CDP schema rejection naming the offending field. One string stood for an
// unreachable host, a refused signature, a revoked credential and a payload
// CDP would not parse -- outcomes that call for opposite responses. These
// tests hold the distinctions that were missing.

const requirement: PaymentRequirement = {
  scheme: 'exact', network: 'eip155:8453', amount: '1000',
  payTo: '0xec84c1cd6602bbe387bc8e6f0d3c062f2762de28', maxTimeoutSeconds: 60,
  asset: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  extra: { name: 'USD Coin', version: '2' },
}

const payment: PaymentPayload = {
  x402Version: 2,
  accepted: requirement,
  payload: {
    signature: `0x${'ab'.repeat(65)}`,
    authorization: {
      from: '0x7b7ff44288fADe4A1829abA2584DFCeB952146f2',
      to: requirement.payTo,
      value: '1000',
      validAfter: '1786267537',
      validBefore: '1786268197',
      nonce: `0x${'cd'.repeat(32)}`,
    },
  },
}

/** Replaces fetch for both the SDK call and the diagnostic probe that follows. */
function withFetch(handler: (url: string) => Response | Promise<Response> | never, run: () => Promise<void>) {
  const original = globalThis.fetch
  let calls = 0
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    calls += 1
    return handler(String(input instanceof Request ? input.url : input))
  }) as typeof fetch
  return run().finally(() => { globalThis.fetch = original }).then(() => calls)
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

// ---------------------------------------------------------------------------
// Signer recovery
// ---------------------------------------------------------------------------

test('a correctly signed authorization recovers to the payer', async () => {
  const account = privateKeyToAccount(`0x${'11'.repeat(32)}`)
  const clientRequirement = requirement as unknown as ClientRequirement
  const typed = buildTypedData(clientRequirement, account.address)
  const signature = await account.signTypedData({
    domain: { ...typed.domain, verifyingContract: typed.domain.verifyingContract as `0x${string}` },
    types: typed.types,
    primaryType: typed.primaryType,
    message: { ...typed.message, from: typed.message.from as `0x${string}`, to: typed.message.to as `0x${string}`, nonce: typed.message.nonce as `0x${string}` },
  })

  await assert.doesNotReject(() => assertRecoverableSignature(typed, signature, account.address))
})

test('a signature that recovers to another address is refused before it is sent', async () => {
  const account = privateKeyToAccount(`0x${'11'.repeat(32)}`)
  const other = privateKeyToAccount(`0x${'22'.repeat(32)}`)
  const typed = buildTypedData(requirement as unknown as ClientRequirement, account.address)
  const signature = await other.signTypedData({
    domain: { ...typed.domain, verifyingContract: typed.domain.verifyingContract as `0x${string}` },
    types: typed.types,
    primaryType: typed.primaryType,
    message: { ...typed.message, from: typed.message.from as `0x${string}`, to: typed.message.to as `0x${string}`, nonce: typed.message.nonce as `0x${string}` },
  })

  await assert.rejects(
    () => assertRecoverableSignature(typed, signature, account.address),
    /recovers to .*not the expected payer/,
  )
})

// ---------------------------------------------------------------------------
// Facilitator diagnosis
// ---------------------------------------------------------------------------

test('a typed facilitator rejection keeps its reason', async () => {
  const facilitator = createFacilitator({ url: 'https://facilitator.example' })
  let result: Awaited<ReturnType<typeof facilitator.verify>> | undefined

  await withFetch(() => json(200, { isValid: false, invalidReason: 'insufficient_funds', invalidMessage: 'payer balance is 0' }), async () => {
    result = await facilitator.verify(payment, requirement)
  })

  assert.equal(result?.ok, false)
  if (!result?.ok) assert.match(result.reason, /insufficient_funds/)
})

test('a non-2xx response is diagnosed from the probe rather than collapsed', async () => {
  // Exactly the shape CDP returned: HTTP 400 with the reason in errorMessage.
  // Before this, the SDK threw an untyped Error and the caller reported
  // `facilitator_verify_failed`, discarding the sentence that named the field.
  const facilitator = createFacilitator({ url: 'https://facilitator.example' })
  let result: Awaited<ReturnType<typeof facilitator.verify>> | undefined

  await withFetch(() => json(400, {
    correlationId: 'a285c847081470ef-SIN',
    errorType: 'invalid_request',
    errorMessage: "'paymentPayload' is invalid: must match one of [x402V2PaymentPayload, x402V1PaymentPayload]",
  }), async () => {
    result = await facilitator.verify(payment, requirement)
  })

  assert.equal(result?.ok, false)
  if (!result?.ok) {
    // Its own code: the payment was never judged, so this is neither
    // `isValid: false` nor an unreachable host.
    assert.match(result.reason, /facilitator_verify_rejected_request/)
    assert.match(result.reason, /paymentPayload' is invalid/)
  }
})

test('provider prose is stripped of anything that could carry payload values', async () => {
  const facilitator = createFacilitator({ url: 'https://facilitator.example' })
  let result: Awaited<ReturnType<typeof facilitator.verify>> | undefined
  const nonce = `0x${'cd'.repeat(32)}`

  await withFetch(() => json(400, { errorType: 'invalid_request', errorMessage: `nonce ${nonce} is malformed` }), async () => {
    result = await facilitator.verify(payment, requirement)
  })

  assert.equal(result?.ok, false)
  if (!result?.ok) {
    assert.ok(!result.reason.includes(nonce), 'a hex value must not reach a public refusal body')
    assert.match(result.reason, /0x\[redacted\]/)
  }
})

test('an authentication failure is distinguishable from an invalid payment', async () => {
  const facilitator = createFacilitator({ url: 'https://facilitator.example' })
  let result: Awaited<ReturnType<typeof facilitator.verify>> | undefined

  await withFetch(() => new Response('Unauthorized', { status: 401 }), async () => {
    result = await facilitator.verify(payment, requirement)
  })

  assert.equal(result?.ok, false)
  // A 401 body carries no provider reason, so it must not be dressed up as
  // one. It stays the generic failure -- and the logged diagnostic carries the
  // status that tells an operator to look at credentials, not at the payload.
  if (!result?.ok) {
    assert.equal(result.reason, 'facilitator_verify_failed')
    assert.doesNotMatch(result.reason, /insufficient_funds|invalid_request/)
  }
})

test('a network failure stays fail-closed and never reads as a payment', async () => {
  const facilitator = createFacilitator({ url: 'https://facilitator.example' })
  let result: Awaited<ReturnType<typeof facilitator.verify>> | undefined

  await withFetch(() => { throw new Error('getaddrinfo ENOTFOUND facilitator.example') }, async () => {
    result = await facilitator.verify(payment, requirement)
  })

  assert.equal(result?.ok, false)
  if (!result?.ok) assert.equal(result.reason, 'facilitator_verify_failed')
})

test('no verification failure path reaches settlement', async () => {
  const facilitator = createFacilitator({ url: 'https://facilitator.example' })
  const paths: string[] = []

  await withFetch((url) => {
    paths.push(new URL(url).pathname)
    return json(400, { errorType: 'invalid_request', errorMessage: 'nope' })
  }, async () => {
    const result = await facilitator.verify(payment, requirement)
    assert.equal(result.ok, false)
  })

  // The SDK call and the diagnostic probe both go to /verify. A /settle here
  // would mean a refused payment could still move money.
  assert.ok(paths.length > 0)
  assert.deepEqual([...new Set(paths)], ['/verify'])
})

test('a probe verdict is only trusted when the facilitator actually refused', () => {
  assert.equal(rejectionFromProbe('verify', { isValid: false, invalidReason: 'expired' }), 'expired')
  assert.equal(rejectionFromProbe('verify', { isValid: true, payer: '0xA' }), null)
  assert.equal(rejectionFromProbe('verify', { isValid: false }), null)
  assert.equal(rejectionFromProbe('settle', { success: false, errorReason: 'invalid_payload', errorMessage: 'bad' }), 'invalid_payload: bad')
  assert.equal(rejectionFromProbe('verify', null), null)
})

// ---------------------------------------------------------------------------
// Canary evidence
// ---------------------------------------------------------------------------

test('a refused payment produces evidence naming the layer, not just the failure', async () => {
  const authorization = {
    from: '0x7b7ff44288fADe4A1829abA2584DFCeB952146f2',
    to: requirement.payTo,
    value: BigInt(1000),
    validAfter: BigInt(1786267537),
    validBefore: BigInt(1786268197),
    nonce: `0x${'cd'.repeat(32)}`,
  }
  const evidence = await failureEvidenceFor(new X402PaymentError('payment_rejected', 'refused', {
    status: 402,
    providerReason: "invalid_request: 'paymentPayload' is invalid",
    authorization,
  }))

  assert.equal(evidence.operation, 'verify')
  assert.equal(evidence.errorCode, 'payment_rejected')
  assert.equal(evidence.httpStatus, 402)
  assert.equal(evidence.settled, false)
  assert.match(evidence.providerReason ?? '', /paymentPayload/)
  assert.equal(evidence.authorization?.validBefore, '1786268197')
})

test('canary evidence carries a nonce digest and never the nonce', async () => {
  const nonce = `0x${'cd'.repeat(32)}`
  const evidence = await failureEvidenceFor(new X402PaymentError('payment_rejected', 'refused', {
    status: 402,
    authorization: { from: '0xA', to: '0xB', value: BigInt(1), validAfter: BigInt(1), validBefore: BigInt(2), nonce },
  }))

  const serialized = JSON.stringify(evidence)
  assert.ok(!serialized.includes(nonce), 'the raw nonce must never reach evidence')
  assert.equal(evidence.authorization?.nonceHash, await hashNonce(nonce))
  assert.equal(evidence.authorization?.nonceHash.length, 16)
})

test('a spent authorization is recorded as settled so it is not retried blindly', async () => {
  const evidence = await failureEvidenceFor(new X402PaymentError('payment_already_used', 'spent', { status: 409 }))
  assert.equal(evidence.operation, 'settle')
  assert.equal(evidence.settled, true)
})

test('a non-payment error still yields evidence rather than nothing', async () => {
  const evidence = await failureEvidenceFor(new Error('Bazaar merchant discovery returned HTTP 503.'))
  assert.equal(evidence.errorCode, 'canary_error')
  assert.match(evidence.providerReason ?? '', /503/)
})

// ---------------------------------------------------------------------------
// The root cause itself
// ---------------------------------------------------------------------------

const utf8 = (value: string) => new TextEncoder().encode(value).length

test('the authored Context Compiler description fits without needing the clamp', () => {
  // CDP rejects the whole v2 payload union when this field is oversized, which
  // refuses every payment while looking like an unreachable facilitator. The
  // last settlement to succeed carried 196 characters; 702 and 865 both failed.
  // 480 passes and 523 fails: x402-foundation/x402#2284.
  assert.ok(
    CONTEXT_COMPILER_DESCRIPTION.length <= MAX_RESOURCE_DESCRIPTION_CHARS,
    `the Context Compiler description is ${CONTEXT_COMPILER_DESCRIPTION.length} characters, over the `
    + `${MAX_RESOURCE_DESCRIPTION_CHARS} the facilitator accepts. Shorten it, or move the detail into `
    + 'SKILL.md and the Bazaar info extension, which are not length-bound.',
  )
  assert.ok(utf8(CONTEXT_COMPILER_DESCRIPTION) <= MAX_RESOURCE_DESCRIPTION_BYTES)

  // The production value must fit as authored. Relying on the clamp would ship
  // a sentence cut off mid-thought to every agent reading the challenge, and
  // would hide the fact that the copy outgrew its field.
  assert.equal(boundDescription(CONTEXT_COMPILER_DESCRIPTION), CONTEXT_COMPILER_DESCRIPTION)
})

test('the description a challenge actually publishes is bounded', () => {
  const info = resourceInfoFor(
    { offerId: 'context-compression', method: 'POST' as const, path: '/api/v1/compress', amount: '1000', description: 'x', concurrencyCap: 4 },
    'https://www.mahastrategies.com/api/v1/compress',
  )
  const description = info.description ?? ''
  assert.ok(description.length > 0)
  assert.ok(description.length <= MAX_RESOURCE_DESCRIPTION_CHARS)
  assert.ok(utf8(description) <= MAX_RESOURCE_DESCRIPTION_BYTES)
  // Still says what it is, how to decide whether it pays, and where it does not fit.
  assert.match(description, /context packs/)
  assert.match(description, /Net-positive above/)
  assert.match(description, /Not for tabular/)
})

test('oversized ASCII is clamped', () => {
  const long = `${'word '.repeat(400)}end`
  const bounded = boundDescription(long)
  assert.ok(bounded.length <= MAX_RESOURCE_DESCRIPTION_CHARS)
  assert.ok(utf8(bounded) <= MAX_RESOURCE_DESCRIPTION_BYTES)
  assert.equal(boundDescription('short'), 'short')
})

test('oversized multibyte text is clamped without breaking a character', () => {
  // Three bytes per character, so 480 characters is 1,440 bytes: the byte
  // ceiling binds first and a naive character-count clamp would have sent a
  // field three times over the limit.
  const japanese = 'コンテキスト圧縮'.repeat(80)
  const bounded = boundDescription(japanese)

  assert.ok(utf8(bounded) <= MAX_RESOURCE_DESCRIPTION_BYTES)
  assert.ok(bounded.length < japanese.length)
  // Re-encoding is lossless only if no character was cut in half. A split
  // sequence decodes to U+FFFD and would not survive the round trip.
  assert.equal(new TextDecoder('utf-8', { fatal: true }).decode(new TextEncoder().encode(bounded)), bounded)
  assert.ok(!bounded.includes('�'))
})

test('a surrogate pair is never split by the clamp', () => {
  // Emoji are two UTF-16 units and four UTF-8 bytes. Slicing a string at a
  // fixed index lands between the halves and produces a lone surrogate, which
  // is not valid UTF-8 and is precisely the malformed field being avoided.
  const emoji = '🧠📦'.repeat(200)
  const bounded = boundDescription(emoji)

  assert.ok(utf8(bounded) <= MAX_RESOURCE_DESCRIPTION_BYTES)
  assert.ok(bounded.length <= MAX_RESOURCE_DESCRIPTION_CHARS)
  for (const unit of bounded) assert.ok(unit.codePointAt(0)! < 0xd800 || unit.codePointAt(0)! > 0xdfff)
  assert.equal([...bounded].length * 2, bounded.length)
})

test('clamped output does not end mid-word when a boundary is available', () => {
  const long = `${'alpha bravo charlie delta '.repeat(40)}omega`
  const bounded = boundDescription(long)
  assert.ok(!bounded.endsWith(' '))
  // Every retained token is whole, so the published sentence never trails off
  // in the middle of a word.
  for (const word of bounded.split(' ')) {
    assert.ok(['alpha', 'bravo', 'charlie', 'delta', 'omega'].includes(word), `truncated word: ${word}`)
  }
})
