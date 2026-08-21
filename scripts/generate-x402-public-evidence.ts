/**
 * Generates the public x402 discovery manifest and the conformance result.
 *
 * Offline. Reads the offer catalog and the checked-in conformance dimensions;
 * contacts no endpoint, makes no payment, and needs no credential.
 */
import { readFileSync, writeFileSync } from 'node:fs'

import {
  X402_PUBLIC_MANIFEST_PATH,
  buildPublicManifest,
  findForbiddenInManifest,
} from '../lib/x402/public-manifest.ts'
import {
  X402_CONFORMANCE_RESULT_PATH,
  findForbiddenInConformance,
  parseConformanceResult,
  rollUp,
  type ConformanceDimension,
} from '../lib/x402/public-conformance.ts'

const DIMENSIONS_SOURCE = 'content/x402/conformance-dimensions.json'
// Fixed so the artifacts are reproducible; bumped when the evidence changes,
// not on every run. A timestamp that moves on each build is noise, and it
// makes "freshness" impossible to reason about.
const GENERATED_AT = '2026-08-21'

const manifest = buildPublicManifest(GENERATED_AT)
const forbiddenInManifest = findForbiddenInManifest(manifest)
if (forbiddenInManifest.length > 0) {
  throw new Error(`Refusing to write: manifest contains forbidden content: ${forbiddenInManifest.join(', ')}`)
}

const dimensions = JSON.parse(readFileSync(DIMENSIONS_SOURCE, 'utf8')) as {
  subject: { offerId: string; canonicalResource: string }
  dimensions: ConformanceDimension[]
  limitations: string[]
}

const conformance = {
  schemaVersion: '1.0.0' as const,
  generatedAt: GENERATED_AT,
  subject: dimensions.subject,
  verdicts: {
    protocolConformance: rollUp(dimensions.dimensions, 'protocol-conformance'),
    discoveryEligibility: rollUp(dimensions.dimensions, 'discovery-eligibility'),
  },
  dimensions: dimensions.dimensions,
  sanitization: {
    credentialsIncluded: false as const,
    paymentSignaturesIncluded: false as const,
    requestContentIncluded: false as const,
    responseBodiesIncluded: false as const,
    rawHeadersIncluded: false as const,
    customerDataIncluded: false as const,
  },
  limitations: dimensions.limitations,
}

const forbiddenInConformance = findForbiddenInConformance(conformance)
if (forbiddenInConformance.length > 0) {
  throw new Error(`Refusing to write: conformance result contains forbidden content: ${forbiddenInConformance.join(', ')}`)
}
parseConformanceResult(conformance)

writeFileSync(X402_PUBLIC_MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`)
writeFileSync(X402_CONFORMANCE_RESULT_PATH, `${JSON.stringify(conformance, null, 2)}\n`)

console.log(JSON.stringify({
  status: 'written',
  manifest: X402_PUBLIC_MANIFEST_PATH,
  conformance: X402_CONFORMANCE_RESULT_PATH,
  offers: manifest.offers.map((offer) => ({ id: offer.id, status: offer.status, payable: offer.payment !== null })),
  verdicts: conformance.verdicts,
  networkCallsMade: 0,
  paymentsMade: 0,
}, null, 2))
