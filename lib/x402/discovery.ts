import {
  bazaarResourceServerExtension,
  declareDiscoveryExtension,
  validateDiscoveryExtension,
  validateDiscoveryExtensionSpec,
} from '@x402/extensions/bazaar'

import type { PricedResource } from './config.ts'
import { X402_VERSION, type PaymentRequirement, type ResourceInfo } from './protocol.ts'
import { BASE_MAINNET_CAIP2, CONTEXT_COMPRESSION_OFFER, USDC_DECIMALS, offerById } from './offers.ts'
import { DECLARATION_DIGEST_EXTENSION, createDeclarationDigestExtension } from './declaration-digest.ts'
import { compactExample, compactSchema } from './declaration-compaction.ts'

/** Extension namespace for Maha's own commerce metadata. */
export const OFFER_EXTENSION = 'maha-offer'

/**
 * Bumped whenever any published offer's declaration changes. A catalog uses it
 * with the declaration digest to tell a re-index from a genuine revision.
 */
export const OFFER_METADATA_VERSION = '2026-08-10'

/** Where the complete, uncompacted declaration for an offer is published. */
export function declarationUrl(origin: string, offerId: string): string {
  return `${origin}/api/discovery/x402-offers/${offerId}`
}

const ICON_URL = 'https://www.mahastrategies.com/icon.png'
// Written to be verifiable rather than persuasive. A router selects on fit,
// and stating where the tool does not fit is what makes the rest credible --
// an agent that tries this on a SQL dump and gets a larger payload back will
// not come again. Breakeven is given as a formula because it depends on the
// caller's model price and on the reduction their payload shape actually
// achieves, neither of which this service knows.
// Every clause here is load-bearing and the field has a hard ceiling, so this
// is written tight rather than complete: what it does, how to decide whether
// calling it pays, and the three ways it does not fit. The long-form version
// -- measured breakeven anchors, the negative-reduction workloads, the full
// script-coverage note -- lives in SKILL.md and the Bazaar `info` extension,
// neither of which is length-bound by the facilitator.
/**
 * Kept as a named export because scripts, tests and the conformance corpus
 * import it. The text itself now lives in the offer catalog, so there is one
 * copy of every published claim rather than one per surface.
 */
export const CONTEXT_COMPILER_DESCRIPTION = CONTEXT_COMPRESSION_OFFER.description

export const MAX_RESOURCE_DESCRIPTION_CHARS = 480
export const MAX_RESOURCE_DESCRIPTION_BYTES = 480

const utf8Bytes = (value: string): number => new TextEncoder().encode(value).length

/**
 * Clamped rather than rejected. A description that outgrows the ceiling is a
 * copy problem, and refusing to build the challenge would turn it into an
 * outage; publishing a truncated sentence keeps payments working while the
 * contract test that guards the authored length fails loudly in CI.
 *
 * This is the fallback, not the mechanism. The production description is
 * written to fit, and a value that reaches the clamp is a bug that has already
 * been caught in CI -- the clamp only decides whether it degrades to shortened
 * copy or to a total payment outage.
 *
 * Iteration is by code point rather than by UTF-16 unit, so an emoji or a CJK
 * character is never cut in half. Slicing a JavaScript string at a fixed index
 * can split a surrogate pair and produce a lone half that is not valid UTF-8,
 * which is exactly the class of malformed field this function exists to avoid
 * sending.
 */
export function boundDescription(description: string): string {
  if (description.length <= MAX_RESOURCE_DESCRIPTION_CHARS && utf8Bytes(description) <= MAX_RESOURCE_DESCRIPTION_BYTES) {
    return description
  }

  console.warn('x402 resource description exceeds the facilitator ceiling and was clamped', JSON.stringify({
    length: description.length,
    bytes: utf8Bytes(description),
    maxChars: MAX_RESOURCE_DESCRIPTION_CHARS,
    maxBytes: MAX_RESOURCE_DESCRIPTION_BYTES,
  }))

  let clamped = ''
  let bytes = 0
  let characters = 0
  for (const codePoint of description) {
    const size = utf8Bytes(codePoint)
    if (bytes + size > MAX_RESOURCE_DESCRIPTION_BYTES) break
    if (characters + codePoint.length > MAX_RESOURCE_DESCRIPTION_CHARS) break
    clamped += codePoint
    bytes += size
    characters += codePoint.length
  }

  // Prefer a word boundary, but only a nearby one. Scripts that do not
  // separate words with spaces have no boundary to find, and hunting further
  // back would discard most of the text to satisfy a rule that does not apply.
  const lastSpace = clamped.lastIndexOf(' ')
  return lastSpace > clamped.length - 80 ? clamped.slice(0, lastSpace) : clamped
}


export function resourceInfoFor(resource: PricedResource, resourceUrl: string): ResourceInfo {
  const offer = offerById(resource.offerId)
  return {
    url: resourceUrl,
    // The catalog's description, not the deployment variable's. A stale
    // X402_RESOURCES entry can enable or disable an offer; it cannot change
    // what the challenge claims that offer is.
    description: boundDescription(offer?.description ?? resource.description),
    mimeType: 'application/json',
    ...(offer
      ? { serviceName: offer.serviceName, tags: [...offer.tags], iconUrl: ICON_URL }
      : {}),
  }
}

/**
 * Bazaar catalog metadata plus the integrity and commerce facts an autonomous
 * buyer needs before signing.
 *
 * Cached per offer. The previous single module-level variable was correct for
 * exactly one offer and silently wrong for more than one: whichever offer was
 * probed first would have populated the cache, and every other offer's
 * challenge would then have advertised the first one's schema. That failure is
 * invisible from the server side -- the 402 looks well-formed -- and surfaces
 * as agents paying for one resource and calling another.
 *
 * An offer with no catalog entry receives no declaration at all, which remains
 * deliberate: a vague or incorrect schema is worse than no listing, because a
 * Bazaar agent can spend money against it without a human noticing.
 */
const declarationCache = new Map<string, Record<string, unknown>>()

export async function discoveryExtensionsFor(
  resource: PricedResource,
  resourceUrl: string,
  requirement?: PaymentRequirement,
): Promise<Record<string, unknown> | undefined> {
  const offer = offerById(resource.offerId)
  if (!offer) return undefined

  // Keyed by offer and by resource URL. The same offer is served from Preview
  // and Production under different origins, and the canonical resource URL is
  // covered by the declaration digest, so one cache entry cannot serve both.
  const cacheKey = `${offer.id} ${resourceUrl}`
  const cached = declarationCache.get(cacheKey)
  if (cached) return cached

  // Compacted, so a standard client that echoes this back fits inside the
  // 16 KB PAYMENT-SIGNATURE ceiling. The input example is published verbatim
  // because a crawler replays it; only the schemas and the response example
  // are reduced, and the complete forms are served at `declarationUrl`.
  const declared = declareDiscoveryExtension({
    bodyType: 'json',
    input: offer.discovery.input,
    inputSchema: compactSchema(offer.discovery.inputSchema),
    output: {
      example: compactExample(offer.discovery.output) as Record<string, unknown>,
      schema: compactSchema(offer.discovery.outputSchema),
    },
  })

  const enriched = bazaarResourceServerExtension.enrichDeclaration?.(declared.bazaar, {
    method: offer.method,
    path: offer.path,
    adapter: { getPath: () => offer.path },
  }) as Record<string, unknown>

  const validation = validateDiscoveryExtensionSpec(enriched)
  if (!validation.valid) {
    throw new Error(`Invalid Bazaar discovery declaration for ${offer.id}: ${validation.errors?.join('; ') ?? 'unknown error'}`)
  }
  const dataValidation = validateDiscoveryExtension(enriched as unknown as Parameters<typeof validateDiscoveryExtension>[0])
  if (!dataValidation.valid) {
    throw new Error(`Bazaar discovery example for ${offer.id} does not satisfy its schema: ${dataValidation.errors?.join('; ') ?? 'unknown error'}`)
  }

  // The commercial facts a buyer needs that the Bazaar schema has no field
  // for: what the money is, on which chain, and what the offer does not do.
  // Published beside the schema so an agent never has to read prose docs to
  // find the boundary of what it is buying.
  // Deliberately lean. Every byte here is echoed back by a conforming client
  // inside a 16 KB header, so this carries only what a buyer needs *to decide
  // and to pay*: the money, the chain, the limits, and whether it can buy this
  // at all. The prose -- capability boundaries, retention wording, the gates a
  // withheld offer is waiting on -- is duplicated from `resource.description`
  // or served in full at `declarationUrl`, and is not worth a byte of the
  // payer's header budget.
  const offerExtension = {
    offerId: offer.id,
    method: offer.method,
    canonicalResource: resourceUrl,
    amount: offer.amount,
    asset: 'USDC',
    assetDecimals: USDC_DECIMALS,
    network: requirement?.network ?? BASE_MAINNET_CAIP2,
    status: offer.status,
    payableInProduction: offer.availability.payableInProduction,
    maxRequestBytes: offer.maxRequestBytes,
    fullSourceTextStored: offer.retention.fullSourceTextStored,
    verbatimExcerptsRetained: offer.retention.verbatimExcerptsRetained,
    declarationUrl: declarationUrl(new URL(resourceUrl).origin, offer.id),
    declarationInline: 'compact',
  }

  const extensions: Record<string, unknown> = { bazaar: enriched, [OFFER_EXTENSION]: offerExtension }

  // The digest must describe the declaration this server actually publishes,
  // which means it is taken over the real resource *and the real accepts* --
  // not over a placeholder. A digest computed over a stand-in validates
  // against itself and fails against the live challenge, which is exactly the
  // self-mismatch x402-doctor exists to catch. So the requirement is passed in
  // rather than invented here.
  if (requirement) {
    const integrity = await createDeclarationDigestExtension(
      {
        x402Version: X402_VERSION,
        resource: resourceInfoFor(resource, resourceUrl) as unknown as Record<string, unknown>,
        accepts: [requirement],
        extensions,
      },
      OFFER_METADATA_VERSION,
    )
    extensions[DECLARATION_DIGEST_EXTENSION] = integrity
  }

  const frozen = Object.freeze(extensions)
  // Only a complete declaration is cached. Caching one built without a
  // requirement would serve a digest-less declaration for the lifetime of the
  // instance to every later caller that did supply one.
  if (requirement) declarationCache.set(cacheKey, frozen)
  return frozen
}

/** Test seam. A warm instance otherwise keeps a declaration for its lifetime. */
export function resetDiscoveryCache(): void {
  declarationCache.clear()
}
