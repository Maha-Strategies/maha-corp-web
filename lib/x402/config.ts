import type { PaymentRequirement, X402Network } from './protocol.ts'
import { rpcUrlFor } from './chain.ts'
import { releasesSlot } from './slot.ts'

// Everything here is off unless X402_ENABLED is exactly 'true'. The flag is
// checked before any other configuration is read, so an incomplete or
// half-configured deployment behaves exactly as it did before x402 existed
// rather than advertising a payment path that cannot complete.
//
// The published policy still states that autonomous payment is not supported.
// That flag must stay false until this path works end to end and legal review
// is complete: agent-offers.json is machine-readable, and an agent that reads
// it acts without a human present to notice the discrepancy.

export type PricedResource = {
  /** Path prefix this price applies to, matched against the request pathname. */
  pathPrefix: string
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
  network: X402Network
  /** CAIP-2 identifier sent to the facilitator, e.g. eip155:8453 for Base. */
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
  /** Seconds a concurrency slot is held before it self-releases. */
  slotTtlSeconds: number
  /**
   * JSON-RPC endpoint used to confirm that a settlement the facilitator
   * reported is actually on chain. Null disables confirmation entirely, which
   * is the previous behaviour: the facilitator's word is taken as final.
   */
  chainRpcUrl: string | null
}

const NETWORKS: Record<string, { network: X402Network; caip2: string }> = {
  base: { network: 'base', caip2: 'eip155:8453' },
  'base-sepolia': { network: 'base-sepolia', caip2: 'eip155:84532' },
  arbitrum: { network: 'arbitrum', caip2: 'eip155:42161' },
  solana: { network: 'solana', caip2: 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp' },
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

  const resources = parseResources(environment.X402_RESOURCES)
  if (resources.length === 0) throw new Error('X402_RESOURCES must define at least one priced resource.')

  const slotTtlSeconds = Number(environment.X402_SLOT_TTL_SECONDS ?? '120')
  if (!Number.isInteger(slotTtlSeconds) || slotTtlSeconds < 5 || slotTtlSeconds > 900) {
    throw new Error('X402_SLOT_TTL_SECONDS must be an integer between 5 and 900.')
  }

  return {
    facilitatorUrl,
    facilitatorAuthHeaders: parseAuthHeaders(environment.X402_FACILITATOR_AUTH_HEADERS),
    network: network.network,
    caip2Network: network.caip2,
    payTo,
    asset,
    // USDC's domain on every chain this supports. Overridable because the
    // defaults stop being right the moment a different token is priced.
    assetEip712: {
      name: environment.X402_ASSET_EIP712_NAME?.trim() || 'USD Coin',
      version: environment.X402_ASSET_EIP712_VERSION?.trim() || '2',
    },
    resources,
    slotTtlSeconds,
    chainRpcUrl: rpcUrlFor(network.caip2, environment.X402_CHAIN_RPC_URL),
  }
}

/** JSON: [{"pathPrefix":"/api/v1/compress","amount":"10000","description":"…","concurrencyCap":8}] */
function parseResources(raw: string | undefined): PricedResource[] {
  if (!raw?.trim()) return []
  let parsed: unknown
  try { parsed = JSON.parse(raw) } catch { throw new Error('X402_RESOURCES must be valid JSON.') }
  if (!Array.isArray(parsed)) throw new Error('X402_RESOURCES must be a JSON array.')

  return parsed.map((entry) => {
    if (typeof entry !== 'object' || entry === null) throw new Error('Each X402_RESOURCES entry must be an object.')
    const resource = entry as Record<string, unknown>
    const pathPrefix = typeof resource.pathPrefix === 'string' ? resource.pathPrefix.trim() : ''
    const amount = typeof resource.amount === 'string' ? resource.amount.trim() : ''
    const description = typeof resource.description === 'string' ? resource.description.trim() : ''
    const concurrencyCap = resource.concurrencyCap

    if (!pathPrefix.startsWith('/')) throw new Error('pathPrefix must start with /.')
    if (!/^[0-9]{1,32}$/.test(amount) || amount === '0') throw new Error('amount must be a positive integer string in the asset\'s smallest unit.')
    if (!description) throw new Error('description is required so the challenge states what is being bought.')
    if (typeof concurrencyCap !== 'number' || !Number.isInteger(concurrencyCap) || concurrencyCap < 1 || concurrencyCap > 1_000) {
      throw new Error('concurrencyCap must be an integer between 1 and 1000.')
    }
    // Pricing a path whose handler never releases its slot fills the cap with
    // slots nobody frees, and paying callers are refused until the scores
    // lapse. Nothing about the route surfaces that, so it is refused here
    // rather than discovered as unexplained 429s under load.
    if (!releasesSlot(pathPrefix)) {
      throw new Error(`${pathPrefix} does not release its concurrency slot, so it cannot be priced. Add it to SLOT_RELEASING_PATHS once its handler does.`)
    }
    return { pathPrefix, amount, description, concurrencyCap }
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

/** Longest matching prefix, so a specific path beats a general one. */
export function priceFor(pathname: string, config: X402Config): PricedResource | null {
  let match: PricedResource | null = null
  for (const resource of config.resources) {
    if (!pathname.startsWith(resource.pathPrefix)) continue
    if (!match || resource.pathPrefix.length > match.pathPrefix.length) match = resource
  }
  return match
}

export function requirementFor(resource: PricedResource, resourceUrl: string, config: X402Config): PaymentRequirement {
  return {
    scheme: 'exact',
    network: config.network,
    maxAmountRequired: resource.amount,
    resource: resourceUrl,
    description: resource.description,
    mimeType: 'application/json',
    payTo: config.payTo,
    maxTimeoutSeconds: 60,
    asset: config.asset,
    // Without this the facilitator cannot rebuild the signing digest and
    // refuses the payment as invalid_exact_evm_missing_eip712_domain.
    extra: { name: config.assetEip712.name, version: config.assetEip712.version },
  }
}
