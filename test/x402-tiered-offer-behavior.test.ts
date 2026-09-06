import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { priceFor, requirementFor, x402Config, type X402Config } from '../lib/x402/config.ts'
import { resolveX402 } from '../lib/x402/gateway.ts'
import { discoveryExtensionsFor, resourceInfoFor } from '../lib/x402/discovery.ts'
import { matchRequirement, matchesPaymentContext, type PaymentFacilitator } from '../lib/x402/protocol.ts'
import { SLOT_RESOURCE_HEADER, SLOT_TOKEN_HEADER, withSlotRelease } from '../lib/x402/slot.ts'
import { apiProxyGate } from '../lib/api-proxy-policy.ts'
import { discoverySourceFrom, offerChallengeFor, recordOfferUsage, repeatPayers } from '../lib/x402/offer-telemetry.ts'
import {
  MAX_X402_EVALUATION_BYTES,
  buildDeepContextEvaluation,
  parseDeepContextRequest,
} from '../lib/deep-context-evaluation.ts'
import {
  MAX_AUDIT_ATTEMPTS,
  auditJobResponse,
  auditRetrievalPath,
  createRetrievalToken,
  isStaleProcessing,
  retrievalTokenHash,
  retrievalTokenMatches,
  validRetrievalToken,
} from '../lib/x402/mps-audit-job.ts'
import { auditInputHash } from '../lib/mps-audit-engine.ts'

const ROOT = join(import.meta.dirname, '..')

const ENV = {
  X402_ENABLED: 'true',
  X402_FACILITATOR_URL: 'https://facilitator.example/x402',
  X402_PAY_TO: '0xSettlement',
  X402_ASSET: '0xUSDC',
  X402_NETWORK: 'base',
  X402_RESOURCES: JSON.stringify([
    { method: 'POST', path: '/api/v1/compress' },
    { method: 'POST', path: '/api/v1/compress/evaluate' },
    { method: 'POST', path: '/api/v1/mps/audit' },
  ]),
}
const config = () => x402Config(ENV) as X402Config

const encode = (value: unknown) => Buffer.from(JSON.stringify(value), 'utf8').toString('base64')

async function signatureFor(path: string, overrides: { accepted?: Record<string, unknown>; resourceUrl?: string } = {}) {
  const priced = priceFor('POST', path, config())!
  const url = `https://www.mahastrategies.com${path}`
  const requirement = requirementFor(priced, url, config())
  const declared = await discoveryExtensionsFor(priced, url, requirement)
  return encode({
    x402Version: 2,
    resource: resourceInfoFor(priced, overrides.resourceUrl ?? url),
    accepted: { ...requirement, ...overrides.accepted },
    payload: { signature: '0x' },
    extensions: declared ? { 'declaration-integrity': declared['declaration-integrity'] } : undefined,
  })
}

const MPS_TEXT = 'A published report says the pilot reduced manual review time by twenty percent.'
const MPS_REQUEST_ID = 'req_behaviour_0001'

const post = (path: string, headers: Record<string, string> = {}) => {
  const isMps = path === '/api/v1/mps/audit'
  return new Request(`https://www.mahastrategies.com${path}`, {
    method: 'POST',
    headers: isMps ? { 'content-type': 'application/json', ...headers } : headers,
    ...(isMps ? { body: JSON.stringify({ clientRequestId: MPS_REQUEST_ID, text: MPS_TEXT }) } : {}),
  })
}

const facilitator = (): PaymentFacilitator => ({
  verify: async () => ({ ok: true, payer: '0xAgent' }),
  settle: async () => ({ ok: true, payer: '0xAgent', transaction: 'tx_1' }),
})
const ledger = () => ({ rpc: async () => ({ data: 'claimed', error: null }) }) as never
const acquire = async () => ({ admitted: true, active: 1, token: 'slot-token' })

/** A store that always grants the claim, for tests about other things. */
const admissionLedger = (decision = 'proceed', transaction: string | null = null) => ({
  rpc: async (name: string) => name === 'reserve_x402_admission'
    ? { data: [{ decision, payment_transaction: transaction }], error: null }
    : { data: null, error: null },
})

/** Headers a payer must send for an offer that creates a job. */
const IDEMPOTENT = {
  'x-maha-idempotency-key': MPS_REQUEST_ID,
  'x-maha-input-hash': auditInputHash(MPS_TEXT),
}


// --- 7. Unpaid but valid requests are challenged, never 400 ------------------

test('an unpaid but otherwise valid request is answered 402, not 400', async () => {
  // The route's own validation must never run before payment. If it did, a
  // caller could learn whether its payload was acceptable without paying, and
  // -- worse -- a well-formed request would be rejected for the wrong reason,
  // teaching an agent the endpoint is broken rather than that it costs money.
  for (const path of ['/api/v1/compress', '/api/v1/compress/evaluate', '/api/v1/mps/audit']) {
    const outcome = await resolveX402(post(path), { config: config(), ledger: ledger() })
    assert.equal(outcome.kind, 'challenge', `${path} must be challenged`)
    if (outcome.kind !== 'challenge') continue
    assert.equal(outcome.status, 402)

    const body = JSON.parse(Buffer.from(outcome.header, 'base64').toString('utf8')) as {
      accepts: { amount: string; network: string }[]
    }
    assert.equal(body.accepts[0]!.network, 'eip155:8453')
    assert.equal(body.accepts[0]!.amount, priceFor('POST', path, config())!.amount)
  }
})

test('an empty body is still a 402 rather than a validation error', async () => {
  // The proxy decides before the handler sees a byte, so payload shape cannot
  // change the answer to an unpaid request.
  const outcome = await resolveX402(
    new Request('https://www.mahastrategies.com/api/v1/compress/evaluate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    }),
    { config: config(), ledger: ledger() },
  )
  assert.equal(outcome.kind, 'challenge')
})

// --- 8. A paid request reaches the route with no API key ---------------------

test('a paid request is admitted with no API key and carries its settlement', async () => {
  for (const path of ['/api/v1/compress', '/api/v1/compress/evaluate', '/api/v1/mps/audit']) {
    const outcome = await resolveX402(
      post(path, { 'PAYMENT-SIGNATURE': await signatureFor(path), ...IDEMPOTENT }),
      { config: config(), facilitator: facilitator(), ledger: ledger(), acquire, admissionLedger: admissionLedger() },
    )
    assert.equal(outcome.kind, 'paid', `${path} must admit a settled payment`)
    if (outcome.kind !== 'paid') continue
    assert.equal(outcome.payer, '0xAgent')
    assert.equal(outcome.amountPaid, priceFor('POST', path, config())!.amount)
  }
})

// --- 9. Credentialed routes still enforce credentials ------------------------

test('the API-key routes are untouched by the payment path', () => {
  // These are protected by the proxy's key gate. If x402 ever started matching
  // them, an unpaid caller would be offered a price for a resource whose
  // billing is credits, and a paid caller would bypass the credit ledger.
  for (const path of ['/api/v1/jobs/tensor-network', '/api/v1/jobs/geometric-registration', '/api/v1/chat/completions']) {
    assert.equal(apiProxyGate(path, 'POST', true), 'protected')
    assert.equal(priceFor('POST', path, config()), null)
  }
})

test('an unpriced route under the payment matcher is left entirely alone', async () => {
  const outcome = await resolveX402(post('/api/v1/jobs/tensor-network'), { config: config(), ledger: ledger() })
  assert.equal(outcome.kind, 'not_applicable')
})

test('the MPS retrieval path self-authenticates instead of demanding a key or a payment', () => {
  // Both halves matter. It must not be priced -- charging a second $0.10 to
  // look at a job already bought is how a settled payment becomes a support
  // ticket -- and it must not fall into the API-key gate either, because the
  // payer holds no key.
  assert.equal(apiProxyGate('/api/v1/mps/audit/audit_abc', 'GET', true), 'self_managed')
  assert.equal(apiProxyGate('/api/v1/mps/audit/audit_abc', 'POST', true), 'self_managed')
  assert.equal(priceFor('POST', '/api/v1/mps/audit/audit_abc', config()), null)

  // The priced parent keeps its 402: the prefix must not swallow it.
  assert.equal(apiProxyGate('/api/v1/mps/audit', 'POST', true), 'protected')
  assert.equal(priceFor('POST', '/api/v1/mps/audit', config())?.amount, '100000')
})

// --- 10. Wrong terms are rejected -------------------------------------------

test('a payment that changes any published term is refused', async () => {
  const url = 'https://www.mahastrategies.com/api/v1/compress'
  const priced = priceFor('POST', '/api/v1/compress', config())!
  const requirement = requirementFor(priced, url, config())

  const tampered: Record<string, Record<string, unknown>> = {
    amount: { amount: '1' },
    network: { network: 'eip155:84532' },
    asset: { asset: '0xNotUSDC' },
    payee: { payTo: '0xAttacker' },
    scheme: { scheme: 'upto' },
    timeout: { maxTimeoutSeconds: 86_400 },
  }
  for (const [name, override] of Object.entries(tampered)) {
    const payment = { x402Version: 2 as const, accepted: { ...requirement, ...override }, payload: {} }
    assert.equal(matchRequirement(payment as never, [requirement]), null, `${name} must not match`)
  }

  // And the unmodified terms do match, so the assertions above are testing the
  // tampering rather than a permanently-false comparison.
  assert.ok(matchRequirement({ x402Version: 2, accepted: requirement, payload: {} } as never, [requirement]))
})

test('a payment bound to a different resource is refused', async () => {
  // Exact resource binding. A challenge issued for the entry endpoint must not
  // be answerable against the deep one, whatever the amount says.
  const entryUrl = 'https://www.mahastrategies.com/api/v1/compress'
  const deepUrl = 'https://www.mahastrategies.com/api/v1/compress/evaluate'
  const entry = priceFor('POST', '/api/v1/compress', config())!
  const deep = priceFor('POST', '/api/v1/compress/evaluate', config())!

  const entryInfo = resourceInfoFor(entry, entryUrl)
  const deepInfo = resourceInfoFor(deep, deepUrl)
  assert.equal(matchesPaymentContext({ x402Version: 2, resource: deepInfo, accepted: {} } as never, entryInfo), false)
  assert.equal(matchesPaymentContext({ x402Version: 2, resource: entryInfo, accepted: {} } as never, entryInfo), true)

  // The same holds end to end: a signature built for the deep endpoint is
  // challenged rather than admitted when presented at the entry endpoint.
  const outcome = await resolveX402(
    post('/api/v1/compress', { 'PAYMENT-SIGNATURE': await signatureFor('/api/v1/compress/evaluate') }),
    { config: config(), facilitator: facilitator(), ledger: ledger(), acquire },
  )
  assert.equal(outcome.kind, 'challenge')
})

test('a declaration digest from another offer does not bind this one', async () => {
  const entryUrl = 'https://www.mahastrategies.com/api/v1/compress'
  const entry = priceFor('POST', '/api/v1/compress', config())!
  const deep = priceFor('POST', '/api/v1/compress/evaluate', config())!
  const entryExt = await discoveryExtensionsFor(entry, entryUrl, requirementFor(entry, entryUrl, config()))
  const deepUrl = 'https://www.mahastrategies.com/api/v1/compress/evaluate'
  const deepExt = await discoveryExtensionsFor(deep, deepUrl, requirementFor(deep, deepUrl, config()))

  const info = resourceInfoFor(entry, entryUrl)
  assert.equal(
    matchesPaymentContext(
      { x402Version: 2, resource: info, accepted: {}, extensions: { 'declaration-integrity': deepExt!['declaration-integrity'] } } as never,
      info,
      entryExt,
    ),
    false,
  )
})

test('a partial extension echo cannot drop the terms it dislikes', async () => {
  // Digest-only binding is allowed because a full echo does not fit the 16 KB
  // header. Allowing an arbitrary *subset* would be a different thing: a payer
  // could keep a valid digest while silently dropping the price annotation or
  // the capability boundary, and the server would never notice which went
  // missing.
  const url = 'https://www.mahastrategies.com/api/v1/compress'
  const priced = priceFor('POST', '/api/v1/compress', config())!
  const extensions = await discoveryExtensionsFor(priced, url, requirementFor(priced, url, config()))
  const info = resourceInfoFor(priced, url)

  const withExtra = {
    'declaration-integrity': extensions!['declaration-integrity'],
    'maha-offer': { offerId: 'context-compression', amount: '1' },
  }
  assert.equal(matchesPaymentContext({ x402Version: 2, resource: info, accepted: {}, extensions: withExtra } as never, info, extensions), false)
  assert.equal(matchesPaymentContext({ x402Version: 2, resource: info, accepted: {}, extensions: {} } as never, info, extensions), false)
})

test('a replayed payment is refused rather than served twice', async () => {
  const duplicateLedger = { rpc: async () => ({ data: 'duplicate', error: null }) } as never
  const outcome = await resolveX402(
    post('/api/v1/mps/audit', { 'PAYMENT-SIGNATURE': await signatureFor('/api/v1/mps/audit'), ...IDEMPOTENT }),
    { config: config(), facilitator: facilitator(), ledger: duplicateLedger, acquire, admissionLedger: admissionLedger() },
  )
  assert.equal(outcome.kind, 'refused')
  if (outcome.kind !== 'refused') return
  assert.equal(outcome.status, 409)
  assert.equal(outcome.code, 'payment_already_used')
})

// --- 11. Slot release on every exit path ------------------------------------

test('a slot is released on success, on validation failure, on ledger failure, and on a throw', async () => {
  const released: string[] = []
  const headers = new Headers({ [SLOT_RESOURCE_HEADER]: 'context-compression', [SLOT_TOKEN_HEADER]: 'tok' })
  const request = () => new Request('https://www.mahastrategies.com/api/v1/compress', { method: 'POST', headers })

  // withSlotRelease releases through lib/x402/concurrency, which needs Redis.
  // The seam that matters is that the `finally` runs on every path, so the
  // handler records its own exit and the release is observed by the wrapper
  // completing rather than throwing.
  const cases: { name: string; handler: () => Promise<Response> }[] = [
    { name: 'success', handler: async () => Response.json({ ok: true }, { status: 201 }) },
    { name: 'validation failure', handler: async () => Response.json({ error: {} }, { status: 400 }) },
    { name: 'ledger failure', handler: async () => Response.json({ error: {} }, { status: 503 }) },
    { name: 'thrown', handler: async () => { throw new Error('boom') } },
  ]

  for (const scenario of cases) {
    const wrapped = withSlotRelease(async () => {
      released.push(scenario.name)
      return scenario.handler()
    })
    await wrapped(request()).catch(() => undefined)
  }

  assert.deepEqual(released, ['success', 'validation failure', 'ledger failure', 'thrown'])
})

test('a thrown handler still propagates its error after freeing capacity', async () => {
  const wrapped = withSlotRelease(async () => { throw new Error('boom') })
  await assert.rejects(
    wrapped(new Request('https://www.mahastrategies.com/api/v1/compress', { method: 'POST' })),
    /boom/,
  )
})

// --- 12. Deep Context input bounds ------------------------------------------

const documentsFor = (count: number) => Array.from({ length: count }, (_, index) => ({
  id: `doc-${index}`,
  title: `Document ${index}`,
  text: `Release may proceed after the security owner attaches evidence number ${index}. Routine background covers staffing and dashboards.`,
}))

const deepRequest = (overrides: Record<string, unknown> = {}) => ({
  clientRequestId: 'req_bounds_0001',
  task: 'Find the release condition while removing duplicate operational background.',
  tokenBudget: 128,
  documents: documentsFor(2),
  requiredEvidence: [{ evidenceId: 'gate', sourceId: 'doc-0', text: 'Release may proceed after the security owner attaches evidence number 0.' }],
  ...overrides,
})

test('deep evaluation accepts 1 to 8 documents and refuses 0 or 9', () => {
  assert.ok(parseDeepContextRequest(deepRequest({ documents: documentsFor(1), requiredEvidence: [{ evidenceId: 'gate', sourceId: 'doc-0', text: 'Release may proceed after the security owner attaches evidence number 0.' }] })))
  assert.ok(parseDeepContextRequest(deepRequest({ documents: documentsFor(8) })))
  assert.throws(() => parseDeepContextRequest(deepRequest({ documents: [] })), /1-8/)
  assert.throws(() => parseDeepContextRequest(deepRequest({ documents: documentsFor(9) })), /1-8/)
})

test('deep evaluation accepts 1 to 32 evidence spans and refuses 0 or 33', () => {
  const span = (index: number) => ({ evidenceId: `e${index}`, sourceId: 'doc-0', text: 'Release may proceed after the security owner attaches evidence number 0.' })
  assert.ok(parseDeepContextRequest(deepRequest({ requiredEvidence: [span(0)] })))
  assert.ok(parseDeepContextRequest(deepRequest({ requiredEvidence: Array.from({ length: 32 }, (_, i) => span(i)) })))
  assert.throws(() => parseDeepContextRequest(deepRequest({ requiredEvidence: [] })), /1-32/)
  assert.throws(() => parseDeepContextRequest(deepRequest({ requiredEvidence: Array.from({ length: 33 }, (_, i) => span(i)) })), /1-32/)
})

test('the deep offer publishes the enterprise byte ceiling and does not move the credentialed one', async () => {
  assert.equal(MAX_X402_EVALUATION_BYTES, 1_050_000)

  // The credential-protected /api/context-pack-evaluations route publishes a
  // 128 KB limit and keeps it. Widening a shared constant would have silently
  // changed that route's contract for existing credential holders.
  const { MAX_CONTEXT_EVALUATION_BYTES } = await import('../lib/context-pack-evaluator.ts')
  assert.equal(MAX_CONTEXT_EVALUATION_BYTES, 128_000)
  assert.ok(MAX_X402_EVALUATION_BYTES > MAX_CONTEXT_EVALUATION_BYTES)
})

test('an evidence span that is not verbatim in its source is refused', () => {
  // Retention is exact span matching, so a span that was never in the document
  // could never be retained and the percentage would be quietly wrong.
  assert.throws(
    () => parseDeepContextRequest(deepRequest({ requiredEvidence: [{ evidenceId: 'ghost', sourceId: 'doc-0', text: 'A sentence that appears nowhere in the source.' }] })),
    /exact span/,
  )
})

// --- 13. Retention arithmetic is exact --------------------------------------

test('required-evidence retention is exact and reported per span', () => {
  const retained = 'Release may proceed after the security owner attaches evidence number 0.'
  const dropped = 'Routine background covers staffing and dashboards.'
  const result = buildDeepContextEvaluation(parseDeepContextRequest(deepRequest({
    tokenBudget: 64,
    requiredEvidence: [
      { evidenceId: 'kept', sourceId: 'doc-0', text: retained },
      { evidenceId: 'maybe', sourceId: 'doc-1', text: dropped.replace('0', '1') },
    ],
  })))

  assert.equal(result.metrics.requiredEvidenceCount, 2)
  const retainedCount = result.evidence.filter((span) => span.status === 'retained').length
  assert.equal(result.metrics.retainedEvidenceCount, retainedCount)
  // The percentage is derived from the counts, not measured separately.
  assert.equal(result.metrics.requiredEvidenceRetentionPercent, Number(((retainedCount / 2) * 100).toFixed(1)))

  // Every span is accounted for exactly once, with a hash and no text.
  assert.equal(result.evidence.length, 2)
  for (const span of result.evidence) {
    assert.match(span.evidenceHash, /^sha256:[a-f0-9]{64}$/)
    assert.ok(['retained', 'omitted'].includes(span.status))
    assert.equal((span as Record<string, unknown>).text, undefined, 'evidence spans must not be echoed back')
  }
})

test('full retention is 100 and total loss is 0, with no rounding surprises', () => {
  const three = ['0', '1', '2'].map((n) => ({ evidenceId: `e${n}`, sourceId: `doc-${n}`, text: `Release may proceed after the security owner attaches evidence number ${n}.` }))
  const all = buildDeepContextEvaluation(parseDeepContextRequest(deepRequest({
    documents: documentsFor(3), tokenBudget: 512, requiredEvidence: three,
  })))
  assert.equal(all.metrics.retainedEvidenceCount, 3)
  assert.equal(all.metrics.requiredEvidenceRetentionPercent, 100)

  // One of three retained must be 33.3, not 33.33333333333333.
  assert.equal(Number(((1 / 3) * 100).toFixed(1)), 33.3)
})

test('the response describes the metric as span retention and never as accuracy', () => {
  const result = buildDeepContextEvaluation(parseDeepContextRequest(deepRequest()))
  assert.equal(result.retentionBoundaries.evidenceRetentionMeasurement, 'exact_span_match')
  assert.equal(result.retentionBoundaries.factualAccuracyAssessed, false)
  assert.equal(result.retentionBoundaries.answerQualityAssessed, false)
  assert.equal(result.retentionBoundaries.claimVerificationPerformed, false)
  assert.ok(result.warningCodes.includes('exact_span_retention_not_accuracy'))

  // Zero-retention flags travel with every response, not only the docs.
  assert.equal(result.sourceTextStored, false)
  assert.equal(result.compiledContextStored, false)
  assert.equal(result.requiredEvidenceTextStored, false)
})

// --- 14 to 16. MPS: no credits, no double charge, no source text ------------

const mpsRouteSource = readFileSync(join(ROOT, 'app', 'api', 'v1', 'mps', 'audit', 'route.ts'), 'utf8')
const mpsResumeSource = readFileSync(join(ROOT, 'app', 'api', 'v1', 'mps', 'audit', '[auditId]', 'route.ts'), 'utf8')
const mpsMigration = readFileSync(join(ROOT, 'supabase', 'migrations', '20260810000400_x402_mps_audit_jobs.sql'), 'utf8')

test('the x402 audit route consumes no prepaid credit and requires no credential', () => {
  // A source-level assertion, because the failure it guards is an *absence*
  // that no behavioural test would notice: if this route ever grew a credit
  // consumption, x402 buyers would silently drain a prepaid customer's balance
  // and the audits would still succeed.
  for (const forbidden of ['consume_mps_audit_credit', 'refund_mps_audit_credit', 'MPS_AUDIT_CREDIT_UNIT', 'billingDecision']) {
    assert.equal(mpsRouteSource.includes(forbidden), false, `the x402 route must not reference ${forbidden}`)
    assert.equal(mpsResumeSource.includes(forbidden), false, `the resume route must not reference ${forbidden}`)
  }
  for (const forbidden of ['authorizeClientCapability', 'bearerToken(', 'MPS_AUDIT_CAPABILITY']) {
    assert.equal(mpsRouteSource.includes(forbidden), false, `the x402 route must not require ${forbidden}`)
  }
  // And it writes to its own table, not the prepaid one.
  assert.ok(mpsRouteSource.includes("from('x402_mps_audits')"))
  assert.equal(mpsRouteSource.includes('agent_mps_audits'), false)
})

test('the credentialed MPS route is untouched', () => {
  const credentialed = readFileSync(join(ROOT, 'app', 'api', 'mps-audits', 'route.ts'), 'utf8')
  // It still authorizes, still bills prepaid credits, and still uses its own
  // table. Adding an autonomous path must not have relaxed the paid one.
  assert.ok(credentialed.includes('authorizeClientCapability'))
  assert.ok(credentialed.includes('consume_mps_audit_credit'))
  assert.ok(credentialed.includes("from('agent_mps_audits')"))
  assert.equal(credentialed.includes('x402_mps_audits'), false)
})

test('the whole passage is never written to the audit ledger', () => {
  // The columns are enumerated in the migration; none of them holds the
  // passage. The route inserts input_hash and never the text it hashed.
  assert.ok(mpsMigration.includes('input_hash text not null'))
  for (const forbidden of ['passage text', 'source_text', 'submitted_text', 'text text not null']) {
    assert.equal(mpsMigration.includes(forbidden), false, `the ledger must not define ${forbidden}`)
  }
  assert.ok(mpsRouteSource.includes('input_hash: input.inputHash'))
  assert.equal(/insert\(\{[\s\S]*?passage/.test(mpsRouteSource.slice(mpsRouteSource.indexOf('insert({'), mpsRouteSource.indexOf('insert({') + 600)), false, 'the insert must not carry the passage')

  // And the offer's published retention promise says the same thing.
  const retention = auditJobResponse({
    public_id: 'audit_' + 'a'.repeat(32), client_request_id: 'req_abc12345', input_hash: `sha256:${'b'.repeat(64)}`,
    status: 'completed', result: null, failure_code: null, attempt_count: 1,
  })
  assert.equal(retention.fullPassageStored, false)
  assert.equal(retention.verbatimExcerptsRetained, true)
  assert.deepEqual(retention.retentionBoundaries, {
    fullPassageStored: false, verbatimExcerptsRetained: true,
    claimVerificationPerformed: false, legalAdviceProvided: false, humanReviewPerformed: false,
  })
  assert.match(String(retention.retentionNote), /complete submitted passage is not retained/i)
})

test('a failed audit is resumable and says so, rather than inviting a second purchase', () => {
  const failed = auditJobResponse({
    public_id: 'audit_' + 'c'.repeat(32), client_request_id: 'req_abc12345', input_hash: `sha256:${'d'.repeat(64)}`,
    status: 'failed', result: null, failure_code: 'model_unavailable', attempt_count: 1,
  })
  const error = failed.error as { resumable: boolean; message: string; maxAttempts: number }
  assert.equal(error.resumable, true)
  assert.match(error.message, /will not be charged again/i)
  assert.equal(error.maxAttempts, MAX_AUDIT_ATTEMPTS)

  // Exhausted is a different, honest answer: still no second charge, but no
  // more free model calls either.
  const exhausted = auditJobResponse({
    public_id: 'audit_' + 'e'.repeat(32), client_request_id: 'req_abc12345', input_hash: `sha256:${'f'.repeat(64)}`,
    status: 'failed', result: null, failure_code: 'model_unavailable', attempt_count: MAX_AUDIT_ATTEMPTS,
  })
  assert.equal((exhausted.error as { resumable: boolean }).resumable, false)
})

test('one payment cannot fund unlimited model attempts', () => {
  // Enforced as a conditional UPDATE, not a read-then-write: two concurrent
  // resumes would otherwise both read attempt_count and both proceed.
  assert.match(mpsMigration, /update public\.x402_mps_audits\s+set attempt_count = attempt_count \+ 1/)
  assert.match(mpsMigration, /and attempt_count < least\(p_max_attempts, 3\)/)
  assert.match(mpsMigration, /attempt_count integer not null default 0 check \(attempt_count between 0 and 3\)/)
})

test('one settled payment can only ever create one job', () => {
  assert.match(mpsMigration, /payment_transaction text not null unique/)
  // And a payer replaying its own request id gets the job it already bought.
  assert.match(mpsMigration, /create unique index if not exists x402_mps_audits_payer_request_idx[\s\S]*?\(payer, client_request_id\)/)
  assert.ok(mpsRouteSource.includes('idempotentReplay: true'))
})

test('an audit id alone is not a capability', () => {
  const token = createRetrievalToken()
  assert.ok(validRetrievalToken(token))
  // 32 bytes of CSPRNG output, base64url.
  assert.equal(token.length, 'mpsrt_'.length + 43)

  const hash = retrievalTokenHash(token)
  assert.match(hash, /^sha256:[a-f0-9]{64}$/)
  assert.notEqual(hash, token)
  assert.ok(retrievalTokenMatches(token, hash))
  assert.equal(retrievalTokenMatches(createRetrievalToken(), hash), false)
  assert.equal(retrievalTokenMatches('mpsrt_short', hash), false)
  assert.equal(retrievalTokenMatches('', hash), false)

  // Only the digest is stored, so reading the table does not yield the ability
  // to fetch results.
  assert.match(mpsMigration, /retrieval_token_hash text not null unique/)
  assert.ok(mpsRouteSource.includes('retrieval_token_hash: retrievalTokenHash(retrievalToken)'))
  assert.equal(mpsRouteSource.includes('retrieval_token:'), false)

  // Retrieval and resume answer 404 identically, so the id space is not an
  // oracle for which audits exist.
  assert.equal((mpsResumeSource.match(/No audit matches that id and retrieval token/g) ?? []).length, 1)
})

test('a retrieval response does not re-emit the credential', () => {
  const withToken = auditJobResponse(
    { public_id: 'audit_' + '1'.repeat(32), client_request_id: 'req_abc12345', input_hash: `sha256:${'2'.repeat(64)}`, status: 'completed', result: null, failure_code: null, attempt_count: 1 },
    { retrievalToken: 'mpsrt_abc' },
  )
  assert.equal(withToken.retrievalToken, 'mpsrt_abc')

  const later = auditJobResponse(
    { public_id: 'audit_' + '1'.repeat(32), client_request_id: 'req_abc12345', input_hash: `sha256:${'2'.repeat(64)}`, status: 'completed', result: null, failure_code: null, attempt_count: 1 },
  )
  assert.equal('retrievalToken' in later, false, 'a bearer credential must not be re-emitted on every poll')
  assert.equal(auditRetrievalPath('audit_x'), '/api/v1/mps/audit/audit_x')
})

test('a job is only treated as abandoned after the model deadline', () => {
  const base = { status: 'processing' as const }
  assert.equal(isStaleProcessing({ ...base, created_at: new Date().toISOString() }), false)
  assert.equal(isStaleProcessing({ ...base, created_at: new Date(Date.now() - 5_000).toISOString() }), false)
  assert.equal(isStaleProcessing({ ...base, created_at: new Date(Date.now() - 600_000).toISOString() }), true)
  // A finished job is never stale, whatever its age.
  assert.equal(isStaleProcessing({ status: 'completed', created_at: new Date(0).toISOString() }), false)
})

test('the job row is committed before the model boundary is crossed', () => {
  // The invariant that keeps a settled payment from vanishing into a 502.
  const insertAt = mpsRouteSource.indexOf("from('x402_mps_audits').insert(")
  const modelAt = mpsRouteSource.indexOf('new Anthropic(')
  assert.ok(insertAt > 0 && modelAt > 0)
  assert.ok(insertAt < modelAt, 'the audit job must be persisted before Anthropic is called')

  // And the 502 hands back everything needed to recover.
  assert.match(mpsRouteSource, /auditId,\s*\n\s*retrievalToken,\s*\n\s*retrievalPath/)
})

// --- 17. Telemetry is not double-counted -------------------------------------

test('only a challenge is metered at the proxy, and only once', () => {
  // The proxy writes 'challenge' and nothing else; the routes write
  // 'invocation' and nothing else. A paid request reaches a route, so metering
  // it here as well would double-count every settlement -- and a refusal
  // follows a presented payment, so counting it in a pre-payment denominator
  // would understate conversion by exactly the number of later failures.
  assert.equal(offerChallengeFor('POST', '/api/v1/compress', 'challenge')?.id, 'context-compression')
  assert.equal(offerChallengeFor('POST', '/api/v1/compress', 'paid'), undefined)
  assert.equal(offerChallengeFor('POST', '/api/v1/compress', 'refused'), undefined)
  assert.equal(offerChallengeFor('POST', '/api/v1/compress', 'not_applicable'), undefined)

  // An unpriced path is not an offer, so it cannot be metered as one.
  assert.equal(offerChallengeFor('POST', '/api/v1/jobs/tensor-network', 'challenge'), undefined)
  assert.equal(offerChallengeFor('GET', '/api/v1/compress', 'challenge'), undefined)
})

test('one metered event writes exactly one row', async () => {
  const calls: Record<string, unknown>[] = []
  const meter = { rpc: async (_name: string, args: Record<string, unknown>) => { calls.push(args); return { error: null } } }
  await recordOfferUsage({ offerId: 'deep-context-evaluation', eventKind: 'invocation', status: 201, ledger: meter, requiredEvidenceCount: 3, retainedEvidenceCount: 2 })
  assert.equal(calls.length, 1)
  assert.equal(calls[0]!.p_offer_id, 'deep-context-evaluation')
  assert.equal(calls[0]!.p_event_kind, 'invocation')
  assert.equal(calls[0]!.p_status_class, '2xx')
  assert.equal(calls[0]!.p_required_evidence, 3)
  assert.equal(calls[0]!.p_retained_evidence, 2)
})

test('a broken meter never surfaces to a paying caller', async () => {
  const exploding = { rpc: async () => { throw new Error('meter down') } }
  await recordOfferUsage({ offerId: 'context-compression', eventKind: 'invocation', status: 201, ledger: exploding })
  await recordOfferUsage({ offerId: 'context-compression', eventKind: 'invocation', status: 201, ledger: null })
})

test('discovery source is a coarse allowlisted category, never the evidence', async () => {
  assert.equal(discoverySourceFrom(new Headers({ 'user-agent': 'maha-canary/1.0' })), 'maha_canary')
  assert.equal(discoverySourceFrom(new Headers({ 'user-agent': 'x402-bazaar-indexer' })), 'bazaar')
  assert.equal(discoverySourceFrom(new Headers({ referer: 'https://bazaar.x402.org/listing/1' })), 'bazaar')
  assert.equal(discoverySourceFrom(new Headers({ referer: 'https://www.mahastrategies.com/context-compiler' })), 'direct')
  // Anything else is honestly unknown rather than guessed at.
  assert.equal(discoverySourceFrom(new Headers({ 'user-agent': 'curl/8.4.0' })), 'unknown')
  assert.equal(discoverySourceFrom(new Headers({ referer: 'not a url' })), 'unknown')
  assert.equal(discoverySourceFrom(new Headers()), 'unknown')

  // A caller cannot inject its own category.
  const calls: Record<string, unknown>[] = []
  const meter = { rpc: async (_n: string, args: Record<string, unknown>) => { calls.push(args); return { error: null } } }
  await recordOfferUsage({ offerId: 'context-compression', eventKind: 'challenge', status: 402, discoverySource: 'ignore-me' as never, ledger: meter })
  assert.equal(calls[0]!.p_discovery_source, 'unknown')
})

test('the telemetry table retains no payload, user agent, referrer or address', () => {
  const migration = readFileSync(join(ROOT, 'supabase', 'migrations', '20260810000300_x402_offer_telemetry.sql'), 'utf8')
  // Matched as column definitions rather than as words, so the prose that
  // explains *why* these are absent does not fail the check that they are.
  const columns = migration.slice(migration.indexOf('create table'), migration.indexOf('primary key'))
  for (const forbidden of ['user_agent', 'ip_address', 'referrer', 'referer', 'payload', 'payer', 'transaction']) {
    assert.equal(new RegExp(`\\n\\s*${forbidden}\\s+(text|inet|jsonb|numeric)`).test(columns), false,
      `the telemetry table must not define a ${forbidden} column`)
  }
  // The category column is an allowlist in the schema, not merely in the code.
  assert.match(migration, /discovery_source text not null default 'unknown'\s*\n\s*check \(discovery_source in \('bazaar', 'maha_canary', 'direct', 'unknown'\)\)/)
})

test('repeat buyers are counted from confirmed settlements only', async () => {
  const rows = [
    { payer: '0xA', resource: '/api/v1/compress', confirmed_payment_count: 5, unconfirmed_payment_count: 0, failed_payment_count: 0, first_confirmed_at: 'a', last_confirmed_at: 'b' },
    { payer: '0xA', resource: '/api/v1/mps/audit', confirmed_payment_count: 1, unconfirmed_payment_count: 0, failed_payment_count: 0, first_confirmed_at: 'a', last_confirmed_at: 'b' },
    { payer: '0xB', resource: '/api/v1/compress', confirmed_payment_count: 1, unconfirmed_payment_count: 0, failed_payment_count: 0, first_confirmed_at: 'a', last_confirmed_at: 'b' },
  ]
  const report = await repeatPayers({ fromDay: '2026-08-01', toDay: '2026-08-10' }, { rpc: async () => ({ data: rows, error: null }) })

  // Two wallets, seven settlements. Reporting the wallet count as the
  // transaction count would flatter one busy buyer into looking like a market.
  assert.equal(report!.distinctPayers, 2)
  assert.equal(report!.settlements, 7)
  assert.notEqual(report!.settlements, report!.distinctPayers)
  // Only 0xA came back for the same resource.
  assert.equal(report!.returningPayers, 1)
})

test('failed and unconfirmed attempts are never counted as purchases', async () => {
  // The bug this replaced counted every row in x402_payments -- which is the
  // replay guard, written before settlement returns -- so a claim that failed
  // to settle, or that the chain contradicted, counted as revenue. The error
  // ran in the flattering direction, which is the kind that survives review.
  const rows = [
    // A wallet that only ever failed is not a buyer.
    { payer: '0xGhost', resource: '/api/v1/compress', confirmed_payment_count: 0, unconfirmed_payment_count: 0, failed_payment_count: 4, first_confirmed_at: null, last_confirmed_at: null },
    // Settled but the chain could not corroborate it: reported, not counted.
    { payer: '0xMaybe', resource: '/api/v1/compress', confirmed_payment_count: 0, unconfirmed_payment_count: 3, failed_payment_count: 0, first_confirmed_at: null, last_confirmed_at: null },
    // A real buyer, with some noise of its own.
    { payer: '0xReal', resource: '/api/v1/compress', confirmed_payment_count: 2, unconfirmed_payment_count: 1, failed_payment_count: 1, first_confirmed_at: 'a', last_confirmed_at: 'b' },
  ]
  const report = await repeatPayers({ fromDay: '2026-08-01', toDay: '2026-08-10' }, { rpc: async () => ({ data: rows, error: null }) })

  assert.equal(report!.settlements, 2, 'only confirmed settlements are purchases')
  assert.equal(report!.distinctPayers, 1, 'a wallet with no confirmed purchase is not a buyer')
  assert.equal(report!.returningPayers, 1)

  // Surfaced rather than hidden: a deployment with no chain RPC would
  // otherwise report a confident zero and look like it had no customers.
  assert.equal(report!.unconfirmed, 4)
  assert.equal(report!.failed, 5)
})

test('the repeat-buyer query joins the authoritative settlement table', () => {
  const migration = readFileSync(join(ROOT, 'supabase', 'migrations', '20260810000600_x402_repeat_payers_confirmed_only.sql'), 'utf8')
  assert.ok(migration.includes('from public.x402_payments p'))
  // The correction: purchases come from settlements, not claims.
  assert.ok(migration.includes('left join public.x402_settlements s on s.payment_id = p.payment_id'))
  assert.ok(!migration.includes('p.transaction_id'), 'the claim ledger is keyed by payment_id, not transaction_id')
  assert.ok(migration.includes("count(*) filter (where s.chain_status = 'confirmed') as confirmed_payment_count"))
  // agent_task_spend_daily is keyed by tenant and task, neither of which an
  // anonymous wallet has, so joining through it returns a confident zero. It
  // is named in the comment as the trap to avoid; it must not appear in a FROM
  // or JOIN clause.
  assert.equal(/(from|join)\s+\S*agent_task_spend_daily/i.test(migration), false)
})
