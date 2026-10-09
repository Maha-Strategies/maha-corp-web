import { writeFile } from 'node:fs/promises'

import { provenanceDigest } from '../lib/evidence-dossier/digest.ts'
import {
  applyMpsPreflightLifecycleEvent,
  createMpsPreflightLifecycle,
  syntheticLifecycleEvent,
  verifyMpsPreflightLifecycle,
  type MpsPreflightLifecycle,
  type MpsPreflightLifecycleEventType,
} from '../lib/mps-preflight-lifecycle.ts'

const OUTPUT = new URL('../content/commercial/evidence-commercial-lifecycle-fixture.json', import.meta.url)
const ORDER_SHA256 = provenanceDigest({ fixture: 'mps-document-preflight', order: 1 })

const sequence: Array<[string, MpsPreflightLifecycleEventType, string, unknown]> = [
  ['mps_event_checkout_0001', 'checkout_created', '2026-09-04T10:00:00Z', { amountCents: 4900, currency: 'usd', mode: 'stripe-test' }],
  ['mps_event_payment_0002', 'payment_confirmed', '2026-09-04T10:01:00Z', { providerEventSha256: provenanceDigest({ event: 'synthetic-paid' }) }],
  ['mps_event_submission_0003', 'submission_accepted', '2026-09-04T10:02:00Z', { inputSha256: provenanceDigest({ input: 'synthetic-non-customer-fixture' }), contentRetained: false }],
  ['mps_event_processing_0004', 'processing_started', '2026-09-04T10:03:00Z', { attempt: 1 }],
  ['mps_event_delivery_0005', 'private_delivery_ready', '2026-09-04T10:04:00Z', { reportSha256: provenanceDigest({ report: 'synthetic-private-report' }) }],
  ['mps_event_ack_0006', 'acknowledgement_recorded', '2026-09-04T10:05:00Z', { received: true }],
]

function run(events: typeof sequence): MpsPreflightLifecycle {
  let lifecycle = createMpsPreflightLifecycle(ORDER_SHA256, true)
  for (const [eventId, type, occurredAt, payload] of events) {
    lifecycle = applyMpsPreflightLifecycleEvent(lifecycle, syntheticLifecycleEvent(eventId, type, occurredAt, payload)).lifecycle
  }
  return lifecycle
}

const happy = run(sequence)
const duplicatePayment = applyMpsPreflightLifecycleEvent(
  run(sequence.slice(0, 2)),
  syntheticLifecycleEvent(...sequence[1]),
)
const replayedSubmission = applyMpsPreflightLifecycleEvent(
  run(sequence.slice(0, 3)),
  syntheticLifecycleEvent(...sequence[2]),
)
const processingFailure = run([
  ...sequence.slice(0, 4),
  ['mps_event_failure_0005', 'processing_failed', '2026-09-04T10:04:00Z', { code: 'synthetic-processing-failure' }],
  ['mps_event_refund_0006', 'refund_recorded', '2026-09-04T10:05:00Z', { amountCents: 4900, currency: 'usd' }],
])
const deliveryFailure = run([
  ...sequence.slice(0, 4),
  ['mps_event_delivery_failure_0005', 'delivery_failed', '2026-09-04T10:04:00Z', { code: 'synthetic-delivery-failure' }],
  ['mps_event_refund_0006', 'refund_recorded', '2026-09-04T10:05:00Z', { amountCents: 4900, currency: 'usd' }],
])

const body = {
  schemaVersion: 'maha-evidence-commercial-readiness-fixture/1.0',
  synthetic: true,
  customerDataUsed: false,
  paymentCollected: false,
  lifecycle: happy,
  proofs: {
    orderedStates: ['awaiting_payment', 'paid', 'submission_accepted', 'processing', 'delivered', 'acknowledged'],
    duplicateWebhook: duplicatePayment.operation,
    replayedSubmission: replayedSubmission.operation,
    processingFailureFinalState: processingFailure.state,
    deliveryFailureFinalState: deliveryFailure.state,
    refundFinalStates: [processingFailure.state, deliveryFailure.state],
    happyLifecycleFindings: verifyMpsPreflightLifecycle(happy),
  },
  privacy: {
    containsClaimContent: false,
    containsDocumentContent: false,
    containsEmail: false,
    containsCredential: false,
    durableIdentifiers: ['orderSha256', 'payloadSha256', 'lifecycleSha256'],
  },
}
const artifact = { ...body, artifactSha256: provenanceDigest(body) }

await writeFile(OUTPUT, `${JSON.stringify(artifact, null, 2)}\n`)
console.log(JSON.stringify({ output: OUTPUT.pathname, state: happy.state, artifactSha256: artifact.artifactSha256 }))
