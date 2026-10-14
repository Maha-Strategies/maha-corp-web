import { z } from 'zod'

const address = z.string().regex(/^0x[0-9a-fA-F]{40}$/)
const network = z.string().regex(/^eip155:[1-9][0-9]{0,12}$/)
export const PRICE_UNIT_INPUT = z.object({
  dataClass: z.enum(['synthetic', 'public']),
  quotes: z.array(z.object({ id: z.string().min(1).max(80), network, asset: address,
    amount: z.string().regex(/^[1-9][0-9]{0,77}$/) }).strict()).min(1).max(64),
  assetMetadata: z.array(z.object({ network, asset: address, decimals: z.number().int().min(0).max(36),
    source: z.string().min(1).max(500), observedAt: z.iso.datetime(),
    basis: z.enum(['contract-read', 'official-registry', 'caller-declaration']) }).strict()).max(64),
}).strict().refine(v => new Set(v.quotes.map(q => q.id)).size === v.quotes.length, 'duplicate_quote_id')
  .refine(v => new Set(v.assetMetadata.map(m => m.network + ':' + m.asset.toLowerCase())).size === v.assetMetadata.length, 'duplicate_asset_metadata')

/** Token units, not USD valuations. Names and ticker symbols are not identity. */
export function tokenUnits(amount: string, decimals: number): string {
  if (!/^[1-9][0-9]{0,77}$/.test(amount) || !Number.isInteger(decimals) || decimals < 0 || decimals > 36) throw new Error('invalid_token_units')
  if (!decimals) return amount
  const padded = amount.padStart(decimals + 1, '0')
  return `${padded.slice(0, -decimals)}.${padded.slice(-decimals)}`.replace(/\.?0+$/, '')
}
const identity = (row: { network: string; asset: string }) => `${row.network}:${row.asset.toLowerCase()}`

export function auditCataloguePriceUnits(value: unknown) {
  const input = PRICE_UNIT_INPUT.parse(value)
  const metadata = new Map<string, typeof input.assetMetadata[number]>()
  const ids = new Set<string>()
  for (const item of input.assetMetadata) {
    const key = identity(item)
    if (metadata.has(key)) throw new Error('duplicate_asset_metadata')
    metadata.set(key, item)
  }
  const quotes = input.quotes.map(quote => {
    if (ids.has(quote.id)) throw new Error('duplicate_quote_id')
    ids.add(quote.id)
    const asset = metadata.get(identity(quote))
    return { id: quote.id, network: quote.network, asset: quote.asset, amountBaseUnits: quote.amount,
      decimals: asset?.decimals ?? null, tokenAmount: asset ? tokenUnits(quote.amount, asset.decimals) : null,
      status: asset ? 'normalized_from_supplied_metadata' : 'unknown_asset_decimals',
      metadataBasis: asset?.basis ?? null, metadataSource: asset?.source ?? null, metadataObservedAt: asset?.observedAt ?? null,
      usdPrice: null, independentlyVerifiedThisCall: false }
  })
  return { quotes, unknownCount: quotes.filter(q => q.tokenAmount === null).length,
    decimalsAssumedFromSymbol: false, usdPegVerified: false, paymentsMade: 0,
    boundary: 'Checks supplied metadata and exact token-unit arithmetic only. No RPC, USD valuation, historical-price reconstruction or payment-safety approval.' }
}
