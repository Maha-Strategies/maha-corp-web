import assert from 'node:assert/strict'
import { SCIENCE_IDS, SCIENCE_SAMPLES } from '../lib/x402/science/contracts.ts'
import { MICRO_OFFERS } from '../lib/x402/micro-offers.ts'
import { createMicroPurchaseIdentity, microPurchaseHeaders } from '../lib/x402/micro-purchase.ts'
import { writeFileSync } from 'node:fs'
const args = process.argv.slice(2)
if (args.length > 1 || (args.length === 1 && args[0] !== '--write')) throw new Error('local optional --write only')
// Deliberately fixed localhost address. Start dev server with X402_ENABLED=false.
const origin = 'http://127.0.0.1:8791', observations = []
for (const id of SCIENCE_IDS) {
  const offer = MICRO_OFFERS.find(o => o.id === id)!, url = origin + offer.path
  const get = await fetch(url, { signal: AbortSignal.timeout(30000) }); assert.equal(get.status, 200, id)
  const body = await get.json(); assert.equal(body.offer.id, id); assert.equal(body.offer.amount, offer.amount)
  assert.equal(body.offer.availability.payableInProduction, true); assert.deepEqual(body.offer.discovery.output, offer.discovery.output)
  assert.deepEqual(body.offer.discovery.input, offer.discovery.input)
  const options = await fetch(url, { method: 'OPTIONS', signal: AbortSignal.timeout(10000) }); assert.equal(options.status, 204)
  const input = SCIENCE_SAMPLES[id]
  // Non-cryptographic dummy marker selects deterministic preflight. It cannot
  // authorize a transfer. The disabled gateway must refuse after calculation;
  // this also exercises the RDKit WASM loader inside the actual Next runtime.
  const post = await fetch(url, { method: 'POST', signal: AbortSignal.timeout(30000),
    headers: { 'Content-Type': 'application/json', 'PAYMENT-SIGNATURE': 'local-nonpayment-marker', ...microPurchaseHeaders(id, input, createMicroPurchaseIdentity()) }, body: JSON.stringify(input) })
  const declined = await post.json(); assert.equal(post.status, 503, `${id}: ${JSON.stringify(declined)}`)
  assert.equal(declined.error.code, 'offer_not_enabled', `${id}: calculation must finish before disabled-payment refusal`)
  observations.push({ id, get: get.status, options: options.status, postAfterLocalCalculation: post.status, paymentError: declined.error.code })
}
const report = { observedAt: new Date().toISOString(), origin, products: observations.length, observations, realPayments: 0, deploymentBuilds: 0, basis: 'local Next runtime with payments disabled; no live facilitator test or production deployment' }
if (args[0] === '--write') writeFileSync(new URL('../output/x402-science50-readiness-2026-10-11/local-http.json', import.meta.url), JSON.stringify(report, null, 2) + '\n')
console.log(JSON.stringify({ products: report.products, get200: observations.length, options204: observations.length, computedBeforePaymentDisabled503: observations.length, payments: 0 }))
