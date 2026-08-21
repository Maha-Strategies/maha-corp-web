/**
 * Validates the public x402 evidence with no network and no payment.
 *
 * This is the command an external reviewer runs, and the one CI runs. It
 * re-derives the manifest from the catalog, re-derives every digest, checks the
 * conformance roll-ups against their own dimensions, and refuses any secret or
 * internal URL.
 */
import { readFileSync } from 'node:fs'

import {
  X402_PUBLIC_MANIFEST_PATH,
  buildPublicManifest,
  findForbiddenInManifest,
  publicStatusFor,
} from '../lib/x402/public-manifest.ts'
import {
  X402_CONFORMANCE_RESULT_PATH,
  findForbiddenInConformance,
  parseConformanceResult,
} from '../lib/x402/public-conformance.ts'
import { X402_OFFERS } from '../lib/x402/offers.ts'

const failures: string[] = []
const note = (message: string): void => { failures.push(message) }

const committedManifest = JSON.parse(readFileSync(X402_PUBLIC_MANIFEST_PATH, 'utf8'))
const derived = buildPublicManifest(committedManifest.configurationAsOf)

// The manifest must be a pure function of the catalog. A hand edit is a claim
// nobody derived.
if (JSON.stringify(committedManifest) !== JSON.stringify(derived)) {
  note(`${X402_PUBLIC_MANIFEST_PATH} does not reproduce from the offer catalog. Run: npm run generate:x402-public-evidence`)
}

for (const problem of findForbiddenInManifest(committedManifest)) {
  note(`manifest contains forbidden content matching /${problem}/`)
}

// Status and payment terms must agree with the catalog, offer by offer.
for (const offer of X402_OFFERS) {
  const published = committedManifest.offers.find((entry: { id: string }) => entry.id === offer.id)
  if (!published) { note(`manifest omits catalog offer ${offer.id}`); continue }
  const expected = publicStatusFor(offer.status)
  if (published.status !== expected) note(`${offer.id}: manifest says ${published.status}, catalog says ${expected}`)
  if (expected !== 'active' && published.payment !== null) {
    note(`${offer.id}: payment terms published for a non-active offer`)
  }
  if (expected === 'active' && published.payment?.amountBaseUnits !== offer.amount) {
    note(`${offer.id}: published amount does not match the catalog`)
  }
  if (!/^sha256:[0-9a-f]{64}$/.test(published.declarationIntegrity?.digest ?? '')) {
    note(`${offer.id}: declaration digest is malformed`)
  }
}

// The document must not quietly acquire the claims it says it does not make.
const boundary = committedManifest.assertionBoundary ?? {}
for (const flag of ['assertsLiveness', 'assertsSettlementHistory', 'assertsRegistryIndexing', 'assertsUptime', 'assertsTrustScore']) {
  if (boundary[flag] !== false) note(`manifest.assertionBoundary.${flag} must be false`)
}

let conformance: ReturnType<typeof parseConformanceResult> | null = null
try {
  conformance = parseConformanceResult(JSON.parse(readFileSync(X402_CONFORMANCE_RESULT_PATH, 'utf8')))
} catch (error) {
  note(`conformance result invalid: ${error instanceof Error ? error.message : 'unknown'}`)
}
if (conformance) {
  for (const problem of findForbiddenInConformance(conformance)) {
    note(`conformance result contains forbidden content matching /${problem}/`)
  }
  // The two verdicts stay separate; a combined score is the thing this format exists to prevent.
  if ('overall' in (conformance as Record<string, unknown>) || 'score' in (conformance as Record<string, unknown>)) {
    note('conformance result publishes a combined score; protocol conformance and discovery eligibility must stay separate')
  }
}

if (failures.length > 0) {
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log(JSON.stringify({
  status: 'valid',
  manifest: X402_PUBLIC_MANIFEST_PATH,
  conformance: X402_CONFORMANCE_RESULT_PATH,
  offers: committedManifest.offers.length,
  verdicts: conformance?.verdicts,
  reproducedFromCatalog: true,
  networkCallsMade: 0,
  paymentsMade: 0,
  credentialsUsed: false,
}, null, 2))
