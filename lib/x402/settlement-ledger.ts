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
 * Settlement is not delivery. On-chain evidence establishes a transfer, not
 * discovery or an endpoint call. It does not establish that any buyer
 * received a correct deliverable — that would need internal response telemetry.
 * The distinction is carried in the type, so a renderer cannot present one as
 * the other by omission.
 */

export type LedgerEntry = {
  /** Transfer log identity; absent only in older bundled snapshots. */
  logIndex?: number
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
  product: {
    id: string
    title: string
    /** The product's current price, which a superseded settlement will not equal. */
    priceUsdc: string
    /** Set when this settlement was made at a price the product has since left. */
    settledAtSupersededPrice?: true
  } | null
  /**
   * How `product` was decided. Present on receipt-aware ledgers (schema 1.1);
   * absent on 1.0 ledgers, which attribute by amount alone.
   */
  attribution?: EntryAttribution
  explorerUrl: string
}

/**
 * Why a receipt did not attribute a row. Each leaves the row unattributed:
 * conflicting evidence is reported, never resolved by picking a side.
 */
export type AttributionIssue =
  | 'receipt_duplicated'
  | 'receipt_for_external_payer'
  | 'receipt_multiple_transfer_logs'
  | 'receipt_unknown_offer'
  | 'receipt_amount_mismatch'

export type EntryAttribution = {
  /**
   * `amount-match`: the settled amount identifies exactly one offer.
   * `operator-receipt`: our own canary receipt names the offer for this
   * transaction. `unattributed`: neither, or the evidence conflicts.
   */
  method: 'amount-match' | 'operator-receipt' | 'unattributed'
  /**
   * What the amount alone identifies, whatever the method. Kept beside a
   * receipt attribution so the correction stays inspectable.
   */
  amountIndicates: string | null
  /** More than one offer claims this amount. */
  amountAmbiguous?: true
  /** The receipt's recorded evidence, when a receipt attributed the row. */
  receiptSource?: string
  /** Set when a receipt names this transaction but could not be applied. */
  issue?: AttributionIssue
}

/** The receipts a 1.1 ledger was built with, and what did not bind. */
export type LedgerAttribution = {
  policy: 'amount-match-with-operator-receipts/1'
  receipts: OperatorSettlementReceipt[]
  issues: { transactionHash: string; issue: AttributionIssue }[]
  /** Receipts whose transaction is not in the scanned rows. */
  unobservedReceipts: string[]
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
  byProduct: {
    id: string
    title: string
    priceUsdc: string
    /** Prices this product has left, when it has changed price. */
    supersededPricesUsdc?: string[]
    settlements: number
    externalSettlements: number
    /** The current price is shared, so none of these counts can be trusted. */
    attributionAmbiguous?: true
    /**
     * A price this product has left is also claimed by another offer, so the
     * part of its history settled at that amount is unattributable. The counts
     * remain exact for everything settled at the current price.
     */
    supersededPriceAmbiguous?: true
  }[]
  /** Receipt-aware ledgers only: operator rows attributed from a receipt. */
  receiptAttributedSettlements?: number
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
  /** Receipt-aware ledgers only. See OPERATOR_SETTLEMENT_RECEIPTS. */
  attribution?: LedgerAttribution
  boundaries: string[]
}

import { createHash } from 'node:crypto'

import type { OperatorSettlementReceipt } from './operator-settlement-receipts.ts'

const USDC_DECIMALS = 6

/**
 * Stable across scans that found the same settlements.
 *
 * Keys are sorted so the digest tracks content rather than serialisation order,
 * and observedAt and the block range are excluded because they move on every
 * run whether or not anything happened.
 */
function contentDigestOf(entries: readonly LedgerEntry[], summary: LedgerSummary, attribution?: LedgerAttribution): string {
  const stable = (value: unknown): string => {
    if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null'
    if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`
    return `{${Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([k, v]) => `${JSON.stringify(k)}:${stable(v)}`).join(',')}}`
  }
  return `sha256:${createHash('sha256').update(stable(attribution ? { entries, summary, attribution } : { entries, summary }), 'utf8').digest('hex')}`
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

export type OfferPrice = {
  id: string
  title: string
  /** What the product settles at now. */
  amountBaseUnits: bigint
  /**
   * Amounts this product used to settle at.
   *
   * A product's price can change, and the chain keeps every settlement made at
   * the old one. Attributing by the current amount alone would drop that
   * history: raising the context compiler from $0.001 to $0.002 would have
   * removed fifteen settlements, eight of them external, from a ledger that had
   * twenty-six, because a transfer at a no-longer-published price stopped
   * matching any offer and fell out of the priced set entirely.
   */
  supersededAmountsBaseUnits?: readonly bigint[]
}

export function buildLedger(input: {
  settlements: readonly { payer: string; amountBaseUnits: bigint; blockNumber: bigint; transactionHash: string; timestampUtc?: string | null; logIndex?: number }[]
  operatorWallets: readonly string[]
  offers: readonly OfferPrice[]
  observedAt: string
  fromBlock: bigint
  toBlock: bigint
  explorerBase?: string
  /**
   * Operator receipts (lib/x402/operator-settlement-receipts.ts). Omitted, the
   * ledger is the amount-only 1.0 ledger, byte for byte, so snapshots saved
   * before receipts existed still validate. Supplied, even empty, it is 1.1.
   */
  operatorReceipts?: readonly OperatorSettlementReceipt[]
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
  const amountsOf = (o: OfferPrice) => [...new Set([o.amountBaseUnits, ...(o.supersededAmountsBaseUnits ?? [])])]
  const priceCounts = new Map<bigint, number>()
  for (const o of input.offers) for (const a of amountsOf(o)) priceCounts.set(a, (priceCounts.get(a) ?? 0) + 1)
  const byPrice = new Map<bigint, OfferPrice>()
  for (const o of input.offers) for (const a of amountsOf(o)) if (priceCounts.get(a) === 1) byPrice.set(a, o)
  const ambiguousPrices = [...priceCounts].filter(([, n]) => n > 1).map(([price]) => price)

  const receiptAware = input.operatorReceipts !== undefined
  const offersById = new Map(input.offers.map((o) => [o.id, o]))
  const receiptsByHash = new Map<string, OperatorSettlementReceipt[]>()
  for (const r of input.operatorReceipts ?? []) {
    const hash = r.transactionHash.toLowerCase()
    receiptsByHash.set(hash, [...(receiptsByHash.get(hash) ?? []), r])
  }
  const logsByHash = new Map<string, number>()
  for (const s of input.settlements) logsByHash.set(s.transactionHash.toLowerCase(), (logsByHash.get(s.transactionHash.toLowerCase()) ?? 0) + 1)
  const issues: LedgerAttribution['issues'] = []

  /**
   * A receipt binds to one Transfer: one receipt for the transaction, one log
   * in it, an operator payer, an offer in this catalogue and the settled
   * amount. The first failed condition is the reason recorded.
   */
  const resolveReceipt = (s: (typeof input.settlements)[number], payer: string): { offer: OfferPrice; receipt: OperatorSettlementReceipt } | { issue: AttributionIssue } | null => {
    const hash = s.transactionHash.toLowerCase()
    const named = receiptsByHash.get(hash)
    if (!named) return null
    if (named.length > 1) return { issue: 'receipt_duplicated' }
    const [receipt] = named
    if (!operators.has(payer)) return { issue: 'receipt_for_external_payer' }
    if ((logsByHash.get(hash) ?? 0) > 1) return { issue: 'receipt_multiple_transfer_logs' }
    const offer = offersById.get(receipt.offerId)
    if (!offer) return { issue: 'receipt_unknown_offer' }
    if (!/^[1-9]\d*$/.test(receipt.amountBaseUnits) || BigInt(receipt.amountBaseUnits) !== s.amountBaseUnits) return { issue: 'receipt_amount_mismatch' }
    return { offer, receipt }
  }

  const entries: LedgerEntry[] = input.settlements.map((s) => {
    const payer = s.payer.toLowerCase()
    const amountOffer = byPrice.get(s.amountBaseUnits)
    const resolved = receiptAware ? resolveReceipt(s, payer) : null
    if (resolved && 'issue' in resolved) issues.push({ transactionHash: s.transactionHash.toLowerCase(), issue: resolved.issue })
    const bound = resolved && 'offer' in resolved ? resolved : null
    // Conflicting receipt evidence is not overruled by the amount: the row is
    // left unattributed rather than credited to either candidate.
    const offer = bound ? bound.offer : resolved ? undefined : amountOffer
    const attribution: EntryAttribution | undefined = receiptAware
      ? {
          method: bound ? 'operator-receipt' : offer ? 'amount-match' : 'unattributed',
          amountIndicates: amountOffer?.id ?? null,
          ...(ambiguousPrices.includes(s.amountBaseUnits) ? { amountAmbiguous: true as const } : {}),
          ...(bound ? { receiptSource: bound.receipt.source } : {}),
          ...(resolved && 'issue' in resolved ? { issue: resolved.issue } : {}),
        }
      : undefined
    return {
      transactionHash: s.transactionHash,
      ...(s.logIndex === undefined ? {} : { logIndex: s.logIndex }),
      blockNumber: s.blockNumber.toString(),
      timestampUtc: s.timestampUtc ?? null,
      payer,
      payerDisplay: truncateAddress(payer),
      payerRole: (operators.has(payer) ? 'maha-canary-test' : 'external-machine-agent') as LedgerEntry['payerRole'],
      amountBaseUnits: s.amountBaseUnits.toString(),
      amountUsdc: formatUsdc(s.amountBaseUnits),
      product: offer
        ? {
            id: offer.id,
            title: offer.title,
            priceUsdc: formatUsdc(offer.amountBaseUnits),
            // Flagged, because the row would otherwise show a current price
            // beside an amount that no longer equals it and read as an error.
            ...((bound ? s.amountBaseUnits !== offer.amountBaseUnits : (offer.supersededAmountsBaseUnits ?? []).includes(s.amountBaseUnits))
              ? { settledAtSupersededPrice: true as const }
              : {}),
          }
        : null,
      ...(attribution ? { attribution } : {}),
      explorerUrl: `${explorerBase}${s.transactionHash}`,
    }
  }).sort((a, b) => (BigInt(b.blockNumber) > BigInt(a.blockNumber) ? 1 : BigInt(b.blockNumber) < BigInt(a.blockNumber) ? -1 : a.transactionHash.localeCompare(b.transactionHash) || (a.logIndex ?? -1) - (b.logIndex ?? -1)))

  const pricedAmounts = new Set(input.offers.flatMap(amountsOf))
  // A receipt-attributed row is a settlement for a named product even when no
  // offer charges its amount today. Every row is still counted exactly once.
  const isPriced = (e: LedgerEntry) => e.attribution?.method === 'operator-receipt' || pricedAmounts.has(BigInt(e.amountBaseUnits))
  // A receipt can only ever bind an operator payment, so external figures are
  // computed from exactly the rows they were computed from before receipts.
  const external = entries.filter((e) => e.payerRole === 'external-machine-agent' && isPriced(e))
  const walletPrices = new Map<string, Set<string>>()
  const walletCounts = new Map<string, number>()
  for (const e of external) {
    walletCounts.set(e.payer, (walletCounts.get(e.payer) ?? 0) + 1)
    walletPrices.set(e.payer, (walletPrices.get(e.payer) ?? new Set()).add(e.amountBaseUnits))
  }

  const byProduct = input.offers.map((offer) => {
    const ambiguous = ambiguousPrices.includes(offer.amountBaseUnits)
    // A shared current price hides amount-matched counts, but a receipt names
    // this offer exactly, so those rows still count here and nowhere else.
    const all = entries.filter((e) => e.product?.id === offer.id && (!ambiguous || e.attribution?.method === 'operator-receipt'))
    return {
      id: offer.id,
      title: offer.title,
      priceUsdc: formatUsdc(offer.amountBaseUnits),
      ...((offer.supersededAmountsBaseUnits ?? []).length > 0
        ? { supersededPricesUsdc: amountsOf(offer).filter((a) => a !== offer.amountBaseUnits).map(formatUsdc) }
        : {}),
      // A contested *historical* amount is reported separately from a contested
      // current one. Flagging the whole product ambiguous would be an
      // overstatement and would zero counts that are attributed correctly:
      // sales at the current price are still exact. What is lost is the part of
      // the history settled at an amount another offer also claims.
      ...(!ambiguous && (offer.supersededAmountsBaseUnits ?? []).some((a) => ambiguousPrices.includes(a))
        ? { supersededPriceAmbiguous: true as const }
        : {}),
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
      ...(receiptAware ? { receiptAttributedSettlements: entries.filter((e) => e.attribution?.method === 'operator-receipt').length } : {}),
  }

  const observedHashes = new Set(input.settlements.map((s) => s.transactionHash.toLowerCase()))
  const attribution: LedgerAttribution | undefined = receiptAware
    ? {
        policy: 'amount-match-with-operator-receipts/1',
        receipts: [...(input.operatorReceipts ?? [])].map((r) => ({ ...r, publishedPrice: { ...r.publishedPrice } }))
          .sort((a, b) => a.transactionHash.toLowerCase().localeCompare(b.transactionHash.toLowerCase()) || a.offerId.localeCompare(b.offerId)),
        issues: issues.sort((a, b) => a.transactionHash.localeCompare(b.transactionHash) || a.issue.localeCompare(b.issue)),
        unobservedReceipts: [...receiptsByHash.keys()].filter((hash) => !observedHashes.has(hash)).sort(),
      }
    : undefined

  return {
    schemaVersion: receiptAware ? 'maha-x402-settlement-ledger/1.1' : 'maha-x402-settlement-ledger/1.0',
    contentDigest: receiptAware ? contentDigestOf(entries, summary, attribution) : contentDigestOf(entries, summary),
    network: 'Base Mainnet',
    protocol: 'HTTP 402 v2 · Base USDC',
    observedAt: input.observedAt,
    scannedFromBlock: input.fromBlock.toString(),
    scannedToBlock: input.toBlock.toString(),
    summary,
    entries,
    ...(attribution ? { attribution } : {}),
    boundaries: [
      'Settlement is not delivery. These rows establish USDC transfers; price matches alone do not prove a particular endpoint was called, how it was discovered, or whether a buyer received or accepted the payload. Product attribution is inferred from price where unambiguous.',
      'Operator-controlled wallets are labelled and excluded from every external figure. Canary traffic converts by construction and is not demand.',
      ...(receiptAware ? ['A few operator test payments made while two offers shared a price are attributed from our own canary receipts instead of the amount. Each such row records the receipt source and what the amount alone would have indicated, and cannot be recomputed from the chain alone. Receipts never apply to external payers, and conflicting receipt evidence leaves a row unattributed.'] : []),
      'Counts cover the scanned block range only. A payer whose settlements straddle the range boundary reads as fewer settlements than they made.',
      'Counterparty addresses are truncated by convention. The full address is one click away on the block explorer; nothing here is concealed.',
    ],
  }
}
