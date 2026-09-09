import { CELESTIAL_PRODUCTS, type CelestialProductId } from './celestial-products.ts'

export type CalculationSettlement = {
  // These fields come from the gateway's settlement ledger, never buyer headers.
  transaction: string
  payer: string
  resource: string
  amount: string
  status: 'confirmed' | 'unconfirmed' | 'failed'
}

/** No amount-only attribution: these tiers share prices with existing offers. */
export function summarizeCalculationDemand(rows: readonly CalculationSettlement[], classification: {
  operatorWallets: readonly string[]
  publisherFundedTransactions: readonly string[]
}) {
  const operators = new Set(classification.operatorWallets.map(v => v.toLowerCase()))
  const funded = new Set(classification.publisherFundedTransactions.map(v => v.toLowerCase()))
  const grouped = new Map<string, CalculationSettlement[]>()
  for (const row of rows) {
    const key = row.transaction.toLowerCase()
    grouped.set(key, [...(grouped.get(key) ?? []), row])
  }
  let excluded = 0
  const confirmed: { id: CelestialProductId; payer: string; canary: boolean; amount: bigint }[] = []
  for (const candidates of grouped.values()) {
    const signatures = new Set(candidates.map(row => JSON.stringify({ ...row, transaction: row.transaction.toLowerCase(), payer: row.payer.toLowerCase() })))
    const row = candidates[0]
    if (signatures.size !== 1 || row.status !== 'confirmed' || !/^0x[a-f0-9]{64}$/i.test(row.transaction) || !/^0x[a-f0-9]{40}$/i.test(row.payer)) { excluded++; continue }
    const id = (Object.keys(CELESTIAL_PRODUCTS) as CelestialProductId[]).find(id => row.resource === `https://www.mahastrategies.com${CELESTIAL_PRODUCTS[id].path}`)
    if (!id || row.amount !== CELESTIAL_PRODUCTS[id].amount) { excluded++; continue }
    confirmed.push({ id, payer: row.payer.toLowerCase(), amount: BigInt(row.amount), canary: operators.has(row.payer.toLowerCase()) || funded.has(row.transaction.toLowerCase()) })
  }
  return {
    byOffer: (Object.keys(CELESTIAL_PRODUCTS) as CelestialProductId[]).map(offerId => {
      const external = confirmed.filter(row => row.id === offerId && !row.canary)
      const counts = new Map<string, number>()
      for (const row of external) counts.set(row.payer, (counts.get(row.payer) ?? 0) + 1)
      return { offerId, externalSettlements: external.length, externalWallets: counts.size,
        repeatExternalWallets: [...counts.values()].filter(count => count > 1).length,
        externalAmountBaseUnits: external.reduce((sum, row) => sum + row.amount, BigInt(0)).toString(),
        publisherFundedCanaries: confirmed.filter(row => row.id === offerId && row.canary).length }
    }),
    excludedRecords: excluded,
    boundary: 'Confirmed gateway-attributed settlements only. External means outside the supplied operator/funding inventory, not a verified customer identity. Settlement is not delivery, satisfaction, or organic discovery. Keep the funding inventory complete.',
  }
}
