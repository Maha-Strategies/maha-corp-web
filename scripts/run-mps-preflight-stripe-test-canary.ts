import { createHash, randomUUID } from 'node:crypto'
import { writeFile } from 'node:fs/promises'
import Stripe from 'stripe'

import { provenanceDigest } from '../lib/evidence-dossier/digest.ts'

const key = process.env.STRIPE_SECRET_KEY
if (!key?.startsWith('sk_test_')) throw new Error('A Stripe test-mode secret key is required; live keys are refused.')

try {
  const stripe = new Stripe(key)
  const reference = `preflight_${randomUUID().replaceAll('-', '')}`
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    client_reference_id: reference,
    success_url: 'https://www.mahastrategies.com/mps/preflight/submit?synthetic=1',
    cancel_url: 'https://www.mahastrategies.com/mps/preflight?synthetic=cancelled',
    line_items: [{
      quantity: 1,
      price_data: {
        currency: 'usd',
        unit_amount: 4900,
        product_data: { name: 'MPS Document Preflight - synthetic checkout canary' },
      },
    }],
    metadata: {
      preflightOrderId: reference,
      syntheticCanary: 'true',
      customerDataUsed: 'false',
    },
  })

  if (session.livemode || session.amount_total !== 4900 || session.currency !== 'usd' || session.payment_status !== 'unpaid'
    || session.client_reference_id !== reference || session.metadata?.syntheticCanary !== 'true') {
    throw new Error('stripe-test-contract-mismatch')
  }
  const expired = await stripe.checkout.sessions.expire(session.id)
  if (expired.status !== 'expired' || expired.payment_status !== 'unpaid' || expired.livemode) {
    throw new Error('stripe-test-expiry-mismatch')
  }

  const fingerprint = (value: string) => `sha256:${createHash('sha256').update(value).digest('hex')}`
  const evidence = {
    schemaVersion: 'maha-mps-preflight-stripe-test-canary/1.0',
    observedAt: new Date().toISOString(),
    provider: 'stripe-test-mode',
    livemode: false,
    amountCents: 4900,
    currency: 'usd',
    checkoutCreated: true,
    checkoutExpired: true,
    paymentCollected: false,
    customerDataUsed: false,
    sessionFingerprint: fingerprint(session.id),
    orderFingerprint: fingerprint(reference),
  }
  const artifact = { ...evidence, evidenceSha256: provenanceDigest(evidence) }
  const serialized = JSON.stringify(artifact)
  if (/sk_(?:test|live)_|cs_(?:test|live)_|@/.test(serialized)) throw new Error('canary-evidence-sensitive')
  if (process.argv.includes('--write')) {
    const output = new URL('../content/commercial/mps-preflight-stripe-test-canary.json', import.meta.url)
    await writeFile(output, `${JSON.stringify(artifact, null, 2)}\n`)
  }
  console.log(JSON.stringify(artifact, null, 2))
} catch {
  console.error(JSON.stringify({
    schemaVersion: 'maha-mps-preflight-stripe-test-canary/1.0',
    status: 'blocked',
    reason: 'stripe-test-operation-failed',
    checkoutProven: false,
  }))
  process.exitCode = 1
}
