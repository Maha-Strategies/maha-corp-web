import type { PaymentRequirement, X402Network } from './protocol.ts'
import { rpcUrlFor } from './chain.ts'
import { releasesSlot } from './slot.ts'
import { catalogMismatches, offerFor } from './offers.ts'
import type { CdpApiCredentials } from './cdp-auth.ts'

// Everything here is off unless X402_ENABLED is exactly 'true'. The flag is
// checked before any other configuration is read, so an incomplete or
// half-configured deployment behaves exactly as it did before x402 existed
// rather than advertising a payment path that cannot complete.
//
// This is the autonomous pay-per-call path. It is deliberately separate from
// consulting and checkout offers whose machine-readable policy still requires
// human authorization.

export type PricedResource = {
  /** The catalog offer this resource enables. */
  offerId: string
  /**
   * HTTP method this price applies to.
   *
   * Matching used to be method-blind, which was survivable with one priced
   * POST and stops being survivable the moment a resource grows a GET status
   * route: an unpaid status poll would be answered with a 402 demanding the
   * POST price, and a payment signed for the POST would admit a GET.
   */
  method: 'POST'
  /**
   * Exact pathname. Not a prefix.
   *
   * Prefix matching is why /api/v1/compress/evaluate could be sold for a
   * tenth of its price: it starts with /api/v1/compress, so the longest-prefix
   * rule found the entry offer and priced the deep one at $0.001. Exact match
   * removes the class rather than patching the instance -- there is no
   * ordering of prefixes that makes an unlisted sub-path safe.
   */
  path: string
  /** Smallest indivisible unit of the asset. USDC has six decimals, so 10000 is $0.01. */
  amount: string
  description: string
  /**
   * Most concurrent paid requests admitted for this resource.
   *
   * The point is the GPU solvers. Payment authorizes a request but says
   * nothing about capacity, and a caller willing to spend a few dollars could
   * otherwise saturate Modal.
   */
  concurrencyCap: number
}

export type X402Config = {
  facilitatorUrl: string
  facilitatorAuthHeaders?: Record<string, string>
  cdpCredentials?: CdpApiCredentials
  /** CAIP-2 identifier sent on every x402 v2 message. */
  network: X402Network
  caip2Network: string
  /** The settlement provider's receiving address, not a wallet we hold. */
  payTo: string
  /** Asset contract address, e.g. USDC on the configured network. */
  asset: string
  /**
   * The asset's EIP-712 domain. Sent to the facilitator so it can rebuild the
   * digest the payer signed. Must match the token contract exactly: read
   * `name()` and `version()` from it rather than assuming, because a mismatch
   * produces a signature that is valid and useless.
   */
  assetEip712: { name: string; version: string }
  resources: PricedResource[]
  /**
   * Ways this deployment's X402_RESOURCES disagrees with the published
   * catalog. Empty in a healthy deployment. Non-empty is served anyway --
   * the catalog's values win, so nothing wrong is sold -- and readiness
   * fails on it so the stale variable gets fixed rather than forgotten.
   */
  catalogContradictions: string[]
  /** Seconds a concurrency slot is held before it self-releases. */
  slotTtlSeconds: number
  /**
   * JSON-RPC endpoint used to confirm that a settlement the facilitator
   * reported is actually on chain. Null disables confirmation entirely, which
   * is the previous behaviour: the facilitator's word is taken as final.
   */
  chainRpcUrl: string | null
}

const NETWORKS: Record<string, X402Network> = {
  base: 'eip155:8453',
  'eip155:8453': 'eip155:8453',
  'base-sepolia': 'eip155:84532',
  'eip155:84532': 'eip155:84532',
  arbitrum: 'eip155:42161',
  'eip155:42161': 'eip155:42161',
  solana: 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp',
  'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp': 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp',
}

type Environment = Record<string, string | undefined>

export function x402Enabled(environment: Environment = process.env): boolean {
  return environment.X402_ENABLED?.trim() === 'true'
}

/**
 * Returns null when x402 is disabled or not fully configured. Throws only when
 * the configuration is present but invalid, so a typo is loud rather than
 * silently disabling payments.
 */
export function x402Config(environment: Environment = process.env): X402Config | null {
  if (!x402Enabled(environment)) return null

  const facilitatorUrl = environment.X402_FACILITATOR_URL?.trim()
  const payTo = environment.X402_PAY_TO?.trim()
  const asset = environment.X402_ASSET?.trim()
  const networkName = environment.X402_NETWORK?.trim() || 'base'

  if (!facilitatorUrl || !payTo || !asset) {
    throw new Error('X402_ENABLED is true but X402_FACILITATOR_URL, X402_PAY_TO, and X402_ASSET must all be set.')
  }
  const network = NETWORKS[networkName]
  if (!network) throw new Error(`X402_NETWORK must be one of: ${Object.keys(NETWORKS).join(', ')}`)

  let url: URL
  try { url = new URL(facilitatorUrl) } catch { throw new Error('X402_FACILITATOR_URL must be an absolute URL.') }
  if (url.protocol !== 'https:') throw new Error('X402_FACILITATOR_URL must be https.')

  const cdpApiKeyId = environment.CDP_API_KEY_ID?.trim()
  const cdpApiKeySecret = environment.CDP_API_KEY_SECRET?.trim()
  if (Boolean(cdpApiKeyId) !== Boolean(cdpApiKeySecret)) {
    throw new Error('CDP_API_KEY_ID and CDP_API_KEY_SECRET must be set together.')
  }
  if (url.hostname === 'api.cdp.coinbase.com' && (!cdpApiKeyId || !cdpApiKeySecret)) {
    throw new Error('The CDP mainnet facilitator requires CDP_API_KEY_ID and CDP_API_KEY_SECRET.')
  }

  const catalogContradictions: string[] = []
  const resources = parseResources(environment.X402_RESOURCES, catalogContradictions)
  if (resources.length === 0) throw new Error('X402_RESOURCES must define at least one priced resource.')
  for (const contradiction of catalogContradictions) {
    console.error('x402 deployment configuration contradicts the public offer catalog:', contradiction)
  }

  const slotTtlSeconds = Number(environment.X402_SLOT_TTL_SECONDS ?? '120')
  if (!Number.isInteger(slotTtlSeconds) || slotTtlSeconds < 5 || slotTtlSeconds > 900) {
    throw new Error('X402_SLOT_TTL_SECONDS must be an integer between 5 and 900.')
  }

  return {
    facilitatorUrl,
    facilitatorAuthHeaders: parseAuthHeaders(environment.X402_FACILITATOR_AUTH_HEADERS),
    ...(cdpApiKeyId && cdpApiKeySecret ? { cdpCredentials: { apiKeyId: cdpApiKeyId, apiKeySecret: cdpApiKeySecret } } : {}),
    network,
    caip2Network: network,
    payTo,
    asset,
    // USDC's domain on every chain this supports. Overridable because the
    // defaults stop being right the moment a different token is priced.
    assetEip712: {
      name: environment.X402_ASSET_EIP712_NAME?.trim() || 'USD Coin',
      version: environment.X402_ASSET_EIP712_VERSION?.trim() || '2',
    },
    resources,
    catalogContradictions,
    slotTtlSeconds,
    chainRpcUrl: rpcUrlFor(network, environment.X402_CHAIN_RPC_URL),
  }
}

/**
 * Turns the deployment's enablement list into priced resources.
 *
 * JSON: [{"method":"POST","path":"/api/v1/compress","amount":"1000","description":"…","concurrencyCap":8}]
 * `pathPrefix` is still read as a synonym for `path`, so a deployment carrying
 * the pre-catalog spelling keeps working rather than dropping payments the
 * moment this ships.
 *
 * What the environment decides is *which* offers are on. What it does not
 * decide is what they cost or what they claim: those are read from the public
 * catalog, so a stale variable cannot quietly sell an offer at a price the
 * published manifests contradict. Contradictions are collected and surfaced by
 * readiness (see `catalogContradictions`) rather than thrown, because taking
 * payments offline over a description drift is a worse outage than the drift.
 */
function parseResources(raw: string | undefined, contradictions: string[]): PricedResource[] {
  if (!raw?.trim()) return []
  let parsed: unknown
  try { parsed = JSON.parse(raw) } catch { throw new Error('X402_RESOURCES must be valid JSON.') }
  if (!Array.isArray(parsed)) throw new Error('X402_RESOURCES must be a JSON array.')

  const seen = new Set<string>()
  return parsed.map((entry) => {
    if (typeof entry !== 'object' || entry === null) throw new Error('Each X402_RESOURCES entry must be an object.')
    const resource = entry as Record<string, unknown>
    const rawPath = typeof resource.path === 'string' ? resource.path.trim()
      : typeof resource.pathPrefix === 'string' ? resource.pathPrefix.trim() : ''
    const method = (typeof resource.method === 'string' ? resource.method.trim() : 'POST').toUpperCase()

    if (!rawPath.startsWith('/')) throw new Error('path must start with /.')
    if (method !== 'POST') throw new Error(`Only POST resources can be priced; got ${method} ${rawPath}.`)

    // An unknown path is a typo, and a typo here sells nothing while looking
    // configured. Loud at boot beats silent in production.
    const offer = offerFor(method, rawPath)
    if (!offer) {
      throw new Error(`X402_RESOURCES enables ${method} ${rawPath}, which is not in the public offer catalog (lib/x402/offers.ts).`)
    }
    const key = `${method} ${rawPath}`
    if (seen.has(key)) throw new Error(`X402_RESOURCES lists ${key} twice.`)
    seen.add(key)

    for (const problem of catalogMismatches([{
      path: rawPath,
      method,
      amount: typeof resource.amount === 'string' ? resource.amount.trim() : offer.amount,
      description: typeof resource.description === 'string' ? resource.description.trim() : offer.description,
      concurrencyCap: typeof resource.concurrencyCap === 'number' ? resource.concurrencyCap : offer.concurrencyCap,
    }])) {
      contradictions.push(problem)
    }

    // Pricing a path whose handler never releases its slot fills the cap with
    // slots nobody frees, and paying callers are refused until the scores
    // lapse. Nothing about the route surfaces that, so it is refused here
    // rather than discovered as unexplained 429s under load.
    if (!releasesSlot(offer.method, offer.path)) {
      throw new Error(`${method} ${rawPath} does not release its concurrency slot, so it cannot be priced. Add it to SLOT_RELEASING_ROUTES once its handler does.`)
    }

    return {
      offerId: offer.id,
      method: offer.method,
      path: offer.path,
      amount: offer.amount,
      description: offer.description,
      concurrencyCap: offer.concurrencyCap,
    }
  })
}

function parseAuthHeaders(raw: string | undefined): Record<string, string> | undefined {
  if (!raw?.trim()) return undefined
  let parsed: unknown
  try { parsed = JSON.parse(raw) } catch { throw new Error('X402_FACILITATOR_AUTH_HEADERS must be valid JSON.') }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) throw new Error('X402_FACILITATOR_AUTH_HEADERS must be a JSON object.')
  const headers: Record<string, string> = {}
  for (const [name, value] of Object.entries(parsed)) {
    if (typeof value !== 'string') throw new Error('X402_FACILITATOR_AUTH_HEADERS values must be strings.')
    headers[name] = value
  }
  return headers
}

/**
 * Exact method and path, or nothing.
 *
 * This replaced longest-prefix matching, which was not merely imprecise but
 * actively unsafe once a second offer lived under a first one's path. Under
 * prefix rules /api/v1/compress/evaluate matched the $0.001 entry offer, so a
 * $0.01 resource would have been sold at a tenth of its price to anyone who
 * found the URL -- and the 402 would have quoted the low price, so the payer
 * would have done nothing wrong.
 *
 * Being method-aware closes the mirror-image hole: a GET status route under a
 * priced POST path no longer inherits the POST's price, and a payment signed
 * for the POST no longer admits a GET.
 *
 * The cost of exactness is that a new sub-path is unpriced until it is added
 * to the catalog. That is the safe direction to fail: an unpriced route is
 * refused by the API-key gate, whereas a mispriced one takes money.
 */
export function priceFor(method: string, pathname: string, config: X402Config): PricedResource | null {
  const wanted = method.toUpperCase()
  return config.resources.find((resource) => resource.method === wanted && resource.path === pathname) ?? null
}

export function requirementFor(resource: PricedResource, resourceUrl: string, config: X402Config): PaymentRequirement {
  // resourceUrl is accepted for call-site stability; in v2 it lives in the
  // top-level ResourceInfo rather than inside each payment requirement.
  void resourceUrl
  return {
    scheme: 'exact',
    network: config.network,
    amount: resource.amount,
    payTo: config.payTo,
    maxTimeoutSeconds: 60,
    asset: config.asset,
    // Without this the facilitator cannot rebuild the signing digest and
    // refuses the payment as invalid_exact_evm_missing_eip712_domain.
    extra: { name: config.assetEip712.name, version: config.assetEip712.version },
  }
}
