import { createHash } from 'node:crypto'

import { BASE_MAINNET_CAIP2, USDC_DECIMALS, X402_OFFERS, type OfferStatus, type X402Offer } from './offers.ts'

/**
 * A single machine-readable manifest an agent, registry or conformance tool can
 * read without a credential.
 *
 * It links only what is already public and already supportable. The hard part
 * of a discovery document is not what to include but what to leave out: a
 * manifest that implies liveness, settlement history, uptime or a trust score
 * is more useful right up until the moment someone checks it.
 *
 * So this asserts configuration, not behaviour. `status` describes what the
 * catalog declares. It does not assert that an endpoint is reachable, enabled
 * in a given deployment, indexed by any registry, or has ever settled a
 * payment. **A live PAYMENT-REQUIRED challenge is the only proof an offer can
 * be bought**, and the manifest says so in-band.
 */
export const X402_PUBLIC_MANIFEST_VERSION = '1.0.0'
export const X402_PUBLIC_MANIFEST_PATH = 'public/.well-known/x402-public-manifest.json'
export const X402_PUBLIC_MANIFEST_URL = '/.well-known/x402-public-manifest.json'

const ORIGIN = 'https://www.mahastrategies.com'

/**
 * Catalog status, mapped to what an outside reader needs to decide.
 *
 * `preview` becomes `evaluation-only` because "preview" reads like "nearly
 * available" to a buyer and means "do not build against this" to us.
 */
export type PublicOfferStatus = 'active' | 'withheld' | 'evaluation-only' | 'unavailable'

export function publicStatusFor(status: OfferStatus): PublicOfferStatus {
  switch (status) {
    case 'available': return 'active'
    case 'preview': return 'evaluation-only'
    case 'withheld': return 'withheld'
    default: return 'unavailable'
  }
}

export type PublicManifestOffer = {
  id: string
  status: PublicOfferStatus
  canonicalResource: string
  method: 'POST'
  payment: {
    protocol: 'x402'
    version: 2
    scheme: 'exact'
    network: string
    asset: 'USDC'
    assetDecimals: number
    amountBaseUnits: string
    displayAmount: string
  } | null
  schemas: { input: string; output: string }
  declarationIntegrity: { algorithm: 'sha256'; digest: string; metadataVersion: string }
  limits: { maxRequestBytes: number; concurrencyCap: number; requiresIdempotency: boolean }
  retention: { fullSourceTextStored: false; verbatimExcerptsRetained: boolean; note: string }
  capabilityBoundaries: readonly string[]
}

export type X402PublicManifest = {
  schemaVersion: typeof X402_PUBLIC_MANIFEST_VERSION
  /**
   * The configuration snapshot this static document describes.
   *
   * Named for what it is. `generatedAt` invited the reading "last verified",
   * which is the one thing this document must never be taken to mean: it is
   * not a probe time, not a build timestamp, and not a freshness, uptime,
   * indexing or settlement observation. It moves only when the described
   * configuration is regenerated, which is what makes it reproducible.
   */
  configurationAsOf: string
  provider: { name: string; url: string }
  /** What this document is, and is not, in the document itself. */
  assertionBoundary: {
    assertsConfiguration: true
    assertsLiveness: false
    assertsSettlementHistory: false
    assertsRegistryIndexing: false
    assertsUptime: false
    assertsTrustScore: false
    configurationAsOfMeaning: string
    proofOfPayability: string
    note: string
  }
  offers: PublicManifestOffer[]
  evidence: { conformanceResult: string; doctorTool: string; observatory: string; integrationNotes: string }
  limitations: string[]
}

function digestFor(offer: X402Offer): string {
  // Content-derived, over the fields a buyer's client actually reads. Anything
  // that changes what a payer is agreeing to changes this digest.
  const canonical = JSON.stringify({
    id: offer.id,
    method: offer.method,
    resource: `${ORIGIN}${offer.path}`,
    amount: offer.amount,
    network: BASE_MAINNET_CAIP2,
    maxRequestBytes: offer.maxRequestBytes,
    requiresIdempotency: offer.requiresIdempotency,
    retention: {
      fullSourceTextStored: offer.retention.fullSourceTextStored,
      verbatimExcerptsRetained: offer.retention.verbatimExcerptsRetained,
    },
    capabilityBoundaries: [...offer.capabilityBoundaries],
  })
  return `sha256:${createHash('sha256').update(canonical).digest('hex')}`
}

export function buildPublicManifest(configurationAsOf: string): X402PublicManifest {
  return {
    schemaVersion: X402_PUBLIC_MANIFEST_VERSION,
    configurationAsOf,
    provider: { name: 'Maha Strategies LLC', url: ORIGIN },
    assertionBoundary: {
      assertsConfiguration: true,
      assertsLiveness: false,
      assertsSettlementHistory: false,
      assertsRegistryIndexing: false,
      assertsUptime: false,
      assertsTrustScore: false,
      configurationAsOfMeaning: 'configurationAsOf is the configuration snapshot this document describes. It is not a probe time, a build timestamp, a freshness signal, or an observation of uptime, indexing or settlement.',
      proofOfPayability: 'A live HTTP 402 PAYMENT-REQUIRED challenge from the canonical resource is the only proof an offer can be bought.',
      note: 'This manifest describes declared configuration as of configurationAsOf. It does not assert that any endpoint is currently reachable, enabled in a given deployment, indexed by any registry, or has ever settled a payment.',
    },
    offers: X402_OFFERS.map((offer): PublicManifestOffer => {
      const status = publicStatusFor(offer.status)
      return {
        id: offer.id,
        status,
        canonicalResource: `${ORIGIN}${offer.path}`,
        method: offer.method,
        // Payment terms are published only where the offer is actually
        // payable. Publishing terms for a withheld offer would read as an
        // invitation to pay for something that answers 401.
        payment: status === 'active'
          ? {
              protocol: 'x402', version: 2, scheme: 'exact',
              network: BASE_MAINNET_CAIP2, asset: 'USDC', assetDecimals: USDC_DECIMALS,
              amountBaseUnits: offer.amount,
              displayAmount: `${(Number(offer.amount) / 10 ** USDC_DECIMALS).toFixed(USDC_DECIMALS)} USDC`,
            }
          : null,
        schemas: {
          input: `${ORIGIN}/api/discovery/x402-offers/${offer.id}#input`,
          output: `${ORIGIN}/api/discovery/x402-offers/${offer.id}#output`,
        },
        declarationIntegrity: { algorithm: 'sha256', digest: digestFor(offer), metadataVersion: X402_PUBLIC_MANIFEST_VERSION },
        limits: {
          maxRequestBytes: offer.maxRequestBytes,
          concurrencyCap: offer.concurrencyCap,
          requiresIdempotency: offer.requiresIdempotency,
        },
        retention: {
          fullSourceTextStored: offer.retention.fullSourceTextStored,
          verbatimExcerptsRetained: offer.retention.verbatimExcerptsRetained,
          note: offer.retention.note,
        },
        capabilityBoundaries: offer.capabilityBoundaries,
      }
    }),
    evidence: {
      conformanceResult: `${ORIGIN}/.well-known/x402-conformance-result.json`,
      doctorTool: 'npm run x402:doctor',
      observatory: `${ORIGIN}/api/x402-observatory`,
      integrationNotes: `${ORIGIN}/x402-buyer-policy`,
    },
    limitations: [
      'Status describes declared configuration, not observed behaviour. Verify payability with a live 402 challenge.',
      'Protocol conformance and discovery-registry eligibility are separate verdicts; passing one does not imply the other.',
      'Declaration digests cover the published contract fields, not the implementation behind them.',
      'Maha publishes its own evidence. It is not an independent trust score, and it should not be treated as one.',
      'No settlement count, payer history, uptime figure or availability guarantee is asserted anywhere in this document.',
    ],
  }
}

/** Values that must never appear in a public manifest. */
export const MANIFEST_FORBIDDEN_PATTERNS: readonly RegExp[] = [
  /sk-ant-[A-Za-z0-9_-]{8,}/,
  /\bBearer\s+[A-Za-z0-9._-]{16,}/,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /\b0x[a-fA-F0-9]{64}\b/,               // private key or tx-shaped secret
  /localhost|127\.0\.0\.1|\.internal\b/i,
  /\/api\/admin\//,
  /SUPABASE|UPSTASH|STRIPE|ANTHROPIC|CDP_|_SECRET|_TOKEN/,
]

export function findForbiddenInManifest(manifest: unknown): string[] {
  const serialized = JSON.stringify(manifest)
  return MANIFEST_FORBIDDEN_PATTERNS.filter((pattern) => pattern.test(serialized)).map((pattern) => pattern.source)
}
