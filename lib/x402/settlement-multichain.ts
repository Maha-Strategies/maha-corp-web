import { createHash } from 'node:crypto'
import { formatUsdc, type SettlementLedger } from './settlement-ledger.ts'

/** Read projection only. Cursors and persistence always remain chain-specific. */
export function combineSettlementLedgers(ledgers: SettlementLedger[]): SettlementLedger {
  if (!ledgers.length) throw new Error('no_settlement_ledgers')
  if (new Set(ledgers.map(ledger => ledger.caip2Network ?? 'eip155:8453')).size !== ledgers.length) throw new Error('duplicate_ledger_network')
  const entries = ledgers.flatMap(ledger => ledger.entries.map(row => ({ ...row, caip2Network: ledger.caip2Network ?? 'eip155:8453' })))
    .sort((a, b) => (b.timestampUtc ?? '').localeCompare(a.timestampUtc ?? '') || a.caip2Network.localeCompare(b.caip2Network) || a.transactionHash.localeCompare(b.transactionHash))
  const offers = new Map<string, SettlementLedger['summary']['byProduct'][number]>()
  for (const ledger of ledgers) for (const offer of ledger.summary.byProduct) {
    const previous = offers.get(offer.id)
    if (previous && previous.priceUsdc !== offer.priceUsdc) throw new Error('multichain_price_contradiction')
    offers.set(offer.id, previous ? { ...previous, settlements: previous.settlements + offer.settlements,
      externalSettlements: previous.externalSettlements + offer.externalSettlements } : { ...offer })
  }
  const prices = new Set([...offers.values()].flatMap(offer => [offer.priceUsdc, ...(offer.supersededPricesUsdc ?? [])]))
  const external = entries.filter(row => row.payerRole === 'external-machine-agent' && prices.has(row.amountUsdc))
  const wallets = new Map<string, typeof external>()
  for (const row of external) wallets.set(row.payer, [...(wallets.get(row.payer) ?? []), row])
  const sum = (field: 'totalSettlements' | 'externalSettlements' | 'canarySettlements' | 'receiptAttributedSettlements') => ledgers.reduce((total, ledger) => total + (ledger.summary[field] ?? 0), 0)
  const summary = { totalSettlements: sum('totalSettlements'), externalSettlements: sum('externalSettlements'), canarySettlements: sum('canarySettlements'),
    externalWallets: wallets.size, repeatExternalWallets: [...wallets.values()].filter(rows => rows.length > 1).length,
    crossProductWallets: [...wallets.values()].filter(rows => new Set(rows.map(row => row.amountBaseUnits)).size > 1).length,
    externalValueUsdc: formatUsdc(external.reduce((total, row) => total + BigInt(row.amountBaseUnits), BigInt(0))),
    byProduct: [...offers.values()].sort((a, b) => a.id.localeCompare(b.id)), receiptAttributedSettlements: sum('receiptAttributedSettlements') }
  const observedAt = ledgers.map(ledger => ledger.observedAt).sort()[0]
  return { ...ledgers[0], caip2Network: undefined, schemaVersion: 'maha-x402-settlement-ledger/2.0-view', network: 'Base Mainnet + Arbitrum One', protocol: 'HTTP 402 v2 · native USDC',
    contentDigest: 'sha256:' + createHash('sha256').update(JSON.stringify({ entries, summary })).digest('hex'),
    // Block ranges are not comparable across chains; inspect the per-network view.
    scannedFromBlock: '0', scannedToBlock: '0', observedAt, entries, summary, attribution: undefined,
    boundaries: [...new Set(ledgers.flatMap(ledger => ledger.boundaries)), 'Each chain has its own finalized cursor, scan range and refresh status. Combined counts do not imply cross-chain bridging.'] }
}
