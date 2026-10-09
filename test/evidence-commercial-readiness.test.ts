import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

import { EVIDENCE_COMMERCIAL_OFFERS } from '../lib/evidence-commercial-offers.ts'
import { provenanceDigest } from '../lib/evidence-dossier/digest.ts'
import {
  parseCheckoutAttribution,
  recordCheckoutAttribution,
  recordVerifiedCheckoutConversion,
} from '../lib/conversion-measurement-server.ts'
import {
  applyMpsPreflightLifecycleEvent,
  createMpsPreflightLifecycle,
  mpsPreflightAcknowledgementSha256,
  mpsPreflightReportSha256,
  syntheticLifecycleEvent,
  verifyMpsPreflightLifecycle,
  type MpsPreflightLifecycle,
  type MpsPreflightLifecycleEventType,
} from '../lib/mps-preflight-lifecycle.ts'

const ORDER_ID = 'preflight_11111111111111111111111111111111'
const ORDER_SHA256 = provenanceDigest({ orderId: ORDER_ID })
const TIMES = ['2026-09-04T10:00:00Z', '2026-09-04T10:01:00Z', '2026-09-04T10:02:00Z', '2026-09-04T10:03:00Z', '2026-09-04T10:04:00Z', '2026-09-04T10:05:00Z']

function event(index: number, type: MpsPreflightLifecycleEventType, payload: unknown = { index }) {
  return syntheticLifecycleEvent(`mps_event_case_${String(index).padStart(4, '0')}`, type, TIMES[index - 1], payload)
}

function apply(lifecycle: MpsPreflightLifecycle, next: ReturnType<typeof event>) {
  return applyMpsPreflightLifecycleEvent(lifecycle, next).lifecycle
}

function paid(): MpsPreflightLifecycle {
  let lifecycle = createMpsPreflightLifecycle(ORDER_SHA256, true)
  lifecycle = apply(lifecycle, event(1, 'checkout_created', { amountCents: 4900, currency: 'usd' }))
  return apply(lifecycle, event(2, 'payment_confirmed', { stripeEventSha256: provenanceDigest({ event: 2 }) }))
}

test('the three evidence products are distinct in name, price, scope, state, and assurance', () => {
  const offers = Object.values(EVIDENCE_COMMERCIAL_OFFERS)
  assert.deepEqual(offers.map((offer) => offer.priceUsd), [0, 49, 250])
  assert.equal(new Set(offers.map((offer) => offer.name)).size, 3)
  assert.equal(new Set(offers.map((offer) => offer.path)).size, 3)
  assert.equal(EVIDENCE_COMMERCIAL_OFFERS.evidencePreflight.state, 'available-free')
  assert.equal(EVIDENCE_COMMERCIAL_OFFERS.mpsDocumentPreflight.state, 'self-service-checkout')
  assert.equal(EVIDENCE_COMMERCIAL_OFFERS.verifiedEvidenceDossier.state, 'qualification-first-purchase-disabled')
  assert.match(EVIDENCE_COMMERCIAL_OFFERS.evidencePreflight.evidenceBoundary, /No source is fetched/)
  assert.match(EVIDENCE_COMMERCIAL_OFFERS.mpsDocumentPreflight.evidenceBoundary, /not primary-source verification/)
  assert.match(EVIDENCE_COMMERCIAL_OFFERS.verifiedEvidenceDossier.evidenceBoundary, /not certification of universal truth/)
})

test('the synthetic checkout-to-acknowledgement lifecycle is ordered and digest-bound', () => {
  let lifecycle = paid()
  lifecycle = apply(lifecycle, event(3, 'submission_accepted', { inputSha256: provenanceDigest({ input: 'fixture' }), contentRetained: false }))
  lifecycle = apply(lifecycle, event(4, 'processing_started'))
  lifecycle = apply(lifecycle, event(5, 'private_delivery_ready', { reportSha256: provenanceDigest({ report: 'fixture' }) }))
  lifecycle = apply(lifecycle, event(6, 'acknowledgement_recorded', { received: true }))
  assert.equal(lifecycle.state, 'acknowledged')
  assert.deepEqual(lifecycle.events.map((entry) => entry.type), [
    'checkout_created', 'payment_confirmed', 'submission_accepted', 'processing_started', 'private_delivery_ready', 'acknowledgement_recorded',
  ])
  assert.deepEqual(verifyMpsPreflightLifecycle(lifecycle), [])

  const reorderedBody = { ...lifecycle, events: [lifecycle.events[1], lifecycle.events[0], ...lifecycle.events.slice(2)] }
  const reordered = { ...reorderedBody, lifecycleSha256: provenanceDigest({
    schemaVersion: reorderedBody.schemaVersion,
    synthetic: reorderedBody.synthetic,
    orderSha256: reorderedBody.orderSha256,
    state: reorderedBody.state,
    events: reorderedBody.events,
  }) }
  assert.equal(verifyMpsPreflightLifecycle(reordered).some((finding) => finding.startsWith('event-transition-invalid:')), true)

  const wrongStateBody = { ...lifecycle, state: 'delivered' as const }
  const wrongState = { ...wrongStateBody, lifecycleSha256: provenanceDigest({
    schemaVersion: wrongStateBody.schemaVersion,
    synthetic: wrongStateBody.synthetic,
    orderSha256: wrongStateBody.orderSha256,
    state: wrongStateBody.state,
    events: wrongStateBody.events,
  }) }
  assert.equal(verifyMpsPreflightLifecycle(wrongState).includes('state-mismatch'), true)
})

test('duplicate webhooks and replayed submissions are idempotent but substitutions conflict', () => {
  const payment = event(2, 'payment_confirmed', { stripeEventSha256: provenanceDigest({ event: 2 }) })
  let awaiting = createMpsPreflightLifecycle(ORDER_SHA256, true)
  awaiting = apply(awaiting, event(1, 'checkout_created', { amountCents: 4900, currency: 'usd' }))
  const paidResult = applyMpsPreflightLifecycleEvent(awaiting, payment)
  assert.equal(applyMpsPreflightLifecycleEvent(paidResult.lifecycle, payment).operation, 'idempotent')
  assert.throws(() => applyMpsPreflightLifecycleEvent(paidResult.lifecycle, { ...payment, payloadSha256: provenanceDigest({ substituted: true }) }), /conflicts/)

  const submission = event(3, 'submission_accepted', { inputSha256: provenanceDigest({ input: 1 }), contentRetained: false })
  const submitted = applyMpsPreflightLifecycleEvent(paidResult.lifecycle, submission)
  assert.equal(applyMpsPreflightLifecycleEvent(submitted.lifecycle, submission).operation, 'idempotent')
  assert.throws(() => applyMpsPreflightLifecycleEvent(submitted.lifecycle, { ...submission, payloadSha256: provenanceDigest({ input: 2 }) }), /conflicts/)
})

test('processing and delivery failures remain distinct and both allow a replay-safe refund', () => {
  let processing = paid()
  processing = apply(processing, event(3, 'submission_accepted'))
  processing = apply(processing, event(4, 'processing_started'))

  const processingFailed = apply(processing, event(5, 'processing_failed', { code: 'dependency-unavailable' }))
  assert.equal(processingFailed.state, 'processing_failed')
  const refundedProcessing = apply(processingFailed, event(6, 'refund_recorded', { amountCents: 4900, currency: 'usd' }))
  assert.equal(refundedProcessing.state, 'refunded')

  const deliveryFailed = apply(processing, event(5, 'delivery_failed', { code: 'private-report-unavailable' }))
  assert.equal(deliveryFailed.state, 'delivery_failed')
  const refund = event(6, 'refund_recorded', { amountCents: 4900, currency: 'usd' })
  const refundedDelivery = applyMpsPreflightLifecycleEvent(deliveryFailed, refund)
  assert.equal(refundedDelivery.lifecycle.state, 'refunded')
  assert.equal(applyMpsPreflightLifecycleEvent(refundedDelivery.lifecycle, refund).operation, 'idempotent')
})

test('acknowledgement binds the exact private report and rejects substituted targets', () => {
  const report = { mps_version: '0.1', input_hash: provenanceDigest({ input: 1 }), claims: [] }
  const reportSha256 = mpsPreflightReportSha256(report)
  const acknowledgementSha256 = mpsPreflightAcknowledgementSha256(ORDER_ID, reportSha256)
  assert.match(reportSha256, /^sha256:[a-f0-9]{64}$/)
  assert.match(acknowledgementSha256, /^sha256:[a-f0-9]{64}$/)
  assert.notEqual(acknowledgementSha256, mpsPreflightAcknowledgementSha256(ORDER_ID, mpsPreflightReportSha256({ ...report, claims: [{ substituted: true }] })))
})

test('the committed synthetic lifecycle proves the full flow without customer content or payment', async () => {
  const artifact = JSON.parse(await readFile(new URL('../content/commercial/evidence-commercial-lifecycle-fixture.json', import.meta.url), 'utf8'))
  const { artifactSha256, ...body } = artifact
  assert.equal(artifactSha256, provenanceDigest(body))
  assert.equal(artifact.lifecycle.state, 'acknowledged')
  assert.equal(artifact.proofs.duplicateWebhook, 'idempotent')
  assert.equal(artifact.proofs.replayedSubmission, 'idempotent')
  assert.deepEqual(artifact.proofs.refundFinalStates, ['refunded', 'refunded'])
  assert.equal(artifact.paymentCollected, false)
  assert.equal(artifact.customerDataUsed, false)
  const serialized = JSON.stringify(artifact)
  assert.doesNotMatch(serialized, /@[A-Za-z0-9.-]+|sk_(?:test|live)_|whsec_|customer_email|claimText|documentText/)
})

test('the migration adds exact-report acknowledgement and privacy-safe preflight attribution', async () => {
  const sql = await readFile(new URL('../supabase/migrations/20260904090000_mps_preflight_commercial_readiness.sql', import.meta.url), 'utf8')
  assert.match(sql, /report_sha256 text/)
  assert.match(sql, /acknowledgement_sha256 text/)
  assert.match(sql, /record_mps_preflight_acknowledgement/)
  assert.match(sql, /create or replace function public\.record_verified_checkout_conversion/)
  assert.match(sql, /return 'duplicate'/)
  assert.match(sql, /return 'target_mismatch'/)
  assert.match(sql, /\^preflight_\[a-f0-9\]\{32\}\$/)
  assert.equal((sql.match(/p_checkout_reference ~ '\^preflight_/g) ?? []).length, 2)
  assert.match(sql, /revoke all .* from public, anon, authenticated/)
  assert.doesNotMatch(sql, /document_text|claim_text|excerpt|customer_email/)
})

test('checkout and webhook record only bounded attribution and Stripe-verified conversion signals', async () => {
  const [checkout, webhook, component] = await Promise.all([
    readFile(new URL('../app/api/mps-preflight/checkout/route.ts', import.meta.url), 'utf8'),
    readFile(new URL('../app/api/mps-preflight/webhook/route.ts', import.meta.url), 'utf8'),
    readFile(new URL('../app/mps/preflight/PreflightCheckout.tsx', import.meta.url), 'utf8'),
  ])
  assert.match(checkout, /recordCheckoutAttribution/)
  assert.match(checkout, /offerId: 'mps-preflight'/)
  assert.match(webhook, /recordVerifiedCheckoutConversion/)
  assert.match(component, /browserConversionContext/)
  assert.match(component, /credentials: 'omit'/)
  assert.doesNotMatch(checkout, /claim|excerpt|documentText/)
})

test('conversion telemetry drops customer and submitted-content fields before persistence', async () => {
  const parsed = parseCheckoutAttribution({
    experimentId: null,
    sourcePath: '/mps/preflight',
    email: 'synthetic@example.invalid',
    documentLabel: 'private-draft',
    text: 'must never enter telemetry',
  })
  assert.deepEqual(parsed, { experimentId: null, sourcePath: '/mps/preflight' })
  assert.throws(() => parseCheckoutAttribution({ sourcePath: '/mps/preflight?claim=secret' }), /sourcePath is invalid/)

  const calls: Array<{ name: string; args: Record<string, unknown> }> = []
  const ledger = {
    rpc(name: string, args: Record<string, unknown>) {
      calls.push({ name, args })
      return Promise.resolve({ error: null })
    },
  }
  const common = {
    checkoutReference: ORDER_ID,
    offerId: 'mps-preflight',
    occurredAt: '2026-09-04T10:00:00Z',
  }
  await recordCheckoutAttribution(ledger, { ...common, ...parsed })
  await recordVerifiedCheckoutConversion(ledger, common)
  assert.deepEqual(calls.map((call) => call.name), [
    'record_checkout_conversion_attribution',
    'record_verified_checkout_conversion',
  ])
  const persisted = JSON.stringify(calls)
  assert.doesNotMatch(persisted, /synthetic@example|private-draft|must never enter|claim|excerpt|document/i)
})

test('public copy states scope, turnaround, privacy, refund, and purchase boundaries without conflating products', async () => {
  const [freePage, freeForm, paidPage, dossierPage] = await Promise.all([
    readFile(new URL('../app/tools/evidence-preflight/page.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../app/tools/evidence-preflight/EvidencePreflightForm.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../app/mps/preflight/page.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../app/evidence-audit/page.tsx', import.meta.url), 'utf8'),
  ])
  for (const text of [freePage, freeForm, paidPage, dossierPage]) assert.match(text, /Evidence (?:Preflight|Dossier)|MPS Document Preflight/)
  assert.match(freePage, /purchase disabled/)
  assert.match(freeForm, /Qualification first/)
  assert.match(paidPage, /Failure and refund/)
  assert.match(dossierPage, /no public checkout/i)
  assert.match(dossierPage, /Turnaround/)
  assert.match(dossierPage, /Privacy/)
})

test('the Stripe canary is test-only, expires the session, and emits fingerprints rather than provider identifiers', async () => {
  const script = await readFile(new URL('../scripts/run-mps-preflight-stripe-test-canary.ts', import.meta.url), 'utf8')
  assert.match(script, /startsWith\('sk_test_'\)/)
  assert.match(script, /stripe\.checkout\.sessions\.expire/)
  assert.match(script, /paymentCollected: false/)
  assert.match(script, /sessionFingerprint/)
  assert.match(script, /evidenceSha256: provenanceDigest\(evidence\)/)
  assert.match(script, /mps-preflight-stripe-test-canary\.json/)
  assert.doesNotMatch(script, /console\.log\(session\)|console\.log\(key\)/)

  const artifact = JSON.parse(await readFile(new URL('../content/commercial/mps-preflight-stripe-test-canary.json', import.meta.url), 'utf8'))
  const { evidenceSha256, ...body } = artifact
  assert.equal(evidenceSha256, provenanceDigest(body))
  assert.equal(artifact.provider, 'stripe-test-mode')
  assert.equal(artifact.livemode, false)
  assert.equal(artifact.amountCents, 4900)
  assert.equal(artifact.checkoutCreated, true)
  assert.equal(artifact.checkoutExpired, true)
  assert.equal(artifact.paymentCollected, false)
  assert.equal(artifact.customerDataUsed, false)
  assert.match(artifact.sessionFingerprint, /^sha256:[a-f0-9]{64}$/)
  assert.match(artifact.orderFingerprint, /^sha256:[a-f0-9]{64}$/)
  assert.doesNotMatch(JSON.stringify(artifact), /sk_(?:test|live)_|cs_(?:test|live)_|cus_|@|customer_email/)
})
