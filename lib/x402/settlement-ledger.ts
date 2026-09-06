/**
 * The public settlement ledger: what settled on Base, and what that does and
 * does not prove.
 *
 * This is a cumulative audit trail rather than a live ticker, and the choice is
 * substantive. A ticker promises velocity; at roughly one settlement every
 * three days it would usually sit idle, and an idle ticker reads as a dead
 * product. A ledger that accumulates reads as a registry, which is what this is.
 *
 * Every figure is derived from the settlement rows. None is written down. A
 * hardcoded headline is a claim the moment the chain moves past it, and this
 * page exists to be checkable.
 *
 * Two boundaries are structural rather than editorial.
 *
 * Operator wallets are labelled and excluded from every external figure. Canary
 * traffic converts by construction and is not demand; a ledger that blended
 * them would overstate the only number a reader cares about.
 *
 * Settlement is not delivery. On-chain evidence establishes discovery, a call,
 * and a transfer at a published price. It does not establish that any buyer
 * received a correct deliverable — that would need internal response telemetry.
 * The distinction is carried in the type, so a renderer cannot present one as
 * the other by omission.
 */

export type LedgerEntry = {
  /** Full hash, for the explorer link. Addresses are truncated for display. */
  transactionHash: string
  blockNumber: string
  timestampUtc: string | null
  payer: string
  payerDisplay: string
  payerRole: 'external-machine-agent' | 'maha-canary-test'
  amountBaseUnits: string
  amountUsdc: string
  /** The offer whose published price this transfer matches, if any. */
  product: { id: string; title: string; priceUsdc: string } | null
  explorerUrl: string
}

export type LedgerSummary = {
  totalSettlements: number
  externalSettlements: number
  canarySettlements: number
  externalWallets: number
  repeatExternalWallets: number
  /** External wallets that paid at more than one published price. */
  crossProductWallets: number
  externalValueUsdc: string
  byProduct: { id: string; title: string; priceUsdc: string; settlements: number; externalSettlements: number; attributionAmbiguous?: true }[]
}

export type SettlementLedger = {
  schemaVersion: string
  /**
   * Digest of the settlements and the figures derived from them, excluding
   * observedAt and the scanned block range.
   *
   * Those two move on every scan even when nothing settled, so a plain file
   * diff would report a change twice a day forever. Each such commit lands on
   * main and starts a production build. This digest changes only when the
   * ledger actually moved, which is the condition worth spending a build on.
   */
  contentDigest: string
  network: string
  protocol: string
  observedAt: string
  scannedFromBlock: string
  scannedToBlock: string
  summary: LedgerSummary
  entries: LedgerEntry[]
  boundaries: string[]
}

import { createHash } from 'node:crypto'

const USDC_DECIMALS = 6

/**
 * Stable across scans that found the same settlements.
 *
 * Keys are sorted so the digest tracks content rather than serialisation order,
 * and observedAt and the block range are excluded because they move on every
 * run whether or not anything happened.
 */
function contentDigestOf(entries: readonly LedgerEntry[], summary: LedgerSummary): string {
  const stable = (value: unknown): string => {
    if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null'
    if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`
    return `{${Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([k, v]) => `${JSON.stringify(k)}:${stable(v)}`).join(',')}}`
  }
  return `sha256:${createHash('sha256').update(stable({ entries, summary }), 'utf8').digest('hex')}`
}

export function formatUsdc(baseUnits: bigint): string {
  const whole = baseUnits / BigInt(10 ** USDC_DECIMALS)
  const frac = (baseUnits % BigInt(10 ** USDC_DECIMALS)).toString().padStart(USDC_DECIMALS, '0').replace(/0+$/, '')
  return frac ? `${whole}.${frac}` : `${whole}`
}

/**
 * `0x7a3f…b89c`. Truncation is the convention every explorer and dashboard
 * uses, and it is the right default here for a reason beyond convention: these
 * counterparties did not ask to be named in a promotional page. The full
 * address remains one click away on the explorer, so nothing is concealed.
 */
export function truncateAddress(address: string): string {
  const a = address.toLowerCase()
  return a.length <= 12 ? a : `${a.slice(0, 6)}…${a.slice(-4)}`
}

export type OfferPrice = { id: string; title: string; amountBaseUnits: bigint }

export function buildLedger(input: {
  settlements: readonly { payer: string; amountBaseUnits: bigint; blockNumber: bigint; transactionHash: string; timestampUtc?: string | null }[]
  operatorWallets: readonly string[]
  offers: readonly OfferPrice[]
  observedAt: string
  fromBlock: bigint
  toBlock: bigint
  explorerBase?: string
}): SettlementLedger {
  const explorerBase = input.explorerBase ?? 'https://basescan.org/tx/'
  const operators = new Set(input.operatorWallets.map((w) => w.toLowerCase()))
  /**
   * Price to product, and the prices that cannot identify one.
   *
   * A transfer carries an amount, not an offer id. While every published price
   * is distinct that is enough to attribute a settlement; with seven products
   * it stops being safe, because two offers at the same price make the amount
   * ambiguous and a Map would silently return whichever was inserted last.
   * Misattributed revenue is worse than unattributed revenue, so a shared price
   * resolves to null and the row shows the amount without naming a product.
   */
  const priceCounts = new Map<bigint, number>()
  for (const o of input.offers) priceCounts.set(o.amountBaseUnits, (priceCounts.get(o.amountBaseUnits) ?? 0) + 1)
  const byPrice = new Map(
    input.offers.filter((o) => priceCounts.get(o.amountBaseUnits) === 1).map((o) => [o.amountBaseUnits, o]))
  const ambiguousPrices = [...priceCounts].filter(([, n]) => n > 1).map(([price]) => price)

  const entries: LedgerEntry[] = input.settlements.map((s) => {
    const payer = s.payer.toLowerCase()
    const offer = byPrice.get(s.amountBaseUnits)
    return {
      transactionHash: s.transactionHash,
      blockNumber: s.blockNumber.toString(),
      timestampUtc: s.timestampUtc ?? null,
      payer,
      payerDisplay: truncateAddress(payer),
      payerRole: (operators.has(payer) ? 'maha-canary-test' : 'external-machine-agent') as LedgerEntry['payerRole'],
      amountBaseUnits: s.amountBaseUnits.toString(),
      amountUsdc: formatUsdc(s.amountBaseUnits),
      product: offer ? { id: offer.id, title: offer.title, priceUsdc: formatUsdc(offer.amountBaseUnits) } : null,
      explorerUrl: `${explorerBase}${s.transactionHash}`,
    }
  }).sort((a, b) => (BigInt(b.blockNumber) > BigInt(a.blockNumber) ? 1 : BigInt(b.blockNumber) < BigInt(a.blockNumber) ? -1 : a.transactionHash.localeCompare(b.transactionHash)))

  const pricedAmounts = new Set(input.offers.map((o) => o.amountBaseUnits))
  const isPriced = (e: LedgerEntry) => pricedAmounts.has(BigInt(e.amountBaseUnits))
  const external = entries.filter((e) => e.payerRole === 'external-machine-agent' && isPriced(e))
  const walletPrices = new Map<string, Set<string>>()
  const walletCounts = new Map<string, number>()
  for (const e of external) {
    walletCounts.set(e.payer, (walletCounts.get(e.payer) ?? 0) + 1)
    walletPrices.set(e.payer, (walletPrices.get(e.payer) ?? new Set()).add(e.amountBaseUnits))
  }

  const byProduct = input.offers.map((offer) => {
    const ambiguous = ambiguousPrices.includes(offer.amountBaseUnits)
    const all = ambiguous ? [] : entries.filter((e) => e.product?.id === offer.id)
    return {
      id: offer.id,
      title: offer.title,
      priceUsdc: formatUsdc(offer.amountBaseUnits),
      settlements: all.length,
      externalSettlements: all.filter((e) => e.payerRole === 'external-machine-agent').length,
      // Set when another offer publishes the same price, so a reader is told
      // the split is unknown rather than shown a confident wrong number.
      ...(ambiguous ? { attributionAmbiguous: true as const } : {}),
    }
  }).sort((a, b) => a.id.localeCompare(b.id))

  const externalValue = external.reduce((sum, e) => sum + BigInt(e.amountBaseUnits), BigInt(0))

  const summary = {
      totalSettlements: entries.filter(isPriced).length,
      externalSettlements: external.length,
      canarySettlements: entries.filter((e) => e.payerRole === 'maha-canary-test' && isPriced(e)).length,
      externalWallets: walletCounts.size,
      repeatExternalWallets: [...walletCounts.values()].filter((n) => n > 1).length,
      crossProductWallets: [...walletPrices.values()].filter((s) => s.size > 1).length,
      externalValueUsdc: formatUsdc(externalValue),
      byProduct,
  }

  return {
    schemaVersion: 'maha-x402-settlement-ledger/1.0',
    contentDigest: contentDigestOf(entries, summary),
    network: 'Base Mainnet',
    protocol: 'HTTP 402 v2 · Base USDC',
    observedAt: input.observedAt,
    scannedFromBlock: input.fromBlock.toString(),
    scannedToBlock: input.toBlock.toString(),
    summary,
    entries,
    boundaries: [
      'Settlement is not delivery. These rows establish discovery, a call, and a transfer at a published price. They do not establish that any buyer received or accepted a correct deliverable; that would require internal response telemetry.',
      'Operator-controlled wallets are labelled and excluded from every external figure. Canary traffic converts by construction and is not demand.',
      'Counts cover the scanned block range only. A payer whose settlements straddle the range boundary reads as fewer settlements than they made.',
      'Counterparty addresses are truncated by convention. The full address is one click away on the block explorer; nothing here is concealed.',
    ],
  }
}
