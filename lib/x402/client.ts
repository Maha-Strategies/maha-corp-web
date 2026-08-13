// The buyer half of x402: answer a 402 by signing a payment and asking again.
//
// This runs in a browser, so it deliberately depends on nothing. The signing
// itself is one injected function with the shape every wallet library already
// exposes -- wagmi's `signTypedDataAsync`, viem's `walletClient.signTypedData`,
// an ethers signer with a thin wrapper. Taking a wallet library as a hard
// dependency here would put MetaMask, WalletConnect and their transitive tree
// into the production bundle of a payment API, which is the same trade
// lib/x402/facilitator.ts refused on the seller side and for the same reason.
//
// What this owns is the protocol: decode the challenge, pick a requirement it
// can actually satisfy, build the exact EIP-712 payload the facilitator will
// rebuild, and retry once. It never holds a key and never sends one.

export const PAYMENT_REQUIRED_HEADER = 'PAYMENT-REQUIRED'
export const PAYMENT_SIGNATURE_HEADER = 'PAYMENT-SIGNATURE'
export const PAYMENT_RESPONSE_HEADER = 'PAYMENT-RESPONSE'

/** Network names the seller publishes, mapped to the chain a signature binds to. */
export const NETWORK_CHAIN_IDS: Record<string, number> = {
  'eip155:84532': 84532,
  'eip155:8453': 8453,
  'eip155:42161': 42161,
}

export type PaymentRequirement = {
  scheme: string
  network: string
  amount: string
  payTo: string
  maxTimeoutSeconds: number
  asset: string
  /** The token's EIP-712 domain. The facilitator rebuilds the signing digest
   *  from it, so a payment signed against a different one is rejected. */
  extra?: { name?: string; version?: string }
}

export type PaymentChallenge = {
  x402Version: number
  resource: {
    url: string
    description?: string
    mimeType?: string
    serviceName?: string
    tags?: string[]
    iconUrl?: string
  }
  accepts: PaymentRequirement[]
  extensions?: Record<string, unknown>
  error?: string
}

export type TransferAuthorization = {
  from: string
  to: string
  value: bigint
  validAfter: bigint
  validBefore: bigint
  nonce: string
}

export type TypedDataRequest = {
  domain: { name: string; version: string; chainId: number; verifyingContract: string }
  types: { TransferWithAuthorization: Array<{ name: string; type: string }> }
  primaryType: 'TransferWithAuthorization'
  message: TransferAuthorization
}

/** Exactly wagmi's `signTypedDataAsync` shape, so wiring it is a pass-through. */
export type TypedDataSigner = (request: TypedDataRequest) => Promise<string>

export type X402ErrorCode =
  | 'no_challenge_header'
  | 'malformed_challenge'
  | 'no_supported_requirement'
  | 'wrong_network'
  | 'wallet_not_connected'
  | 'signature_rejected'
  | 'payment_rejected'
  | 'payment_already_used'
  // Distinct from payment_already_used on purpose. All three settle the
  // payment and then refuse delivery, and a payer needs to know which of their
  // own inputs to change -- telling them the authorization was spent when the
  // hash disagreed is worse than useless.
  | 'input_hash_mismatch'
  | 'idempotency_key_mismatch'
  | 'idempotency_conflict'
  | 'ledger_unavailable'
  | 'resource_at_capacity'

/**
 * Carries the code and, where the failure happened after signing, the
 * requirement that was signed for. A caller that has just prompted someone's
 * wallet needs to be able to say what they paid for and whether it went
 * through, not just that something failed.
 */
export class X402PaymentError extends Error {
  readonly code: X402ErrorCode
  readonly status?: number
  readonly requirement?: PaymentRequirement
  /** True when no payment was settled, so retrying costs the payer nothing. */
  readonly settled: boolean
  /**
   * The authorization this payer signed, when one was signed.
   *
   * Carried so a failure can be written to evidence with the validity window
   * and a nonce digest attached. Without it a refusal cannot be told apart
   * from the next refusal, and an expired authorization looks the same as a
   * rejected one.
   */
  readonly authorization?: TransferAuthorization
  /** The seller's own reason string, verbatim, when it supplied one. */
  readonly providerReason?: string

  constructor(code: X402ErrorCode, message: string, options: {
    status?: number
    requirement?: PaymentRequirement
    settled?: boolean
    cause?: unknown
    authorization?: TransferAuthorization
    providerReason?: string
  } = {}) {
    super(message, { cause: options.cause })
    this.name = 'X402PaymentError'
    this.code = code
    this.status = options.status
    this.requirement = options.requirement
    this.settled = options.settled ?? false
    this.authorization = options.authorization
    this.providerReason = options.providerReason
  }
}

// ---------------------------------------------------------------------------
// Encoding
// ---------------------------------------------------------------------------

// btoa and atob are byte-oriented, so text has to cross explicitly. Spreading
// a Uint8Array into String.fromCharCode overflows the call stack on large
// inputs, hence the loop.

function toBase64(value: string): string {
  const bytes = new TextEncoder().encode(value)
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

function fromBase64(value: string): string {
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
  return new TextDecoder().decode(bytes)
}

/** Rejects rather than throws raw, so a malformed challenge is a clear error. */
export function decodeChallenge(header: string | null): PaymentChallenge {
  if (!header?.trim()) {
    throw new X402PaymentError('no_challenge_header', 'The server asked for payment but sent no PAYMENT-REQUIRED header.')
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(fromBase64(header.trim()))
  } catch (cause) {
    throw new X402PaymentError('malformed_challenge', 'The payment challenge could not be decoded.', { cause })
  }
  const challenge = parsed as PaymentChallenge
  if (!challenge || challenge.x402Version !== 2 || !challenge.resource?.url || !Array.isArray(challenge.accepts) || challenge.accepts.length === 0) {
    throw new X402PaymentError('malformed_challenge', 'The payment challenge listed no terms that could be paid.')
  }
  return challenge
}

/**
 * The first requirement this wallet can actually satisfy.
 *
 * A seller may offer several. Picking one whose chain the wallet is not on
 * produces a signature that is valid and useless, so the chain is part of the
 * match rather than checked afterwards.
 */
export function selectRequirement(challenge: PaymentChallenge, chainId: number): PaymentRequirement | null {
  return challenge.accepts.find((requirement) =>
    requirement.scheme === 'exact' && NETWORK_CHAIN_IDS[requirement.network] === chainId) ?? null
}

/** 32 random bytes. The nonce is what stops one authorization being submitted twice. */
function randomNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  return `0x${Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')}`
}

/**
 * The EIP-3009 `transferWithAuthorization` the payer signs.
 *
 * The domain comes from the challenge, never from a constant. The seller
 * publishes the domain it will hand the facilitator, and signing against a
 * different `name` or `version` yields a signature that verifies locally and
 * is refused on presentation -- a failure that costs a wallet prompt to learn.
 */
export function buildTypedData(requirement: PaymentRequirement, from: string, now = Date.now()): TypedDataRequest {
  const chainId = NETWORK_CHAIN_IDS[requirement.network]
  if (!chainId) {
    throw new X402PaymentError('no_supported_requirement', `This client cannot pay on ${requirement.network}.`, { requirement })
  }
  const seconds = BigInt(Math.floor(now / 1_000))
  return {
    domain: {
      name: requirement.extra?.name ?? 'USD Coin',
      version: requirement.extra?.version ?? '2',
      chainId,
      verifyingContract: requirement.asset,
    },
    types: {
      TransferWithAuthorization: [
        { name: 'from', type: 'address' },
        { name: 'to', type: 'address' },
        { name: 'value', type: 'uint256' },
        { name: 'validAfter', type: 'uint256' },
        { name: 'validBefore', type: 'uint256' },
        { name: 'nonce', type: 'bytes32' },
      ],
    },
    primaryType: 'TransferWithAuthorization',
    message: {
      from,
      to: requirement.payTo,
      value: BigInt(requirement.amount),
      // Match the reference v1 EVM client exactly. The generous backdate
      // tolerates payer/server clock skew; the expiry is bounded by the terms
      // the server published rather than silently extending them.
      validAfter: seconds - BigInt(600),
      validBefore: seconds + BigInt(requirement.maxTimeoutSeconds),
      nonce: randomNonce(),
    },
  }
}

/** The base64 PAYMENT-SIGNATURE header. BigInts cross as decimal strings. */
export function encodePaymentSignature(
  requirement: PaymentRequirement,
  message: TransferAuthorization,
  signature: string,
  challenge?: Pick<PaymentChallenge, 'resource' | 'extensions'>,
): string {
  return toBase64(JSON.stringify({
    x402Version: 2,
    ...(challenge?.resource ? { resource: challenge.resource } : {}),
    accepted: requirement,
    payload: {
      signature,
      authorization: {
        from: message.from,
        to: message.to,
        value: String(message.value),
        validAfter: String(message.validAfter),
        validBefore: String(message.validBefore),
        nonce: message.nonce,
      },
    },
    ...(challenge?.extensions ? { extensions: challenge.extensions } : {}),
  }))
}

export function decodeReceipt(header: string | null): { success: boolean; transaction?: string; network?: string; payer?: string } | null {
  if (!header?.trim()) return null
  try { return JSON.parse(fromBase64(header.trim())) } catch { return null }
}

// ---------------------------------------------------------------------------
// The handshake
// ---------------------------------------------------------------------------

export type PaidFetchOptions = {
  /** Prompts the wallet. wagmi's `signTypedDataAsync` fits without adaptation. */
  signTypedData: TypedDataSigner
  /** The connected account. Signing for anyone else produces a useless signature. */
  address: string | undefined
  /** The chain the wallet is currently on, which the requirement must match. */
  chainId: number | undefined
  /** Called once terms and the fresh authorization nonce are known, before the
   * wallet is prompted. It may perform an asynchronous policy-ledger reserve. */
  onPaymentRequired?: (
    requirement: PaymentRequirement,
    context: { challenge: PaymentChallenge; authorization: TransferAuthorization },
  ) => void | Promise<void>
  /** Called with the settlement receipt when the retry is served. */
  onSettled?: (receipt: { success: boolean; transaction?: string }) => void
  fetchImpl?: typeof fetch
}

export type PaidResponse = Response & { x402?: { requirement: PaymentRequirement; receipt: ReturnType<typeof decodeReceipt> } }

/**
 * A `fetch` that answers a 402 by paying once, then asks again.
 *
 * Exactly once. A loop here would prompt a wallet repeatedly and could settle
 * several payments for one resource, so a 402 on the retry is reported rather
 * than answered.
 */
export function createPaidFetch(options: PaidFetchOptions) {
  const request = options.fetchImpl ?? globalThis.fetch

  return async function paidFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<PaidResponse> {
    // The body has to survive being sent twice. A stream cannot be replayed, so
    // it is read into memory before the first attempt rather than discovered to
    // be spent at the point of retry -- after the wallet has already signed.
    const body = init.body instanceof ReadableStream ? await new Response(init.body).arrayBuffer() : init.body
    const first = await request(input, { ...init, body: body as BodyInit | null | undefined })
    if (first.status !== 402) return first

    const challenge = decodeChallenge(first.headers.get(PAYMENT_REQUIRED_HEADER))

    if (!options.address) {
      throw new X402PaymentError('wallet_not_connected', 'Connect a wallet to pay for this request.')
    }
    if (options.chainId === undefined) {
      throw new X402PaymentError('wallet_not_connected', 'The connected wallet did not report a network.')
    }

    const requirement = selectRequirement(challenge, options.chainId)
    if (!requirement) {
      const offered = challenge.accepts.map((accept) => accept.network).join(', ')
      const wanted = challenge.accepts.map((accept) => NETWORK_CHAIN_IDS[accept.network]).filter(Boolean)
      throw new X402PaymentError(
        wanted.length > 0 ? 'wrong_network' : 'no_supported_requirement',
        wanted.length > 0
          ? `This resource is sold on ${offered}. Switch the wallet to chain ${wanted.join(' or ')} and try again.`
          : `This resource is sold on ${offered}, which this client cannot pay on.`,
      )
    }

    const typedData = buildTypedData(requirement, options.address)
    await options.onPaymentRequired?.(requirement, { challenge, authorization: typedData.message })
    let signature: string
    try {
      signature = await options.signTypedData(typedData)
    } catch (cause) {
      // A declined prompt is an ordinary outcome, not a fault. Nothing was
      // spent, so it is reported as such.
      throw new X402PaymentError('signature_rejected', 'The payment was not signed.', { requirement, cause })
    }

    const paid = await request(input, {
      ...init,
      body: body as BodyInit | null | undefined,
      headers: { ...headersToObject(init.headers), [PAYMENT_SIGNATURE_HEADER]: encodePaymentSignature(requirement, typedData.message, signature, challenge) },
    })

    if (paid.ok) {
      const receipt = decodeReceipt(paid.headers.get(PAYMENT_RESPONSE_HEADER))
      if (receipt) options.onSettled?.(receipt)
      return Object.assign(paid, { x402: { requirement, receipt } })
    }

    throw await refusalFor(paid, requirement, typedData.message)
  }
}

/**
 * Turns the seller's refusal into something a person can act on.
 *
 * `settled` is the part that matters. After a wallet prompt the only question
 * worth answering is whether money moved, and the status codes differ on
 * exactly that: a duplicate means an earlier payment succeeded, while a ledger
 * failure means this one never settled and retrying is free.
 */
async function refusalFor(
  response: Response,
  requirement: PaymentRequirement,
  authorization?: TransferAuthorization,
): Promise<X402PaymentError> {
  const body = await response.json().catch(() => ({})) as {
    error?: string | { code?: string; message?: string }
    message?: string
    reason?: string
  }
  const code = typeof body.error === 'object' ? body.error?.code : undefined
  const providerMessage = redactProviderMessage(
    (typeof body.error === 'string' ? body.error : body.error?.message) ?? body.message ?? body.reason,
  )
  const context = { requirement, authorization }

  if (response.status === 409) {
    // Mapped by the server's error code, not by the status alone. The route
    // returns 409 for several unrelated conditions, and flattening them all to
    // "the authorization has been spent" told a payer whose request hash
    // disagreed that their money was gone -- which sent a Production
    // investigation down the wrong path for a day. The status says a conflict
    // occurred; only the code says which.
    if (code === 'input_hash_mismatch') {
      return new X402PaymentError('input_hash_mismatch', providerMessage
        ?? 'The request body does not hash to the declared x-maha-input-hash. Send the body that hashes to it, or use a new idempotency key.',
        { ...context, status: 409, settled: true })
    }
    if (code === 'idempotency_key_mismatch') {
      return new X402PaymentError('idempotency_key_mismatch', providerMessage
        ?? 'x-maha-idempotency-key must equal clientRequestId.', { ...context, status: 409, settled: true })
    }
    if (code === 'idempotency_conflict') {
      return new X402PaymentError('idempotency_conflict', providerMessage
        ?? 'This idempotency key was already used with different input.', { ...context, status: 409, settled: true })
    }
    return new X402PaymentError('payment_already_used', 'Payment already used. This authorization has been spent; a new payment is needed for another request.', { ...context, status: 409, settled: true })
  }
  if (response.status === 503) {
    return new X402PaymentError('ledger_unavailable', 'Ledger unavailable, funds were not settled. Nothing was charged — try again shortly.', { ...context, status: 503, settled: false })
  }
  if (response.status === 429) {
    return new X402PaymentError('resource_at_capacity', 'The resource is at capacity. The payment was accepted and is not consumed by retrying.', { ...context, status: 429, settled: true })
  }
  // A second 402 means the facilitator refused the payment we just signed.
  // Its own reason is far more useful than a generic failure.
  const reason = providerMessage ?? challengeReason(response) ?? undefined
  return new X402PaymentError('payment_rejected', reason ?? `The payment was refused (${code ?? response.status}).`, {
    ...context,
    status: response.status,
    settled: false,
    providerReason: reason,
  })
}

function redactProviderMessage(message: string | undefined): string | undefined {
  return message?.replace(
    /https:\/\/(?:discord(?:app)?\.com)\/api\/webhooks\/[^\s"'<>]+/gi,
    '[Discord webhook redacted]',
  )
}

function challengeReason(response: Response): string | null {
  try {
    return decodeChallenge(response.headers.get(PAYMENT_REQUIRED_HEADER)).error ?? null
  } catch { return null }
}

function headersToObject(headers: HeadersInit | undefined): Record<string, string> {
  if (!headers) return {}
  if (headers instanceof Headers) return Object.fromEntries(headers.entries())
  if (Array.isArray(headers)) return Object.fromEntries(headers)
  return { ...headers }
}
