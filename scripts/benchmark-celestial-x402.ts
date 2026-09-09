import { performance } from 'node:perf_hooks'
import { CELESTIAL_OFFERS } from '../lib/x402/celestial-offers.ts'
import { buildCelestialProduct, verifyCelestialProduct, type CelestialProductId } from '../lib/x402/celestial-products.ts'

// Zero-cost, synthetic CPU baseline. Not a cloud invoice, load test or margin claim.
const measurements = CELESTIAL_OFFERS.map(offer => {
  const samples: number[] = []
  let responseBytes = 0
  for (let i = 0; i < 30; i++) {
    const start = performance.now()
    const output = buildCelestialProduct(offer.id as CelestialProductId, offer.discovery.input)
    samples.push(performance.now() - start)
    responseBytes = Buffer.byteLength(JSON.stringify(output))
    if (!verifyCelestialProduct(offer.id as CelestialProductId, offer.discovery.input, output)) throw new Error('synthetic_replay_failed')
  }
  samples.sort((a, b) => a - b)
  return { offerId: offer.id, samples: samples.length, p50ComputeMs: samples[14], p95ComputeMs: samples[28], maxComputeMs: samples[29], responseBytes }
})
console.log(JSON.stringify({ fixtureClass: 'synthetic', networkCalls: 0, payments: 0, llmCalls: 0,
  boundary: 'Warm local compute only. Excludes cold start, HTTP, payment, storage, network latency, failure recovery, provider fees and support. No margin or uptime established.', measurements }, null, 2))
