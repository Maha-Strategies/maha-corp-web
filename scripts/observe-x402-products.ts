import { readFile } from 'node:fs/promises'
import { payableOffers } from '../lib/x402/offers.ts'
import { readProductIndex, type IndexSnapshot } from '../lib/x402/product-index.ts'
import { readProductUsage, type UsageSnapshot } from '../lib/x402/product-usage.ts'
import { readPublicSettlementLedger } from '../lib/x402/settlement-live-store.ts'
import { compareCatalogueSnapshots, observeProduct } from '../lib/x402/product-observations.ts'

// Local/CI diagnostic. Unpaid synthetic probes only; no signing, settling, uploads or ledger writes.
const arg = (name: string) => process.argv.includes(name) ? process.argv[process.argv.indexOf(name) + 1] : undefined
const id = arg('--offer'), offers = payableOffers().filter(offer => !id || offer.id === id)
if (!offers.length) throw new Error('Unknown payable offer.')
const index = await readProductIndex()
const previousFile = arg('--previous')
const saved = previousFile ? JSON.parse(await readFile(previousFile, 'utf8')) : null
const previous = saved ? (saved.inventorySnapshot ?? saved) as IndexSnapshot : null
let usage: UsageSnapshot | undefined
if (process.argv.includes('--with-usage')) usage = await readProductUsage(offers.map(offer => offer.id))
const ledger = process.argv.includes('--with-stored-settlements') ? await readPublicSettlementLedger() : null
const products = []
for (let start = 0; start < offers.length; start += 4) {
  products.push(...await Promise.all(offers.slice(start, start + 4).map(async offer => {
    let response: Response | null = null
    try {
      response = await fetch(`https://www.mahastrategies.com${offer.path}`, { method: offer.method, redirect: 'error', cache: 'no-store',
        signal: AbortSignal.timeout(12000), headers: { 'content-type': 'application/json', 'user-agent': 'maha-read-only-quote-observer/1.0' },
        ...(offer.method === 'POST' ? { body: JSON.stringify(offer.discovery.input) } : {}) })
    } catch { /* Unknown, not a delivery failure or proof of delisting. */ }
    const row = ledger?.ledger.summary.byProduct.find(row => row.id === offer.id)
    const result = await observeProduct(offer, index, response, usage, ledger ? {
      available: ledger.source === 'scheduled_snapshot' && !ledger.stale && ledger.caughtUp && !!row && !row.attributionAmbiguous,
      observedAt: ledger.ledger.observedAt, priceMatchingTransfers: row?.settlements ?? null,
      externalIncludingAssisted: row?.externalSettlements ?? null,
      operatorTransfers: row ? row.settlements - row.externalSettlements : null,
    } : undefined)
    await response?.body?.cancel()
    return result
  })))
}
console.log(JSON.stringify({ checkedAt: new Date().toISOString(), inventorySnapshot: index,
  catalogueChanges: compareCatalogueSnapshots(previous, index), products, paymentsMade: 0,
  limitations: ['Live quotes do not prove settlement or delivery.', 'Server response counts do not prove buyer receipt.',
    'Listing absence does not authorize a paid refresh.', 'Usage is unknown unless --with-usage has access to the existing aggregate meter.'] }, null, 2))
