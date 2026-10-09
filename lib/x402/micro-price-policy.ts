/** Prevent new-cohort prices from colliding with other current or reserved prices.
 * Existing unpublished cohorts may still share prices; this does not change them.
 * Distinct amounts aid attribution, but are not proof of a delivered endpoint call.
 */
export type PriceReservation = { id: string; amount: string; supersededAmounts?: readonly string[] }

export function assertUniqueCohortPrices(
  offers: readonly PriceReservation[],
  cohortIds: readonly string[],
  historicalPrices: readonly PriceReservation[] = [],
): void {
  if (new Set(cohortIds).size !== cohortIds.length) throw new Error('duplicate-price-cohort-id')
  for (const id of cohortIds) {
    const matches = offers.filter(o => o.id === id)
    if (matches.length !== 1) throw new Error(`missing-or-duplicate-price-offer: ${id}`)
    const offer = matches[0]
    if (!/^[1-9][0-9]*$/.test(offer.amount)) throw new Error(`invalid-price-amount: ${id}`)
    const collision = [...offers, ...historicalPrices].find(o =>
      o.id !== id && [o.amount, ...(o.supersededAmounts ?? [])].some(amount => BigInt(amount) === BigInt(offer.amount)),
    )
    if (collision) throw new Error(`reserved-price-collision: ${id} and ${collision.id} at ${offer.amount}`)
  }
}
